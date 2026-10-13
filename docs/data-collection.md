# Collecting labeled squat data

How we build our own dataset of correct and incorrect reps (see `docs/datasets.md` for why). Everything goes through the app's **Import a video** screen or the live camera. Videos are analyzed on the device and never uploaded; only body keypoints, measurements and labels are saved.

## 1. Permission first

Before using any video:
- **The person filmed** agrees that their movement data is used to build and test the coach. Get it in writing (an email or message is enough for now): who, which videos, the date.
- **The video owner** (if someone else filmed it) agrees too.
- **Datasets:** only if the license allows commercial use (`docs/datasets.md`). Write the dataset name and license in "Details".
- **Not allowed:** videos downloaded from YouTube, Instagram, TikTok etc. (decision D8, until we have legal advice).

The app asks you to confirm this for every import and stores the confirmation, the origin and the details you enter. The database refuses an imported session without that confirmation.

Anyone can ask us to delete their data; deleting the session in the app removes its keypoints and labels.

## 2. How to film

| | Front view | Side view | Diagonal |
|---|---|---|---|
| Camera position | Facing the person, straight on | 90° to the side | 45° between front and side |
| Distance | 2–3 m, whole body incl. feet in frame | same | same |
| Height | About hip height, phone upright (not tilted) | same | same |
| Checks it supports | Knees, shift, hip tilt, depth (proxy), heels (weak), tempo | Depth, heels, torso angle, tempo | Depth, tempo |

- **Start each video standing still for 2 seconds**: the app calibrates on that.
- One person in the frame. Fitted clothes, good light, plain background helps.
- Best: **front and side at the same time** (two phones), so each rep has both views.
- 5–10 reps per video is plenty. Pause briefly standing up between reps.

## 3. What to record

**Phase 1, correct form (the reference):**
- Coaches, and people a coach has checked, doing 10 correct reps each.
- Tick "Every rep in this video is correct form, confirmed by a coach" when importing; all reliable reps start labeled "Correct" and you only fix exceptions.
- Different bodies, heights, mobility levels, men and women.

**Phase 2, mistakes:**
- The same people doing 5 reps of each mistake on purpose: knees caving in, heels lifting, not deep enough, shifting to one side, hips tilting, too fast.
- Natural mistakes from normal users are even better (staged mistakes tend to be exaggerated). Label what really happened.

**Phase 3, coach test set:**
- A coach labels a mixed set of reps they haven't seen before. Ideally two coaches label the same reps, so we know how often coaches agree with each other; the app can't be expected to agree with a coach more often than that.

## 4. Labeling

For each rep: play it (▶ Play this rep), then choose **Correct** or one or more mistakes, and write **why** if it isn't obvious ("left knee drifts in at the bottom"). Your label is what counts, not the app's own flag. The app's flags are shown so we can see where it's wrong.

Reps marked "Tracking unreliable" can be skipped.

## 5. What happens with the data

1. **Ranges:** for every measurement (depth, knee ratio, inward knee movement, heel lift, shift, tilt, tempo, and the 3D angles), look at where the coach-confirmed correct reps fall (for example the 5th–95th percentile), and compare with the published values in `docs/exercises/squat.md` §7.
2. **Limits:** use the reps with mistakes to set each limit where correct and incorrect reps separate best. That is choosing one number per rule, not training a model.
3. **Check:** measure how often the app agrees with the coach on the test set.
4. **Coach review:** the coach confirms the new limits; they go into `docs/exercises/squat.md` and a new `rule_sets` version.
5. Only if rules stop improving: train a small classifier on the keypoints (`docs/how-scoring-works.md` §3).
