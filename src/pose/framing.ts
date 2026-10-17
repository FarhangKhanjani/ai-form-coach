// Is the person framed well enough to track? Short hints for the camera screen. No DOM.
import type { Pose } from "./types";

const FEET = [27, 28, 29, 30, 31, 32];
const SEEN = 0.5;

/**
 * A hint when part of the body is cut off, the person is too small in the picture, or near the edge
 * (phone lenses, the wide front camera most, stretch the edges of the picture). null when framing is fine.
 */
export function framingHint(pose: Pose): string | null {
  const pts = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, ...FEET].map(i => pose[i]);
  const shY = (pose[11].y + pose[12].y) / 2;
  const headTop = pose[0].y - 0.7 * Math.max(0, shY - pose[0].y);
  const xs = pts.map(p => p.x), ys = [...pts.map(p => p.y), headTop];
  const out = (v: number) => v < 0.01 || v > 0.99;
  const feetSeen = FEET.filter(i => pose[i].v > SEEN && !out(pose[i].y) && !out(pose[i].x)).length >= 2;
  if (!feetSeen) return "Your feet are out of the picture: step back, or put the phone lower.";
  if (headTop < 0 || pose[0].v < SEEN) return "Your head is out of the picture: step back, or put the phone higher.";
  if ([15, 16].some(i => out(pose[i].y) || out(pose[i].x))) return "Your hands leave the picture: step back a little.";
  if (xs.some(x => out(x))) return "Part of you is out of the picture: move toward the middle.";
  const size = Math.max(Math.max(...ys) - Math.min(...ys), Math.max(...xs) - Math.min(...xs));
  if (size < 0.4) return "Come a bit closer: you are small in the picture, so tracking is less precise.";
  const cx = (pose[23].x + pose[24].x) / 2;
  if (cx < 0.25 || cx > 0.75) return "Move toward the middle of the picture: the edges are distorted.";
  return null;
}

/** Hints must hold for a few frames before they show, so the banner doesn't flicker. */
export class FramingCoach {
  private last: string | null = null;
  private n = 0;
  update(pose: Pose | null): string | null {
    const h = pose ? framingHint(pose) : null;
    if (h === this.last) this.n++; else { this.last = h; this.n = 0; }
    return this.n >= 10 ? h : null;
  }
}
