---
name: Cloudflare + Supabase ops runbook
description: Deploy gotchas and new-database setup steps for the promo-code-manager Cloudflare Worker + Supabase app
---

# Deploying the Cloudflare Worker

- `npx wrangler deploy` does NOT build. If `dist/worker.js` is missing it fails with
  `The entry-point file at "dist/worker.js" was not found.` Always run `npm run build`
  first (it runs `vite build` + esbuild of `server/worker.ts` -> `dist/worker.js`), then deploy.
- The deploy warns about multiple environments (harmless) and may warn that local
  wrangler.toml config differs from the remote dashboard (e.g. a custom-domain route like
  `blueempiregroup.co.uk`). In non-interactive mode wrangler auto-answers "yes" and the
  deploy OVERRIDES the remote config — so a custom domain configured only in the dashboard
  can be dropped. Add the route to wrangler.toml if it must persist.

# Connecting a NEW Supabase database

**Why:** the old DB expired from inactivity; user repointed Cloudflare secrets
(DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY) to a fresh project.

- A fresh DB is empty AND missing schema objects. `supabase-setup.sql` must be run in the
  new project's SQL Editor — it creates tables (users, promo_codes, api_tokens) AND two
  RPC functions: `get_campaign_stats` and `get_promo_stats`.
- Symptom of missing RPC: `/api/campaigns` returned HTTP 500 with `error code: 1016`
  (a Cloudflare origin-style error surfaced through the Supabase client), while
  `/api/campaigns/stats` returned `[]` because `getCampaignStats()` silently falls back.
- `getCampaigns()` is now resilient (RPC -> direct-select fallback -> `[]` on error, never
  500). But the fallback select is subject to Supabase's default row limit, so on large
  datasets campaigns can be truncated until the RPC exists. The RPC is the correct fix.

**How to apply:** after any DB swap, run `supabase-setup.sql` on the new project, then
rebuild + redeploy, then re-import data via CSV (old data does not transfer).

# Debugging an "empty database" that is really UNREACHABLE

**Why:** several read methods in `storage-cloudflare.ts` destructure only
`{ data }` / `{ data, count }` and ignore the Supabase `error`. When the project is
unreachable they return `[]` / `0`, so the UI looks like an empty-but-working DB.
Write methods now surface errors (throw), so a write is the honest probe.

- `error code: 1016` from a Supabase call = Cloudflare cannot reach the Supabase
  ORIGIN. It is NOT an RLS error (RLS = Postgres 42501 "violates row-level security").
  1016 almost always means the Supabase project is **paused** (free tier pauses after
  inactivity) or the URL is wrong.
- Quick probe without leaking secrets: `curl -o /dev/null -w "%{http_code}"
  "$SUPABASE_URL/rest/v1/..."`. `000` + curl exit 6 = hostname does not resolve
  (deleted/old/typo URL); exit 28/timeout or HTTP 1016/52x = project paused.
- The fix is operational, not code: resume the project in the Supabase dashboard and/or
  correct `SUPABASE_URL` + `SUPABASE_ANON_KEY`. Cloudflare secrets and Replit secrets are
  independent — updating one does not update the other.
