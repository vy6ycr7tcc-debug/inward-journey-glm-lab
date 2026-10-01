// @vitest-environment jsdom
/* Behavior tests for the temple tour's automatic advance (owner item 1): a stop's part
   always plays to its end before the tour moves on — no click; skip/back/exit stay;
   a track still loading is waited for; the finale offers the rest/stay choice. */
import { describe, it, expect } from "vitest";

// jsdom lacks the media/window/canvas probes the import chain makes at module scope —
// stub them before the dynamic imports below
(globalThis as Record<string, unknown>).matchMedia =
  (globalThis as Record<string, unknown>).matchMedia ??
  (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
HTMLCanvasElement.prototype.getContext = function (): CanvasRenderingContext2D | null {
  return {
    createRadialGradient: () => ({ addColorStop: () => {} }),
    fillRect: () => {},
  } as unknown as CanvasRenderingContext2D;
} as typeof HTMLCanvasElement.prototype.getContext;
const { TempleTour, TRACK_ID, CUES, FINALE_T, TEMPLE_ORIGIN } = await import("./templeTour");
const THREE = await import("three/webgpu");
type TourHooks = import("./templeTour").TourHooks;
type TempleLike = import("./templeTour").TempleLike;
type PlayerLike = import("./templeTour").PlayerLike;
type FollowLike = import("./templeTour").FollowLike;
type Tour = import("./templeTour").TempleTour;

/** A narration double: the voice plays in real time while it is current; everything
    the tour can do to it is recorded so the tests can judge it. */
class FakeNarration {
  current: string | null = null;
  debugTime: number | null = null;
  busyFlag = false;
  /** true: a voice (real or faked subtitles paced as speech); false: decoded to nothing. */
  voicing = true;
  /** Seconds left before the fake-subtitle run gives up (finish(): current → null). */
  fakeLeft = Infinity;
  stopCalls = 0;
  plays: Array<{ id: string; from: number; to: number }> = [];
  /** Segments stop() interrupted before their end — the tour must never make one. */
  cuts: Array<{ from: number; to: number; at: number }> = [];
  private t = 0;
  private from = 0;
  private to = Infinity;
  time(): number {
    return this.t;
  }
  stop(): void {
    this.stopCalls++;
    if (this.current === TRACK_ID && this.t < this.to - 0.16) this.cuts.push({ from: this.from, to: this.to, at: this.t });
    this.current = null;
  }
  play(id: string, from = 0, to = Infinity): Promise<void> {
    this.plays.push({ id, from, to });
    this.current = id;
    this.from = from;
    this.to = to;
    this.t = from;
    return Promise.resolve();
  }
  busy(): boolean {
    return this.busyFlag;
  }
  /** The voice in real time, while it is the current one. */
  tick(dt: number): void {
    if (this.current !== TRACK_ID) return;
    if (this.busyFlag) return;
    if (this.voicing) this.t = Math.min(this.to, this.t + dt);
    else {
      this.fakeLeft -= dt;
      if (this.fakeLeft <= 0) this.current = null; // the last fake subtitle ran out
    }
  }
}

/** The temple double: shrines down the left wall, the right wall, and round the sanctuary.
    Like the real temple, standFor/entry answer in WORLD coordinates. */
function makeTemple(): TempleLike {
  return {
    standFor(i: number) {
      if (i < 7) return { x: TEMPLE_ORIGIN.x - 3.2, z: TEMPLE_ORIGIN.z - 4 - i * 3, heading: Math.PI / 2 };
      if (i < 14) return { x: TEMPLE_ORIGIN.x + 3.2, z: TEMPLE_ORIGIN.z - 4 - (i - 7) * 3, heading: -Math.PI / 2 };
      const a = Math.PI * (0.15 + (i - 14) * 0.1);
      return { x: TEMPLE_ORIGIN.x + Math.cos(a) * 6.5, z: TEMPLE_ORIGIN.z - 44 + Math.sin(a) * 6.5, heading: Math.atan2(-Math.cos(a), -Math.sin(a)) };
    },
    setRite() {},
    setFocus() {},
    entry: () => ({ x: TEMPLE_ORIGIN.x, z: TEMPLE_ORIGIN.z + 2, heading: Math.PI }),
    floorAt: () => 0,
    choiceSeat: () => ({ x: TEMPLE_ORIGIN.x, z: TEMPLE_ORIGIN.z - 41.45, heading: 0 }),
  };
}

const gestures: string[] = [];

function makeTour(temple = makeTemple()) {
  gestures.length = 0;
  const narr = new FakeNarration();
  // the wanderer stands just inside the temple door (the temple sits far out in the world)
  const player: PlayerLike = { pos: new THREE.Vector3(TEMPLE_ORIGIN.x, 0, TEMPLE_ORIGIN.z + 6), heading: Math.PI, target: null };
  const follow: FollowLike = { yaw: Math.PI, pitch: 0.3, dist: 6, snapTo() {} };
  const hooks: TourHooks = { whisper() {}, wanderer: { setGesture: (g) => gestures.push(g) } };
  const tour = new TempleTour(new THREE.Scene(), narr as unknown as import("../core/narration").Narration, player, follow, hooks, temple);
  return { tour, narr, player };
}

/** One frame of the world: the controller walks toward its target, the voice plays on. */
function step(tour: Tour, narr: FakeNarration, player: PlayerLike, dt = 0.05): void {
  if (player.target) {
    const dx = player.target.x - player.pos.x, dz = player.target.y - player.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.01) {
      const v = Math.min(d, 2.6 * dt);
      player.pos.x += (dx / d) * v;
      player.pos.z += (dz / d) * v;
    }
  }
  narr.tick(dt);
  tour.update(dt);
}

function press(btn: Element): void {
  btn.dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true }));
}

/** The panel's own buttons (not DOM queries: a failed test's undisposed panel could shadow them). */
function nextBtn(tour: Tour): HTMLButtonElement {
  return (tour as unknown as { nextBtn: HTMLButtonElement }).nextBtn;
}
function prevBtn(tour: Tour): HTMLButtonElement {
  return (tour as unknown as { prevBtn: HTMLButtonElement }).prevBtn;
}
function choiceBtn(tour: Tour, which: "rest" | "again" | "stay" | "leave"): HTMLButtonElement {
  const key = which === "rest" ? "restBtn" : which === "again" ? "againBtn" : which === "stay" ? "stayBtn" : "leaveBtn";
  return (tour as unknown as Record<string, HTMLButtonElement>)[key];
}

describe("the temple tour's automatic advance", () => {
  it("walks the whole tour by itself: 23 parts, each played to its end, never cut", () => {
    const { tour, narr, player } = makeTour();
    tour.enter();
    // the whole tour, in simulated seconds: the narration's 636 s + walks + dwells + slack
    const SIM = 900, dt = 0.05;
    for (let k = 0; k < SIM / dt; k++) {
      step(tour, narr, player, dt);
      if (document.getElementById("tour-choice") && !document.getElementById("tour-choice")!.hidden) break;
    }
    expect(narr.plays.length).toBe(23); // the door + 22 shrines
    expect(narr.cuts).toEqual([]); // nothing was ever interrupted
    // the parts are the narration's own, in order, ending where the next begins
    expect(narr.plays[0]).toMatchObject({ id: TRACK_ID, from: 0, to: CUES[1].t });
    expect(narr.plays[1]).toMatchObject({ from: CUES[1].t, to: CUES[2].t });
    expect(narr.plays[7]).toMatchObject({ from: CUES[7].t, to: CUES[8].t }); // the last Mind shrine
    expect(narr.plays[8]).toMatchObject({ from: CUES[8].t, to: CUES[10].t }); // the transition into the Body + VIII
    expect(narr.plays[15]).toMatchObject({ from: CUES[16].t, to: CUES[18].t }); // into the Spirit + XV
    expect(narr.plays[22]).toMatchObject({ from: CUES[24].t, to: FINALE_T }); // XXII through the landing
    // the end offers the choice, and no button was ever pressed
    expect(document.getElementById("tour-choice")!.hidden).toBe(false);
    tour.dispose();
  });

  it("waits for a track that is still arriving, however slow", () => {
    const { tour, narr, player } = makeTour();
    narr.busyFlag = true;
    tour.enter();
    for (let k = 0; k < 60 / 0.05; k++) step(tour, narr, player); // a full minute of nothing
    expect(narr.plays.length).toBe(1); // arrived, asked once, and waited
    narr.busyFlag = false; // the voice arrives and speaks in real time
    for (let k = 0; k < (CUES[1].t + 8) / 0.05; k++) step(tour, narr, player);
    expect(narr.plays.length).toBe(2); // the door's part finished; the light went on
    expect(narr.cuts).toEqual([]);
    tour.dispose();
  });

  it("moves on when no voice will ever speak, so the tour never stalls", () => {
    const { tour, narr, player } = makeTour();
    narr.voicing = false; // decoded to nothing: only the fake subtitles run
    narr.fakeLeft = 6; // …and they give up 6 s in (finish(): the track lets go)
    tour.enter();
    for (let k = 0; k < 30 / 0.05; k++) step(tour, narr, player);
    expect(narr.plays.length).toBeGreaterThanOrEqual(2); // the silence was crossed, and keeps being crossed
    expect(narr.cuts).toEqual([]);
    tour.dispose();
  });

  it("skip still cuts ahead when the visitor asks, and back returns", () => {
    const { tour, narr, player } = makeTour();
    tour.enter();
    for (let k = 0; k < 5 / 0.05; k++) step(tour, narr, player); // mid-sentence at the door
    press(nextBtn(tour));
    for (let k = 0; k < 30 / 0.05 && narr.plays.length < 2; k++) step(tour, narr, player); // walk to shrine I
    expect(narr.plays.length).toBe(2); // jumped to shrine I
    expect(narr.cuts.length).toBe(1); // the door's part was cut — by request, so allowed
    press(prevBtn(tour));
    for (let k = 0; k < 30 / 0.05 && narr.plays.length < 3; k++) step(tour, narr, player);
    expect(narr.plays.length).toBe(3); // back to the door's part
    tour.dispose();
  });

  it("a still frame (?shot debugTime) never advances on its own", () => {
    const { tour, narr, player } = makeTour();
    narr.debugTime = 320;
    tour.enter();
    for (let k = 0; k < 200; k++) step(tour, narr, player);
    expect(narr.plays.length).toBe(1);
    tour.dispose();
  });

  it("the Choice: the room clears, the pilgrim sits, and the ending can be heard whole once more", () => {
    const { tour, narr, player } = makeTour();
    tour.enter();
    for (let k = 0; k < 900 / 0.05; k++) {
      step(tour, narr, player);
      if (!document.getElementById("tour-choice")!.hidden) break;
    }
    const ask = document.querySelector("#tour-choice .ask")!;
    expect(ask.textContent).toContain("Nothing is taken from you here");
    // the wanderer walks to the seat and sits; the guiding light retires
    for (let k = 0; k < 10 / 0.05; k++) step(tour, narr, player);
    expect(gestures).toContain("sit");
    expect(player.pos.z).toBeCloseTo(TEMPLE_ORIGIN.z - 41.45, 1);
    const light = (tour as unknown as { light: { visible: boolean } }).light;
    expect(light.visible).toBe(false); // its work is done; the room is cleared
    // hear it again: the recording's own final part, whole (XXII through the landing)
    const played = narr.plays.length;
    press(choiceBtn(tour, "again"));
    expect(narr.plays[played]).toMatchObject({ id: TRACK_ID, from: CUES[24].t, to: FINALE_T });
    expect(ask.textContent).toContain("Listening");
    // a replayed part is a part: the actions wait, and none of them cuts it
    for (const which of ["rest", "again", "stay", "leave"] as const) expect(choiceBtn(tour, which).disabled).toBe(true);
    const cutsBefore = narr.cuts.length;
    press(choiceBtn(tour, "rest"));
    press(choiceBtn(tour, "leave"));
    expect(narr.cuts.length).toBe(cutsBefore);
    expect((tour as unknown as { active: boolean }).active).toBe(true);
    // the ending finishes; the actions come back; staying ends the tour and the pilgrim rises
    for (let k = 0; k < (FINALE_T - CUES[24].t + 4) / 0.05; k++) step(tour, narr, player);
    expect(choiceBtn(tour, "stay").disabled).toBe(false);
    press(choiceBtn(tour, "stay"));
    expect((tour as unknown as { active: boolean }).active).toBe(false);
    expect(gestures[gestures.length - 1]).toBe("none");
    tour.dispose();
  });
});
