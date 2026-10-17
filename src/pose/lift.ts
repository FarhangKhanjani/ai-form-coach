// 3D skeleton from one camera: the 2D landmarks (accurate in the image plane) plus known segment lengths.
// For each bone, the part of its length that the image doesn't show must point toward or away from the
// camera: |dz| = sqrt((s·L)² − dx² − dy²), where L is the bone's true length and s the image scale.
// The sign (toward or away) comes from MediaPipe's world landmarks, which are good at ordering but weak at
// distances. This makes joint angles nearly the same from the front, the side or 45°.
// Assumes a phone standing upright (image y = vertical) and a person 2+ m away (weak perspective).
import { L, type Pose, type WorldPose } from "./types";

export interface V3 { x: number; y: number; z: number }

/** Segment lengths of one person. Any unit; only ratios are used for lifting (the body profile stores cm). */
export interface BodyDims {
  hipWidth: number; shoulderWidth: number;
  /** Hip to shoulder on the same side. */
  torso: number;
  upperArm: number; forearm: number; thigh: number; shin: number;
  /** Ankle to heel, ankle to toe. */
  heel: number; foot: number;
  /** Shoulder midpoint to nose. */
  neck: number;
}
export const DIM_KEYS: (keyof BodyDims)[] = ["hipWidth", "shoulderWidth", "torso", "upperArm", "forearm", "thigh", "shin", "heel", "foot", "neck"];

type Dist = (a: number, b: number) => number;
/** Segment lengths measured on any set of points (L and R averaged). */
export function measureDims(dist: Dist, midDist: (a: [number, number], b: number) => number): BodyDims {
  const both = (l: [number, number], r: [number, number]) => (dist(l[0], l[1]) + dist(r[0], r[1])) / 2;
  return {
    hipWidth: dist(L.hipL, L.hipR),
    shoulderWidth: dist(L.shoulderL, L.shoulderR),
    torso: both([L.hipL, L.shoulderL], [L.hipR, L.shoulderR]),
    upperArm: both([L.shoulderL, L.elbowL], [L.shoulderR, L.elbowR]),
    forearm: both([L.elbowL, L.wristL], [L.elbowR, L.wristR]),
    thigh: both([L.hipL, L.kneeL], [L.hipR, L.kneeR]),
    shin: both([L.kneeL, L.ankleL], [L.kneeR, L.ankleR]),
    heel: both([L.ankleL, L.heelL], [L.ankleR, L.heelR]),
    foot: both([L.ankleL, L.toeL], [L.ankleR, L.toeR]),
    neck: midDist([L.shoulderL, L.shoulderR], L.nose)
  };
}

const d3 = (a: V3, b: V3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const m3 = (a: V3, b: V3): V3 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });
export const dimsFromWorld = (w: WorldPose): BodyDims =>
  measureDims((a, b) => d3(w[a], w[b]), ([a, b], c) => d3(m3(w[a], w[b]), w[c]));

// Bones in lifting order (parent before child). HIP_MID = virtual root between the hips.
const HIP_MID = -1, SH_MID = -2;
type Bone = [parent: number, child: number, dim: keyof BodyDims, factor: number];
const TREE: Bone[] = [
  [HIP_MID, L.hipL, "hipWidth", 0.5], [HIP_MID, L.hipR, "hipWidth", 0.5],
  [L.hipL, L.shoulderL, "torso", 1], [L.hipR, L.shoulderR, "torso", 1],
  [L.shoulderL, L.elbowL, "upperArm", 1], [L.elbowL, L.wristL, "forearm", 1],
  [L.shoulderR, L.elbowR, "upperArm", 1], [L.elbowR, L.wristR, "forearm", 1],
  [L.hipL, L.kneeL, "thigh", 1], [L.kneeL, L.ankleL, "shin", 1], [L.ankleL, L.heelL, "heel", 1], [L.ankleL, L.toeL, "foot", 1],
  [L.hipR, L.kneeR, "thigh", 1], [L.kneeR, L.ankleR, "shin", 1], [L.ankleR, L.heelR, "heel", 1], [L.ankleR, L.toeR, "foot", 1],
  [SH_MID, L.nose, "neck", 1]
];
/** Bones that are often seen nearly full length; the image scale is read from them. */
const SCALE_BONES: Bone[] = [
  ...TREE.filter(b => ["torso", "thigh", "shin", "upperArm", "forearm"].includes(b[2])),
  [L.hipL, L.hipR, "hipWidth", 1], [L.shoulderL, L.shoulderR, "shoulderWidth", 1]
];
/** Points without a bone of their own take the depth of this one. */
const FOLLOW: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 17: 15, 19: 15, 21: 15, 18: 16, 20: 16, 22: 16 };

export interface Lifted {
  /** 33 points: x, y in image units with x multiplied by the aspect ratio; z in the same units, + = away from the camera. */
  pts: V3[];
  /** Image units per unit of BodyDims. */
  scale: number;
  dims: BodyDims;
}

/**
 * Lifts 2D landmarks to 3D frame by frame. Without a body profile, segment lengths are learned from the
 * world landmarks over the first frames (median), which is enough for ratios.
 */
export class Lifter {
  private samples: BodyDims[] = [];
  private learned: BodyDims | null = null;
  private scale = NaN;
  constructor(private profile: BodyDims | null = null) {}

  get dims(): BodyDims | null { return this.profile ?? this.learned; }

  lift(pose: Pose, world: WorldPose | null, aspect: number): Lifted | null {
    if (!world || world.length < 33) return null;
    if (!this.profile) this.learn(pose, world);
    const dims = this.dims;
    if (!dims) return null;

    const img = (i: number): V3 => i === HIP_MID ? m3(img(L.hipL), img(L.hipR)) : i === SH_MID ? m3(img(L.shoulderL), img(L.shoulderR))
      : { x: pose[i].x * aspect, y: pose[i].y, z: 0 };

    // Image scale: the second-largest (2D length ÷ true length) among bones that are usually in view.
    const ratios = SCALE_BONES
      .filter(([a, b]) => pose[a].v > 0.5 && pose[b].v > 0.5)
      .map(([a, b, k, f]) => Math.hypot(img(a).x - img(b).x, img(a).y - img(b).y) / (dims[k] * f))
      .filter(Number.isFinite).sort((p, q) => q - p);
    if (ratios.length < 3) return null;
    const sNow = ratios[1];
    // Bending or turning makes every bone look shorter for a moment, but the true scale only drops when the
    // person walks away from the camera, which is slow: follow increases quickly and decreases slowly.
    if (!Number.isFinite(this.scale)) this.scale = sNow;
    else this.scale += (sNow > this.scale ? 0.3 : 0.02) * (sNow - this.scale);
    const s = this.scale;

    const wz = (i: number) => i === HIP_MID ? (world[L.hipL].z + world[L.hipR].z) / 2 : i === SH_MID ? (world[L.shoulderL].z + world[L.shoulderR].z) / 2 : world[i].z;
    const pts: V3[] = Array.from({ length: 33 }, (_, i) => img(i));
    const zOf = new Map<number, number>([[HIP_MID, 0]]);
    for (const [p, c, k, f] of TREE) {
      if (p === SH_MID && !zOf.has(SH_MID)) zOf.set(SH_MID, (zOf.get(L.shoulderL)! + zOf.get(L.shoulderR)!) / 2);
      const a = img(p), b = img(c);
      const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
      const dz = Math.sqrt(Math.max(0, (s * dims[k] * f) ** 2 - l2));
      const sign = wz(c) - wz(p) >= 0 ? 1 : -1;
      zOf.set(c, zOf.get(p)! + sign * dz);
    }
    for (let i = 0; i < 33; i++) {
      const src = zOf.has(i) ? i : FOLLOW[i];
      pts[i].z = zOf.get(src) ?? 0;
    }
    return { pts, scale: s, dims };
  }

  private learn(pose: Pose, world: WorldPose) {
    if (this.samples.length >= 150) return;
    const core = [L.shoulderL, L.shoulderR, L.hipL, L.hipR, L.kneeL, L.kneeR, L.ankleL, L.ankleR, L.elbowL, L.elbowR, L.wristL, L.wristR];
    if (core.some(i => pose[i].v < 0.6)) return;
    this.samples.push(dimsFromWorld(world));
    // Depth errors and turning only make a bone look shorter, so the upper end of what was seen is the best guess.
    if (this.samples.length >= 10 && this.samples.length % 5 === 0) this.learned = percentileDims(this.samples, 0.8);
  }
}

export function percentileDims(list: BodyDims[], p: number): BodyDims {
  const out = {} as BodyDims;
  for (const k of DIM_KEYS) {
    const v = list.map(d => d[k]).sort((a, b) => a - b);
    out[k] = v[Math.min(v.length - 1, Math.floor(p * v.length))];
  }
  return out;
}
