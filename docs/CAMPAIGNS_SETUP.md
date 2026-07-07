# Campaigns Tab — Setup & Deploy Guide

This guide explains how to turn on the **Campaigns** tab. The tab lets you create
cold-email campaigns (and reusable templates), **launch** them, and review a full
**launch history**. When you press *Launch*, the app quietly sends the campaign
details to your **n8n** automation workflow, which does the actual emailing. Your
n8n web address and password are kept on the server and are never shown in the
browser.

There are four things to set up, in this order:

1. Create the n8n webhook (the "doorbell" n8n listens on)
2. Add the database tables in Supabase
3. Add the secret(s) so the app can reach n8n (development first, then production)
4. Rebuild and redeploy the production site

---

## 1. Create the n8n webhook

1. In n8n, create a new workflow (or open the one that sends your emails).
2. Add a **Webhook** node as the first step.
   - **HTTP Method:** must be **`POST`** (the app sends the campaign details in
     the request body — a `GET` webhook will not receive them).
   - **Path:** n8n fills this with a long random ID by default — that's fine.
   - Copy the **Production URL** it shows you — this is your `N8N_WEBHOOK_URL`.
3. **(Optional) Add a password for extra security.**
   - By default the long, random path in your webhook URL already acts as
     protection. If that's enough for you, leave **Authentication: None** and
     skip the secret completely — you only need the URL.
   - If you want an extra check, set the Webhook node's **Authentication** to
     **Header Auth**. Create a credential whose **Header Name** is exactly
     `X-Trigger-Secret` and whose **Header Value** is a password you choose. Use
     that same password as `N8N_WEBHOOK_SECRET`. The app sends that header
     automatically whenever the secret is set.
4. **Activate** the workflow (the toggle at the top-right) so the **Production
   URL** is live. The **Test URL** only works for a single event right after you
   click "Listen for test event" — use the Production URL for real launches.

### Input — what the app sends to n8n

Every launch sends a `POST` request with this JSON body. Each main script
becomes a "list" paired, by position, with a Sheet ID — the first script →
`"A: Yes Location"` (first sheet), the second → `"B: No Location"` (second
sheet). The `label` alone identifies each list. The follow-ups are shared by
every list.

```json
{
  "mode": "launch",
  "campaignId": "uuid",
  "campaignName": "June Restaurant Outreach",
  "campaignType": "cold-email",
  "documentId": "google-sheet-document-id",
  "sheetIds": ["0", "123456789"],
  "rawSheetId": "555555555",
  "lists": [
    {
      "label": "A: Yes Location",
      "sheetId": "0",
      "mainScript": "Hi {{ first_name }}, ...",
      "followUps": ["Just following up, {{ first_name }}...", "Last note..."],
      "placeholders": ["first_name"]
    },
    {
      "label": "B: No Location",
      "sheetId": "123456789",
      "mainScript": "Hey {{ first_name }} — quick one ...",
      "followUps": ["Just following up, {{ first_name }}...", "Last note..."],
      "placeholders": ["first_name"]
    }
  ],
  "followUps": ["Just following up, {{ first_name }}...", "Last note..."],
  "placeholders": ["first_name"],
  "expiryDate": "2026-08-01T00:00:00Z",
  "triggeredAt": "2026-06-30T09:15:00.000Z",
  "runId": "launch-uuid",
  "callbackUrl": "https://your-app.example.com/api/campaign-runs/callback"
}
```

Field guide:

| Field                 | Meaning                                                                          |
| --------------------- | -------------------------------------------------------------------------------- |
| `mode`                | `"launch"` for a full run (Launch / New Launch — processes new leads first) or `"relaunch"` (re-send to existing leads, skips processing). Use this to branch your n8n workflow. |
| `campaignId`          | The campaign's unique ID in this app.                                             |
| `campaignName`        | The campaign's display name.                                                      |
| `campaignType`        | A free-text label (e.g. `cold-email`), or `null`.                                |
| `documentId`          | **One** Google Sheet file — the long ID from the spreadsheet URL.                |
| `sheetIds`            | An **array** of tab gids inside that document (always at least 2).               |
| `rawSheetId`          | The tab gid holding the **raw, unprocessed leads** — required on every campaign. |
| `lists`               | The two lead lists — one per main script.                                        |
| `lists[].label`       | `"A: Yes Location"` for the first list, `"B: No Location"` for the second.      |
| `lists[].sheetId`     | The single tab gid this list emails (the same-index entry from `sheetIds`).      |
| `lists[].mainScript`  | That list's first email message. May contain `{{ placeholders }}`.               |
| `lists[].followUps`   | The shared follow-up messages (identical in every list).                         |
| `lists[].placeholders`| Every `{{ token }}` found in **this list's** script + follow-ups.                |
| `followUps`           | The shared follow-up messages, at the top level for convenience.                 |
| `placeholders`        | Every `{{ token }}` found across **all** scripts + follow-ups (whole campaign).  |
| `expiryDate`          | Optional **ISO date-time in UTC** (`YYYY-MM-DDT00:00:00Z`), or `null`.           |
| `triggeredAt`         | The moment the launch was fired (ISO timestamp), added automatically.            |
| `runId`               | Unique ID for **this run** — send it back in the callback (see below).           |
| `callbackUrl`         | Where n8n should `POST` the run result when the workflow ends (see below).       |

> **Two lists, two scripts.** Every campaign has exactly **two main scripts**,
> one per list, and both are required. Each script is tied by position to a
> Sheet ID: the "A: Yes Location" script emails the first sheet and the
> "B: No Location" script emails the second. These are **not** A/B variants —
> to try different versions of a message, paste them all into the same script
> box and n8n detects them automatically.

> **Placeholders are detected automatically.** Anywhere you write `{{ name }}`
> style tokens in a script or a follow-up, the app collects the unique names.
> Each list gets its own `placeholders`, and the top-level `placeholders` combines
> them for the whole campaign. The same chips are shown on screen while you edit —
> per script, per follow-up, and combined.

Header sent with the request (only when you've set a secret):

```
X-Trigger-Secret: <your N8N_WEBHOOK_SECRET>
```

### Output — what n8n sends back

Whatever your webhook returns is captured and shown in the app:

- The app treats any **2xx** response as **success**, marks the campaign as
  *Launched*, and updates its *Last launched* date.
- Any other status (or a timeout) is recorded as a **failed** launch and the
  campaign stays a *Draft* so you can try again.
- Either way, the **response body** (up to ~2000 characters) is saved against the
  launch and shown in the **History** tab and the result pop-up. A short,
  human-friendly message like `{"message":"Queued 240 leads"}` is ideal.

To return a custom message from n8n, end the workflow with a **Respond to
Webhook** node (set the Webhook node's *Respond* option to "Using Respond to
Webhook node") and send back a small JSON body.

### Live run status — telling the app when the workflow finishes

The response above only says the webhook **arrived**. To make the History tab
show whether the workflow itself **finished or failed**, have n8n call the app
back at the end of the run. Until that callback arrives, the launch shows an
amber **In progress** badge (after 30 minutes of silence it becomes
**Needs checking**).

**Requirements:** the `N8N_WEBHOOK_SECRET` secret must be set in the app — the
callback endpoint uses it to verify the request really came from your n8n.

**Step 1 — report success.** Add an **HTTP Request** node as the *last* node of
your workflow (after all the email work is done):

- **Method:** `POST`
- **URL:** `{{ $json.callbackUrl }}` — or, if the launch data isn't flowing
  through to the last node, reference the Webhook node directly:
  `{{ $('Webhook').item.json.body.callbackUrl }}`
- **Header:** `X-Callback-Secret` = your `N8N_WEBHOOK_SECRET` value
- **Body (JSON):**

```json
{
  "runId": "{{ $('Webhook').item.json.body.runId }}",
  "status": "finished",
  "detail": "Queued 240 leads across 2 lists"
}
```

**Step 2 — report failure (recommended).** Create a second, tiny workflow that
starts with an **Error Trigger** node, followed by an **HTTP Request** node.
Then, in your main workflow's **Settings**, set this as the **Error workflow**.

The Error Trigger never sees the original launch payload, so it has **no
`runId` and no `callbackUrl`**. That's fine — both can be omitted:

- **URL:** hardcode it: `https://blueempiregroup.co.uk/api/campaign-runs/callback`
- **Header:** `X-Callback-Secret` = your `N8N_WEBHOOK_SECRET` value
- **Body (JSON):**

```json
{
  "status": "failed",
  "detail": "{{ $json.execution.error.message }}"
}
```

When no `runId` is sent, the app marks the **most recent run that is still "In
progress"** as failed. Since launches are fired one at a time from the app,
that is the run that just crashed. If you ever run several campaigns at once,
add `"campaignName": "..."` to the body to pick the right one (the workflow
name is available as `{{ $json.workflow.name }}`, but campaignName must match
the campaign's name in the app — hardcoding or omitting it is safer).

If the error workflow itself fails to call back, nothing breaks — the launch
simply stays **In progress** and flips to **Needs checking** after 30 minutes.

The callback replies `200` when the status was saved, `401` for a wrong secret,
and `404` if the `runId` doesn't match any launch (or, without a `runId`, when
no run is currently in progress).

---

## 2. Add the database tables in Supabase

The Campaigns feature uses three tables: `email_campaigns`,
`email_campaign_templates`, and `email_campaign_launches` (the launch history).
They are all included in `supabase-setup.sql`.

1. Open your project in **Supabase → SQL Editor**.
2. Paste the full contents of **`supabase-setup.sql`** and click **Run**.
   - It is safe to run again on an existing database. It creates anything that's
     missing and reconciles older versions of these tables.
   - **If you used an earlier version of this tab:** the script automatically
     moves your old single tab gid (`campaign_info_gid`) into the new `sheet_ids`
     list **before** removing the obsolete `document_id_2` / `campaign_info_gid`
     columns, so no data is lost. Those migrated campaigns will have **one** Sheet
     ID — open each one and add a second before launching again.

---

## 3. Add the secret(s)

The app needs one required value and one optional value:

| Secret               | What it is                                                       |
| -------------------- | --------------------------------------------------------------- |
| `N8N_WEBHOOK_URL`    | **Required.** The Production URL from your n8n Webhook node      |
| `N8N_WEBHOOK_SECRET` | **Optional but recommended.** Used for Header Auth on the launch webhook **and** to verify run-status callbacks from n8n (the History tab's live badges need it) |
| `N8N_RELAUNCH_WEBHOOK_URL` | **Optional.** The Production URL of your separate **Campaign Relaunch** workflow's Webhook node. Enables the *Relaunch* button (re-sends to existing leads with the current scripts, skips lead processing). Until it's set, pressing *Relaunch* just says it isn't configured yet. |
| `N8N_RELAUNCH_WEBHOOK_SECRET` | **Optional.** Header Auth password for the relaunch webhook — sent in the same `X-Trigger-Secret` header. Also accepted on run-status callbacks (`X-Callback-Secret`), so the relaunch workflow can update the History badges too. |

The relaunch webhook receives the **exact same payload** as the launch one —
only the URL (and secret value) differ.

### Development (here in Replit)

Add the value(s) in the **Secrets** panel (the lock icon) in the workspace, or
let the app prompt you for them. Once `N8N_WEBHOOK_URL` is set, the *Launch*
button works in the development preview.

> Until the URL is set, the app stays safe: pressing *Launch* simply says
> "Campaign launching isn't configured yet" instead of doing anything.

### Production (Cloudflare Workers)

Set the webhook URL on the live Worker from your terminal:

```bash
wrangler secret put N8N_WEBHOOK_URL
# paste the n8n Production URL when prompted

# Only if you turned on Header Auth in n8n:
wrangler secret put N8N_WEBHOOK_SECRET
# paste your chosen password when prompted

# Only if you use the Relaunch button (separate Campaign Relaunch workflow):
wrangler secret put N8N_RELAUNCH_WEBHOOK_URL
wrangler secret put N8N_RELAUNCH_WEBHOOK_SECRET
```

These must be set on the **default** environment (the one the deploy command
uses). You only need to do this once; the values persist across deploys.

---

## 4. Rebuild and redeploy

After the secrets are in place, publish the site:

```bash
npm run deploy
```

This builds the frontend and the Worker, then deploys to Cloudflare (which keeps
your custom domain attached). Your live site updates in under a minute.

---

## Using the Campaigns tab

The page has three tabs:

- **Campaigns** — your campaigns as cards. Each shows its status, Document ID,
  how many Sheet IDs and follow-ups it has, and how many placeholders were found.
  - **New campaign** — fill in the name, the **Google Sheet Document ID**, at
    least **2 Sheet IDs (tab gids)**, the **Raw leads Sheet ID** (the tab gid
    holding your raw, unprocessed leads), **both main scripts** (one per list:
    "A: Yes Location" sends to the first sheet, "B: No Location" to the second),
    and any follow-ups. The **expiry date** is typed as `YYYY-MM-DD` (or left
    blank) and is sent to n8n as an ISO date-time (`YYYY-MM-DDT00:00:00Z`). It's
    saved as a **Draft**. The form checks the Document ID, Sheet ID, and date
    formats before saving.
  - **Duplicate** — copy an existing campaign as a starting point.
  - **Search** — filter by name, type, or Document ID.
  - **Launch** — confirm on the launch screen, which shows a **preview of the
    exact payload** that will be sent. The status changes to **Launched** and the
    *Last launched* date updates. You can **Re-launch** at any time.
- **History** — every launch attempt, success or failure, with the response from
  your workflow. Switch between **By launch** (each attempt, grouped by date) and
  **By campaign** (totals per campaign). Click a row to see the full response.
- **Templates** — reusable sets of details. Press **New template** to save one,
  then use **New campaign from this** (or the dropdown in the campaign form) to
  prefill a new campaign.

> Tips: a campaign can only launch once it has a Document ID, **at least 2
> Sheet IDs**, a **Raw leads Sheet ID**, and **both main scripts** filled in —
> this protects against sending an incomplete request. Campaigns made before
> this field existed must be edited to add their Raw leads Sheet ID before they
> can launch again. Campaigns can be created, edited, and deleted; templates
> can too. Launch history is kept even after a campaign is deleted.
