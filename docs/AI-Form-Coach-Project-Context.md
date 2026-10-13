# AI Form Coach — Project Context for Claude

> **How to use this file.** This is the complete context for the AI Form Coach project as of 2026-10-13. Give it to Claude (for example as `CLAUDE.md` at the root of the repo in Claude Code, or as an attachment in a chat) before asking for any work. It contains the product idea, every decision made so far, the research behind them, the exercise rule spec, a full explanation of the current prototype, the backlog. The prototype's source is `squat-coach.html` at the repo root (the appendix copy was removed when the repo was created, so there is one source of truth).

---

## 0. Instructions for Claude

When you work on this project:

1. **Read sections 1–6 before changing code.** The decisions in section 2 are deliberate; don't reverse them without saying so and explaining why.
2. **Video never leaves the user's device.** Only keypoints and metrics may be stored or uploaded. The team is in Austria, so GDPR applies; body video and form data are personal and health-adjacent.
3. **Thresholds are placeholders.** Every numeric rule threshold is a starting value for testing. The coach sets final values; keep them configurable, never hard-code a "final" number.
4. **Pin every external dependency to an exact version** (currently `@mediapipe/tasks-vision@0.10.14`).
5. **Avoid license traps:** no YOLO / Ultralytics code (AGPL-3.0) and no SMPL body models (paid commercial license) without an explicit decision.
6. **Prefer small, testable steps.** The prototype has not yet been tested with a real camera (see 7.8). Fix and verify before adding features.
7. **Keep the export format backward compatible** (section 7.6). Labeled sessions are the future training dataset.

---

## 1. Product summary

**One line:** a camera-based workout coach that tracks your body in real time, shows a translucent "ghost" of the correct movement scaled to your body for you to move into, and gives short corrective cues.

**How the idea evolved** (from the founders' brainstorm):
1. A dedicated device → too expensive (tens of thousands per unit to develop).
2. An iPad with its camera → still hardware-heavy.
3. A small standalone camera (GoPro-like, own mount, any angle) that streams to the user's phone, which acts as the screen.
4. **Current decision: app-first using the phone's own camera.** Hardware only if testing proves phone placement is the real bottleneck.

**Core differentiator:** the ghost overlay. Seeing where your knee should be is far easier than hearing "move your knee two degrees". Voice cues and tempo guidance are secondary channels.

**Team:** two founders (one is an M.Sc. AI student at JKU Linz with a computer-vision and Python/FastAPI/Supabase background) plus coach contacts who will define and validate correct form.

---

## 2. Decisions made so far

| # | Decision | Reason |
|---|---|---|
| D1 | App-first with the phone camera; no hardware yet | Peloton Guide (camera hardware) was discontinued; the software must prove value first |
| D2 | Pose model: MediaPipe Pose Landmarker (pretrained, not trained by us) | Free (Apache 2.0), 33 points incl. heels and toes, runs on phone/web, 3D world coords |
| D3 | Pose inference runs on-device; store keypoints, not video | Real-time feedback needs it; ~30× less data; simpler GDPR |
| D4 | Rules first (joint angles + coach thresholds), ML later | "What is correct" is the hard part, not the model; rules need no data |
| D5 | First three exercises: bodyweight/goblet squat, lunge, standing dumbbell press | Screen visible during the movement, joints unoccluded, errors measurable as angles, testable at home |
| D6 | Front camera view as default | User can watch the overlay; depth from the front is the known weak spot to test |
| D7 | Books → draft rules; coach → choose the standard, set thresholds, label a test set | Books give cues in human words; coach translates them into what the camera can measure |
| D8 | Don't train on scraped online videos until legal advice is obtained | YouTube terms forbid downloading; EU TDM opt-outs; staged "mistake" videos exaggerate errors |
| D9 | First prototype: single HTML file in the browser | Works on laptop and phone, no app store, fastest to iterate |

Rejected for the first version: machine exercises (low value, frame occludes joints, gym-only), bench press (user can't see the screen while lying down, bar path needs a second model).

---

## 3. Market and risks

- **Peloton Guide**, a TV-connected camera with movement tracking and a "Self Mode" to compare form with the instructor, launched in 2022, had its price cut, a $9.1M inventory write-down in 2024, and sales ended worldwide on July 30, 2025. Lesson: a separate camera alone did not create enough value.
- **App-only competitors already exist** (e.g. FormCoach, Form Coach on the App Store, PoseFit AI at $11.99/month). Pose estimation itself is a commodity. Our edge must come from the experience: the ghost overlay, tempo guidance, and coach-built correction rules.
- **Hardware risks** (for later): manufacturing, CE certification, inventory, returns, wireless video latency. The obvious alternative for users is a second phone or a €20 tripod.
- **Possible niche:** sport-specific technique (e.g. table tennis), where good coaches are scarce, may be easier to defend than generic gym form. Open question.

---

## 4. Technical research summary

### 4.1 Pose models

| Model | Keypoints | Parameters | Benchmark accuracy | Speed | License |
|---|---|---|---|---|---|
| MediaPipe Pose Landmarker (Lite / Full / Heavy) | 33 incl. heels, toes; 2D + 3D | ~1.3M / ~3.5M; Heavy not published | PCK@0.2 on HIIT: 93.5 / 95.7 / 97.5 | ~20–53 ms/frame | Apache 2.0 |
| MoveNet (Lightning / Thunder) | 17, 2D | ~2.4M / ~6.3M (estimated from file size) | mAP 63.0 / 72.0 | Real time on phone/browser | Apache 2.0 |
| RTMPose (t / s / m / l) | 17 (133 whole-body variant) | 3.3M / 5.5M / 13.6M / 27.7M | COCO AP 68.5 / 72.2 / 75.8 / 76.5 | s: 70+ FPS on Snapdragon 865 | Apache 2.0 |
| YOLO11-pose (n to x) | 17, multi-person | 2.9M–58.8M | COCO mAP 50.0–69.5 | Fast on GPU | AGPL-3.0 or paid |
| ViTPose (S / B / L / H) | 17 | 24M / ~86M / 307M / 632M | COCO AP 75.8–79.5 | Server GPU only | Apache 2.0 |
| Apple Vision 3D body pose | 17 joints in 3D | Not published | Not published | On-device, iOS 17+ | Free API, closed |

Accuracy numbers are not comparable across rows (different benchmarks). Upgrade path if MediaPipe isn't accurate enough: RTMPose-s/m. ViTPose is useful server-side to auto-label our own videos.

### 4.2 Real-world accuracy

- Knee angle vs reference: MAE ≈ 5.9° in good conditions; BlazePose Heavy MAE ≈ 7.1° with ~5° systematic underestimation, weaker for squats, deep flexion underestimated.
- Poor camera geometry + loose clothing during squats: knee flexion underestimated by 13.9 ± 15.1°.
- Practical meaning: ±5–10° in good setups. Good for "knees caving" / "not deep enough" with tolerance bands, not for "move 2 degrees". Control the setup (camera placement, full body in frame, fitted clothes) and calibrate thresholds against the coach, not textbook angles.
- MediaPipe has **no spine points**, so back rounding / lower-back arch cannot be measured directly.

### 4.3 Storage (own estimates)

1,000 users × three 30-min workouts/week ≈ 390,000 min/month.

| Stored | Per minute | Per month | Cost/month (Cloudflare R2, $0.015/GB, free egress) |
|---|---|---|---|
| 720p video | ~30 MB | ~11.7 TB | ~$175 added monthly; >$2,000/month after a year |
| Keypoints (33 × 4 values × 4 bytes × 30 fps) | ~1 MB | ~390 GB | ~$6 |

### 4.4 Training compute

| What we train | When | Hardware | Rough cost |
|---|---|---|---|
| Nothing (pretrained model + rules) | MVP | Laptop + phone | €0 |
| Small form classifier on keypoint sequences (<1M params) | Once labeled reps exist | Laptop or free Colab | ~€0 |
| Fine-tune RTMPose-s/m on fitness images | Only if the pose model fails on gym poses | One 24 GB GPU (RTX 4090, ~$0.34–0.69/hr on RunPod) | Likely < $50 |
| Pose model from scratch | Never | 8 GPUs, batch 256, 420 epochs (official config) | Not worth it |

**Datasets to look at** (check licenses before commercial use): Fitness-AQA (squat, row, overhead press; real gym videos; expert-annotated errors), Qualcomm QEVD (workouts with time-stamped coaching feedback).

### 4.5 Ghost overlay options

- **Now:** 2D. Calibrate the user's bone lengths, scale a reference skeleton. No extra model.
- **Later, maybe:** realistic 3D mesh via SMPL; commercial license from Meshcapade, listed at €1,500/year on one page and €5,000/year on another. Confirm before planning.

---

## 5. Where "correct form" comes from

- **Books:** draft rules (e.g. NSCA-style cues). Must be translated into what the camera can measure.
- **Online videos:** for understanding errors and designing rules; not as training data until legal advice (D8).
- **Public datasets** with clear licenses: some training data.
- **Coach (a few hours per exercise):** choose the standard where sources disagree; translate cues into measurable rules; label a test set of real users' reps; rank errors by safety vs style; credibility.

**Training plan (later):** two models exist. The pose model is pretrained and never trained by us. The *form model* takes a keypoint sequence for one rep and outputs error types. It needs both correct reps **and** labeled examples of each specific error. Correct reference reps alone are still useful for the ghost and for a deviation score without training. Rough starting guess: a few hundred labeled reps per error type (to be confirmed by data). Measure inter-coach agreement; it is the ceiling for any model. Data must cover different body types, heights, camera angles and clothing.

---

## 6. Exercise rule spec (draft for coach review)

Thresholds are intentionally open; the coach sets them.

| Exercise | Error | Measurement | Front view enough? |
|---|---|---|---|
| Squat | Not deep enough | Hip height vs knee height | Weak; best from the side |
| Squat | Knees caving in | Knee distance vs ankle distance | Yes |
| Squat | Heels lifting | Heel points rise above standing height | Partly |
| Squat | Shifting to one side | Hip midpoint drifts sideways from ankle midpoint | Yes |
| Squat | Rushing the rep | Time down vs up, from hip movement | Yes |
| Lunge | Front knee caving in | Front knee inside the hip-to-foot line | Yes |
| Lunge | Hips tilting | Left vs right hip height | Yes |
| Lunge | Leaning sideways | Shoulder midpoint not over hip midpoint | Yes |
| Lunge | Wrong depth / step length | Front knee angle at the bottom | Weak; best from the side |
| Dumbbell press | No full lockout | Elbow angle at the top | Yes |
| Dumbbell press | Uneven arms | Left vs right wrist height | Yes |
| Dumbbell press | Elbows flaring / wrists not stacked | Wrists not above elbows at the bottom | Yes |
| Dumbbell press | Too short a range | Wrists not down to about shoulder height | Yes |
| Dumbbell press | Arching the lower back | Not measurable (no spine points) | No; voice reminder only |

Only the **squat** is implemented so far.

---

## 7. The prototype: `squat-coach.html`

### 7.1 Overview

A single self-contained HTML file (HTML + CSS + one ES-module script). It opens the camera, runs MediaPipe Pose Landmarker in the browser, calibrates to the user's body, draws a ghost skeleton of a correct squat scaled to the user, checks five squat rules live, counts reps, gives one on-screen + spoken cue per rep, and logs every rep with its keypoints for labeling and JSON export.

### 7.2 How to run

The camera requires a secure context, so don't open the file by double-clicking.

- **Laptop:** `python -m http.server 8000` in the file's folder → open `http://localhost:8000/squat-coach.html` (Chrome recommended).
- **Phone:** host on any https address, e.g. a GitHub repo with GitHub Pages enabled.
- Needs internet on first load (fonts, MediaPipe from jsDelivr, model from Google storage).

### 7.3 External dependencies

| What | URL | Notes |
|---|---|---|
| MediaPipe Tasks Vision JS | `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs` | Pinned |
| WASM files | `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm` | Loaded by `FilesetResolver` |
| Pose model (Lite / Full) | `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_{lite,full}/float16/1/...task` | Selectable on the start screen |
| Fonts | Google Fonts: Barlow, Barlow Condensed | Fallbacks set |

Published claude.ai artifact pages can't run this (their content-security policy blocks the WASM/model downloads and there is no camera access), which is why it is a local file.

### 7.4 App flow

1. **Start screen:** setup tips, model (Lite/Full), camera (front/back), "Start camera". Errors shown for insecure page, blocked camera, model load failure. GPU delegate falls back to CPU.
2. **Calibration:** user stands still, full body visible, facing the camera. 40 consecutive still frames (mean movement of hips/knees/ankles/shoulders < 0.006 normalized units per frame) are averaged into a standing pose. Rejected if the hip-to-knee gap is < 0.03 (user too far away).
3. **Tracking:** per frame: smoothing → visibility/frontal checks (banners) → metrics → ghost + user skeleton → depth meter → rep state machine.
4. **After each rep:** issues evaluated, rep logged, cue shown and spoken.

### 7.5 Algorithms

Landmark indices (MediaPipe): 0 nose, 11/12 shoulders, 13/14 elbows, 15/16 wrists, 23/24 hips, 25/26 knees, 27/28 ankles, 29/30 heels, 31/32 toes (odd = person's left). Coordinates are normalized to the video frame, y grows downward.

- **Smoothing:** exponential, α = 0.5 on x, y, z.
- **Visibility gate:** hips, knees, ankles, shoulders must have visibility > 0.5.
- **Frontal check:** shoulder width > 0.35 × torso length, otherwise "turn to face the camera".
- **Depth ratio** `r = (kneeY − hipY) / standGap`, where `standGap` is the calibrated standing hip-to-knee vertical gap. r = 1 standing, 0 = hips level with knees (front-view estimate of parallel).
- **Depth progress** `p = clamp((1 − r) / (1 − t), 0, 1)`, where `t` = depth target (gap left, default 15%). p = 1 means target reached.
- **Knee ratio** `kr = |kneeL.x − kneeR.x| / |ankleL.x − ankleR.x|`; flagged when `kr < kneeMin` while `p > 0.4`.
- **Heel lift** `hl = (calHeelY − heelY) / legLen` (only heels with visibility > 0.5); flagged when `hl × 100 > heelMax` while `p > 0.4`.
- **Side shift** `shift = (hipMid.x − ankleMid.x) / (ankleL.x − ankleR.x) − shift0`; positive = toward the person's left; flagged when `|shift| × 100 > shiftMax` while `p > 0.4`.
- **Rep state machine:** `top` → `down` when r < 0.78; track min r and its time; `down` → `up` when r rises 0.12 above the minimum; rep completes when r > 0.85. Ignored if min r > 0.6 (too small) or the rep lasts > 12 s. Down time = start → bottom, where start is the last moment the hips were at their highest (within 0.03 of r's peak, at most 3 s before the 0.78 trigger); up time = bottom → top.
- **Issues per rep** (priority order for the spoken cue, safety first): knees (min kr < kneeMin) → heels → shallow (min r > t) → shift → fast (down time < minDown).
- **Ghost geometry (2D approximation, to be corrected by the coach):** anchored at the user's current ankle midpoint. Standing pose = calibrated pose. Bottom pose: knees move out 0.18 × shin and up to 0.85 × shin above the ankles (foreshortened shin); hips drop to knee level minus the depth-target gap and move out 0.04 × shoulder width; shoulders sit 0.78 × torso above the hips (forward lean foreshortened); arms in a goblet hold; head follows the shoulders. Interpolated with ease-in-out on phase p.
- **Ghost modes:** "follows your depth" (phase = user's p) or "leads the tempo" (clock: 1.0 s hold, minDown + 0.5 s down, 0.5 s bottom, 1.5 s up).
- **Depth target line:** dashed line at the ghost's bottom hip height.

### 7.6 Export format (JSON)

```json
{
  "app": "squat-coach-prototype",
  "version": 1,
  "exportedAt": "ISO-8601",
  "model": "lite | full",
  "view": "front",
  "landmarkFormat": "MediaPipe Pose 33 landmarks, each [x, y, z, visibility], x/y normalized to the video frame",
  "thresholdsAtExport": { "depthGap": 15, "kneeMin": 0.85, "heelMax": 4, "shiftMax": 12, "minDown": 1.5 },
  "calibration": { "standGap": 0.0, "legLen": 0.0, "shift0": 0.0, "standingPose": [{ "x": 0.0, "y": 0.0 }] },
  "reps": [
    {
      "n": 1, "depthPct": 100, "kneeRatio": 0.92, "heelLiftPct": 1.2, "shiftPct": -3.4,
      "downTime": 1.8, "upTime": 1.2,
      "issues": ["knees", "heels", "shallow", "shift", "fast"],
      "thresholds": { "...": "snapshot at rep time" },
      "label": "" ,
      "frames": [{ "t": 0.033, "lm": [[0.5, 0.4, -0.1, 0.99]] }]
    }
  ]
}
```

`label` values: `""` (not labeled), `Correct`, `Knees caving`, `Not deep enough`, `Heels lifting`, `Shifting sideways`, `Too fast`, `Other`. Each rep's `frames` holds all 33 landmarks per frame from rep start to finish.

### 7.7 Code map

| Part | What it does |
|---|---|
| `DEFAULTS`, `loadThresholds`, `saveThresholds`, `sliders` | Threshold defaults, localStorage persistence, Rules panel sliders |
| `ensureLandmarker`, `start`, `stop` | Model loading (GPU → CPU fallback), camera start/stop, mirroring for the front camera |
| `beginCalibration`, `calibrateStep` | Stillness detection and standing-pose averaging |
| `loop`, `process` | Frame loop, smoothing, visibility/frontal checks, metrics, drawing, rep handling |
| `stepRep`, `finishRep` | Rep state machine, per-rep issues, cues, logging |
| `tempoPhase` | Ghost phase in "leads the tempo" mode |
| `drawGhost`, `drawUser`, `updateMeter` | Canvas drawing of ghost, depth line, user skeleton with red rule-breaking joints; depth meter |
| `renderLog`, `updateStats`, export handler | Rep log with label dropdowns, stats, JSON download |

### 7.8 Status and known limitations

- **Not yet tested with a real person on camera.** Automated tests (`tests/`) cover: the real MediaPipe Lite model loading and running in Chromium on a fake camera, and the full calibration → rep → rules → export path with scripted front-view squats (one clean rep and one rep per error type).
- Front-view depth is an estimate; it must be validated against a side view.
- Ghost bottom pose is an approximation, not coach-validated.
- Heel points are often poorly visible from the front.
- Single person only; no handling of a second person entering the frame.
- Ghost only translates with the user's feet; it doesn't rescale if the user moves closer or farther (recalibrate instead).
- Spine/lower-back errors are not measurable.
- No backend, no accounts; the session lives in memory until exported.

---

## 8. Backlog (in order)

1. **Test and fix the squat prototype** on a laptop and a phone. Acceptance: calibration succeeds in < 5 s in normal light; reps counted correctly for 10 consecutive squats; no console errors.
2. **Depth validation:** add a side-view mode (or a second-phone recording workflow) and compare front-view depth against side-view depth for the same reps.
3. **Coach review session:** update the ghost bottom pose and thresholds; move thresholds into a versioned rules config (JSON) per exercise.
4. **Refactor** into modules (pose service, calibration, per-exercise rule modules, ghost renderer, UI) so lunge and dumbbell press can be added cleanly.
5. **Add lunge, then standing dumbbell press** using the rule spec in section 6.
6. **User test with 5–10 people at home:** do they look at the overlay and fix their form? Log every complaint about phone placement (evidence for or against hardware).
7. **Data pipeline (Python):** load exported JSON sessions, compute per-rep features, train a small per-error classifier on keypoint sequences, compare against the rules on a coach-labeled held-out set.
8. **Backend:** FastAPI + Supabase storing keypoints and session summaries; optional opt-in short clips in Cloudflare R2 for labeling. No video by default.
9. **Later:** native mobile app; voice-only mode for exercises where the screen isn't visible; bar tracking for bench press; machine "gym mode"; hardware evaluation.

---

## 9. Open questions

- Is front-view depth accurate enough, or must depth become a voice cue with a side camera?
- Which book/standard will the coach choose as the reference?
- General fitness or one sport first (e.g. table tennis)?
- Legal status of using online videos for training in the EU.
- Current SMPL commercial price, if a 3D overlay is ever wanted.

---

## 10. Sources

- MediaPipe Pose: https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/pose.md
- BlazePose paper: https://arxiv.org/pdf/2006.10204
- MoveNet: https://www.tensorflow.org/lite/examples/pose_estimation/overview
- RTMPose paper: https://arxiv.org/abs/2303.07399
- RTMPose benchmark table: https://cdn05042023.gitlink.org.cn/OpenMMLab/mmpose/src/branch/main/projects/rtmpose/benchmark/README_CN.md
- Ultralytics YOLO11: https://docs.ultralytics.com/de/models/yolo11
- ViTPose paper: https://arxiv.org/abs/2204.12484
- Apple Vision 3D body pose: https://developer.apple.com/documentation/vision/identifying-3d-human-body-poses-in-images.md
- Knee angle, MediaPipe vs Kinovea: https://designlab.ku.edu.np/?p=1881
- BlazePose Heavy validation (JMIR preprint): https://preprints.jmir.org/preprint/102399
- Knee angle during squats, poor conditions: https://uniecampus.unifind.cineca.it/resource/item/100540
- Fitness-AQA: https://arxiv.org/pdf/2202.14019
- Qualcomm QEVD: https://docs.voxel51.com/dataset_zoo/datasets_hf/qualcomm_exercise_video_dataset_benchmark.html
- Cloudflare R2: https://cloudflare.com/en-ca/products/r2
- R2 vs S3 pricing: https://www.spendbase.co/?p=35561
- RunPod pricing: https://www.hackceleration.com/labs/runpod-pricing
- Meshcapade SMPL: https://meshcapade.com/assets/body-models and https://meshcapade.notion.site/The-SMPL-Model-Licenses-2144560e54388085af5eff111fcdf266
- Peloton Guide: https://www.engadget.com/peloton-guide-machine-learning-strength-training-152637209.html, https://www.pelobuddy.com/?p=38958, https://theclipout.com/peloton-guide-discontinued/
- Competitor apps: https://hunted.space/product/formcoach-ai-form-coach, https://apps.apple.com/app/id6770110788, https://www.producthunt.com/p/posefit-ai/posefit-ai

---
