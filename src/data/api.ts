import { supabase } from "../supabase";
import type { Rep } from "../exercises/squat/reps";
import type { Calibration } from "../exercises/squat/calibration";
import type { SquatThresholds } from "../exercises/squat/config";
import { RULE_SET } from "../exercises/squat/config";

/** A workout recorded in the browser, before it's saved. Video is never part of it. */
export interface WorkoutRecord {
  exercise: "squat";
  view: "front";
  startedAt: string;
  endedAt: string;
  poseModel: string;
  frameWidth: number;
  frameHeight: number;
  device: string;
  thresholds: SquatThresholds;
  calibrations: { t: number; cal: Calibration }[];
  reps: Rep[];
}

/** The user's own judgment of a rep. */
export interface RepLabel { correct: boolean; errors: string[] }

export const APP_VERSION = "0.3.0";

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
    rule_set_id: await ruleSetId(),
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
    export_format_version: 2
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
        rep_id: idByN.get(n), labeler_id: userId, labeler_role: "athlete", correct: l.correct, error_codes: l.errors
      }));
      if (labelRows.length) check(await supabase.from("rep_labels").insert(labelRows));
    }
  } catch (e) {
    await supabase.from("sessions").delete().eq("id", session.id);
    throw e;
  }
  return session.id;
}

export interface SessionSummary { id: string; started_at: string; exercise_id: string; camera_view: string; reps: { issues: string[]; tracking_ok: boolean }[] }

export async function listSessions(): Promise<SessionSummary[]> {
  return check(await supabase.from("sessions")
    .select("id, started_at, exercise_id, camera_view, reps(issues, tracking_ok)")
    .order("started_at", { ascending: false }).limit(50)) as SessionSummary[];
}

export interface SessionDetail {
  id: string; started_at: string; ended_at: string | null; exercise_id: string; camera_view: string; pose_model: string | null;
  thresholds: SquatThresholds | null;
  reps: { id: string; n: number; down_time_s: number; up_time_s: number; metrics: Rep["metrics"]; issues: string[]; tracking_ok: boolean;
    rep_labels: { correct: boolean; error_codes: string[]; labeler_id: string; labeler_role: string }[] }[];
}

export async function getSession(id: string): Promise<SessionDetail> {
  const s = check(await supabase.from("sessions")
    .select("id, started_at, ended_at, exercise_id, camera_view, pose_model, thresholds, reps(id, n, down_time_s, up_time_s, metrics, issues, tracking_ok, rep_labels(correct, error_codes, labeler_id, labeler_role))")
    .eq("id", id).single()) as SessionDetail;
  s.reps.sort((a, b) => a.n - b.n);
  return s;
}

/** Sets (or replaces) the signed-in user's label on a saved rep. */
export async function setLabel(repId: string, label: RepLabel) {
  const userId = await currentUserId();
  check(await supabase.from("rep_labels").upsert(
    { rep_id: repId, labeler_id: userId, labeler_role: "athlete", correct: label.correct, error_codes: label.errors },
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

export interface Profile { id: string; display_name: string | null; avatar_url: string | null; role: string; height_cm: number | null; consent_training: boolean }

export async function getProfile(): Promise<Profile> {
  const id = await currentUserId();
  return check(await supabase.from("profiles").select("id, display_name, avatar_url, role, height_cm, consent_training").eq("id", id).single()) as Profile;
}

export async function updateProfile(p: Partial<Pick<Profile, "display_name" | "height_cm" | "consent_training">>) {
  const id = await currentUserId();
  check(await supabase.from("profiles").update(p).eq("id", id));
}

export async function deleteAllMySessions() {
  const id = await currentUserId();
  check(await supabase.from("sessions").delete().eq("user_id", id));
}
