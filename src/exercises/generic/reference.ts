// Correct-form reference poses per catalog exercise (start and end of a good rep), used for the ghost and
// as the clean reps in the tests. 3D body poses are built from them with a person's own segment lengths.
// The joint angles are a 2D approximation of the dataset's checkpoints, not coach-validated [Placeholder].
import type { BodyDims, V3 } from "../../pose/lift";
import { sagittal, type PlanarSpec } from "./planar";

export interface Reference {
  rest: PlanarSpec;
  peak: PlanarSpec;
  /** The ghost is pinned to this point of the user's body (the part that doesn't move during the rep). */
  anchor: "feet" | "rearFoot" | "hands" | "shoulders" | "elbows";
  /** Feet and hands apart, × hip width and × shoulder width. */
  stance: number; grip: number;
  /** Ghost tempo when it leads: seconds rest → peak, at the peak, peak → rest, at rest. */
  tempo: [number, number, number, number];
}

const stand: PlanarSpec = { shin: 0, thigh: 0, trunk: 0, upperArm: 0, forearm: 0 };
const bar: [number, number] = [0.5, 0.1];

export const REFERENCE: Record<string, Reference> = {
  back_squat: {
    rest: { ...stand, upperArm: -40, forearm: 60 },
    peak: { shin: 25, thigh: -95, trunk: 40, upperArm: -10, forearm: 80 },
    anchor: "feet", stance: 1.6, grip: 1.6, tempo: [2, 0.3, 1.5, 1]
  },
  bench_press: {
    rest: { ...stand, upperArm: 90, forearm: 90, rotate: -90 },
    peak: { ...stand, upperArm: -30, forearm: 90, rotate: -90 },
    anchor: "shoulders", stance: 1.6, grip: 1.6, tempo: [2, 0.3, 1.5, 1]
  },
  conventional_deadlift: {
    rest: { shin: 20, thigh: -70, trunk: 50, upperArm: 0, forearm: 0 },
    peak: { ...stand },
    anchor: "feet", stance: 1.1, grip: 1.1, tempo: [1.5, 0.5, 2, 1.5]
  },
  pull_up: {
    rest: { ...stand, upperArm: 180, forearm: 180, anchor: { joint: "wrist", at: bar } },
    peak: { ...stand, upperArm: 20, forearm: 170, anchor: { joint: "wrist", at: bar } },
    anchor: "hands", stance: 1, grip: 1.5, tempo: [1.5, 0.3, 2.5, 0.8]
  },
  barbell_bent_over_row: {
    rest: { shin: 10, thigh: -20, trunk: 60, upperArm: 0, forearm: 0 },
    peak: { shin: 10, thigh: -20, trunk: 60, upperArm: -60, forearm: 30 },
    anchor: "feet", stance: 1.2, grip: 1.3, tempo: [1, 0.5, 2, 0.5]
  },
  overhead_press: {
    rest: { ...stand, upperArm: 30, forearm: 160 },
    peak: { ...stand, upperArm: 180, forearm: 180 },
    anchor: "feet", stance: 1.2, grip: 1.2, tempo: [1.5, 0.5, 2, 1]
  },
  barbell_curl: {
    rest: { ...stand, upperArm: 0, forearm: 10 },
    peak: { ...stand, upperArm: 10, forearm: 150 },
    anchor: "feet", stance: 1.2, grip: 1.1, tempo: [1.5, 0.5, 2, 0.5]
  },
  parallel_bar_dip: {
    rest: { ...stand, trunk: 10, upperArm: 0, forearm: 0 },
    peak: { ...stand, trunk: 25, upperArm: -70, forearm: 15 },
    anchor: "hands", stance: 1, grip: 1.3, tempo: [2, 0.3, 1.5, 1]
  },
  forward_lunge: {
    rest: { ...stand, backLeg: { thighDown: 0, shinDown: 0 } },
    peak: { shin: 5, thigh: -85, trunk: 5, upperArm: 0, forearm: 0, backLeg: { thighDown: -10, shinDown: -95 } },
    anchor: "rearFoot", stance: 1, grip: 1.6, tempo: [1.5, 0.5, 1.5, 1]
  },
  forearm_plank: {
    rest: { ...stand, upperArm: 90, forearm: 180, rotate: 90 },
    peak: { ...stand, upperArm: 90, forearm: 180, rotate: 90 },
    anchor: "elbows", stance: 1, grip: 1, tempo: [1, 1, 1, 1]
  }
};

/** Average proportions (relative units) for when no body profile or measurement exists yet. */
export const AVERAGE_DIMS: BodyDims = {
  hipWidth: 0.11, shoulderWidth: 0.16, torso: 0.25, upperArm: 0.14, forearm: 0.13, thigh: 0.22, shin: 0.21, heel: 0.03, foot: 0.09, neck: 0.09
};

/**
 * 33 points of a person in the pose `spec`, in the body's own frame: u = forward, v = down, w = toward the
 * person's left. `frontLeg` puts the lunge's stepping leg on that side. Origin = the hip midpoint.
 */
export function bodyPose(spec: PlanarSpec, dims: BodyDims, ref: Pick<Reference, "stance" | "grip">, frontLeg: "L" | "R" = "L"): { u: number; v: number; w: number }[] {
  const hw = dims.hipWidth / 2, sw = dims.shoulderWidth / 2;
  const feet = hw * ref.stance, hands = sw * ref.grip;
  // Segments that also run sideways (shoulders wider than hips, hands wider than shoulders) are shorter in the side plane.
  const inPlane = (len: number, sideways: number) => Math.sqrt(Math.max(len * len - sideways * sideways, 0.5 * len * len));
  const g = sagittal(spec, {
    torso: inPlane(dims.torso, sw - hw), thigh: inPlane(dims.thigh, feet - hw), shin: dims.shin,
    upperArm: inPlane(dims.upperArm, (hands - sw) / 2), forearm: inPlane(dims.forearm, (hands - sw) / 2),
    neck: dims.neck, foot: dims.foot, heel: dims.heel
  });
  const P = (p: [number, number], w: number) => ({ u: p[0] - g.hip[0], v: p[1] - g.hip[1], w });
  const out = Array.from({ length: 33 }, () => P(g.headC, 0));
  const fl = frontLeg === "L" ? 1 : -1;
  const legs = { front: { knee: g.knee, ankle: g.ankle, heel: g.heel, toe: g.toe }, back: { knee: g.bKnee, ankle: g.bAnkle, heel: g.bHeel, toe: g.bToe } };
  for (const side of [1, -1]) {   // 1 = left (odd indices)
    const o = side === 1 ? 0 : 1;
    const leg = spec.backLeg ? (side === fl ? legs.front : legs.back) : legs.front;
    out[11 + o] = P(g.shoulder, side * sw);
    out[13 + o] = P(g.elbow, side * (sw + hands) / 2);
    out[15 + o] = P(g.wrist, side * hands);
    for (const i of [17, 19, 21]) out[i + o] = P(g.wrist, side * hands);
    out[23 + o] = P(g.hip, side * hw);
    out[25 + o] = P(leg.knee, side * feet);   // knees track over the feet
    out[27 + o] = P(leg.ankle, side * feet);
    out[29 + o] = P(leg.heel, side * feet);
    out[31 + o] = P(leg.toe, side * (feet + 0.25 * dims.foot));
    out[7 + o] = P(g.ear, side * 0.7 * hw);
  }
  out[0] = P(g.nose, 0);
  for (const i of [1, 2, 3, 4, 5, 6, 9, 10]) out[i] = { ...out[0], w: (i % 2 ? 1 : -1) * 0.2 * hw };
  return out;
}

/** Body frame → camera coordinates, given the person's forward and left directions in the camera frame. */
export function toCamera(b: { u: number; v: number; w: number }[], fwd: V3, left: V3): V3[] {
  return b.map(p => ({ x: fwd.x * p.u + left.x * p.w, y: p.v, z: fwd.z * p.u + left.z * p.w }));
}
