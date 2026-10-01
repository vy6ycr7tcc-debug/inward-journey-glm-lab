/* Item 11 — the great gliders of light, fewer and more special, and the performance cost
   confirmed to drop with the count. The spirit update is real per-frame CPU work (the veil's
   smoothed ribbon, per spirit), so the frame cost is measured here directly, 14 spirits (the
   old count) against 5 (the new one), the same simulated seconds for each. */
import { describe, expect, it, vi } from "vitest";
vi.hoisted(() => {
  const g = globalThis as Record<string, unknown>;
  if (typeof g.matchMedia !== "function") {
    g.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }
  const HTMLCanvasElement = g.HTMLCanvasElement as
    | { prototype: { getContext: (t: string) => unknown } }
    | undefined;
  if (HTMLCanvasElement) {
    const gradient = { addColorStop: () => {} };
    const ctx2d = new Proxy({ canvas: null as unknown }, {
      get: (t, prop) => {
        if (prop === "canvas") return t.canvas;
        if (prop === "createRadialGradient" || prop === "createLinearGradient") return () => gradient;
        if (prop === "createPattern") return () => null;
        if (prop === "measureText") return () => ({ width: 0 });
        if (prop === "getImageData") return () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 });
        return () => undefined;
      },
      set: () => true,
    });
    HTMLCanvasElement.prototype.getContext = function getContext(type: string) {
      if (type === "2d") {
        ctx2d.canvas = this;
        return ctx2d;
      }
      return null;
    };
  }
});
import * as THREE from "three/webgpu";
import { Spirits, type Creation } from "./creation";
import type { LifeFrame } from "./life";

/** The one thing Spirits reads off its creation: the anchors it drifts about. */
const creationStub = { anchors: () => [] as THREE.Vector3[] } as unknown as Creation;

function frameCost(count: number): { ms: number; noticed: number } {
  const spirits = new Spirits(creationStub as never, count);
  let noticed = 0;
  spirits.onNotice = () => noticed++;
  const f: LifeFrame = { t: 0, dt: 1 / 60, player: new THREE.Vector3(0, 2, 0), speed: 0, reduced: false, dpr: 1 };
  const cam = new THREE.Camera();
  // settle: place the spirits about the player first
  for (let k = 0; k < 120; k++) {
    f.t += f.dt;
    spirits.update(f, cam);
  }
  // measure
  const t0 = performance.now();
  const frames = 900;
  for (let k = 0; k < frames; k++) {
    f.t += f.dt;
    spirits.update(f, cam);
  }
  const ms = (performance.now() - t0) / frames;
  return { ms, noticed };
}

describe("the gliders, few and special", () => {
  it("are five now, three on phones, one of them great", () => {
    const five = new Spirits(creationStub, 5);
    const three = new Spirits(creationStub, 3);
    expect((five as unknown as { list: { size: number }[] }).list.length).toBe(5);
    expect((three as unknown as { list: { size: number }[] }).list.length).toBe(3);
    // the great one is greater than any other
    const sizes = (five as unknown as { list: { size: number }[] }).list.map((s) => s.size);
    expect(Math.max(...sizes.slice(1))).toBeLessThan(sizes[0]);
  });

  it("a pass near the wanderer is a moment: noticed once, easing away", () => {
    const spirits = new Spirits(creationStub, 2);
    let calls = 0;
    spirits.onNotice = () => calls++;
    const list = (spirits as unknown as { list: { notice: number; p: THREE.Vector3; home: THREE.Vector3; curious: number }[] }).list;
    const f: LifeFrame = { t: 0, dt: 1 / 60, player: new THREE.Vector3(0, 2, 0), speed: 0, reduced: false, dpr: 1 };
    // a spirit held right by the wanderer: noticed on the first frame, and once only
    list.forEach((s) => {
      s.p.set(2, 3, 0);
      s.home.set(2, 1, 0);
      s.curious = 0;
    });
    for (let k = 0; k < 30; k++) {
      f.t += f.dt;
      spirits.update(f, new THREE.Camera());
    }
    expect(calls).toBeGreaterThan(0);
    expect(calls).toBeLessThanOrEqual(list.length);
    expect(list.some((s) => s.notice > 0)).toBe(true);
    // and it eases: after ten quiet seconds out of reach but not so far as to be re-anchored,
    // the notice has washed out
    list.forEach((s) => s.p.set(50, 3, 50));
    for (let k = 0; k < 600; k++) {
      f.t += f.dt;
      spirits.update(f, new THREE.Camera());
    }
    expect(list.every((s) => s.notice === 0)).toBe(true);
  });

  it("the frame cost falls with the count (measured, old 14 against new 5)", () => {
    // warm both paths first, then measure; report the numbers for the record
    frameCost(14);
    frameCost(5);
    const old14 = frameCost(14);
    const new5 = frameCost(5);
    console.log(`spirit frame cost: 14 = ${old14.ms.toFixed(4)} ms, 5 = ${new5.ms.toFixed(4)} ms (${((1 - new5.ms / old14.ms) * 100).toFixed(0)}% less)`);
    expect(new5.ms).toBeLessThan(old14.ms * 0.8); // well under the old cost, not just noise
  });
});
