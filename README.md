# SJBC — Tournament Manager

Badminton tournament web app: groups, singles/doubles, fixtures, live scoring, ELO ratings,
knockout bracket. Node + Express + PostgreSQL, Google sign-in, real-time updates (SSE).
Works full-screen on desktop and adapts to phones; installable as an app (PWA).

## Run it

```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm start                 # → http://localhost:3000
```

Requires Node 22+ and a PostgreSQL 14+ database (set `DATABASE_URL`). Tables are created automatically on first start (versioned migrations).

Without `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` the app runs in **local dev mode** with an email-only login
(never available when `NODE_ENV=production`). The first person to sign in becomes admin.
Open **Settings → Load demo tournaments** to explore every screen.

## Who can do what

| Role | Can |
|---|---|
| **Guest** (not signed in) | Watch everything live via a tournament link (`/#/t/<id>`); use **Share** on any tournament |
| **Pending** | Same as guest, until an admin approves |
| **Scorer** (`editor`) | Create tournaments, manage teams, enter scores, build the bracket |
| **Admin** | Everything + approve/block/invite users, backups, wipe data |

Anyone who signs in with Google lands as *Pending*; admins see them under **Admin → Waiting for approval**
and approve with one click (or pre-approve by email with **Invite**). Emails in `ADMIN_EMAILS` are
permanent admins. At least one admin always exists.

## Google sign-in

1. <https://console.cloud.google.com/> → create/select a project → **APIs & Services → OAuth consent screen**
   (External, add your app name + email).
2. **Credentials → Create credentials → OAuth client ID → Web application**.
3. **Authorized redirect URIs**: `http://localhost:3000/auth/google/callback` and your production URL + `/auth/google/callback`.
4. Copy the client ID and secret into `.env` as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, set `ADMIN_EMAILS` to your Google email, restart.

## Deploy

Any host that runs Node, plus a PostgreSQL database (Azure Database for PostgreSQL recommended). No local disk is needed, and you can run several instances (live updates are relayed through Postgres LISTEN/NOTIFY):

- **Docker**: `docker build -t sjbc . && docker run -p 3000:3000 -e DATABASE_URL=postgresql://... -e GOOGLE_CLIENT_ID=... -e ADMIN_EMAILS=you@gmail.com sjbc`
- **Render / Railway / Fly**: build `npm ci`, start `npm start`, set `DATABASE_URL`,
  set `NODE_ENV=production`, `TRUST_PROXY=true`, `GOOGLE_CLIENT_ID`, `ADMIN_EMAILS`. Serve over HTTPS.

Back up from **Settings → Export backup** (admin). On Azure, automated backups with point-in-time restore are on by default (raise retention to 35 days in production).

Moving from the old SQLite version: `node --env-file=.env scripts/migrate-sqlite-to-postgres.js [path/to/sjbc.db]` (safe to re-run, verifies counts).

## How it works

- `server/` — REST API, sessions (HttpOnly SameSite cookies stored in PostgreSQL), Google ID-token
  verification, role checks, validation, optimistic concurrency, SSE broadcast.
- `public/` — the single-page client. Scores have their own endpoint so two scorers on different
  matches never conflict; structural edits (teams, fixtures, bracket) are version-checked.
- Security: CSP, same-origin checks on writes, rate-limited login, bounded/validated payloads,
  blocked users lose sessions immediately.

## Tests

```bash
npm test
```
