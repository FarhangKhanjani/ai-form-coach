# Bodyweight / goblet squat — form standard

Version: v0.1 (draft) · Coach review: not yet · Last change: 2026-10-13

Tags: **[S1]–[S7]** = sources at the bottom · **[Placeholder]** = our own starting value, no published source · **[Data]** = from our recordings · **[Coach]** = coach-set.

## 1. Setup

| Item | Correct range | Source |
|---|---|---|
| Stance width (heels) | About shoulder width; roughly 1.0–1.5× shoulder width is common | Shoulder width = "narrow" stance in [S5] (87–118% of shoulder width); wider stances also valid [S5] |
| Toe-out angle | 0–30° each foot | [S5] compared 0° and 30° (reported via secondary summary; verify in full text). Some screens use ≤ 10° [S1-related, unverified] |
| Weight | Over the mid-foot, whole foot on the floor | [S1], [S3] |
| Goblet hold | Weight held at the chest, elbows down | [Placeholder] |
| Camera | Front: 2–3 m away, hip height, whole body including feet in frame. Side: same distance, 90° to the side | [Placeholder] |

## 2. Correct movement

1. **Start:** stand tall, feet set, hips and shoulders level.
2. **Descent (controlled):** hips go back and down while the knees bend; knees follow the direction of the toes; heels stay down; chest stays up and the torso leans forward about as much as the shins do.
3. **Bottom:** top of the thigh at least parallel to the floor, if mobility allows without losing heel contact or back position.
4. **Ascent:** hips and chest rise together; knees keep tracking over the toes; finish standing tall.

## 3. Checks

| Check | What "correct" means | Measured as | Front | Side | Correct range | Source |
|---|---|---|---|---|---|---|
| Depth | Top of thigh at least parallel to the floor | Side: thigh angle vs horizontal. Front: hip-to-knee vertical gap (proxy) | Proxy | ✔ | Side: thigh ≥ 0° below horizontal (≈ 100° knee flexion). Front proxy: ≤ 15% of standing gap left, ± 5% tolerance | Parallel: [S1], [S3], [S4]; ~100° knee flexion at parallel: [S6]; front numbers: [Placeholder] |
| Knees track over toes | Knee stays in line with the 2nd toe; outer knee never crosses inside the inner ankle | Knee width ÷ ankle width; per leg: how far the knee moved inward since standing (÷ hip width) | ✔ | — | Knee width ≥ 0.9× ankle width; inward knee movement ≤ 0.15 hip width | Criterion: [S1], [S3]. Numbers: [Placeholder]. Note: 2D angle measurement error ≈ 3°, smallest real change ≈ 8–9° [S7] |
| Heels down | Heels on the floor the whole rep | Heel point rise vs standing height | Weak | ✔ | ≤ 4% of leg length (allows for tracking noise) | Criterion: [S1], [S3], [S4]. Number: [Placeholder] |
| Torso angle | Torso roughly parallel to the shins; lower back neutral | Side: trunk angle minus shin angle | — | ✔ | Difference within ± 15° | Criterion: [S1], [S3]. Number: [Placeholder]. Back rounding itself is not measurable (no spine points) |
| Hips level | Line between the hips stays parallel to the floor | Left vs right hip height ÷ hip width | ✔ | — | ≤ 0.10 | Criterion: [S1]. Number: [Placeholder] |
| Centered | Weight stays centered left/right | (Hip midpoint − ankle midpoint) ÷ hip width, change from standing | ✔ | — | ≤ 0.15 | [Placeholder]; session 1 good reps: 0.06–0.08 [Data: session 1] |
| Knees forward | Knees may pass the toes somewhat; not excessively | Side: knee x vs toe x | — | ✔ | Not set yet | Criterion: [S1] gives no number. Forward knee travel is normal and depends on limb lengths [S2] |
| Tempo | Controlled descent | Time from top to bottom | ✔ | ✔ | ≥ 1.5 s down (2–3 s typical) | [Placeholder] — no published standard found |

## 4. Common errors, ranked

| Rank | Error | Severity | Cue |
|---|---|---|---|
| 1 | Knees caving in | Safety | "Push your knees out over your toes" |
| 2 | Heels lifting | Technique | "Keep your heels down" |
| 3 | Not deep enough | Technique | "Go a bit deeper" |
| 4 | Hips tilting / shifting sideways | Technique | "Keep your weight centered" |
| 5 | Excessive forward lean | Technique | "Chest up" |
| 6 | Too fast | Style | "Slow down on the way down" |

Ranking is a draft for the coach to confirm.

## 5. Measurement limits

- **One view can't check everything.** Front view sees knees, hips level and shift. Side view sees depth, torso angle, heels and knee bend. Session 1 showed knee bend angles from the front disagree by up to 27° between legs ([sessions/2026-10-13-session-1.md](../sessions/2026-10-13-session-1.md)).
- **Pose model error:** about ± 5–10° on knee angles in good setups, worse with loose clothes and poor camera placement (see project context §4.2).
- **2D knee valgus angle ≠ true 3D valgus.** A systematic review found poor agreement between 2D frontal plane projection angle and 3D knee angle in single-leg squats [S7-related]. Treat it as a coaching flag, not a diagnosis.
- **Thresholds must be wider than the noise.** A change smaller than the smallest detectable difference (≈ 8–9° for 2D knee angles [S7]) can't be told apart from measurement error.
- **Personal ranges.** Depth and stance depend on mobility and limb lengths. The goal is a per-person target inside the ranges above, set at calibration or by the coach.

## 6. Open questions for the coach

1. Depth target: always parallel, or "as deep as you can with heels down and a neutral back"?
2. Toe-out range and stance width: accept 0–30° and 1.0–1.5× shoulder width?
3. How much inward knee movement is acceptable before it's an error?
4. Torso-vs-shin tolerance: is ± 15° right?
5. Tempo: should we coach a tempo at all for beginners, and which?
6. Error ranking: is the order in §4 right?

## Changelog

- v0 (2026-10-13): first draft from sources below and session 1 data.
- v0.1 (2026-10-13): knee check measures inward knee movement from the standing position instead of a 2D frontal knee angle (in session 1 one knee already sat inside the ankle while standing, and 2D knee angles were unreliable from the front). Hip tilt measured as a change from standing. Matches `rule_sets` squat/front v2 and app v0.2.

## Sources

- **[S1]** Myer GD et al. (2014). *The back squat: A proposed assessment of functional deficits and technical factors that limit performance.* Strength Cond J 36(6):4–27. doi:10.1519/SSC.0000000000000103. Free manuscript: https://pmc.ncbi.nlm.nih.gov/articles/PMC4262933/ — criteria used: trunk parallel to tibia; hips parallel to the ground in the frontal plane; lateral knee doesn't cross the medial malleolus; knees don't excessively pass the front of the foot; top of thigh at least parallel; heels/toes don't lift. Companion: Kushner AM et al. (2015), Strength Cond J 37(2) (correction drills).
- **[S2]** Schoenfeld BJ (2010). *Squatting kinematics and kinetics and their application to exercise performance.* J Strength Cond Res 24(12):3497–3506. doi:10.1519/JSC.0b013e3181bac2d7. https://pubmed.ncbi.nlm.nih.gov/20182386/
- **[S3]** American Council on Exercise (ACE), Exercise Library: *Bodyweight squat*. https://www.acefitness.org/education-and-resources/lifestyle/exercise-library/135/bodyweight-squat — thighs parallel or nearly; heels flat; knees over the 2nd toe; torso and shins parallel.
- **[S4]** NSCA, *Essentials of Tactical Strength and Conditioning* (excerpt on the Zercher squat): feet flat; descend until thighs are parallel "or as far as quality technique can be maintained". https://nsca.com/education/articles/kinetic-select/zercher-squat-field-alternative-for-front-squat — the NSCA *Essentials of Strength Training and Conditioning* squat checklist has not been checked yet.
- **[S5]** Escamilla RF et al. (2001). *A three-dimensional biomechanical analysis of the squat during varying stance widths.* Med Sci Sports Exerc 33(6):984–998. doi:10.1097/00005768-200106000-00019 — stance-width groups and foot angle (0° vs 30°) figures are from secondary summaries; verify in the full text.
- **[S6]** Escamilla RF (2001). *Knee biomechanics of the dynamic squat exercise.* Med Sci Sports Exerc 33(1):127–141. doi:10.1097/00005768-200101000-00020. https://pubmed.ncbi.nlm.nih.gov/11194098/ — parallel squat ≈ 100° knee flexion.
- **[S7]** Munro A, Herrington L, Carolan M (2012). *Reliability of 2-dimensional video assessment of frontal-plane dynamic knee valgus during common athletic screening tasks.* J Sport Rehabil 21(1):7–11. https://salford-repository.worktribe.com/output/1437145 — 2D knee angle SEM 2.7–3.0°, smallest detectable difference 7.5–8.9°. Related: a systematic review reporting no correlation between 2D FPPA and 3D knee frontal-plane angle in single-leg squats.

Not yet checked against the full texts: [S1] (only its criteria summary), [S5]. Do this before coach review.
