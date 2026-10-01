// @vitest-environment jsdom
/* Item 15 — one companion for every tour: the guide orb itself. Flown along a route (a tour's
   own waypoints, so it never crosses a wall), it marks the stop by circling it and lingers
   while the telling plays; the free-roam guide's arrival whisper belongs to the free roam
   alone. */
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
const THREE = await import("three/webgpu");
const { Guide } = await import("./guide");

const dest = { label: "The shrine", x: 0, y: 0, z: -20 };

describe("the companion (item 15)", () => {
  it("flies the route in order before the destination", () => {
    const g = new Guide();
    const arrived: string[] = [];
    g.onArrive = (d) => arrived.push(d.label);
    const a = new THREE.Vector3(4, 0, -4), b = new THREE.Vector3(2, 0, -12);
    g.lead(dest, new THREE.Vector3(0, 0, 0), { via: [a.clone(), b.clone()], linger: true });
    expect(g.busy).toBe(true);
    const player = new THREE.Vector3(0, 0, 0);
    // standing at waypoint a: the first leg is flown
    player.set(a.x, a.y, a.z);
    g.update(1, 1 / 60, player);
    // standing at b: the second too
    player.set(b.x, b.y, b.z);
    g.update(2, 1 / 60, player);
    // standing at the destination: it marks it, and stays (it lingers)
    player.set(dest.x, dest.y, dest.z);
    for (let k = 0; k < 600; k++) g.update(3 + k / 60, 1 / 60, player);
    expect(g.busy).toBe(true); // still there, still circling
    expect(arrived).toEqual([]); // and quiet: the arrival whisper is the free roam's
  });

  it("without linger it marks the place once and goes, with its own arrival word", () => {
    const g = new Guide();
    const arrived: string[] = [];
    g.onArrive = (d) => arrived.push(d.label);
    g.lead(dest, new THREE.Vector3(0, 0, 0));
    const player = new THREE.Vector3(dest.x, dest.y, dest.z);
    g.update(1, 1 / 60, player);
    expect(arrived).toEqual(["The shrine"]);
    for (let k = 0; k < 500; k++) g.update(1 + k / 60, 1 / 60, player);
    expect(g.busy).toBe(false); // circled once, and gone
  });

  it("a far call simply puts it beside you (a tour's fade did the moving)", () => {
    const g = new Guide();
    g.lead(dest, new THREE.Vector3(0, 0, 0));
    g.update(1, 1 / 60, new THREE.Vector3(0, 0, 0));
    const near = new THREE.Vector3(1000, 0, 1000);
    const V3 = THREE.Vector3 as unknown as new (...a: number[]) => InstanceType<typeof THREE.Vector3>;
    const before = (g as unknown as { p: InstanceType<typeof V3> }).p.clone();
    g.lead({ label: "There", x: 1010, y: 0, z: 1010 }, near, { linger: true });
    const after = (g as unknown as { p: InstanceType<typeof V3> }).p;
    expect(after.distanceTo(near)).toBeLessThan(3); // repositioned, not flown across the world
    expect(before.distanceTo(after)).toBeGreaterThan(10);
  });

  it("stop dismisses it wherever it was", () => {
    const g = new Guide();
    g.lead(dest, new THREE.Vector3(0, 0, 0), { linger: true });
    expect(g.busy).toBe(true);
    g.stop();
    expect(g.busy).toBe(false);
  });
});
