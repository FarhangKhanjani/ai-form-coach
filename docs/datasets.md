# Datasets for correct / incorrect squat form

Research 2026-10-13. Licenses decide what we may use: anything feeding the product must allow **commercial use**. "Unverified" = the dataset page couldn't be opened from the research environment; check before downloading.

## Candidates

| Dataset | What it is | Labels | Views / sensor | Size | License | Commercial use? | Use for us |
|---|---|---|---|---|---|---|---|
| **Multi-View Raw Video Dataset of Seven Fitness Exercises with Good/Bad Form Labels** ([Mendeley Data, v3](https://data.mendeley.com/datasets/kgbb3yn47p/3)) | Raw MP4, smartphones, gym, 7 exercises incl. **bodyweight squat** | Good / bad per video (no error type) | **Front, side, diagonal** | 26 subjects | Unverified (Mendeley Data usually CC BY 4.0) | Likely, if CC BY | **Best first test**: same setup as our app (phone, bodyweight squat, our three views). Run it through our pipeline; compare our measurements on good vs bad. |
| **UI-PRMD** deep squat ([paper](https://pubmed.ncbi.nlm.nih.gov/29354641/), [Zenodo](https://zenodo.org/records/23104965)) | Lab: Vicon motion capture + Kinect v2, rehab movements; m01 = deep squat | Correct vs incorrect execution | 3D markers (39 joints, angles) + Kinect (22 joints) | 10 healthy subjects × 10 reps × correct/incorrect | **PDDL 1.0** (public domain) | **Yes** | Reference **joint-angle ranges** for correct vs incorrect deep squats, from gold-standard motion capture. Rehab-style deep squat, so check the protocol (arm position, depth). |
| **EC3D** ([paper](https://arxiv.org/pdf/2208.03257), [code + data](https://github.com/Jacoo-Zhao/3D-Pose-Based-Feedback-For-Physical-Exercises)) | 3D poses, squats / lunges / planks | Error types: feet too wide, **knees inward**, knee passes toe, … (11 labels) | 4 GoPros around the person | 132 squat sequences, 4 subjects | Not stated | Unknown, ask authors | Only dataset with *specific squat error types* in 3D; small (4 people). |
| **EJUST-SQUAT-21** ([paper](https://www.scitepress.org/PublishedPapers/2022/113479/113479.pdf)) | Squat videos with natural, uninstructed errors | Multi-label: knees past toes, heels off, hips not parallel, inward knees, … | Video | Unknown | Unknown, no public link found | Ask authors | Good error taxonomy; access unclear. |
| **Waseda squat** (cited in literature) | Controlled squat errors | Knees inward, rounded back, shallow, knees forward | Video | Public part: 1 subject | Unknown | Unknown | Too small. |
| **Fitness-AQA** ([paper](https://arxiv.org/pdf/2202.14019)) | Real gym video, **barbell back squat**, overhead press, row | Expert-labeled errors incl. knees inward | Gym cameras | Large | **Non-commercial only**, request form | **No** | Research reference only. |
| **QEVD** (Qualcomm) ([HF card](https://huggingface.co/datasets/Voxel51/qualcomm-exercise-video-dataset-benchmark)) | 474+ h workout video with coaching feedback | Time-stamped feedback | Front, phone-like | Very large | Qualcomm research license (ambiguous, appears research-only) | Probably no | Research reference only. |
| **Fit3D / AIFit** ([paper](https://openaccess.thecvf.com/content/CVPR2021/papers/Fieraru_AIFit_Automatic_3D_Human-Interpretable_Feedback_Models_for_Fitness_Training_CVPR_2021_paper.pdf)) | 3D fitness motions, trainer vs trainee | Feedback models | Multi-camera + mocap | Large | Non-commercial research | **No** | — |
| **FLAG3D** ([license](https://andytang15.github.io/FLAG3D/License_FLAG3D.pdf)) | 3D fitness activities with language instructions | Activity + instructions, not errors | Mocap + rendered | Large | Non-commercial, signed by a professor | **No** | — |
| **Kaggle Squat Exercise Pose Dataset** ([Kaggle](https://www.kaggle.com/datasets/thashmiladewmini/squat-exercise-pose-dataset)) | Frame-level keypoint features | Correct, shallow, forward lean, knees caving, heels off, asymmetric | Correct reps from YouTube; **errors synthetically generated** | — | CC BY 4.0 (listed) | Yes, but provenance of the YouTube part is doubtful | Not useful: synthetic errors. |

## Conclusions

1. **No ready-to-use dataset gives us what we need** (bodyweight squat, phone camera, specific error types, commercial use). We have to build our own labeled set. That is normal for this kind of product and also our edge.
2. **Use now:** UI-PRMD (public domain) for joint-angle ranges of correct vs incorrect deep squats; the Mendeley multi-view dataset (once the license is confirmed) to test our pipeline on other people's phone videos, good vs bad.
3. **Ask authors:** EC3D and EJUST-SQUAT-21 for commercial-use permission. Small but labeled by error type.
4. **YouTube and similar platforms:** still not as training data (decision D8). Under the EU DSM Directive, Art. 4 (the commercial text-and-data-mining exception) does not apply where rightholders opt out, and platform terms forbid downloading. Art. 3 (scientific research) covers research organisations such as JKU, but data used under it shouldn't flow into the commercial product. Needs legal advice before any use. Background: [Kluwer Copyright Blog on Art. 3/4](https://legalblogs.wolterskluwer.com/copyright-blog/the-new-copyright-directive-text-and-data-mining-articles-3-and-4/).

## Our own dataset (plan)

See `docs/how-scoring-works.md` §4. Source videos: our own recordings and videos coaches send us with written permission. Every video is processed on the device by the same pipeline as the live app; only keypoints, measurements and labels are stored, with the video's origin and consent recorded.
