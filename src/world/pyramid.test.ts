/* Item 6 — the entrance's geometry, tested pure (no pyramid boot, no renderer):
   the casing's north face is truly open where the mouth is, and every piece of the
   entrance lands exactly on the mouth's measures. */
import { describe, expect, it, vi } from "vitest";
/* quality.ts runs matchMedia at module scope (pyramid.ts reaches it through the world's
   import graph); jsdom has none, so stub it before the first import is evaluated. And
   beings.ts paints its halo sprite texture at module scope, which jsdom's canvas cannot
   do without the (unavailable) canvas package: a minimal 2d context stands in. */
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
    // any 2d call is a no-op; the few creators return minimal objects; sets are ignored
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
import {
  ENTRANCE_DEPTH,
  ENTRANCE_MOUTH,
  ENTRANCE_PROUD,
  GABLE_PROUD,
  entranceGeometry,
  northFaceGeometry,
} from "./pyramid";

const HALF = 55, HT = 70, YTOP = HT * 0.9; // the casing's north face spans the same run as buildOutside cuts it
const zf = (y: number) => -HALF + (HALF / HT) * y;

interface Vertex {
  x: number;
  y: number;
  z: number;
}

function vertices(g: THREE.BufferGeometry): Vertex[] {
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  const out: Vertex[] = [];
  for (let i = 0; i < p.count; i++) out.push({ x: p.getX(i), y: p.getY(i), z: p.getZ(i) });
  return out;
}

describe("the pyramid's north face with the mouth cut out", () => {
  const g = northFaceGeometry(HALF, HT, YTOP);

  it("opens the casing exactly over the mouth (no vertex inside the cut)", () => {
    const inside = vertices(g).filter(
      (v) => v.x > ENTRANCE_MOUTH.x0 + 1e-6 && v.x < ENTRANCE_MOUTH.x1 - 1e-6 && v.y > ENTRANCE_MOUTH.y0 + 1e-6 && v.y < ENTRANCE_MOUTH.y1 - 1e-6,
    );
    expect(inside).toEqual([]);
  });

  it("keeps the face a true plane, flanked to the foot and crowned (open only over the mouth)", () => {
    const vs = vertices(g);
    expect(vs.length).toBeGreaterThan(0);
    for (const v of vs) {
      expect(v.z).toBeCloseTo(zf(v.y), 6); // the face's own slant
      expect(v.y).toBeGreaterThanOrEqual(-1e-6); // nothing below the casing's foot
      expect(v.y).toBeLessThanOrEqual(YTOP + 1e-6);
    }
    // the flanks run to the ground and reach the face's outer edges; the crown runs full width
    expect(vs.some((v) => Math.abs(v.y) < 1e-6)).toBe(true);
    expect(vs.some((v) => Math.abs(Math.abs(v.x) - HALF) < 1e-6)).toBe(true);
    expect(vs.some((v) => Math.abs(v.y - YTOP) < 1e-6)).toBe(true);
  });
});

describe("the entrance's own pieces", () => {
  const eg = entranceGeometry(HALF, HT);
  const P = ENTRANCE_PROUD, D = ENTRANCE_DEPTH;
  const CAPZ = zf(0) + D;

  it("stands a granite rim proud of the face, as wide as it is proud", () => {
    const vs = vertices(eg.granite);
    expect(vs.some((v) => Math.abs(Math.abs(v.x) - (ENTRANCE_MOUTH.x1 + P)) < 1e-6)).toBe(true);
    expect(vs.some((v) => Math.abs(v.z - (zf(0) - P)) < 1e-6)).toBe(true); // the front plane, proud
  });

  it("recedes into the stone to one dark end, deeper at the foot than at the crown", () => {
    const vs = vertices(eg.limestone);
    expect(vs.some((v) => Math.abs(v.z - CAPZ) < 1e-6)).toBe(true); // the reveals reach the end
    // the reveal's crown meets the face where the mouth's top edge is, on the slant
    expect(vs.some((v) => Math.abs(v.y - ENTRANCE_MOUTH.y1) < 1e-6 && Math.abs(v.z - zf(ENTRANCE_MOUTH.y1)) < 1e-6)).toBe(true);
  });

  it("ends the passage in a flat dark cap standing past the slanted face", () => {
    const vs = vertices(eg.glow);
    expect(vs.length).toBeGreaterThan(0);
    for (const v of vs) {
      expect(v.z).toBeCloseTo(CAPZ, 6);
      expect(v.y).toBeGreaterThanOrEqual(ENTRANCE_MOUTH.y0 - 1e-6);
      expect(v.y).toBeLessThanOrEqual(ENTRANCE_MOUTH.y1 + 1e-6);
      expect(Math.abs(v.x)).toBeLessThanOrEqual(ENTRANCE_MOUTH.x1 + 1e-6);
    }
  });

  it("lays the open door's light flat on the sand, tucked under the rim's front", () => {
    const vs = vertices(eg.spill);
    expect(vs.length).toBeGreaterThan(0);
    for (const v of vs) {
      expect(v.y).toBeCloseTo(0.07, 6);
      // it runs from 6.6 m before the rim to 0.4 behind its front plane (hidden in the stone),
      // and never reaches the casing's own plane: the door's light stops at the face
      expect(v.z).toBeGreaterThanOrEqual(zf(0) - P - 6.6 - 1e-4);
      expect(v.z).toBeLessThanOrEqual(zf(0) + 1e-4);
    }
    expect(vs.some((v) => Math.abs(v.z - (zf(0) - P - 6.6)) < 1e-4)).toBe(true); // its far reach
    expect(vs.some((v) => Math.abs(v.z - (zf(0) - P + 0.4)) < 1e-4)).toBe(true); // its tuck under the rim
  });

  it("caps the gable a hand's height over the lintel, feet wider than the rim, proud of the face", () => {
    const vs = vertices(eg.gable);
    expect(vs.length).toBeGreaterThan(0);
    const apex = vs.filter((v) => v.y > ENTRANCE_MOUTH.y1 + P + 0.1);
    expect(apex.length).toBeGreaterThan(0);
    for (const v of apex) expect(Math.abs(v.x)).toBeLessThanOrEqual(ENTRANCE_MOUTH.x1 + 1.3 + 1e-6);
    // its front face stands prouder than the rim, on its own parallel plane
    expect(vs.some((v) => Math.abs(v.z - (zf(ENTRANCE_MOUTH.y1 + P) - GABLE_PROUD)) < 1e-4)).toBe(true);
  });
});
