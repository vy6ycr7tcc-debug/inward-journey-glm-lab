// @vitest-environment jsdom
/* Item 13 — pause for every seated narration and every tour, on the one controller:
   the narration's clock freezes exactly where the pause took it, resume picks up the very
   second it held, back rides along, a fresh play supersedes the pause, and a tour whose
   session is paused never moves on by itself. */
import { describe, expect, it } from "vitest";

(globalThis as Record<string, unknown>).matchMedia =
  (globalThis as Record<string, unknown>).matchMedia ??
  (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
HTMLCanvasElement.prototype.getContext = function (): CanvasRenderingContext2D | null {
  return { createRadialGradient: () => ({ addColorStop: () => {} }), fillRect: () => {} } as unknown as CanvasRenderingContext2D;
} as typeof HTMLCanvasElement.prototype.getContext;

const { Narration, TRACKS } = await import("./narration");
const THREE = await import("three/webgpu");
const { TempleTour, TRACK_ID, CUES } = await import("../scenes/templeTour");
const audio = { ctx: null, volume: 0.8, duck: () => {} } as unknown as ConstructorParameters<typeof Narration>[0];
const sub = document.createElement("div");
const TRACK = Object.keys(TRACKS)[0];

describe("the narration's pause (item 13)", () => {
  it("freezes the clock where it stood; resume picks up the very second; back rides along", async () => {
    const n = new Narration(audio, sub);
    n.debugTime = 42;
    await n.play(TRACK);
    expect(n.current).toBe(TRACK);
    n.pause();
    expect(n.paused).toBe(true);
    expect(n.time()).toBe(42);
    n.back(15); // paused: the held place itself goes back
    expect(n.time()).toBe(27);
    n.resume(); // debug path: the track is current again, the clock free
    expect(n.paused).toBe(false);
    expect(n.current).toBe(TRACK);
  });

  it("holds even with no voice at all — a tour of the silent night may pause", () => {
    const n = new Narration(audio, sub);
    expect(n.current).toBeNull();
    n.pause();
    expect(n.paused).toBe(true);
    expect(n.time()).toBe(0);
    n.resume();
    expect(n.paused).toBe(false);
  });

  it("never goes back before the track's own start", async () => {
    const n = new Narration(audio, sub);
    n.debugTime = 3;
    await n.play(TRACK);
    n.pause();
    n.back(100);
    expect(n.time()).toBe(0);
  });

  it("a fresh play supersedes the pause; a stop clears it", async () => {
    const n = new Narration(audio, sub);
    n.debugTime = 10;
    await n.play(TRACK);
    n.pause();
    await n.play(TRACK);
    expect(n.paused).toBe(false);
    n.pause();
    n.stop();
    expect(n.paused).toBe(false);
    expect(n.current).toBeNull();
  });

  it("the fake-subtitle path keeps its place too: pause holds, resume re-tells from there", async () => {
    const n = new Narration(audio, sub);
    await n.play(TRACK); // no audio context here: the words arrive as paced subtitles
    expect(n.current).toBe(TRACK);
    n.pause();
    expect(n.paused).toBe(true);
    n.resume();
    expect(n.paused).toBe(false);
    expect(n.current).toBe(TRACK);
  });
});

describe("a paused tour never moves on by itself", () => {
  it("holds the stop while paused, and moves on once the session resumes", async () => {
    // a narration double whose clock only moves when the session is not paused
    class FakeNarration {
      current: string | null = null;
      debugTime: number | null = null;
      paused = false;
      private t = 0;
      plays: Array<{ from: number; to: number }> = [];
      time(): number {
        return this.t;
      }
      setTime(v: number): void {
        this.t = v;
      }
      stop(): void {
        this.current = null;
      }
      play(_id: string, from = 0, to = Infinity): Promise<void> {
        this.plays.push({ from, to });
        this.current = TRACK_ID;
        this.t = from;
        return Promise.resolve();
      }
      busy(): boolean {
        return false;
      }
    }
    const scene = new THREE.Scene();
    const fake = new FakeNarration();
    const tour = new TempleTour(
      scene,
      fake as unknown as ConstructorParameters<typeof TempleTour>[1],
      { pos: new THREE.Vector3(), heading: 0, target: null },
      { yaw: 0, pitch: 0.2, snapTo: () => {} },
      { whisper: () => {} },
      {
        standFor: () => ({ x: 0, z: -10, heading: Math.PI }),
        setRite: () => {},
        entry: () => ({ x: 0, z: 20, heading: Math.PI }),
        floorAt: () => 0,
      },
    );
    tour.enter();
    expect(fake.plays.length).toBe(1); // the door's part is speaking
    const step = (dt: number) => tour.update(dt);
    // paused: however long the visitor rests, the tour stands at its stop
    fake.paused = true;
    for (let k = 0; k < 600; k++) step(1 / 60);
    expect(fake.plays.length).toBe(1);
    // resumed: the part plays to its end, a breath passes, and the light glides on — the tour
    // stands at the next stop (its part begins once the wanderer has walked there)
    fake.paused = false;
    fake.setTime(CUES[1].t + 0.2);
    for (let k = 0; k < 400; k++) step(1 / 60);
    expect(fake.plays.length).toBe(1); // nothing was ever cut: the door's part ran whole
    expect(tour.stopTitle).toBe("I · The Magician");
  });
});
