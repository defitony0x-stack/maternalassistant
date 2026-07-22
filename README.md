# Maternal Health Companion — v1

Two folders, two Railway/Vercel deployments, one Postgres database. Built for
a browser-only workflow: no local terminal needed except for the one-time
OKX OnchainOS wallet setup noted below.

## What's in here

- `backend/` — Node/Express API on Railway. Owns the LLM calls, Postgres,
  and the demo rate limiter.
- `frontend/` — Next.js app on Vercel. Landing page with the no-wallet demo,
  plus a bare-bones `/dashboard` for testing the signed-in loop.

## Getting this onto GitHub without a terminal

1. Create a new empty repo on GitHub (no README, no .gitignore, so there's
   nothing to conflict with).
2. On the repo page, use **Add file → Upload files**.
3. Drag the `backend` and `frontend` folders in from your downloads (Chrome
   and Edge support dragging whole folders into that upload box). Commit.
4. If GitHub's uploader balks at nested folders, upload `backend` in one
   commit and `frontend` in a second commit, both to the repo root.

## Deploying the backend (Railway)

1. New Railway project → Deploy from GitHub repo → pick this repo → set the
   root directory to `backend`.
2. Add a Postgres plugin to the project. Railway sets `DATABASE_URL`
   automatically.
3. Set the remaining env vars from `backend/.env.example`: `LLM_BASE_URL`,
   `LLM_API_KEY`, `LLM_MODEL`, `JWT_SECRET`, `CORS_ORIGIN` (your Vercel URL,
   set this after step 2 of the frontend deploy below).
4. Set the start command if Railway doesn't infer it: `npm start`.
5. Once it's live, run the migration once. Easiest no-terminal way: add a
   one-off Railway "Deploy" with start command `npm run migrate` temporarily,
   or trigger it via Railway's web shell if your plan includes one. If
   neither is available, ask me and I'll add an `/admin/migrate` route
   gated by a secret header instead, so it can run over HTTP.

## Deploying the frontend (Vercel)

1. New Vercel project → import the same GitHub repo → set root directory to
   `frontend`.
2. Set env vars from `frontend/.env.example`: `NEXT_PUBLIC_API_URL` (your
   Railway backend URL) and `NEXT_PUBLIC_OKX_LISTING_URL` (fill in once the
   ASP listing exists).
3. Deploy. Go back to Railway and set `CORS_ORIGIN` to this Vercel URL.

## The one step that still needs a local session

Registering the ASP on OKX AI Marketplace requires running
`npx skills add okx/onchainos-skills` and creating the shared Agentic Wallet
through an agent session (Claude Code, Cursor, etc.). This only needs to
happen once, and the same wallet is shared with AgentPress. Do this in a
single local or cloud-shell session, then the backend calls the wallet over
its API from then on, no further local steps.

## What v1 does and doesn't do

Does: report generation, appointment prep, advocacy letter drafts, read-only
prediction market info, a no-wallet demo on the landing page.

Doesn't yet: on-chain anchoring (route exists, returns 501 until the wallet
is wired up), prediction market execution, wearable sync, multilingual or
offline modes. All intentionally deferred, see the product spec.
