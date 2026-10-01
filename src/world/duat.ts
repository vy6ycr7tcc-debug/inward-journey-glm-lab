/* The Duat: the night the sun travels through under the world, entered by the hidden door in the
   pyramid's pit (pyramid.ts). The owner: "you can put the deities, they explain a story". Built as
   the rest of the game is built: a gorge of real stone (the scanned sandstone, weathered; world/
   stoneworks.ts) under the night of Nut, starry, with a dark river of slow gold running beside the
   way, stone lamps along it; six gates of stone, each with its emblem carved in thin gold light
   on its lintel (a winged sun) and posts, and beyond each gate the story of that hour told as a
   vision of light (scenes/visionStage.ts, the vision-of-creation format): the waters of Nun and
   the first mound; the land of Sokar and its serpent; Ra and Osiris meeting in the deepest hour;
   Apophis coiled about the sun, and cut; the heart weighed against the feather of Ma'at in the
   Hall of the Two Truths; the Field of Reeds, and Khepri rolling the sun up into the dawn. A stair
   of stone climbs from the last gate to the dawn, and out onto the apex (main.ts).
   Coordinates are Duat-local (floor y = 0); `heightAt` answers the ground (dunes away from the
   way, the stair). Only the names of places are spoken: no invented narration — and none exists
   as recordings yet (docs/duat-audio-inventory.md); the tellings hold in silence until some can
   be laid under them.
   Item 8: the key moments are animated, beat-timed and multi-phase — the solar boat's journey
   rides the river the whole way (it lingers at each gate, its sun brightening, and rises into
   the dawn); Apophis coils about the sun, rears, and is cut, on the hour's own clock; the heart
   is weighed against the feather of Ma'at, the beam tipping, settling, and the gold rising. All
   of them are pure functions of their clock, so stills and replays are exact. */
import * as THREE from "three/webgpu";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { MOBILE } from "../core/quality";
import { ribbonGeometry, ribbonMaterial } from "../gpu/ribbons";
import { gpuUniforms, softPoints, spriteCloud, T, viewDepth, type SpriteCloud } from "../gpu/tsl";
import { GOLD, PALE, PEARL, EMBER, VisionStage, type Key, type Maker } from "../scenes/visionStage";
import { combine, cord, FORM_H, rng, rock, shift, sphere, sun, turnY, type Rand } from "./forms";
import { landStone } from "./stoneworks";
import { surface } from "./textures";

const { exp, float, fract, mix, sin, smoothstep, uv, vec2, vec3, vec4 } = T;
const V = THREE.Vector3;

/** The way through the night (Duat-local): the hidden door, the six hours, the dawn. */
export const DUAT_PATH: THREE.Vector3[] = [
  new V(0, 0, 0),
  new V(18, 0, -14),
  new V(34, 0, -6),
  new V(30, 0, 16),
  new V(8, 0, 26),
  new V(-14, 0, 18),
  new V(-22, 2, -4),
  new V(-8, 5, -20),
];
const RIM = 50; // the gorge's walls stand beyond this

/* ---------------------------------------------------------------- the ground */
/** Distance (x, z) from the way, and the way's height there. */
export function nearWay(x: number, z: number): { d: number; y: number } {
  let best = Infinity, y = 0;
  for (let i = 0; i < DUAT_PATH.length - 1; i++) {
    const a = DUAT_PATH[i], b = DUAT_PATH[i + 1];
    const abx = b.x - a.x, abz = b.z - a.z, L2 = abx * abx + abz * abz;
    const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / L2));
    const d = Math.hypot(x - (a.x + abx * t), z - (a.z + abz * t));
    if (d < best) (best = d), (y = a.y + (b.y - a.y) * t);
  }
  return { d: best, y };
}
function hash(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise(x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** The ground of the Duat (Duat-local): the way flat (and its stair rising to the dawn), dunes
    swelling away from it toward the gorge's walls. */
export function duatHeight(x: number, z: number): number {
  const w = nearWay(x, z);
  const dune = (noise(x * 0.09, z * 0.09) * 0.7 + noise(x * 0.23 + 4, z * 0.23) * 0.3) * 2.4;
  const away = THREE.MathUtils.smoothstep(w.d, 5, 16);
  const rim = THREE.MathUtils.smoothstep(Math.hypot(x, z), 34, RIM) * 5;
  const ground = away * dune + rim;
  // on the way itself its own height (the stair to the dawn), easing into the sand beside it
  const onWay = 1 - THREE.MathUtils.smoothstep(w.d, 2.2, 4);
  return THREE.MathUtils.lerp(ground, w.y, onWay);
}

/* ---------------------------------------------------------------- the forms of the hours */
/** A serpent: a long body winding on the ground, rising at the head. */
function serpent(n: number, R: Rand, len = 7, rear = 0, coil = 0): Float32Array {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 60; i++) {
    const u = i / 60;
    if (coil > 0) {
      // coiled about the middle, the head raised above the coils
      const a = u * Math.PI * 2 * (2.2 + coil), r = 2.2 - u * 1.3;
      const y = 0.3 + u * 0.8 + Math.max(0, u - 0.85) * 18 * (0.4 + rear);
      pts.push(new V(Math.cos(a) * r, y, Math.sin(a) * r));
    } else {
      const x = -len / 2 + u * len;
      pts.push(new V(x, 0.25 + Math.max(0, u - 0.8) * 10 * rear, Math.sin(u * Math.PI * 3.2) * 0.9));
    }
  }
  return cord(pts, n, R, 0.18);
}
/** A barque: a crescent hull with a cabin, riding level. */
function barque(n: number, R: Rand, y = 1.2): Float32Array {
  const hull: THREE.Vector3[] = [];
  for (let i = 0; i <= 30; i++) {
    const u = i / 30, x = -2.4 + u * 4.8;
    hull.push(new V(x, y + Math.pow(Math.abs(x) / 2.4, 3) * 1.1, 0));
  }
  return combine(n, [
    [(m) => cord(hull, m, R, 0.16), 0.7],
    [(m) => shift(sphere(m, R, 0.45, 0, 0.9), 0, y + 0.8, 0), 0.3],
  ]);
}
/** The scarab: an oval body, its head, six legs, holding up a sun. */
function scarab(n: number, R: Rand, lift = 0): Float32Array {
  const body = (m: number) => {
    const out = new Float32Array(m * 3);
    for (let i = 0; i < m; i++) {
      const d = new V(R() - 0.5, R() - 0.5, R() - 0.5).normalize();
      out.set([d.x * 0.9, 1.0 + d.y * 0.55, d.z * 1.2], i * 3);
    }
    return out;
  };
  const legs = (m: number) => {
    const parts: Float32Array[] = [];
    for (let k = 0; k < 6; k++) {
      const s = k < 3 ? -1 : 1, z = -0.6 + (k % 3) * 0.6;
      parts.push(cord([new V(s * 0.7, 0.9, z), new V(s * 1.4, 0.8, z * 1.3), new V(s * 1.6, 0.05, z * 1.6)], Math.floor(m / 6), R, 0.04));
    }
    const out = new Float32Array(m * 3);
    let o = 0;
    for (const p of parts) out.set(p, o), (o += p.length);
    return out;
  };
  return combine(n, [
    [body, 0.45],
    [(m) => shift(sphere(m, R, 0.35, 0, 0.9), 0, 1.0, 1.35), 0.1],
    [legs, 0.2],
    [(m) => shift(sphere(m, R, 0.8, 0, 0.85), 0, 2.6 + lift, 1.4), 0.25],
  ]);
}
/** Reeds: a field of tall stems with plumed heads. */
function reeds(n: number, R: Rand): Float32Array {
  const out = new Float32Array(n * 3);
  const stems = Array.from({ length: 40 }, () => [(R() - 0.5) * 6, (R() - 0.5) * 3, 1.8 + R() * 1.6, (R() - 0.5) * 0.5] as const);
  for (let i = 0; i < n; i++) {
    const [x, z, h, lean] = stems[Math.floor(R() * stems.length)];
    const t = R() < 0.25 ? 0.85 + R() * 0.15 : R() * 0.85, wide = t > 0.85 ? 0.12 : 0.015;
    out.set([x + lean * t * t + (R() - 0.5) * wide, t * h, z + (R() - 0.5) * wide], i * 3);
  }
  return out;
}
/** Still water, rippling in rings. */
function waters(n: number, R: Rand): Float32Array {
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = 3.2 * Math.sqrt(R()), a = R() * Math.PI * 2;
    out.set([Math.cos(a) * r, 0.15 + Math.sin(r * 4) * 0.06, Math.sin(a) * r], i * 3);
  }
  return out;
}
/** The first mound rising out of the waters. */
function mound(n: number, R: Rand): Float32Array {
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = Math.sqrt(R()), a = R() * Math.PI * 2, r = (1 - t) * 2.4;
    out.set([Math.cos(a) * r, 0.1 + t * 3.0, Math.sin(a) * r], i * 3);
  }
  return out;
}

/** The six hours: where on the way, the place's name, and its story — either as forms and keys
    (one cycle, repeated while you are near) or, for the moments the owner named, as an animated
    telling: a pure function of the telling's own clock, beat-timed, multi-phase. */
export const APOPHIS_PERIOD = 27;
export const WEIGHING_PERIOD = 36;
interface Hour {
  at: number;
  name: string;
  emblem: "water" | "serpent" | "ankh" | "coils" | "feather" | "scarab";
  forms?: Record<string, Maker>;
  cycle?: Omit<Key, "t">[];
  /** The animated telling (item 8) and its period in seconds. */
  moment?: (t: number, n: number, P: Float32Array, C: Float32Array) => void;
  period?: number;
}
const HOURS: Hour[] = [
  {
    at: 1,
    name: "The waters of Nun",
    emblem: "water",
    forms: {
      waters: (n, R) => waters(n, R),
      mound: (n, R) => combine(n, [[(m) => waters(m, R), 0.4], [(m) => mound(m, R), 0.6]]),
      barque: (n, R) => combine(n, [[(m) => waters(m, R), 0.3], [(m) => barque(m, R, 1.4), 0.7]]),
      nun: (n, R, b) => b && combine(n, [[(m) => b.figure(m, R, "Spell_Simple_Idle_Loop", 1.5, [], FORM_H * 0.7), 0.6], [(m) => barque(m, R, FORM_H * 0.78), 0.4]]),
    },
    cycle: [
      { form: "waters", tint: PALE },
      { form: "mound", tint: PEARL },
      { form: "barque", tint: GOLD },
      { form: "nun", tint: PALE },
    ],
  },
  {
    at: 2,
    name: "The land of Sokar",
    emblem: "serpent",
    forms: {
      sand: (n, R) => combine(n, [[(m) => rock(m, R, 3, 0.4, 2), 1]]),
      serpent: (n, R) => serpent(n, R, 7, 0.3),
      bearing: (n, R) => combine(n, [[(m) => serpent(m, R, 7, 0), 0.6], [(m) => barque(m, R, 1.1), 0.4]]),
    },
    cycle: [
      { form: "sand", tint: EMBER },
      { form: "serpent", tint: EMBER },
      { form: "bearing", tint: GOLD },
    ],
  },
  {
    at: 3,
    name: "Ra and Osiris, in the deepest hour",
    emblem: "ankh",
    forms: {
      osiris: (n, R, b) => b && combine(n, [[(m) => b.figure(m, R, "Idle_Loop", 0.4, [], FORM_H * 0.8), 0.85], [(m) => shift(sphere(m, R, 0.22, 0, 0.3), 0, FORM_H * 0.86, 0), 0.15]]),
      ra: (n, R, b) => b && combine(n, [[(m) => b.figure(m, R, "Idle_Loop", 1.8, [], FORM_H * 0.8), 0.7], [(m) => sun(m, R, FORM_H * 0.98), 0.3]]),
      meeting: (n, R, b) => b && combine(n, [
        [(m) => shift(turnY(b.figure(m, R, "Idle_Loop", 0.4, [], FORM_H * 0.72), Math.PI / 2), -1.3, 0, 0), 0.38],
        [(m) => shift(turnY(b.figure(m, R, "Idle_Loop", 1.8, [], FORM_H * 0.72), -Math.PI / 2), 1.3, 0, 0), 0.38],
        [(m) => sun(m, R, FORM_H * 0.62), 0.24],
      ]),
      one: (n, R) => sun(n, R, FORM_H * 0.55),
    },
    cycle: [
      { form: "osiris", tint: PALE },
      { form: "ra", tint: GOLD },
      { form: "meeting", tint: PEARL },
      { form: "one", tint: GOLD, spin: 0.05, axis: "z" },
    ],
  },
  {
    at: 4,
    name: "Apophis",
    emblem: "coils",
    moment: apophisInto,
    period: APOPHIS_PERIOD,
  },
  {
    at: 5,
    name: "The Hall of the Two Truths",
    emblem: "feather",
    moment: weighingInto,
    period: WEIGHING_PERIOD,
  },
  {
    at: 6,
    name: "The Field of Reeds",
    emblem: "scarab",
    forms: {
      reeds: (n, R) => reeds(n, R),
      scarab: (n, R) => scarab(n, R, 0),
      rising: (n, R) => scarab(n, R, 1.4),
      dawn: (n, R) => sun(n, R, FORM_H * 0.7),
    },
    cycle: [
      { form: "reeds", tint: PALE },
      { form: "scarab", tint: GOLD },
      { form: "rising", tint: GOLD },
      { form: "dawn", tint: EMBER },
    ],
  },
];
const HOLD = 9; // seconds each moment of an hour holds

/* ------------------------------------------------- the animated moments (item 8) */
/** Deterministic per-point randomness (no state, so a still can recompute it exactly) and the
    ease every phase shares. */
const pj = (i: number, k = 0): number => {
  const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const ease = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** Apophis coiled about the sun, beat-timed: 0–9 the coils tighten about it; 9–18 it rears,
    the sun straining; 18–27 the cut — the two halves drift apart and the sun flares free.
    The coil is a true helix about the sun, its body a tube of light. */
export function apophisInto(t: number, n: number, P: Float32Array, C: Float32Array): void {
  const nS = Math.floor(n * 0.72);
  const tight = ease(t / 9);
  const rear = ease((t - 9) / 9);
  const cut = ease((t - 18) / 5);
  const sunK = 0.3 + 0.7 * ease((t - 17) / 4);
  for (let i = 0; i < n; i++) {
    const j = i * 3;
    if (i < nS) {
      const u = i / nS;
      const side = u < 0.43 ? -1 : 1;
      if (u < 0.86) {
        // the body: a helix of light wound about the sun, tightening as the hour turns
        const v = u / 0.86;
        const a = v * Math.PI * 2 * 3.2 + Math.sin(t * 0.4 + v * 5) * 0.1;
        const r = 1.75 * (1.4 - 0.4 * tight) * (1 - 0.08 * Math.sin(v * Math.PI * 2));
        const ta = pj(i, 30) * Math.PI * 2, tr = 0.2 * Math.sqrt(pj(i, 31));
        const lift = rear * (v > 0.7 ? Math.pow((v - 0.7) / 0.3, 2) * 6.5 : 0);
        P[j] = Math.cos(a) * r + Math.cos(ta) * tr + side * 3.0 * cut + Math.sin(t * 1.3 + v * 9) * 0.12;
        P[j + 1] = 0.45 + v * 2.5 + Math.sin(ta) * tr + lift + cut * (v - 0.5) * 0.8;
        P[j + 2] = Math.sin(a) * r + Math.sin(ta) * tr;
        const head = v > 0.8 ? 1.3 : 1;
        C[j] = 0.8 * head;
        C[j + 1] = 0.52 * head;
        C[j + 2] = 0.6 * head;
      } else {
        // the head: a knot of light at the coil's crown, swaying
        const v = (u - 0.86) / 0.14;
        const a = v * Math.PI * 2, rr = 0.3 * Math.sqrt(pj(i, 32));
        P[j] = 0.35 + Math.cos(a) * rr + side * 3.0 * cut;
        P[j + 1] = 2.95 + rear * 6.5 + Math.sin(a) * rr * 0.8 + Math.sin(t * 1.9) * 0.1;
        P[j + 2] = Math.sin(a) * rr;
        C[j] = 1.25;
        C[j + 1] = 0.85;
        C[j + 2] = 1.0;
      }
    } else {
      const k = pj(i, 3), a = k * Math.PI * 2 + t * 0.35, rr = 1.05 * Math.sqrt(pj(i, 4));
      const flare = 1 + 0.15 * Math.sin(t * 1.7) + 0.5 * (sunK - 0.3);
      P[j] = Math.cos(a) * rr * flare;
      P[j + 1] = 1.7 + (pj(i, 5) - 0.5) * rr * flare;
      P[j + 2] = Math.sin(a) * rr * flare;
      C[j] = 1.15;
      C[j + 1] = 0.62 + 0.2 * sunK;
      C[j + 2] = 0.38 + 0.15 * sunK;
    }
  }
}

/** The heart weighed against the feather of Ma'at, beat-timed: 0–7 the heart descends onto
    the west pan; 7–16 the beam tips under it; 16–23 the feather descends onto the east; 23–30
    the beam settles level and a band of gold rises through the balance; then rest. */
export function weighingInto(t: number, n: number, P: Float32Array, C: Float32Array): void {
  const nScale = Math.floor(n * 0.52), nHeart = Math.floor(n * 0.2), nFeather = Math.floor(n * 0.15);
  const a = t < 7 ? 0 : t < 16 ? 0.22 * ease((t - 7) / 9) : t < 23 ? 0.22 : t < 30 ? 0.22 * (1 - ease((t - 23) / 7)) : 0;
  const ca = Math.cos(a), sa = Math.sin(a);
  const heartK = ease(t / 7), featherK = ease((t - 16) / 7);
  const bandK = t < 23 ? 0 : t < 31 ? ease((t - 23) / 8) : 1 - ease((t - 31) / 5);
  const panAt = (s: number) => ({ x: s * ca, y: 3.1 + s * sa - 1.1 });
  const w = panAt(-1.3), e = panAt(1.3);
  for (let i = 0; i < n; i++) {
    const j = i * 3;
    if (i < nScale) {
      const u = i / nScale;
      if (u < 0.2) {
        P[j] = 0;
        P[j + 1] = (u / 0.2) * 3.3;
        P[j + 2] = 0;
      } else if (u < 0.55) {
        const s = -1.3 + ((u - 0.2) / 0.35) * 2.6;
        P[j] = s * ca;
        P[j + 1] = 3.1 + s * sa;
        P[j + 2] = 0;
      } else {
        const west = (u - 0.55) / 0.45 < 0.5, q = pj(i, 6), ang = q * Math.PI * 2, rr = 0.45 * Math.sqrt(pj(i, 7));
        const c = west ? w : e;
        if (q < 0.3) {
          P[j] = c.x;
          P[j + 1] = c.y + 1.1 - ((q / 0.3) * 1.1);
          P[j + 2] = 0;
        } else {
          P[j] = c.x + Math.cos(ang) * rr;
          P[j + 1] = c.y - (1 - (rr / 0.45) ** 2) * 0.12;
          P[j + 2] = Math.sin(ang) * rr;
        }
      }
      C[j] = 1.0;
      C[j + 1] = 0.94;
      C[j + 2] = 0.86;
    } else if (i < nScale + nHeart) {
      const k = i - nScale, fall = (1 - heartK) * 3.6;
      const dx = pj(k, 8) - 0.5, dy = pj(k, 9) - 0.5, dz = pj(k, 10) - 0.5;
      const m = Math.hypot(dx, dy, dz) || 1, r = 0.3 * (0.75 + 0.25 * pj(k, 11));
      P[j] = w.x + (dx / m) * r;
      P[j + 1] = w.y + 0.12 + (dy / m) * r + fall;
      P[j + 2] = (dz / m) * r;
      C[j] = 1.0;
      C[j + 1] = 0.7;
      C[j + 2] = 0.8;
    } else if (i < nScale + nHeart + nFeather) {
      const k = i - nScale - nHeart, u = pj(k, 12);
      const bend = Math.sin(u * Math.PI * 0.8) * 0.3;
      const wd = Math.sin(Math.min(1, u * 1.15) * Math.PI) * 0.36;
      const side = pj(k, 13) < 0.5 ? -1 : 1, across = pj(k, 14) < 0.25 ? 0 : side * pj(k, 15) * wd;
      const fall = (1 - featherK) * 3.6;
      P[j] = e.x + bend + across * 0.2;
      P[j + 1] = e.y + 0.15 + u * 1.2 + fall;
      P[j + 2] = across;
      C[j] = 0.72;
      C[j + 1] = 0.82;
      C[j + 2] = 1.0;
    } else {
      // the band of gold that rises through the balance when it settles
      const k = i - nScale - nHeart - nFeather, ang = pj(k, 16) * Math.PI * 2, rr = 0.5 + pj(k, 17) * 1.0;
      P[j] = Math.cos(ang) * rr;
      P[j + 1] = 0.15 + bandK * (3.2 + pj(k, 18) * 1.4);
      P[j + 2] = Math.sin(ang) * rr;
      const g = bandK * (0.55 + 0.45 * pj(k, 19));
      C[j] = 1.0 * g;
      C[j + 1] = 0.78 * g;
      C[j + 2] = 0.48 * g;
    }
  }
}

/** An animated telling: one body of points whose places are a pure function of the telling's
    own clock (so stills and replays are exact), phased by beats. Unattended, it rests as a
    small glow low on the ground, as a stage does. */
class Moment {
  group = new THREE.Group();
  private n = MOBILE ? 7000 : 10000;
  private cloud: SpriteCloud;
  private P: Float32Array;
  private C: Float32Array;
  private idle: Float32Array;
  private life = 0;
  private uT = T.uniform(0);
  private uGlow = T.uniform(1);

  constructor(at: THREE.Vector3, face: number, private into: Hour["moment"], private period: number, seedNum: number) {
    this.group.position.copy(at);
    this.group.rotation.y = face;
    const R = rng(seedNum);
    const mat = softPoints();
    this.cloud = spriteCloud(this.n, { position: 3, aCol: 3, aSeed: 1 }, mat);
    this.P = this.cloud.attrs.position.array as Float32Array;
    this.C = this.cloud.attrs.aCol.array as Float32Array;
    this.idle = new Float32Array(this.n * 3);
    for (let i = 0; i < this.n; i++) {
      const r = 1.3 * Math.sqrt(R()), a2 = R() * Math.PI * 2;
      this.idle.set([Math.cos(a2) * r, 0.15 + R() * 0.25, Math.sin(a2) * r], i * 3);
      this.C.set([0.95, 0.82, 0.62], i * 3);
    }
    this.P.set(this.idle);
    const seeds = this.cloud.attrs.aSeed.array as Float32Array;
    for (let i = 0; i < this.n; i++) seeds[i] = R();
    const { clamp, float, length, max, pointUV, sin, smoothstep } = T;
    const { position, aCol, aSeed } = this.cloud.nodes;
    const worldPos = T.modelWorldMatrix.mul(vec4(position, 1)).xyz;
    const depth = viewDepth(worldPos);
    mat.sizeNode = clamp(gpuUniforms.px.mul(0.042).mul(aSeed.mul(0.8).add(0.6)).div(max(depth, 1.2)), float(1).div(gpuUniforms.dpr), 5);
    const flick = sin(this.uT.mul(aSeed.mul(9).add(12)).add(aSeed.mul(97))).mul(0.12).add(0.88);
    const soft = smoothstep(0.5, 0.05, length(pointUV.sub(0.5)));
    const nearK = smoothstep(1.2, 3.5, depth);
    mat.colorNode = vec4(aCol.mul(soft).mul(flick).mul(this.uGlow).mul(nearK).mul(0.75), 1);
    this.cloud.sprite.frustumCulled = false;
    this.group.add(this.cloud.sprite);
  }

  update(dt: number, clock: number, telling: boolean, near: boolean, _reduced: boolean): void {
    this.group.visible = near;
    if (!near) return;
    this.life += dt;
    this.uT.value = this.life;
    const P = this.P, C = this.C;
    if (!telling || !this.into) {
      const k = Math.min(1, dt * 0.5);
      for (let j = 0; j < this.n * 3; j++) {
        P[j] += (this.idle[j] - P[j]) * k;
        C[j] += (0.95 - C[j]) * k;
      }
      this.uGlow.value = 0.7 + 0.2 * Math.sin(this.life * 0.7);
    } else {
      this.uGlow.value = 1;
      this.into(((clock % this.period) + this.period) % this.period, this.n, P, C);
    }
    this.cloud.attrs.position.needsUpdate = this.cloud.attrs.aCol.needsUpdate = true;
  }

  dispose(): void {
    this.cloud.sprite.removeFromParent();
    (this.cloud.sprite.material as THREE.Material).dispose();
    this.cloud.sprite.geometry.dispose();
  }
}

/** Keys for many turns of an hour's cycle (its clock runs only while you are near). */
function keysFor(cycle: Omit<Key, "t">[]): Key[] {
  const keys: Key[] = [];
  for (let k = 0; k < 40; k++) cycle.forEach((c, i) => keys.push({ ...c, t: 0.5 + (k * cycle.length + i) * HOLD, dur: 4.5 }));
  return keys;
}

/* ---------------------------------------------------------------- the emblems, in gold light */
function emblemSegments(kind: Hour["emblem"] | "wingedSun", s: number): number[] {
  const seg: number[] = [];
  const line = (pts: [number, number][]) => {
    for (let k = 0; k < pts.length - 1; k++) seg.push(pts[k][0] * s, pts[k][1] * s, 0, pts[k + 1][0] * s, pts[k + 1][1] * s, 0);
  };
  const circle = (cx: number, cy: number, r: number, a0 = 0, a1 = Math.PI * 2, nn = 28) =>
    line(Array.from({ length: nn + 1 }, (_, k) => [cx + Math.cos(a0 + ((a1 - a0) * k) / nn) * r, cy + Math.sin(a0 + ((a1 - a0) * k) / nn) * r] as [number, number]));
  switch (kind) {
    case "wingedSun":
      circle(0, 0, 0.3);
      for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) line([[sx * 0.34, 0.05 - k * 0.07], [sx * (1.6 - k * 0.22), 0.14 - k * 0.1], [sx * (1.75 - k * 0.25), 0.02 - k * 0.1]]);
      break;
    case "water":
      for (let r = 0; r < 3; r++) line(Array.from({ length: 9 }, (_, k) => [-0.5 + k * 0.125, r * 0.22 + (k % 2 ? 0.08 : 0)] as [number, number]));
      break;
    case "serpent":
      line(Array.from({ length: 24 }, (_, k) => [Math.sin(k * 0.55) * 0.18, k * 0.05] as [number, number]));
      circle(0.05, 1.2, 0.07);
      break;
    case "ankh":
      circle(0, 0.95, 0.18, -Math.PI / 2 - 2.6, -Math.PI / 2 + 2.6 + Math.PI * 2 - 5.2 + 0.0001);
      line([[0, 0.78], [0, 0]]);
      line([[-0.3, 0.72], [0.3, 0.72]]);
      break;
    case "coils":
      line(Array.from({ length: 60 }, (_, k) => [Math.cos(k * 0.3) * (0.4 - k * 0.006), 0.5 + Math.sin(k * 0.3) * (0.4 - k * 0.006)] as [number, number]));
      break;
    case "feather":
      line([[0, 0], [0.06, 0.6], [0.02, 1.2], [-0.1, 1.35]]);
      for (let k = 1; k < 10; k++) line([[0.04, k * 0.12], [0.2, k * 0.12 + 0.05]]);
      break;
    case "scarab":
      circle(0, 0.5, 0.26, 0, Math.PI * 2, 24);
      circle(0, 0.86, 0.1);
      circle(0, 1.25, 0.2);
      for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) line([[sx * 0.24, 0.35 + k * 0.15], [sx * 0.45, 0.3 + k * 0.18]]);
      break;
  }
  return seg;
}

/** The solar boat's shape, boat-local: a crescent hull, its cabin, and the sun it carries —
    dimmer in the hull as the dawn takes the sun up out of it. Pure and deterministic. */
export function boatShape(t: number, n: number, P: Float32Array, C: Float32Array, dawnK = 0): void {
  const nH = Math.floor(n * 0.68), nC = Math.floor(n * 0.14);
  const pulse = 1 + 0.12 * Math.sin(t * 1.4);
  for (let i = 0; i < n; i++) {
    const j = i * 3;
    if (i < nH) {
      const u = i / nH, x = -2.4 + u * 4.8;
      const y = Math.pow(Math.abs(x) / 2.4, 3) * 1.1 + (pj(i, 22) - 0.5) * 0.1;
      P[j] = x;
      P[j + 1] = y + 0.35;
      P[j + 2] = (pj(i, 23) - 0.5) * 0.5;
      const fade = 1 - dawnK * 0.75;
      C[j] = 1.0 * fade;
      C[j + 1] = 0.72 * fade;
      C[j + 2] = 0.38 * fade;
    } else if (i < nH + nC) {
      const k = pj(i, 24), a = k * Math.PI * 2, rr = 0.4 * Math.sqrt(pj(i, 25));
      P[j] = Math.cos(a) * rr;
      P[j + 1] = 1.15 + (pj(i, 26) - 0.5) * rr;
      P[j + 2] = Math.sin(a) * rr;
      const fade = 1 - dawnK * 0.6;
      C[j] = 0.9 * fade;
      C[j + 1] = 0.8 * fade;
      C[j + 2] = 0.62 * fade;
    } else {
      // the sun aboard, rising as the dawn comes
      const k = pj(i, 27), a = k * Math.PI * 2 + t * 0.3, rr = 0.5 * Math.sqrt(pj(i, 28)) * pulse;
      P[j] = Math.cos(a) * rr;
      P[j + 1] = 1.55 + dawnK * 3.2 + (pj(i, 29) - 0.5) * rr;
      P[j + 2] = Math.sin(a) * rr;
      C[j] = 1.0;
      C[j + 1] = 0.78 + 0.1 * dawnK;
      C[j + 2] = 0.48 + 0.14 * dawnK;
    }
  }
}

export interface BoatClock {
  gates: number[];
  period: number;
  marks: number[];
  dwell: number;
  sail: number;
}
/** The journey's beat plan: sail S between consecutive waypoints, dwell D at each gate. Pure,
    so the tests can hold it; `marks` are the clock times each waypoint's dwell begins. */
export function boatSchedule(gates: number[]): BoatClock {
  const sail = 16, dwell = 5;
  const marks: number[] = [];
  let t = 0;
  for (let k = 0; k < gates.length + 1; k++) {
    t += sail;
    if (k < gates.length) {
      t += dwell;
      marks.push(t);
    }
  }
  return { gates, period: t, marks, dwell, sail };
}
/** Where the boat is on the river (0–1) at journey time t — flat at a gate's dwell, sailing
    between, eased in and out of each leg. */
export function boatUAt(t: number, bc: BoatClock): number {
  const legs = [0, ...bc.gates, 1];
  let k = 0;
  while (k < bc.marks.length && t >= bc.marks[k]) k++;
  // inside leg k: it began after the previous mark (or 0) and ends at marks[k]
  const segStart = k === 0 ? 0 : bc.marks[k - 1];
  const segEnd = k < bc.marks.length ? bc.marks[k] - bc.dwell : segStart + bc.sail;
  const f = bc.sail > 0 ? Math.min(1, Math.max(0, (t - segStart) / Math.max(0.01, segEnd - segStart))) : 1;
  const e2 = f * f * (3 - 2 * f);
  return legs[k] + (legs[k + 1] - legs[k]) * e2;
}

/* ---------------------------------------------------------------- the Duat */
export class Duat {
  /** For still frames (?shot=duat-<k>&t=): every hour's clock reads this. */
  static clockOverride: number | null = null;
  group = new THREE.Group();
  private stages: { telling: { group: THREE.Group; update(dt: number, clock: number, telling: boolean, near: boolean, reduced: boolean): void }; at: THREE.Vector3; clock: number; named: boolean; name: string }[] = [];
  private flames: { sprite: THREE.Sprite; base: number; phase: number }[] = [];
  private uT = T.uniform(0);
  private boat: { cloud: SpriteCloud; n: number; curve: THREE.CatmullRomCurve3 } | null = null;
  private boatGroup: THREE.Group | null = null;
  private boatClock: BoatClock | null = null;
  private boatP = new V();
  private boatT = new V();

  constructor(private say: (text: string, ms: number) => void) {
    this.buildSky();
    this.buildGround();
    this.buildGorge();
    const river = this.buildRiver();
    this.buildStair();
    this.buildLamps();
    this.buildBoat(river);
    this.buildHours();
    // the light of the night: faint and blue from above, warm from the lamps; a dawn in the east
    this.group.add(new THREE.HemisphereLight(0x5a6aa8, 0x2a1c10, 0.7));
    const moon = new THREE.DirectionalLight(0x9fb0e0, 0.6);
    moon.position.set(-20, 40, 10);
    this.group.add(moon, moon.target);
    const dawn = new THREE.PointLight(0xffb070, 30, 40, 1.6);
    dawn.position.copy(DUAT_PATH[7]).add(new V(0, 4, -6));
    this.group.add(dawn);
  }

  /** The night of Nut: deep blue to black, dense stars, and her body a band of light across it. */
  private buildSky(): void {
    const m = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, fog: false, depthWrite: false });
    const d = T.normalize(T.positionLocal);
    const el = T.clamp(d.y, -0.2, 1);
    const base = mix(vec3(0.02, 0.025, 0.06), vec3(0.002, 0.003, 0.012), smoothstep(0, 0.7, el));
    const g = d.mul(520), cell = T.floor(g);
    const h = fract(sin(T.dot(cell, vec3(12.9898, 78.233, 37.719))).mul(43758.5453));
    const round = smoothstep(0.32, 0.0, T.length(fract(g).sub(0.5)));
    const star = T.step(0.985, h).mul(fract(h.mul(97)).mul(0.8).add(0.2)).mul(round);
    // Nut's body: an arch of light and stars from east to west
    const band = exp(d.z.mul(d.z).mul(-18)).mul(smoothstep(0.05, 0.4, el));
    const bandStars = T.step(0.955, h).mul(band).mul(round);
    const dawnGlow = exp(T.length(d.xz.sub(vec2(-0.3, -0.9))).mul(-3)).mul(smoothstep(0.35, -0.05, el)).mul(0.25);
    m.colorNode = vec4(base.add(vec3(0.5, 0.45, 0.6).mul(band.mul(0.06))).add(vec3(1, 0.95, 0.85).mul(star.add(bandStars).mul(0.9))).add(vec3(1, 0.6, 0.35).mul(dawnGlow)), 1);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(170, 48, 24), m);
    dome.renderOrder = -10;
    dome.frustumCulled = false;
    this.group.add(dome);
  }

  /** Sand in the night: the scan's grain and relief, the dunes from `duatHeight`. */
  private buildGround(): void {
    const g = new THREE.PlaneGeometry(RIM * 2 + 12, RIM * 2 + 12, 120, 120).rotateX(-Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setY(i, duatHeight(p.getX(i), p.getZ(i)));
    g.computeVertexNormals();
    const S = surface("sand");
    const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.95, metalness: 0 });
    const w = T.positionWorld.xz.div(2.6);
    m.colorNode = T.texture(S.diff, w).rgb.mul(vec3(0.62, 0.58, 0.6)).mul(T.mix(float(0.5), float(1), T.texture(S.arm, w).r));
    m.normalMap = S.nor;
    const ground = new THREE.Mesh(g, m);
    ground.receiveShadow = true;
    this.group.add(ground);
  }

  /** The gorge: a ring of broken cliffs round it all, in the scanned stone. */
  private buildGorge(): void {
    const g = new THREE.CylinderGeometry(RIM + 4, RIM + 9, 30, 160, 14, true);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x);
      const r = Math.hypot(x, z) + (noise(a * 9, y * 0.18) - 0.5) * 7 + (noise(a * 31, y * 0.6) - 0.5) * 1.6;
      p.setXYZ(i, Math.cos(a) * r, y + 12, Math.sin(a) * r);
    }
    g.computeVertexNormals();
    const cliff = new THREE.Mesh(g, landStone("sandstone_cracks", 2, 3.2, [0.75, 0.72, 0.78]));
    cliff.material.side = THREE.BackSide;
    this.group.add(cliff);
  }

  /** A dark river beside the way (on its inner side), slow gold moving on it. Returns the
    curve and its length, for the solar boat's journey. */
  private buildRiver(): { curve: THREE.CatmullRomCurve3; len: number } {
    const c = new V();
    for (const q of DUAT_PATH.slice(0, 7)) c.add(q);
    c.multiplyScalar(1 / 7);
    const curve = new THREE.CatmullRomCurve3(DUAT_PATH.slice(0, 7).map((q) => q.clone().lerp(c, 0.28).setY(0)), false, "centripetal");
    const pts = curve.getSpacedPoints(160);
    const len = curve.getLength();
    const left: number[] = [], idx: number[] = [], along: number[] = [];
    pts.forEach((q, i) => {
      const nxt = pts[Math.min(pts.length - 1, i + 1)], prv = pts[Math.max(0, i - 1)];
      const dir = new V().subVectors(nxt, prv).normalize(), side = new V(-dir.z, 0, dir.x);
      for (const s of [-1.6, 1.6]) {
        const x = q.x + side.x * s, z = q.z + side.z * s;
        left.push(x, duatHeight(x, z) + 0.06, z);
        along.push(i / 160, s > 0 ? 1 : 0);
      }
      if (i < pts.length - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(left, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(along, 2));
    g.setIndex(idx);
    const m = new THREE.MeshBasicNodeMaterial({ fog: false, transparent: true, depthWrite: false });
    const u = uv();
    const edge = smoothstep(0, 0.25, u.y).mul(smoothstep(1, 0.75, u.y));
    const flow = sin(u.x.mul(420).sub(this.uT.mul(1.4)).add(sin(u.y.mul(9)).mul(2))).mul(0.5).add(0.5);
    const glint = T.pow(flow, 18).mul(0.5);
    m.colorNode = vec4(vec3(0.01, 0.015, 0.035).add(vec3(1.0, 0.75, 0.4).mul(glint.mul(edge))), edge.mul(0.92));
    this.group.add(new THREE.Mesh(g, m));
    return { curve, len };
  }

  /** The solar boat's journey (item 8): the barque of golden light rides the dark river the
      whole way — it lingers at each of the six gates while its sun brightens, sails on between,
      and at the stair's foot its sun rises into the dawn and the boat begins again. A pure
      function of the night's own clock, so stills freeze it mid-journey. */
  private buildBoat(river: { curve: THREE.CatmullRomCurve3; len: number }): void {
    // where each hour's gate stands along the river (its nearest point, as a fraction)
    const gates = HOURS.map((h) => {
      const at = DUAT_PATH[h.at];
      let best = 0, bd = Infinity;
      for (let k = 0; k <= 240; k++) {
        const p = river.curve.getPointAt(k / 240), d = (p.x - at.x) ** 2 + (p.z - at.z) ** 2;
        if (d < bd) (bd = d), (best = k / 240);
      }
      return best;
    });
    this.boatClock = boatSchedule(gates);
    const n = MOBILE ? 1200 : 2000;
    const mat = softPoints();
    const cloud = spriteCloud(n, { position: 3, aCol: 3, aSeed: 1 }, mat);
    this.boat = { cloud, n, curve: river.curve };
    const P = cloud.attrs.position.array as Float32Array;
    const C = cloud.attrs.aCol.array as Float32Array;
    const seeds = cloud.attrs.aSeed.array as Float32Array;
    const { clamp, float, length, max, pointUV, sin, smoothstep } = T;
    const { position, aCol, aSeed } = cloud.nodes;
    const worldPos = T.modelWorldMatrix.mul(vec4(position, 1)).xyz;
    const depth = viewDepth(worldPos);
    mat.sizeNode = clamp(gpuUniforms.px.mul(0.04).mul(aSeed.mul(0.8).add(0.6)).div(max(depth, 1.2)), float(1).div(gpuUniforms.dpr), 5);
    const flick = sin(this.uT.mul(aSeed.mul(9).add(12)).add(aSeed.mul(97))).mul(0.12).add(0.88);
    const soft = smoothstep(0.5, 0.05, length(pointUV.sub(0.5)));
    const nearK = smoothstep(1.2, 3.5, depth);
    mat.colorNode = vec4(aCol.mul(soft).mul(flick).mul(nearK).mul(0.85), 1);
    for (let i = 0; i < n; i++) seeds[i] = pj(i, 21);
    boatShape(0, n, P, C);
    cloud.sprite.frustumCulled = false;
    this.boatGroup = new THREE.Group();
    this.boatGroup.add(cloud.sprite);
    this.group.add(this.boatGroup);
  }

  private updateBoat(t: number): void {
    const bc = this.boatClock, boat = this.boat, group = this.boatGroup;
    if (!bc || !boat || !group) return;
    const jt = ((t % bc.period) + bc.period) % bc.period;
    const u = boatUAt(jt, bc);
    const p = boat.curve.getPointAt(THREE.MathUtils.clamp(u, 0, 1), this.boatP);
    const tg = boat.curve.getTangentAt(THREE.MathUtils.clamp(u, 0, 1), this.boatT);
    group.position.set(p.x, duatHeight(p.x, p.z) + 0.22 + Math.sin(t * 0.9) * 0.05, p.z);
    group.rotation.y = Math.atan2(tg.x, tg.z);
    const dawnK = THREE.MathUtils.clamp((u - bc.gates[bc.gates.length - 1]) / Math.max(0.01, 1 - bc.gates[bc.gates.length - 1]), 0, 1);
    const P = boat.cloud.attrs.position.array as Float32Array;
    const C = boat.cloud.attrs.aCol.array as Float32Array;
    boatShape(t, boat.n, P, C, dawnK);
    boat.cloud.attrs.position.needsUpdate = boat.cloud.attrs.aCol.needsUpdate = true;
  }

  /** The stair from the last gate up to the dawn: blocks of stone, one course a step. */
  private buildStair(): void {
    const parts: THREE.BufferGeometry[] = [];
    for (let seg = 5; seg < 7; seg++) {
      const a = DUAT_PATH[seg], b = DUAT_PATH[seg + 1];
      const L = Math.hypot(b.x - a.x, b.z - a.z), steps = Math.max(1, Math.round(Math.abs(b.y - a.y) / 0.25));
      const ang = Math.atan2(b.x - a.x, b.z - a.z);
      for (let k = 0; k < steps; k++) {
        const t0 = k / steps, t1 = (k + 1) / steps, y = a.y + (b.y - a.y) * t1;
        if (y <= 0.05) continue;
        const cx = a.x + (b.x - a.x) * (t0 + t1) / 2, cz = a.z + (b.z - a.z) * (t0 + t1) / 2;
        const box = new THREE.BoxGeometry(4.4, y + 0.3, (L / steps) * 1.02).toNonIndexed();
        box.translate(0, (y - 0.3) / 2, 0);
        box.rotateY(ang);
        box.translate(cx, 0, cz);
        box.deleteAttribute("uv");
        parts.push(box);
      }
    }
    if (!parts.length) return;
    const stair = new THREE.Mesh(mergeGeometries(parts)!, landStone("sandstone_blocks_08", 0, 2.2));
    stair.castShadow = stair.receiveShadow = true;
    this.group.add(stair);
  }

  /** Stone lamps along the way, every few metres, a small flame in each. */
  private buildLamps(): void {
    const curve = new THREE.CatmullRomCurve3(DUAT_PATH, false, "centripetal");
    const len = curve.getLength(), count = Math.floor(len / 7);
    const tex = (() => {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const g = c.getContext("2d")!;
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, "rgba(255,240,210,1)");
      grd.addColorStop(0.25, "rgba(255,190,110,0.5)");
      grd.addColorStop(1, "rgba(255,150,80,0)");
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 64);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const bowlGeo = new THREE.CylinderGeometry(0.28, 0.2, 0.5, 12);
    const bowls = new THREE.InstancedMesh(bowlGeo, landStone("sandstone_cracks", 0, 1.2), count * 2);
    let n = 0;
    const p = new V(), tg = new V();
    for (let i = 1; i <= count; i++) {
      curve.getPointAt(i / (count + 1), p);
      curve.getTangentAt(i / (count + 1), tg);
      for (const s of [-1, 1]) {
        const x = p.x - tg.z * 2.6 * s, z = p.z + tg.x * 2.6 * s, y = duatHeight(x, z);
        bowls.setMatrixAt(n++, new THREE.Matrix4().makeTranslation(x, y + 0.25, z));
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
        sp.position.set(x, y + 0.72, z);
        sp.scale.setScalar(0.55);
        this.group.add(sp);
        this.flames.push({ sprite: sp, base: 0.55, phase: i * 1.7 + s });
      }
    }
    bowls.count = n;
    bowls.castShadow = true;
    this.group.add(bowls);
  }

  /** The six gates and the story beyond each. */
  private buildHours(): void {
    const stone = landStone("sandstone_blocks_08", 0, 2.4);
    const gold = ribbonMaterial(vec3(1.0, 0.8, 0.46).mul(0.9), 0.6);
    for (const h of HOURS) {
      const at = DUAT_PATH[h.at], prev = DUAT_PATH[h.at - 1];
      const dir = new V().subVectors(at, prev).setY(0).normalize();
      const face = Math.atan2(dir.x, dir.z);
      // the gate: two battered posts and a lintel, across the way 7 m before the place
      const gp = at.clone().addScaledVector(dir, -7);
      const gate = new THREE.Group();
      gate.position.set(gp.x, duatHeight(gp.x, gp.z), gp.z);
      gate.rotation.y = face;
      const parts: THREE.BufferGeometry[] = [];
      for (const sx of [-1, 1]) {
        const post = new THREE.CylinderGeometry(0.7, 0.95, 5.2, 4, 1).toNonIndexed();
        post.rotateY(Math.PI / 4);
        post.scale(1, 1, 0.8);
        post.translate(sx * 2.3, 2.6, 0);
        parts.push(post);
      }
      const lintel = new THREE.BoxGeometry(6.8, 1.0, 1.6).toNonIndexed();
      lintel.translate(0, 5.6, 0);
      parts.push(lintel);
      // faceted, as cut stone is: each face its own normal
      const cut = parts.map((q) => {
        const f = q.index ? q.toNonIndexed() : q;
        f.deleteAttribute("uv");
        f.computeVertexNormals();
        return f;
      });
      const mesh = new THREE.Mesh(mergeGeometries(cut)!, stone);
      mesh.castShadow = mesh.receiveShadow = true;
      gate.add(mesh);
      // carved in light: the winged sun on the lintel (both faces), the hour's emblem on the posts
      for (const zf of [-0.82, 0.82]) {
        const ws = new THREE.Mesh(ribbonGeometry(emblemSegments("wingedSun", 1)), gold);
        ws.position.set(0, 5.6, zf);
        ws.rotation.y = zf < 0 ? Math.PI : 0;
        ws.frustumCulled = false;
        gate.add(ws);
        for (const sx of [-1, 1]) {
          const em = new THREE.Mesh(ribbonGeometry(emblemSegments(h.emblem, 1)), gold);
          em.position.set(sx * 2.3, 2.0, zf * 0.75);
          em.rotation.y = zf < 0 ? Math.PI : 0;
          em.frustumCulled = false;
          gate.add(em);
        }
      }
      this.group.add(gate);
      // the story, standing on the way beyond the gate, facing whoever comes through —
      // the hours the owner named as an animated telling, the rest as a stage of forms
      const sp = at.clone();
      sp.y = duatHeight(sp.x, sp.z);
      const telling: { group: THREE.Group; update(dt: number, clock: number, telling: boolean, near: boolean, reduced: boolean): void } = h.moment
        ? new Moment(sp, face + Math.PI, h.moment, h.period ?? 30, 900 + h.at * 17)
        : new VisionStage({ at: sp, face: face + Math.PI, forms: h.forms ?? {}, keys: keysFor(h.cycle ?? []), seedNum: 700 + h.at * 13 });
      this.group.add(telling.group);
      this.stages.push({ telling, at: sp, clock: 0, named: false, name: h.name });
      // a warm light on the gate's stone
      const lamp = new THREE.PointLight(0xffb070, 8, 14, 1.8);
      lamp.position.set(gp.x, gate.position.y + 3, gp.z).addScaledVector(dir, -2);
      this.group.add(lamp);
    }
  }

  /** Each frame, with the wanderer's position (Duat-local). `frozen`: the session is paused
      (item 13) — the tellings' clocks stand still with it; the night itself flows on. */
  update(t: number, dt: number, local: THREE.Vector3, reduced: boolean, frozen = false): void {
    this.uT.value = reduced ? t * 0.4 : t;
    this.updateBoat(t);
    for (const f of this.flames) {
      const k = reduced ? 1 : 0.85 + 0.1 * Math.sin(t * 9 + f.phase) + 0.05 * Math.sin(t * 23 + f.phase * 2);
      f.sprite.scale.setScalar(f.base * k);
    }
    for (const s of this.stages) {
      const d = Math.hypot(local.x - s.at.x, local.z - s.at.z);
      const near = d < 30;
      const telling = d < 16;
      // its clock runs while you are with it (but stands still while the session is paused),
      // and rests (from the start again) once you have gone
      if (telling && !frozen) s.clock += dt;
      else if (d > 30) s.clock = 0;
      if (Duat.clockOverride !== null) s.clock = Duat.clockOverride;
      s.telling.update(Math.min(0.05, dt), s.clock, telling, near, reduced);
      if (!s.named && d < 12) {
        s.named = true;
        this.say(s.name, 5000);
      }
    }
  }
}

/* ---------------------------------------------------------------- the tour's stops (item 8) */
export interface TourStop {
  /** Duat-local: standing place on the way (y already the ground) and the heading that faces
      the telling. */
  x: number;
  y: number;
  z: number;
  heading: number;
  /** Only the name of the place: no narration is invented (the header's rule). */
  title: string;
  /** How long the telling holds before the tour moves on by itself. */
  hold: number;
}
/** The tour's stops, in walking order: the hidden door, the six hours, the stair of dawn. */
export function duatTourStops(): TourStop[] {
  const stops: TourStop[] = [];
  const h0 = Math.atan2(DUAT_PATH[1].x - DUAT_PATH[0].x, DUAT_PATH[1].z - DUAT_PATH[0].z);
  stops.push({ x: DUAT_PATH[0].x, y: duatHeight(DUAT_PATH[0].x, DUAT_PATH[0].z), z: DUAT_PATH[0].z, heading: h0, title: "The Duat", hold: 7 });
  for (const h of HOURS) {
    const at = DUAT_PATH[h.at], prev = DUAT_PATH[h.at - 1];
    const dir = new V().subVectors(at, prev).setY(0).normalize();
    const sp = at.clone().addScaledVector(dir, -4.5);
    stops.push({
      x: sp.x,
      y: duatHeight(sp.x, sp.z),
      z: sp.z,
      heading: Math.atan2(dir.x, dir.z),
      title: h.name,
      hold: h.moment ? (h.period ?? 30) + 4 : Math.min(h.cycle?.length ?? 3, 3) * HOLD + 6,
    });
  }
  const last = DUAT_PATH[7], pv = DUAT_PATH[6];
  stops.push({ x: last.x, y: duatHeight(last.x, last.z), z: last.z, heading: Math.atan2(last.x - pv.x, last.z - pv.z), title: "The dawn", hold: 9 });
  return stops;
}
