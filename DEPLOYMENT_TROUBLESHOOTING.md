# Deployment & Troubleshooting Guide

## 🚀 Quick Deployment

### Build Commands
```bash
# Frontend + Worker build
npx vite build && npm run build:worker

# Deploy to Cloudflare Workers
npx vite build && npm run build:worker && wrangler deploy --env=""
```

## 🔧 Common Issues & Solutions

### 1. Build Errors

#### Issue: `'vite' is not recognized as an internal or external command`
**Symptoms:**
- Build fails with vite command not found
- `npm run build` returns command not recognized error

**Solution:**
```bash
# Use npx instead of direct vite command
npx vite build && npm run build:worker
```

**Root Cause:** The `vite` executable isn't in your system PATH, but `npx` finds it in `node_modules/.bin/`

#### Issue: `Cannot find package 'vite' imported from vite.config.ts`
**Symptoms:**
- Module resolution errors during build
- TypeScript errors about missing vite package

**Solution:**
```bash
# Ensure dependencies are installed
npm install
# Then run build
npx vite build && npm run build:worker
```

**Root Cause:** Dependencies not installed locally (common when copying project to new environment)

### 2. Deployment Errors

#### Issue: `The entry-point file at "dist\worker.js" was not found`
**Symptoms:**
- Wrangler deploy fails looking for worker.js
- Missing dist/worker.js file

**Solution:**
```bash
# Make sure both builds complete successfully
npx vite build        # Creates dist/public/ 
npm run build:worker  # Creates dist/worker.js

# Verify files exist
ls -la dist/
# Should show: worker.js, public/ directory
```

**Root Cause:** Worker build step didn't complete due to frontend build failure

#### Issue: `Multiple environments defined, no target specified`
**Symptoms:**
- Wrangler warning about environments
- Unclear which environment to deploy to

**Solution:**
```bash
# Deploy to default environment
wrangler deploy --env=""

# Or deploy to specific environment
wrangler deploy --env="production"
```

### 3. Authentication Issues

#### Issue: Dashboard loads but shows no data + 401 errors in console
**Symptoms:**
```
GET /api/promo-codes 401 :: {"message":"Unauthorized: Invalid token"}
GET /api/campaigns/stats 401 :: {"message":"Unauthorized: Invalid token"}
```

**Solution:**
1. **Sign out** from the application (top-right button)
2. **Sign back in** with the API key: `promo-api-2024-secure-key`
3. All data should load properly

**Root Cause:** Expired or invalid authentication tokens in browser storage

#### Issue: API Token Creation Fails

**Symptoms:**
- Error: "Cannot read properties of null (reading: id)"
- Error: "Could not find table 'public.api_tokens' in the schema cache"
- TokenManager shows creation failed

**Root Cause:**
The `api_tokens` table is missing from your Supabase database

**Solution:**
1. **Open Supabase Dashboard** → Navigate to SQL Editor
2. **Run the complete setup script** from `supabase-setup.sql`
3. **Verify table creation**: Run this query in SQL Editor:
   ```sql
   SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
   ```
   Expected tables: `api_tokens`, `promo_codes`, `users`
4. **Redeploy** your Cloudflare Worker after table creation

#### Issue: Stats appear capped at 1000 / Campaign stats not showing
**Symptoms:**
- Stats dashboard shows limited data
- Campaign statistics missing or incomplete

**Solution:**
This is typically an authentication issue (see above). After proper login:
- Stats will show real numbers (e.g., 10,011+ codes)
- Campaign stats will populate correctly
- All API endpoints will return full data

### 4. Development Environment

#### Issue: Local development not working after copying from Replit
**Setup Steps:**
```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev

# 3. Access at http://localhost:5000
```

#### Issue: Database connection errors
**Symptoms:**
- API calls fail with database errors
- Cannot connect to PostgreSQL

**Solution:**
- Ensure environment variables are set:
  - `DATABASE_URL`
  - `API_KEY=promo-api-2024-secure-key`
- Check database is accessible and running

## 📁 Build Output Structure

After successful build, your `dist/` folder should contain:
```
dist/
├── worker.js          # Cloudflare Worker entry point (500KB+)
└── public/           # Frontend static files
    ├── index.html    # Main HTML file
    └── assets/       # CSS/JS bundles
        ├── index-[hash].css
        └── index-[hash].js
```

## 🌐 Environment Setup

### Local Development
- Uses Express server + Vite dev server
- Database: Local PostgreSQL or Neon/Supabase
- Authentication: Same API key system

### Production (Cloudflare Workers)
- Uses worker.js as entry point
- Static files served from dist/public/
- Database: Supabase PostgreSQL
- Environment variables set in Cloudflare Dashboard

## ✅ Verification Steps

After deployment, verify everything works:

1. **Authentication:**
   - Login page loads without API key display
   - Can sign in with API key
   - No 401 errors in browser console

2. **Dashboard:**
   - Stats show real numbers (not capped at 1000)
   - Campaign stats populate with existing campaigns
   - Promo codes list loads properly

3. **Functionality:**
   - Can generate new promo codes
   - Can create campaigns
   - Search and filtering work
   - CSV export/import functions

## 🚨 Quick Fixes

**Build failing?**
```bash
rm -rf node_modules package-lock.json
npm install
npx vite build && npm run build:worker
```

**Deployment failing?**
```bash
# Check files exist
ls -la dist/worker.js dist/public/index.html
# Redeploy
wrangler deploy --env=""
```

**Dashboard empty after deployment?**
1. Sign out
2. Sign in with: `promo-api-2024-secure-key`  
3. Check browser console for remaining errors

---

## 📞 Support

If issues persist:
1. Check browser console for error messages
2. Verify all environment variables are set
3. Ensure database is accessible
4. Check Cloudflare Workers logs for runtime errors