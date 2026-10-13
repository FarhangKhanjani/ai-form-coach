# Squat form standard (draft v0, for coach review)

What "correct" means for the bodyweight / goblet squat, what the camera can actually measure, and from which view. Every number is a starting value to be confirmed against labeled reps and a coach (project rule: thresholds are placeholders).

## 1. The standard, in coaching words

A correct rep, following common strength-coaching guidance (NSCA-style cues):

1. **Stance:** feet about shoulder width, toes turned out slightly (about 0–30°), weight over the mid-foot.
2. **Descent:** controlled, hips go back and down together with the knees bending. Roughly 2–3 s down.
3. **Knees:** track in line with the toes, never collapse inward.
4. **Feet:** heels stay on the floor the whole rep.
5. **Torso:** chest up, back neutral; torso leans forward roughly parallel to the shins.
6. **Depth:** the hip crease reaches at least the height of the top of the knee (thighs parallel to the floor), if mobility allows.
7. **Balance:** weight stays centered left/right; hips don't drop or tilt to one side.
8. **Ascent:** drive up, hips and chest rise together, finish standing tall.

## 2. What each view can measure

From session 1 (front view): the same knee angle at the bottom read **77° vs 69°** (left vs right) in 2D and **70° vs 97°** with MediaPipe's depth estimate. So **knee and hip bend angles are not usable from the front**. A side view sees them directly.

| Check | Measurement | Front view | Side view |
|---|---|---|---|
| Knees caving (valgus) | Frontal-plane knee angle per leg (hip–knee–ankle line), and knee width ÷ ankle width | **Good** | Not visible |
| Side shift | Hip midpoint vs ankle midpoint, ÷ **hip width** | **Good** | Not visible |
| Hip tilt / drop | Left vs right hip height | **Good** | Not visible |
| Depth | Front: hip-to-knee vertical gap (proxy). Side: thigh angle to the floor | Rough proxy | **Good** |
| Knee bend | Hip–knee–ankle angle | **Unusable** (see above) | **Good** |
| Torso lean | Shoulder–hip line vs vertical, compared with the shin angle | Unusable | **Good** |
| Heels lifting | Heel point rising above its standing height | Weak (heels often hidden) | **Good** |
| Tempo | Hip height over time | **Good** | **Good** |

Consequence: one phone can't check everything. Options to test, in order of effort:
- **A. Front view** for knees, shift and tilt, with depth as a rough proxy (what the prototype does now).
- **B. 45° diagonal view**: one phone that sees some of both. Worth testing; not validated.
- **C. Two phones (front + side)** for a reference recording. This is how we get ground truth even if users later have one phone.

## 3. Proposed rules (front view)

| Rule | Metric | Correct if | Start value | Notes |
|---|---|---|---|---|
| Depth | Hip-to-knee vertical gap left at the bottom, ÷ standing gap | ≤ gap target | 15% | Proxy; validate against side-view thigh angle |
| Knees | Knee width ÷ ankle width at the bottom | ≥ min | 0.9× | Session 1 good reps: 1.8–2.4× (wide stance) |
| Knees (per leg, new) | Frontal-plane knee angle, inward = valgus | ≤ max inward | 10° | Catches one knee caving even if the other goes out |
| Shift | (hip mid − ankle mid) ÷ hip width, change from standing | ≤ max | 0.15 | Session 1 good reps: 0.06–0.08. Replaces ÷ stance width, which blew up to ±2449% |
| Hip tilt (new) | Left vs right hip height ÷ hip width | ≤ max | 0.10 | |
| Heels | Heel rise ÷ leg length | ≤ max | 4% | Only when heels are visible; otherwise "not checked" |
| Tempo | Top-to-bottom time | ≥ min | 1.5 s | |

## 4. Why session 1 called good reps wrong

| Cause | Reps affected | Fix |
|---|---|---|
| Calibration done while not centered/facing the camera (`shift0 = −0.42`: hips sat well to one side of the feet). Every later rep was measured as "shifted" by ~45–50% | 1–3, 5, 6 | Reject calibration unless hips are over the ankles and both feet are level; normalize shift by hip width |
| You (or the phone) moved after calibrating: ankles 16–22% lower in the frame, so depth and heel baselines were stale | 3, 5, 6 | Detect that the feet moved and ask to recalibrate automatically |
| Tracking glitches counted as reps (1–19 frames, points off-screen, left/right ankles swapped) | 4, 7, 8, 9 | Drop reps with bad tracking instead of scoring them |
| Depth target on the edge: 99% reached → "shallow" | 6 | Tolerance band, and validate the depth proxy with a side view |

Reps 3, 5 and 6 were, by the measurable signals, good: deep (99–117% of target), knees well out (1.8–2.4× ankle width), heels down, slow descent (3–4.7 s), small real shift (0.06–0.08 of hip width).

## 5. How we get to a real standard

1. **Reference recording:** front + side phone at the same time. 10 reps you believe are correct, then 5 of each mistake on purpose. Label them in the app.
2. Use the side view as ground truth for depth and knee/hip angles; check which front-view metrics separate good from bad reps (`analysis/analyze_session.py`).
3. Set thresholds from that data, then have the coach review them and label a second set.
4. Store the rules as a versioned config file per exercise so the coach's values are tracked.
