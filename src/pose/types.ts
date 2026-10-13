/** One MediaPipe Pose landmark. x/y are normalized to the video frame (y grows downward), v = visibility. */
export interface Landmark { x: number; y: number; z: number; v: number }
/** The 33 MediaPipe Pose landmarks. Odd indices are the person's left side. */
export type Pose = Landmark[];
/** World landmarks: meters, origin between the hips. */
export type WorldPose = { x: number; y: number; z: number }[];

export const L = {
  nose: 0,
  shoulderL: 11, shoulderR: 12, elbowL: 13, elbowR: 14, wristL: 15, wristR: 16,
  hipL: 23, hipR: 24, kneeL: 25, kneeR: 26, ankleL: 27, ankleR: 28,
  heelL: 29, heelR: 30, toeL: 31, toeR: 32
} as const;

export const BONES: [number, number][] = [
  [11, 12], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 29], [29, 31], [27, 31], [28, 30], [30, 32], [28, 32], [11, 13], [13, 15], [12, 14], [14, 16]
];

export const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Exponential smoothing of landmark positions; visibility is taken as-is. */
export class PoseSmoother {
  private s: Pose | null = null;
  constructor(private alpha = 0.5) {}
  reset() { this.s = null; }
  push(raw: Pose): Pose {
    if (!this.s) this.s = raw.map(p => ({ ...p }));
    else {
      const a = this.alpha;
      for (let i = 0; i < raw.length; i++) {
        const s = this.s[i], p = raw[i];
        s.x += a * (p.x - s.x); s.y += a * (p.y - s.y); s.z += a * (p.z - s.z); s.v = p.v;
      }
    }
    return this.s;
  }
}
