/* The Duat's tour (item 8), built on the temple tour's automatic pattern (scenes/templeTour.ts):
   a small light goes ahead along the way, the wanderer walks after it, and at each stop the
   place's name is spoken — only the names of places are ever spoken (duat.ts's header rule) —
   while the hour's telling plays. The tour moves on by itself once a telling has held its time:
   nothing is ever cut, and there is nothing to click. The controls stay secondary: "Skip ›"
   jumps ahead, "‹" goes back, ✕ ends the tour and gives you the stick.
   No Duat narration exists as recordings yet (docs/duat-audio-inventory.md — nothing is
   invented, nothing synthesized), so the stops hold in silence; a track can be laid under
   them later without moving anything else. */
import * as THREE from "three/webgpu";
import { duatHeight, duatTourStops, DUAT_PATH, type TourStop } from "./duat";
import { DUAT_ORIGIN } from "./pyramid";

type Phase = "leading" | "telling" | "done" | "offered";
const DWELL = 2.6; // a breath between a stop's telling and the light gliding on
const ARRIVE_R = 2.2;

export interface DuatTourPlayer {
  pos: THREE.Vector3;
  heading: number;
  target: THREE.Vector2 | null;
}
export interface DuatTourFollow {
  yaw: number;
  pitch: number;
  dist?: number;
  snapTo(p: THREE.Vector3): void;
}
export interface DuatTourHooks {
  whisper: (text: string, ms?: number) => void;
}

/** The one companion (item 15): the guide orb itself, leading the night's tour along the
    wanderer's own route. */
export interface TourGuide {
  lead(d: { label: string; x: number; y: number; z: number }, from: THREE.Vector3, opts?: { via?: THREE.Vector3[]; linger?: boolean }): void;
  stop(): void;
}

/** The light's way from a to b (Duat-local x, z): along the path's own polyline, never over
    the dunes. */
function route(a: THREE.Vector2, b: THREE.Vector2): THREE.Vector2[] {
  const near = (p: THREE.Vector2) => {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < DUAT_PATH.length; i++) {
      const d = (DUAT_PATH[i].x - p.x) ** 2 + (DUAT_PATH[i].z - p.y) ** 2;
      if (d < bd) (bd = d), (bi = i);
    }
    return bi;
  };
  const ia = near(a), ib = near(b);
  const pts: THREE.Vector2[] = [];
  let step = ia <= ib ? 1 : -1;
  for (let i = ia + step; i !== ib + step && i >= 0 && i < DUAT_PATH.length; i += step) pts.push(new THREE.Vector2(DUAT_PATH[i].x, DUAT_PATH[i].z));
  pts.push(b.clone());
  return pts;
}

export class DuatTour {
  readonly id = "duat-tour";
  active = false;
  /** The session is paused (item 13's controller rides this tour too): the light, the walk
      and the telling's hold all wait. Driven from the narration engine's flag (main.ts). */
  paused = false;
  /** The companion (item 15): set by main; when absent the tour still walks itself. */
  guide: TourGuide | null = null;
  private stops: TourStop[] = [];
  private index = 0;
  private phase: Phase = "leading";
  private hold = 0;
  private dwell = 0;
  private lifeT = 0;
  /** The light's place, Duat-local x, z. */
  private walk: THREE.Vector2[] = [];
  private goal = new THREE.Vector2();
  private panel: HTMLDivElement;
  private titleEl: HTMLElement;
  private hintEl: HTMLElement;
  private prevBtn: HTMLButtonElement;
  private nextBtn: HTMLButtonElement;
  private endBox: HTMLDivElement;
  private stayBtn: HTMLButtonElement;
  private climbBtn: HTMLButtonElement;

  constructor(_scene: THREE.Scene, private player: DuatTourPlayer, private follow: DuatTourFollow, private hooks: DuatTourHooks) {
    // the guiding presence is the guide itself (item 15): main hands it over as `guide`
  // the guide's panel: back, where you are, next; and ✕ to end the tour
    const btn = (text: string, cls: string, label: string) => Object.assign(document.createElement("button"), { type: "button", textContent: text, className: cls, ariaLabel: label });
    this.panel = Object.assign(document.createElement("div"), { id: "duat-tour-panel", hidden: true });
    this.prevBtn = btn("‹", "step", "Back");
    this.nextBtn = btn("Skip ›", "step next", "Skip ahead");
    const end = btn("✕", "end", "End the tour");
    const mid = document.createElement("div");
    mid.className = "mid";
    this.titleEl = Object.assign(document.createElement("p"), { className: "title" });
    this.hintEl = Object.assign(document.createElement("p"), { className: "hint" });
    mid.append(this.titleEl, this.hintEl);
    this.panel.append(this.prevBtn, mid, this.nextBtn, end);
    document.body.append(this.panel);
    // the end: stay in the night and walk freely, or walk on up the stair to the dawn
    this.endBox = Object.assign(document.createElement("div"), { id: "duat-tour-end", hidden: true });
    this.stayBtn = btn("Stay in the night", "", "Stay in the Duat and walk freely");
    this.climbBtn = btn("Climb to the dawn", "", "Walk on up the stair to the dawn");
    const leave = btn("✕", "end", "Leave the choice for now");
    this.endBox.append(this.stayBtn, this.climbBtn, leave);
    document.body.append(this.endBox);
    // on the touch itself (a phone sends no click while the other thumb holds the stick)
    const act = (b: HTMLButtonElement, fn: () => void) => {
      b.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        fn();
      });
      b.addEventListener("click", (e) => (e as MouseEvent).detail === 0 && fn());
    };
    act(this.prevBtn, () => this.go(this.index - 1));
    act(this.nextBtn, () => this.next());
    act(end, () => this.exit());
    act(this.stayBtn, () => this.exit());
    act(this.climbBtn, () => {
      this.exit();
      // the last leg, walked by the wanderer itself: the stair to the dawn
      const last = DUAT_PATH[DUAT_PATH.length - 1];
      this.player.target = new THREE.Vector2(DUAT_ORIGIN.x + last.x, DUAT_ORIGIN.z + last.z);
    });
    act(leave, () => (this.endBox.hidden = true));
  }

  /* ---------- lifecycle ---------- */
  /** Open the tour at stop `k` (0 the door); `there`: you are there already (a still frame). */
  enter(k = 0, there = false): void {
    if (this.active) return;
    this.active = true;
    this.stops = duatTourStops();
    this.lifeT = 0;
    this.endBox.hidden = true;
    this.panel.hidden = false;
    const s = this.stops[Math.max(0, Math.min(k, this.stops.length - 1))];
    if (there) {
      this.placeAt(this.stops.indexOf(s));
      this.go(this.stops.indexOf(s), true);
      return;
    }
    this.go(k);
  }

  exit(): void {
    if (!this.active) return;
    this.active = false;
    this.player.target = null;
    this.walk = [];
    document.body.classList.remove("touring");
    if (this.follow.dist !== undefined) this.follow.dist = 7;
    this.panel.hidden = true;
    this.endBox.hidden = true;
    this.guide?.stop(); // the companion is dismissed with the tour
  }

  private placeAt(k: number): void {
    const s = this.stops[k], O = DUAT_ORIGIN;
    this.player.pos.set(O.x + s.x, O.y + s.y, O.z + s.z);
    this.player.heading = s.heading;
    this.follow.yaw = s.heading;
    this.follow.snapTo(this.player.pos);
  }

  /** Send the light to stop `k`; the wanderer walks the way after it. */
  private go(k: number, there = false): void {
    if (k < 0 || k >= this.stops.length) return;
    this.index = k;
    this.phase = "leading";
    const s = this.stops[k];
    this.goal.set(s.x, s.z);
    const from = new THREE.Vector2(this.player.pos.x - DUAT_ORIGIN.x, this.player.pos.z - DUAT_ORIGIN.z);
    this.walk = there
      ? []
      : route(from, this.goal).map((p) => new THREE.Vector2(DUAT_ORIGIN.x + p.x, DUAT_ORIGIN.z + p.y));
    this.player.target = null;
    // the companion flies the wanderer's own route ahead of them, and marks the stop (item 15)
    if (this.guide) {
      const via = this.walk.slice(0, -1).map((p) => new THREE.Vector3(p.x, DUAT_ORIGIN.y + duatHeight(p.x - DUAT_ORIGIN.x, p.y - DUAT_ORIGIN.z) + 1.9, p.y));
      this.guide.lead(
        { label: s.title, x: DUAT_ORIGIN.x + s.x, y: DUAT_ORIGIN.y + s.y + 1.6, z: DUAT_ORIGIN.z + s.z },
        this.player.pos,
        { via, linger: true },
      );
    }
    if (there || k === 0) this.arrive();
    this.refresh();
  }

  private next(): void {
    if (this.index >= this.stops.length - 1) return this.showEnd();
    this.go(this.index + 1);
  }

  /** The half-moon's "next" (item 13): on to the next stop now. */
  skip(): void {
    this.next();
  }

  /** The session's pause (item 13's controller drives it once that PR has merged): the
      light, the walk and the telling's hold all wait, and resume picks up where it stood. */
  pause(): void {
    this.paused = true;
  }
  resume(): void {
    this.paused = false;
  }

  /** The stop the tour stands at, for the controller's card. */
  get stopTitle(): string {
    return this.stops[this.index]?.title ?? "";
  }

  private arrive(): void {
    const s = this.stops[this.index];
    this.phase = "telling";
    this.hold = 0;
    this.dwell = 0;
    this.player.target = null;
    this.walk = [];
    this.hooks.whisper(s.title, 5000); // the name of the place; nothing more is said
    this.refresh();
  }

  private refresh(): void {
    const s = this.stops[this.index];
    this.titleEl.textContent = s.title;
    this.hintEl.textContent =
      this.phase === "leading" ? "Walking there…"
      : this.phase === "telling" ? "Listen — it moves on when the telling has had its time"
      : this.phase === "done" ? "Moving on…"
      : "";
    this.prevBtn.disabled = this.index === 0;
    this.nextBtn.textContent = this.index === this.stops.length - 1 ? "Finish ›" : "Skip ›";
    this.nextBtn.classList.toggle("ready", this.phase === "done");
  }

  private showEnd(): void {
    this.panel.hidden = true;
    this.endBox.hidden = false;
    this.phase = "offered";
  }

  update(dt: number): void {
    if (!this.active || this.paused || this.phase === "offered") return;
    const step = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.05) : 0;
    this.lifeT += step;
    // the companion flies itself (the guide's own update); the tour only commands it

    // the wanderer walks its way, point after point, and arrives at the standing place
    if (this.phase === "leading") {
      while (this.walk.length && Math.hypot(this.player.pos.x - this.walk[0].x, this.player.pos.z - this.walk[0].y) < 0.8) this.walk.shift();
      if (this.walk.length) this.player.target = this.walk[0].clone();
      else this.player.target = new THREE.Vector2(this.goal.x + DUAT_ORIGIN.x, this.goal.y + DUAT_ORIGIN.z);
      if (Math.hypot(this.player.pos.x - (this.goal.x + DUAT_ORIGIN.x), this.player.pos.z - (this.goal.y + DUAT_ORIGIN.z)) < ARRIVE_R) this.arrive();
    }
    // at a stop the wanderer turns to face the telling, and the view comes round behind
    const s = this.stops[this.index];
    const at = this.phase !== "leading";
    if (at) {
      let dh = s.heading - this.player.heading;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      this.player.heading += dh * Math.min(1, step * 3);
    }
    const yawGoal = at ? s.heading : this.player.heading;
    let dy = yawGoal - this.follow.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.follow.yaw += dy * Math.min(1, step * (at ? 1.4 : 2));
    this.follow.pitch += ((at ? 0.14 : 0.3) - this.follow.pitch) * Math.min(1, step * 1.5);
    if (this.follow.dist !== undefined) this.follow.dist += ((at ? 4.6 : 6) - this.follow.dist) * Math.min(1, step * 1.5);
    // the telling has held its time (no narration exists to end — see the header): on it goes
    if (this.phase === "telling") {
      this.hold += step;
      if (this.hold >= s.hold) {
        this.phase = "done";
        this.dwell = 0;
        this.refresh();
      }
    }
    if (this.phase === "done") {
      this.dwell += step;
      if (this.dwell >= DWELL) {
        if (this.index >= this.stops.length - 1) this.showEnd();
        else this.go(this.index + 1);
      }
    }
  }

  /** The tour walks for you: the stick rests while it runs. */
  holdsMovement(): boolean {
    return this.active;
  }

  dispose(): void {
    this.exit();
    this.panel.remove();
    this.endBox.remove();
  }
}
