---
name: Dev login API key gotcha
description: Why login smoke tests against the dev server fail even with the "documented" key.
---

The login route (`/api/auth/login`) compares the posted `apiKey` against the
`API_KEY` env var. In this repl's **development** environment `API_KEY` is set
but its value is NOT the `promo-api-2024-secure-key` string written in
`replit.md`. So a curl login with that documented key returns **401** (not 500 —
500 only happens when `API_KEY` is unset).

**Why:** replit.md documents the intended/production key, which doesn't match the
actual dev secret. Don't trust replit.md's key for dev smoke tests.

**How to apply:** to verify auth-protected endpoints in dev, confirm the route
is wired by checking it returns 401 when unauthenticated, rather than trying to
obtain a real token with the documented key. Never print the secret value.
