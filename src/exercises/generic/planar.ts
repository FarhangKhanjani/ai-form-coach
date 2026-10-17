// Side-view stick figure from joint angles: test poses, and the ghost's shape (see ghost.ts).
// The person faces +x (image right), y grows downward. Angles in degrees.
import type { Pose } from "../../pose/types";

export interface PlanarSpec {
  /** Ankle→knee lean from vertical (+ = knee forward). */
  shin: number;
  /** Knee→hip lean from vertical (+ = hip forward of knee; squatting ≈ −60…−90). */
  thigh: number;
  /** Hip→shoulder lean from vertical (+ = forward). */
  trunk: number;
  /** Shoulder→elbow from straight down (+ = forward, 180 = overhead). */
  upperArm: number;
  /** Elbow→wrist from straight down (+ = forward, 180 = up). */
  forearm: number;
  /** Head tilt relative to the trunk (+ = forward/down). */
  head?: number;
  /** Second leg for lunges: knee and ankle placed from the hip, angles from straight down (+ = forward). */
  backLeg?: { thighDown: number; shinDown: number };
  /** Heel raised by this much (normalized units). */
  heelLift?: number;
  /** Rotate the whole figure about the hip (−90 = lying on the back, +90 = face down). */
  rotate?: number;
  /** Translate so this joint sits at the given point (e.g. hands on a bar). */
  anchor?: { joint: "wrist" | "ankle" | "hip"; at: [number, number] };
}

const LEN = { torso: 0.25, thigh: 0.22, shin: 0.21, upperArm: 0.14, forearm: 0.13, neck: 0.09, foot: 0.09, heel: 0.03 };
export type Lens = typeof LEN;
type V = [number, number];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const up = (deg: number, l: number): V => [l * Math.sin(deg * Math.PI / 180), -l * Math.cos(deg * Math.PI / 180)];
const down = (deg: number, l: number): V => [l * Math.sin(deg * Math.PI / 180), l * Math.cos(deg * Math.PI / 180)];

export interface Sagittal {
  ankle: V; knee: V; hip: V; shoulder: V; elbow: V; wrist: V; nose: V; ear: V; headC: V; heel: V; toe: V;
  /** Second leg (lunge back leg; same as the first otherwise). */
  bKnee: V; bAnkle: V; bHeel: V; bToe: V;
}

/** Joint positions in the body's side plane: x = forward, y = down. Lengths default to an average body. */
export function sagittal(s: PlanarSpec, lens: Lens = LEN): Sagittal {
  const ankle: V = [0.5, 0.85];
  const knee = add(ankle, up(s.shin, lens.shin));
  const hip = add(knee, up(s.thigh, lens.thigh));
  const shoulder = add(hip, up(s.trunk, lens.torso));
  const elbow = add(shoulder, down(s.upperArm, lens.upperArm));
  const wrist = add(elbow, down(s.forearm, lens.forearm));
  const headDir = s.trunk + (s.head ?? 0);
  const headC = add(shoulder, up(headDir, lens.neck));
  const fwd: V = [Math.cos(headDir * Math.PI / 180), Math.sin(headDir * Math.PI / 180)];   // facing direction of the head
  const nose = add(headC, [0.39 * lens.neck * fwd[0], 0.39 * lens.neck * fwd[1]]);
  const ear = add(headC, [-0.13 * lens.neck * fwd[0], -0.13 * lens.neck * fwd[1]]);
  const heel = add(ankle, [-lens.heel, 0.73 * lens.heel - (s.heelLift ?? 0)]);
  const toe = add(ankle, [lens.foot, 0.28 * lens.foot]);
  let bKnee = knee, bAnkle = ankle, bHeel = heel, bToe = toe;
  if (s.backLeg) {
    bKnee = add(hip, down(s.backLeg.thighDown, lens.thigh));
    bAnkle = add(bKnee, down(s.backLeg.shinDown, lens.shin));
    bHeel = add(bAnkle, [-lens.heel, -0.33 * lens.heel]); bToe = add(bAnkle, [0.78 * lens.foot, 0.33 * lens.foot]);
  }
  const out: Sagittal = { ankle, knee, hip, shoulder, elbow, wrist, nose, ear, headC, heel, toe, bKnee, bAnkle, bHeel, bToe };
  const keys = Object.keys(out) as (keyof Sagittal)[];
  if (s.rotate) {
    const a = s.rotate * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
    for (const k of keys) { const [x, y] = out[k]; const dx = x - hip[0], dy = y - hip[1]; out[k] = [hip[0] + dx * c - dy * sn, hip[1] + dx * sn + dy * c]; }
  }
  if (s.anchor) {
    const at = out[s.anchor.joint];
    const d: V = [s.anchor.at[0] - at[0], s.anchor.at[1] - at[1]];
    for (const k of keys) out[k] = add(out[k], d);
  }
  return out;
}

export function planarPose(s: PlanarSpec): Pose {
  const g = sagittal(s);
  const pts: V[] = Array.from({ length: 33 }, () => g.headC);
  pts[0] = g.nose; pts[7] = g.ear; pts[8] = g.ear;
  pts[11] = g.shoulder; pts[12] = g.shoulder; pts[13] = g.elbow; pts[14] = g.elbow; pts[15] = g.wrist; pts[16] = g.wrist;
  for (const i of [17, 19, 21, 18, 20, 22]) pts[i] = g.wrist;
  pts[23] = g.hip; pts[24] = g.hip;
  pts[25] = g.knee; pts[27] = g.ankle; pts[29] = g.heel; pts[31] = g.toe;          // left = front / near leg
  pts[26] = g.bKnee; pts[28] = g.bAnkle; pts[30] = g.bHeel; pts[32] = g.bToe;      // right = back leg
  // Left side is nearer the camera (more visible); the right side is slightly offset so the two don't coincide.
  return pts.map(([x, y], i) => ({ x: x + (i % 2 === 0 && i > 10 ? 0.004 : 0), y, z: 0, v: i % 2 === 0 && i > 10 ? 0.7 : 0.95 }));
}

/** Linear blend of two specs (for animating a rep). */
export function blend(a: PlanarSpec, b: PlanarSpec, t: number): PlanarSpec {
  const m = (x: number, y: number) => x + (y - x) * t;
  return {
    ...b,
    shin: m(a.shin, b.shin), thigh: m(a.thigh, b.thigh), trunk: m(a.trunk, b.trunk),
    upperArm: m(a.upperArm, b.upperArm), forearm: m(a.forearm, b.forearm),
    head: m(a.head ?? 0, b.head ?? 0), heelLift: m(a.heelLift ?? 0, b.heelLift ?? 0),
    rotate: m(a.rotate ?? 0, b.rotate ?? 0),
    backLeg: a.backLeg && b.backLeg ? { thighDown: m(a.backLeg.thighDown, b.backLeg.thighDown), shinDown: m(a.backLeg.shinDown, b.backLeg.shinDown) } : b.backLeg ?? a.backLeg,
    anchor: b.anchor ?? a.anchor
  };
}
