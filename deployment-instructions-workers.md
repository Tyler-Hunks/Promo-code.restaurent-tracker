# Deployment Instructions: Cloudflare Workers + Supabase

## Why Workers Instead of Pages
- **Better for full-stack apps** - single deployment for frontend + backend
- **No filename restrictions** - no `[...routes]` issues  
- **Better Node.js support** - native postgres compatibility
- **Cloudflare's 2024 recommendation** - all new development focuses on Workers

## Prerequisites
1. GitHub account
2. Cloudflare account
3. Supabase account
4. Wrangler CLI (we'll install this)

## Step 1: Set Up Supabase Database
(Same as before - use the `supabase-setup.sql` file)

### 1.1 Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Note your project URL and keys

### 1.2 Run Database Setup
Copy and paste `supabase-setup.sql` into Supabase SQL Editor and run it.

## Step 2: Install Wrangler CLI

```bash
npm install -g wrangler
```

## Step 3: Deploy to Cloudflare Workers

### 3.1 Build Frontend
```bash
vite build --config vite.config.cloudflare.ts
```

### 3.2 Login to Cloudflare
```bash
wrangler login
```

### 3.3 Set Environment Variables
```bash
wrangler secret put DATABASE_URL
wrangler secret put SUPABASE_URL  
wrangler secret put SUPABASE_ANON_KEY
wrangler secret put API_KEY
```

### 3.4 Deploy
```bash
wrangler deploy
```

## Step 4: Test Your Deployment

Your app will be available at:
`https://promo-code-manager.your-subdomain.workers.dev`

## Benefits of This Approach

### ✅ Solved Issues:
- No more filename restrictions
- Better database compatibility  
- Single URL for everything
- Simpler configuration
- Native Node.js support

### ✅ Same Features:
- All your promo code functionality
- React frontend
- Supabase database
- API authentication

### ✅ Better Developer Experience:
- Local development with `wrangler dev`
- Automatic deployments
- Better error handling
- Comprehensive logging

## Commands Summary

```bash
# Build frontend
vite build --config vite.config.cloudflare.ts

# Deploy to Workers
wrangler deploy

# Local development
wrangler dev

# View logs
wrangler tail
```

## Migration from Pages Setup

If you already started with Pages:
1. The Supabase database setup remains the same
2. Environment variables transfer directly
3. No changes to your React frontend
4. Just deploy with Workers instead

This approach eliminates all the compatibility issues you were experiencing with Pages Functions.