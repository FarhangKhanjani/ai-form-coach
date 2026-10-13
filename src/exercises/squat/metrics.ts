import { L, clamp, mid, type Pose } from "../../pose/types";
import type { Calibration } from "./calibration";
import type { CameraView, SquatThresholds } from "./config";

export interface SquatMetrics {
  /** Hip-to-knee gap ÷ standing gap: 1 standing, 0 hips level with knees. */
  r: number;
  /** Progress to the depth target: 0 standing, 1 target reached. */
  p: number;
  /** Knee width ÷ ankle width. */
  kneeRatio: number;
  /** How far each knee has moved inward (toward the midline) since standing, fraction of hip width. */
  kneeInside: { L: number; R: number };
  /** Left/right hip height difference, fraction of hip width, change from standing (positive = left hip lower). */
  hipTilt: number;
  /** Highest visible heel rise, fraction of leg length (null = heels not visible). */
  heelLift: number | null;
  /** Sideways drift of hips vs feet, fraction of hip width, change from standing (positive = toward the person's left). */
  shift: number;
  /** How far the feet moved from where they were at calibration, fraction of leg length. */
  feetMoved: number;
}

/** Frame metrics from a smoothed front-view pose. aspect = frame width ÷ height. */
export function squatMetrics(s: Pose, cal: Calibration, th: SquatThresholds, aspect: number): SquatMetrics {
  const hip = mid(s[L.hipL], s[L.hipR]), knee = mid(s[L.kneeL], s[L.kneeR]), ankle = mid(s[L.ankleL], s[L.ankleR]);
  const r = (knee.y - hip.y) / cal.standGap;
  const p = clamp((1 - r) / (1 - th.depthGap), 0, 1);
  const ankleW = Math.abs(s[L.ankleL].x - s[L.ankleR].x);
  const kneeRatio = ankleW > 0.01 ? Math.abs(s[L.kneeL].x - s[L.kneeR].x) / ankleW : 1;
  const hipW = Math.max(Math.abs(s[L.hipL].x - s[L.hipR].x), 0.25 * cal.hipWidth);
  // Person's left is image right (larger x) when facing the camera, so "inside" is smaller x for the left leg.
  const kneeInside = {
    L: (s[L.ankleL].x - s[L.kneeL].x) / hipW - cal.kneeIn0.L,
    R: (s[L.kneeR].x - s[L.ankleR].x) / hipW - cal.kneeIn0.R
  };
  const hipTilt = (s[L.hipL].y - s[L.hipR].y) / (hipW * aspect) - cal.tilt0;
  let heelLift: number | null = null;
  if (s[L.heelL].v > 0.5) heelLift = (cal.heelY.L - s[L.heelL].y) / cal.legLen;
  if (s[L.heelR].v > 0.5) heelLift = Math.max(heelLift ?? -Infinity, (cal.heelY.R - s[L.heelR].y) / cal.legLen);
  const shift = (hip.x - ankle.x) / hipW - cal.shift0;
  const feetMoved = Math.hypot((ankle.x - cal.ankleMid.x) * aspect, ankle.y - cal.ankleMid.y) / cal.legLen;
  return { r, p, kneeRatio, kneeInside, hipTilt, heelLift, shift, feetMoved };
}

/** Rule checks for the current frame (only meaningful once the user is bent). */
export function liveFlags(m: SquatMetrics, th: SquatThresholds, view: CameraView = "front") {
  const bent = m.p > 0.4, front = view === "front";
  return {
    knees: bent && front && (m.kneeRatio < th.kneeMin || Math.max(m.kneeInside.L, m.kneeInside.R) > th.kneeInMax),
    heels: bent && view !== "diagonal" && m.heelLift !== null && m.heelLift > th.heelMax,
    shift: bent && front && Math.abs(m.shift) > th.shiftMax,
    tilt: bent && front && Math.abs(m.hipTilt) > th.hipTiltMax
  };
}
