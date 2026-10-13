-- Where a session's keypoints came from: the live camera, or a video file analyzed on the device.
-- The video itself is never uploaded; source_meta records its origin and the consent given for it, e.g.
-- { "fileName": "...", "durationS": 14.2, "origin": "coach", "originDetail": "Coach A, permission by email 2026-10-13",
--   "person": "Coach A", "coachConfirmedCorrect": true, "consentConfirmed": true, "consentTextVersion": 1 }
alter table public.sessions
  add column source text not null default 'live' check (source in ('live', 'video_import')),
  add column source_meta jsonb;

-- An imported video must record that consent was confirmed.
alter table public.sessions
  add constraint sessions_import_consent check (
    source = 'live' or coalesce((source_meta ->> 'consentConfirmed')::boolean, false)
  );
