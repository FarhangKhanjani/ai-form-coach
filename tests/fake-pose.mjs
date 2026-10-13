// Stand-in for @mediapipe/tasks-vision used by tests/run-tests.mjs.
// Plays back a scripted front-view squat session as MediaPipe-style landmarks.
// The script is read from window.__POSE_SCRIPT__ (list of segments, see run-tests.mjs).

const STAND = {
  0: [0.5, 0.15], 11: [0.56, 0.27], 12: [0.44, 0.27], 13: [0.58, 0.40], 14: [0.42, 0.40],
  15: [0.585, 0.52], 16: [0.415, 0.52], 23: [0.535, 0.52], 24: [0.465, 0.52],
  25: [0.54, 0.70], 26: [0.46, 0.70], 27: [0.545, 0.88], 28: [0.455, 0.88],
  29: [0.545, 0.90], 30: [0.455, 0.90], 31: [0.56, 0.92], 32: [0.44, 0.92]
};
// Bottom of a correct squat seen from the front: knees forward/out (shin foreshortened),
// hips at knee height, torso lower.
const BOTTOM = {
  hipY: 0.725, kneeY: 0.725, kneeOut: 0.025, shoulderY: 0.50
};

function pose(e, err) {
  const p = {};
  for (let i = 0; i < 33; i++) {
    const src = STAND[i] || (i <= 10 ? STAND[0] : i <= 22 ? (i % 2 ? STAND[15] : STAND[16]) : STAND[0]);
    p[i] = [src[0], src[1]];
  }
  const depth = err.shallow ? 0.55 : 1;
  const d = e * depth;
  const lerp = (a, b) => a + (b - a) * d;
  for (const i of [23, 24]) p[i][1] = lerp(STAND[i][1], BOTTOM.hipY);
  const out = err.caving ? -0.04 : BOTTOM.kneeOut;
  p[25] = [STAND[25][0] + out * d, lerp(0.70, BOTTOM.kneeY)];
  p[26] = [STAND[26][0] - out * d, lerp(0.70, BOTTOM.kneeY)];
  const dy = lerp(0, BOTTOM.shoulderY - 0.27);
  for (const i of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]) p[i][1] += dy;
  if (err.heels) { p[29][1] -= 0.035 * e; p[30][1] -= 0.035 * e; }
  if (err.shift) for (const i of [0, 11, 12, 13, 14, 15, 16, 23, 24]) p[i][0] += 0.02 * e;
  return p;
}

function phaseAt(script, t) {
  let t0 = 0;
  for (const seg of script) {
    if (t < t0 + seg.dur) {
      const x = (t - t0) / seg.dur;
      if (seg.kind === "hold") return { e: 0, err: {} };
      // down, then up: down takes seg.down seconds, up the rest
      const down = seg.down, up = seg.dur - down;
      const tt = t - t0;
      const e = tt < down ? tt / down : Math.max(0, 1 - (tt - down) / up);
      return { e, err: seg.err || {} };
    }
    t0 += seg.dur;
  }
  return { e: 0, err: {}, done: true };
}

let seed = 1;
const noise = () => { seed = (seed * 16807) % 2147483647; return (seed / 2147483647 - 0.5) * 0.003; };

export class FilesetResolver {
  static async forVisionTasks() { return {}; }
}
export class PoseLandmarker {
  static async createFromOptions(_f, opts) {
    window.__POSE_OPTS__ = opts;
    return new PoseLandmarker();
  }
  detectForVideo(_video, ts) {
    if (this.t0 === undefined) this.t0 = ts;
    const t = (ts - this.t0) / 1000;
    const { e, err, done } = phaseAt(window.__POSE_SCRIPT__, t);
    window.__POSE_DONE__ = !!done;
    const p = pose(e, err);
    const lm = [];
    for (let i = 0; i < 33; i++) {
      lm.push({ x: p[i][0] + noise(), y: p[i][1] + noise(), z: 0, visibility: i === 29 || i === 30 ? 0.8 : 0.97 });
    }
    return { landmarks: [lm] };
  }
  close() {}
}
