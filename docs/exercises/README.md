# Exercise form standards

One file per exercise. Each file is the single reference for what "correct" means for that exercise, what the camera measures, and the numbers the app uses. The app's thresholds come from here (and are stored as versioned rule sets in the `rule_sets` table).

| Exercise | File | Status |
|---|---|---|
| Bodyweight / goblet squat | [squat.md](squat.md) | Draft v0, not coach-reviewed |
| Lunge | — | Not started |
| Standing dumbbell press | — | Not started |

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
