// Standing still in front of the camera must never count a rep, even with the jitter a real camera and
// pose model produce, and with body measurements that don't match the live picture exactly.
import { describe, expect, it } from "vitest";
import type { BodyDims } from "../../pose/lift";
import { CATALOG } from "./catalog";
import { GenericCoach } from "./engine";
import { shoot } from "./fixtures3d";
import { REFERENCE, AVERAGE_DIMS } from "./reference";

/** Deterministic Gaussian-ish noise. */
function rng(seed: number) {
  let s = seed;
  const u = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  return (sd: number) => (u() + u() + u() - 1.5) * sd * 2;
}

function standStill(id: string, yaw: number, seconds: number, body: BodyDims | null, seed: number) {
  const def = CATALOG.find(d => d.id === id)!;
  const coach = new GenericCoach(def, 1, yaw === 0 ? "front" : yaw === 90 ? "side" : "diagonal", body);
  const n = rng(seed);
  let reps = 0, minSignal = Infinity;
  for (let i = 0; i < seconds * 30; i++) {
    const { pose, world } = shoot(id, REFERENCE[id].rest, yaw);
    const jp = pose.map(p => ({ ...p, x: p.x + n(0.004), y: p.y + n(0.004) }));
    const jw = world.map(p => ({ ...p, z: p.z + n(0.03) }));
    const st = coach.step(i / 30, jp, jw);
    if (st.phase === "tracking" && st.signal !== null && i > 30) minSignal = Math.min(minSignal, st.signal);
    if (st.phase === "tracking" && st.event && typeof st.event === "object") reps++;
  }
  return { reps, minSignal };
}

const MISMATCHED: BodyDims = { ...AVERAGE_DIMS, thigh: AVERAGE_DIMS.thigh * 1.08, shin: AVERAGE_DIMS.shin * 0.95, torso: AVERAGE_DIMS.torso * 1.05 };

describe("standing still counts nothing", () => {
  for (const id of ["back_squat", "overhead_press"]) {
    for (const [label, body] of [["learned lengths", null], ["body profile slightly off", MISMATCHED]] as const) {
      for (const yaw of [0, 45, 90]) {
        it(`${id}, ${label}, ${yaw}°: 0 reps in 30 s`, () => {
          for (const seed of [1, 2, 3]) expect(standStill(id, yaw, 30, body, seed).reps).toBe(0);
        });
      }
    }
  }
  it("back squat from the front: the knee angle of a still person stays near straight", () => {
    // Single frames still dip from the pose model's depth jitter (before the depth cap in lift.ts: 133°);
    // the rep rule (80% of the rep checks) keeps such dips from counting.
    const { minSignal } = standStill("back_squat", 0, 20, MISMATCHED, 7);
    expect(minSignal).toBeGreaterThan(145);
  });
});
