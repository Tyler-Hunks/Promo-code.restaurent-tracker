# Campaigns Tab — Setup & Deploy Guide

This guide explains how to turn on the new **Campaigns** tab. The tab lets you
create cold-email campaigns (and reusable templates) and **launch** them. When
you press *Launch*, the app quietly sends the campaign details to your **n8n**
automation workflow, which does the actual emailing. Your n8n web address and
password are kept on the server and are never shown in the browser.

There are four things to set up, in this order:

1. Create the n8n webhook (the "doorbell" n8n listens on)
2. Add the two new database tables in Supabase
3. Add two secrets so the app can reach n8n (development first, then production)
4. Rebuild and redeploy the production site

---

## 1. Create the n8n webhook

1. In n8n, create a new workflow (or open the one that sends your emails).
2. Add a **Webhook** node as the first step.
   - **HTTP Method:** `POST`
   - **Path:** anything you like, e.g. `launch-campaign`
   - Copy the **Production URL** it shows you — this is your `N8N_WEBHOOK_URL`.
3. Protect the webhook with a shared password (so only your app can trigger it):
   - The app always sends a header called **`X-Trigger-Secret`** with every
     request. Its value is whatever you choose for `N8N_WEBHOOK_SECRET`.
   - In the Webhook node, add **Header Auth** (or an IF/Filter step) that checks
     that the `X-Trigger-Secret` header matches your chosen password. Reject the
     request if it doesn't match.
4. **Activate** the workflow so the Production URL is live.

### What the app sends to n8n

Every launch sends a `POST` request with this JSON body:

```json
{
  "campaignId": "uuid",
  "campaignName": "June Restaurant Outreach",
  "campaignType": "cold-email",
  "documentId": "google-sheet-id",
  "documentId2": "optional-second-sheet-id-or-null",
  "campaignInfoGid": "sheet-tab-gid",
  "mainScript": "the first email message",
  "followUps": ["follow-up 1", "follow-up 2"],
  "expiryDate": "2026-08-01",
  "triggeredAt": "2026-06-30T09:15:00.000Z"
}
```

Header sent with the request:

```
X-Trigger-Secret: <your N8N_WEBHOOK_SECRET>
```

Your n8n workflow reads these fields and does whatever it needs (open the Google
Sheet, send the emails, schedule the follow-ups, etc.).

> The app treats any **2xx** response from n8n as success and then marks the
> campaign as *Launched*. Anything else (or a timeout) is shown as an error and
> the campaign stays a *Draft* so you can try again.

---

## 2. Add the database tables in Supabase

The Campaigns feature uses two new tables: `email_campaigns` and
`email_campaign_templates`. They are already included in `supabase-setup.sql`.

1. Open your project in **Supabase → SQL Editor**.
2. Paste the full contents of **`supabase-setup.sql`** and click **Run**.
   - It uses `CREATE TABLE IF NOT EXISTS`, so it's safe to run again on an
     existing database — it won't touch or delete your existing data.

---

## 3. Add the two secrets

The app needs two secret values:

| Secret               | What it is                                            |
| -------------------- | ----------------------------------------------------- |
| `N8N_WEBHOOK_URL`    | The Production URL from your n8n Webhook node          |
| `N8N_WEBHOOK_SECRET` | The password you chose for the `X-Trigger-Secret` header |

### Development (here in Replit)

Add both values in the **Secrets** panel (the lock icon) in the workspace, or
let the app prompt you for them. Once they're set, the *Launch* button works in
the development preview.

> Until these are set, the app stays safe: pressing *Launch* simply says
> "Campaign launching isn't configured yet" instead of doing anything.

### Production (Cloudflare Workers)

Set the same two secrets on the live Worker from your terminal:

```bash
wrangler secret put N8N_WEBHOOK_URL
# paste the n8n Production URL when prompted

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

- **New campaign** — fill in the campaign name, the Google Sheet Document ID,
  the Campaign Info tab GID, the main script, and any follow-ups. It's saved as a
  **Draft**.
- **Templates** — press **New template** to save a reusable set of details. When
  creating a campaign, pick a template from the dropdown to prefill the form.
- **Launch** — press **Launch** on a campaign card and confirm. The status
  changes to **Launched** and the *Last launched* date updates. You can
  **Re-launch** an already-launched campaign at any time (it asks you to confirm).
- **Switch the menu layout** — use the **Side menu / Top tabs** button in the
  header to move the navigation between the top and the side. Your choice is
  remembered on this device.

> Note: campaigns and templates can be created and edited, but **not deleted** —
> this is intentional so launch history is always kept.
