# Cloudflare Authentication in Replit

## The Problem
`wrangler login` fails in Replit because it tries to open a browser for OAuth, but Replit's environment doesn't support this.

## Solution 1: API Token (Recommended)

### Step 1: Get Cloudflare API Token
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use "Custom token" template
4. Set **Account Permissions**:
   - **Workers Scripts: Edit**
   - **Account Settings: Read**
5. Set **Account Resources**: Include All accounts
6. (Optional) Set **Zone Permissions**: 
   - **Workers Routes: Edit** (only if using custom domains)
7. Copy the generated token

### Step 2: Set Token in Replit
```bash
# Set the token as environment variable
export CLOUDFLARE_API_TOKEN="your-token-here"

# Or set it in wrangler config
wrangler config set api_token "your-token-here"
```

## Solution 2: Use Pre-built Template (Easiest)
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use "Edit Cloudflare Workers" template
4. This automatically includes all necessary permissions
5. Copy the generated token

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