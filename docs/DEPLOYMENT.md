# Deployment Guide

How the app is hosted and how to deploy changes.

## Architecture

| | Development (Replit) | Production |
| --- | --- | --- |
| **Server** | Express (`npm run dev`, port 5000) | Cloudflare Worker `promo-code-manager` |
| **Frontend** | Vite dev server (HMR) | Static assets built by Vite, served by the Worker |
| **Database** | Same Supabase project | Supabase PostgreSQL via `@supabase/supabase-js` |
| **URLs** | Replit preview | `blueempiregroup.co.uk` + `promo-code-manager.bluepavilionemail.workers.dev` |

Both server implementations (`server/routes.ts` for Express, `server/worker.ts` for the Worker) mirror the same API — **any endpoint change must be made in both files**.

> **Note:** the development environment cannot reach the Supabase database (network restriction), so dev API calls return 500. Verify changes with `npx tsc --noEmit` and against the deployed Worker.

## Deploying

```bash
npm run deploy
```

That builds the frontend + worker bundle and uploads via Wrangler. A successful deploy prints a **Version ID** and both URLs.

Notes:
- The deploy takes 1–2 minutes.
- Wrangler may warn about route fields (`zone_name`, `enabled`, `previews_enabled`) — this is normal and safe.
- `workers_dev = true` is intentional: it keeps the `...workers.dev` backup address live alongside the custom domain.
- `wrangler.toml` must keep `binding = "ASSETS"` under `[assets]` with `not_found_handling = "single-page-application"` — without it, deep links like `/campaigns` crash with error 1101. After deploying, check: `curl -w "%{http_code}" https://blueempiregroup.co.uk/campaigns` (expect 200).

## Secrets (production Worker)

Set with `echo "<value>" | npx wrangler secret put NAME` (secrets take effect immediately, no redeploy needed):

| Secret | Purpose |
| --- | --- |
| `API_KEY` | The login key for the app |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key (safe server-side; RLS + app-layer auth) |
| `N8N_WEBHOOK_URL` / `N8N_WEBHOOK_SECRET` | Launch workflow webhook |
| `N8N_RELAUNCH_WEBHOOK_URL` / `N8N_RELAUNCH_WEBHOOK_SECRET` | Relaunch workflow webhook |
| `GOOGLE_OAUTH_CLIENT_JSON` | Google OAuth web-client JSON for the raw-sheet lead check |

> Production secrets on Cloudflare are **separate** from Replit's development secrets — updating one does not update the other.

## Database setup / migrations

All schema lives in **`supabase-setup.sql`** at the project root. It is written to be **safe to re-run in full**: tables use `CREATE TABLE IF NOT EXISTS`, columns use `ADD COLUMN IF NOT EXISTS`, and policies are dropped and recreated.

To apply changes: open Supabase → **SQL Editor** → paste the whole file → **Run**.

Two important patterns in that file:
1. **Every table needs RLS enabled plus the "Allow all operations" policy.** Without the policy, anon-key writes fail silently (PostgREST returns success but writes nothing).
2. The script ends with `NOTIFY pgrst, 'reload schema';` so new columns are visible to the API layer immediately.

Tables: `users`, `promo_codes`, `api_tokens`, `email_campaigns`, `email_campaign_templates`, `email_campaign_launches`, `google_oauth_tokens`.

## Google OAuth setup (one-time)

For the raw-sheet lead check ("Connect Google" in the launch dialog):

1. In Google Cloud Console, create/use an **OAuth web client** and put its JSON into the `GOOGLE_OAUTH_CLIENT_JSON` secret.
2. Enable the **Google Sheets API** in the same Cloud project.
3. Add the exact redirect URI: `https://blueempiregroup.co.uk/api/google/callback` (in **Authorized redirect URIs**, not JavaScript origins).
4. Publish the OAuth consent screen to **Production** (in Testing mode, refresh tokens die after 7 days).
5. Connect only from the custom domain — connecting from `workers.dev` or the dev URL causes a redirect-URI mismatch.

## Deploy troubleshooting

| Problem | Fix |
| --- | --- |
| `npm install` fails with ERESOLVE | `npm install --legacy-peer-deps` |
| 401s right after deploy | The `API_KEY` secret on Cloudflare doesn't match the key being used to log in. |
| Deep links (e.g. `/campaigns`) return error 1101 | `[assets]` in `wrangler.toml` is missing `binding = "ASSETS"` — restore it and redeploy. |
| "Could not find the '<col>' column ... in the schema cache" | Run `NOTIFY pgrst, 'reload schema';` in the Supabase SQL Editor (or re-run `supabase-setup.sql`). |
| Writes silently do nothing | The table's RLS "Allow all operations" policy is missing — re-run `supabase-setup.sql`. |
| Need live production logs | `npx wrangler tail` |

---

*Last updated: July 6, 2026.*
