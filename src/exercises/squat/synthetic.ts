// Scripted front-view squat poses for tests (no camera, no model).
import type { Pose } from "../../pose/types";

const STAND: Record<number, [number, number]> = {
  0: [0.5, 0.15], 11: [0.56, 0.27], 12: [0.44, 0.27], 13: [0.58, 0.40], 14: [0.42, 0.40],
  15: [0.585, 0.52], 16: [0.415, 0.52], 23: [0.535, 0.52], 24: [0.465, 0.52],
  25: [0.54, 0.70], 26: [0.46, 0.70], 27: [0.545, 0.88], 28: [0.455, 0.88],
  29: [0.545, 0.90], 30: [0.455, 0.90], 31: [0.56, 0.92], 32: [0.44, 0.92]
};

export interface PoseErr { caving?: boolean; shallow?: boolean; heels?: boolean; shift?: boolean; tilt?: boolean }
export interface Segment { kind: "hold" | "rep"; dur: number; down?: number; err?: PoseErr; label?: string;
  /** Move the whole body (e.g. stepping closer): offset applied for this segment. */
  offset?: [number, number];
  /** Rotate the body about the vertical axis by squeezing one side (turned away from the camera). */
  turned?: boolean;
  /** Return nonsense landmarks (tracking glitch). */
  glitch?: boolean }

/** Pose at squat progress e (0 standing, 1 bottom). */
export function squatPose(e: number, err: PoseErr = {}): [number, number][] {
  const p: [number, number][] = [];
  for (let i = 0; i < 33; i++) {
    const src = STAND[i] || (i <= 10 ? STAND[0] : i <= 22 ? (i % 2 ? STAND[15] : STAND[16]) : STAND[0]);
    p.push([src[0], src[1]]);
  }
  const d = e * (err.shallow ? 0.55 : 1);
  const lerp = (a: number, b: number) => a + (b - a) * d;
  for (const i of [23, 24]) p[i][1] = lerp(STAND[i][1], 0.725);
  const out = err.caving ? -0.04 : 0.025;
  p[25] = [STAND[25][0] + out * d, lerp(0.70, 0.725)];
  p[26] = [STAND[26][0] - out * d, lerp(0.70, 0.725)];
  const dy = lerp(0, 0.23);
  for (let i = 0; i <= 22; i++) p[i][1] += dy;
  if (err.heels) { p[29][1] -= 0.035 * e; p[30][1] -= 0.035 * e; }
  if (err.shift) for (const i of [0, 11, 12, 13, 14, 15, 16, 23, 24]) p[i][0] += 0.02 * e;
  if (err.tilt) p[23][1] += 0.02 * e;
  return p;
}

/** Plays back a script. Returns null after the end. */
export function scriptedPose(script: Segment[], t: number, noise: () => number): Pose | null {
  let t0 = 0;
  for (const seg of script) {
    if (t < t0 + seg.dur) {
      if (seg.glitch) {
        return Array.from({ length: 33 }, (_, i) => ({ x: 0.8 + 0.01 * (i % 3) + noise(), y: 0.4 + 0.02 * (i % 5), z: 0, v: 0.6 }));
      }
      let e = 0;
      if (seg.kind === "rep") {
        const down = seg.down ?? 2.5, tt = t - t0;
        e = tt < down ? tt / down : Math.max(0, 1 - (tt - down) / (seg.dur - down));
      }
      const p = squatPose(e, seg.err);
      const [ox, oy] = seg.offset ?? [0, 0];
      return p.map(([x, y], i) => {
        let xx = x;
        if (seg.turned) xx = 0.5 + (x - 0.5) * (i % 2 ? 0.6 : 1) + (i >= 23 && i <= 24 ? 0.03 : 0);
        return { x: xx + ox + noise(), y: y + oy + noise(), z: 0, v: i === 29 || i === 30 ? 0.8 : 0.97 };
      });
    }
    t0 += seg.dur;
  }
  return null;
}

export function seededNoise(seed = 1, amp = 0.003) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s / 2147483647 - 0.5) * amp; };
}
