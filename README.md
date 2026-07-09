# APEX — JEE/NEET Command Center (self-hosted edition)

This is the full website version: real accounts, real login, and a real database — not
browser storage. Anyone with the link can create an account and their data stays put,
on any device, until they delete it.

## Run it locally first (2 minutes)

```bash
npm install
npm start
```

Open **http://localhost:3000** — register an account, pick JEE or NEET, and use it like
normal. Your data lives in `data/apex.db` (created automatically).

## Before you share it with anyone: set a real JWT_SECRET

Right now the server generates a random login secret every time it restarts, which logs
everyone out on every restart. Fix it once:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy that output and set it as an environment variable named `JWT_SECRET` on whatever
host you deploy to (see below). Keep it secret — anyone with it can forge logins.

## Deploying so it's live at a real URL

**Render.com** is the easiest genuinely-free option (no credit card):

1. Push this folder to a GitHub repo.
2. On [render.com](https://render.com) → New → Web Service → connect the repo.
3. Build command: `npm install`   ·   Start command: `npm start`
4. Add an environment variable: `JWT_SECRET` = (the value you generated above).
5. Deploy. You'll get a URL like `apex-yourname.onrender.com` — that's it, live, shareable.

**One honest caveat:** Render's free tier gives your app a normal disk while it's running,
but that disk is **not guaranteed to survive a redeploy** (pushing new code) — only a
paid persistent-disk add-on guarantees that. For a personal project you redeploy rarely,
this is usually fine in practice. If you want bulletproof persistence (data survives
every redeploy, forever, no exceptions), the fix is swapping the database from the local
SQLite file to a free hosted Postgres database (e.g. [Neon](https://neon.tech) or
[Supabase](https://supabase.com) — both have permanent free tiers). It's a small change
to `server.js` — just ask and I'll do it for you.

The free tier also sleeps after ~15 minutes of no traffic and takes ~30–50 seconds to
wake up on the next visit. Fine for a study tool; annoying for a demo you're timing.

## What's actually real here vs. simplified

- **Real:** password hashing (bcrypt), signed login tokens (JWT, 90-day expiry), each
  user's data is isolated server-side, data persists across devices and browser closes.
- **Simplified, on purpose:** no email verification, no password reset flow, no rate
  limiting on login attempts. Totally fine for a personal or small-group study tool;
  not something I'd put a stranger's banking data behind. Say the word if you want any
  of these added.

## Project structure

```
server.js          — Express API: auth (register/login) + per-user data storage
public/index.html  — the entire frontend (same JEE/NEET app as before, now login-gated)
data/apex.db        — SQLite database, created automatically on first run
```
