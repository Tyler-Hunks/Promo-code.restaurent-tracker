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
