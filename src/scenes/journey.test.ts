// @vitest-environment jsdom
/* Behavior tests for the journey's failure paths (owner item 9): a room that will not build
   must say so and step back — never a frozen black frame with dead doors; and the doors must
   answer even while no room exists. */
import { describe, it, expect } from "vitest";

(globalThis as Record<string, unknown>).matchMedia =
  (globalThis as Record<string, unknown>).matchMedia ??
  (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
HTMLCanvasElement.prototype.getContext = function (): CanvasRenderingContext2D | null {
  return { createRadialGradient: () => ({ addColorStop: () => {} }), fillRect: () => {} } as unknown as CanvasRenderingContext2D;
} as typeof HTMLCanvasElement.prototype.getContext;

const J = await import("./journey");
const { Journey, JOURNEY_ORIGIN } = J;
type Stage = import("./journey").Stage;
type JourneyHost = import("./journey").JourneyHost;
type JourneyT = import("./journey").Journey;
const THREE = await import("three/webgpu");

/** A minimal room that stands and disposes. */
type Room = import("./lessonKit").SceneModule;
function okRoom(): Room {
  return { id: "room", active: true, nearSeat: () => false, onSit() {}, onStand() {}, holdsMovement: () => false, update() {}, dispose() {} };
}

function makeJourney(stages: Stage[]) {
  const whispers: string[] = [];
  const placed: number[] = [];
  const host: JourneyHost = {
    scene: new THREE.Scene(),
    narration: { stop() {}, play: () => Promise.resolve() } as unknown as JourneyHost["narration"],
    whisper: (t: string) => whispers.push(t),
    keep: () => false,
    place: (x: number, y: number, z: number) => placed.push(x, y, z),
    fade() {},
    busy() {},
    settle: () => Promise.resolve(),
    apart() {},
    outside: () => ({ x: 1, y: 2, z: 3, heading: 0 }),
  };
  return { journey: new Journey("test", stages, host) as JourneyT, whispers, placed, host };
}

/** go() is private — the tests drive the same door the exits use. */
const cross = (j: JourneyT, to: number, dark = 0.05): Promise<void> =>
  (j as unknown as { go: (to: number, dark: number) => Promise<void> }).go(to, dark);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(cond: () => boolean, ms = 9000): Promise<void> {
  const t0 = Date.now();
  while (!cond() && Date.now() - t0 < ms) await sleep(60);
  expect(cond()).toBe(true);
}

describe("a journey room that fails to build", () => {
  it("whispers and steps back to the room that stood before — never a frozen void", { timeout: 30000 }, async () => {
    const stages: Stage[] = [
      { id: "first", title: "First", make: async () => okRoom(), start: { x: 0, z: 0, heading: 0 }, exits: [], confine: () => {} },
      { id: "broken", title: "Broken", make: async () => { throw new Error("no such module"); }, start: { x: 0, z: 0, heading: 0 }, exits: [], confine: () => {} },
    ];
    const { journey, whispers } = makeJourney(stages);
    await journey.enter(0);
    await until(() => !journey.crossing);
    expect(journey.at).toBe(0);
    await cross(journey, 1); // the broken room
    expect(whispers.some((w) => w.includes("would not open"))).toBe(true);
    // the recovery walks you back on its own
    await until(() => journey.at === 0 && journey.room !== null && !journey.crossing);
    expect(journey.at).toBe(0); // back in the first room
    expect(journey.room).not.toBeNull();
  });

  it("after two failures in a row it walks you out instead of circling a broken monument", { timeout: 30000 }, async () => {
    let n = 0;
    const stages: Stage[] = [
      { id: "first", title: "First", make: async () => okRoom(), start: { x: 0, z: 0, heading: 0 }, exits: [], confine: () => {} },
      { id: "broken", title: "Broken", make: async () => { n++; throw new Error("still broken"); }, start: { x: 0, z: 0, heading: 0 }, exits: [], confine: () => {} },
    ];
    const { journey } = makeJourney(stages);
    await journey.enter(0);
    await until(() => !journey.crossing);
    await cross(journey, 1); // first failure: back to the first room
    await until(() => journey.at === 0 && journey.room !== null && !journey.crossing);
    await cross(journey, 1); // second failure: out, into the world
    await until(() => journey.inside === false);
    expect(n).toBe(2);
    expect(journey.inside).toBe(false); // out in the world, not in a void
  });

  it("the doors answer even while no room exists", async () => {
    const stages: Stage[] = [
      { id: "first", title: "First", make: async () => okRoom(), start: { x: 0, z: 0, heading: 0 }, exits: [{ x: 0, z: 5, r: 1.4, to: "out" }], confine: () => {} },
    ];
    const { journey } = makeJourney(stages);
    await journey.enter(0);
    // the room vanishes (a failed rebuild): the exit must still fire
    journey.room = null;
    const pos = new THREE.Vector3(JOURNEY_ORIGIN.x, 0, JOURNEY_ORIGIN.z + 5);
    const alive = journey.update(0.016, pos);
    expect(alive).toBe(true);
    expect(journey.crossing).toBe(true); // the door took it
  });
});
