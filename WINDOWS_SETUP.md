# Windows Deployment Setup Guide

This guide helps you deploy your promo code manager to Cloudflare Workers from a Windows machine.

## Prerequisites

1. **Node.js 18+** - Download from [nodejs.org](https://nodejs.org)
2. **Git** - Download from [git-scm.com](https://git-scm.com)
3. **Cloudflare Account** - Sign up at [cloudflare.com](https://cloudflare.com)

## Quick Setup (5 minutes)

### 1. Clone and Install
```bash
git clone your-repo-url
cd promo-code-manager
npm install
```

### 2. Set Environment Variables

Create a `.env` file in your project root:
```env
# Your secure API key
API_KEY=your-secure-api-key-here

# Supabase Configuration 
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
DATABASE_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres

# Cloudflare API Token (for deployment)
CLOUDFLARE_API_TOKEN=your-cloudflare-api-token-here
```

### 3. Configure Cloudflare Secrets

Set your environment variables in Cloudflare:
```bash
npx wrangler secret put API_KEY
npx wrangler secret put SUPABASE_URL  
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put DATABASE_URL
```

### 4. Deploy

**Option A: Use provided batch files (Windows)**
```cmd
build.bat
deploy.bat
```

**Option B: Manual commands**
```bash
npm run build:frontend
npm run build:worker
npx wrangler deploy --env production
```

## Advanced Configuration

### Custom Domain
1. Add your domain to Cloudflare
2. Update `wrangler.toml` with your domain:
```toml
[env.production]
route = { pattern = "yourdomain.com/*", zone_name = "yourdomain.com" }
```

### Multiple Environments
```bash
# Deploy to preview
npx wrangler deploy --env preview

# Deploy to production  
npx wrangler deploy --env production
```

## Troubleshooting

### "Command not found" errors
- Ensure Node.js is installed and in PATH
- Use `npx` prefix for all commands

### Build failures
- Delete `node_modules` and `dist` folders
- Run `npm install` again
- Check Node.js version (18+ required)

### Deployment errors
- Verify CLOUDFLARE_API_TOKEN is set
- Check wrangler.toml configuration
- Ensure all secrets are set in Cloudflare dashboard

## File Structure

```
├── client/                 # React frontend
├── server/                 # Backend API
├── dist/                   # Build output
│   ├── worker.js          # Cloudflare Worker
│   └── public/            # Static assets
├── build.bat              # Windows build script
├── deploy.bat             # Windows deploy script
├── wrangler.toml          # Cloudflare configuration
└── vite.config.production.ts  # Production Vite config
```

Your app will be available at:
- Production: `https://promo-code-manager-prod.your-account.workers.dev`
- Preview: `https://promo-code-manager-preview.your-account.workers.dev`