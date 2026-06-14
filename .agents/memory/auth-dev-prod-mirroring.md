---
name: Auth logic is mirrored in two runtimes
description: Token auth (login, stateless verification, expiry) is duplicated in the Express dev server and the Cloudflare Worker; they must change in lockstep.
---

# Auth logic lives in two places and must stay in sync

The same authentication logic is implemented twice:
- `server/routes.ts` — the Express dev server (`npm run dev`), uses Node `crypto.createHmac`.
- `server/worker.ts` — the deployed Cloudflare Worker, uses Web Crypto (`crypto.subtle`).

Both implement: the `/api/auth/login` handler, `createStatelessToken`, `verifyStatelessToken`, and the `requireAuth` middleware.

**Rule:** Any change to token format, signing secret, expiry window, `expiresIn`, or the auth/verify order MUST be applied to BOTH files identically, or dev and production behave differently.

**Why:** They are independent copies, not shared code. A fix made in only one place silently diverges — e.g. a session that expires correctly in dev but not in prod (or vice-versa).

**How to apply:** When touching auth, grep both files and edit them together. After editing the Worker, it only takes effect after a rebuild + redeploy (`npm run build` then `npx wrangler deploy`); the dev server picks up changes on restart.

## Session-token design (don't reintroduce the bypass)
Session tokens are stateless `temp.<timestamp>.<hmac>` strings — self-verifying via signature + embedded timestamp, so they need no server-side store. The expiry window is enforced purely inside `verifyStatelessToken`.

There used to be an in-memory `activeTokens` Set checked *before* verification; it let a token outlive its expiry for as long as the process/isolate stayed alive (and was per-isolate useless on Workers). It was removed. Do not reintroduce an in-memory shortcut ahead of stateless verification — the timestamp check is the single source of truth for expiry.

On the frontend, a 401 from any request triggers `handleUnauthorized()` (`client/src/lib/queryClient.ts`) which clears the token and dispatches a `auth:unauthorized` window event; `App.tsx` listens and returns the user to the login screen. This is what makes an expired/idle session recover gracefully instead of showing a broken dashboard.
