# Cloudflare Workers Deployment Guide

This guide will help you deploy your promo code manager to Cloudflare Workers.

## Understanding Secrets

**Important Distinction:**

1. **Replit Secrets** (✅ already configured)
   - Used by your DEV environment running on Replit
   - When you run `npm run dev`, it uses these
   - CLOUDFLARE_API_TOKEN here is used by wrangler CLI to deploy

2. **Cloudflare Secrets** (❌ need to add after deployment)
   - Used by your PRODUCTION environment on Cloudflare Workers
   - Stored encrypted in Cloudflare's infrastructure
   - Separate from Replit because they live in different systems

You need BOTH sets because dev and production are separate environments!

## Prerequisites

- ✅ Cloudflare API Token (already added to Replit Secrets - for deployment)
- ✅ Supabase database credentials (already added to Replit Secrets - for dev)
- ✅ `wrangler.toml` configured (done!)

## Step 1: Build the Application

First, build both the frontend and backend:

```bash
npm run build
```

This will:
- Build the React frontend with Vite → `dist/public/`
- Bundle the Express backend for Cloudflare Workers → `dist/worker.js`

## Step 2: Deploy to Cloudflare (Preview)

Deploy to the preview environment first to test:

```bash
wrangler deploy
```

This uses your `CLOUDFLARE_API_TOKEN` from Replit Secrets automatically.

## Step 3: Add Secrets to Cloudflare Worker

After deployment, you need to add your database credentials as secrets to the Cloudflare Worker. Run these commands:

```bash
# Add DATABASE_URL
echo "$DATABASE_URL" | wrangler secret put DATABASE_URL

# Add SUPABASE_URL  
echo "$SUPABASE_URL" | wrangler secret put SUPABASE_URL

# Add SUPABASE_ANON_KEY
echo "$SUPABASE_ANON_KEY" | wrangler secret put SUPABASE_ANON_KEY

# Add API_KEY (the key users use to log in)
echo "ProcogenBluePavTracker" | wrangler secret put API_KEY
```

## Step 4: Verify Deployment

After adding secrets, your app should be live at:
```
https://promo-code-manager.YOUR_SUBDOMAIN.workers.dev
```

Test the deployment:
1. Visit the URL
2. Log in with API key: `ProcogenBluePavTracker`
3. Try generating some promo codes
4. Check that stats and features work

## Step 5: Deploy to Production (Optional)

Once you've verified the preview works, deploy to production:

```bash
npm run deploy production
```

Then add the same secrets to production:

```bash
echo "$DATABASE_URL" | wrangler secret put DATABASE_URL --env production
echo "$SUPABASE_URL" | wrangler secret put SUPABASE_URL --env production
echo "$SUPABASE_ANON_KEY" | wrangler secret put SUPABASE_ANON_KEY --env production
echo "ProcogenBluePavTracker" | wrangler secret put API_KEY --env production
```

## Important Notes

### Database Setup
Make sure your Supabase database has all required tables and functions. Run the complete `supabase-setup.sql` script in your Supabase SQL Editor if you haven't already.

Required tables:
- `users` - User authentication
- `promo_codes` - All promo codes with campaign support
- `api_tokens` - Bearer token management

Required RPC functions:
- `get_promo_stats()` - Statistics dashboard
- `get_campaign_stats()` - Campaign analytics

### API Key Security
The API key `ProcogenBluePavTracker` is currently hardcoded. For production, consider:
- Changing it to a more secure value
- Storing it as an environment variable
- Implementing proper user management

### Troubleshooting

**Build fails:**
- Check that all dependencies are installed: `npm install`
- Verify TypeScript compiles: `npm run check`

**Deployment fails:**
- Verify your CLOUDFLARE_API_TOKEN is correct
- Check that you have permissions on your Cloudflare account
- Try: `wrangler login` to re-authenticate

**App works locally but not on Cloudflare:**
- Double-check all secrets are added correctly
- Verify DATABASE_URL is accessible from Cloudflare
- Check Cloudflare Worker logs: `wrangler tail`

**Database connection errors:**
- Ensure your Supabase project allows connections from Cloudflare IPs
- Verify the DATABASE_URL format is correct
- Check that all RPC functions exist in Supabase

## Viewing Logs

To see real-time logs from your deployed worker:

```bash
wrangler tail
```

Or for production:
```bash
wrangler tail --env production
```

## Updating the Deployment

When you make changes:

1. Build: `npm run build`
2. Deploy: `wrangler deploy`
3. Secrets are preserved (no need to re-add them)

## Custom Domain (Optional)

To use a custom domain:

1. Go to Cloudflare Dashboard → Workers & Pages
2. Select your worker: `promo-code-manager`
3. Go to Settings → Triggers → Custom Domains
4. Add your domain (must be on Cloudflare DNS)
