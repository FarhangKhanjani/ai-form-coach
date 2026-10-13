import { describe, expect, it } from "vitest";
import { CATALOG } from "./catalog";
import { GenericCoach, type GenericRep } from "./engine";
import { FIXTURES } from "./fixtures";
import { blend, planarPose, type PlanarSpec } from "./planar";
import type { CameraView } from "./types";

const FPS = 30;

/** Plays keyframed poses through the coach; returns the reps it reports. */
function play(id: string, keys: { spec: PlanarSpec; dur: number }[], view?: CameraView) {
  const def = CATALOG.find(d => d.id === id)!;
  const coach = new GenericCoach(def, 1, view ?? (def.views.includes("side") ? "side" : def.defaultView));
  const reps: GenericRep[] = [];
  let t = 0;
  let prev = keys[0].spec;
  for (const k of keys) {
    const n = Math.max(1, Math.round(k.dur * FPS));
    for (let i = 1; i <= n; i++) {
      const st = coach.step(t, planarPose(blend(prev, k.spec, i / n)), null);
      if (st.phase === "tracking" && st.event && typeof st.event === "object") reps.push(st.event);
      t += 1 / FPS;
    }
    prev = k.spec;
  }
  return reps;
}

function goodReps(id: string, n: number) {
  const fx = FIXTURES[id];
  const keys = [{ spec: fx.rest, dur: 1.5 }];
  for (let i = 0; i < n; i++) keys.push({ spec: fx.peak, dur: fx.downS ?? 1.5 }, { spec: fx.rest, dur: fx.upS ?? 1.5 }, { spec: fx.rest, dur: 1 });
  return keys;
}

const repExercises = CATALOG.filter(d => d.mode === "reps");

describe("catalog exercises on scripted side-view reps", () => {
  for (const def of repExercises) {
    const fx = FIXTURES[def.id];
    it(`${def.id}: counts 3 good reps with no issues`, () => {
      const reps = play(def.id, goodReps(def.id, 3));
      expect(reps.map(r => r.issues)).toEqual([[], [], []]);
      expect(reps.every(r => r.trackingOk)).toBe(true);
    });
    for (const fault of fx.faults) {
      it(`${def.id}: flags ${fault.code}`, () => {
        const rest = fault.rest ?? fx.rest;
        const keys = fault.keys ?? [fault.peak ?? fx.peak, rest];
        const times = fault.times ?? [fx.downS ?? 1.5, fx.upS ?? 1.5, 1.5];
        const seq = [{ spec: rest, dur: 1.5 }, ...keys.map((spec, i) => ({ spec, dur: times[i] ?? 1.5 })), { spec: rest, dur: 1 }];
        const reps = play(def.id, seq);
        expect(reps).toHaveLength(1);
        expect(reps[0].issues).toContain(fault.code);
      });
    }
  }

  it("forearm_plank: a good hold has no issues and reports its duration", () => {
    const fx = FIXTURES.forearm_plank;
    const stand: PlanarSpec = { shin: 0, thigh: 0, trunk: 0, upperArm: 0, forearm: 0 };
    const reps = play("forearm_plank", [{ spec: fx.peak, dur: 0.1 }, { spec: fx.peak, dur: 5 }, { spec: stand, dur: 0.1 }, { spec: stand, dur: 2 }]);
    expect(reps).toHaveLength(1);
    expect(reps[0].issues).toEqual([]);
    expect(reps[0].metrics.holdS).toBeGreaterThan(4.5);
  });
  for (const fault of FIXTURES.forearm_plank.faults) {
    it(`forearm_plank: flags ${fault.code}`, () => {
      const stand: PlanarSpec = { shin: 0, thigh: 0, trunk: 0, upperArm: 0, forearm: 0 };
      const reps = play("forearm_plank", [{ spec: fault.peak!, dur: 0.1 }, { spec: fault.peak!, dur: 5 }, { spec: stand, dur: 0.1 }, { spec: stand, dur: 2 }]);
      expect(reps).toHaveLength(1);
      expect(reps[0].issues).toContain(fault.code);
    });
  }

  it("ignores movements too small to be a rep", () => {
    const fx = FIXTURES.back_squat;
    const small: PlanarSpec = { shin: 10, thigh: -30, trunk: 15, upperArm: -40, forearm: 60 };
    expect(play("back_squat", [{ spec: fx.rest, dur: 1.5 }, { spec: small, dur: 1 }, { spec: fx.rest, dur: 1 }, { spec: fx.rest, dur: 1 }])).toHaveLength(0);
  });

  it("every check names dataset checkpoints and a limit source", () => {
    for (const d of CATALOG) for (const c of d.checks) {
      expect(c.source.checkpoints.length, `${d.id}.${c.code}`).toBeGreaterThan(0);
      expect(c.source.limit.length, `${d.id}.${c.code}`).toBeGreaterThan(0);
    }
  });
});
