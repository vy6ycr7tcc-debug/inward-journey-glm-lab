/* The pyramid (Samuel: "we need a pyramid!!! research ra material pyramid, purposes,
   significance, composition"). Built after what Ra says of the Great Pyramid, paraphrased,
   never quoted (L/L Research, the Ra contact):
   - It was thought/built by Ra's social memory complex from thought-forms, "everlasting rock";
     the stones are alive (2.4, 3.11–3.13). Its casing here is pale limestone whose courses
     carry a slow living light, and its capstone rose granite, chosen for its crystalline
     properties (3.6).
   - Its purposes were one: healing and initiation, to prepare mind, body and spirit for
     service; pyramids were to ring the Earth, balancing the energy coming in (2.4, 3.15). The
     technology was later kept by those with power, which Ra did not intend (2.2, 57.17).
   - The shape: light is drawn in at the base, as water into a funnel, and spirals upward to the
     apex (58.12, 58.15); three spirals: one within for study and healing, one to the apex for
     building, one out of the apex like a candle flame for energizing (58.23–24). One side
     faces north (58.8); faces at 51.84°, an apex angle near 76° 18′ (56.4).
   - Within (a place apart, like the temple): the subterranean chamber, a resonating chamber
     open at its bottom (55.13); the Queen's Chamber, the place of initiation and resurrection,
     where the senses rest so that, in a sense, another life begins (3.16, 56.3); the Grand
     Gallery; the King's Chamber, the place of healing, where light moves through in seven
     colours (56.3, 57.12), with the coffer and a crystal (2.4).
   - The rooms are dressed as built masonry (the interior pass): a plinth, dado and cornice on
     every wall, pilasters in the long chambers, benches in the gallery, a false door in the
     Queen's; the game's scanned stone — colour, normals, occlusion — brought within; braziers
     whose warm light breathes, shafts of light falling from above, and the King's Chamber
     glowing when its rite wakes.
   - Ra later called such shapes training wheels, no longer needed (60.13, 60.16).
   Outside you can climb its faces to the apex (terrain.ts `standAt`). */
import * as THREE from "three/webgpu";
import { T, hash2, vnoise, worldPoints, type N } from "../gpu/tsl";
import { scan, type ScanName } from "./temple";
import { PYRAMID } from "./terrain";
import { Duat, DUAT_PATH, duatHeight } from "./duat";

const { abs, cos, float, floor, fract, length, mix, sin, smoothstep, uniform, uv, vec2, vec3, vec4 } = T;
const V = THREE.Vector3;

export const PYR_ORIGIN = new THREE.Vector3(50000, 14, 0); // high enough that its lowest chamber (−9) stays above the water line
export const DUAT_ORIGIN = PYR_ORIGIN.clone().add(new THREE.Vector3(-140, -30, 60)); // world origin of the Duat: pyramid-local (−140, −30, 60), clear of the rooms (x ∈ [−34, 47.5])

/* ---------------------------------------------------------------- stone */
function triplanar(set: ScanName, tile: number): { col: N; arm: N; w: N } {
  const S = scan(set);
  const pw = T.positionWorld, n = T.normalWorldGeometry;
  const wp = T.pow(abs(n), vec3(4));
  const w = wp.div(wp.x.add(wp.y).add(wp.z));
  const tri = (t: THREE.Texture) =>
    T.texture(t, pw.zy.div(tile)).mul(w.x).add(T.texture(t, pw.xz.div(tile)).mul(w.y)).add(T.texture(t, pw.xy.div(tile)).mul(w.z));
  return { col: tri(S.diff).rgb, arm: tri(S.arm), w };
}
/** Pale limestone, its block courses breathing a slow living light ("the stones are alive"). */
function limestone(uT: N, tint: [number, number, number], alive = 1, tile = 2.4): THREE.MeshStandardNodeMaterial {
  const m = new THREE.MeshStandardNodeMaterial({ metalness: 0, roughness: 0.8 });
  const { col, arm, w } = triplanar("sandstone_blocks_05", tile);
  const c = col.mul(vec3(...tint)).mul(T.mix(float(0.55), float(1), arm.r));
  m.colorNode = vec4(c, 1);
  m.roughnessNode = T.clamp(arm.g, 0.45, 1);
  const pw = T.positionWorld;
  // courses: level joints every 1.3 m, upright joints staggered every 1.8 m
  const cy = fract(pw.y.div(1.3));
  const row = floor(pw.y.div(1.3));
  const along = pw.x.add(pw.z).add(row.mul(0.9));
  const jH = smoothstep(0.03, 0.0, cy.sub(0.5).abs().sub(0.47).abs());
  const jV = smoothstep(0.02, 0.0, fract(along.div(1.8)).sub(0.5).abs().sub(0.48).abs()).mul(float(1).sub(w.y));
  const joint = jH.max(jV);
  // the light moves upward through the courses, slowly, like a heartbeat carried in stone
  const wave = sin(pw.y.mul(0.35).sub(uT.mul(0.9))).mul(0.5).add(0.5);
  const beat = T.pow(sin(uT.mul(1.1)).mul(0.5).add(0.5), 6);
  m.emissiveNode = vec3(1.0, 0.8, 0.5).mul(joint.mul(wave.mul(0.18).add(beat.mul(0.08)).mul(alive))).add(c.mul(0.05));
  return m;
}
/** Rose granite (the capstone, the King's Chamber, the coffer): dark, flecked, with crystal
    glints. `tint` recolours (the dressed pieces within are cut deeper); `awake` adds an
    emissive term — the King's Chamber glowing when its rite wakes. */
function granite(uT: N, tint: [number, number, number] = [0.72, 0.46, 0.44], awake?: N): THREE.MeshStandardNodeMaterial {
  const m = new THREE.MeshStandardNodeMaterial({ metalness: 0.05, roughness: 0.5 });
  const { col } = triplanar("red_sandstone_pavement", 1.6);
  const pw = T.positionWorld;
  const h = (p: N) => fract(sin(T.dot(p, vec3(12.9898, 78.233, 37.719))).mul(43758.5453));
  const cell = floor(pw.mul(26));
  const fleck = h(cell);
  const c = col.mul(vec3(...tint)).mul(fleck.lessThan(0.18).select(float(0.45), fleck.greaterThan(0.9).select(float(1.6), float(1))));
  m.colorNode = vec4(c, 1);
  const glint = smoothstep(0.994, 1.0, h(cell.add(7))).mul(sin(uT.mul(1.7).add(fleck.mul(40))).mul(0.5).add(0.5));
  m.emissiveNode = vec3(1.0, 0.9, 0.8).mul(glint.mul(0.9)).add(c.mul(0.04)).add(awake ? awake : float(0));
  return m;
}
function crystalGlow(uT: N, boost?: N): THREE.MeshBasicNodeMaterial {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, fog: false });
  const V0 = T.normalize(T.cameraPosition.sub(T.positionWorld));
  const ndv = T.max(T.dot(T.normalWorld, V0), 0);
  const film = cos(vec3(ndv.mul(1.5).add(uT.mul(0.05))).add(vec3(0, 0.33, 0.67)).mul(6.28)).mul(0.5).add(0.5);
  // a lit crystal, warmed, with only a hint of the film's iridescence (full spectrum reads as a glitch)
  const k = T.mix(vec3(1.0, 0.85, 0.6), film, float(0.3)).mul(T.pow(float(1).sub(ndv), 1.5).mul(0.8).add(0.15));
  m.colorNode = vec4(boost ? k.mul(boost.mul(0.5).add(0.75)) : k, 1);
  return m;
}

/** The interior lining (the interior pass): the game's stone texturing brought within — the
    scanned blocks with their normals and packed occlusion, laid in dressed courses metred
    like the casing's (level joints every 1.3 m, uprights staggered every 1.8): every block
    its own value, the joints chamfered dark as a cut edge catches the dark before its face,
    streaks and broad patches of weathering, soot toward the deep floor — and the courses
    still carrying the living light, warmer within. `fleck` adds the granite's crystal
    glints (the King's Chamber and the ante, cut in rose stone); `awake` an emissive term
    (the King's Chamber glowing when its rite wakes). */
function lining(uT: N, tint: [number, number, number], alive = 1.2, opts: { fleck?: boolean; awake?: N } = {}): THREE.MeshStandardNodeMaterial {
  const m = new THREE.MeshStandardNodeMaterial({ metalness: 0, roughness: 0.82 });
  const S = scan("sandstone_blocks_05");
  const pw = T.positionWorld, n = T.normalWorldGeometry;
  const wp = T.pow(abs(n), vec3(4));
  const w = wp.div(wp.x.add(wp.y).add(wp.z));
  const tile = 1.7;
  const at = (t: THREE.Texture, p: N) => T.texture(t, p.div(tile));
  const arm = at(S.arm, pw.zy).mul(w.x).add(at(S.arm, pw.xz).mul(w.y)).add(at(S.arm, pw.xy).mul(w.z));
  const c = at(S.diff, pw.zy).rgb.mul(w.x).add(at(S.diff, pw.xz).rgb.mul(w.y)).add(at(S.diff, pw.xy).rgb.mul(w.z)).mul(vec3(...tint));
  // the casing's own course measures, metred from the room's stone
  const cy = fract(pw.y.div(1.3));
  const row = floor(pw.y.div(1.3));
  const along = pw.x.add(pw.z).add(row.mul(0.9));
  const cu = fract(along.div(1.8));
  const bv = hash2(vec2(floor(along.div(1.8)), row)).mul(0.16).add(0.92); // no two blocks alike
  const dH = cy.min(float(1).sub(cy)).mul(1.3);
  const dV = cu.min(float(1).sub(cu)).mul(1.8).mul(float(1).sub(w.y));
  const chamfer = smoothstep(0.09, 0.02, dH).max(smoothstep(0.06, 0.015, dV));
  // weathering: streaks run down, broad patches, soot toward the deep rooms' floor
  const ly = pw.y.sub(float(PYR_ORIGIN.y));
  const grime = T.mix(float(0.8), float(1), smoothstep(float(-9), float(-1.5), ly));
  const streak = T.mix(float(0.86), float(1), vnoise(vec2(pw.x.add(pw.z).mul(1.3), ly.mul(0.11))));
  const patch = T.mix(float(0.88), float(1.06), vnoise(pw.xz.add(vec2(pw.y, pw.y)).mul(0.2)));
  m.colorNode = vec4(c.mul(bv).mul(float(1).sub(chamfer.mul(0.38))).mul(T.mix(float(0.55), float(1), arm.r)).mul(grime).mul(streak).mul(patch), 1);
  // the scan's tooth, triplanar like the colour: each plane's frame is its own axes (the
  // shells are unrotated, so a world normal may pass straight to view)
  const rm = (s: N) => s.rgb.mul(2).sub(1);
  const sX = rm(at(S.nor, pw.zy)), sY = rm(at(S.nor, pw.xz)), sZ = rm(at(S.nor, pw.xy));
  const nW = vec3(sX.z, sX.y, sX.x).mul(w.x).add(vec3(sY.x, sY.z, sY.y).mul(w.y)).add(vec3(sZ.x, sZ.y, sZ.z).mul(w.z));
  m.normalNode = T.transformNormalToView(T.normalize(nW));
  m.roughnessNode = T.clamp(arm.g, 0.45, 1);
  // the living light, warmer within
  const jH = smoothstep(0.03, 0.0, cy.sub(0.5).abs().sub(0.47).abs());
  const jV = smoothstep(0.02, 0.0, cu.sub(0.5).abs().sub(0.48).abs()).mul(float(1).sub(w.y));
  const joint = jH.max(jV);
  const wave = sin(pw.y.mul(0.35).sub(uT.mul(0.9))).mul(0.5).add(0.5);
  const beat = T.pow(sin(uT.mul(1.1)).mul(0.5).add(0.5), 6);
  let em: N = vec3(1.0, 0.76, 0.46).mul(joint.mul(wave.mul(0.15).add(beat.mul(0.07)).mul(alive))).add(c.mul(0.045));
  if (opts.fleck) {
    const h = (p: N) => fract(sin(T.dot(p, vec3(12.9898, 78.233, 37.719))).mul(43758.5453));
    const cell = floor(pw.mul(26));
    const glint = smoothstep(0.994, 1.0, h(cell.add(7))).mul(sin(uT.mul(1.7).add(h(cell).mul(40))).mul(0.5).add(0.5));
    em = em.add(vec3(1.0, 0.9, 0.8).mul(glint.mul(0.5)));
  }
  if (opts.awake) em = em.add(opts.awake);
  m.emissiveNode = em;
  return m;
}

/* ---------------------------------------------------------------- the entrance (item 6) */
/* The north-face entrance, cut as masonry rather than set against it: the casing is opened
   where the mouth is, a granite rim stands proud of the face, the passage recedes into the
   stone and ends in darkness with the chamber's own light breathing in it, and a limestone
   gable sheds the sky over the whole. (It was two blocks and a lintel leaning on the face,
   with the warm glow plane buried inside the solid casing — a doorway you could never see
   into.) The pieces are built here as pure geometry so the mouth can be tested without
   booting the pyramid. */
/** The mouth (pyramid-local): the casing is cut open over this rectangle. The interior entry
    room opens ±1.2 wide, 3 high; the mouth reads a hand wider and taller so the crossing
    never clips. */
export const ENTRANCE_MOUTH = { x0: -1.3, x1: 1.3, y0: 0, y1: 3.4 };
export const ENTRANCE_PROUD = 0.8; // the rim stands this far off the face
export const ENTRANCE_DEPTH = 6; // the passage recedes this far into the stone at the floor
export const GABLE_PROUD = 1.5; // the gable stands prouder still: a pediment over the mouth

/** One quad as two triangles, wound so the side the `want` normal points at is the visible
    (front) side. Flat normals come from computeVertexNormals (non-indexed). */
function faceQuad(out: number[], a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, want: THREE.Vector3): void {
  const n = new V().subVectors(b, a).cross(new V().subVectors(d, a));
  const [p, q, r, s] = n.dot(want) >= 0 ? [a, b, c, d] : [a, d, c, b];
  out.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z, p.x, p.y, p.z, r.x, r.y, r.z, s.x, s.y, s.z);
}
function geometryOf(pos: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** The casing's north face with the mouth cut out: the face is the plane
    z = −half + (half/ht)·y for y ∈ [0, yTop]; the mouth rectangle is left open so the
    entrance's own reveals show through. Three quads: two flanks beside the mouth, one crown
    above it (the mouth reaches the foot of the face, so nothing sits below). */
export function northFaceGeometry(half: number, ht: number, yTop: number, mouth = ENTRANCE_MOUTH): THREE.BufferGeometry {
  const pos: number[] = [];
  const zf = (y: number) => -half + (half / ht) * y;
  const r = (y: number) => half * (1 - y / ht);
  const M = mouth, W = M.x1, TOPY = yTop;
  // a flank between the mouth's jamb and the face's slanted west/east edge
  const flank = (side: 1 | -1) => {
    const foot = side * r(M.y0), footTop = side * r(M.y1);
    faceQuad(
      pos,
      new V(foot, M.y0, zf(M.y0)), new V(side * W, M.y0, zf(M.y0)),
      new V(side * W, M.y1, zf(M.y1)), new V(footTop, M.y1, zf(M.y1)),
      new V(0, ht, -half), // outward and up, as the face's own normal runs
    );
  };
  flank(-1);
  flank(1);
  // the crown above the mouth, full width
  faceQuad(
    pos,
    new V(-r(M.y1), M.y1, zf(M.y1)), new V(r(M.y1), M.y1, zf(M.y1)),
    new V(r(TOPY), TOPY, zf(TOPY)), new V(-r(TOPY), TOPY, zf(TOPY)),
    new V(0, ht, -half),
  );
  return geometryOf(pos);
}

/** The entrance itself, as five geometries by material. `granite`: the proud rim (jambs and
    lintel band) and the threshold sill underfoot. `limestone`: the reveals receding into the
    stone. `gable`: the gable over the mouth, its own deeper dressed stone so it reads as a
    piece set before the face, not as more casing. `glow`: the passage's dark end, the
    chamber's own light breathing in it. `spill`: the light the open door lays on the sand. */
export function entranceGeometry(half: number, ht: number): {
  granite: THREE.BufferGeometry;
  limestone: THREE.BufferGeometry;
  gable: THREE.BufferGeometry;
  glow: THREE.BufferGeometry;
  spill: THREE.BufferGeometry;
} {
  const M = ENTRANCE_MOUTH, P = ENTRANCE_PROUD, D = ENTRANCE_DEPTH, GP = GABLE_PROUD;
  const W = M.x1, MH = M.y1, LT = MH + P; // the lintel band's top (P thick over the mouth)
  const GW = W + P; // the rim's outer half-width (as wide as it is proud)
  const GX = W + 1.3, GA = MH + 3.4; // the gable's feet and apex (it overhangs the rim)
  const zf = (y: number) => -half + (half / ht) * y;
  const CAPZ = zf(0) + D; // the passage's dark end: flat, vertical, past the slanted face
  const OUT = new V(0, ht, -half); // the face's outward normal
  const granite: number[] = [], limestone: number[] = [], gable: number[] = [], glow: number[] = [], spill: number[] = [];
  for (const side of [-1, 1] as const) {
    // the rim's front, standing proud of the face, parallel to it
    faceQuad(granite,
      new V(side * W, 0, zf(0) - P), new V(side * GW, 0, zf(0) - P),
      new V(side * GW, LT, zf(LT) - P), new V(side * W, LT, zf(LT) - P), OUT);
    // the rim's outer end, down to the face
    faceQuad(granite,
      new V(side * GW, 0, zf(0) - P), new V(side * GW, 0, zf(0)),
      new V(side * GW, LT, zf(LT)), new V(side * GW, LT, zf(LT) - P), new V(side, 0, 0));
    // the rim's top (under the gable's foot, kept for the silhouette)
    faceQuad(granite,
      new V(side * W, LT, zf(LT) - P), new V(side * GW, LT, zf(LT) - P),
      new V(side * GW, LT, zf(LT)), new V(side * W, LT, zf(LT)), new V(0, 1, 0));
    // the rim's inner face, through the proud band (the reveal carries on behind it)
    faceQuad(granite,
      new V(side * W, 0, zf(0) - P), new V(side * W, 0, zf(0)),
      new V(side * W, MH, zf(MH)), new V(side * W, MH, zf(MH) - P), new V(-side, 0, 0));
    // the reveal: from the face plane back to the dark end, deeper at the foot (the face slants away)
    faceQuad(limestone,
      new V(side * W, 0, zf(0)), new V(side * W, 0, CAPZ),
      new V(side * W, MH, CAPZ), new V(side * W, MH, zf(MH)), new V(-side, 0, 0));
    // the gable: a triangular wall over the mouth, standing prouder than the rim
    faceQuad(gable,
      new V(side * GX, LT, zf(LT) - GP), new V(0, GA, zf(GA) - GP),
      new V(0, GA, zf(GA) - 0.02), new V(side * GX, LT, zf(LT) - 0.02),
      new V(side, 1, 0)); // its sloping edge, shedding the sky sideways off the mouth
  }
  // the gable's two faces (front prouder still, back kissing the casing)
  faceQuad(gable,
    new V(-GX, LT, zf(LT) - GP), new V(GX, LT, zf(LT) - GP),
    new V(0, GA, zf(GA) - GP), new V(0, GA, zf(GA) - GP), OUT);
  {
    // a triangle pushed through faceQuad: pass the apex twice so the second half is degenerate
    faceQuad(gable,
      new V(-GX, LT, zf(LT) - 0.02), new V(GX, LT, zf(LT) - 0.02),
      new V(0, GA, zf(GA) - 0.02), new V(0, GA, zf(GA) - 0.02), OUT);
  }
  // the gable's underside, over the rim and the casing's shoulder (seen from below, approaching)
  faceQuad(gable,
    new V(-GX, LT, zf(LT) - GP), new V(GX, LT, zf(LT) - GP),
    new V(GX, LT, zf(LT) - 0.02), new V(-GX, LT, zf(LT) - 0.02), new V(0, -1, 0));
  // the lintel band between mouth and gable
  faceQuad(granite,
    new V(-GW, MH, zf(MH) - P), new V(GW, MH, zf(MH) - P),
    new V(GW, LT, zf(LT) - P), new V(-GW, LT, zf(LT) - P), OUT);
  faceQuad(granite, // its underside: the passage ceiling through the proud band
    new V(-W, MH, zf(MH) - P), new V(W, MH, zf(MH) - P),
    new V(W, MH, zf(MH)), new V(-W, MH, zf(MH)), new V(0, -1, 0));
  faceQuad(granite, // its top, under the gable
    new V(-GW, LT, zf(LT) - P), new V(GW, LT, zf(LT) - P),
    new V(GW, LT, zf(LT)), new V(-GW, LT, zf(LT)), new V(0, 1, 0));
  // the reveal's ceiling, from the face plane back to the dark end
  faceQuad(limestone,
    new V(-W, MH, zf(MH)), new V(W, MH, zf(MH)),
    new V(W, MH, CAPZ), new V(-W, MH, CAPZ), new V(0, -1, 0));
  // the threshold: the whole walkable depth of the passage, rim to dark end
  faceQuad(granite,
    new V(-W, 0, zf(0) - P), new V(W, 0, zf(0) - P),
    new V(W, 0, CAPZ), new V(-W, 0, CAPZ), new V(0, 1, 0));
  // the dark end of the passage (the chamber's own light breathes in it — see buildOutside)
  faceQuad(glow,
    new V(-W, 0, CAPZ), new V(W, 0, CAPZ),
    new V(W, MH, CAPZ), new V(-W, MH, CAPZ), new V(0, 0, -1));
  // the light the open door lays on the sand before it
  faceQuad(spill,
    new V(-4.2, 0.07, zf(0) - P - 6.6), new V(4.2, 0.07, zf(0) - P - 6.6),
    new V(4.2, 0.07, zf(0) - P + 0.4), new V(-4.2, 0.07, zf(0) - P + 0.4), new V(0, 1, 0));
  return {
    granite: geometryOf(granite),
    limestone: geometryOf(limestone),
    gable: geometryOf(gable),
    glow: geometryOf(glow),
    spill: geometryOf(spill),
  };
}

/* ---------------------------------------------------------------- rooms, from the inside */
export interface Room {
  name: string;
  x0: number; x1: number; z0: number; z1: number;
  /** floor at x0 and at x1 (rooms slope only along x) */
  f0: number; f1: number;
  h: number;
  /** openings: wall ("n" z0, "s" z1, "w" x0, "e" x1), span along the wall [a, b], top above the floor */
  open: { wall: "n" | "s" | "w" | "e"; a: number; b: number; top: number }[];
  granite?: boolean;
  gable?: number;
  corbel?: boolean;
}
export const ROOMS: Room[] = [
  { name: "entry", x0: -1.6, x1: 1.6, z0: 0, z1: 22, f0: 0, f1: 0, h: 3.6, open: [
    { wall: "n", a: -1.2, b: 1.2, top: 3 }, { wall: "w", a: 6, b: 9.4, top: 3 }, { wall: "e", a: 13.8, b: 17.6, top: 3.4 }, { wall: "s", a: -1.2, b: 1.2, top: 2.6 }] },
  { name: "descent", x0: -22, x1: -1.6, z0: 6, z1: 9.4, f0: -9, f1: 0, h: 3.2, open: [
    { wall: "e", a: 6, b: 9.4, top: 3 }, { wall: "w", a: 6, b: 9.4, top: 3 }] },
  { name: "pit", x0: -34, x1: -22, z0: 0, z1: 15.4, f0: -9, f1: -9, h: 5.2, open: [{ wall: "e", a: 6, b: 9.4, top: 3 }] },
  { name: "queen-passage", x0: -1.2, x1: 1.2, z0: 22, z1: 40, f0: 0, f1: 0, h: 2.6, open: [
    { wall: "n", a: -1.2, b: 1.2, top: 2.6 }, { wall: "s", a: -1.2, b: 1.2, top: 2.6 }] },
  { name: "queen", x0: -3, x1: 3, z0: 40, z1: 45.4, f0: 0, f1: 0, h: 4.6, gable: 2.3, open: [{ wall: "n", a: -1.2, b: 1.2, top: 2.6 }] },
  { name: "gallery", x0: 1.6, x1: 34, z0: 13.8, z1: 17.6, f0: 0, f1: 13, h: 8.6, corbel: true, open: [
    { wall: "w", a: 13.8, b: 17.6, top: 3.4 }, { wall: "e", a: 14.2, b: 17.2, top: 3 }] },
  { name: "ante", x0: 34, x1: 37, z0: 14.2, z1: 17.2, f0: 13, f1: 13, h: 3.6, granite: true, open: [
    { wall: "w", a: 14.2, b: 17.2, top: 3 }, { wall: "e", a: 14.2, b: 17.2, top: 3 }] },
  { name: "king", x0: 37, x1: 47.5, z0: 12.6, z1: 18.8, f0: 13, f1: 13, h: 5.8, granite: true, open: [{ wall: "w", a: 14.2, b: 17.2, top: 3 }] },
];
export const floorOf = (r: Room, x: number) => r.f0 + (r.f1 - r.f0) * THREE.MathUtils.clamp((x - r.x0) / (r.x1 - r.x0), 0, 1);
const COFFER = new V(39.6, 13, 15.7); // local, in the King's Chamber, toward its west end
const PIT = new V(-28, -9, 7.7); // the open floor of the resonating chamber
const QUEEN = new V(0, 0, 42.7);

/** Quads facing into the room (drawn from inside, so from outside they vanish: the camera sees in). */
export class Shell {
  pos: number[] = [];
  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, inward: THREE.Vector3): void {
    const n = new V().subVectors(b, a).cross(new V().subVectors(d, a));
    const [p, q, r, s] = n.dot(inward) >= 0 ? [a, b, c, d] : [a, d, c, b];
    this.pos.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z, p.x, p.y, p.z, r.x, r.y, r.z, s.x, s.y, s.z);
  }
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.computeVertexNormals();
    return g;
  }
}
function buildRoom(r: Room, sh: Shell): void {
  const f = (x: number) => floorOf(r, x);
  const P = (x: number, y: number, z: number) => new V(x, y, z);
  // floor and ceiling (in strips along x, as the floor may slope)
  const n = r.f0 === r.f1 ? 1 : Math.max(2, Math.round((r.x1 - r.x0) / 2));
  for (let i = 0; i < n; i++) {
    const a = r.x0 + ((r.x1 - r.x0) * i) / n, b = r.x0 + ((r.x1 - r.x0) * (i + 1)) / n;
    sh.quad(P(a, f(a), r.z0), P(b, f(b), r.z0), P(b, f(b), r.z1), P(a, f(a), r.z1), new V(0, 1, 0));
    if (!r.gable) {
      const inset = r.corbel ? 1.1 : 0; // the gallery's roof is narrow over its corbelled walls
      sh.quad(P(a, f(a) + r.h, r.z0 + inset), P(b, f(b) + r.h, r.z0 + inset), P(b, f(b) + r.h, r.z1 - inset), P(a, f(a) + r.h, r.z1 - inset), new V(0, -1, 0));
    }
  }
  // walls along x (north z0, south z1), with openings along x
  for (const [wall, z, inZ] of [["n", r.z0, 1], ["s", r.z1, -1]] as const) {
    const ops = r.open.filter((o) => o.wall === wall).sort((p, q) => p.a - q.a);
    let x = r.x0;
    const seg = (a: number, b: number, lo: number) => {
      if (b - a < 0.01) return;
      const m = Math.max(1, Math.round((b - a) / 2));
      for (let i = 0; i < m; i++) {
        const u = a + ((b - a) * i) / m, v = a + ((b - a) * (i + 1)) / m;
        if (r.corbel) {
          // corbelled: the wall steps inward as it rises, seven courses
          for (let k = 0; k < 7; k++) {
            const y0 = k === 0 ? lo : 2.4 + (k - 1) * 0.95, y1 = k === 6 ? r.h : 2.4 + k * 0.95, inset = k * 0.16 * inZ;
            if (y1 <= lo) continue;
            sh.quad(P(u, f(u) + Math.max(y0, lo), z + inset), P(v, f(v) + Math.max(y0, lo), z + inset), P(v, f(v) + y1, z + inset), P(u, f(u) + y1, z + inset), new V(0, 0, inZ));
            if (k < 6) sh.quad(P(u, f(u) + y1, z + inset), P(v, f(v) + y1, z + inset), P(v, f(v) + y1, z + inset + 0.16 * inZ), P(u, f(u) + y1, z + inset + 0.16 * inZ), new V(0, -1, 0));
          }
        } else sh.quad(P(u, f(u) + lo, z), P(v, f(v) + lo, z), P(v, f(v) + r.h, z), P(u, f(u) + r.h, z), new V(0, 0, inZ));
      }
    };
    for (const o of ops) {
      seg(x, o.a, 0);
      seg(o.a, o.b, o.top);
      x = o.b;
    }
    seg(x, r.x1, 0);
    // a gable's end, a triangle over the wall
    if (r.gable) {
      const mid = (r.x0 + r.x1) / 2;
      const a = P(r.x0, r.h, z), b = P(r.x1, r.h, z), c = P(mid, r.h + r.gable, z);
      const nrm = new V().subVectors(b, a).cross(new V().subVectors(c, a));
      const tri = nrm.z * inZ >= 0 ? [a, b, c] : [a, c, b];
      for (const p of tri) sh.pos.push(p.x, p.y, p.z);
    }
  }
  // walls along z (west x0, east x1), with openings along z
  for (const [wall, x, inX] of [["w", r.x0, 1], ["e", r.x1, -1]] as const) {
    const ops = r.open.filter((o) => o.wall === wall).sort((p, q) => p.a - q.a);
    const fy = f(x);
    let z = r.z0;
    const top = r.h;
    const seg = (a: number, b: number, lo: number) => {
      if (b - a < 0.01 || lo >= top) return;
      sh.quad(P(x, fy + lo, a), P(x, fy + lo, b), P(x, fy + top, b), P(x, fy + top, a), new V(inX, 0, 0));
    };
    for (const o of ops) {
      seg(z, o.a, 0);
      seg(o.a, o.b, o.top);
      z = o.b;
    }
    seg(z, r.z1, 0);
  }
  if (r.gable) {
    const mid = (r.x0 + r.x1) / 2;
    for (const [xa, inX] of [[r.x0, 1], [r.x1, -1]] as const)
      sh.quad(P(xa, r.h, r.z0), P(mid, r.h + r.gable, r.z0), P(mid, r.h + r.gable, r.z1), P(xa, r.h, r.z1), new V(inX * 0.5, -1, 0));
  }
}

/* ------------------------------------------------- dressed masonry within (the interior pass) */
/** Where a wall stands and which way it faces in: `fixed` is the wall's own coordinate (z for
    the n/s walls, x for the w/e), `alongX` whether its run runs along x. */
export interface WallRef { fixed: number; inDir: 1 | -1; alongX: boolean }
export const wallOf = (r: Room, which: "n" | "s" | "w" | "e"): WallRef =>
  which === "n" ? { fixed: r.z0, inDir: 1, alongX: true }
  : which === "s" ? { fixed: r.z1, inDir: -1, alongX: true }
  : which === "w" ? { fixed: r.x0, inDir: 1, alongX: false }
  : { fixed: r.x1, inDir: -1, alongX: false };

/** One wall's bare runs: the spans between its openings (walls from the floor) and the spans
    above them (walls from the opening's top), {a,b} along the wall, `lo` the height the wall
    starts at. The same walk buildRoom cuts the walls by. */
export function wallRuns(r: Room, which: "n" | "s" | "w" | "e"): { a: number; b: number; lo: number }[] {
  const ops = r.open.filter((o) => o.wall === which).sort((p, q) => p.a - q.a);
  const alongX = which === "n" || which === "s";
  const from = alongX ? r.x0 : r.z0, to = alongX ? r.x1 : r.z1;
  const runs: { a: number; b: number; lo: number }[] = [];
  let c = from;
  for (const o of ops) {
    if (o.a - c >= 0.01) runs.push({ a: c, b: o.a, lo: 0 });
    runs.push({ a: o.a, b: o.b, lo: o.top });
    c = o.b;
  }
  if (to - c >= 0.01) runs.push({ a: c, b: to, lo: 0 });
  return runs;
}

const DADO0 = 0.9, DADO1 = 1.7; // the dado band, and its fillet crowning it
const CORN1 = 0.42, CORN2 = 0.21; // the cornice's two steps, measured down from the ceiling
const PIER = { w: 0.85, p: 0.1, wideP: 0.16, capH: 0.22, baseH: 0.25 }; // shaft, base, cap

/** A proud band (or step) on one wall run: its face into the room, ledges where it steps
    back (`topTo`/`botTo`, the depth they step TO), end caps when its ends can be seen. */
function proudBand(sh: Shell, r: Room, wall: WallRef, run: { a: number; b: number }, y0: number, y1: number, p: number, opts: { topTo?: number; botTo?: number; caps?: boolean } = {}): void {
  if (run.b - run.a < 0.01) return;
  const off = (d: number) => wall.fixed + wall.inDir * d;
  const P = (u: number, y: number, d: number): THREE.Vector3 => (wall.alongX ? new V(u, y, off(d)) : new V(off(d), y, u));
  const fAt = (u: number) => (wall.alongX ? floorOf(r, u) : floorOf(r, wall.fixed));
  const inward = wall.alongX ? new V(0, 0, wall.inDir) : new V(wall.inDir, 0, 0);
  const fa = fAt(run.a), fb = fAt(run.b);
  sh.quad(P(run.a, fa + y0, p), P(run.b, fb + y0, p), P(run.b, fb + y1, p), P(run.a, fa + y1, p), inward);
  if (opts.topTo !== undefined && opts.topTo < p)
    sh.quad(P(run.a, fa + y1, p), P(run.b, fb + y1, p), P(run.b, fb + y1, opts.topTo), P(run.a, fa + y1, opts.topTo), new V(0, 1, 0));
  if (opts.botTo !== undefined && opts.botTo < p)
    sh.quad(P(run.a, fa + y0, opts.botTo), P(run.b, fb + y0, opts.botTo), P(run.b, fb + y0, p), P(run.a, fa + y0, p), new V(0, -1, 0));
  if (opts.caps)
    for (const [u, dir] of [[run.a, 1], [run.b, -1]] as const) {
      const along = wall.alongX ? new V(dir, 0, 0) : new V(0, 0, dir);
      const fu = fAt(u); // the cap stands on its own end's floor (rooms slope along x)
      sh.quad(P(u, fu + y0, 0), P(u, fu + y1, 0), P(u, fu + y1, p), P(u, fu + y0, p), along);
    }
}

/** An engaged pier on one wall: base and cap cut wider than the shaft (Tuscan, in stone). */
function pier(sh: Shell, r: Room, wall: WallRef, centre: number): void {
  const h = r.h;
  const run = { a: centre - PIER.w / 2, b: centre + PIER.w / 2 };
  proudBand(sh, r, wall, run, DADO1, DADO1 + PIER.baseH, PIER.wideP, { topTo: PIER.p, caps: true });
  proudBand(sh, r, wall, run, DADO1 + PIER.baseH, h - CORN1 - PIER.capH, PIER.p, { caps: true });
  proudBand(sh, r, wall, run, h - CORN1 - PIER.capH, h - CORN1, PIER.wideP, { botTo: PIER.p, caps: true });
}

/** Piers stand in the long rooms, evenly spaced, none where an opening cuts the wall. */
export function pierSpots(r: Room, which: "n" | "s" | "w" | "e"): number[] {
  const alongX = which === "n" || which === "s";
  const L = alongX ? r.x1 - r.x0 : r.z1 - r.z0;
  if (r.corbel || r.gable || L < 7 || Math.min(r.x1 - r.x0, r.z1 - r.z0) < 4.5) return [];
  const out: number[] = [];
  for (const run of wallRuns(r, which)) {
    if (run.lo > 0 || run.b - run.a < 7) continue; // only bare walls from the floor
    const m = 1.0, n = Math.max(2, Math.round((run.b - run.a) / 4.2));
    for (let i = 0; i < n; i++) {
      const c = run.a + m + ((i + 0.5) * (run.b - run.a - 2 * m)) / n;
      if (c - PIER.w / 2 > run.a + 0.3 && c + PIER.w / 2 < run.b - 0.3) out.push(c);
    }
  }
  return out;
}

/** The interior dressing (the interior pass): dressed stone laid proud of every wall — a
    plinth at its foot, a dado band with its fillet, a two-step cornice at its top, piers in
    the long chambers, benches along the gallery, a false door in the Queen's. All of it
    stands inside the room's bounds; nothing floats, nothing blocks an opening. Pure
    geometry, so the tests can hold it to that. */
export function dressRoom(r: Room, trim: Shell): void {
  for (const which of ["n", "s", "w", "e"] as const) {
    const wall = wallOf(r, which);
    for (const run of wallRuns(r, which)) {
      if (run.lo === 0) {
        proudBand(trim, r, wall, run, 0, 0.28, 0.09); // the plinth
        proudBand(trim, r, wall, run, DADO0, DADO1, 0.06); // the dado
        proudBand(trim, r, wall, run, DADO1, DADO1 + 0.08, 0.1, { botTo: 0.06 }); // its fillet
      }
      if (!r.corbel && run.lo < r.h - CORN1) {
        proudBand(trim, r, wall, run, r.h - CORN1, r.h - CORN2, 0.18, { topTo: 0.09, caps: true });
        proudBand(trim, r, wall, run, r.h - CORN2, r.h, 0.09, { topTo: 0, caps: true });
      }
    }
    for (const c of pierSpots(r, which)) pier(trim, r, wall, c);
  }
  if (r.corbel) {
    // the gallery's benches, low on each wall, clear of the doorways at both ends
    for (const which of ["n", "s"] as const) {
      const wall = wallOf(r, which);
      const a = 3.5, b = 32.5, d = 0.7, bh = 0.55;
      const off = (dd: number) => wall.fixed + wall.inDir * dd;
      const inward = new V(0, 0, wall.inDir);
      trim.quad(new V(a, floorOf(r, a) + bh, off(d)), new V(b, floorOf(r, b) + bh, off(d)), new V(b, floorOf(r, b) + bh, off(0)), new V(a, floorOf(r, a) + bh, off(0)), new V(0, 1, 0));
      trim.quad(new V(a, floorOf(r, a), off(d)), new V(b, floorOf(r, b), off(d)), new V(b, floorOf(r, b) + bh, off(d)), new V(a, floorOf(r, a) + bh, off(d)), inward);
      for (const [u, dir] of [[a, -1], [b, 1]] as const)
        trim.quad(new V(u, floorOf(r, u), off(0)), new V(u, floorOf(r, u) + bh, off(0)), new V(u, floorOf(r, u) + bh, off(d)), new V(u, floorOf(r, u), off(d)), new V(dir, 0, 0));
    }
  }
  if (r.name === "queen") {
    // the false door on the east wall: jambs, lintel, panel — the place of initiation
    const wall = wallOf(r, "e");
    const off = (d: number) => wall.fixed + wall.inDir * d;
    const inward = new V(wall.inDir, 0, 0);
    const P = (z: number, y: number, d: number) => new V(off(d), y, z);
    for (const zj of [41.95, 43.27])
      trim.quad(P(zj, 0, 0.1), P(zj + 0.18, 0, 0.1), P(zj + 0.18, 2.4, 0.1), P(zj, 2.4, 0.1), inward);
    trim.quad(P(41.95, 2.4, 0.14), P(43.45, 2.4, 0.14), P(43.45, 2.7, 0.14), P(41.95, 2.7, 0.14), inward);
    trim.quad(P(42.13, 0, 0.06), P(43.27, 0, 0.06), P(43.27, 2.4, 0.06), P(42.13, 2.4, 0.06), inward);
    // blind panels on the west wall, dressed but unopened
    const west = wallOf(r, "w");
    const Pin = (z: number, y: number, d: number) => new V(west.fixed + west.inDir * d, y, z);
    const win = new V(west.inDir, 0, 0);
    for (const z0 of [41.0, 43.0])
      trim.quad(Pin(z0, 0.9, 0.05), Pin(z0 + 1.4, 0.9, 0.05), Pin(z0 + 1.4, 2.7, 0.05), Pin(z0, 2.7, 0.05), win);
  }
}

/** The braziers: where they stand (pyramid-local; `light` their point light's strength, 0
    for flame only), the gallery's standing on its benches. */
export function brazierSpots(): { x: number; y: number; z: number; light: number }[] {
  const gal = ROOMS.find((r) => r.name === "gallery");
  const benchY = (x: number) => (gal ? floorOf(gal, x) + 0.55 : 0);
  return [
    { x: -1.02, y: 0, z: 4.6, light: 4.5 }, // the entry, flanking the mouth
    { x: 1.02, y: 0, z: 4.6, light: 4.5 },
    { x: 0, y: 0, z: 24.5, light: 3.5 }, // the junction where the ways part
    { x: -25.9, y: -9, z: 5.0, light: 7 }, // the resonating chamber
    { x: -30.1, y: -9, z: 10.4, light: 7 },
    { x: -2.35, y: 0, z: 41.0, light: 4.5 }, // the Queen's, flanking the seat
    { x: 2.35, y: 0, z: 41.0, light: 4.5 },
    { x: 10, y: benchY(10), z: 14.15, light: 0 }, // on the gallery's benches, flame only
    { x: 24, y: benchY(24), z: 17.25, light: 0 },
  ];
}

/** The shafts of light falling from above (pyramid-local): a tapered prism from its top
    rectangle to its floor rectangle, `a` its brightness. */
export const SHAFTS: { room: string; top: [number, number, number]; bot: [number, number, number]; tw: number; td: number; bw: number; bd: number; a: number }[] = [
  { room: "entry", top: [0, 3.6, 6.5], bot: [0, 0, 7.7], tw: 1.1, td: 1.9, bw: 1.5, bd: 2.3, a: 0.1 },
  { room: "queen", top: [0, 5.5, 42.7], bot: [0, 0, 42.7], tw: 0.45, td: 0.45, bw: 0.85, bd: 0.85, a: 0.085 },
];

/** Several small geometries as one (the braziers' bronze in two draws, not twenty). */
function mergedGeoms(gs: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [];
  for (const g0 of gs) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    const p = g.getAttribute("position").array as ArrayLike<number>;
    const n = g.getAttribute("normal").array as ArrayLike<number>;
    for (let i = 0; i < p.length; i++) pos.push(p[i]);
    for (let i = 0; i < n.length; i++) nor.push(n[i]);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  return out;
}

/** A brazier's flame: the apex flame's teardrop, small, each bowl keeping its own time —
    the phase is read from where it stands, so one material serves them all. */
function brazierFlame(uT: N): THREE.SpriteNodeMaterial {
  const m = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, fog: false });
  const p = uv().sub(vec2(0.5, 0.0)).mul(vec2(2, 1));
  const pw = T.positionWorld;
  const ph = pw.x.mul(7.31).add(pw.z.mul(3.17));
  const flick = sin(uT.mul(6.3).add(ph)).mul(0.06).add(sin(uT.mul(13.1).add(ph.mul(1.7))).mul(0.04));
  const width = T.max(float(0.03), float(1).sub(p.y).mul(p.y.mul(3.4).min(1)).mul(0.5));
  const k = smoothstep(width, width.mul(0.15), abs(p.x.add(flick.mul(p.y)))).mul(smoothstep(0, 0.08, p.y)).mul(smoothstep(1, 0.55, p.y));
  const core = smoothstep(width.mul(0.5), 0, abs(p.x)).mul(smoothstep(0.5, 0.05, p.y));
  m.colorNode = vec4(vec3(1.0, 0.62, 0.28).mul(k.mul(0.55)).add(vec3(1.0, 0.9, 0.72).mul(core.mul(0.6))), 1);
  return m;
}

/** A brazier's coals: the bed of the bowl breathing its own slow pulse. */
function brazierCoals(uT: N): THREE.MeshBasicNodeMaterial {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, fog: false });
  const p = uv().sub(0.5).mul(2);
  const r = T.length(p);
  const pw = T.positionWorld;
  const breath = sin(uT.mul(2.1).add(pw.x.mul(7.31).add(pw.z.mul(3.17)))).mul(0.5).add(0.5);
  m.colorNode = vec4(vec3(1.0, 0.5, 0.2).mul(smoothstep(1, 0.2, r).mul(0.45).add(smoothstep(1, 0.1, r).mul(breath.mul(0.3)))), 1);
  return m;
}

/** A shaft of light: brightness falls with its depth, its edges soften away, its whole
    breathes. Additive, so it lies over the stone like light and not like glass. */
function beamMat(uT: N, a: number): THREE.MeshBasicNodeMaterial {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, side: THREE.DoubleSide, fog: false });
  const p = uv();
  const edge = smoothstep(0.5, 0.06, abs(p.x.sub(0.5)).mul(2));
  const fall = T.mix(float(0.3), float(1), p.y);
  const breath = sin(uT.mul(0.4)).mul(0.5).add(0.5).mul(0.16).add(0.84);
  m.colorNode = vec4(vec3(1.0, 0.88, 0.66).mul(edge.mul(fall).mul(breath).mul(a)), 1);
  return m;
}

function lightShaft(uT: N, s: (typeof SHAFTS)[number]): THREE.Mesh {
  const [tx, ty, tz] = s.top, [bx, by, bz] = s.bot;
  const pos: number[] = [], uvs: number[] = [];
  const quad = (t0: number[], t1: number[], b1: number[], b0: number[]) => {
    pos.push(...t0, ...t1, ...b1, ...t0, ...b1, ...b0);
    uvs.push(0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0);
  };
  const hw0 = s.tw / 2, hd0 = s.td / 2, hw1 = s.bw / 2, hd1 = s.bd / 2;
  quad([tx - hw0, ty, tz - hd0], [tx + hw0, ty, tz - hd0], [bx + hw1, by, bz - hd1], [bx - hw1, by, bz - hd1]);
  quad([tx + hw0, ty, tz + hd0], [tx - hw0, ty, tz + hd0], [bx - hw1, by, bz + hd1], [bx + hw1, by, bz + hd1]);
  quad([tx - hw0, ty, tz + hd0], [tx - hw0, ty, tz - hd0], [bx - hw1, by, bz - hd1], [bx - hw1, by, bz + hd1]);
  quad([tx + hw0, ty, tz - hd0], [tx + hw0, ty, tz + hd0], [bx + hw1, by, bz + hd1], [bx + hw1, by, bz - hd1]);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  return new THREE.Mesh(g, beamMat(uT, s.a));
}

/* ---------------------------------------------------------------- the pyramid */
export type Chamber = "none" | "entry" | "pit" | "queen" | "gallery" | "king";

export class Pyramid {
  /** Outside, in the world. */
  world = new THREE.Group();
  /** Inside, beyond the world's edge. */
  inside = new THREE.Group();
  isInside = false;
  readonly door = new THREE.Vector3(); // the entrance, outside (world)
  readonly apex = new THREE.Vector3();
  private uT = uniform(0);
  private uFlame = uniform(0.6);
  private motes!: { pos: THREE.InstancedBufferAttribute; seed: Float32Array };
  private gallery!: { pos: THREE.InstancedBufferAttribute; seed: Float32Array };
  private uPit = uniform(0);
  private uCrystal = uniform(0);
  private local = new THREE.Vector3();
  /** The braziers' lights, each with its own phase and strength, flickered in update. */
  private braziers: { l: THREE.PointLight; ph: number; k: number }[] = [];
  /** The seven colours of the King's Chamber, lit one by one on the wanderer (main.ts). */
  seven: THREE.Sprite[] = [];
  uDoor = T.uniform(0);
  doorFound: boolean = false;
  whisperTimer: number = 0;
  doorPos: THREE.Vector3 = new THREE.Vector3(-34, -7.4, 7.7);
  playerPos: THREE.Vector3 | null = null;
  doorSlab: THREE.Mesh | null = null;
  roomsGroup: THREE.Group = new THREE.Group();
  /** The Duat (duat.ts), in its own group: child of `inside`, shown with the interior. */
  duat: THREE.Group = new THREE.Group();
  private night!: Duat;
  /** Its way (Duat-local): the hidden door, the six hours, the dawn (main.ts reads it). */
  readonly PATH = DUAT_PATH;
  private lastT = 0;
  duatActive = false;

  inDuat(p: THREE.Vector3): boolean {
    const dx = p.x - DUAT_ORIGIN.x, dy = p.y - DUAT_ORIGIN.y, dz = p.z - DUAT_ORIGIN.z;
    return dx * dx + dy * dy + dz * dz < 55 * 55;
  }

  shouldEnterDuat(): boolean {
    if (this.duatActive) return false;
    const p = this.playerPos, d = this.doorPos, u = this.uDoor;
    if (!p || !d || !u || !(u.value > 0.7)) return false;
    const wx = p.x - (PYR_ORIGIN.x + d.x);
    const wy = p.y - (PYR_ORIGIN.y + d.y);
    const wz = p.z - (PYR_ORIGIN.z + d.z);
    return wx * wx + wy * wy + wz * wz < 2.5 * 2.5;
  }

  duatEntryPoint(): THREE.Vector3 {
    const q = this.PATH[0] ?? new THREE.Vector3();
    return new THREE.Vector3(
      DUAT_ORIGIN.x + q.x,
      DUAT_ORIGIN.y + q.y + 1.0,
      DUAT_ORIGIN.z + q.z
    );
  }

  exitDuatPoint(): THREE.Vector3 {
    const d = this.doorPos ?? new THREE.Vector3();
    return new THREE.Vector3(
      PYR_ORIGIN.x + d.x,
      PYR_ORIGIN.y + d.y + 1.0,
      PYR_ORIGIN.z + d.z + 2.0
    );
  }
  private say(text: string, ms: number): void {
    const w = document.querySelector("#whisper") as HTMLElement | null;
    if (!w) return;
    w.textContent = text;
    w.classList.add("on");
    window.clearTimeout(this.whisperTimer);
    this.whisperTimer = window.setTimeout(() => w.classList.remove("on"), ms);
  }

  private buildHiddenDoor(): void {
    // Station 0 — the threshold to the Duat: a seam of light in the west wall of the pit.
    const glowMat = new THREE.MeshBasicNodeMaterial({
      color: 0xffd700,
      transparent: true,
      fog: false,
      depthWrite: false,
    });
    glowMat.blending = THREE.CustomBlending;
    glowMat.blendSrc = THREE.SrcAlphaFactor;
    glowMat.blendDst = THREE.OneFactor;
    glowMat.blendSrcAlpha = THREE.ZeroFactor;
    glowMat.blendDstAlpha = THREE.OneFactor;

    const duv = T.uv();
    const x01 = T.abs(duv.x.sub(0.5)).mul(2.0);
    const y01 = T.abs(duv.y.sub(0.5)).mul(2.0);
    const prof = T.float(1).sub(x01.mul(0.45));
    const yProf = T.float(1).sub(y01.mul(y01).mul(0.35));
    const breath = T.sin(this.uT.mul(0.5)).mul(0.12).add(0.88);
    const open = this.uDoor.mul(0.55).add(0.62);
    const k = prof.mul(yProf).mul(breath).mul(open);
    glowMat.colorNode = T.vec4(T.vec3(1.0, 0.78, 0.45).mul(k), 1);

    const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 3.6), glowMat);
    glow.position.set(-33.98, -7.4, 7.7);
    glow.rotation.y = Math.PI / 2;
    glow.renderOrder = 3;
    glow.frustumCulled = false;

    const slabMat = new THREE.MeshStandardNodeMaterial({
      color: 0x1c1a2c,
      roughness: 0.78,
      metalness: 0.05,
    });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3.2, 2.35), slabMat);
    slab.position.set(-33.55, -7.4, 7.7);
    slab.castShadow = true;
    slab.receiveShadow = true;

    this.doorSlab = slab;
    this.inside.add(glow, slab);
  }


  constructor() {
    this.buildOutside();
    this.buildInside();
    this.inside.visible = false;
  }

  private buildOutside(): void {
    const { x, y, z, half: H, height: Ht } = PYRAMID;
    this.world.position.set(x, y, z);
    this.apex.set(x, y + Ht, z);
    const capK = 0.9; // the capstone: the top tenth
    const at = (k: number) => ({ h: Ht * k, r: H * (1 - k) });
    const faces = (k0: number, k1: number, skipNorth = false) => {
      const a = at(k0), b = at(k1);
      const pos: number[] = [];
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (let i = 0; i < 4; i++) {
        if (skipNorth && i === 0) continue; // the north face carries the entrance mouth (below)
        const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4];
        const p0 = [ax * a.r, a.h, az * a.r], p1 = [bx * a.r, a.h, bz * a.r], p2 = [bx * b.r, b.h, bz * b.r], p3 = [ax * b.r, b.h, az * b.r];
        // outward winding: corners run clockwise seen from above (−z to +x), so this faces out
        pos.push(...p0, ...p2, ...p1, ...p0, ...p3, ...p2);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      return g;
    };
    const limeM = limestone(this.uT, [1.45, 1.4, 1.3], 1, 3.2);
    const casing = new THREE.Mesh(faces(0, capK, true), limeM);
    casing.receiveShadow = casing.castShadow = true;
    // the north face, its mouth cut open — the entrance's own geometry fills the cut
    const north = new THREE.Mesh(northFaceGeometry(H, Ht, Ht * capK), limeM);
    north.receiveShadow = north.castShadow = true;
    const cap = new THREE.Mesh(faces(capK, 0.9999), granite(this.uT));
    cap.castShadow = true;
    this.world.add(casing, north, cap);
    // the entrance (item 6): a proud granite rim round a mouth cut into the masonry, the
    // passage receding to a dark end where the chamber's own light breathes, a limestone
    // gable shedding the sky over it, and the open door's light lying on the sand
    const eg = entranceGeometry(H, Ht);
    const rim = new THREE.Mesh(eg.granite, granite(this.uT));
    rim.castShadow = rim.receiveShadow = true;
    const reveals = new THREE.Mesh(eg.limestone, limeM); // the same dressed stone as the casing
    reveals.castShadow = reveals.receiveShadow = true;
    // the gable, its own deeper dressed stone at its own block scale (the casing's triplanar
    // is world-space: at the same tile the gable would clone the wall behind it and vanish —
    // a pediment must read as a piece set before the face, shading the mouth)
    const gable = new THREE.Mesh(eg.gable, limestone(this.uT, [1.02, 0.96, 0.85], 0.5, 3.9));
    gable.castShadow = gable.receiveShadow = true;
    const dark = new THREE.Mesh(eg.glow, (() => {
      const m = new THREE.MeshBasicNodeMaterial({ fog: true });
      const pc = T.positionGeometry;
      const breath = sin(this.uT.mul(0.5)).mul(0.12).add(0.88); // the chamber's slow breath
      const ember = smoothstep(1.15, 0.05, length(vec2(pc.x, pc.y.sub(0.9).mul(0.72))));
      m.colorNode = vec4(mix(vec3(0.014, 0.01, 0.008), vec3(1.0, 0.6, 0.28), ember.mul(breath).mul(0.5)), 1);
      return m;
    })());
    const spill = new THREE.Mesh(eg.spill, (() => {
      const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, side: THREE.DoubleSide, fog: false });
      const ps = T.positionGeometry;
      const breath = sin(this.uT.mul(0.5)).mul(0.12).add(0.88);
      const pool = smoothstep(1.0, 0.1, length(vec2(ps.x.mul(0.16), ps.z.add(H + ENTRANCE_PROUD + 3.1).mul(0.21))));
      m.colorNode = vec4(vec3(1.0, 0.7, 0.36).mul(pool.mul(breath).mul(0.34)), 1);
      return m;
    })());
    this.world.add(rim, reveals, gable, dark, spill);
    this.door.set(x, y, z - H + 0.4); // the mouth's threshold: the rim front stands just north of it
    // the third spiral: from the apex, like a candle flame (58.24); soft and contained
    const fm = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, fog: false });
    {
      const p = uv().sub(vec2(0.5, 0.0)).mul(vec2(2, 1));
      const flick = sin(this.uT.mul(1.3)).mul(0.04).add(sin(this.uT.mul(2.9)).mul(0.03));
      // a teardrop: wide at its root, drawn to a point above
      const width = T.max(float(0.02), float(1).sub(p.y).mul(p.y.mul(3.2).min(1)).mul(0.9));
      const k = smoothstep(width, width.mul(0.2), abs(p.x.add(flick.mul(p.y)))).mul(smoothstep(0, 0.06, p.y)).mul(smoothstep(1, 0.6, p.y));
      const core = smoothstep(width.mul(0.5), 0, abs(p.x)).mul(smoothstep(0.55, 0.05, p.y));
      fm.colorNode = vec4(vec3(1.0, 0.78, 0.45).mul(k.mul(0.35)).add(vec3(1.0, 0.95, 0.85).mul(core.mul(0.4))).mul(this.uFlame), 1);
    }
    const flame = new THREE.Sprite(fm);
    flame.center.set(0.5, 0); // it rises from the apex
    flame.scale.set(5, 16, 1);
    flame.position.set(0, Ht - 0.3, 0);
    this.world.add(flame);
    // light drawn in at the base and spiralling up the faces to the apex, as water into a funnel
    const N = 280;
    const seed = new Float32Array(N * 3);
    for (let i = 0; i < N * 3; i++) seed[i] = Math.random();
    const pts = worldPoints(new Float32Array(N * 3), { color: new THREE.Color(1.0, 0.86, 0.6), size: 0.22, opacity: 0.7 });
    this.world.add(pts.sprite);
    pts.sprite.frustumCulled = false;
    this.motes = { pos: pts.position, seed };
  }

  private buildInside(): void {
    this.inside.position.copy(PYR_ORIGIN);
    const lime = new Shell(), gran = new Shell(), limeT = new Shell(), granT = new Shell();
    for (const r of ROOMS) {
      buildRoom(r, r.granite ? gran : lime);
      dressRoom(r, r.granite ? granT : limeT);
    }
    const limeM = lining(this.uT, [1.25, 1.2, 1.1], 1.4);
    limeM.side = THREE.FrontSide;
    // the King's Chamber glows when its rite wakes, its light reaching down the gallery
    const awake = vec3(1.0, 0.58, 0.3).mul(T.smoothstep(16, 5, T.distance(T.positionWorld, vec3(50039.6, 27, 15.7))).mul(this.uCrystal.mul(0.5).add(0.06)));
    this.roomsGroup = new THREE.Group();
    this.roomsGroup.add(
      new THREE.Mesh(lime.geometry(), limeM),
      new THREE.Mesh(gran.geometry(), lining(this.uT, [0.66, 0.42, 0.4], 0.45, { fleck: true, awake })),
      new THREE.Mesh(limeT.geometry(), lining(this.uT, [1.08, 1.02, 0.9], 1.1)),
      new THREE.Mesh(granT.geometry(), lining(this.uT, [0.5, 0.32, 0.3], 0.4, { fleck: true }))
    );
    this.inside.add(this.roomsGroup);
    // the coffer: a lidless box of rose granite, cut in the same dressed courses as its walls
    const gm = lining(this.uT, [0.66, 0.42, 0.4], 0.45, { fleck: true });
    const box = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), gm);
      m.position.set(x, y, z);
      this.inside.add(m);
    };
    const C = COFFER;
    box(2.3, 0.15, 1.0, C.x, C.y + 0.075, C.z);
    for (const s of [-1, 1]) box(2.3, 1.05, 0.15, C.x, C.y + 0.52, C.z + s * 0.43);
    for (const s of [-1, 1]) box(0.15, 1.05, 0.72, C.x + s * 1.075, C.y + 0.52, C.z);
    // the crystal over the place of healing, brighter as its rite wakes
    const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), crystalGlow(this.uT, this.uCrystal));
    cr.scale.set(1, 2, 1);
    cr.position.set(C.x, C.y + 3.4, C.z);
    this.inside.add(cr);
    // the pit: the resonating chamber's open floor, light far below
    const pm = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, fog: false });
    {
      const p = uv().sub(0.5).mul(2), r = T.length(p);
      const rings = sin(r.mul(22).sub(this.uT.mul(1.2))).mul(0.5).add(0.5);
      pm.colorNode = vec4(vec3(0.95, 0.7, 0.42).mul(smoothstep(1, 0.1, r).mul(rings.mul(0.4).add(0.3)).mul(this.uPit.mul(0.8).add(0.25))), 1);
    }
    const pit = new THREE.Mesh(new THREE.CircleGeometry(1.7, 40), pm);
    pit.rotation.x = -Math.PI / 2;
    pit.position.set(PIT.x, PIT.y + 0.03, PIT.z);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.14, 8, 40), limeM);
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(PIT.x, PIT.y + 0.05, PIT.z);
    this.inside.add(pit, rim);
    // braziers: bronze bowls of living fire, each flame keeping its own time, phased by where
    // it stands; the deep rooms' pair carry the light, the gallery's are flame alone
    const flameM = brazierFlame(this.uT);
    const coalM = brazierCoals(this.uT);
    const bronzeM = new THREE.MeshStandardNodeMaterial({ color: 0x241b14, roughness: 0.55, metalness: 0.5 });
    const stems: THREE.BufferGeometry[] = [], bowls: THREE.BufferGeometry[] = [], beds: THREE.BufferGeometry[] = [];
    for (const s of brazierSpots()) {
      const stem = new THREE.CylinderGeometry(0.05, 0.08, 0.82, 10);
      stem.translate(s.x, s.y + 0.41, s.z);
      const bowl = new THREE.CylinderGeometry(0.3, 0.15, 0.26, 12);
      bowl.translate(s.x, s.y + 0.95, s.z);
      const bed = new THREE.CircleGeometry(0.17, 12);
      bed.rotateX(-Math.PI / 2);
      bed.translate(s.x, s.y + 1.05, s.z);
      stems.push(stem);
      bowls.push(bowl);
      beds.push(bed);
      const fl = new THREE.Sprite(flameM);
      fl.center.set(0.5, 0);
      fl.scale.set(0.55, 0.95, 1);
      fl.position.set(s.x, s.y + 1.1, s.z);
      this.inside.add(fl);
      if (s.light > 0) {
        const l = new THREE.PointLight(0xffb870, s.light, 22, 1.6);
        l.position.set(s.x, s.y + 1.7, s.z);
        this.inside.add(l);
        this.braziers.push({ l, ph: (s.x * 7.31 + s.z * 3.17) % 6.283, k: s.light });
      }
    }
    this.inside.add(new THREE.Mesh(mergedGeoms([...stems, ...bowls]), bronzeM), new THREE.Mesh(mergedGeoms(beds), coalM));
    // shafts of light falling from above, and the King's light spilling at the gallery's head
    for (const s of SHAFTS) this.inside.add(lightShaft(this.uT, s));
    const gm2 = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, side: THREE.DoubleSide, fog: false });
    {
      const p = uv();
      const edge = smoothstep(0.5, 0.1, abs(p.x.sub(0.5)).mul(2));
      const breath = sin(this.uT.mul(0.7)).mul(0.5).add(0.5).mul(0.2).add(0.8);
      gm2.colorNode = vec4(vec3(1.0, 0.72, 0.42).mul(edge.mul(breath).mul(this.uCrystal.mul(0.2).add(0.05))), 1);
    }
    const gq = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.9), gm2);
    gq.rotation.y = -Math.PI / 2;
    gq.position.set(33.92, 13 + 1.45, 15.7);
    this.inside.add(gq);
    // light inside: dim, warm, a little — the braziers carry the rooms, the King's keeps its own
    const hemi = new THREE.HemisphereLight(0xffe2c0, 0x201810, 0.35);
    this.inside.add(hemi);
    for (const [x, y, z, k] of [[18, 11, 15.7, 12], [42, 17.4, 15.7, 13]] as const) {
      const l = new THREE.PointLight(0xffc88a, k, 22, 1.6);
      l.position.set(x, y, z);
      this.inside.add(l);
    }
    // motes rising along the gallery (light spiralling upward), and around the coffer
    const N = 160;
    const seed = new Float32Array(N * 3);
    for (let i = 0; i < N * 3; i++) seed[i] = Math.random();
    const g = worldPoints(new Float32Array(N * 3), { color: new THREE.Color(1.0, 0.85, 0.6), size: 0.06, opacity: 0.7 });
    g.sprite.frustumCulled = false;
    this.inside.add(g.sprite);
    this.gallery = { pos: g.position, seed };
    // the seven colours, lit on the wanderer in the King's Chamber (placed by main.ts)
    const cols = [0xff3a2e, 0xff8a24, 0xffd83a, 0x4fe07a, 0x3aa8ff, 0x5a4dff, 0xb45cff];
    for (const c of cols) {
      const m = new THREE.SpriteMaterial({ color: c, transparent: true, opacity: 0, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, depthWrite: false, depthTest: false, map: dotTexture() });
      const s = new THREE.Sprite(m);
      s.scale.setScalar(0.5);
      s.renderOrder = 20;
      s.visible = false;
      this.seven.push(s);
    }
    this.buildHiddenDoor();
    // the Duat: its own place below the pyramid (duat.ts)
    this.night = new Duat((text, ms) => this.say(text, ms));
    this.duat.position.copy(DUAT_ORIGIN).sub(PYR_ORIGIN);
    this.duat.add(this.night.group);
    this.inside.add(this.duat);
  
  }

  /** Which chamber a point inside is in. */
  chamber(p: THREE.Vector3): Chamber {
    const l = this.local.copy(p).sub(PYR_ORIGIN);
        if (this.inDuat(p)) return "none";
    for (const r of ROOMS)
      if (l.x >= r.x0 - 0.01 && l.x <= r.x1 + 0.01 && l.z >= r.z0 - 0.01 && l.z <= r.z1 + 0.01)
        return r.name === "king" || r.name === "ante" ? "king" : r.name === "queen" || r.name === "queen-passage" ? "queen" : r.name === "pit" || r.name === "descent" ? "pit" : r.name === "gallery" ? "gallery" : "entry";
    return "none";
  }
  /** Where the wanderer is in the healing place, the initiation place, or at the pit. */
  inCoffer(p: THREE.Vector3): boolean {
    const l = this.local.copy(p).sub(PYR_ORIGIN);
    return Math.abs(l.x - COFFER.x) < 1.6 && Math.abs(l.z - COFFER.z) < 1.2;
  }
  atQueenCentre(p: THREE.Vector3): boolean {
    const l = this.local.copy(p).sub(PYR_ORIGIN);
    return Math.hypot(l.x - QUEEN.x, l.z - QUEEN.z) < 1.8;
  }
  nearPit(p: THREE.Vector3): number {
    const l = this.local.copy(p).sub(PYR_ORIGIN);
    return THREE.MathUtils.smoothstep(6, 1.5, Math.hypot(l.x - PIT.x, l.z - PIT.z)) * (l.x < -20 ? 1 : 0);
  }
  cofferTop(): THREE.Vector3 {
    return COFFER.clone().add(PYR_ORIGIN);
  }

  /** The floor inside. */
  floorAt(x: number, z: number): number {
    const lx = x - PYR_ORIGIN.x, lz = z - PYR_ORIGIN.z;
    const dx = x - DUAT_ORIGIN.x, dz = z - DUAT_ORIGIN.z;
    if (dx * dx + dz * dz < 55 * 55) return DUAT_ORIGIN.y + duatHeight(dx, dz);
    let best: Room | null = null, bd = Infinity;
    for (const r of ROOMS) {
      const dx = Math.max(r.x0 - lx, 0, lx - r.x1), dz = Math.max(r.z0 - lz, 0, lz - r.z1);
      const d = Math.hypot(dx, dz);
      if (d < bd) {
        bd = d;
        best = r;
      }
    }
    return PYR_ORIGIN.y + (best ? floorOf(best, lx) : 0);
  }

  /** Keep the wanderer within the rooms; true when they walk out of the entrance. */
  confine(p: THREE.Vector3): boolean {
    const l = this.local.copy(p).sub(PYR_ORIGIN);
        if (this.inDuat(p)) {
          const dx = p.x - DUAT_ORIGIN.x, dz = p.z - DUAT_ORIGIN.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (Number.isFinite(dist) && dist > 50) {
            const s = 50 / dist;
            p.x = DUAT_ORIGIN.x + dx * s;
            p.z = DUAT_ORIGIN.z + dz * s;
          }
          return false;
        }
    if (l.z < -0.2 && Math.abs(l.x) < 1.4) return true;
    const m = 0.35;
    let inside = false;
    for (const r of ROOMS) if (l.x >= r.x0 + m - 0.4 && l.x <= r.x1 - m + 0.4 && l.z >= r.z0 + m - 0.4 && l.z <= r.z1 - m + 0.4) inside = true;
    if (!inside) {
      // back to the nearest point of the nearest room
      let bx = l.x, bz = l.z, bd = Infinity;
      for (const r of ROOMS) {
        const cx = THREE.MathUtils.clamp(l.x, r.x0 + m, r.x1 - m), cz = THREE.MathUtils.clamp(l.z, r.z0 + m, r.z1 - m);
        const d = Math.hypot(cx - l.x, cz - l.z);
        if (d < bd) {
          bd = d;
          bx = cx;
          bz = cz;
        }
      }
      l.x = bx;
      l.z = bz;
    }
    p.copy(l).add(PYR_ORIGIN);
    return false;
  }

  /** Coming in: just inside the entrance, facing the passage. */
  entry(): { x: number; z: number; heading: number } {
    return { x: PYR_ORIGIN.x, z: PYR_ORIGIN.z + 2.5, heading: Math.PI };
  }
  /** Going out: before the entrance, facing away from it (north). */
  outside(): { x: number; z: number; heading: number } {
    return { x: this.door.x, z: this.door.z - 4, heading: 0 };
  }
  /** At the entrance, outside: within the mouth's own width, at its threshold. */
  atDoor(p: THREE.Vector3): boolean {
    return Math.abs(p.x - this.door.x) < 1.25 && p.z > this.door.z - 1.2 && p.z < this.door.z + 2.2 && p.y < PYRAMID.y + 4;
  }
  /** Near the apex, outside. */
  atApex(p: THREE.Vector3): boolean {
    return p.distanceTo(this.apex) < 6;
  }

  show(inside: boolean): void {
    this.isInside = inside;
    this.inside.visible = inside;
  }

  /** Each frame. `pit`, `crystal`: 0–1 how awake the pit's light and the crystal are. */
  update(t: number, near: boolean, pit: number, crystal: number, flame: number, reduced: boolean): void {
    this.uT.value = reduced ? t * 0.4 : t;
    if (this.isInside && !this.doorFound && this.playerPos) {
      const dx = this.playerPos.x - (this.doorPos.x + PYR_ORIGIN.x);
      const dy = this.playerPos.y - (this.doorPos.y + PYR_ORIGIN.y);
      const dz = this.playerPos.z - (this.doorPos.z + PYR_ORIGIN.z);
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < 3.5) {
        this.say("A door into the Duat.", 5000);
        this.doorFound = true;
      }
    }
    this.uDoor.value += ((this.doorFound ? 1 : 0) - this.uDoor.value) * 0.04;
    if (this.doorSlab) this.doorSlab.position.y = this.doorPos.y + this.uDoor.value * 2.2;

    // in the Duat the rooms rest (none of their quads may float in its sky), and the Duat only there
    const inDuatSpace = this.duatActive || (!!this.playerPos && this.inDuat(this.playerPos));
    this.roomsGroup.visible = !inDuatSpace;
    this.duat.visible = inDuatSpace;
    const dt = Math.min(0.1, Math.max(0, t - this.lastT));
    this.lastT = t;
    if (inDuatSpace && this.playerPos) this.night.update(t, dt, this.local.copy(this.playerPos).sub(DUAT_ORIGIN), reduced);

    this.uPit.value += (pit - this.uPit.value) * 0.05;
    this.uCrystal.value = crystal;
    this.uFlame.value += (flame - this.uFlame.value) * 0.03;
    const tt = reduced ? t * 0.3 : t;
    if (near && !this.isInside) {
      const { half: H, height: Ht } = PYRAMID;
      const a = this.motes.pos.array as Float32Array, s = this.motes.seed;
      for (let i = 0; i < a.length / 3; i++) {
        const u = (tt * (0.012 + s[i * 3] * 0.01) + s[i * 3 + 1]) % 1;
        // across the plaza to the base, then up the face, turning as it climbs
        const r = u < 0.45 ? THREE.MathUtils.lerp(H * 2.0, H, u / 0.45) : H * (1 - (u - 0.45) / 0.55);
        const ang = s[i * 3 + 2] * Math.PI * 2 + u * 3.2;
        const cx = Math.cos(ang), cz = Math.sin(ang);
        const sq = Math.max(Math.abs(cx), Math.abs(cz)); // onto the square
        const px = (cx / sq) * r * 0.98, pz = (cz / sq) * r * 0.98;
        const m = Math.max(Math.abs(px), Math.abs(pz));
        const py = m < H ? Ht * (1 - m / H) + 0.5 : 0.4;
        a[i * 3] = px;
        a[i * 3 + 1] = py;
        a[i * 3 + 2] = pz;
      }
      this.motes.pos.needsUpdate = true;
    }
    if (this.isInside) {
      // the braziers breathe: their light flickers, each its own phase, softer on the weakest
      for (const b of this.braziers) {
        const f = 0.78 + 0.13 * Math.sin(t * 6.3 + b.ph) + 0.09 * Math.sin(t * 11.7 + b.ph * 1.71);
        b.l.intensity = b.k * f * (reduced ? 0.72 : 1);
      }
      const a = this.gallery.pos.array as Float32Array, s = this.gallery.seed;
      const n = a.length / 3;
      for (let i = 0; i < n; i++) {
        if (i < n * 0.6) {
          // up the gallery toward the King's Chamber
          const u = (tt * (0.02 + s[i * 3] * 0.02) + s[i * 3 + 1]) % 1;
          const x = 2 + u * 34;
          a[i * 3] = x;
          a[i * 3 + 1] = Math.min(13, (x - 1.6) * (13 / 32.4)) + 1 + s[i * 3 + 2] * 5.5 + Math.sin(u * 20 + i) * 0.2;
          a[i * 3 + 2] = 14.3 + ((s[i * 3 + 2] * 7.3) % 1) * 2.8;
        } else {
          // the first spiral: round and up about the coffer
          const u = (tt * (0.05 + s[i * 3] * 0.03) + s[i * 3 + 1]) % 1;
          const ang = u * 12 + s[i * 3 + 2] * 6.28, rr = 1.4 * (1 - u * 0.6);
          a[i * 3] = COFFER.x + Math.cos(ang) * rr;
          a[i * 3 + 1] = COFFER.y + 0.2 + u * 5.2;
          a[i * 3 + 2] = COFFER.z + Math.sin(ang) * rr;
        }
      }
      this.gallery.pos.needsUpdate = true;
    }
  }
}

function dotTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.35, "rgba(255,255,255,0.45)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
