# Real-camera test plan: the 10 catalog exercises

Goal: check that reps are counted and that each check fires on the error and stays quiet on clean reps. Thresholds are [Placeholder]; this test is what tells us how to set them. Use light weight or an empty bar. Act out errors only where it is safe (column "Safe to act out").

## For every exercise

1. Open the app on the phone → exercise → **Start**. Turn on spoken cues for the bench press.
2. Place the phone as the setup screen says (side view, 2–3 m, whole body and bar in frame). Fitted clothes, good light.
3. **Set A: 5 clean reps** (plank: one 30 s hold). Expect: 5 reps, no issues.
4. **Set B: 5 reps, with one error per rep** from the list below.
5. Walk up, set up, rest between sets, walk away: **no extra reps** may appear (fixed in this version; tell us if it still happens).
6. On the review screen, label every rep with what you actually did, then save. Labels are the data we tune the limits with.
7. Write down: reps counted vs done, any wrong issue, any rep missed. If something is wrong, also record the set as a video and import it (`Video` button) so we can replay it.

## Errors to act out (light weight only)

| Exercise | Safe to act out | Don't act out |
|---|---|---|
| Back squat | Not deep enough, heels lifting, hips rise first | Knees caving with load (front view, bodyweight only) |
| Bench press | Half rep, no lockout, butt off the bench (empty bar) | Bar far from body with weight |
| Deadlift | Not locked out, leaning back at lockout (lightly) | Hips shooting up with heavy load |
| Pull-up | Chin not over the bar, no full hang, swinging, fast lowering | — |
| Bent-over row | Torso too upright, short pull, arms not fully lowered, torso swing | — |
| Overhead press | No lockout, bar ending in front, small leg dip | Big layback with weight |
| Barbell curl | Torso swing, elbows forward, partial curl | — |
| Dip | Not deep enough, dropping fast (only if shoulders are comfortable) | Going deeper than you normally can |
| Forward lunge | Not deep enough, knee past the toes, leaning forward | — |
| Plank | Hips sagging, hips piked, elbows forward of the shoulders, head down (a few seconds each) | — |

## Known risks to watch for

- **Back squat from the front:** the knee angle is foreshortened, so reps may not count. Use the side view for counting; front only for knee tracking.
- **Lunge:** walking in frame may look like a lunge. Note it if it counts.
- **Left/right swaps:** the pose model sometimes swaps sides for a few frames when one side hides the other. Note reps with odd numbers.
- **Bench press:** the bar and hands may hide each other; lying down in side view is the hardest case for the model.
