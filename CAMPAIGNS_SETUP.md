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

Every launch sends a `POST` request with this JSON body:

```json
{
  "campaignId": "uuid",
  "campaignName": "June Restaurant Outreach",
  "campaignType": "cold-email",
  "documentId": "google-sheet-document-id",
  "sheetIds": ["0", "123456789"],
  "mainScript": "Hi {{ first_name }}, ...",
  "followUps": ["Just following up, {{ first_name }}...", "Last note..."],
  "placeholders": ["first_name"],
  "expiryDate": "2026-08-01",
  "triggeredAt": "2026-06-30T09:15:00.000Z"
}
```

Field guide:

| Field          | Meaning                                                                        |
| -------------- | ------------------------------------------------------------------------------ |
| `campaignId`   | The campaign's unique ID in this app.                                           |
| `campaignName` | The campaign's display name.                                                    |
| `campaignType` | A free-text label (e.g. `cold-email`), or `null`.                              |
| `documentId`   | **One** Google Sheet file — the long ID from the spreadsheet URL.              |
| `sheetIds`     | An **array** of tab gids inside that document (always at least 2).             |
| `mainScript`   | The first email message. May contain `{{ placeholders }}`.                     |
| `followUps`    | An ordered list of follow-up messages. May contain `{{ placeholders }}`.       |
| `placeholders` | Every `{{ token }}` the app found across the scripts — the variables to fill.   |
| `expiryDate`   | Optional `YYYY-MM-DD` date, or `null`.                                          |
| `triggeredAt`  | The moment the launch was fired (ISO timestamp), added automatically.          |

> **Placeholders are detected automatically.** Anywhere you write `{{ name }}`
> style tokens in the main script or a follow-up, the app collects the unique
> names into `placeholders` so your n8n workflow knows exactly which columns to
> merge in. The same chips are shown on screen while you edit.

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
| `N8N_WEBHOOK_SECRET` | **Optional.** Only needed if you turned on Header Auth in n8n    |

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
    least **2 Sheet IDs (tab gids)**, the main script, and any follow-ups. It's
    saved as a **Draft**. The form checks the Document ID and Sheet ID formats
    before saving.
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

> Tips: a campaign can only launch once it has a Document ID **and at least 2
> Sheet IDs** — this protects against sending an incomplete request. Campaigns
> and templates can be created and edited, but **not deleted**, so your launch
> history is always kept.
