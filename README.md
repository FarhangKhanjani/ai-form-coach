# AI Form Coach

A camera-based workout coach: it tracks your body in real time, shows a translucent "ghost" of the correct movement scaled to your body, and gives short corrective cues. Video never leaves the device; only keypoints and rep results are saved.

**App:** https://farhangkhanjani.github.io/ai-form-coach/ — open it on your phone and use "Add to Home screen" to install it like an app.

Current stage: squat (front camera), with sign-up/sign-in (email or Google) and saving sessions, reps, keypoints and your own rep labels to Supabase.

## Docs

- Project context, decisions, backlog: [`docs/AI-Form-Coach-Project-Context.md`](docs/AI-Form-Coach-Project-Context.md)
- How a rep is judged (pose model vs rules, when to train a model): [`docs/how-scoring-works.md`](docs/how-scoring-works.md)
- Datasets (what exists, licenses, what we can use): [`docs/datasets.md`](docs/datasets.md)
- What correct form is, per exercise, with sources: [`docs/exercises/`](docs/exercises/)
- Test session write-ups: [`docs/sessions/`](docs/sessions/)
- Supabase setup incl. Google sign-in: [`docs/setup-supabase.md`](docs/setup-supabase.md)

## Code map

| Path | What |
|---|---|
| `src/exercises/squat/` | Squat coach without any UI: calibration, frame metrics, rep detection and scoring, ghost drawing, thresholds (`config.ts`) |
| `src/pose/` | MediaPipe Pose loader and landmark types |
| `src/data/api.ts` | Supabase reads/writes (sessions, reps, keypoints, labels, profile) |
| `src/ui/` | Screens: sign-in, home/history, workout, review, session, profile |
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
