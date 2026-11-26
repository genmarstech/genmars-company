# Meetings

The team dashboard's Meetings tab (`/team/meetings`): schedule or start Google Meet calls, and keep each
meeting's record (agenda, notes, discussion, problems and proposed solutions, decisions, action items,
transcript) in the Genmars database. Staff only; guests join through Meet and never see the record.

## Setup

1. In Google Cloud (project `genmats-tech-internals`), open the OAuth "Web application" client and add this
   to **Authorized redirect URIs**, exactly:
   `https://api.genmars.co.ke/api/v1/integrations/google/callback/`
   Make sure the Google Meet API and Google Calendar API are enabled, and while the consent screen is in
   Testing, add the company Google account as a test user.
2. In `backend/.env` set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_REDIRECT_URI` (see
   `.env.example`). Never commit the downloaded `client_secret_*.json`.
3. Rebuild the API so it picks up the new package and migration: `docker compose up -d --build`.
4. As an owner (superuser), open Meetings and press **Connect Google**.
5. Fetch attendance and transcripts in the background every 15 minutes, e.g. a crontab line on the host:
   `*/15 * * * * docker exec genmars_api python manage.py sync_meetings`
   Each meeting also has a **Fetch from Google** button.

## How it fits together

- `google.py`: OAuth (signed `state`, encrypted tokens, refresh), Calendar events with a Meet conference,
  Meet spaces and conference records. Uses only the standard library for HTTP.
- `sync.py`: idempotent pull of Meet links, RSVPs, attendance, transcripts and recordings, retried with
  backoff until Google has produced everything (transcripts can take a while after a call).
- `views.py`: `/api/v1/meetings/...` and `/api/v1/integrations/google/...`.
- Decisions and solutions stay *proposed* until someone approves them; the record's summary is approved
  by the organizer or an owner. Action items can become team tasks, and then the task's status is the one
  that counts.

Not built yet (spec phase 5): automatic extraction of points from the transcript. The transcript is stored
so this can be added later with human review.
