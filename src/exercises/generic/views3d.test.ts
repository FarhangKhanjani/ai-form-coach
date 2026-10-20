// The same reps filmed from the front, at 45° and from the side must give the same result once the
// skeleton is lifted to 3D (src/pose/lift.ts). Poses are built in 3D, projected to the image, and the world
// landmarks get their depth squashed (MediaPipe underestimates depth) to check the lifting doesn't rely on it.
import { describe, expect, it } from "vitest";
import { CATALOG } from "./catalog";
import { GenericCoach, type GenericRep } from "./engine";
import { computeFeatures3D } from "./features";
import { FIXTURES } from "./fixtures";
import { blend, type PlanarSpec } from "./planar";
import { shoot } from "./fixtures3d";
import { AVERAGE_DIMS, REFERENCE } from "./reference";
import { Lifter } from "../../pose/lift";
import type { CameraView } from "./types";

const FPS = 30;
const D = AVERAGE_DIMS;
/** People walk up and stand in front of the camera before the first rep. */
const STAND: PlanarSpec = { shin: 0, thigh: 0, trunk: 0, upperArm: 0, forearm: 0 };

function play(id: string, exKeys: { spec: PlanarSpec; dur: number }[], yaw: number, view: CameraView) {
  const def = CATALOG.find(d => d.id === id)!;
  const keys = id === "pull_up" || id === "parallel_bar_dip" ? exKeys : [{ spec: STAND, dur: 1 }, ...exKeys];
  const coach = new GenericCoach(def, 1, view);
  const reps: GenericRep[] = [];
  let t = 0, prev = keys[0].spec;
  for (const k of keys) {
    const n = Math.max(1, Math.round(k.dur * FPS));
    for (let i = 1; i <= n; i++) {
      const { pose, world } = shoot(id, blend(prev, k.spec, i / n), yaw);
      const st = coach.step(t, pose, world);
      if (st.phase === "tracking" && st.event && typeof st.event === "object") reps.push(st.event);
      t += 1 / FPS;
    }
    prev = k.spec;
  }
  return reps;
}

const VIEWS: [CameraView, number][] = [["front", 0], ["diagonal", 45], ["side", 90]];

describe("lifted 3D features", () => {
  it("joint angles agree across camera angles (within 3°)", () => {
    const spec = REFERENCE.back_squat.peak;
    const angles = [0, 30, 60, 90].map(yaw => {
      const lifter = new Lifter(D);
      for (let i = 0; i < 30; i++) { const r = shoot("back_squat", REFERENCE.back_squat.rest, yaw); lifter.lift(r.pose, r.world, 1); }
      const { pose, world } = shoot("back_squat", spec, yaw);
      for (let i = 0; i < 15; i++) lifter.lift(pose, world, 1);   // held for half a second (depth is smoothed over time)
      const { f } = computeFeatures3D(lifter.lift(pose, world, 1)!.pts, pose);
      return [f.knee, f.hip, f.trunkFromVertical, f.shinFromVertical];
    });
    for (const a of angles) for (let k = 0; k < a.length; k++) expect(Math.abs(a[k] - angles[3][k])).toBeLessThan(3);
  });

  it("learns segment lengths from the world landmarks when there is no body profile", () => {
    const lifter = new Lifter(null);
    for (let i = 0; i < 12; i++) { const { pose, world } = shoot("back_squat", REFERENCE.back_squat.rest, 0); lifter.lift(pose, world, 1); }
    expect(lifter.dims!.thigh / lifter.dims!.shin).toBeCloseTo(D.thigh / D.shin, 1);
  });
});

describe("catalog exercises from every camera angle (3D)", () => {
  for (const def of CATALOG.filter(d => d.mode === "reps" && d.views.includes("front"))) {
    const fx = FIXTURES[def.id];
    for (const [view, yaw] of VIEWS) {
      if (!def.views.includes(view)) continue;
      it(`${def.id} ${view}: 3 good reps, no issues`, () => {
        const keys = [{ spec: fx.rest, dur: 1.5 }];
        for (let i = 0; i < 3; i++) keys.push({ spec: fx.peak, dur: fx.downS ?? 1.5 }, { spec: fx.rest, dur: fx.upS ?? 1.5 }, { spec: fx.rest, dur: 1 });
        const reps = play(def.id, keys, yaw, view);
        expect(reps.map(r => r.issues)).toEqual([[], [], []]);
      });
      for (const fault of fx.faults) {
        it(`${def.id} ${view}: flags ${fault.code}`, () => {
          const rest = fault.rest ?? fx.rest;
          const keys = fault.keys ?? [fault.peak ?? fx.peak, rest];
          const times = fault.times ?? [fx.downS ?? 1.5, fx.upS ?? 1.5, 1.5];
          const seq = [{ spec: rest, dur: 1.5 }, ...keys.map((spec, i) => ({ spec, dur: times[i] ?? 1.5 })), { spec: rest, dur: 1 }];
          const reps = play(def.id, seq, yaw, view);
          expect(reps).toHaveLength(1);
          expect(reps[0].issues).toContain(fault.code);
        });
      }
    }
  }
});
