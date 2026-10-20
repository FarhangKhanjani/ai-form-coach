import { supabase } from "../supabase";

import type { Calibration } from "../exercises/squat/calibration";
import { RULE_SET, type CameraView } from "../exercises/squat/config";
import type { BodyDims } from "../pose/lift";

/** A workout recorded in the browser, before it's saved. Video is never part of it. */
/** What every exercise engine reports per rep (the squat coach and the generic catalog coach). */
export interface RepLike {
  n: number; start: number; end: number; downTime: number; upTime: number;
  metrics: object; issues: string[]; trackingOk: boolean; trackingProblems: string[];
  frames: { t: number; lm: number[][]; world?: number[][] }[];
}

export interface WorkoutRecord {
  /** "squat" (bodyweight squat coach) or a catalog exercise id. */
  exercise: string;
  view: CameraView;
  /** "live" = phone camera in the app; "video_import" = a video file analyzed on the device (never uploaded). */
  source: "live" | "video_import";
  /** For imports: file name, origin, person, consent (see supabase/migrations/20261013180000_session_source.sql). */
  sourceMeta?: Record<string, unknown>;
  startedAt: string;
  endedAt: string;
  poseModel: string;
  frameWidth: number;
  frameHeight: number;
  device: string;
  /** Limits in force for this session (squat thresholds, or check code → limit for catalog exercises). */
  thresholds: object;
  calibrations: { t: number; cal: Calibration }[];
  reps: RepLike[];
}

/** The user's own judgment of a rep. */
export interface RepLabel { correct: boolean; errors: string[]; note?: string }

export const APP_VERSION = "0.6.1";

export async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Not signed in");
  return id;
}

async function ruleSetId(): Promise<string | null> {
  const { data } = await supabase.from("rule_sets").select("id")
    .eq("exercise_id", RULE_SET.exercise).eq("camera_view", RULE_SET.view).eq("version", RULE_SET.version).maybeSingle();
  return data?.id ?? null;
}

const check = <T>(res: { data: T; error: { message: string } | null }): T => {
  if (res.error) throw new Error(res.error.message);
  return res.data;
};

/** Saves a workout with its reps, keypoints and labels. All-or-nothing: a failed save leaves no partial session. */
export async function saveWorkout(w: WorkoutRecord, labels: Map<number, RepLabel>): Promise<string> {
  const userId = await currentUserId();
  const session = check(await supabase.from("sessions").insert({
    user_id: userId,
    exercise_id: w.exercise,
    rule_set_id: w.exercise === RULE_SET.exercise && w.view === RULE_SET.view ? await ruleSetId() : null,
    camera_view: w.view,
    started_at: w.startedAt,
    ended_at: w.endedAt,
    app_version: APP_VERSION,
    pose_model: w.poseModel,
    frame_width: w.frameWidth,
    frame_height: w.frameHeight,
    device: w.device,
    thresholds: w.thresholds,
    calibration: { history: w.calibrations.map(c => ({ t: c.t, ...c.cal })) },
    export_format_version: 2,
    source: w.source,
    source_meta: w.sourceMeta ?? null
  }).select("id").single()) as { id: string };

  try {
    if (w.reps.length) {
      const rows = check(await supabase.from("reps").insert(w.reps.map(r => ({
        session_id: session.id,
        user_id: userId,
        n: r.n,
        start_ms: Math.round(r.start * 1000),
        end_ms: Math.round(r.end * 1000),
        down_time_s: Number(r.downTime.toFixed(2)),
        up_time_s: Number(r.upTime.toFixed(2)),
        metrics: { ...r.metrics, trackingProblems: r.trackingProblems },
        issues: r.issues,
        tracking_ok: r.trackingOk
      }))).select("id, n")) as { id: string; n: number }[];
      const idByN = new Map(rows.map(r => [r.n, r.id]));
      // Keypoints are the bulk of the data: send a few reps per request.
      for (let i = 0; i < w.reps.length; i += 5) {
        check(await supabase.from("rep_keypoints").insert(w.reps.slice(i, i + 5).map(r => ({
          rep_id: idByN.get(r.n), user_id: userId, frames: r.frames
        }))));
      }
      const labelRows = [...labels].filter(([n]) => idByN.has(n)).map(([n, l]) => ({
        rep_id: idByN.get(n), labeler_id: userId, labeler_role: "athlete", correct: l.correct, error_codes: l.errors, note: l.note || null
      }));
      if (labelRows.length) check(await supabase.from("rep_labels").insert(labelRows));
    }
  } catch (e) {
    await supabase.from("sessions").delete().eq("id", session.id);
    throw e;
  }
  return session.id;
}

export interface SessionSummary { id: string; started_at: string; exercise_id: string; camera_view: string; source: string; reps: { issues: string[]; tracking_ok: boolean }[] }

export async function listSessions(): Promise<SessionSummary[]> {
  return check(await supabase.from("sessions")
    .select("id, started_at, exercise_id, camera_view, source, reps(issues, tracking_ok)")
    .order("started_at", { ascending: false }).limit(50)) as SessionSummary[];
}

export interface SessionDetail {
  id: string; started_at: string; ended_at: string | null; exercise_id: string; camera_view: string; pose_model: string | null;
  source: string; source_meta: Record<string, unknown> | null;
  thresholds: Record<string, unknown> | null;
  reps: { id: string; n: number; down_time_s: number; up_time_s: number; metrics: Record<string, any>; issues: string[]; tracking_ok: boolean;
    rep_labels: { correct: boolean; error_codes: string[]; labeler_id: string; labeler_role: string; note: string | null }[] }[];
}

export async function getSession(id: string): Promise<SessionDetail> {
  const s = check(await supabase.from("sessions")
    .select("id, started_at, ended_at, exercise_id, camera_view, pose_model, thresholds, source, source_meta, reps(id, n, down_time_s, up_time_s, metrics, issues, tracking_ok, rep_labels(correct, error_codes, labeler_id, labeler_role, note))")
    .eq("id", id).single()) as SessionDetail;
  s.reps.sort((a, b) => a.n - b.n);
  return s;
}

/** Sets (or replaces) the signed-in user's label on a saved rep. */
export async function setLabel(repId: string, label: RepLabel) {
  const userId = await currentUserId();
  check(await supabase.from("rep_labels").upsert(
    { rep_id: repId, labeler_id: userId, labeler_role: "athlete", correct: label.correct, error_codes: label.errors, note: label.note || null },
    { onConflict: "rep_id,labeler_id" }));
}

export async function deleteSession(id: string) {
  check(await supabase.from("sessions").delete().eq("id", id));
}

/** Full session with keypoints, in the JSON export format (version 2). */
export async function exportSession(id: string) {
  const s = check(await supabase.from("sessions").select("*, reps(*, rep_keypoints(frames), rep_labels(*))").eq("id", id).single());
  return { app: "ai-form-coach", version: 2, exportedAt: new Date().toISOString(), session: s };
}

/** Body measurements from the profile photos (src/pose/bodyScan.ts). Numbers only; the photos never leave the phone. */
export interface BodyProfile {
  /** Segment lengths in cm. */
  dims: BodyDims;
  heightCm: number;
  /** Photos used and when. */
  photos: { view: "front" | "side" }[];
  measuredAt: string;
  method: "photos";
}

export interface Profile { id: string; display_name: string | null; avatar_url: string | null; role: string; height_cm: number | null; consent_training: boolean; body: BodyProfile | null }

const PROFILE_COLS = "id, display_name, avatar_url, role, height_cm, consent_training";

export async function getProfile(): Promise<Profile> {
  const id = await currentUserId();
  const res = await supabase.from("profiles").select(`${PROFILE_COLS}, body`).eq("id", id).single();
  // Until migration 5 (profiles.body) is applied, read the profile without it.
  if (res.error && /body/.test(res.error.message)) return { ...(check(await supabase.from("profiles").select(PROFILE_COLS).eq("id", id).single()) as Profile), body: null };
  return check(res) as Profile;
}

export async function updateProfile(p: Partial<Pick<Profile, "display_name" | "height_cm" | "consent_training" | "body">>) {
  const id = await currentUserId();
  check(await supabase.from("profiles").update(p).eq("id", id));
}

export async function deleteAllMySessions() {
  const id = await currentUserId();
  check(await supabase.from("sessions").delete().eq("user_id", id));
}
