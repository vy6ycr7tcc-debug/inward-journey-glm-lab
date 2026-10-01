// @vitest-environment jsdom
/* Item 14 — the tour camera: it never stands behind a wall (the confine pulls it into the
   place's own interior, along its line to the wanderer), and the temple tour names its
   subject so the gravity work can frame it. */
import { describe, expect, it } from "vitest";

(globalThis as Record<string, unknown>).matchMedia =
  (globalThis as Record<string, unknown>).matchMedia ??
  (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
HTMLCanvasElement.prototype.getContext = function (): CanvasRenderingContext2D | null {
  return { createRadialGradient: () => ({ addColorStop: () => {} }), fillRect: () => {} } as unknown as CanvasRenderingContext2D;
} as typeof HTMLCanvasElement.prototype.getContext;

const THREE = await import("three/webgpu");
const { FollowCamera } = await import("./camera");
type Cam = InstanceType<typeof FollowCamera>;

/** A room: x −5..5. The desired camera stands beyond the +x wall when the wanderer faces
    away from it — the confine must pull it back inside, along its own line. */
function roomConfine(): NonNullable<Cam["confine"]> {
  const out = new THREE.Vector3();
  return (p) => {
    out.copy(p);
    if (out.x > 5) out.x = 5;
    if (out.x < -5) out.x = -5;
    return out;
  };
}

describe("the tour camera (item 14)", () => {
  it("keeps inside the room: never a wall between the camera and the character", () => {
    const cam = new THREE.PerspectiveCamera(60, 1.6, 0.1, 100);
    const follow = new FollowCamera(cam);
    follow.confine = roomConfine();
    follow.startFollowing(true);
    follow.snapTo(new THREE.Vector3(4.4, 0, 0));
    // the wanderer at the room's east edge, facing west: the camera would drift past the wall
    follow.yaw = Math.PI / 2; // the wanderer faces −x: the camera wants to stand beyond the wall
    follow.dist = 6;
    const player = new THREE.Vector3(4.4, 0, 0);
    for (let k = 0; k < 40; k++) follow.update(1 / 60, player, Math.PI / 2, false, 10, false);
    expect(cam.position.x).toBeLessThanOrEqual(5.001); // pulled in, never behind the wall
    // and the character is still framed: the camera looks at the wanderer
    cam.updateMatrixWorld(true);
    const look = new THREE.Vector3();
    cam.getWorldDirection(look);
    const toPlayer = player.clone().setY(player.y + 1.3).sub(cam.position).normalize();
    expect(look.dot(toPlayer)).toBeGreaterThan(0.9); // looking at them, not at the wall
  });

  it("the open world needs no confine and the camera follows as before", () => {
    const cam = new THREE.PerspectiveCamera(60, 1.6, 0.1, 100);
    const follow = new FollowCamera(cam);
    follow.startFollowing(true);
    follow.snapTo(new THREE.Vector3(0, 0, 0));
    follow.update(1 / 60, new THREE.Vector3(0, 0, 0), 0, false, 10, false);
    expect(Number.isFinite(cam.position.x)).toBe(true);
  });

  it("the temple tour names its subject: the door stands for none, each stop for its shrine", async () => {
    const { TempleTour, TRACK_ID } = await import("../scenes/templeTour");
    class FakeNarration {
      current: string | null = null;
      debugTime: number | null = null;
      paused = false;
      time(): number {
        return 0;
      }
      stop(): void {
        this.current = null;
      }
      play(): Promise<void> {
        this.current = TRACK_ID;
        return Promise.resolve();
      }
      busy(): boolean {
        return false;
      }
    }
    const tour = new TempleTour(
      new THREE.Scene(),
      new FakeNarration() as unknown as ConstructorParameters<typeof TempleTour>[1],
      { pos: new THREE.Vector3(), heading: 0, target: null },
      { yaw: 0, pitch: 0.2, snapTo: () => {} },
      { whisper: () => {} },
      {
        standFor: (i: number) => ({ x: 0, z: 20 - (i + 1) * 3, heading: Math.PI }),
        setRite: () => {},
        entry: () => ({ x: 0, z: 20, heading: Math.PI }),
        floorAt: () => 0,
      },
    );
    tour.enter();
    expect(tour.stopShrine).toBe(-1); // the door: no shrine yet
    // straight to the first shrine (as if already there): the subject is shrine 0
    (tour as unknown as { go: (k: number, there?: boolean) => void }).go(1, true);
    expect(tour.stopShrine).toBe(0);
  });
});
