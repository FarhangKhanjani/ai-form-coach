"""Summarize an exported squat session: per-rep metrics, tracking quality and bottom-of-rep angles.

Usage: python analysis/analyze_session.py path/to/squat-session-*.json [--aspect 0.75]

--aspect is the camera frame's width / height. The export doesn't store it yet;
0.75 (portrait 3:4) matched session 1. x is multiplied by it so angles use square pixels.
"""
import argparse
import json
import math


def angle(a, b, c):
    """Angle at b in degrees between b->a and b->c (2D or 3D tuples)."""
    u = [p - q for p, q in zip(a, b)]
    v = [p - q for p, q in zip(c, b)]
    nu, nv = math.hypot(*u), math.hypot(*v)
    if nu == 0 or nv == 0:
        return float("nan")
    cos = sum(p * q for p, q in zip(u, v)) / (nu * nv)
    return math.degrees(math.acos(max(-1.0, min(1.0, cos))))


def tracking_problems(frames):
    """Reasons a rep's keypoints can't be trusted (empty list = looks usable)."""
    problems = []
    if len(frames) < 10:
        problems.append(f"only {len(frames)} frames")
    off = sum(1 for f in frames for i in (23, 24, 25, 26, 27, 28)
              if not (0 <= f["lm"][i][0] <= 1 and 0 <= f["lm"][i][1] <= 1))
    if off:
        problems.append(f"{off} leg points outside the frame")
    low = sum(1 for f in frames for i in (27, 28) if f["lm"][i][3] < 0.7)
    if frames and low > 0.3 * 2 * len(frames):
        problems.append("ankles poorly visible")
    crossed = sum(1 for f in frames if f["lm"][27][0] - f["lm"][28][0] <= 0.01)
    if crossed:
        problems.append(f"left/right ankles swapped or overlapping in {crossed} frames")
    return problems


def bottom_frame(frames):
    return min(frames, key=lambda f: (f["lm"][25][1] + f["lm"][26][1]) - (f["lm"][23][1] + f["lm"][24][1]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("session")
    ap.add_argument("--aspect", type=float, default=0.75)
    args = ap.parse_args()
    s = json.load(open(args.session))
    A = args.aspect
    cal = s.get("calibration") or {}
    print(f"model={s.get('model')} view={s.get('view')} reps={len(s['reps'])} thresholds={s.get('thresholdsAtExport')}")
    if cal:
        print(f"calibration: standGap={cal['standGap']:.3f} legLen={cal['legLen']:.3f} shift0={cal['shift0']:+.2f}"
              + ("  <-- not standing centered/facing the camera" if abs(cal["shift0"]) > 0.15 else ""))
        pose = cal["standingPose"]
        cal_ankle_y = (pose[27]["y"] + pose[28]["y"]) / 2
    for r in s["reps"]:
        fr = r["frames"]
        head = (f"rep {r['n']:2d}: issues={','.join(r['issues']) or '-':28s} depth={r['depthPct']}% "
                f"knees={r['kneeRatio']} heel={r['heelLiftPct']}% shift={r['shiftPct']}% down={r['downTime']}s")
        probs = tracking_problems(fr)
        if probs:
            print(head + "\n         UNRELIABLE: " + "; ".join(probs))
            continue
        L = bottom_frame(fr)["lm"]
        p2 = lambda i: (L[i][0] * A, L[i][1])
        p3 = lambda i: (L[i][0] * A, L[i][1], L[i][2] * A)
        hip_w = abs(L[23][0] - L[24][0])
        knee_w = abs(L[25][0] - L[26][0])
        ankle_w = abs(L[27][0] - L[28][0])
        ankle_y = (L[27][1] + L[28][1]) / 2
        print(head)
        print(f"         bottom: knee angle 2D L/R={angle(p2(23), p2(25), p2(27)):.0f}/{angle(p2(24), p2(26), p2(28)):.0f}  "
              f"3D L/R={angle(p3(23), p3(25), p3(27)):.0f}/{angle(p3(24), p3(26), p3(28)):.0f}  "
              f"knee/ankle={knee_w / ankle_w:.2f}  shift/hipWidth="
              f"{(((L[23][0] + L[24][0]) - (L[27][0] + L[28][0])) / 2) / hip_w:+.2f}"
              + (f"  ankles moved {ankle_y - cal_ankle_y:+.2f} since calibration" if cal and abs(ankle_y - cal_ankle_y) > 0.05 else ""))


if __name__ == "__main__":
    main()
