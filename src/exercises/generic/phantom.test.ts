import { expect, it } from "vitest";
import { CATALOG } from "./catalog";
import { GenericCoach, type GenericRep } from "./engine";
import { FIXTURES } from "./fixtures";
import { blend, planarPose, type PlanarSpec } from "./planar";

function play(id: string, keys: [PlanarSpec, number][]) {
  const coach = new GenericCoach(CATALOG.find(d => d.id === id)!, 1, "side");
  const reps: GenericRep[] = [];
  let t = 0, prev = keys[0][0];
  for (const [spec, dur] of keys) {
    const n = Math.max(1, Math.round(dur * 30));
    for (let i = 1; i <= n; i++) {
      const st = coach.step(t, planarPose(blend(prev, spec, i / n)), null);
      if (st.phase === "tracking" && st.event && typeof st.event === "object") reps.push(st.event);
      t += 1 / 30;
    }
    prev = spec;
  }
  return reps;
}
const stand: PlanarSpec = { shin: 0, thigh: 0, trunk: 0, upperArm: 0, forearm: 0 };

it("deadlift: walking up to the bar standing, then setting up, is not a rep", () => {
  const fx = FIXTURES.conventional_deadlift;
  expect(play("conventional_deadlift", [[stand, 2], [fx.rest, 1.5], [fx.rest, 1.5]])).toHaveLength(0);
});
it("deadlift: the first real pull after setting up still counts", () => {
  const fx = FIXTURES.conventional_deadlift;
  expect(play("conventional_deadlift", [[stand, 2], [fx.rest, 1.5], [fx.rest, 1.5], [fx.peak, 1.5], [fx.rest, 1.5], [fx.rest, 1]])).toHaveLength(1);
});
it("overhead press: standing arms down, then racking the bar on the shoulders, is not a rep", () => {
  const fx = FIXTURES.overhead_press;
  expect(play("overhead_press", [[stand, 2], [fx.rest, 1.5], [fx.rest, 1.5]])).toHaveLength(0);
});
it("touch-and-go reps with almost no pause at the top all count", () => {
  const fx = FIXTURES.back_squat;
  const keys: [PlanarSpec, number][] = [[fx.rest, 1.5]];
  for (let i = 0; i < 4; i++) keys.push([fx.peak, 1.2], [fx.rest, 1.2]);
  keys.push([fx.rest, 1]);
  expect(play("back_squat", keys)).toHaveLength(4);
});
