// Per-frame body measurements for the generic exercise engine.
// 2D image coordinates with x scaled by the frame aspect ratio (square pixels), y grows downward.
// Side view: angles are read from the side nearer the camera (higher visibility). These are 2D angles,
// valid when the movement happens in the plane the camera looks at (side view for most lifts).
import { L, type Pose } from "../../pose/types";

export interface P { x: number; y: number }

export interface Features {
  /** +1 if the person faces image-right, −1 if image-left (side view). */
  facing: number;
  /** Interior joint angles, degrees (180 = straight). */
  elbow: number; knee: number; hip: number;
  /** Elbow angles of both arms. */
  elbowL: number; elbowR: number;
  /** Knee angles of both legs (lunge needs both). */
  kneeL: number; kneeR: number;
  /** Segment angles from vertical, 0 = upright, degrees, unsigned. */
  trunkFromVertical: number; shinFromVertical: number; forearmFromVertical: number; upperArmFromVertical: number;
  /** Trunk lean signed by facing: + forward, − backward (degrees). */
  trunkLeanSigned: number;
  /** Angle between upper arm and torso (0 = arm hanging along the torso). */
  upperArmFromTorso: number;
  /** (hip y − knee y) ÷ thigh length: 0 = hip level with knee, + = hip below knee. */
  hipBelowKnee: number;
  /** (wrist y − nose y) ÷ torso length: + = nose above the hands (chin over the bar). */
  noseAboveWrist: number;
  /** Plank/body line: hip distance from the shoulder–ankle line ÷ line length; + = hips sag (below), − = piked. */
  hipOffLine: number;
  /** Shoulder–ankle line angle from horizontal (0 = flat), degrees. */
  bodyFromHorizontal: number;
  /** Horizontal offset elbow − shoulder ÷ upper arm length (signed by facing). */
  elbowAheadOfShoulder: number;
  /** Head angle: shoulder→ear vs hip→shoulder, degrees (0 = head in line with the trunk). */
  headOffTrunk: number;
  /** Wrist horizontal offset from mid-foot ÷ leg length, signed by facing (+ = in front). */
  wristAheadOfMidfoot: number;
  /** Knee horizontal offset past the toes ÷ leg length for the front leg (lunge), signed by facing. */
  frontKneePastToes: number;
  /** Knee angle of the front leg (the leg whose ankle is further forward). */
  frontKnee: number;
  /** Heel height above the toe of the same foot ÷ leg length (near side). */
  heelAboveToe: number;
  /** Front view: knee width ÷ ankle width. */
  kneeAnkleWidthRatio: number;
  /** Ear-to-shoulder vertical gap ÷ torso length (shrugging makes it smaller). */
  earShoulderGap: number;
  /** Raw positions used for path checks. */
  hipMid: P; shoulderMid: P;
  /** Midpoint of the ankles in the picture (x × aspect, y), for "feet stayed in place". */
  ankleMid: P;
  /** Distance between the ankles in the picture (x × aspect, y), for "stance unchanged". */
  ankleGap: number;
  torsoLen: number; legLen: number;
  /** Mean visibility of the key joints on the near side. */
  visibility: number;
}

const deg = (r: number) => r * 180 / Math.PI;
const sub = (a: P, b: P): P => ({ x: a.x - b.x, y: a.y - b.y });
const len = (a: P) => Math.hypot(a.x, a.y);
const midP = (a: P, b: P): P => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Interior angle at b, degrees. */
export function angle2(a: P, b: P, c: P): number {
  const u = sub(a, b), v = sub(c, b);
  const n = len(u) * len(v);
  if (n === 0) return NaN;
  return deg(Math.acos(Math.max(-1, Math.min(1, (u.x * v.x + u.y * v.y) / n))));
}
/** Angle of segment a→b from vertical, unsigned, 0–90 (direction-free). */
function fromVertical(a: P, b: P): number {
  const d = sub(b, a);
  const t = deg(Math.atan2(Math.abs(d.x), Math.abs(d.y)));
  return t;
}

export function computeFeatures(pose: Pose, aspect: number, facingOverride?: number): Features {
  const p = (i: number): P => ({ x: pose[i].x * aspect, y: pose[i].y });
  const vis = (ids: number[]) => ids.reduce((s, i) => s + pose[i].v, 0) / ids.length;
  const leftIds = [L.shoulderL, L.elbowL, L.wristL, L.hipL, L.kneeL, L.ankleL];
  const rightIds = [L.shoulderR, L.elbowR, L.wristR, L.hipR, L.kneeR, L.ankleR];
  const useLeft = vis(leftIds) >= vis(rightIds);
  const S = useLeft
    ? { sh: L.shoulderL, el: L.elbowL, wr: L.wristL, hip: L.hipL, kn: L.kneeL, an: L.ankleL, heel: L.heelL, toe: L.toeL, ear: 7 }
    : { sh: L.shoulderR, el: L.elbowR, wr: L.wristR, hip: L.hipR, kn: L.kneeR, an: L.ankleR, heel: L.heelR, toe: L.toeR, ear: 8 };

  const sh = p(S.sh), el = p(S.el), wr = p(S.wr), hip = p(S.hip), kn = p(S.kn), an = p(S.an), heel = p(S.heel), toe = p(S.toe), ear = p(S.ear);
  const nose = p(L.nose);
  const shoulderMid = midP(p(L.shoulderL), p(L.shoulderR)), hipMid = midP(p(L.hipL), p(L.hipR));
  const torsoLen = Math.max(len(sub(sh, hip)), 1e-6);
  const thigh = Math.max(len(sub(hip, kn)), 1e-6);
  const legLen = Math.max(thigh + len(sub(kn, an)), 1e-6);
  const upperArm = Math.max(len(sub(sh, el)), 1e-6);

  // Facing: feet point forward; fall back to the nose relative to the ears.
  let facing = Math.sign(toe.x - heel.x);
  if (!facing || pose[S.toe].v < 0.5) facing = Math.sign(nose.x - midP(p(7), p(8)).x) || 1;
  if (facingOverride) facing = facingOverride;

  const trunkVec = sub(sh, hip);
  const trunkFromVertical = fromVertical(hip, sh);
  const trunkLeanSigned = (trunkVec.x * facing >= 0 ? 1 : -1) * trunkFromVertical;

  // Body line (plank): signed distance of hip from the shoulder–ankle line; + when the hip is lower (larger y).
  const line = sub(an, sh), lineLen = Math.max(len(line), 1e-6);
  const cross = (line.x * (hip.y - sh.y) - line.y * (hip.x - sh.x)) / lineLen;
  const hipOffLine = (line.x >= 0 ? cross : -cross) / lineLen;

  const kneeAngle = (h: number, k: number, a: number) => angle2(p(h), p(k), p(a));
  const kneeL = kneeAngle(L.hipL, L.kneeL, L.ankleL), kneeR = kneeAngle(L.hipR, L.kneeR, L.ankleR);
  const leftFront = (p(L.ankleL).x - p(L.ankleR).x) * facing > 0;
  const fk = leftFront ? { kn: p(L.kneeL), toe: p(L.toeL), knee: kneeL } : { kn: p(L.kneeR), toe: p(L.toeR), knee: kneeR };

  const midfoot = midP(heel, toe);
  const ankleW = Math.abs(p(L.ankleL).x - p(L.ankleR).x);

  return {
    facing,
    elbow: angle2(sh, el, wr), knee: angle2(hip, kn, an), hip: angle2(sh, hip, kn),
    elbowL: angle2(p(L.shoulderL), p(L.elbowL), p(L.wristL)), elbowR: angle2(p(L.shoulderR), p(L.elbowR), p(L.wristR)),
    kneeL, kneeR,
    trunkFromVertical, shinFromVertical: fromVertical(an, kn), forearmFromVertical: fromVertical(el, wr), upperArmFromVertical: fromVertical(sh, el),
    trunkLeanSigned,
    upperArmFromTorso: angle2(el, sh, hip),
    hipBelowKnee: (hip.y - kn.y) / thigh,
    noseAboveWrist: (midP(p(L.wristL), p(L.wristR)).y - nose.y) / torsoLen,
    hipOffLine,
    bodyFromHorizontal: deg(Math.atan2(Math.abs(line.y), Math.abs(line.x))),
    elbowAheadOfShoulder: (el.x - sh.x) * facing / upperArm,
    headOffTrunk: 180 - angle2(ear, sh, hip),
    wristAheadOfMidfoot: (wr.x - midfoot.x) * facing / legLen,
    frontKneePastToes: (fk.kn.x - fk.toe.x) * facing / legLen,
    frontKnee: fk.knee,
    heelAboveToe: (toe.y - heel.y) / legLen,
    kneeAnkleWidthRatio: ankleW > 0.01 ? Math.abs(p(L.kneeL).x - p(L.kneeR).x) / ankleW : 1,
    earShoulderGap: (shoulderMid.y - midP(p(7), p(8)).y) / torsoLen,
    hipMid, shoulderMid, ankleMid: midP(p(L.ankleL), p(L.ankleR)), ankleGap: len(sub(p(L.ankleL), p(L.ankleR))), torsoLen, legLen,
    visibility: vis(useLeft ? leftIds : rightIds)
  };
}

// ---- 3D: the same features from a lifted skeleton (src/pose/lift.ts), nearly independent of camera angle ----
type V3 = { x: number; y: number; z: number };
const s3 = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot3 = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
const ang3 = (a: V3, b: V3, c: V3) => {
  const u = s3(a, b), v = s3(c, b), n = Math.hypot(u.x, u.y, u.z) * Math.hypot(v.x, v.y, v.z);
  return n === 0 ? NaN : deg(Math.acos(Math.max(-1, Math.min(1, dot3(u, v) / n))));
};

/** The person's horizontal body axes in camera coordinates (x right, y down, z away from the camera). */
export interface BodyAxes {
  /** Toward the person's left. */
  left: V3;
  /** Horizontal, perpendicular to `left`: the person's forward when standing (sign fixed by `facing` in the features). */
  fwd: V3;
  /** How much the person faces the camera or away from it: 1 = straight on, 0 = side-on. */
  frontness: number;
}

export function bodyAxes(P: V3[]): BodyAxes {
  // Person's left from the hip and shoulder lines (MediaPipe labels left/right reliably).
  const lr = { x: P[L.hipL].x - P[L.hipR].x + P[L.shoulderL].x - P[L.shoulderR].x, y: 0, z: P[L.hipL].z - P[L.hipR].z + P[L.shoulderL].z - P[L.shoulderR].z };
  const n = Math.hypot(lr.x, lr.z) || 1;
  const left = { x: lr.x / n, y: 0, z: lr.z / n };
  // forward = left × up, with up = (0, −1, 0): facing the camera gives (0, 0, −1).
  const fwd = { x: left.z, y: 0, z: -left.x };
  return { left, fwd, frontness: Math.abs(left.x) };
}

/**
 * Features from 3D points: a virtual side view (the body's sagittal plane) for the 2D measures, a virtual
 * front view for widths, and true 3D angles at the joints. `pose` gives the visibilities.
 */
export function computeFeatures3D(P: V3[], pose: Pose): { f: Features; axes: BodyAxes } {
  const axes = bodyAxes(P);
  const o = { x: (P[L.hipL].x + P[L.hipR].x) / 2, y: 0, z: (P[L.hipL].z + P[L.hipR].z) / 2 };
  const side: Pose = P.map((q, i) => ({ x: 0.5 + dot3(s3(q, o), axes.fwd), y: q.y, z: 0, v: pose[i].v }));
  // Facing the camera (or away), forward is known from the hip line; side-on, the 2D code reads it from the feet and the nose.
  const f = computeFeatures(side, 1, axes.frontness > 0.5 ? 1 : undefined);
  const vis = (ids: number[]) => ids.reduce((s, i) => s + pose[i].v, 0) / ids.length;
  const useLeft = vis([L.shoulderL, L.elbowL, L.wristL, L.hipL, L.kneeL, L.ankleL]) >= vis([L.shoulderR, L.elbowR, L.wristR, L.hipR, L.kneeR, L.ankleR]);
  const S = useLeft ? { sh: L.shoulderL, el: L.elbowL, wr: L.wristL, hip: L.hipL, kn: L.kneeL, an: L.ankleL }
    : { sh: L.shoulderR, el: L.elbowR, wr: L.wristR, hip: L.hipR, kn: L.kneeR, an: L.ankleR };
  const kneeL = ang3(P[L.hipL], P[L.kneeL], P[L.ankleL]), kneeR = ang3(P[L.hipR], P[L.kneeR], P[L.ankleR]);
  const leftFront = dot3(s3(P[L.ankleL], P[L.ankleR]), axes.fwd) * f.facing > 0;
  const fl = (i: number) => dot3(s3(P[i], o), axes.left);
  const ankleW = Math.abs(fl(L.ankleL) - fl(L.ankleR));
  // In a near side-on view the left–right spread is a depth estimate: keep the 2D ratio's neutral value there.
  const kneeAnkle = axes.frontness > 0.5 && ankleW > 0.01 ? Math.abs(fl(L.kneeL) - fl(L.kneeR)) / ankleW : f.kneeAnkleWidthRatio;
  return {
    axes,
    f: {
      ...f,
      elbow: ang3(P[S.sh], P[S.el], P[S.wr]), knee: ang3(P[S.hip], P[S.kn], P[S.an]), hip: ang3(P[S.sh], P[S.hip], P[S.kn]),
      elbowL: ang3(P[L.shoulderL], P[L.elbowL], P[L.wristL]), elbowR: ang3(P[L.shoulderR], P[L.elbowR], P[L.wristR]),
      ankleMid: { x: (P[L.ankleL].x + P[L.ankleR].x) / 2, y: (P[L.ankleL].y + P[L.ankleR].y) / 2 },
      ankleGap: Math.hypot(P[L.ankleL].x - P[L.ankleR].x, P[L.ankleL].y - P[L.ankleR].y),
      kneeL, kneeR, frontKnee: leftFront ? kneeL : kneeR,
      upperArmFromTorso: ang3(P[S.el], P[S.sh], P[S.hip]),
      kneeAnkleWidthRatio: kneeAnkle,
      visibility: f.visibility
    }
  };
}
