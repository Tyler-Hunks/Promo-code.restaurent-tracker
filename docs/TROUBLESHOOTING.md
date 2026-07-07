# Troubleshooting Guide

Fixes for common problems, grouped by area. Deployment-specific issues are also covered in `docs/DEPLOYMENT.md`.

---

## Logging in

| Problem | Fix |
| --- | --- |
| **"Invalid API key"** | Check for typos/extra spaces. The key must exactly match the `API_KEY` secret on the Cloudflare Worker. |
| **Logged out unexpectedly** | Session tokens last 30 days per device. Just sign in again. |
| **401 on every request right after a deploy** | The `API_KEY` secret was changed but you're using the old key (or vice-versa). |

## Promo codes

| Problem | Fix |
| --- | --- |
| **A code won't redeem** | It's already used or expired — check its status in the table. |
| **Stats look wrong** | Refresh the page; stats recalculate from live data. |
| **CSV import added nothing** | The file must be `.csv` with a `code` column. Download All first and copy that layout. |
| **Generate fails with duplicates** | The format has too few `X`s for the amount of codes — add more `X`s. |

## Database (Supabase)

| Problem | Fix |
| --- | --- |
| **"Could not find the '\<column\>' column ... in the schema cache"** | The API layer's schema cache is stale. Run `NOTIFY pgrst, 'reload schema';` in the Supabase SQL Editor, or re-run all of `supabase-setup.sql`. |
| **Saves report success but nothing is stored** | The table is missing its RLS "Allow all operations" policy. Re-run `supabase-setup.sql` (it recreates all policies). |
| **"relation ... does not exist"** | The table hasn't been created yet — run `supabase-setup.sql` in full. It's safe to re-run. |
| **Dev server returns 500 for all data** | Expected on Replit: the dev environment can't reach Supabase. Test against the live site instead. |

## Email campaigns & n8n

| Problem | Fix |
| --- | --- |
| **"Launch isn't configured yet" / 503** | The `N8N_WEBHOOK_URL`/`N8N_WEBHOOK_SECRET` (or the `RELAUNCH` pair) secrets are missing on the Worker. |
| **"n8n rejected the launch" / 502** | The n8n webhook is down, the URL changed, or the secret doesn't match. Check the workflow is active in n8n. |
| **Run stuck on "In progress"** | n8n hasn't called back yet. After **30 minutes** of silence it flips to **"Needs checking"**. |
| **Run shows "Needs checking"** | Open n8n and check that execution. If it finished but the badge didn't update, the callback failed — verify the callback node posts to `/api/campaign-runs/callback` with the right `X-Callback-Secret` and `runId`. |
| **"Workflow failed"** | Click the history entry to read the failure detail n8n reported. |
| **Launch button disabled** | The campaign is missing required fields — Document ID, both Sheet IDs, Raw leads Sheet ID, or a main script. |

## Google connection (lead check)

| Problem | Fix |
| --- | --- |
| **"Connect Google" button does nothing / error page** | Connect from `blueempiregroup.co.uk` only (not `workers.dev`), and make sure `https://blueempiregroup.co.uk/api/google/callback` is registered under **Authorized redirect URIs** in Google Cloud Console. |
| **"Couldn't check the raw sheet"** | Usually a wrong **Raw leads Sheet ID (gid)**, or the connected Google account can't open that spreadsheet. The check never blocks launching. |
| **Count worked before, now fails** | If the OAuth consent screen is still in "Testing" mode, refresh tokens expire after 7 days — publish it to **Production** and reconnect. |
| **Wrong Google account connected** | Reconnect via any launch dialog — the newest connection replaces the old one. |

## The website itself

| Problem | Fix |
| --- | --- |
| **Custom domain not loading** | Try the backup `...workers.dev` address. If that works, it's a Cloudflare domain/route setting. |
| **Page shows error 1101 on `/campaigns` or other deep links** | The Worker's assets binding broke — see `docs/DEPLOYMENT.md`. |
| **A connected app (Zapier/n8n) stopped working** | Its permanent token was revoked or replaced. Create a new one in the Token Manager and update the app. |

## Watching live production logs

```bash
npx wrangler tail
```

Shows requests and errors from the live Worker in real time — useful while reproducing a problem.

---

*Last updated: July 6, 2026.*
