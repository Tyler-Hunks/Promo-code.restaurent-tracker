# Windows Deployment Instructions

## ✅ **Ready for Windows Deployment**

Your project is now configured for production deployment from Windows. Here's everything you need:

### 🛠️ **Requirements**
- Node.js 18+ ([Download](https://nodejs.org))
- Git ([Download](https://git-scm.com))
- Cloudflare account

### 📦 **Files Created for Windows**
- `build.bat` - Windows build script
- `deploy.bat` - Windows deployment script  
- `vite.config.production.ts` - Production Vite config
- `wrangler.toml` - Updated Cloudflare config
- `WINDOWS_SETUP.md` - Complete setup guide

### 🚀 **Quick Deploy Commands (Windows)**

```cmd
# Method 1: Use batch files (recommended)
build.bat
deploy.bat

# Method 2: Manual commands
npx vite build --config vite.config.production.ts
npx esbuild server/worker.ts --platform=browser --format=esm --bundle --outfile=dist/worker.js --external:node:* --define:process.env.NODE_ENV="production" --minify
npx wrangler deploy --env production
```

### 🔐 **Environment Setup**

1. **Get Cloudflare API Token:**
   - Go to https://dash.cloudflare.com/profile/api-tokens
   - Click "Create Token" 
   - Use "Edit Cloudflare Workers" template

2. **Set Environment Variable (Windows):**
```cmd
set CLOUDFLARE_API_TOKEN=your-token-here
```

3. **Set Cloudflare Secrets:**
```cmd
npx wrangler secret put API_KEY
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY  
npx wrangler secret put DATABASE_URL
```

### 📁 **What Gets Built**
- `dist/worker.js` - Cloudflare Worker (Minified)
- `dist/public/` - React app static files
- Ready for production deployment

### 🌐 **After Deployment**
Your app will be available at:
- `https://promo-code-manager-prod.your-account.workers.dev`

### 🔧 **Key Changes Made**
1. **Removed Replit dependencies** - No more @replit plugins
2. **Windows-compatible build commands** - Uses cross-env for environment variables
3. **Production-optimized** - Minified worker and optimized frontend build
4. **Multiple environment support** - Production, preview, and development configs

### 📞 **Need Help?**
All build tools work the same on Windows as they do in Replit. The build outputs are identical and production-ready!