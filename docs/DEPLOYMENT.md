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

## First-time setup (step by step)

Follow this once, on a machine (or Replit workspace) that has never deployed the app before. If the app is already deploying fine, skip to [Deploying](#deploying).

**Step 1 — install dependencies.**

```bash
npm install --legacy-peer-deps
```

(`--legacy-peer-deps` avoids a known ERESOLVE conflict — see troubleshooting below.)

**Step 2 — log Wrangler in to Cloudflare.** Wrangler is the Cloudflare tool that uploads the app; it's already installed with the project. Two ways to authenticate:

- **On your own computer:** run `npx wrangler login` — a browser window opens, log in to the Cloudflare account that owns the `promo-code-manager` Worker and click **Allow**.
- **On Replit (or any machine without a browser):** use an API token instead. In the Cloudflare dashboard go to **My Profile → API Tokens → Create Token**, use the **"Edit Cloudflare Workers"** template, and save the token as the `CLOUDFLARE_API_TOKEN` environment variable (in Replit: the Secrets pane). Wrangler picks it up automatically — no login command needed.

Check it worked:

```bash
npx wrangler whoami
```

You should see the Cloudflare account name/email. If it says "not authenticated", the login or token isn't set up yet.

**Step 3 — set up the database (first time only).** In [Supabase](https://supabase.com), open the project (or create one), go to **SQL Editor**, paste the whole `supabase-setup.sql` file from the project root, and click **Run**. It's safe to re-run any time.

**Step 4 — set the production secrets.** The Worker needs its own copies of the secrets (they are *not* copied from Replit). For each one in the [Secrets table below](#secrets-production-worker):

```bash
echo "<value>" | npx wrangler secret put SECRET_NAME
```

At minimum the app needs `API_KEY`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` to work; the n8n and Google ones can be added later. To see which secrets already exist: `npx wrangler secret list`.

**Step 5 — deploy.**

```bash
npm run deploy
```

Wait 1–2 minutes. A successful deploy ends with a **Version ID** and the live URLs.

**Step 6 — check it's live.**

1. Open `https://blueempiregroup.co.uk` — the login page should load.
2. Log in with the API key (the `API_KEY` secret value).
3. Open `https://blueempiregroup.co.uk/campaigns` directly — it should load, not show an error.

> **Custom domain note:** the `blueempiregroup.co.uk` route is already configured in `wrangler.toml` and on Cloudflare. It only works when the domain's DNS is managed by the **same Cloudflare account** you deploy with. The `...workers.dev` address always works as a backup.

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

*Last updated: July 7, 2026.*
