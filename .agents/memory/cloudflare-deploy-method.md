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
