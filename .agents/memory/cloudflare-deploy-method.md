---
name: Cloudflare Worker deploy method
description: How to reliably run `npm run deploy` (wrangler) from the agent environment
---

Deploying the production Cloudflare Worker (`npm run deploy`) exceeds the 120s bash tool timeout and backgrounded bash jobs die when the session ends.

**Why:** The build+wrangler upload takes ~1–2 minutes; the bash tool kills long/backgrounded processes.

**How to apply:** Use a temporary workflow via code_execution:
1. `configureWorkflow({name: "Deploy to Cloudflare", command: "bash -c 'rm -f /tmp/deploy.log; npm run deploy 2>&1 | tee /tmp/deploy.log; echo DEPLOY_EXIT_DONE >> /tmp/deploy.log'", outputType: "console", autoStart: true})`
2. Sleep ~45s, then `tail /tmp/deploy.log` and confirm `DEPLOY_EXIT_DONE` + a Version ID.
3. `removeWorkflow({name: "Deploy to Cloudflare"})` to clean up.

Also: dev database (Neon/`api.pooler.supabase.com`) is unreachable from the dev environment (ENOTFOUND), so dev API calls 500 — verify changes with `tsc --noEmit` and against the deployed worker (blueempiregroup.co.uk) instead.

**wrangler.toml assets gotcha:** `[assets]` must declare `binding = "ASSETS"` or `env.ASSETS` is undefined inside the worker — the root URL still works (Cloudflare serves matching assets before invoking the worker) but every SPA deep link (e.g. `/campaigns`) crashes with error 1101. Pair it with `not_found_handling = "single-page-application"` so deep links/refreshes serve index.html. After deploying, verify with `curl -w "%{http_code}" https://blueempiregroup.co.uk/campaigns` (expect 200 with script tags).
