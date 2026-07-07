# Promo Code Manager — User Manual

A simple, complete guide to running your system: creating promo codes, tracking them, redeeming, importing/exporting, and running your cold-email campaigns.

> **Where to use it:** open your app at your web address (your custom domain `blueempiregroup.co.uk`, or the backup address `promo-code-manager.bluepavilionemail.workers.dev`).

---

## Table of contents

**Part 1 — Promo codes**
1. [What this app does](#1-what-this-app-does)
2. [Getting started — logging in](#2-getting-started--logging-in)
3. [The dashboard at a glance](#3-the-dashboard-at-a-glance)
4. [Creating promo codes](#4-creating-promo-codes)
5. [Grouping codes into campaigns](#5-grouping-codes-into-campaigns)
6. [Finding codes — search & filters](#6-finding-codes--search--filters)
7. [Redeeming a code](#7-redeeming-a-code)
8. [Copying & exporting (download)](#8-copying--exporting-download)
9. [Importing codes from a spreadsheet](#9-importing-codes-from-a-spreadsheet)
10. [Deleting codes (and staying safe)](#10-deleting-codes-and-staying-safe)
11. [API tokens — connecting other tools](#11-api-tokens--connecting-other-tools)

**Part 2 — Email campaigns**
12. [The Campaigns page](#12-the-campaigns-page)
13. [Creating & editing an email campaign](#13-creating--editing-an-email-campaign)
14. [Templates](#14-templates)
15. [Launching — Launch, New Launch, Relaunch](#15-launching--launch-new-launch-relaunch)
16. [The Google Sheets lead check](#16-the-google-sheets-lead-check)
17. [History — following your runs](#17-history--following-your-runs)

**Part 3 — Everything else**
18. [Changing the look (themes)](#18-changing-the-look-themes)
19. [Logging out & sessions](#19-logging-out--sessions)
20. [Tips & best practices](#20-tips--best-practices)
21. [Troubleshooting](#21-troubleshooting)
22. [For the administrator](#22-for-the-administrator)

---

# Part 1 — Promo codes

## 1. What this app does

The app has two halves:

**Promo codes** — create, hand out, and keep track of discount/promo codes:
- Make codes one at a time or thousands at once.
- Group codes into campaigns (for example, "Summer Sale" or "Christmas 2026").
- See live numbers: how many codes exist, how many were used, how many are still available.
- Mark a code as **redeemed** when a customer uses it.
- **Download** your codes to a spreadsheet, or **upload** codes from one.
- Connect other apps (like Zapier or n8n) using secure access tokens.

**Email campaigns** — run your cold-email outreach from the **Campaigns** page:
- Store each campaign's Google Sheet details and email scripts in one place.
- Launch the n8n email workflow with one click — and see exactly what will be sent before you confirm.
- See how many leads are waiting in your raw sheet before launching.
- Follow every run in the History tab: in progress, finished, failed, or needs checking.

---

## 2. Getting started — logging in

1. Open the app in your web browser.
2. You'll see the **Promo Code Manager** login box.
3. Type your **API Key** (your login key) into the box.
4. Click **Sign In**.

That's it — you're in. Your login is remembered on that device for **30 days**, so you won't need to type the key every time.

> **Don't have the key?** Ask whoever set up the app for you (see [For the administrator](#22-for-the-administrator)). Keep the key private — anyone with it can manage your codes.

---

## 3. The dashboard at a glance

Once you log in, the main screen shows everything in one place.

### The five numbers at the top

| Number | What it means |
| --- | --- |
| **Total Generated** | Every code you've ever created. |
| **Available** | Codes that haven't been used and haven't expired — ready to hand out. |
| **Redeemed** | Codes a customer has already used. |
| **Expired** | Codes whose expiry date has passed. |
| **Redemption Rate** | The percentage of your codes that have been used. |

These update automatically as codes are created, used, or expire.

### The code table

Below the numbers is a list of your codes, showing the **Code**, its **Campaign**, the **Discount**, when it was **Created**, when it **Expires**, and its **Status** (a coloured label: Available, Redeemed, or Expired).

Each row also has quick actions: **Copy**, **toggle status** (flip between used/available), and **delete**.

### Pages

To keep things fast, codes are shown **100 per page**. Use the **Previous** and **Next** buttons at the bottom to move between pages.

---

## 4. Creating promo codes

You can make a single code or a big batch.

### Steps

1. Open the **Generate** option on the dashboard.
2. Fill in the fields:
   - **Code Format** — the shape of your codes (see below).
   - **Count** — how many to create at once (1 for a single code, or any number for bulk).
   - **Campaign Name** *(optional)* — group these codes under a name.
   - **Discount Value** *(optional)* — for example, `10%` or `£5`.
   - **Expiration Date** *(optional)* — when the codes should stop working.
3. Click to generate. Your new codes appear in the table right away.

### Understanding "Code Format"

The letter **X** is a placeholder for a random character. Everything else stays as you typed it.

| You type | You get (examples) |
| --- | --- |
| `PROMO-XXXX` | `PROMO-A1B2`, `PROMO-9K3M` |
| `SUMMER-XXXX` | `SUMMER-7QZ1`, `SUMMER-M4P8` |
| `XXXXXXXXXX` | `A1B2C3D4E5` (ten random characters) |

> **Tip:** Add more `X`s for more possible combinations. Longer codes are harder to guess and let you create more unique codes without clashes.

---

## 5. Grouping codes into campaigns

A promo-code **campaign** is just a label that ties a group of codes together — like "Black Friday" or "Loyalty Members." (This is separate from the email campaigns in Part 2.)

- **Create one** by typing a Campaign Name when you generate codes (or use **Create Campaign**, where the name and discount are required).
- **See how each campaign is doing** in the **Campaign Stats** area in the sidebar — it shows the total, available, and used codes for every campaign.
- **Focus on one campaign** using the Campaign filter (see next section).

> **Tip:** Use clear, consistent names (for example, always `Summer-2026` rather than `summer` one time and `Summer Sale` the next). It keeps your stats tidy.

---

## 6. Finding codes — search & filters

Use these tools above the table to narrow down what you see:

- **Search bar** — type part of a code or a campaign name.
- **Campaign filter** — pick one campaign from the dropdown.
- **Status filter** — show All, Available, Redeemed, or Expired.
- **Discount filter** — type a value like `10%` to show only those codes.

You can combine these — for example, "Available codes in the Summer-2026 campaign."

---

## 7. Redeeming a code

When a customer uses a code, mark it as redeemed so it can't be used again.

1. Find the **Redeem Code** box (left sidebar).
2. Type or paste the code.
3. Click **Redeem Code**.

The code is marked **used** and the date/time is recorded. If the code was already used or has expired, the app will tell you and won't redeem it again.

> You can also flip a single code between used and available using the toggle action on its row — handy if you redeem one by mistake.

---

## 8. Copying & exporting (download)

### Copy a single code
Click the **Copy** button on any row to copy that code to your clipboard.

### Download to a spreadsheet (CSV)
You have three download choices:

- **Download All** — every code in your system.
- **Download Page** — just the 100 codes shown on the current page.
- **Download Selected** — only the codes you've ticked.

The downloaded file includes these columns:

`Code, Status, Campaign, Discount Value, Created At, Used At, Expires At`

> A CSV file opens in Excel, Google Sheets, or Numbers — great for sharing or keeping records.

---

## 9. Importing codes from a spreadsheet

Already have codes in a spreadsheet? Bring them in.

1. Click the **Upload** option.
2. Choose your **CSV file**.

Your file should have these columns (only `code` is required):

| Column | Required? | Notes |
| --- | --- | --- |
| `code` | ✅ Yes | The promo code itself. |
| `status` | Optional | `unused` or `used`. |
| `campaign` | Optional | Campaign name. |
| `discount value` | Optional | e.g. `10%`. |
| `used at` | Optional | Date it was used. |
| `expires at` | Optional | Expiry date. |

> **Tip:** The easiest way to get the format right is to do a **Download All** first, look at how that file is laid out, and match it.

---

## 10. Deleting codes (and staying safe)

Deleting is permanent, so the app has several levels with safety checks.

- **Delete one** — click the trash icon on a single row.
- **Delete several** — tick the checkboxes next to the codes you want, then click **Delete Selected (N)** in the bar that appears.
- **Delete by filter** — open **Settings → Advanced Deletion** to remove every code that matches a chosen **campaign**, **status**, or **discount**. For safety, you must type **DELETE** to confirm.
- **Clear All** — if you have more than 1,000 codes, a button appears in Settings to wipe everything (used for a fresh start).

> ⚠️ **There is no undo.** Before a big delete, do a **Download All** so you have a backup copy.

---

## 11. API tokens — connecting other tools

If you want another app (like **Zapier**, **n8n**, or your own website) to create or read codes automatically, you give it a **permanent token** instead of your login key.

In the **Token Manager** you can:

- **Create a token** — give it a name (e.g. "Website Checkout") and copy the token that's shown.
- **Track usage** — see when each token was created and last used.
- **Revoke** — delete a token to instantly cut off that app's access.

> **Important:** A token is shown **once** when you create it — copy it somewhere safe right away. Treat tokens like passwords. If one leaks, revoke it and make a new one.

---

# Part 2 — Email campaigns

## 12. The Campaigns page

Click **Campaigns** in the navigation to open the email-campaign side of the app. It has three tabs:

| Tab | What it's for |
| --- | --- |
| **Campaigns** | Your campaign cards — create, edit, launch, and relaunch from here. |
| **History** | Every launch ever made, with live status of each workflow run. |
| **Templates** | Reusable starting points that prefill the campaign form. |

Each tab has its own search box, and long lists are split into pages.

---

## 13. Creating & editing an email campaign

Click **New campaign** (or **Edit** on a card) and fill in:

- **Campaign name** — e.g. "June Restaurant Outreach".
- **Tag** — a short label, e.g. `cold-email`.
- **Document ID** — the long ID from your Google Sheet's web address (the part between `/d/` and `/edit`).
- **Sheet IDs (gids)** — the tab numbers for your two lead lists. Each tab of a Google Sheet has a `gid` in the address bar (e.g. `gid=0`).
- **Raw leads Sheet ID** — the gid of the tab where fresh, unprocessed leads live. The launch check counts leads here, and n8n pulls new leads from here.
- **Main scripts** — the email message for each list. Use placeholders like `{{ name }}` for personalisation.
- **Follow-ups** — optional follow-up messages.
- **Expiry date & notes** — optional, for your own records.

A campaign card shows its status, its latest run, and buttons to **Edit**, **Launch**/**New Launch**, **Relaunch**, and **Delete**. There's also a shortcut to open the raw sheet directly in Google Sheets.

> **Tip:** Start from a **template** (see below) so you don't retype the same Document ID and scripts every time.

---

## 14. Templates

Templates save you from re-entering the same details for every campaign.

- **Create one** in the Templates tab — give it a name, and optionally a tag, Document ID, gids, and scripts.
- **Use one** when creating a campaign: pick it from the "Choose a template to prefill…" dropdown, and the form fills itself in. You can still change anything before saving.
- **Delete** templates you no longer need — campaigns already created from them are not affected.

---

## 15. Launching — Launch, New Launch, Relaunch

There are three buttons, and they do slightly different things:

| Button | When you see it | What it does |
| --- | --- | --- |
| **Launch** | Campaign hasn't been launched yet | Runs the full email workflow: processes new leads from the raw sheet, then sends. |
| **New Launch** | Campaign was launched before | Exactly the same as Launch — a fresh full run. |
| **Relaunch** | Campaign was launched before | **Skips lead processing.** Re-sends to the leads that were already processed, using your current scripts. Use this after tweaking a script. |

Whichever you click, a confirmation window opens first showing the **exact payload** that will be sent to n8n — the sheet IDs, the scripts, everything. Nothing is sent until you confirm.

For a Launch or New Launch, the window also shows the **lead check** (next section).

> A campaign can't launch until it has a Document ID, both Sheet IDs, a Raw leads Sheet ID, and both main scripts filled in. The app will tell you what's missing.

---

## 16. The Google Sheets lead check

When you open the Launch (or New Launch) window, the app peeks into your raw leads tab and tells you what's there:

- ✅ **"X leads found in the raw sheet"** (green) — you're good to go.
- ⚠️ **"The raw leads sheet looks empty"** (amber) — the workflow may find nothing new to send. You can still launch, but you probably want to add leads first.
- **"Connect Google"** button — shown the first time, before you've linked your Google account.
- **"Couldn't check…"** (grey) — the check failed (e.g. wrong gid, or no access to the sheet). It never blocks launching; it's information only.

### Connecting Google (one-time)

1. Make sure you're on **blueempiregroup.co.uk** (the connection only works from the custom domain).
2. Open any Launch window and click **Connect Google**.
3. Sign in with the Google account that has access to your lead sheets and allow access.

You'll be brought straight back to the app. From then on, the lead count appears automatically. Relaunches skip the check, since they reuse already-processed leads.

---

## 17. History — following your runs

The **History** tab lists every launch, newest first. You can view it **by launch** (each individual run) or **by campaign** (one row per campaign with totals). Click any entry to see its full details.

### What the status badges mean

| Badge | Meaning |
| --- | --- |
| **In progress** (amber, spinning) | n8n accepted the launch and the workflow is running. The page checks for updates automatically every 15 seconds. |
| **Finished** (green) | The workflow completed and reported back successfully. |
| **Workflow failed** (red) | The workflow ran but reported a failure — click the entry to see the reason. |
| **Send failed** (red) | The launch never started — n8n rejected the request (e.g. webhook down). |
| **Needs checking** (amber outline, ⚠) | The run has been silent for **over 30 minutes** with no report back. It may still be running, may have crashed, or the callback may have failed — check n8n directly. |
| **Sent** (grey) | An old launch from before run-tracking existed — only the webhook result is known. |

---

# Part 3 — Everything else

## 18. Changing the look (themes)

Click the **palette icon** in the top-right corner to switch the app's appearance:

1. **Default (Blue)** — clean, modern, professional.
2. **Restaurant Light (Gold)** — warm gold tones.
3. **Restaurant Dark (Gold)** — the same warm gold on a dark background.

Your choice is remembered on your device.

---

## 19. Logging out & sessions

- Your login lasts **30 days** on each device, then you'll be asked for the key again.
- To log out sooner (for example, on a shared computer), use the logout/sign-out action. This clears your saved login from that browser.

---

## 20. Tips & best practices

- **Name campaigns consistently** so your stats stay clean.
- **Back up before deleting** — a quick Download All saves headaches.
- **Use longer codes** for public promotions so they're harder to guess.
- **Set expiry dates** on time-limited offers so old codes stop working automatically.
- **One token per connected app** — that way you can revoke just one without affecting the others.
- **Check the lead count before launching** — if the raw sheet looks empty, top it up first.
- **Use Relaunch after script tweaks** — no need to re-process leads just to send an updated message.
- **If a run says "Needs checking"**, open n8n and look at that workflow's execution before launching again.

---

## 21. Troubleshooting

| Problem | What to try |
| --- | --- |
| **"Invalid API key" at login** | Double-check the key for typos or extra spaces. Confirm with your administrator that it hasn't changed. |
| **A code won't redeem** | It's probably already used or expired — check its status in the table. |
| **My numbers look wrong** | Refresh the page; the stats recalculate from the live data. |
| **A connected app (Zapier/n8n) stopped working** | Its token may have been revoked or replaced. Create a new token and update the app. |
| **The custom domain isn't loading** | Try the backup address (`...workers.dev`). If that works, it's a domain/deploy setting — see `DEPLOYMENT.md` in this folder. |
| **Import didn't add my codes** | Make sure the file is a `.csv` and the first column is `code`. Compare it to a Download All file. |
| **"Launch isn't configured yet"** | The n8n webhook address is missing from the app's secret settings — see the administrator section. |
| **The lead check says "Couldn't check"** | Usually a wrong Raw leads gid, or the connected Google account can't open that sheet. The check never blocks launching. |
| **"Connect Google" fails or bounces back with an error** | Make sure you're on `blueempiregroup.co.uk` (not the workers.dev address), and that the redirect URI is registered in Google Cloud Console. Then try again. |
| **A run is stuck on "In progress" or "Needs checking"** | Open n8n and check the execution. If it actually finished, the callback may have failed — the run will flip to "Needs checking" after 30 minutes so you know to look. |

---

## 22. For the administrator

This section is for whoever installs and deploys the app. Full details live in `DEPLOYMENT.md` in this folder.

- **Login key:** the `API_KEY` value stored in the app's secret settings. To change it, update that secret and redeploy.
- **Database:** Supabase PostgreSQL. All tables and policies live in `supabase-setup.sql` — safe to re-run the whole script in the Supabase SQL Editor whenever it changes.
- **Hosting:** Cloudflare Workers, served at both `blueempiregroup.co.uk` and the `...workers.dev` backup address.
- **Deploying:** `npm run deploy` (builds and deploys via Wrangler).
- **Secrets on the Worker** (set with `wrangler secret put NAME`):
  - `API_KEY` — the login key
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY` — database connection
  - `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET` — launch workflow
  - `N8N_RELAUNCH_WEBHOOK_URL`, `N8N_RELAUNCH_WEBHOOK_SECRET` — relaunch workflow
  - `GOOGLE_OAUTH_CLIENT_JSON` — Google OAuth web-client file for the lead check
- **Google setup (one-time):** enable the Google Sheets API, register the redirect URI `https://blueempiregroup.co.uk/api/google/callback` on the OAuth client, and publish the consent screen to Production.

---

*Last updated: July 6, 2026.*
