# AI Form Coach — Project Context for Claude

> **How to use this file.** This is the complete context for the AI Form Coach project as of 2026-10-13. Give it to Claude (for example as `CLAUDE.md` at the root of the repo in Claude Code, or as an attachment in a chat) before asking for any work. It contains the product idea, every decision made so far, the research behind them, the exercise rule spec, a full explanation of the current prototype, the backlog, and, in the appendix, the complete source of the prototype (`squat-coach.html`).

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
- **Rep state machine:** `top` → `down` when r < 0.78; track min r and its time; `down` → `up` when r rises 0.12 above the minimum; rep completes when r > 0.85. Ignored if min r > 0.6 (too small) or the rep lasts > 12 s. Down time = start → bottom; up time = bottom → top.
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

- **Syntax-checked only; not yet tested with a real camera.** Expect first-run bugs.
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

## Appendix A: full source of `squat-coach.html`

Save the block below as `squat-coach.html` to recreate the prototype exactly.

````html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Squat coach prototype</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Barlow:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#18222D; --stage:#121C26; --panel:#1E2B38; --line:#2F4051;
  --chalk:#EEF0EA; --muted:#9AA8B4;
  --ghost:#8FD3FF; --good:#7FD99A; --warn:#FFB547; --bad:#FF7A6B;
  --display:"Barlow Condensed","Arial Narrow",system-ui,sans-serif;
  --body:"Barlow",system-ui,-apple-system,"Segoe UI",sans-serif;
}
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:var(--bg);color:var(--chalk);font-family:var(--body);font-size:16px;line-height:1.45}
body{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
button,select,input{font:inherit;color:inherit}
:focus-visible{outline:2px solid var(--ghost);outline-offset:2px}

.app{display:grid;grid-template-columns:minmax(0,1fr) 360px;height:100%}
.stage{position:relative;background:var(--stage);overflow:hidden;min-height:0}
.stage video,.stage canvas{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
.mirror{transform:scaleX(-1)}

/* HUD */
.reps{position:absolute;left:20px;top:12px;display:flex;align-items:baseline;gap:8px;pointer-events:none}
.reps b{font-family:var(--display);font-weight:700;font-size:clamp(56px,9vw,112px);line-height:1}
.reps span{font-family:var(--display);font-size:22px;color:var(--muted)}
.status{position:absolute;right:56px;top:20px;padding:6px 12px;border-radius:999px;background:rgba(24,34,45,.85);border:1px solid var(--line);font-size:14px;color:var(--muted)}
.status.live{color:var(--good);border-color:rgba(127,217,154,.5)}
.banner{position:absolute;left:50%;top:84px;transform:translateX(-50%);max-width:min(560px,86%);padding:10px 16px;border-radius:10px;background:rgba(255,181,71,.16);border:1px solid rgba(255,181,71,.6);color:var(--chalk);font-weight:500;text-align:center}
.cue{position:absolute;left:50%;bottom:28px;transform:translateX(-50%);max-width:88%;padding:10px 22px;border-radius:14px;background:rgba(24,34,45,.86);border:1px solid var(--line);font-family:var(--display);font-weight:600;font-size:clamp(28px,4.4vw,48px);line-height:1.1;text-align:center}
.cue.good{color:var(--good);border-color:rgba(127,217,154,.55)}
.cue.warn{color:var(--warn);border-color:rgba(255,181,71,.6)}
.cue.bad{color:var(--bad);border-color:rgba(255,122,107,.6)}

/* depth meter */
.meter{position:absolute;right:20px;top:72px;bottom:110px;width:14px;border-radius:7px;background:rgba(238,240,234,.1);overflow:hidden}
.meter i{position:absolute;left:0;right:0;bottom:0;height:0;background:var(--ghost);border-radius:7px;transition:height .08s linear}
.meter.reached i{background:var(--good)}
.meter-label{position:absolute;right:12px;bottom:84px;font-size:13px;color:var(--muted);width:60px;text-align:center}

/* overlays */
.overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(18,28,38,.9)}
.overlay[hidden],.banner[hidden],.cue[hidden]{display:none}
.intro{max-width:520px}
.intro h1{font-family:var(--display);font-weight:700;font-size:clamp(44px,7vw,64px);line-height:1;margin:0 0 12px}
.intro p{margin:0 0 16px;color:var(--muted);max-width:60ch}
.intro ul{margin:0 0 20px;padding-left:20px}
.intro li{margin-bottom:6px}
.row{display:flex;gap:12px;flex-wrap:wrap;align-items:end;margin-bottom:16px}
.field{display:flex;flex-direction:column;gap:4px;font-size:14px;color:var(--muted)}
select{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:8px 10px}
.btn{background:var(--ghost);color:#12202C;border:0;border-radius:10px;padding:12px 20px;font-weight:600;cursor:pointer}
.btn:disabled{opacity:.55;cursor:progress}
.btn.quiet{background:transparent;color:var(--chalk);border:1px solid var(--line);padding:8px 14px}
.error{color:var(--bad);margin-top:12px;min-height:1.4em}

.calib{text-align:center;max-width:440px}
.calib h2{font-family:var(--display);font-weight:600;font-size:36px;margin:0 0 8px}
.calib p{color:var(--muted);margin:0 0 16px}
.bar{height:10px;border-radius:5px;background:rgba(238,240,234,.12);overflow:hidden}
.bar i{display:block;height:100%;width:0;background:var(--ghost);transition:width .1s linear}

/* panel */
.panel{background:var(--panel);border-left:1px solid var(--line);overflow-y:auto;padding:20px}
.panel section{padding-bottom:20px;margin-bottom:20px;border-bottom:1px solid var(--line)}
.panel section:last-child{border-bottom:0}
.panel h2{font-family:var(--display);font-weight:600;font-size:24px;margin:0 0 12px}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}
.stats div{background:var(--bg);border-radius:10px;padding:10px}
.stats b{display:block;font-family:var(--display);font-size:30px;line-height:1}
.stats span{font-size:13px;color:var(--muted)}
.actions{display:flex;flex-wrap:wrap;gap:8px}
.choice{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}
.choice label{display:flex;gap:8px;align-items:center;cursor:pointer}
.legend{list-style:none;padding:0;margin:12px 0 0;font-size:14px;color:var(--muted)}
.legend li{display:flex;align-items:center;gap:10px;margin-bottom:6px}
.sw{width:26px;height:6px;border-radius:3px;display:inline-block}
.sw.dash{height:0;border-top:2px dashed var(--ghost);border-radius:0}
.slider{margin-bottom:14px}
.slider label{display:flex;justify-content:space-between;font-size:14px;margin-bottom:4px}
.slider output{font-weight:600}
.slider input{width:100%;accent-color:var(--ghost)}
.note{font-size:13px;color:var(--muted);margin:4px 0 10px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;color:var(--muted);font-weight:500;padding:4px 4px 6px;border-bottom:1px solid var(--line)}
td{padding:6px 4px;border-bottom:1px solid var(--line);vertical-align:top}
td select{padding:4px 6px;font-size:13px;max-width:118px}
.ok{color:var(--good)} .iss{color:var(--warn)}
.empty{color:var(--muted);font-size:14px}
.fps{font-size:12px;color:var(--muted)}

@media (max-width:900px){
  .app{grid-template-columns:1fr;height:auto}
  .stage{height:72vh;height:72svh}
  .panel{border-left:0;border-top:1px solid var(--line)}
}
@media (prefers-reduced-motion:reduce){.meter i,.bar i{transition:none}}
</style>
</head>
<body>
<div class="app">
  <main class="stage" id="stage">
    <video id="video" playsinline muted></video>
    <canvas id="canvas"></canvas>

    <div class="reps" aria-live="polite"><b id="repCount">0</b><span>reps</span></div>
    <div class="status" id="status">Camera off</div>
    <div class="meter" id="meter" aria-hidden="true"><i id="meterFill"></i></div>
    <div class="meter-label" aria-hidden="true">Depth</div>
    <div class="banner" id="banner" hidden></div>
    <div class="cue" id="cue" hidden aria-live="assertive"></div>

    <div class="overlay" id="intro">
      <div class="intro">
        <h1>Squat coach</h1>
        <p>Tracks your squat with the camera and shows a ghost of the correct movement for you to follow.</p>
        <ul>
          <li>Put the camera 2–3 m away at about hip height, facing you.</li>
          <li>Make sure your whole body, including your feet, is in the frame.</li>
          <li>Wear fitted clothes and use good light.</li>
          <li>Video never leaves this device. Keypoints are kept only if you export them.</li>
        </ul>
        <div class="row">
          <label class="field">Model
            <select id="modelSel">
              <option value="lite">Lite (faster)</option>
              <option value="full">Full (more accurate)</option>
            </select>
          </label>
          <label class="field">Camera
            <select id="camSel">
              <option value="user">Front camera</option>
              <option value="environment">Back camera</option>
            </select>
          </label>
          <button class="btn" id="startBtn">Start camera</button>
        </div>
        <div class="error" id="error" role="alert"></div>
      </div>
    </div>

    <div class="overlay" id="calib" hidden>
      <div class="calib">
        <h2>Stand tall and hold still</h2>
        <p id="calibMsg">Feet shoulder-width apart, arms relaxed, whole body in view.</p>
        <div class="bar"><i id="calibBar"></i></div>
      </div>
    </div>
  </main>

  <aside class="panel">
    <section>
      <h2>Session</h2>
      <div class="stats">
        <div><b id="statReps">0</b><span>Reps</span></div>
        <div><b id="statClean">0</b><span>Clean reps</span></div>
        <div><b id="statDown">–</b><span>Avg down time</span></div>
      </div>
      <div class="actions">
        <button class="btn quiet" id="recalBtn">Recalibrate</button>
        <button class="btn quiet" id="exportBtn">Export session (JSON)</button>
        <button class="btn quiet" id="stopBtn">Stop camera</button>
      </div>
      <p class="fps" id="fps"></p>
    </section>

    <section>
      <h2>Ghost and cues</h2>
      <div class="choice" role="radiogroup" aria-label="Ghost mode">
        <label><input type="radio" name="ghost" value="follow" checked> Ghost follows your depth</label>
        <label><input type="radio" name="ghost" value="lead"> Ghost leads the tempo</label>
      </div>
      <div class="choice">
        <label><input type="checkbox" id="voiceChk" checked> Speak cues after each rep</label>
      </div>
      <ul class="legend">
        <li><span class="sw" style="background:var(--ghost);opacity:.6"></span>Ghost: correct form</li>
        <li><span class="sw" style="background:var(--chalk)"></span>You</li>
        <li><span class="sw" style="background:var(--bad)"></span>Joint breaking a rule</li>
        <li><span class="sw dash"></span>Depth target for your hips</li>
      </ul>
    </section>

    <section>
      <h2>Rules</h2>
      <p class="note">Starting values for testing. Your coach should set the final ones.</p>
      <div class="slider">
        <label for="thDepth">Depth target: hip-to-knee gap left <output id="oDepth"></output></label>
        <input type="range" id="thDepth" min="0" max="40" step="1">
      </div>
      <div class="slider">
        <label for="thKnee">Knee width at bottom, min (× ankle width) <output id="oKnee"></output></label>
        <input type="range" id="thKnee" min="0.6" max="1.2" step="0.01">
      </div>
      <div class="slider">
        <label for="thHeel">Heel lift, max (% of leg length) <output id="oHeel"></output></label>
        <input type="range" id="thHeel" min="1" max="10" step="0.5">
      </div>
      <div class="slider">
        <label for="thShift">Side shift, max (% of stance width) <output id="oShift"></output></label>
        <input type="range" id="thShift" min="5" max="30" step="1">
      </div>
      <div class="slider">
        <label for="thDown">Time going down, min <output id="oDown"></output></label>
        <input type="range" id="thDown" min="0.5" max="3" step="0.1">
      </div>
      <button class="btn quiet" id="resetTh">Reset to defaults</button>
    </section>

    <section>
      <h2>Rep log</h2>
      <p class="note">Label each rep to build training data. Labels are included in the export.</p>
      <div id="logWrap"><p class="empty">No reps yet. Once you're calibrated, each squat appears here.</p></div>
    </section>
  </aside>
</div>

<script type="module">
import { PoseLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

const WASM_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODELS = {
  lite: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  full: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task"
};
const DEFAULTS = { depthGap: 15, kneeMin: 0.85, heelMax: 4, shiftMax: 12, minDown: 1.5 };
const STORE_KEY = "squatCoach.thresholds.v1";

const KEY = [23, 24, 25, 26, 27, 28];        // hips, knees, ankles
const CAL_FRAMES = 40;
const TOP_R = 0.85, START_R = 0.78;           // hip-to-knee gap ratios for rep detection
const SIDES = {
  L: { a: 27, k: 25, h: 23, s: 11, el: 13, w: 15, he: 29, f: 31 },
  R: { a: 28, k: 26, h: 24, s: 12, el: 14, w: 16, he: 30, f: 32 }
};
const LABELS = ["", "Correct", "Knees caving", "Not deep enough", "Heels lifting", "Shifting sideways", "Too fast", "Other"];
const CUES = {
  knees: "Push your knees out over your toes",
  heels: "Keep your heels down",
  shallow: "Go a bit deeper",
  shift: "Keep your weight centered",
  fast: "Slow down on the way down"
};

const $ = id => document.getElementById(id);
const video = $("video"), canvas = $("canvas"), ctx = canvas.getContext("2d");

let landmarker = null, landmarkerModel = null;
let stream = null, running = false, lastVideoTime = -1;
let smooth = null, cal = null, calSamples = [], calPrev = null;
let rep = { state: "top" }, reps = [], repNo = 0;
let ghostMode = "follow", tempoStart = 0;
let frames = 0, fpsT = performance.now();
let cueTimer = null;
let th = loadThresholds();

/* ---------- thresholds ---------- */
function loadThresholds() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (e) { /* storage unavailable */ }
  return { ...DEFAULTS };
}
function saveThresholds() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(th)); } catch (e) { /* ignore */ }
}
const sliders = [
  ["thDepth", "oDepth", "depthGap", v => v + "%"],
  ["thKnee", "oKnee", "kneeMin", v => Number(v).toFixed(2) + "×"],
  ["thHeel", "oHeel", "heelMax", v => v + "%"],
  ["thShift", "oShift", "shiftMax", v => v + "%"],
  ["thDown", "oDown", "minDown", v => Number(v).toFixed(1) + " s"]
];
function syncSliders() {
  for (const [inp, out, key, fmt] of sliders) {
    $(inp).value = th[key];
    $(out).textContent = fmt(th[key]);
  }
}
for (const [inp, out, key, fmt] of sliders) {
  $(inp).addEventListener("input", e => {
    th[key] = Number(e.target.value);
    $(out).textContent = fmt(th[key]);
    saveThresholds();
  });
}
$("resetTh").addEventListener("click", () => { th = { ...DEFAULTS }; saveThresholds(); syncSliders(); });
syncSliders();

document.querySelectorAll('input[name="ghost"]').forEach(r =>
  r.addEventListener("change", e => { ghostMode = e.target.value; tempoStart = performance.now() / 1000; }));

/* ---------- helpers ---------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const ease = p => p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
const r4 = v => Math.round(v * 10000) / 10000;

function setStatus(text, live = false) {
  const el = $("status");
  el.textContent = text;
  el.classList.toggle("live", live);
}
function setBanner(text) {
  const el = $("banner");
  if (text) { el.textContent = text; el.hidden = false; } else el.hidden = true;
}
function setCue(text, kind = "", holdMs = 0) {
  const el = $("cue");
  if (!text) { el.hidden = true; return; }
  el.textContent = text;
  el.className = "cue" + (kind ? " " + kind : "");
  el.hidden = false;
  clearTimeout(cueTimer);
  if (holdMs) cueTimer = setTimeout(() => { cueTimer = null; }, holdMs);
}
function speak(text) {
  if (!$("voiceChk").checked || !("speechSynthesis" in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    speechSynthesis.speak(u);
  } catch (e) { /* speech unavailable */ }
}

/* ---------- camera + model ---------- */
async function ensureLandmarker(model) {
  if (landmarker && landmarkerModel === model) return;
  if (landmarker) { landmarker.close(); landmarker = null; }
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
  const opts = delegate => ({
    baseOptions: { modelAssetPath: MODELS[model], delegate },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5
  });
  try {
    landmarker = await PoseLandmarker.createFromOptions(fileset, opts("GPU"));
  } catch (e) {
    landmarker = await PoseLandmarker.createFromOptions(fileset, opts("CPU"));
  }
  landmarkerModel = model;
}

async function start() {
  const btn = $("startBtn");
  $("error").textContent = "";
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    $("error").textContent = "The camera needs a secure page. Open this file through http://localhost or an https address.";
    return;
  }
  btn.disabled = true;
  btn.textContent = "Loading model…";
  setStatus("Loading model");
  try {
    await ensureLandmarker($("modelSel").value);
  } catch (e) {
    btn.disabled = false; btn.textContent = "Start camera"; setStatus("Camera off");
    $("error").textContent = "The pose model couldn't load. Check your internet connection and reload the page.";
    return;
  }
  const facing = $("camSel").value;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false
    });
  } catch (e) {
    btn.disabled = false; btn.textContent = "Start camera"; setStatus("Camera off");
    $("error").textContent = e && e.name === "NotAllowedError"
      ? "Camera access was blocked. Allow the camera in your browser's site settings, then try again."
      : "No camera could be opened. Check that no other app is using it, then try again.";
    return;
  }
  video.srcObject = stream;
  await video.play();
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const mirror = facing === "user";
  video.classList.toggle("mirror", mirror);
  canvas.classList.toggle("mirror", mirror);

  btn.disabled = false; btn.textContent = "Start camera";
  $("intro").hidden = true;
  beginCalibration();
  running = true;
  lastVideoTime = -1;
  tempoStart = performance.now() / 1000;
  requestAnimationFrame(loop);
}

function stop() {
  running = false;
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = null;
  video.srcObject = null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  $("calib").hidden = true;
  $("intro").hidden = false;
  setBanner(""); setCue("");
  setStatus("Camera off");
  $("fps").textContent = "";
}

function beginCalibration() {
  cal = null; calSamples = []; calPrev = null; smooth = null;
  rep = { state: "top" };
  $("calib").hidden = false;
  $("calibBar").style.width = "0%";
  $("calibMsg").textContent = "Feet shoulder-width apart, arms relaxed, whole body in view.";
  setCue("");
  setStatus("Calibrating");
}

$("startBtn").addEventListener("click", start);
$("stopBtn").addEventListener("click", stop);
$("recalBtn").addEventListener("click", () => { if (running) beginCalibration(); });

/* ---------- main loop ---------- */
function loop() {
  if (!running) return;
  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const now = performance.now();
    let res = null;
    try { res = landmarker.detectForVideo(video, now); } catch (e) { res = null; }
    process(res, now / 1000);
    frames++;
    if (now - fpsT > 1000) {
      $("fps").textContent = `${frames} frames per second · model: ${landmarkerModel}`;
      frames = 0; fpsT = now;
    }
  }
  requestAnimationFrame(loop);
}

function process(res, t) {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  if (!res || !res.landmarks || !res.landmarks.length) {
    smooth = null;
    setStatus("No one in view");
    setBanner("Step into the frame so the camera can see you.");
    updateMeter(0, false);
    return;
  }
  const raw = res.landmarks[0];
  if (!smooth) {
    smooth = raw.map(p => ({ x: p.x, y: p.y, z: p.z, v: p.visibility ?? 0 }));
  } else {
    const a = 0.5;
    for (let i = 0; i < raw.length; i++) {
      const s = smooth[i], p = raw[i];
      s.x += a * (p.x - s.x); s.y += a * (p.y - s.y); s.z += a * (p.z - s.z);
      s.v = p.visibility ?? 0;
    }
  }
  const P = i => ({ x: smooth[i].x * W, y: smooth[i].y * H, v: smooth[i].v });

  const allVis = KEY.every(i => smooth[i].v > 0.5) && smooth[11].v > 0.5 && smooth[12].v > 0.5;
  const sw = dist(P(11), P(12));
  const torso = dist(mid(P(11), P(12)), mid(P(23), P(24)));
  const frontal = sw > 0.35 * torso;

  if (!allVis) setBanner("Step back until your whole body, including your feet, is in view.");
  else if (!frontal) setBanner("Turn to face the camera. This prototype reads a front view.");
  else setBanner("");

  if (!cal) {
    setStatus("Calibrating");
    calibrateStep(allVis && frontal);
    drawUser(P, {});
    return;
  }

  setStatus("Tracking", true);
  if (!allVis) { drawUser(P, {}); updateMeter(0, false); return; }

  // ----- metrics (normalized coordinates, y grows downward)
  const s = smooth;
  const hipY = (s[23].y + s[24].y) / 2, kneeY = (s[25].y + s[26].y) / 2;
  const r = (kneeY - hipY) / cal.standGap;            // 1 = standing, 0 = hips level with knees
  const tGap = th.depthGap / 100;
  const p = clamp((1 - r) / (1 - tGap), 0, 1);       // 0 = standing, 1 = depth target reached

  const kneeW = Math.abs(s[25].x - s[26].x), ankleW = Math.abs(s[27].x - s[28].x);
  const kr = ankleW > 0.01 ? kneeW / ankleW : 1;

  let hl = 0;
  for (const i of [29, 30]) {
    if (s[i].v > 0.5) hl = Math.max(hl, (cal.heel[i] - s[i].y) / cal.legLen);
  }
  const stance = s[27].x - s[28].x;                   // positive in camera image (person's left is image right)
  let shift = 0;
  if (Math.abs(stance) > 0.01) {
    const hipMidX = (s[23].x + s[24].x) / 2, ankleMidX = (s[27].x + s[28].x) / 2;
    shift = (hipMidX - ankleMidX) / stance - cal.shift0;   // positive = toward the person's left
  }

  const bent = p > 0.4;
  const flags = {
    knees: bent && kr < th.kneeMin,
    heels: bent && hl * 100 > th.heelMax,
    shift: bent && Math.abs(shift * 100) > th.shiftMax
  };

  // ----- ghost
  let gp = p;
  if (ghostMode === "lead") gp = tempoPhase(t);
  drawGhost(P, gp, tGap);
  drawUser(P, flags);
  updateMeter(p, p >= 1);

  // ----- reps
  stepRep(t, r, p, kr, hl, shift, tGap, flags);
}

/* ---------- calibration ---------- */
function calibrateStep(ok) {
  const ids = [...KEY, 11, 12];
  if (!ok) {
    calSamples = []; calPrev = null;
    $("calibBar").style.width = "0%";
    return;
  }
  const cur = smooth.map(q => ({ ...q }));
  if (calPrev) {
    const move = ids.reduce((m, i) => m + Math.hypot(cur[i].x - calPrev[i].x, cur[i].y - calPrev[i].y), 0) / ids.length;
    if (move > 0.006) calSamples = [];
    else calSamples.push(cur);
  }
  calPrev = cur;
  $("calibBar").style.width = Math.round(100 * calSamples.length / CAL_FRAMES) + "%";
  if (calSamples.length < CAL_FRAMES) return;

  const n = calSamples.length;
  const pts = calSamples[0].map((_, i) => ({
    x: calSamples.reduce((a, f) => a + f[i].x, 0) / n,
    y: calSamples.reduce((a, f) => a + f[i].y, 0) / n
  }));
  const hipY = (pts[23].y + pts[24].y) / 2, kneeY = (pts[25].y + pts[26].y) / 2, ankleY = (pts[27].y + pts[28].y) / 2;
  const standGap = kneeY - hipY;
  if (standGap < 0.03) {
    calSamples = [];
    $("calibMsg").textContent = "You're quite far away. Move a little closer and hold still.";
    return;
  }
  const stance = pts[27].x - pts[28].x;
  const shift0 = Math.abs(stance) > 0.01
    ? (((pts[23].x + pts[24].x) / 2) - ((pts[27].x + pts[28].x) / 2)) / stance : 0;
  cal = {
    pts, standGap, legLen: ankleY - hipY, shift0,
    heel: { 29: pts[29].y, 30: pts[30].y }
  };
  $("calib").hidden = true;
  setCue("Ready. Start squatting.", "good");
  speak("Ready");
}

/* ---------- rep detection + rules ---------- */
function stepRep(t, r, p, kr, hl, shift, tGap, flags) {
  if (rep.state === "top") {
    if (r < START_R) {
      rep = { state: "down", start: t, minR: r, bottomT: t, minKr: Infinity, maxHl: 0, maxShift: 0, frames: [] };
      setCue("Down slowly", "");
    }
    return;
  }
  rep.frames.push({ t: r4(t - rep.start), lm: smooth.map(q => [r4(q.x), r4(q.y), r4(q.z), r4(q.v)]) });
  if (r < rep.minR) { rep.minR = r; rep.bottomT = t; }
  if (p > 0.4) {
    rep.minKr = Math.min(rep.minKr, kr);
    rep.maxHl = Math.max(rep.maxHl, hl);
    if (Math.abs(shift) > Math.abs(rep.maxShift)) rep.maxShift = shift;
  }
  if (flags.knees) setCue("Knees out", "bad");
  else if (flags.heels) setCue("Heels down", "bad");

  if (rep.state === "down" && r > rep.minR + 0.12) rep.state = "up";
  if (t - rep.start > 12) { rep = { state: "top" }; return; }
  if (r > TOP_R) { finishRep(t, tGap); rep = { state: "top" }; }
}

function finishRep(t, tGap) {
  if (rep.minR > 0.6) return;               // too small a movement to count
  const downTime = rep.bottomT - rep.start, upTime = t - rep.bottomT;
  const issues = [];
  if (rep.minKr < th.kneeMin) issues.push("knees");
  if (rep.maxHl * 100 > th.heelMax) issues.push("heels");
  if (rep.minR > tGap) issues.push("shallow");
  if (Math.abs(rep.maxShift * 100) > th.shiftMax) issues.push("shift");
  if (downTime < th.minDown) issues.push("fast");

  repNo++;
  const entry = {
    n: repNo,
    depthPct: Math.round(clamp((1 - rep.minR) / (1 - tGap), 0, 1.5) * 100),
    kneeRatio: Number((isFinite(rep.minKr) ? rep.minKr : 1).toFixed(2)),
    heelLiftPct: Number((rep.maxHl * 100).toFixed(1)),
    shiftPct: Number((rep.maxShift * 100).toFixed(1)),
    downTime: Number(downTime.toFixed(2)),
    upTime: Number(upTime.toFixed(2)),
    issues,
    thresholds: { ...th },
    label: "",
    frames: rep.frames
  };
  reps.unshift(entry);
  renderLog();
  updateStats();
  $("repCount").textContent = repNo;

  if (!issues.length) {
    setCue("Good rep", "good");
    speak(String(repNo));
  } else {
    let text = CUES[issues[0]];
    if (issues[0] === "shift") text = `You drift to your ${rep.maxShift > 0 ? "left" : "right"}. Keep your weight centered`;
    setCue(text, issues[0] === "knees" || issues[0] === "heels" ? "bad" : "warn");
    speak(`${repNo}. ${text}`);
  }
}

function tempoPhase(t) {
  const hold = 1.0, down = th.minDown + 0.5, bottom = 0.5, up = 1.5;
  const cycle = hold + down + bottom + up;
  const x = (t - tempoStart) % cycle;
  if (x < hold) return 0;
  if (x < hold + down) return (x - hold) / down;
  if (x < hold + down + bottom) return 1;
  return 1 - (x - hold - down - bottom) / up;
}

/* ---------- drawing ---------- */
const BONES = [[11, 12], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 29], [29, 31], [27, 31], [28, 30], [30, 32], [28, 32], [11, 13], [13, 15], [12, 14], [14, 16]];

function drawGhost(P, p, tGap) {
  const W = canvas.width, H = canvas.height;
  const ankleNow = mid(P(27), P(28));
  const calA = { x: (cal.pts[27].x + cal.pts[28].x) / 2 * W, y: (cal.pts[27].y + cal.pts[28].y) / 2 * H };
  const off = { x: ankleNow.x - calA.x, y: ankleNow.y - calA.y };
  const C = i => ({ x: cal.pts[i].x * W + off.x, y: cal.pts[i].y * H + off.y });

  const shin = (dist(C(25), C(27)) + dist(C(26), C(28))) / 2;
  const torso = dist(mid(C(11), C(12)), mid(C(23), C(24)));
  const sw = dist(C(11), C(12));
  const gapPx = cal.standGap * H;
  const e = ease(clamp(p, 0, 1));
  const shMidTop = mid(C(11), C(12));

  const g = {};
  const out = {};
  for (const side of ["L", "R"]) {
    const S = SIDES[side];
    out[side] = Math.sign(C(S.a).x - ankleNow.x) || (side === "L" ? 1 : -1);
    const kneeBot = { x: C(S.a).x + out[side] * 0.18 * shin, y: C(S.a).y - 0.85 * shin };
    g[S.k] = lerp(C(S.k), kneeBot, e);
    g[S.a] = C(S.a); g[S.he] = C(S.he); g[S.f] = C(S.f);
    g["kb" + side] = kneeBot;
  }
  const hipBotY = (g.kbL.y + g.kbR.y) / 2 - tGap * gapPx;
  for (const side of ["L", "R"]) {
    const S = SIDES[side];
    const top = C(S.h);
    g[S.h] = lerp(top, { x: top.x + out[side] * 0.04 * sw, y: hipBotY }, e);
  }
  const hipMid = mid(g[23], g[24]);
  const shMidBot = { x: hipMid.x, y: hipMid.y - 0.78 * torso };
  const shMid = lerp(shMidTop, shMidBot, e);
  for (const side of ["L", "R"]) {
    const S = SIDES[side];
    const rel = C(S.s).x - shMidTop.x;
    const top = C(S.s);
    g[S.s] = lerp(top, { x: shMidBot.x + rel, y: shMidBot.y }, e);
    // goblet hold: elbows down, hands together at the chest
    g[S.el] = { x: g[S.s].x - out[side] * 0.12 * sw, y: g[S.s].y + 0.42 * torso };
    g[S.w] = { x: shMid.x + out[side] * 0.07 * sw, y: g[S.s].y + 0.3 * torso };
  }
  const noseTop = C(0);
  const head = { x: shMid.x + (noseTop.x - shMidTop.x) * (1 - 0.08 * e), y: shMid.y + (noseTop.y - shMidTop.y) * (1 - 0.08 * e) };

  // depth target line
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.strokeStyle = "rgba(143,211,255,0.85)";
  ctx.lineWidth = Math.max(2, H * 0.004);
  const lx = Math.min(g.kbL.x, g.kbR.x) - 0.6 * sw, rx = Math.max(g.kbL.x, g.kbR.x) + 0.6 * sw;
  ctx.beginPath(); ctx.moveTo(lx, hipBotY); ctx.lineTo(rx, hipBotY); ctx.stroke();
  ctx.restore();

  // ghost body
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

function drawUser(P, flags) {
  const H = canvas.height;
  const bad = new Set();
  if (flags.knees) [23, 25, 27, 24, 26, 28].forEach(i => bad.add(i));
  if (flags.heels) [29, 30, 27, 28].forEach(i => bad.add(i));
  if (flags.shift) [23, 24].forEach(i => bad.add(i));
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

function updateMeter(p, reached) {
  $("meterFill").style.height = Math.round(clamp(p, 0, 1) * 100) + "%";
  $("meter").classList.toggle("reached", reached);
}

/* ---------- log, stats, export ---------- */
const ISSUE_TEXT = { knees: "Knees", heels: "Heels", shallow: "Depth", shift: "Shift", fast: "Tempo" };

function renderLog() {
  const wrap = $("logWrap");
  if (!reps.length) {
    wrap.innerHTML = '<p class="empty">No reps yet. Once you\'re calibrated, each squat appears here.</p>';
    return;
  }
  const rows = reps.map(r => {
    const iss = r.issues.length
      ? `<span class="iss">${r.issues.map(i => ISSUE_TEXT[i]).join(", ")}</span>`
      : '<span class="ok">Clean</span>';
    const opts = LABELS.map(l => `<option value="${l}"${l === r.label ? " selected" : ""}>${l || "Not labeled"}</option>`).join("");
    return `<tr><td>${r.n}</td><td>${r.depthPct}%</td><td>${r.kneeRatio.toFixed(2)}×</td><td>${r.downTime.toFixed(1)} s</td><td>${iss}</td>
      <td><select data-n="${r.n}" aria-label="Label for rep ${r.n}">${opts}</select></td></tr>`;
  }).join("");
  wrap.innerHTML = `<table><thead><tr><th>#</th><th>Depth</th><th>Knees</th><th>Down</th><th>Flags</th><th>Label</th></tr></thead><tbody>${rows}</tbody></table>`;
}
$("logWrap").addEventListener("change", e => {
  const sel = e.target.closest("select[data-n]");
  if (!sel) return;
  const r = reps.find(x => x.n === Number(sel.dataset.n));
  if (r) r.label = sel.value;
});

function updateStats() {
  $("statReps").textContent = reps.length;
  $("statClean").textContent = reps.filter(r => !r.issues.length).length;
  const avg = reps.reduce((a, r) => a + r.downTime, 0) / reps.length;
  $("statDown").textContent = reps.length ? avg.toFixed(1) + " s" : "–";
}

$("exportBtn").addEventListener("click", () => {
  const data = {
    app: "squat-coach-prototype",
    version: 1,
    exportedAt: new Date().toISOString(),
    model: landmarkerModel,
    view: "front",
    landmarkFormat: "MediaPipe Pose 33 landmarks, each [x, y, z, visibility], x/y normalized to the video frame",
    thresholdsAtExport: th,
    calibration: cal ? { standGap: cal.standGap, legLen: cal.legLen, shift0: cal.shift0, standingPose: cal.pts } : null,
    reps: reps.slice().reverse()
  };
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const a = document.createElement("a");
  const d = new Date();
  const pad = v => String(v).padStart(2, "0");
  a.href = URL.createObjectURL(blob);
  a.download = `squat-session-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});
</script>
</body>
</html>
````
