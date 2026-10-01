/* The temple tour: a walk-through the tour leads (the owner: "the tour should be controlling the
   view and the character"). A small light goes ahead; the wanderer walks after it along the aisle
   to the next shrine, turns to face it, and the view comes round behind to frame it. There the
   shrine is lit (a warm spot on the being, the hall dimming round it; `Temple.setFocus`), the
   archetype wakes into its rite (player/gestures.ts), and its part of the temple's narration
   (TEMPLE, 26 marks) is spoken. The tour moves on by itself: a stop's part always plays to its
   end — nothing ever cuts it — then, after a breath, the light glides on to the next shrine
   without a click. The controls stay, secondary: "Skip ›" jumps ahead, "‹" goes back, ✕ ends
   the tour and gives you the stick again. The order is the narration's: the door, the Mind down
   the left wall, the Body down the right, the Spirit round the sanctuary, and the Choice at the
   back; after it, rest at the tree of life or stay. */
import * as THREE from "three/webgpu";
import type { Narration } from "../core/narration";
import { TEMPLE_ORIGIN } from "../world/temple";
import type { SceneModule } from "./lessonKit";

export { TEMPLE_ORIGIN };

export const TRACK_ID = "TEMPLE";
export const FINALE_T = 636.08;

/** The one companion (item 15): the guide orb itself, commandeered by the tours — it leads
    along the wanderer's own route, marks the stop by circling it, and waits while the telling
    plays. One thing, not two. */
export interface TourGuide {
  lead(d: { label: string; x: number; y: number; z: number }, from: THREE.Vector3, opts?: { via?: THREE.Vector3[]; linger?: boolean }): void;
  stop(): void;
}

export interface TourHooks {
  whisper: (text: string, ms?: number) => void;
  /** The wanderer's body: the tour seats them at the Choice (owner item 5). */
  wanderer?: { setGesture(g: "none" | "sit" | "reach" | "touch"): void };
}
/** What the tour needs of the temple. */
export interface TempleLike {
  standFor(i: number): { x: number; z: number; heading: number };
  setRite(i: number, on: boolean): void;
  /** Light shrine `i` for the tour (−1: none). */
  setFocus?(i: number): void;
  entry(): { x: number; z: number; heading: number };
  floorAt(x: number, z: number): number;
  /** The seat at the Choice's dais (world coords), facing the altar. */
  choiceSeat?(): { x: number; z: number; heading: number };
}
export interface PlayerLike {
  pos: THREE.Vector3;
  heading: number;
  /** The controller's tap-to-walk target (world x, z). */
  target: THREE.Vector2 | null;
}
export interface FollowLike {
  yaw: number;
  pitch: number;
  dist?: number;
  snapTo(p: THREE.Vector3): void;
}
export interface CueDef {
  t: number;
  label: string;
}

/** The narration's stops, verified against the actual recording (scripts/check-cues.py,
    scripts/fix-cues.py): the marks as shipped drifted against the file — each was set a
    little after its part's first word had begun, growing from 0.04 s (IV) to 0.92 s (the
    landing), so every stop began mid-word and its tail ran into the next stop's opening —
    the "cut" the owner heard. Each mark now sits in the pause 0.35 s before its part's
    first word (in the track's own time base, which the game stretches to the file), so no
    segment begins or ends mid-word, and the landing plays through FINALE_T into the file's
    own closing silence. Labels and order are the narration's: never reworded, never moved. */
export const CUES: CueDef[] = [
  { t: 0.0, label: "opening" },
  { t: 41.56, label: "I — The Magician" },
  { t: 74.01, label: "II — The High Priestess" },
  { t: 103.97, label: "III — The Empress" },
  { t: 128.44, label: "IV — The Emperor" },
  { t: 151.12, label: "V — The Hierophant" },
  { t: 175.28, label: "VI — The Lovers" },
  { t: 205.0, label: "VII — The Chariot" },
  { t: 231.27, label: "transition: mind → body" },
  { t: 238.94, label: "VIII — Strength" },
  { t: 261.94, label: "IX — The Hermit" },
  { t: 286.03, label: "X — The Wheel of Fortune" },
  { t: 312.17, label: "XI — Justice" },
  { t: 336.08, label: "XII — The Hanged Man" },
  { t: 360.63, label: "XIII — Death" },
  { t: 383.89, label: "XIV — Temperance" },
  { t: 410.36, label: "transition: body → spirit" },
  { t: 417.32, label: "XV — The Devil" },
  { t: 443.37, label: "XVI — The Tower" },
  { t: 464.99, label: "XVII — The Star" },
  { t: 487.47, label: "XVIII — The Moon" },
  { t: 509.62, label: "XIX — The Sun" },
  { t: 529.55, label: "XX — Judgement" },
  { t: 549.74, label: "XXI — The World" },
  { t: 577.5, label: "XXII — The Fool (The Choice)" },
  { t: 610.02, label: "landing" },
];



/** The sanctuary's centre and the gateway into it (temple frame). */
const CENTRE = new THREE.Vector2(0, -44);
const GATE_Z = -30;
const ARRIVE_R = 2.4;

/* ---------------------------------------------------------------- the stops */
interface Stop {
  /** The archetype whose shrine this is (0–21), or −1 for the door. */
  shrine: number;
  /** Where to stand, world x, z, and the heading that faces the shrine. */
  x: number;
  z: number;
  heading: number;
  /** Its part of the narration (track seconds). A transition is spoken on arriving at the
      shrine it leads to (the Body's first, the Spirit's first). */
  from: number;
  to: number;
  title: string;
}

/** The cue each shrine's part begins at: the Mind's seven follow the opening; the Body's first
    begins with the passage from the Mind, the Spirit's first with the passage from the Body. */
function cueFor(shrine: number): number {
  if (shrine < 7) return shrine + 1;
  if (shrine < 14) return shrine === 7 ? 8 : shrine + 2;
  return shrine === 14 ? 16 : shrine + 3;
}

function buildStops(temple: TempleLike): Stop[] {
  const door = temple.entry();
  const stops: Stop[] = [{ shrine: -1, x: door.x, z: door.z, heading: door.heading, from: 0, to: CUES[1].t, title: "The temple" }];
  for (let i = 0; i < 22; i++) {
    const s = temple.standFor(i), k = cueFor(i);
    const label = CUES[i === 7 ? 9 : i === 14 ? 17 : k].label.replace(" — ", " · ").replace(" (The Choice)", "");
    stops.push({ shrine: i, x: s.x, z: s.z, heading: s.heading, from: CUES[k].t, to: i === 21 ? FINALE_T : CUES[cueFor(i + 1)].t, title: i === 21 ? "XXII · The Choice" : label });
  }
  return stops;
}

/** The light's way from `a` to `b` (temple frame): along the aisle between the columns, through
    the gateway, and round the altar, never through a column. */
function route(a: THREE.Vector2, b: THREE.Vector2): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  const inHall = (p: THREE.Vector2) => p.y > GATE_Z;
  const ring = (p: THREE.Vector2) => {
    const ang = Math.atan2(p.y - CENTRE.y, p.x - CENTRE.x);
    return new THREE.Vector2(CENTRE.x + Math.cos(ang) * 6.5, CENTRE.y + Math.sin(ang) * 6.5);
  };
  if (inHall(a)) pts.push(new THREE.Vector2(0, a.y));
  else pts.push(ring(a));
  if (inHall(a) !== inHall(b)) {
    const inner = new THREE.Vector2(0, GATE_Z - 3), outer = new THREE.Vector2(0, GATE_Z + 2);
    if (inHall(a)) pts.push(outer, inner);
    else pts.push(inner, outer);
  }
  if (inHall(b)) pts.push(new THREE.Vector2(0, b.y));
  else {
    // round the altar the short way
    const from = pts[pts.length - 1], r = ring(b);
    let a0 = Math.atan2(from.y - CENTRE.y, from.x - CENTRE.x);
    const a1 = Math.atan2(r.y - CENTRE.y, r.x - CENTRE.x);
    if (a1 - a0 > Math.PI) a0 += Math.PI * 2;
    if (a0 - a1 > Math.PI) a0 -= Math.PI * 2;
    for (let k = 1; k <= 6; k++) {
      const ang = a0 + ((a1 - a0) * k) / 6;
      pts.push(new THREE.Vector2(CENTRE.x + Math.cos(ang) * 6.5, CENTRE.y + Math.sin(ang) * 6.5));
    }
  }
  pts.push(b.clone());
  return pts;
}

/* ---------------------------------------------------------------- the tour */
type Phase = "leading" | "speaking" | "done" | "offered";

/** A breath between a stop's last word and the light gliding on (subtitles linger 1.5 s). */
const DWELL = 2.6;

export class TempleTour implements SceneModule {
  readonly id = "tour";
  active = false;
  onRest: (() => void) | null = null;
  camera: THREE.Camera | null = null;

  private stops: Stop[] = [];
  private index = 0;
  private phase: Phase = "leading";
  private riteOn = -1;
  private spoke = 0;
  /** Seconds since the narration clock last moved (a track that will never speak). */
  private stall = 0;
  private lastT = -1;
  /** Seconds of quiet since a stop's part finished, before the light glides on. */
  private dwell = 0;
  private lifeT = 0;
  /** The companion (item 15): set by main; when absent the tour still walks itself. */
  guide: TourGuide | null = null;
  private panel: HTMLDivElement;
  private titleEl: HTMLElement;
  private hintEl: HTMLElement;
  private prevBtn: HTMLButtonElement;
  private nextBtn: HTMLButtonElement;
  private choice: HTMLDivElement;
  private choiceAsk: HTMLElement;
  private restBtn: HTMLButtonElement;
  private stayBtn: HTMLButtonElement;
  private againBtn: HTMLButtonElement;
  private leaveBtn: HTMLButtonElement;
  /** The offered end: the light retires, the wanderer walks to the seat and sits. */
  private offeredT = 0;
  private seat: { x: number; z: number; heading: number } | null = null;
  private seated = false;
  /** A replayed ending is a part like any other: it plays whole, never cut. */
  private replay = false;
  private goal = new THREE.Vector2();
  /** The wanderer's own way to the stop (world x, z), walked one point after another. */
  private walk: THREE.Vector2[] = [];
  private view = { dist: 7, pitch: 0.36 };

  constructor(
    _scene: THREE.Scene,
    private narration: Narration,
    private player: PlayerLike,
    private follow: FollowLike,
    private hooks: TourHooks,
    private temple: TempleLike,
  ) {
    // the guiding presence is the guide itself (item 15): main hands it over as `guide`

    // the guide's panel: back, where you are going, next; and ✕ to end the tour
    const btn = (text: string, cls: string, label: string) => Object.assign(document.createElement("button"), { type: "button", textContent: text, className: cls, ariaLabel: label });
    this.panel = Object.assign(document.createElement("div"), { id: "tour-panel", hidden: true });
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
    // the end: the room cleared, the wanderer seated at the dais — rest, remain, or hear the
    // ending once more (the recording is the narration's own; no words are added to it)
    this.choice = Object.assign(document.createElement("div"), { id: "tour-choice", hidden: true });
    this.choiceAsk = Object.assign(document.createElement("p"), { className: "ask" });
    this.restBtn = btn("Rest at the tree of life", "", "Rest at the tree of life");
    this.againBtn = btn("Hear it again", "", "Hear the ending once more");
    this.stayBtn = btn("Stay in the temple", "", "Stay in the temple");
    this.leaveBtn = btn("✕", "end", "Leave the choice for now");
    this.choice.append(this.choiceAsk, this.restBtn, this.againBtn, this.stayBtn, this.leaveBtn);
    document.body.append(this.choice);
    // on the touch itself (a phone sends no click while the other thumb holds the stick);
    // a keyboard's Enter or Space still clicks
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
    act(this.restBtn, () => this.choose("rest"));
    act(this.stayBtn, () => this.choose("stay"));
    act(this.againBtn, () => this.hearAgain());
    act(this.leaveBtn, () => {
      if (!this.replay) this.exit(); // a replayed part is never cut
    });
  }

  /* ---------- lifecycle ---------- */
  enter(): void {
    if (this.active) return;
    this.active = true;
    this.view = { dist: this.follow.dist ?? 7, pitch: this.follow.pitch };
    document.body.classList.add("touring");
    this.stops = buildStops(this.temple);
    this.lifeT = 0;
    this.offeredT = 0;
    this.seat = null;
    this.seated = false;
    this.replay = false;
    this.choice.hidden = true;
    this.panel.hidden = false;
    // a still frame (?shot) lands on the stop that time belongs to, already there
    const dt = this.narration.debugTime;
    if (dt !== null && Number.isFinite(dt)) {
      const k = Math.max(0, this.stops.findIndex((s) => dt >= s.from && dt < s.to));
      const s = this.stops[k];
      this.player.pos.set(s.x, this.temple.floorAt(s.x, s.z), s.z);
      this.player.heading = s.heading;
      this.go(k, true);
      return;
    }
    this.go(0);
  }

  exit(): void {
    if (!this.active) return;
    this.active = false;
    this.player.target = null;
    this.walk = [];
    this.replay = false;
    this.hooks.wanderer?.setGesture("none"); // rising, wherever the choice found them
    this.temple.setFocus?.(-1);
    document.body.classList.remove("touring");
    if (this.follow.dist !== undefined) this.follow.dist = this.view.dist;
    this.follow.pitch = this.view.pitch;
    if (this.narration.current === TRACK_ID) this.narration.stop(1.5);
    this.guide?.stop(); // the companion is dismissed with the tour
    this.panel.hidden = true;
    this.choice.hidden = true;
    this.rite(-1);
  }

  /** Send the light to stop `k` (the door is stop 0); `there`: you are there already. */
  private go(k: number, there = false): void {
    if (k < 0 || k >= this.stops.length) return;
    if (this.narration.current === TRACK_ID) this.narration.stop(1.2);
    this.rite(-1);
    this.index = k;
    this.phase = "leading";
    const s = this.stops[k], O = TEMPLE_ORIGIN;
    this.goal.set(s.x - O.x, s.z - O.z);
    this.temple.setFocus?.(-1);
    // the wanderer's way: the same aisle, from where it stands to the standing place
    const from = new THREE.Vector2(this.player.pos.x - O.x, this.player.pos.z - O.z);
    this.walk = there ? [] : route(from, this.goal).map((p) => new THREE.Vector2(p.x + O.x, p.y + O.z));
    this.player.target = null;
    // the companion flies that same route ahead of the wanderer, and marks the stop (item 15)
    if (this.guide) {
      const wait = this.waitPoint(s);
      const via = this.walk.slice(0, -1).map((p) => new THREE.Vector3(p.x, this.temple.floorAt(p.x, p.y) + 0.4, p.y));
      this.guide.lead(
        { label: s.title, x: O.x + wait.x, y: this.temple.floorAt(O.x + wait.x, O.z + wait.y), z: O.z + wait.y },
        this.player.pos,
        { via, linger: true },
      );
    }
    if (there || k === 0) this.arrive();
    this.refresh();
  }

  private next(): void {
    if (this.index >= this.stops.length - 1) return this.showChoice();
    this.go(this.index + 1);
  }

  /** Where the light waits for a stop: a little before the shrine, above the standing place. */
  private waitPoint(s: Stop): THREE.Vector2 {
    const O = TEMPLE_ORIGIN;
    return new THREE.Vector2(s.x - O.x - Math.sin(s.heading) * 1.4, s.z - O.z - Math.cos(s.heading) * 1.4);
  }

  private arrive(): void {
    const s = this.stops[this.index];
    this.phase = "speaking";
    this.spoke = 0;
    this.stall = 0;
    this.lastT = -1;
    this.dwell = 0;
    this.player.target = null;
    this.walk = [];
    this.rite(s.shrine);
    this.temple.setFocus?.(s.shrine);
    void this.narration.play(TRACK_ID, s.from, s.to);
    this.refresh();
  }

  private rite(i: number): void {
    if (i === this.riteOn) return;
    if (this.riteOn >= 0) this.temple.setRite(this.riteOn, false);
    if (i >= 0) this.temple.setRite(i, true);
    this.riteOn = i;
  }

  private refresh(): void {
    const s = this.stops[this.index];
    this.titleEl.textContent = s.title;
    this.hintEl.textContent =
      this.phase === "leading" ? "Walking there…"
      : this.phase === "speaking" ? "Listen — it moves on when the words end"
      : this.phase === "done" ? "Moving on…"
      : "";
    this.prevBtn.disabled = this.index === 0;
    this.nextBtn.textContent = this.index === this.stops.length - 1 ? "Finish ›" : "Skip ›";
    this.nextBtn.classList.toggle("ready", this.phase === "done");
  }

  update(dt: number): void {
    if (!this.active) return;
    const step = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.05) : 0;
    this.lifeT += step;
    const s = this.stops[this.index];
    // the companion flies itself (the guide's own update); the tour only commands it

    // the wanderer walks its way, point after point, and arrives at the standing place
    const O = TEMPLE_ORIGIN;
    const px = this.player.pos.x - O.x, pz = this.player.pos.z - O.z;
    if (this.phase === "leading") {
      while (this.walk.length && Math.hypot(this.player.pos.x - this.walk[0].x, this.player.pos.z - this.walk[0].y) < 0.7) this.walk.shift();
      if (this.walk.length) this.player.target = this.walk[0].clone();
      if (!this.walk.length && Math.hypot(px - this.goal.x, pz - this.goal.y) < ARRIVE_R * 0.5) this.arrive();
      else if (!this.walk.length) this.player.target = new THREE.Vector2(this.goal.x + O.x, this.goal.y + O.z);
    }
    // the view: behind the wanderer while it walks; at a shrine it comes round and draws a
    // little closer, framing the archetype over the wanderer's shoulder (the offered end
    // leaves the pilgrim alone at the seat — nothing steers them any more)
    const at = this.phase !== "leading" && this.phase !== "offered" && s.shrine >= 0;
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
    if (this.follow.dist !== undefined) this.follow.dist += ((at ? 4.4 : 6) - this.follow.dist) * Math.min(1, step * 1.5);
    // its part spoken (or no voice to speak it): the tour moves on by itself — a part is
    // never cut. A track still arriving is waited for; a silence that will never speak
    // (a missing recording) moves on after a pause, so the tour never stalls.
    if (this.phase === "speaking") {
      this.spoke += step;
      const t = this.narration.time();
      if (t > this.lastT + 0.001) {
        this.lastT = t;
        this.stall = 0;
      } else this.stall += step;
      const ended =
        this.narration.debugTime === null &&
        this.spoke > 1.5 &&
        (t >= s.to - 0.15 ||
          (this.narration.current !== TRACK_ID && !this.narration.busy(TRACK_ID) && this.stall > 4));
      if (ended) {
        this.phase = "done";
        this.dwell = 0;
        this.refresh();
      }
    }
    // a breath of quiet after the words, then the light glides on to the next shrine
    if (this.phase === "done") {
      this.dwell += step;
      if (this.dwell >= DWELL) {
        if (this.index >= this.stops.length - 1) {
          this.phase = "offered";
          this.showChoice();
        } else this.go(this.index + 1);
      }
    }
    // the offered end: the walk to the seat and the sitting; a replayed ending is a part
    // like any other — it plays whole, and only then do the actions return
    if (this.phase === "offered") {
      this.offeredT += step;
      if (this.seat && !this.seated && this.player.target) {
        const d = Math.hypot(this.player.pos.x - this.seat.x, this.player.pos.z - this.seat.z);
        if (d < 0.5) {
          this.player.target = null;
          this.player.pos.x = this.seat.x;
          this.player.pos.z = this.seat.z;
          this.player.heading = this.seat.heading;
          this.follow.yaw = this.seat.heading;
          this.seated = true;
          this.hooks.wanderer?.setGesture("sit");
        }
      }
      if (this.replay) {
        const s = this.stops[this.index];
        const t = this.narration.time();
        if (this.narration.debugTime === null && (t >= s.to - 0.15 || this.narration.current !== TRACK_ID)) {
          this.replay = false;
          this.refreshChoice();
        }
      }
    }
  }

  private showChoice(): void {
    this.panel.hidden = true;
    this.choice.hidden = false;
    this.rite(-1);
    // the room clears: the companion's work is done — it is on its way
    this.offeredT = 0;
    this.guide?.stop();
    // the pilgrim is walked to the seat at the dais, and sits for the choice
    this.seat = this.temple.choiceSeat?.() ?? null;
    this.seated = false;
    this.replay = false;
    if (this.seat) this.player.target = new THREE.Vector2(this.seat.x, this.seat.z);
    this.refreshChoice();
  }

  private refreshChoice(): void {
    this.choiceAsk.textContent = this.replay
      ? "Listening — the ending, once more."
      : "Nothing is taken from you here. Rest, remain, or hear the ending once more.";
    for (const b of [this.restBtn, this.stayBtn, this.againBtn, this.leaveBtn]) b.disabled = this.replay;
  }

  /** Sit (again) with the ending: the recording's own last part, whole, never cut. */
  private hearAgain(): void {
    if (this.phase !== "offered" || this.replay) return;
    const s = this.stops[this.index];
    this.replay = true;
    this.refreshChoice();
    void this.narration.play(TRACK_ID, s.from, s.to);
  }

  /** The end: rest at the tree of life, or stay in the temple and walk freely. */
  choose(key: "rest" | "stay"): void {
    if (this.replay) return; // a replayed part is never cut
    this.exit();
    if (key === "rest") this.onRest?.();
  }

  /** The tour walks for you: the stick rests while it runs. */
  holdsMovement(): boolean {
    return this.active;
  }
  nearSeat(): boolean {
    return false;
  }
  onSit(): void {}
  onStand(): void {}

  dispose(): void {
    this.exit();
    this.panel.remove();
    this.choice.remove();
  }
}
