-- Body measurements from the profile photos (src/pose/bodyScan.ts): segment lengths in cm, height, which
-- photos were used, when. The photos themselves are analyzed on the phone and never uploaded.
-- Shape: { "dims": { "hipWidth": 0, "shoulderWidth": 0, "torso": 0, "upperArm": 0, "forearm": 0, "thigh": 0,
--   "shin": 0, "heel": 0, "foot": 0, "neck": 0 }, "heightCm": 0, "photos": [{ "view": "front" }],
--   "measuredAt": "ISO-8601", "method": "photos" }

alter table public.profiles add column if not exists body jsonb;

comment on column public.profiles.body is 'Segment lengths (cm) measured on the device from standing photos; never the photos.';

-- Users may update their own measurements (column-level grant, like the other editable profile fields).
grant update (body) on public.profiles to authenticated;
