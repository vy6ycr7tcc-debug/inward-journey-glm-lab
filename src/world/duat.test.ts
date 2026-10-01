/* Item 8 — the Duat's animated moments and its tour's stops, tested pure: the moments are
   exact functions of their clock (so stills and replays are exact), the journey keeps its
   beats, and the tour stands where the way stands. */
import { describe, expect, it, vi } from "vitest";
/* quality.ts runs matchMedia at module scope (duat.ts reaches it through the world's import
   graph); jsdom has none, so stub it before the first import is evaluated. And beings.ts
   paints its halo sprite texture at module scope, which jsdom's canvas cannot do without the
   (unavailable) canvas package: a minimal 2d context stands in. */
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
import {
  APOPHIS_PERIOD,
  DUAT_PATH,
  WEIGHING_PERIOD,
  apophisInto,
  boatSchedule,
  boatShape,
  boatUAt,
  duatHeight,
  duatTourStops,
  weighingInto,
} from "./duat";
import { nearWay } from "./duat";

const N = 600;

describe("Apophis, coiled about the sun", () => {
  const A = new Float32Array(N * 3), B = new Float32Array(N * 3), C = new Float32Array(N * 3);

  it("is a pure function of its clock (stills and replays are exact)", () => {
    apophisInto(13.5, N, A, C);
    apophisInto(13.5, N, B, C);
    expect(Array.from(A)).toEqual(Array.from(B));
  });

  it("wraps its period and stays in the stage's bounds", () => {
    // the Moment wraps the clock before the telling sees it — mirror that here
    const P = new Float32Array(N * 3);
    apophisInto((APOPHIS_PERIOD + 3) % APOPHIS_PERIOD, N, P, C);
    const Q = new Float32Array(N * 3);
    apophisInto(3, N, Q, C);
    expect(Array.from(P)).toEqual(Array.from(Q));
    for (let i = 0; i < N; i++) {
      expect(Math.abs(P[i * 3])).toBeLessThan(8);
      expect(P[i * 3 + 1]).toBeGreaterThan(-0.1);
      expect(P[i * 3 + 1]).toBeLessThan(10.5);
      expect(Math.abs(P[i * 3 + 2])).toBeLessThan(8);
    }
  });

  it("cuts: the two halves drift apart, and the sun flares free", () => {
    const P0 = new Float32Array(N * 3), P1 = new Float32Array(N * 3);
    apophisInto(12, N, P0, C); // before the cut
    apophisInto(24, N, P1, C); // after it
    const spread0 = Math.max(...Array.from(P0).filter((_, i) => i % 3 === 0));
    const spread1 = Math.max(...Array.from(P1).filter((_, i) => i % 3 === 0));
    expect(spread1).toBeGreaterThan(spread0 + 1.2);
  });
});

describe("the heart weighed against the feather", () => {
  const C = new Float32Array(N * 3);

  it("is a pure function of its clock and wraps its period", () => {
    const A = new Float32Array(N * 3), B = new Float32Array(N * 3);
    weighingInto(9.25, N, A, C);
    weighingInto(9.25, N, B, C);
    expect(Array.from(A)).toEqual(Array.from(B));
    const P = new Float32Array(N * 3);
    weighingInto((WEIGHING_PERIOD + 5) % WEIGHING_PERIOD, N, P, C);
    const Q = new Float32Array(N * 3);
    weighingInto(5, N, Q, C);
    expect(Array.from(P)).toEqual(Array.from(Q));
  });

  it("is a moment: the heart comes down, the beam tips under it, and settles level again", () => {
    const P0 = new Float32Array(N * 3), P1 = new Float32Array(N * 3), P2 = new Float32Array(N * 3), P3 = new Float32Array(N * 3);
    weighingInto(1, N, P0, C);
    weighingInto(6.5, N, P1, C);
    weighingInto(14, N, P2, C);
    weighingInto(WEIGHING_PERIOD - 3, N, P3, C);
    // the heart (points from the 52nd to the 72nd percentile) descends onto the west pan
    const i0 = Math.floor(N * 0.52);
    const heartY = (P: Float32Array) => P[i0 * 3 + 1];
    expect(heartY(P1)).toBeLessThan(heartY(P0));
    expect(heartY(P1)).toBeLessThan(4.2); // landed
    // tipped low under the heart's weight, then level again when the beam settles
    expect(heartY(P3)).toBeGreaterThan(heartY(P2) + 0.15);
  });
});

describe("the solar boat's journey", () => {
  const gates = [0.12, 0.3, 0.46, 0.6, 0.78, 0.9];
  const bc = boatSchedule(gates);
  const C = new Float32Array(N * 3);

  it("keeps its beats: sails between waypoints, dwells at each gate, and wraps", () => {
    expect(bc.period).toBeGreaterThan(100);
    // flat through a gate's dwell (the dwell runs [mark − dwell, mark])
    const u0 = boatUAt(bc.marks[0] - bc.dwell + 1, bc), u1 = boatUAt(bc.marks[0] - 1, bc);
    expect(u1).toBeCloseTo(u0, 6);
    // sailing between gates: strictly ahead of where it was
    const s0 = boatUAt(bc.marks[0] + 1, bc), s1 = boatUAt(bc.marks[0] + bc.sail - 1, bc);
    expect(s1).toBeGreaterThan(s0);
    // the whole way, in order, never backwards
    let last = -1;
    for (const g of gates) {
      const u = boatUAt(bc.marks[gates.indexOf(g)], bc);
      expect(u).toBeGreaterThanOrEqual(last);
      last = u;
    }
    // and it wraps exactly (the caller wraps the clock, as updateBoat does)
    expect(boatUAt((bc.period + 2) % bc.period, bc)).toBeCloseTo(boatUAt(2, bc), 6);
    for (let t = 0; t < bc.period; t += 0.5) {
      const u = boatUAt(t, bc);
      expect(u).toBeGreaterThanOrEqual(-1e-9);
      expect(u).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it("the boat itself is pure, hull below, sun above, rising at the dawn", () => {
    const A = new Float32Array(N * 3), B = new Float32Array(N * 3);
    boatShape(4, N, A, C, 0);
    boatShape(4, N, B, C, 0);
    expect(Array.from(A)).toEqual(Array.from(B));
    const D = new Float32Array(N * 3);
    boatShape(4, N, D, C, 0.9);
    // the sun (the last fifth) has risen with the dawn
    const iSun = Math.floor(N * 0.9);
    expect(D[iSun * 3 + 1]).toBeGreaterThan(A[iSun * 3 + 1] + 2);
    // and the hull has dimmed
    const iHull = Math.floor(N * 0.1);
    expect(C[iHull * 3]).toBeLessThan(1);
  });
});

describe("the tour's stops", () => {
  const stops = duatTourStops();

  it("are eight: the door, the six hours, the dawn", () => {
    expect(stops.length).toBe(8);
    expect(stops[0].title).toBe("The Duat");
    expect(stops[7].title).toBe("The dawn");
    for (let k = 1; k <= 6; k++) expect(stops[k].title.length).toBeGreaterThan(3);
  });

  it("stand on the way, in walking order, facing on", () => {
    let lastLeg = -1;
    for (const s of stops) {
      const w = nearWay(s.x, s.z);
      expect(w.d).toBeLessThan(6); // on the way, not on the dunes
      expect(Math.abs(s.y - duatHeight(s.x, s.z))).toBeLessThan(1e-6);
      expect(Number.isFinite(s.heading)).toBe(true);
      expect(s.hold).toBeGreaterThan(3);
      const leg = w.y; // the way's own height there — the stops climb with the stair
      expect(leg).toBeGreaterThanOrEqual(lastLeg - 1e-6);
      lastLeg = leg;
    }
  });

  it("end at the stair's head, where the dawn light stands", () => {
    const last = DUAT_PATH[DUAT_PATH.length - 1];
    expect(stops[7].x).toBeCloseTo(last.x, 6);
    expect(stops[7].z).toBeCloseTo(last.z, 6);
  });
});
