# Exercise form standards

One file per exercise. Each file is the single reference for what "correct" means for that exercise, what the camera measures, and the numbers the app uses. The app's thresholds come from here (and are stored as versioned rule sets in the `rule_sets` table).

| Exercise | File | Status |
|---|---|---|
| Bodyweight / goblet squat (front view, ghost) | [squat.md](squat.md) | Draft v0.1, not coach-reviewed |
| Barbell back squat | [back_squat.md](back_squat.md) | Generated v0, not coach-reviewed |
| Barbell bench press | [bench_press.md](bench_press.md) | Generated v0, not coach-reviewed |
| Conventional deadlift | [conventional_deadlift.md](conventional_deadlift.md) | Generated v0, not coach-reviewed |
| Pull-up | [pull_up.md](pull_up.md) | Generated v0, not coach-reviewed |
| Barbell bent-over row | [barbell_bent_over_row.md](barbell_bent_over_row.md) | Generated v0, not coach-reviewed |
| Overhead press | [overhead_press.md](overhead_press.md) | Generated v0, not coach-reviewed |
| Barbell curl | [barbell_curl.md](barbell_curl.md) | Generated v0, not coach-reviewed |
| Parallel-bar dip | [parallel_bar_dip.md](parallel_bar_dip.md) | Generated v0, not coach-reviewed |
| Forward lunge | [forward_lunge.md](forward_lunge.md) | Generated v0, not coach-reviewed |
| Forearm plank | [forearm_plank.md](forearm_plank.md) | Generated v0, not coach-reviewed |
| Standing dumbbell press | — | Not started |

The ten "Generated" files come from `docs/research/exercise_technique_dataset.json` (web coaching sources, 3+ per exercise, with agreement recorded per checkpoint) and the app's checks in `src/exercises/generic/catalog.ts`. Regenerate with `npx vite-node scripts/gen-exercise-docs.ts`; don't edit them by hand.

## Rules for these documents

- **Every number is a range or a limit with a tolerance, never one exact value.** Bodies differ (limb lengths, mobility, injuries), and the pose model has ±5–10° error in good setups.
- **Every number says where it comes from**, using one of these tags:
  - **[Source N]** — from a cited publication (listed at the bottom of the file).
  - **[Placeholder]** — our own starting value for testing; no published source.
  - **[Data]** — set from our own labeled recordings (name the session/dataset).
  - **[Coach]** — set or confirmed by a named coach, with date.
- **Say which camera view can measure each check** (front, side, diagonal), and what the app does when it can't.
- **Version the standard.** Changing a number = new version line in the changelog + a new `rule_sets` row. Old sessions keep the version they were scored with.
- **Coach sign-off** is recorded in the file's header (name, date, version).

## Template

```markdown
# <Exercise> — form standard

Version: v0 (draft) · Coach review: not yet · Last change: <date>

## 1. Setup
## 2. Correct movement, phase by phase
## 3. Checks: what is measured, from which view, correct range, source
## 4. Common errors (ranked: safety → technique → style) and the cue for each
## 5. Measurement limits
## 6. Open questions for the coach
## Changelog
## Sources
```
