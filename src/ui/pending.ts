import type { WorkoutRecord } from "../data/api";

/** The finished live workout waiting on the review screen (kept in memory only). */
export let pendingWorkout: WorkoutRecord | null = null;
export function setPendingWorkout(w: WorkoutRecord) { pendingWorkout = w; }
export function clearPendingWorkout() { pendingWorkout = null; }
