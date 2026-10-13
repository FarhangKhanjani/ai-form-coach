// Joint angles from MediaPipe world landmarks (metres, origin between the hips).
// Defined like the lab studies in docs/exercises/squat.md §7 so our numbers can be compared with them.
// Caveat: "vertical" is the camera's vertical axis, so the phone must stand upright; a tilted phone tilts the lean angles.
import { L, type WorldPose } from "./types";

type V = { x: number; y: number; z: number };
const sub = (a: V, b: V): V => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const len = (a: V) => Math.hypot(a.x, a.y, a.z);
const mid3 = (a: V, b: V): V => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });
const deg = (r: number) => r * 180 / Math.PI;

/** Angle between two vectors, degrees (0–180). */
export function between(u: V, v: V): number {
  const n = len(u) * len(v);
  if (n === 0) return NaN;
  return deg(Math.acos(Math.max(-1, Math.min(1, (u.x * v.x + u.y * v.y + u.z * v.z) / n))));
}

/** Angle of a segment away from vertical, degrees (0 = upright), whichever way the y axis points. */
export function fromVertical(v: V): number {
  const a = between(v, { x: 0, y: 1, z: 0 });
  return Math.min(a, 180 - a);
}

export interface SquatAngles {
  /** Knee flexion: 0 = straight leg, ~100 at a parallel squat. */
  kneeFlex: { L: number; R: number };
  /** Hip flexion: angle between trunk and thigh, 0 = standing straight. */
  hipFlex: { L: number; R: number };
  /** Trunk forward lean from vertical (hip midpoint → shoulder midpoint). */
  trunkLean: number;
  /** Shin forward lean from vertical (ankle → knee). */
  shinLean: { L: number; R: number };
  /** Trunk lean minus mean shin lean: ~0 when the torso is parallel to the shins ([S1] criterion). */
  trunkMinusShin: number;
}

export function squatAngles(w: WorldPose): SquatAngles {
  const side = (h: number, k: number, a: number, s: number) => ({
    knee: 180 - between(sub(w[h], w[k]), sub(w[a], w[k])),
    hip: 180 - between(sub(w[s], w[h]), sub(w[k], w[h])),
    shin: fromVertical(sub(w[k], w[a]))
  });
  const l = side(L.hipL, L.kneeL, L.ankleL, L.shoulderL);
  const r = side(L.hipR, L.kneeR, L.ankleR, L.shoulderR);
  const trunkLean = fromVertical(sub(mid3(w[L.shoulderL], w[L.shoulderR]), mid3(w[L.hipL], w[L.hipR])));
  return {
    kneeFlex: { L: l.knee, R: r.knee },
    hipFlex: { L: l.hip, R: r.hip },
    trunkLean,
    shinLean: { L: l.shin, R: r.shin },
    trunkMinusShin: trunkLean - (l.shin + r.shin) / 2
  };
}

/** Rounded copy for storage. */
export function roundAngles(a: SquatAngles) {
  const r = (v: number) => Math.round(v * 10) / 10;
  return {
    kneeFlex: { L: r(a.kneeFlex.L), R: r(a.kneeFlex.R) },
    hipFlex: { L: r(a.hipFlex.L), R: r(a.hipFlex.R) },
    trunkLean: r(a.trunkLean),
    shinLean: { L: r(a.shinLean.L), R: r(a.shinLean.R) },
    trunkMinusShin: r(a.trunkMinusShin)
  };
}
