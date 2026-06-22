# Promo Code Manager — User Manual

A simple, complete guide to running your promo code system: creating codes, tracking them, redeeming, importing/exporting, managing campaigns, and connecting other tools.

> **Where to use it:** open your app at your web address (your custom domain `blueempiregroup.co.uk`, or the backup address `promo-code-manager.bluepavilionemail.workers.dev`).

---

## Table of contents

1. [What this app does](#1-what-this-app-does)
2. [Getting started — logging in](#2-getting-started--logging-in)
3. [The dashboard at a glance](#3-the-dashboard-at-a-glance)
4. [Creating promo codes](#4-creating-promo-codes)
5. [Campaigns](#5-campaigns)
6. [Finding codes — search & filters](#6-finding-codes--search--filters)
7. [Redeeming a code](#7-redeeming-a-code)
8. [Copying & exporting (download)](#8-copying--exporting-download)
9. [Importing codes from a spreadsheet](#9-importing-codes-from-a-spreadsheet)
10. [Deleting codes (and staying safe)](#10-deleting-codes-and-staying-safe)
11. [API tokens — connecting other tools](#11-api-tokens--connecting-other-tools)
12. [Changing the look (themes)](#12-changing-the-look-themes)
13. [Logging out & sessions](#13-logging-out--sessions)
14. [Tips & best practices](#14-tips--best-practices)
15. [Troubleshooting](#15-troubleshooting)
16. [For the administrator](#16-for-the-administrator)
17. [Ideas for the future](#17-ideas-for-the-future)

---

## 1. What this app does

Promo Code Manager helps you **create, hand out, and keep track of discount/promo codes**. You can:

- Make codes one at a time or thousands at once.
- Group codes into **campaigns** (for example, "Summer Sale" or "Christmas 2026").
- See live numbers: how many codes exist, how many were used, and how many are still available.
- Mark a code as **redeemed** when a customer uses it.
- **Download** your codes to a spreadsheet, or **upload** codes from one.
- Connect other apps (like Zapier or n8n) using secure access tokens.

---

## 2. Getting started — logging in

1. Open the app in your web browser.
2. You'll see the **Promo Code Manager** login box.
3. Type your **API Key** (your login key) into the box.
4. Click **Sign In**.

That's it — you're in. Your login is remembered on that device for **30 days**, so you won't need to type the key every time.

> **Don't have the key?** Ask whoever set up the app for you (see [For the administrator](#16-for-the-administrator)). Keep the key private — anyone with it can manage your codes.

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

To keep things fast, codes are shown **100 per page**. Use the **Previous** and **Next** buttons at the bottom to move between pages. The app tells you which page you're on and how many there are in total.

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

## 5. Campaigns

A **campaign** is just a label that ties a group of codes together — like "Black Friday" or "Loyalty Members."

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

## 12. Changing the look (themes)

Click the **palette icon** in the top-right corner to switch the app's appearance. Three styles are available:

1. **Default (Blue)** — clean, modern, professional.
2. **Restaurant Light (Gold)** — warm gold tones for food/hospitality.
3. **Restaurant Dark (Gold)** — the same warm gold on a dark background, easier on the eyes in low light.

Your choice is remembered on your device.

---

## 13. Logging out & sessions

- Your login lasts **30 days** on each device, then you'll be asked for the key again.
- To log out sooner (for example, on a shared computer), use the logout/sign-out action. This clears your saved login from that browser.

---

## 14. Tips & best practices

- **Name campaigns consistently** so your stats stay clean.
- **Back up before deleting** — a quick Download All saves headaches.
- **Use longer codes** for public promotions so they're harder to guess.
- **Set expiry dates** on time-limited offers so old codes stop working automatically.
- **One token per connected app** — that way you can revoke just one without affecting the others.
- **Keep your login key private** and only share it with people who need to manage codes.

---

## 15. Troubleshooting

| Problem | What to try |
| --- | --- |
| **"Invalid API key" at login** | Double-check the key for typos or extra spaces. Confirm with your administrator that it hasn't changed. |
| **A code won't redeem** | It's probably already used or expired — check its status in the table. |
| **My numbers look wrong** | Refresh the page; the stats recalculate from the live data. |
| **A connected app (Zapier/n8n) stopped working** | Its token may have been revoked or replaced. Create a new token and update the app. |
| **The custom domain isn't loading** | Try the backup address (`...workers.dev`). If that works, it's a domain/deploy setting — see below. |
| **Import didn't add my codes** | Make sure the file is a `.csv` and the first column is `code`. Compare it to a Download All file. |

---

## 16. For the administrator

This section is for whoever installs and deploys the app.

- **Login key:** The login key is the `API_KEY` value stored in the app's secret settings (not printed here on purpose, so this manual is safe to share). To change it, update that secret and redeploy.
- **Database:** Codes are stored in a Supabase PostgreSQL database. The required tables/setup live in `supabase-setup.sql`.
- **Hosting:** The app runs on Cloudflare Workers, served at both the custom domain (`blueempiregroup.co.uk`) and the `...workers.dev` address.
- **Deploying:** Build with `npm run build`, then deploy with `wrangler deploy --env=""`.
  - On deploy, Wrangler shows a small warning listing a few route fields (`zone_name`, `enabled`, `previews_enabled`) and adding `assets`. **This is normal and safe** — those are Cloudflare's own status fields, and the config is set up to keep both your custom domain and the `...workers.dev` URL active.
- **Two URLs stay live:** the config intentionally keeps `workers_dev = true` so the backup address keeps working alongside the custom domain.

---

## 17. Ideas for the future

A few optional improvements that could make the app even better:

- **A theme switcher on the login screen**, so you can change the look before signing in.
- **Per-user logins** instead of one shared key, so you can see who created or deleted what.
- **Scheduled codes** that automatically turn on at a future date.
- **Single-use vs multi-use codes**, for codes meant to be used many times.
- **A small activity log** showing recent actions (created, redeemed, deleted) for peace of mind.

> Want any of these? Just ask and we can add them.

---

*Last updated: June 15, 2026.*
