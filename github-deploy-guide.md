# Deploy via GitHub Integration (Easiest for Replit)

## Why This Method is Better
- No complex authentication in Replit
- Automatic deployments on code changes
- Easy environment variable management through web UI
- No need for wrangler CLI issues

## Step-by-Step Process

### 1. Push Your Code to GitHub
```bash
# Add all files
git add .

# Commit changes
git commit -m "Ready for Cloudflare Workers deployment"

# Push to GitHub (you'll need to create the repo first)
git push origin main
```

### 2. Create GitHub Repository
1. Go to https://github.com
2. Create new repository named "promo-code-manager"
3. Copy the git remote URL

### 3. Connect to GitHub (if not already done)
```bash
git remote add origin https://github.com/YOUR_USERNAME/promo-code-manager.git
git branch -M main
git push -u origin main
```

### 4. Deploy via Cloudflare Dashboard
1. Go to https://dash.cloudflare.com
2. Go to **Workers & Pages**
3. Click **Create application**
4. Select **Connect to Git**
5. Choose your GitHub repository
6. Select **Workers** (not Pages)

### 5. Configure Build Settings
- **Framework preset**: None
- **Build command**: `vite build --config vite.config.cloudflare.ts`
- **Root directory**: (leave empty)

### 6. Set Environment Variables
In Cloudflare Dashboard → Workers → Your app → Settings → Variables:
```
DATABASE_URL = your-supabase-connection-string
SUPABASE_URL = https://your-project-id.supabase.co
SUPABASE_ANON_KEY = your-anon-key
API_KEY = your-secure-api-key
```

### 7. Deploy
Click **Save and Deploy**

## Benefits
- ✅ No authentication issues in Replit
- ✅ Automatic deployments when you push code
- ✅ Easy environment variable management
- ✅ Professional CI/CD pipeline
- ✅ Preview deployments for testing

## Your URL
After deployment: `https://promo-code-manager.YOUR_SUBDOMAIN.workers.dev`