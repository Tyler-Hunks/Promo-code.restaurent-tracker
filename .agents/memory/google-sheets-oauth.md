---
name: Google Sheets OAuth connect flow
description: How the raw-sheet check's "Connect Google" OAuth flow is configured and what breaks it
---

The raw-sheet lead-count feature uses a one-time OAuth web-client flow (user could NOT create service-account keys — org policy blocks them, hence OAuth instead).

**Secret naming quirk:** The Replit secret `GOOGLE_SERVICE_ACCOUNT_JSON` actually contains the OAuth *web client* JSON (`{"web":{client_id,client_secret,...}}`), not a service account. Canonical name is `GOOGLE_OAUTH_CLIENT_JSON` (pushed to wrangler by piping the env value); code falls back to the legacy name in both runtimes.

**Why it can fail (debugging "Google connection failed"):**
- The redirect URI registered in Google Cloud Console must EXACTLY match `https://blueempiregroup.co.uk/api/google/callback`. Connecting from the workers.dev origin or the Replit dev URL produces a redirect_uri mismatch — connect only from the custom domain.
- Google Sheets API must be enabled in the same Cloud project as the OAuth client.
- The OAuth consent screen must be published to Production (or Internal for Workspace); in Testing mode refresh tokens expire after 7 days.
- The `google_oauth_tokens` table (single row id='default') needs the RLS "Allow all operations" policy or anon-key writes silently fail (same pattern as all other tables).

**How to apply:** If lead counts stop working, check `/api/google/status` first; invalid_grant on refresh auto-deletes the stored tokens so the UI re-offers Connect.
