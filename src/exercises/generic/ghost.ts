// Ghost for the catalog exercises: the reference pose (correct form) built with the user's own segment
// lengths, turned the way the user stands, scaled to the image and pinned to the part of the body that
// doesn't move (feet, hands …). Works from the front, the side or at 45° because it is built in 3D.
import type { Lifted, V3 } from "../../pose/lift";
import { BONES, clamp } from "../../pose/types";
import type { BodyAxes } from "./features";
import { blend, type PlanarSpec } from "./planar";
import { bodyPose, toCamera, type Reference } from "./reference";
import type { ExerciseDef } from "./types";

const ease = (p: number) => p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;

/** How far through the movement the user is: 0 at rest, 1 at the point a rep must reach. */
export function repProgress(def: ExerciseDef, signal: number | null): number {
  const sig = def.signal;
  if (!sig || signal === null) return 0;
  return clamp(sig.rest === "high" ? (sig.exit - signal) / (sig.exit - sig.mustReach) : (signal - sig.exit) / (sig.mustReach - sig.exit), 0, 1);
}

/** Ghost phase (0 rest → 1 peak) when it leads the tempo. */
export function tempoProgress(ref: Reference, t: number): number {
  const [up, top, down, rest] = ref.tempo;
  const x = t % (up + top + down + rest);
  if (x < rest) return 0;
  if (x < rest + up) return (x - rest) / up;
  if (x < rest + up + top) return 1;
  return 1 - (x - rest - up - top) / down;
}

export function ghostSpec(ref: Reference, def: ExerciseDef, phase: number): PlanarSpec {
  return def.mode === "hold" ? ref.peak : blend(ref.rest, ref.peak, ease(clamp(phase, 0, 1)));
}

/**
 * Ghost landmarks (normalized image coordinates, like MediaPipe's) for `spec`, or null without a 3D skeleton.
 * `facing` = the features' facing (+1/−1 along the body axis).
 */
export function ghostPose(ref: Reference, spec: PlanarSpec, lifted: Lifted, axes: BodyAxes, facing: number, aspect: number): { x: number; y: number }[] {
  const fwd = { x: axes.fwd.x * facing, y: 0, z: axes.fwd.z * facing };
  const left = { x: -fwd.z, y: 0, z: fwd.x };
  const P = lifted.pts;
  const frontLeg = dot({ x: P[27].x - P[28].x, y: 0, z: P[27].z - P[28].z }, fwd) >= 0 ? "L" : "R";
  const cam = toCamera(bodyPose(spec, lifted.dims, ref, frontLeg), fwd, left);
  const s = lifted.scale;
  const midOf = (pts: { x: number; y: number }[], a: number, b: number) => ({ x: (pts[a].x + pts[b].x) / 2, y: (pts[a].y + pts[b].y) / 2 });
  const pair = { feet: [27, 28], hands: [15, 16], shoulders: [11, 12], elbows: [13, 14], rearFoot: frontLeg === "L" ? [28, 28] : [27, 27] }[ref.anchor];
  const user = midOf(P, pair[0], pair[1]);
  const own = midOf(cam, pair[0], pair[1]);
  return cam.map(q => ({ x: (user.x + s * (q.x - own.x)) / aspect, y: user.y + s * (q.y - own.y) }));
}

/** Translucent ghost skeleton, drawn under the user's. */
export function drawGhostPose(ctx: CanvasRenderingContext2D, g: { x: number; y: number }[]) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const X = (i: number) => g[i].x * W, Y = (i: number) => g[i].y * H;
  const sw = Math.hypot(X(11) - X(12), Y(11) - Y(12));
  const torso = Math.hypot((X(11) + X(12) - X(23) - X(24)) / 2, (Y(11) + Y(12) - Y(23) - Y(24)) / 2);
  ctx.save();
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(143,211,255,0.38)";
  ctx.lineWidth = Math.max(8, H * 0.024);
  ctx.beginPath();
  for (const [a, b] of BONES) { ctx.moveTo(X(a), Y(a)); ctx.lineTo(X(b), Y(b)); }
  const shx = (X(11) + X(12)) / 2, shy = (Y(11) + Y(12)) / 2;
  ctx.moveTo(shx, shy); ctx.lineTo(X(0), Y(0));
  ctx.stroke();
  ctx.fillStyle = "rgba(143,211,255,0.30)";
  ctx.beginPath(); ctx.arc(X(0), Y(0), Math.max(10, 0.22 * Math.max(sw, 0.5 * torso)), 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
