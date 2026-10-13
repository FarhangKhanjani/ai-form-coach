# AI Form Coach

A camera-based workout coach: it tracks your body in real time, shows a translucent "ghost" of the correct movement scaled to your body, and gives short corrective cues. Video never leaves the device.

Current stage: a single-file browser prototype for the **squat** (`squat-coach.html`). Full context, decisions and backlog: [`docs/AI-Form-Coach-Project-Context.md`](docs/AI-Form-Coach-Project-Context.md).

## Try it

The camera needs a secure page, so don't double-click the file.

- **Laptop:** in this folder run `python -m http.server 8000`, then open `http://localhost:8000/squat-coach.html` in Chrome.
- **Phone:** enable GitHub Pages for this repo (or any https host) and open the page there.

Setup: camera 2–3 m away at about hip height, facing you, whole body including feet in frame, fitted clothes, good light. Stand still for about a second to calibrate, then squat.

## How a rep is judged

Everything is measured relative to **your own standing pose** captured during calibration. After each rep, five rules are checked; the thresholds are placeholders in the Rules panel until a coach sets them.

| Rule | Measured as | Default |
|---|---|---|
| Depth | Hip-to-knee vertical gap left at the bottom, as % of your standing gap | ≤ 15% left |
| Knees caving | Knee width ÷ ankle width at the bottom | ≥ 0.85× |
| Heels lifting | Heel rise above standing height, % of leg length | ≤ 4% |
| Side shift | Hip midpoint drift from ankle midpoint, % of stance width | ≤ 12% |
| Tempo | Time from top to bottom | ≥ 1.5 s |

The "Live" line under the Session buttons shows these numbers as you move.

## Tests

```
npm install playwright          # or use a global install
node tests/run-tests.mjs logic  # scripted squats through a fake pose model: calibration, reps, every rule, export
node tests/run-tests.mjs model  # real MediaPipe model on Chromium's fake camera: loads and runs without errors
```

The `model` test needs the MediaPipe files locally in `tests/vendor/` (git-ignored): `npm pack @mediapipe/tasks-vision@0.10.14` unpacked to `tests/vendor/package/`, and `pose_landmarker_lite.task` from Google's model storage in `tests/vendor/`. Set `CHROMIUM_PATH` if Playwright's own browser isn't installed.
