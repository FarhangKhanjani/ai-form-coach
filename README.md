# AI Form Coach

A camera-based workout coach: it tracks your body in real time, shows a translucent "ghost" of the correct movement scaled to your body, and gives short corrective cues. Video never leaves the device; only keypoints and rep results are saved.

**App:** https://farhangkhanjani.github.io/ai-form-coach/ — open it on your phone and use "Add to Home screen" to install it like an app.

Current stage: bodyweight squat (front camera, ghost) plus 10 lifts from the technique dataset (back squat, bench press, deadlift, pull-up, row, overhead press, curl, dip, lunge, plank), live or from imported videos, from the front, side or 45° (3D skeleton), with a ghost of the correct movement built to your body and per-rep labels; body measurements from two photos (analyzed on the phone, only the numbers saved); sign-up/sign-in (email or Google); sessions, reps, keypoints and labels saved to Supabase.

## Docs

- Project context, decisions, backlog: [`docs/AI-Form-Coach-Project-Context.md`](docs/AI-Form-Coach-Project-Context.md)
- How a rep is judged (pose model vs rules, when to train a model): [`docs/how-scoring-works.md`](docs/how-scoring-works.md)
- Body measurements, 3D angles from one camera, the ghost: [`docs/body-and-3d.md`](docs/body-and-3d.md)
- Datasets (what exists, licenses, what we can use): [`docs/datasets.md`](docs/datasets.md)
- Collecting our own labeled data (permission, filming, labeling): [`docs/data-collection.md`](docs/data-collection.md)
- What correct form is, per exercise, with sources: [`docs/exercises/`](docs/exercises/)
- Test session write-ups: [`docs/sessions/`](docs/sessions/)
- Supabase setup incl. Google sign-in: [`docs/setup-supabase.md`](docs/setup-supabase.md)

## Code map

| Path | What |
|---|---|
| `src/exercises/generic/` | Engine for the 10 dataset exercises: features, rep/hold detection, catalog of checks with dataset sources, test fixtures |
| `docs/research/` | The technique dataset the catalog is built from |
| `src/exercises/squat/` | Squat coach without any UI: calibration, frame metrics, rep detection and scoring, ghost drawing, thresholds (`config.ts`) |
| `src/pose/` | MediaPipe Pose loader, landmark types, 3D joint angles, 3D skeleton from known segment lengths (`lift.ts`), body measurements from photos (`bodyScan.ts`), framing hints |
| `scripts/fetch-assets.mjs` | Puts the MediaPipe runtime and pose models (pinned SHA-256) into `public/mediapipe/`, so the app serves them itself; runs before `dev` and `build` |
| `src/data/api.ts` | Supabase reads/writes (sessions, reps, keypoints, labels, profile) |
| `src/ui/` | Screens: sign-in, home/history, workout, review, import video, session, profile |
| `supabase/migrations/` | Database schema, row-level security, seeded exercises and rule sets |
| `analysis/` | Python scripts for exported sessions |
| `prototype/` | The original single-file prototype, kept for reference |

## Develop

```
npm install
npm run dev          # http://localhost:5173/ai-form-coach/ (camera works on localhost)
```

Use the phone on the same Wi-Fi: `npm run dev` prints a network URL, but phones only allow the camera on https, so testing on a phone is easiest through the deployed site.

Pushing to `main` runs the tests and deploys to GitHub Pages (`.github/workflows/deploy.yml`).

## Tests

```
npm test                         # squat logic on scripted squats (calibration, every rule, recalibration, glitches)
npm run build && npm run test:e2e  # built app in Chromium: sign in → workout → label → save (fake model and fake Supabase)
npm run test:db                  # migrations + access rules on a throwaway local Postgres 16
```

`test:e2e` needs Playwright's Chromium (or set `CHROMIUM_PATH`). `test:db` must run as a user that can start Postgres (see `.github/workflows/deploy.yml`).
