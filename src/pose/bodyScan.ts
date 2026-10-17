// Body measurements from standing photos plus the person's height. Runs on the phone; only the numbers
// are saved. Segments are measured where the photo shows them at full length: widths and arms from the
// front photo, feet from the side photo, legs and torso from both.
import { measureDims, type BodyDims, DIM_KEYS } from "./lift";
import { L, type Pose } from "./types";

export type PhotoView = "front" | "side";
export interface ScanPhoto { pose: Pose; width: number; height: number; view: PhotoView }

/**
 * Eye height as a fraction of standing height, to turn the photo into centimetres.
 * [Placeholder] ≈ 0.936, the value usually quoted from Drillis & Contini (1966) via Winter's Biomechanics
 * textbook; not checked against the original. It only affects the cm shown, not tracking (which uses ratios).
 */
export const EYE_HEIGHT_FRACTION = 0.936;

const FROM: Record<PhotoView, (keyof BodyDims)[]> = {
  front: ["hipWidth", "shoulderWidth", "torso", "upperArm", "forearm", "thigh", "shin", "neck"],
  side: ["torso", "upperArm", "forearm", "thigh", "shin", "heel", "foot", "neck"]
};
const CORE = [L.nose, L.shoulderL, L.shoulderR, L.elbowL, L.elbowR, L.wristL, L.wristR, L.hipL, L.hipR, L.kneeL, L.kneeR, L.ankleL, L.ankleR];

export interface PhotoResult { dims: Partial<BodyDims>; problems: string[] }

/** Segment lengths in cm from one photo, or the reasons it can't be used. */
export function measurePhoto(ph: ScanPhoto, heightCm: number): PhotoResult {
  const { pose, width: W, height: H } = ph;
  const px = (i: number) => ({ x: pose[i].x * W, y: pose[i].y * H });
  const d = (a: number, b: number) => Math.hypot(px(a).x - px(b).x, px(a).y - px(b).y);
  const problems: string[] = [];
  const out = (i: number) => pose[i].x < 0 || pose[i].x > 1 || pose[i].y < 0 || pose[i].y > 1;
  if (CORE.some(i => pose[i].v < 0.5 || out(i))) problems.push("The whole body must be in the photo, head to feet, clearly visible.");
  const kneeAngle = (h: number, k: number, a: number) => {
    const u = { x: px(h).x - px(k).x, y: px(h).y - px(k).y }, v = { x: px(a).x - px(k).x, y: px(a).y - px(k).y };
    return Math.acos(Math.max(-1, Math.min(1, (u.x * v.x + u.y * v.y) / (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y))))) * 180 / Math.PI;
  };
  if (Math.min(kneeAngle(L.hipL, L.kneeL, L.ankleL), kneeAngle(L.hipR, L.kneeR, L.ankleR)) < 165) problems.push("Stand up straight with your knees straight.");
  const torso = (d(L.hipL, L.shoulderL) + d(L.hipR, L.shoulderR)) / 2;
  const frontal = d(L.shoulderL, L.shoulderR) / torso;
  if (ph.view === "front" && frontal < 0.5) problems.push("For the front photo, face the camera straight on.");
  if (ph.view === "side" && frontal > 0.35) problems.push("For the side photo, turn sideways to the camera.");
  const floor = Math.max(...[L.heelL, L.heelR, L.toeL, L.toeR, L.ankleL, L.ankleR].map(i => px(i).y));
  const eyes = (px(2).y + px(5).y) / 2;
  const staturepx = (floor - eyes) / EYE_HEIGHT_FRACTION;
  if (!(staturepx > 0.3 * H)) problems.push("Stand closer: you should fill most of the photo's height.");
  if (problems.length) return { dims: {}, problems };

  const cmPerPx = heightCm / staturepx;
  const mid = (a: number, b: number) => ({ x: (px(a).x + px(b).x) / 2, y: (px(a).y + px(b).y) / 2 });
  const all = measureDims(d, ([a, b], c) => Math.hypot(mid(a, b).x - px(c).x, mid(a, b).y - px(c).y));
  const dims: Partial<BodyDims> = {};
  for (const k of FROM[ph.view]) dims[k] = Math.round(all[k] * cmPerPx * 10) / 10;
  return { dims, problems };
}

/** Typical proportions (× height) for parts no photo measured, e.g. foot length without a side photo. [Placeholder] */
const TYPICAL: BodyDims = { hipWidth: 0.11, shoulderWidth: 0.21, torso: 0.29, upperArm: 0.18, forearm: 0.15, thigh: 0.24, shin: 0.25, heel: 0.04, foot: 0.12, neck: 0.15 };

/** All segments: the average over the photos that measured each one, typical proportions for the rest. */
export function combine(results: PhotoResult[], heightCm: number): { dims: BodyDims; estimated: (keyof BodyDims)[] } {
  const dims = {} as BodyDims;
  const estimated: (keyof BodyDims)[] = [];
  for (const k of DIM_KEYS) {
    const v = results.map(r => r.dims[k]).filter((x): x is number => x !== undefined);
    if (v.length) dims[k] = Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10;
    else { dims[k] = Math.round(TYPICAL[k] * heightCm * 10) / 10; estimated.push(k); }
  }
  return { dims, estimated };
}
