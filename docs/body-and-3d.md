# Body measurements, 3D angles and the ghost (v0.6)

## The problem

From the front camera, which most people use in the gym, a 2D skeleton can't see bending toward the camera. A squat's thigh points at the camera, so in the picture the knee hardly bends. The 10 catalog exercises measured 2D angles, so they only worked side-on. On top of that, the app asked for a landscape video. On an upright phone that is a narrow strip, so people stood far away and were small in the picture.

## What the app does now

1. **Camera shape** (`src/ui/camera.ts`): an upright phone asks for an upright video in the sensor's own 3:4 shape, uncropped (`resizeMode: none`) and at the widest zoom the camera allows; 16:9 video modes are usually cut out of the sensor and see less. Any camera can be picked by name (e.g. "Back Ultra Wide Camera" on iPhones). The screen shows what the camera actually gave (size, zoom, name). The drawing layer follows the video if its size changes.
2. **Framing hints** (`src/pose/framing.ts`): "feet out of the picture", "head out of the picture", "come closer", "move to the middle". The wide front lens distorts the edges of the picture, which bends limbs that are near the edge.
3. **3D skeleton** (`src/pose/lift.ts`): the 2D landmarks are accurate in the picture's plane. If a bone's true length L is known, the part the picture doesn't show must point toward or away from the camera: |depth| = √((s·L)² − (2D length)²), where s is the picture's scale. MediaPipe's world landmarks only decide *toward or away*, which they get right far more often than the distance. This is the classic single-camera reconstruction from known bone lengths (Taylor, "Reconstruction of articulated objects from point correspondences in a single uncalibrated image", CVIU 2000).
   - Bone lengths come from the **body profile** if the user made one. Otherwise they are learned from the world landmarks during the first seconds (upper percentile; turning and depth errors only make bones look shorter).
   - The depth given to a bone is capped at about twice the depth share the pose model itself sees, minus a small dead band for its noise (`DEPTH_TRUST`, `DEPTH_DEADBAND`, [Placeholder]). Without this cap, a few % error in the scale or a measured length turned a straight leg seen from the front into a bent one: a still person read 133° at the knee and could count reps. The model's depth is also smoothed over time.
   - The scale follows increases fast and decreases slowly. Bending makes every bone look short for a moment, but the real scale only drops when the person walks away.
   - Features are then computed in the body's own frame: a virtual side view (sagittal plane) for leans and positions, a virtual front view for widths, and true 3D joint angles. Side-view checks therefore also run from the front and at 45°.
4. **Body profile** (Profile → Body measurements, `src/pose/bodyScan.ts`): height plus a front photo (and an optional side photo for the feet). The pose model runs on the phone. Lengths are measured where each photo shows them at full length and turned into cm with the height. Only the numbers are saved (`profiles.body`, migration 5); the photos are never uploaded or stored.
   - The cm scale uses eye height ≈ 0.936 × standing height (the value usually quoted from Drillis & Contini 1966 via Winter; [Placeholder], not checked against the original). It only changes the cm shown; tracking uses ratios.
   - Parts no photo measured (feet without a side photo) use typical proportions [Placeholder] and are marked "typical value".
5. **Ghost for the 10 exercises** (`src/exercises/generic/ghost.ts`, `reference.ts`): the correct-form start and end poses of each exercise are built with the user's own segment lengths. They are turned the way the user stands (front, side, 45°, from behind), scaled to the picture, and pinned to the part of the body that doesn't move: feet, hands on the bar, shoulders on the bench, or elbows in the plank.
   - **Follows you:** the ghost is at your point in the movement and shows the correct posture there.
   - **Leads the tempo:** the ghost moves at a set pace (per-exercise tempo in `reference.ts`) and you follow it.

## Counting reps (v0.6.1)

A movement counts only when ≥ 80% of the exercise's rep criteria pass (`countIf` in `src/exercises/generic/catalog.ts`). Back squat: knees bent to ≤ 120°, hips dropped ≥ 15% of leg length (read from the picture's vertical, which jitter in depth can't fake), both knees bent, hips bent, 0.6–10 s, feet stayed in place, stance unchanged. Overhead press: arms straightened to ≥ 150°, hands above the head, hands rose ≥ 40% of torso length, both arms, 0.5–10 s, feet in place. All [Placeholder]. A real attempt that misses says which criteria failed. Tests: `counting.test.ts` (very shaky tracking of a still person: the old rule counts reps, the new one doesn't; a lunge step and a quarter squat aren't squats), `still.test.ts` (30 s standing still, 3 angles, learned or slightly-off body lengths: 0 reps).

## Tests

- `src/exercises/generic/views3d.test.ts`: the same reps, built in 3D and filmed from the front, at 45° and from the side, with MediaPipe-like squashed depth. They give the same counts and the same errors, and joint angles agree within 3°.
- `src/exercises/generic/ghost.test.ts`: a user in the reference pose is covered by the ghost (within 2% of the picture) from 5 directions.
- `src/pose/bodyScan.test.ts`, `src/pose/framing.test.ts`.
- e2e: a back squat filmed from the front (2 reps, the shallow one flagged), and body measurements from two photos (numbers saved, no photo data sent).

## Limits, still to check with real people

- Not yet validated on real recordings: compare front-view 3D angles against a side camera filming the same reps (backlog item 2).
- Assumes the phone stands upright (picture vertical = true vertical) and the person is at least ~2 m away.
- Loose clothes and the wide front lens still blur where the joints are; the body profile can't fix that.
- The reference poses are approximations from the dataset's checkpoints, not coach-validated [Placeholder].
- Bench press and plank stay side-view only (lying down, "forward" isn't well defined from the front).
