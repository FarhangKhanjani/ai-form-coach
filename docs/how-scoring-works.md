# How the app decides if a rep is correct

Written 2026-10-13 for app v0.2. Plain-language explanation for the team and the coach.

## 1. Two different things people call "the model"

| | What it does | Is it machine learning? | Do we train it? |
|---|---|---|---|
| **Pose model** (MediaPipe Pose Landmarker, by Google) | Looks at each camera frame and outputs 33 body points (shoulders, hips, knees, ankles, heels, toes…) with x/y position, a depth estimate and a "visibility" confidence. Also outputs the same points in 3D metres ("world landmarks"). | Yes, a pretrained neural network (~1.3M parameters for Lite). Runs on the phone. | **No.** We use it as-is (decision D2). |
| **The judge** (our code in `src/exercises/squat/`) | Turns the 33 points into measurements and decides "clean" or "knees caving", "not deep enough", etc. | **No.** It is hand-written rules: measurement → compare with a limit → flag. | Nothing to train. We *choose* the limits. |

So today: **a neural network finds your joints, and plain if/else rules judge your form.** No model of ours has been trained.

## 2. The pipeline, step by step

1. **Camera frame → 33 points.** MediaPipe, ~20–30 times per second.
2. **Smoothing.** Points jitter a little between frames, so each new position is averaged with the previous one.
3. **Calibration.** You stand still for ~1.5 s. That standing pose becomes *your* reference: your hip-to-knee height, leg length, hip width, where your knees and heels are. Everything after is measured relative to your own body, so height and distance to the camera don't matter. Calibration is refused if you aren't facing the camera squarely (session 1 lesson).
4. **Measurements every frame** (front view). Mostly ratios, not angles, because flat 2D angles from the front were unreliable in session 1:
   - **Depth:** hip-to-knee vertical gap now ÷ the gap when standing (1 = standing, 0 = hips level with knees).
   - **Knee width ÷ ankle width**, and **how far each knee moved inward** since standing (÷ hip width).
   - **Heel rise** ÷ leg length.
   - **Side shift:** hips vs feet, ÷ hip width, change from standing.
   - **Hip tilt:** left vs right hip height, ÷ hip width, change from standing.
5. **Rep detection.** A rep starts when the hips drop below 78% of the standing gap and ends when they come back above 85%. Down time is measured from where the hips started dropping.
6. **Scoring at the end of the rep.** For each check, take the *worst* value while you were in the bottom half of the squat and compare it with its limit (`src/exercises/squat/config.ts`):

   | Error | Flagged when | Current limit |
   |---|---|---|
   | Knees caving | knee width < 0.9 × ankle width, or a knee moved inward > 15% of hip width | [Placeholder] |
   | Heels lifting | heel rose > 4% of leg length | [Placeholder] |
   | Not deep enough | more than 15% (+5% tolerance) of the standing hip-knee gap left | [Placeholder] |
   | Hips tilting | > 10% of hip width | [Placeholder] |
   | Shifting sideways | > 15% of hip width | [Placeholder] |
   | Too fast | down in < 1.5 s | [Placeholder] |

7. **Cue.** The most important error (safety first) is shown and spoken.

## 3. Do we need to train or fine-tune a model now?

**No.** Finding the right range for each measurement is enough for now, because each squat error we check is defined by one measurement crossing a limit.

What "finding the range" really is: once you have reps labeled good/bad, choosing the limit that best separates them *is* a tiny form of learning (fitting one number per rule). That's the next step, and it needs no GPU and no neural network.

Training becomes worth it later, if:
- an error depends on a **combination or timing** of measurements (e.g. "hips shoot up before the chest"), which hand rules capture badly;
- the rules plateau, e.g. too many false flags across different bodies, clothes and camera angles, and a small classifier on the keypoint sequence does better on a coach-labeled test set;
- we want a **quality score**, not just pass/fail.

Even then we would train a **small classifier on keypoints** (under 1M parameters, on a laptop), not fine-tune the pose model. Fine-tuning MediaPipe/RTMPose only makes sense if the *joint positions themselves* are wrong for gym poses. Nothing so far suggests that.

## 4. Where the right ranges come from

| Source | Gives us | Limits |
|---|---|---|
| **Research papers** (biomechanics, coaching science) | What correct looks like, often as **joint angles** measured in a lab (3D markers, usually side/3D). See `docs/exercises/squat.md` §7. | Lab angles ≠ what a phone sees from the front. They need translating into our measurements. Different studies define angles differently. |
| **Coaching standards** (NSCA, ACE, Myer 2014) | The criteria in words: thighs parallel, knees over toes, heels down, torso parallel to shins. | Few or no numbers. |
| **Public datasets with labels** (Fitness-AQA, QEVD) | Real reps labeled by experts. | Licenses must allow commercial use (many are non-commercial or gated). Fitness-AQA is barbell back squat, mostly gym video. |
| **Videos scraped from YouTube etc.** | Lots of examples. | **Not allowed for now** (decision D8): platform terms forbid downloading, EU text-and-data-mining opt-outs apply, and "mistake" videos exaggerate errors. Watching them to understand errors is fine; extracting data needs legal advice first. |
| **Our own reference recordings** | Our exact measurements for known-good and known-bad reps, from our camera setup. | Needs effort: two phones (front + side), you and your friend, then other people. |
| **Coach** | The final say on ranges, labels for a test set, ranking of errors. | A few hours per exercise. |

**Plan:**
1. Collect published numbers (started in `docs/exercises/squat.md` §7).
2. *(Done in v0.3.)* The app computes the angles the papers report from MediaPipe's 3D world landmarks (`src/pose/angles.ts`): knee flexion, hip flexion, trunk lean, shin lean and trunk-minus-shin, per side, at the bottom of every rep (`metrics.anglesAtBottom`), plus live on screen. Not yet used for scoring: first we check how close they are to the lab values and to a side view. Caveat: "vertical" is the camera's vertical, so the phone must stand upright.
3. Reference recordings: front + side at the same time, good reps and deliberate mistakes. *(Tool done in v0.4: Import video; protocol in `docs/data-collection.md`.)*
4. Set each limit where good and bad reps separate, and check it against the published ranges.
5. Coach reviews the ranges and labels a test set. Measure how often the app agrees with the coach.
6. Only if the rules plateau: train a small classifier.
