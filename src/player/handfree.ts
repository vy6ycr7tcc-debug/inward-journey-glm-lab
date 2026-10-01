/* "Walk me there" (item 16): the hands-free half of the game. One click and the wanderer
   goes — the visitor watches, listens, and contemplates; the guide orb leads ahead as it
   always does. The journey completes itself: no path-finding, just the ground answering
   underfoot as the target draws them on. Tapping the stick or a key takes over as today —
   the walk stops being automatic, the orb keeps leading, nothing is taken from the visitor.
   Pure state, so the tests can hold it: start, arrive, take over. */
import * as THREE from "three/webgpu";

export class WalkMeThere {
  /** The destination while hands-free; null when the visitor holds the stick or has arrived. */
  private dest: { x: number; z: number } | null = null;
  private target = new THREE.Vector2();

  /** Begin: walk to the destination by yourself. */
  start(x: number, z: number): void {
    this.dest = { x, z };
  }

  /** Whether the wanderer is walking on their own. */
  get active(): boolean {
    return this.dest !== null;
  }

  /** The stick, a key, the round button: hands take over, the walk stops being automatic. */
  takeOver(): void {
    this.dest = null;
  }

  /** Each frame: the point the wanderer walks toward (reused, never reallocated), or null. */
  update(player: THREE.Vector3): THREE.Vector2 | null {
    if (!this.dest) return null;
    if (Math.hypot(this.dest.x - player.x, this.dest.z - player.z) < 2.4) {
      this.dest = null; // arrived: the guide circles the place, the visitor is there
      return null;
    }
    this.target.set(this.dest.x, this.dest.z);
    return this.target;
  }
}
