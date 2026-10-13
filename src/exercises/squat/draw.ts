import { BONES, clamp, mid, type Pose } from "../../pose/types";
import type { Calibration } from "./calibration";

type P = { x: number; y: number };
const lerp = (a: P, b: P, t: number): P => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
const ease = (p: number) => p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
const SIDES = {
  L: { a: 27, k: 25, h: 23, s: 11, el: 13, w: 15, he: 29, f: 31 },
  R: { a: 28, k: 26, h: 24, s: 12, el: 14, w: 16, he: 30, f: 32 }
};

/**
 * Ghost of a correct front-view squat at phase p (0 standing → 1 bottom), built from the user's
 * calibrated standing pose and anchored at their current feet. 2D approximation, not coach-validated.
 */
export function drawGhost(ctx: CanvasRenderingContext2D, pose: Pose, cal: Calibration, p: number, depthGap: number) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const ankleNow = { x: (pose[27].x + pose[28].x) / 2 * W, y: (pose[27].y + pose[28].y) / 2 * H };
  const off = { x: ankleNow.x - cal.ankleMid.x * W, y: ankleNow.y - cal.ankleMid.y * H };
  const C = (i: number): P => ({ x: cal.pts[i].x * W + off.x, y: cal.pts[i].y * H + off.y });

  const shin = (dist(C(25), C(27)) + dist(C(26), C(28))) / 2;
  const torso = dist(mid(C(11), C(12)), mid(C(23), C(24)));
  const sw = dist(C(11), C(12));
  const gapPx = cal.standGap * H;
  const e = ease(clamp(p, 0, 1));
  const shMidTop = mid(C(11), C(12));

  const g: Record<number, P> = {};
  const kb: Record<string, P> = {};
  const out: Record<string, number> = {};
  for (const side of ["L", "R"] as const) {
    const S = SIDES[side];
    out[side] = Math.sign(C(S.a).x - ankleNow.x) || (side === "L" ? 1 : -1);
    kb[side] = { x: C(S.a).x + out[side] * 0.18 * shin, y: C(S.a).y - 0.85 * shin };
    g[S.k] = lerp(C(S.k), kb[side], e);
    g[S.a] = C(S.a); g[S.he] = C(S.he); g[S.f] = C(S.f);
  }
  const hipBotY = (kb.L.y + kb.R.y) / 2 - depthGap * gapPx;
  for (const side of ["L", "R"] as const) {
    const S = SIDES[side], top = C(S.h);
    g[S.h] = lerp(top, { x: top.x + out[side] * 0.04 * sw, y: hipBotY }, e);
  }
  const hipMid = mid(g[23], g[24]);
  const shMidBot = { x: hipMid.x, y: hipMid.y - 0.78 * torso };
  const shMid = lerp(shMidTop, shMidBot, e);
  for (const side of ["L", "R"] as const) {
    const S = SIDES[side];
    g[S.s] = lerp(C(S.s), { x: shMidBot.x + (C(S.s).x - shMidTop.x), y: shMidBot.y }, e);
    // goblet hold: elbows down, hands together at the chest
    g[S.el] = { x: g[S.s].x - out[side] * 0.12 * sw, y: g[S.s].y + 0.42 * torso };
    g[S.w] = { x: shMid.x + out[side] * 0.07 * sw, y: g[S.s].y + 0.3 * torso };
  }
  const nose = C(0);
  const head = { x: shMid.x + (nose.x - shMidTop.x) * (1 - 0.08 * e), y: shMid.y + (nose.y - shMidTop.y) * (1 - 0.08 * e) };

  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.strokeStyle = "rgba(143,211,255,0.85)";
  ctx.lineWidth = Math.max(2, H * 0.004);
  const lx = Math.min(kb.L.x, kb.R.x) - 0.6 * sw, rx = Math.max(kb.L.x, kb.R.x) + 0.6 * sw;
  ctx.beginPath(); ctx.moveTo(lx, hipBotY); ctx.lineTo(rx, hipBotY); ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(143,211,255,0.38)";
  ctx.lineWidth = Math.max(8, H * 0.024);
  ctx.beginPath();
  for (const [a, b] of BONES) { ctx.moveTo(g[a].x, g[a].y); ctx.lineTo(g[b].x, g[b].y); }
  ctx.moveTo(shMid.x, shMid.y); ctx.lineTo(head.x, head.y);
  ctx.stroke();
  ctx.fillStyle = "rgba(143,211,255,0.30)";
  ctx.beginPath(); ctx.arc(head.x, head.y, Math.max(10, 0.2 * sw), 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export interface UserFlags { knees?: boolean; heels?: boolean; shift?: boolean; tilt?: boolean }

/** The user's skeleton; joints breaking a rule are drawn red. */
export function drawUser(ctx: CanvasRenderingContext2D, pose: Pose, flags: UserFlags) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const bad = new Set<number>();
  if (flags.knees) [23, 25, 27, 24, 26, 28].forEach(i => bad.add(i));
  if (flags.heels) [29, 30, 27, 28].forEach(i => bad.add(i));
  if (flags.shift || flags.tilt) [23, 24].forEach(i => bad.add(i));
  const P = (i: number) => ({ x: pose[i].x * W, y: pose[i].y * H, v: pose[i].v });
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(3, H * 0.007);
  for (const [a, b] of BONES) {
    const pa = P(a), pb = P(b);
    if (pa.v < 0.3 || pb.v < 0.3) continue;
    ctx.strokeStyle = bad.has(a) && bad.has(b) ? "#FF7A6B" : "rgba(238,240,234,0.92)";
    ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
  }
  const rad = Math.max(4, H * 0.008);
  for (const i of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]) {
    const q = P(i);
    if (q.v < 0.3) continue;
    ctx.fillStyle = bad.has(i) ? "#FF7A6B" : "#EEF0EA";
    ctx.beginPath(); ctx.arc(q.x, q.y, rad, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/** Ghost phase when it leads the tempo: hold, down, bottom, up. */
export function tempoPhase(t: number, minDown: number) {
  const hold = 1.0, down = minDown + 0.5, bottom = 0.5, up = 1.5;
  const x = t % (hold + down + bottom + up);
  if (x < hold) return 0;
  if (x < hold + down) return (x - hold) / down;
  if (x < hold + down + bottom) return 1;
  return 1 - (x - hold - down - bottom) / up;
}
