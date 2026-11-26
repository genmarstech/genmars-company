# Genmars Meetings

The team's meetings tool, as its own service:

- **backend-meetings/** (this folder): a Django API in its own container, `genmars_meetings_api`.
- **frontend/meetings/**: the site at **https://meetings.genmars.co.ke**.
- **Shared database**: it uses the company database (`genmars_db`) with the main API. It owns only the
  `meetings_*` tables. It reads people, projects and sign-in tokens from the main API's tables, and adds
  action items to the team task list (`portal_task`). It never migrates those tables (see `company/models.py`).
- **Sign-in**: through the main API (`/api/v1/auth/login/`), so team members use their usual account.
  Only staff get in. Guests join through Meet and never see meeting records.

Requests reach it at `https://api.genmars.co.ke/api/v1/meetings/...` and `/api/v1/integrations/google/...`.
The Cloudflare tunnel sends those two paths to this service (port 8001) and everything else to the main API
(port 8000). So Google's redirect URI and CORS stay on the one API host, and no new API hostname is needed.

## What it does

- Schedule a meeting (Calendar event with a Meet link, plus invites) or start one now (Meet space).
- Each meeting has its own page: agenda, a summary that gets approved, discussion, problems with proposed
  solutions, and decisions. Decisions stay *proposed* until someone approves them.
- Action items can become team tasks. After that, the task's status is the one that counts.
- Notes, the transcript and recordings copied from Google, attendance, and an activity log.
- The overview page has counts, up next, a month calendar, searchable history and monthly insights.
- `python manage.py sync_meetings` pulls Meet links, RSVPs, attendance, transcripts and recordings. It
  retries with backoff and is safe to run again.

## Going live

1. **Google Cloud** (project `genmats-tech-internals`), OAuth "Web application" client:
   - Authorized redirect URI: `https://api.genmars.co.ke/api/v1/integrations/google/callback/`
   - Authorized JavaScript origin (optional): `https://meetings.genmars.co.ke`
   - Turn on the Google Meet API and the Google Calendar API. While the consent screen is in Testing, add
     the company Google account as a test user.
2. **Settings**: copy `.env.example` to `.env` and fill it in. The DB values are the same as
   `backend/.env`. Never commit `.env` or the `client_secret_*.json` file.
3. **Start the API** (the main backend must be running, because this service joins its Docker network):
   ```sh
   cd backend-meetings && docker compose up -d --build
   ```
4. **Main API**: run `cd backend && docker compose up -d`. This lets it accept sign-ins from
   meetings.genmars.co.ke (its CORS list now includes that origin).
5. **Cloudflare tunnel**: in `/etc/cloudflared/config.yml`, add this rule *above* the existing
   `api.genmars.co.ke` rule (full example in `backend/deploy/cloudflared.yml`):
   ```yaml
     - hostname: api.genmars.co.ke
       path: ^/api/v1/(meetings|integrations/google)/
       service: http://127.0.0.1:8001
       originRequest:
         httpHostHeader: api.genmars.co.ke
   ```
   Then run `sudo systemctl restart cloudflared`. Check it with
   `curl -s -o /dev/null -w '%{http_code}' https://api.genmars.co.ke/api/v1/meetings/overview/`.
   This should print 401 (meaning "sign in first"), not 404.
6. **Frontend on Vercel**: add a new project from this repo.
   - Root Directory `frontend/meetings`, framework Vite.
   - Optional env `VITE_TEAM_URL`, the team dashboard's address (default `https://company-v1-gamma.vercel.app`).
   - Then in Settings → Domains, add `meetings.genmars.co.ke`.
7. **DNS** for genmars.co.ke: add the record Vercel shows for the subdomain. That is usually
   `CNAME meetings → cname.vercel-dns.com`. If the zone is on Cloudflare, set it to **DNS only** (grey cloud).
   This record is for the website only. The API stays on `api.genmars.co.ke` through the tunnel.
8. **Background sync**: add a crontab line on the server.
   ```
   */15 * * * * docker exec genmars_meetings_api python manage.py sync_meetings
   ```
9. Open meetings.genmars.co.ke as an owner (superuser) and press **Connect Google**.

## Local development

```sh
cd backend-meetings && python -m venv venv && venv/bin/pip install -r requirements.txt
DJANGO_DEBUG=True venv/bin/python manage.py runserver 8001     # with the main API on :8000
cd frontend/meetings && npm install && npm run dev             # http://localhost:5174
venv/bin/python manage.py test                                 # builds the shared tables in the test DB
```

Not built yet (spec phase 5): automatic extraction of points from the transcript. Transcripts are stored,
so this can be added later with a human review step.
