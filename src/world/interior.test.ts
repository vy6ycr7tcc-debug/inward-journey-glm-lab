/* The interior pass — the dressed masonry within, tested pure (no pyramid boot, no renderer):
   everything the dressing stands stands proud of its wall, inside the room, breaking at the
   openings; the braziers stand clear; the shafts fall inside their rooms and land. */
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
import { ROOMS, SHAFTS, Shell, brazierSpots, dressRoom, floorOf, pierSpots, type Room } from "./pyramid";

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

const trimOf = (r: Room): Vertex[] => {
  const trim = new Shell();
  dressRoom(r, trim);
  return vertices(trim.geometry());
};
const near = (v: number, u: number, eps = 1e-5) => Math.abs(v - u) < eps;
const roomOf = (name: string): Room => ROOMS.find((r) => r.name === name)!;

describe("the dressing stands within its room", () => {
  for (const r of ROOMS) {
    it(`${r.name}: proud of the walls, never past them, never under the floor`, () => {
      const vs = trimOf(r);
      expect(vs.length).toBeGreaterThan(0);
      for (const v of vs) {
        expect(v.x).toBeGreaterThanOrEqual(r.x0 - 1e-5);
        expect(v.x).toBeLessThanOrEqual(r.x1 + 1e-5);
        expect(v.z).toBeGreaterThanOrEqual(r.z0 - 1e-5);
        expect(v.z).toBeLessThanOrEqual(r.z1 + 1e-5);
        expect(v.y).toBeGreaterThanOrEqual(floorOf(r, v.x) - 1e-5);
        expect(v.y).toBeLessThanOrEqual(floorOf(r, v.x) + r.h + (r.gable ?? 0) + 1e-5);
      }
    });
  }

  it("breaks at the openings: nothing proud where a doorway cuts below its height", () => {
    const entry = roomOf("entry");
    const vs = trimOf(entry);
    // the north wall's mouth spans x −1.2..1.2 below y 3: no plinth, dado or fillet vertex there
    const inMouth = vs.filter((v) => near(v.z, entry.z0, 0.11) && v.x > -1.2 + 1e-6 && v.x < 1.2 - 1e-6 && v.y < 2.5);
    expect(inMouth).toEqual([]);
  });
});

describe("the dressing breaks the flat walls", () => {
  it("plinth, dado and cornice on the entry hall's north wall", () => {
    const e = roomOf("entry");
    const vs = trimOf(e);
    const onNorth = vs.filter((v) => near(v.z, e.z0, 0.2) && (near(v.x, e.x0 + 0.4) || near(v.x, e.x1 - 0.4)));
    const plinths = onNorth.filter((v) => near(v.y, 0, 1e-6) && near(v.z, e.z0 + 0.09));
    const dados = onNorth.filter((v) => near(v.y, 0.9, 1e-6) && near(v.z, e.z0 + 0.06));
    const cornice = onNorth.filter((v) => near(v.y, e.h - 0.21, 1e-6) && near(v.z, e.z0 + 0.18));
    expect(plinths.length).toBeGreaterThan(0);
    expect(dados.length).toBeGreaterThan(0);
    expect(cornice.length).toBeGreaterThan(0);
  });

  it("piers stand in the resonating chamber and the King's, none in the narrow halls", () => {
    expect(pierSpots(roomOf("pit"), "n").length).toBeGreaterThanOrEqual(2);
    expect(pierSpots(roomOf("king"), "n").length).toBeGreaterThanOrEqual(2);
    expect(pierSpots(roomOf("entry"), "n")).toEqual([]);
    expect(pierSpots(roomOf("queen"), "n")).toEqual([]); // the gable room keeps its own face
    // and the piers land: proud faces at the shaft's depth, its band above the room's floor
    const k = roomOf("king");
    const vs = trimOf(k);
    for (const c of pierSpots(k, "n")) {
      const shaft = vs.filter((v) => near(v.z, k.z0 + 0.1) && near(v.x, c, 0.44) && v.y - floorOf(k, v.x) > 1.95 && v.y - floorOf(k, v.x) < 5.2);
      expect(shaft.length).toBeGreaterThan(0);
    }
    const pit = roomOf("pit");
    const pvs = trimOf(pit);
    for (const c of pierSpots(pit, "n")) {
      const shaft = pvs.filter((v) => near(v.z, pit.z0 + 0.1) && near(v.x, c, 0.44) && v.y - floorOf(pit, v.x) > 1.95 && v.y - floorOf(pit, v.x) < 5.2);
      expect(shaft.length).toBeGreaterThan(0);
    }
  });

  it("the gallery keeps its benches, clear of the doorways at both ends", () => {
    const g = roomOf("gallery");
    const vs = trimOf(g);
    const benchTop = vs.filter((v) => near(v.z, g.z0 + 0.7) && near(v.y, floorOf(g, v.x) + 0.55, 1e-6));
    expect(benchTop.length).toBeGreaterThan(0);
    // the benches start inside the west door and stop short of the ante's
    expect(Math.min(...benchTop.map((v) => v.x))).toBeGreaterThanOrEqual(3.5);
    expect(Math.max(...benchTop.map((v) => v.x))).toBeLessThanOrEqual(32.5);
  });

  it("the false door stands on the Queen's east wall", () => {
    const q = roomOf("queen");
    const vs = trimOf(q);
    const jambs = vs.filter((v) => near(v.x, q.x1 - 0.1) && v.y > -1e-6 && v.y < 2.4 + 1e-6 && v.z > 41.9 && v.z < 43.5);
    const lintel = vs.filter((v) => near(v.x, q.x1 - 0.14) && near(v.y, 2.55, 0.16));
    const panel = vs.filter((v) => near(v.x, q.x1 - 0.06) && v.z > 42.1 && v.z < 43.3);
    expect(jambs.length).toBeGreaterThan(0);
    expect(lintel.length).toBeGreaterThan(0);
    expect(panel.length).toBeGreaterThan(0);
  });
});

describe("the braziers and the shafts", () => {
  it("each brazier stands inside a room, clear of its walls and of the seated places", () => {
    for (const s of brazierSpots()) {
      const r = ROOMS.find((q) => s.x >= q.x0 - 0.5 && s.x <= q.x1 + 0.5 && s.z >= q.z0 - 0.5 && s.z <= q.z1 + 0.5);
      expect(r, `no room holds the brazier at ${s.x},${s.z}`).toBeDefined();
      const clear = 0.42;
      if (r!.corbel) {
        // the gallery's stand on its benches, against the wall by design
        const onBench = (s.z - r!.z0 >= 0.28 && s.z - r!.z0 <= 0.75) || (r!.z1 - s.z >= 0.28 && r!.z1 - s.z <= 0.75);
        expect(onBench, `the gallery brazier at ${s.x},${s.z} is not on a bench`).toBe(true);
        expect(s.x).toBeGreaterThanOrEqual(3.2);
        expect(s.x).toBeLessThanOrEqual(32.8);
      } else {
        expect(s.x).toBeGreaterThanOrEqual(r!.x0 + clear);
        expect(s.x).toBeLessThanOrEqual(r!.x1 - clear);
        expect(s.z).toBeGreaterThanOrEqual(r!.z0 + clear);
        expect(s.z).toBeLessThanOrEqual(r!.z1 - clear);
      }
      expect(Math.hypot(s.x + 28, s.z - 7.7)).toBeGreaterThan(2.2); // the resonating floor's open circle
      expect(Math.hypot(s.x - 39.6, s.z - 15.7)).toBeGreaterThan(1.9); // the coffer
      expect(Math.hypot(s.x, s.z - 42.7)).toBeGreaterThan(2.0); // the Queen's seat
      expect(s.y).toBeGreaterThanOrEqual(floorOf(r!, s.x) - 1e-6);
    }
  });

  it("each shaft falls inside its room and lands on the floor", () => {
    for (const s of SHAFTS) {
      const r = roomOf(s.room);
      for (const [p, w, d] of [[s.top, s.tw, s.td], [s.bot, s.bw, s.bd]] as const) {
        expect(p[0] - w / 2).toBeGreaterThanOrEqual(r.x0 + 0.15);
        expect(p[0] + w / 2).toBeLessThanOrEqual(r.x1 - 0.15);
        expect(p[2] - d / 2).toBeGreaterThanOrEqual(r.z0 + 0.15);
        expect(p[2] + d / 2).toBeLessThanOrEqual(r.z1 - 0.15);
      }
      expect(s.bot[1]).toBeGreaterThanOrEqual(floorOf(r, s.bot[0]));
      expect(s.top[1]).toBeLessThanOrEqual(r.h + (r.gable ?? 0) + 1e-6);
      expect(s.a).toBeGreaterThan(0);
      expect(s.a).toBeLessThan(0.2); // light, not glass
    }
  });
});
