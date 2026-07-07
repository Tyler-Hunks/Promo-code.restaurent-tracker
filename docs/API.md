# API Reference

REST API for the Promo Code Manager. Same endpoints in development (Express) and production (Cloudflare Worker).

- **Base URL (production):** `https://blueempiregroup.co.uk`
- **Backup URL:** `https://promo-code-manager.bluepavilionemail.workers.dev`
- **Format:** JSON in, JSON out.

---

## Authentication

All endpoints require a Bearer token except the three marked **(no auth)** below.

```
Authorization: Bearer <token>
```

Two kinds of token work:

| Kind | How you get it | Lifetime |
| --- | --- | --- |
| **Session token** | `POST /api/auth/login` with the API key | **30 days** |
| **Permanent token** (`sk-...`) | Created in the app's Token Manager | Until revoked |

### `POST /api/auth/login` (no auth)

```json
{ "apiKey": "<your API key>" }
```

Returns `{ "token": "...", "expiresIn": 2592000 }`.

---

## Promo codes

| Method | Path | What it does |
| --- | --- | --- |
| `GET` | `/api/promo-codes` | List codes. Query params: `page`, `limit` (default 100), `search`, `campaign`, `status`, `discount`, or `export=all` (returns everything for CSV export). |
| `GET` | `/api/promo-codes/stats` | Totals: generated, available, used, expired. |
| `POST` | `/api/promo-codes` | Create **one** code with an exact value. Body: `{ code, campaignName?, discountValue?, expiresAt? }`. `409` if the code already exists. |
| `POST` | `/api/promo-codes/generate` | Generate **one** random code. Body: `{ format?, campaignName?, discountValue?, expiresAt? }`. `X` in format = random character (default `PROMO-XXXX`). |
| `POST` | `/api/promo-codes/generate-bulk` | Generate many codes. Body: `{ count, format, campaignName?, discountValue?, expiresAt? }`. |
| `POST` | `/api/promo-codes/generate-campaign` | Generate many codes for a campaign. Body: `{ campaignName, discountValue, count, format, expiresAt? }`. |
| `PATCH` | `/api/promo-codes/:code/redeem` | Redeem a code (marks it used). `404` if not found or already used. |
| `PATCH` | `/api/promo-codes/:code/toggle-status` | Flip a code between used/unused. |
| `GET` | `/api/promo-codes/:code/validate` | Check a code without redeeming it. |
| `POST` | `/api/promo-codes/import` | Import codes from CSV data. |
| `DELETE` | `/api/promo-codes/:code` | Delete one code by its code value. |
| `DELETE` | `/api/promo-codes` | Delete several codes. Body: `{ codes: ["CODE1", "CODE2"] }`. |
| `POST` | `/api/promo-codes/delete-by-filters` | Delete every code matching campaign/status/discount filters. |
| `DELETE` | `/api/promo-codes/all` | Delete everything. |
| `GET` | `/api/campaigns` | List of promo-code campaign names. |
| `GET` | `/api/campaigns/stats` | Per-campaign stats (total, available, used). |

## API tokens

| Method | Path | What it does |
| --- | --- | --- |
| `GET` | `/api/tokens` | List permanent tokens (values hidden). |
| `POST` | `/api/tokens` | Create a token. Body: `{ name }`. The token value is returned **once**. |
| `DELETE` | `/api/tokens/:id` | Revoke a token. |

## Email campaigns

| Method | Path | What it does |
| --- | --- | --- |
| `GET` | `/api/email-campaigns` | List campaigns. |
| `POST` | `/api/email-campaigns` | Create a campaign. |
| `PATCH` | `/api/email-campaigns/:id` | Update a campaign. |
| `DELETE` | `/api/email-campaigns/:id` | Delete a campaign. |
| `POST` | `/api/email-campaigns/:id/launch` | Fire the n8n launch workflow (full run: processes new leads). |
| `POST` | `/api/email-campaigns/:id/relaunch` | Fire the n8n relaunch workflow (skips lead processing). |
| `GET` | `/api/email-campaigns/:id/raw-sheet-count` | Count data rows in the campaign's raw Google Sheet tab. Returns `{ connected: false }`, `{ connected: true, rows, email }`, or `{ connected: true, error, email }` where `error` is `no_access` / `tab_not_found` / `api_error`. Never blocks launching. |

Launching requires the campaign to have a Document ID, at least 2 Sheet IDs, a Raw leads Sheet ID, and both main scripts. Launch endpoints return `503` when the n8n webhook secrets aren't configured, `502` when n8n rejects the request.

## Templates & history

| Method | Path | What it does |
| --- | --- | --- |
| `GET` | `/api/email-campaign-templates` | List templates. |
| `POST` | `/api/email-campaign-templates` | Create a template. |
| `DELETE` | `/api/email-campaign-templates/:id` | Delete a template. |
| `GET` | `/api/email-campaign-launches` | Launch history, newest first, with run statuses. |

### `POST /api/campaign-runs/callback` (no auth — secret header)

Called **by n8n** when a workflow run finishes or fails. Authenticated with the `X-Callback-Secret` header (must match `N8N_WEBHOOK_SECRET` or `N8N_RELAUNCH_WEBHOOK_SECRET`).

```json
{ "runId": "<the runId from the launch payload>", "status": "finished" | "failed", "detail": "optional text" }
```

`runId` may be **omitted** (the n8n Error Trigger never sees the launch payload): the app then updates the most recent run still marked "in progress", optionally narrowed with a `"campaignName"` field. Returns `404` if no matching in-progress run exists.

The launch payload sent **to** n8n includes a `mode` field — `"launch"` (full run, also used for New Launch) or `"relaunch"` (skips lead processing) — so downstream workflows can branch on it.

## Google connection (raw-sheet lead check)

| Method | Path | Auth | What it does |
| --- | --- | --- | --- |
| `GET` | `/api/google/status` | Bearer | `{ connected, email }` — is a Google account linked? |
| `GET` | `/api/google/auth-url` | Bearer | Returns the Google consent-screen URL to redirect the browser to. |
| `GET` | `/api/google/callback` | **(no auth)** | Google's redirect target. Protected by an HMAC-signed `state` parameter; exchanges the code for tokens and redirects to `/campaigns?google=connected` or `?google=error`. |

---

## Quick example

```bash
# Log in
TOKEN=$(curl -s -X POST https://blueempiregroup.co.uk/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"YOUR_KEY"}' | jq -r .token)

# Generate 5 codes
curl -s -X POST https://blueempiregroup.co.uk/api/promo-codes/generate-bulk \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"format":"PROMO-XXXX","count":5,"campaignName":"Test"}'
```

## Security notes

- Keep the API key and tokens out of client-side code and version control.
- Use one permanent token per connected app so any one can be revoked alone.
- All endpoints are HTTPS-only in production.

---

*Last updated: July 7, 2026.*
