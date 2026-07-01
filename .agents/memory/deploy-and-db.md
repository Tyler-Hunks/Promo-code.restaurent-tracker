---
name: Deploy & database operational model
description: How this app's dev/prod DB and deployment actually work — non-obvious operational facts.
---

# Deploy & database operational model

- **Dev uses the SAME Supabase Postgres as production**, via the `DATABASE_URL` secret. There is no separate local/dev database.
  - **Consequence:** the agent cannot apply schema migrations automatically. Any schema change must be applied by the user running `supabase-setup.sql` in the **Supabase SQL Editor**.
  - `supabase-setup.sql` is intentionally **idempotent / safe to re-run**: it `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, backfills old columns into new ones *before* dropping the old ones, and only fills empty rows so re-runs never clobber data.
  - **How to apply:** after editing the schema, verify with `npx tsc --noEmit`; runtime CRUD will fail with "column does not exist" until the user re-runs the SQL. Don't treat that dev runtime error as a code bug.
- **Deploy command is `npm run deploy`** — builds the Vite frontend + the Cloudflare Worker and deploys to Cloudflare (keeps the custom domain blueempiregroup.co.uk attached). Prod secrets (`N8N_WEBHOOK_URL`, etc.) are set via `wrangler secret put` on the default environment.
- **Login API key drift:** the documented login key in `replit.md` is the *production* key; the dev server's expected API key can differ, so dev login may not work with the documented key. Don't assume the documented key authenticates the dev server.
- **Three consumers of the launch payload** must stay in sync: Express dev server (`server/routes.ts`), Cloudflare Worker (`server/worker.ts`), and the frontend launch preview. They all import `buildLaunchPayload` from `shared/schema.ts` — keep it the single source of truth; never re-implement the payload shape in any consumer.
  - **Why:** the worker and dev server are separate entrypoints that both hit prod data; drift between them (or between them and the preview) silently sends n8n a wrong-shaped body.
- **PostgREST schema-cache staleness (prod-only):** the deployed Worker talks to the DB through the Supabase JS client = **PostgREST**, which caches the table schema. After any DDL (new/renamed column) the Worker can fail with *"Could not find the '<col>' column of '<table>' in the schema cache"* even though the column exists.
  - **Fix:** run `NOTIFY pgrst, 'reload schema';` (kept at the end of `supabase-setup.sql`, so re-running the setup also reloads it), or click "Reload schema cache" in the Supabase dashboard API settings. The dev Express server does NOT hit this — it uses a raw Postgres/Neon driver, not PostgREST — so this error class only appears in production.
- **Dev server can't reach the DB in the Replit sandbox:** `server/db.ts` uses the **Neon HTTP serverless driver** (`neon(DATABASE_URL)`) but the DB is **Supabase**. In dev this fails with `getaddrinfo ENOTFOUND api.pooler.supabase.com` (the Neon driver derives a bogus fetch host from the Supabase pooler URL). Consequence: **local dev cannot exercise DB-backed routes**; verify with `tsc` + review and test against the deployed Worker instead. This is a pre-existing driver/host mismatch, not a regression — don't "fix" it casually; the Worker path (supabase-js) is what serves prod.
