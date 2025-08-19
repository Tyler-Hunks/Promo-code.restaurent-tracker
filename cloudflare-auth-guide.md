# Cloudflare Authentication in Replit

## The Problem
`wrangler login` fails in Replit because it tries to open a browser for OAuth, but Replit's environment doesn't support this.

## Solution 1: API Token (Recommended)

### Step 1: Get Cloudflare API Token
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use "Custom token" template
4. Set permissions:
   - Zone: Zone Settings:Read, Zone:Read
   - Account: Cloudflare Workers:Edit
   - Zone Resources: Include All zones
5. Copy the generated token

### Step 2: Set Token in Replit
```bash
# Set the token as environment variable
export CLOUDFLARE_API_TOKEN="your-token-here"

# Or set it in wrangler config
wrangler config set api_token "your-token-here"
```

## Solution 2: Use Cloudflare Dashboard
Instead of CLI deployment, you can:
1. Zip your project files
2. Upload directly to Cloudflare Workers dashboard
3. Set environment variables through the web interface

## Solution 3: GitHub Integration
1. Push your code to GitHub
2. Connect GitHub to Cloudflare Workers
3. Enable automatic deployments

## Quick Test
```bash
# Check if authentication works
wrangler whoami
```

## Next Steps After Authentication
```bash
# Set environment variables
wrangler secret put DATABASE_URL
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_ANON_KEY
wrangler secret put API_KEY

# Deploy
wrangler deploy
```