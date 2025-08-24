# Troubleshooting Guide: Cloudflare Workers Deployment

This guide covers common issues and solutions when deploying your promo code management system to Cloudflare Workers.

## Table of Contents
1. [Dependency Conflicts](#dependency-conflicts)
2. [Wrangler Authentication](#wrangler-authentication)  
3. [Secret Management](#secret-management)
4. [Build Issues](#build-issues)
5. [Environment Problems](#environment-problems)
6. [Database Connection](#database-connection)
7. [General Commands](#general-commands)

---

## Dependency Conflicts

### Problem: npm ERESOLVE errors with Vite versions
```
npm error ERESOLVE could not resolve
npm error While resolving: @tailwindcss/vite@4.1.3
npm error Found: vite@7.1.3
```

### Solution: Use legacy peer dependency resolution
```bash
# Install with legacy peer deps (recommended)
npm install --legacy-peer-deps

# Alternative: Force installation (if legacy-peer-deps doesn't work)
npm install --force
```

### Why this works:
- Vite 7.x is very new and some packages haven't updated their compatibility yet
- `--legacy-peer-deps` uses older, more permissive dependency resolution
- `--force` ignores all peer dependency conflicts (use as last resort)

---

## Wrangler Authentication

### Problem: Can't login in Replit environment
```
Error: Could not open browser for authentication
```

### Solution: Use desktop authentication
```bash
# 1. On your desktop, install wrangler globally
npm install -g wrangler

# 2. Login (opens browser)
wrangler login

# 3. Verify authentication
wrangler whoami
```

### Switching Accounts
```bash
# Log out from current account
wrangler logout

# Log in to different account
wrangler login

# Verify new account
wrangler whoami
```

---

## Secret Management

### Problem: Need to check, set, or fix environment secrets

### Check existing secrets:
```bash
wrangler secret list
```

### Delete incorrect secrets:
```bash
# Delete a specific secret
wrangler secret delete SECRET_NAME

# Example: Delete wrongly named secret
wrangler secret delete "postgresql://postgres:..."
```

### Set secrets correctly:
```bash
# Set each secret one by one
wrangler secret put DATABASE_URL
# Enter: postgresql://postgres:your-password@db.your-project-id.supabase.co:5432/postgres

wrangler secret put SUPABASE_URL
# Enter: https://your-project-id.supabase.co

wrangler secret put SUPABASE_ANON_KEY
# Enter: your-supabase-anon-key

wrangler secret put API_KEY
# Enter: your-secure-api-key
```

### Fixing secret entry mistakes:
- **If you're still in the prompt**: Press `Ctrl+C` to cancel
- **If you entered wrong value**: Run the same command again to overwrite
- **If you used wrong secret name**: Delete it and create a new one

### Environment warnings:
```
Multiple environments are defined in the Wrangler configuration file
```
This is normal. You can:
- Ignore the warning (applies to default environment)
- Or be explicit: `wrangler secret put DATABASE_URL --env=""`

---

## Build Issues

### Problem: Build command fails with file not found

### Common filename typos:
```bash
# ❌ Wrong (missing 'u' in cloudflare)
npx vite build --config vite.config.cloudlfare.ts

# ✅ Correct
npx vite build --config vite.config.cloudflare.ts
```

### Missing dependencies:
```bash
# Always install dependencies first
npm install --legacy-peer-deps

# Then build
npx vite build --config vite.config.cloudflare.ts
```

### Complete build sequence:
```bash
cd your-project-directory
npm install --legacy-peer-deps
npx vite build --config vite.config.cloudflare.ts
wrangler deploy
```

---

## Environment Problems

### Problem: @types/node version conflicts
```
Conflicting peer dependency: @types/node@24.3.0
```

### Solution: Update types or use legacy deps
```bash
# Option 1: Use legacy peer deps (easiest)
npm install --legacy-peer-deps

# Option 2: Update @types/node manually
npm install @types/node@^22.12.0 --save-dev

# Option 3: Downgrade Vite if needed
npm install vite@^6.0.0 --save-dev --legacy-peer-deps
```

---

## Database Connection

### Problem: Can't connect to Supabase database

### Check connection string format:
```
postgresql://postgres:[PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres
```

### Where to find values:
1. **Supabase Dashboard** → Project Settings → API
   - Project URL: `https://your-project-id.supabase.co`
   - Anon Key: `eyJ...` (long string)

2. **Supabase Dashboard** → Project Settings → Database
   - Connection string in URI format

### Test connection locally:
```bash
# In your Replit environment
npm run dev
# Check if app loads and connects to database
```

---

## General Commands

### Essential Wrangler commands:
```bash
# Authentication
wrangler login          # Login to Cloudflare
wrangler logout         # Logout from current account  
wrangler whoami         # Check current account

# Secrets management
wrangler secret list    # List all secret names
wrangler secret put KEY # Set a secret value
wrangler secret delete KEY # Delete a secret

# Deployment
wrangler deploy         # Deploy to Cloudflare Workers
wrangler tail          # View real-time logs
```

### Development workflow:
```bash
# In Replit (development)
npm run dev

# On desktop (deployment)
npm install --legacy-peer-deps
npx vite build --config vite.config.cloudflare.ts  
wrangler deploy
```

---

## Step-by-Step Recovery

If everything breaks, here's the complete recovery process:

### 1. Clean slate approach:
```bash
# On desktop
cd your-project-directory
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### 2. Fresh authentication:
```bash
wrangler logout
wrangler login
wrangler whoami
```

### 3. Clean secrets:
```bash
wrangler secret list
# Delete any wrong secrets
wrangler secret delete "wrong-name"
```

### 4. Set secrets correctly:
```bash
wrangler secret put DATABASE_URL
wrangler secret put SUPABASE_URL  
wrangler secret put SUPABASE_ANON_KEY
wrangler secret put API_KEY
```

### 5. Build and deploy:
```bash
npx vite build --config vite.config.cloudflare.ts
wrangler deploy
```

---

## Quick Reference

### Most common solutions:
- **Dependency errors**: `npm install --legacy-peer-deps`
- **Authentication issues**: Use desktop Wrangler
- **Wrong secrets**: `wrangler secret delete` then `wrangler secret put`
- **Build failures**: Check filename spelling in build command
- **Fresh start**: `wrangler logout` → `wrangler login` → new account

### Files that matter:
- `wrangler.toml` - Cloudflare Workers configuration
- `vite.config.cloudflare.ts` - Build configuration  
- `package.json` - Dependencies (don't edit directly)

### URLs after deployment:
- Your app: `https://promo-code-manager.your-subdomain.workers.dev`
- Cloudflare Dashboard: `https://dash.cloudflare.com`
- Supabase Dashboard: `https://supabase.com/dashboard`

---

## When to Ask for Help

Contact support if you encounter:
- **Persistent authentication failures** after trying desktop login
- **Cloudflare account issues** (billing, permissions)
- **Supabase database access problems** (connection refused, authentication failed)
- **Deployment succeeds but app doesn't work** (check environment variables)

For code-related issues, the error logs in `wrangler tail` are very helpful for debugging.

---

## Success Indicators

You know everything is working when:
- ✅ `wrangler whoami` shows correct account
- ✅ `wrangler secret list` shows all 4 secrets
- ✅ Build completes without ERESOLVE errors
- ✅ `wrangler deploy` succeeds
- ✅ App loads at your `*.workers.dev` URL
- ✅ Can generate/view promo codes
- ✅ CSV export/import works

Remember: Most issues are dependency conflicts or authentication problems. The `--legacy-peer-deps` flag solves 90% of npm issues!