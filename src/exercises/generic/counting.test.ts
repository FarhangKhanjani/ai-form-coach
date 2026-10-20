// A movement counts as a rep only when ≥ 80% of the exercise's rep criteria pass (catalog.ts `countIf`).
import { describe, expect, it } from "vitest";
import { CATALOG } from "./catalog";
import { GenericCoach, type GenericRep, type RejectedMove } from "./engine";
import { shoot } from "./fixtures3d";
import { blend, type PlanarSpec } from "./planar";
import { REFERENCE } from "./reference";
import type { ExerciseDef } from "./types";

function rng(seed: number) {
  let s = seed;
  const u = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  return (sd: number) => (u() + u() + u() - 1.5) * sd * 2;
}

function run(def: ExerciseDef, keys: [PlanarSpec, number][], yaw = 0, noise = { xy: 0, z: 0 }, seed = 1) {
  const coach = new GenericCoach(def, 1, yaw === 0 ? "front" : "side");
  const n = rng(seed);
  const reps: GenericRep[] = [], rejected: RejectedMove[] = [];
  let t = 0, prev = keys[0][0];
  for (const [spec, dur] of keys) {
    const k = Math.max(1, Math.round(dur * 30));
    for (let i = 1; i <= k; i++) {
      const { pose, world } = shoot(def.id, blend(prev, spec, i / k), yaw);
      const st = coach.step(t, pose.map(p => ({ ...p, x: p.x + n(noise.xy), y: p.y + n(noise.xy) })), world.map(p => ({ ...p, z: p.z + n(noise.z) })));
      if (st.phase === "tracking") {
        if (st.event && typeof st.event === "object") reps.push(st.event);
        if (st.rejected) rejected.push(st.rejected);
      }
      t += 1 / 30;
    }
    prev = spec;
  }
  return { reps, rejected };
}

const squat = CATALOG.find(d => d.id === "back_squat")!;
const press = CATALOG.find(d => d.id === "overhead_press")!;
const R = REFERENCE.back_squat;
const stand: PlanarSpec = { shin: 0, thigh: 0, trunk: 0, upperArm: 0, forearm: 0 };

describe("rep counting needs 80% of the rep criteria", () => {
  it("very shaky tracking of a still person: the old rule counts reps, the new one doesn't", () => {
    const still: [PlanarSpec, number][] = [[R.rest, 60]];
    const heavy = { xy: 0.012, z: 0.1 };
    const old: ExerciseDef = { ...squat, countIf: undefined, signal: { ...squat.signal!, mustReach: 140 } };
    const before = [1, 2, 3].map(seed => run(old, still, 0, heavy, seed).reps.length).reduce((a, b) => a + b);
    const now = [1, 2, 3].map(seed => run(squat, still, 0, heavy, seed).reps.length).reduce((a, b) => a + b);
    expect(before).toBeGreaterThan(0);
    expect(now).toBe(0);
  });

  it("a real squat is counted and says how many criteria passed", () => {
    const { reps } = run(squat, [[stand, 1], [R.rest, 1.5], [R.peak, 1.5], [R.rest, 1.5], [R.rest, 1]]);
    expect(reps).toHaveLength(1);
    expect(reps[0].metrics.countPassed).toBe(7);
    expect(reps[0].metrics.countTotal).toBe(7);
  });

  it("a real squat still counts with shaky tracking", () => {
    const { reps } = run(squat, [[stand, 1], [R.rest, 1.5], [R.peak, 1.5], [R.rest, 1.5], [R.rest, 1], [R.peak, 1.5], [R.rest, 1.5], [R.rest, 1]], 0, { xy: 0.004, z: 0.03 });
    expect(reps).toHaveLength(2);
  });

  it("a step forward into a lunge is not a squat, and says why", () => {
    const lunge = REFERENCE.forward_lunge.peak;
    const { reps, rejected } = run(squat, [[stand, 1], [R.rest, 1.5], [lunge, 1.5], [R.rest, 1.5], [R.rest, 1]], 90);
    expect(reps).toHaveLength(0);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].failed).toEqual(expect.arrayContaining(["feet stayed in place", "stance unchanged"]));
  });

  it("a quarter squat isn't counted", () => {
    const quarter: PlanarSpec = { shin: 15, thigh: -40, trunk: 20, upperArm: -10, forearm: 80 };
    const { reps, rejected } = run(squat, [[stand, 1], [R.rest, 1.5], [quarter, 1.2], [R.rest, 1.2], [R.rest, 1]]);
    expect(reps).toHaveLength(0);
    expect(rejected[0].passed / rejected[0].total).toBeLessThan(0.8);
  });

  it("overhead press: a full press counts; raising the bar only to the face doesn't", () => {
    const P = REFERENCE.overhead_press;
    const toFace: PlanarSpec = { ...stand, upperArm: 95, forearm: 175 };
    expect(run(press, [[stand, 1], [P.rest, 1.5], [P.peak, 1.5], [P.rest, 1.5], [P.rest, 1]]).reps).toHaveLength(1);
    expect(run(press, [[stand, 1], [P.rest, 1.5], [toFace, 1.5], [P.rest, 1.5], [P.rest, 1]]).reps).toHaveLength(0);
  });
});
