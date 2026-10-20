import { describe, expect, it } from "vitest";
import { Lifter } from "../../pose/lift";
import { computeFeatures3D } from "./features";
import { ghostPose } from "./ghost";
import { AVERAGE_DIMS, REFERENCE } from "./reference";
import { shoot } from "./fixtures3d";

// A user doing the reference pose exactly must be covered by the ghost, from any camera angle.
describe("ghost lines up with a user in the same pose", () => {
  for (const id of ["back_squat", "forward_lunge", "overhead_press", "pull_up", "barbell_bent_over_row"]) {
    for (const yaw of [0, 45, 90, -90, 180]) {
      it(`${id} at ${yaw}°`, () => {
        const ref = REFERENCE[id];
        const lifter = new Lifter(AVERAGE_DIMS);
        for (let i = 0; i < 20; i++) { const r = shoot(id, ref.rest, yaw); lifter.lift(r.pose, r.world, 1); }
        const { pose, world } = shoot(id, ref.peak, yaw);
        for (let i = 0; i < 15; i++) lifter.lift(pose, world, 1);
        const lifted = lifter.lift(pose, world, 1)!;
        const { f, axes } = computeFeatures3D(lifted.pts, pose);
        const g = ghostPose(ref, ref.peak, lifted, axes, f.facing, 1);
        for (const i of [11, 12, 15, 16, 23, 24, 25, 26, 27, 28]) {
          expect(Math.hypot(g[i].x - pose[i].x, g[i].y - pose[i].y), `landmark ${i}`).toBeLessThan(0.02);
        }
      });
    }
  }
});
