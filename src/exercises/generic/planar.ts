// Side-view stick figure from joint angles, for tests (and a possible future ghost).
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

const LEN = { torso: 0.25, thigh: 0.22, shin: 0.21, upperArm: 0.14, forearm: 0.13 };
type V = [number, number];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const up = (deg: number, l: number): V => [l * Math.sin(deg * Math.PI / 180), -l * Math.cos(deg * Math.PI / 180)];
const down = (deg: number, l: number): V => [l * Math.sin(deg * Math.PI / 180), l * Math.cos(deg * Math.PI / 180)];

export function planarPose(s: PlanarSpec): Pose {
  const ankle: V = [0.5, 0.85];
  const knee = add(ankle, up(s.shin, LEN.shin));
  const hip = add(knee, up(s.thigh, LEN.thigh));
  const shoulder = add(hip, up(s.trunk, LEN.torso));
  const elbow = add(shoulder, down(s.upperArm, LEN.upperArm));
  const wrist = add(elbow, down(s.forearm, LEN.forearm));
  const headDir = s.trunk + (s.head ?? 0);
  const headC = add(shoulder, up(headDir, 0.09));
  const fwd: V = [Math.cos(headDir * Math.PI / 180), Math.sin(headDir * Math.PI / 180)];   // facing direction of the head
  const nose = add(headC, [0.035 * fwd[0], 0.035 * fwd[1]]);
  const ear = add(headC, [-0.012 * fwd[0], -0.012 * fwd[1]]);
  const heel = add(ankle, [-0.03, 0.022 - (s.heelLift ?? 0)]);
  const toe = add(ankle, [0.09, 0.025]);
  let bKnee = knee, bAnkle = ankle, bHeel = heel, bToe = toe;
  if (s.backLeg) {
    bKnee = add(hip, down(s.backLeg.thighDown, LEN.thigh));
    bAnkle = add(bKnee, down(s.backLeg.shinDown, LEN.shin));
    bHeel = add(bAnkle, [-0.03, -0.01]); bToe = add(bAnkle, [0.07, 0.03]);
  }

  const pts: V[] = Array.from({ length: 33 }, () => headC);
  pts[0] = nose; pts[7] = ear; pts[8] = ear;
  pts[11] = shoulder; pts[12] = shoulder; pts[13] = elbow; pts[14] = elbow; pts[15] = wrist; pts[16] = wrist;
  for (const i of [17, 19, 21]) pts[i] = wrist;
  for (const i of [18, 20, 22]) pts[i] = wrist;
  pts[23] = hip; pts[24] = hip;
  pts[25] = knee; pts[27] = ankle; pts[29] = heel; pts[31] = toe;          // left = front / near leg
  pts[26] = bKnee; pts[28] = bAnkle; pts[30] = bHeel; pts[32] = bToe;      // right = back leg

  let out = pts;
  if (s.rotate) {
    const a = s.rotate * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
    out = out.map(([x, y]) => { const dx = x - hip[0], dy = y - hip[1]; return [hip[0] + dx * c - dy * sn, hip[1] + dx * sn + dy * c] as V; });
  }
  if (s.anchor) {
    const idx = { wrist: 15, ankle: 27, hip: 23 }[s.anchor.joint];
    const d: V = [s.anchor.at[0] - out[idx][0], s.anchor.at[1] - out[idx][1]];
    out = out.map(p => add(p, d));
  }
  // Left side is nearer the camera (more visible); the right side is slightly offset so the two don't coincide.
  return out.map(([x, y], i) => ({ x: x + (i % 2 === 0 && i > 10 ? 0.004 : 0), y, z: 0, v: i % 2 === 0 && i > 10 ? 0.7 : 0.95 }));
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
