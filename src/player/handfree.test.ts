// @vitest-environment jsdom
/* Item 16 — "walk me there": the hands-free walk's own state. One click starts it, arrival
   ends it, and the stick or a key takes over as today. */
import { describe, expect, it } from "vitest";
const THREE = await import("three/webgpu");
const { WalkMeThere } = await import("./handfree");
type V3 = InstanceType<typeof THREE.Vector3>;

describe("walk me there (item 16)", () => {
  it("one click and the wanderer goes: it walks toward the destination by itself", () => {
    const w = new WalkMeThere();
    expect(w.active).toBe(false);
    expect(w.update(new THREE.Vector3(0, 0, 0) as V3)).toBeNull();
    w.start(30, -40);
    expect(w.active).toBe(true);
    const t = w.update(new THREE.Vector3(0, 0, 0) as V3);
    expect(t!.x).toBe(30);
    expect(t!.y).toBe(-40);
  });

  it("the journey completes itself: arrival ends it, exactly there", () => {
    const w = new WalkMeThere();
    w.start(30, -40);
    expect(w.update(new THREE.Vector3(28, 0, -37.5) as V3)).not.toBeNull(); // almost there
    expect(w.update(new THREE.Vector3(30, 0, -40) as V3)).toBeNull(); // arrived
    expect(w.active).toBe(false);
  });

  it("the stick or a key takes over: the walk stops being automatic at once", () => {
    const w = new WalkMeThere();
    w.start(30, -40);
    w.takeOver();
    expect(w.active).toBe(false);
    expect(w.update(new THREE.Vector3(0, 0, 0) as V3)).toBeNull();
    // and it can be asked again after
    w.start(10, 10);
    expect(w.active).toBe(true);
  });
});
