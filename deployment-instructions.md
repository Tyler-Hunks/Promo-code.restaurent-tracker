# Deployment Instructions: Cloudflare + Supabase

## Prerequisites
1. GitHub account
2. Cloudflare account
3. Supabase account

## Step 1: Set Up Supabase Database

### 1.1 Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose organization and enter project details
4. Wait for project to be created (2-3 minutes)

### 1.2 Set Up Database Schema
1. Go to SQL Editor in your Supabase dashboard
2. Copy and paste the contents of `supabase-setup.sql`
3. Click "Run" to execute the SQL
4. Verify tables are created in the Table Editor

### 1.3 Get Connection Details
From your Supabase project settings, note down:
- **Project URL**: `https://your-project-id.supabase.co`
- **Anon Key**: `eyJ...` (public anon key)
- **Database URL**: Go to Settings > Database > Connection string (URI format)

## Step 2: Prepare Your Code

### 2.1 Push to GitHub
```bash
# Initialize git if not already done
git init
git add .
git commit -m "Initial commit - migrating from Replit"

# Add your GitHub repository
git remote add origin https://github.com/yourusername/your-repo-name.git
git push -u origin main
```

### 2.2 Update Package.json (optional)
You can copy `package.cloudflare.json` to `package.json` for Cloudflare-specific builds.

## Step 3: Deploy to Cloudflare Pages

### 3.1 Connect GitHub Repository
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Pages**
3. Click **Create a project**
4. Select **Connect to Git**
5. Choose your GitHub repository
6. Click **Begin setup**

### 3.2 Configure Build Settings

**Recommended Settings (use these):**
- **Framework preset**: None
- **Build command**: `vite build --config vite.config.cloudflare.ts`
- **Build output directory**: `dist`
- **Root directory**: (leave empty)

**Alternative if above fails:**
- **Framework preset**: None
- **Build command**: `npm ci && vite build --config vite.config.cloudflare.ts`
- **Build output directory**: `dist`

**Important Notes:**
- Don't use `npm run build` - it includes server bundling we don't need
- Make sure Node.js compatibility is enabled for Functions (see environment variables section)

### 3.3 Set Environment Variables
In Cloudflare Pages settings, add these environment variables:

**Production Environment Variables:**
```
DATABASE_URL=your-supabase-connection-string
SUPABASE_URL=https://your-project-id.supabase.co  
SUPABASE_ANON_KEY=your-anon-key
API_KEY=your-secure-api-key
VITE_API_KEY=your-secure-api-key
VITE_API_BASE_URL=https://your-project-name.pages.dev
NODE_OPTIONS=--experimental-modules
```

### 3.4 Enable Node.js Compatibility
**CRITICAL**: In Cloudflare Pages → Settings → Functions:
- Enable **Node.js compatibility flag**
- This fixes the `node:events` and `node:stream` warnings

**Important Notes**: 
- Replace `your-project-name` with your actual Cloudflare Pages project name
- You'll get the exact URL after your first deployment
- For example: if your GitHub repo is `promo-codes`, the URL will be `https://promo-codes.pages.dev`

### 3.5 Deploy
1. Click **Save and Deploy**
2. Wait for build to complete (3-5 minutes)
3. If build fails, check the logs and ensure Node.js compatibility is enabled
4. Your site will be available at `https://your-project-name.pages.dev`

## Step 4: Test Your Deployment

### 4.1 Test Frontend
- Visit your Cloudflare Pages URL
- Verify the promo code interface loads

### 4.2 Test API
- Try generating promo codes
- Test CSV export/import
- Verify database operations work

## Step 5: Custom Domain (Optional)
1. In Cloudflare Pages, go to **Custom domains**
2. Add your domain
3. Update DNS records as instructed

## Troubleshooting

### Common Issues:
1. **Build Failures**: Check environment variables are set correctly
2. **API Errors**: Verify DATABASE_URL connection string format
3. **CORS Issues**: API routes should handle CORS automatically
4. **Function Timeout**: Large bulk operations might need optimization

### Database Connection String Format:
```
postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres
```

### Testing Locally:
```bash
# Install Wrangler CLI
npm install -g wrangler

# Run locally
npm run preview
```

## Environment Variables Summary
| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Supabase PostgreSQL connection string | `postgresql://postgres:...` |
| `SUPABASE_URL` | Your Supabase project URL | `https://abc123.supabase.co` |
| `SUPABASE_ANON_KEY` | Public anonymous key | `eyJ...` |
| `API_KEY` | Your API authentication key | `your-secure-key-here` |
| `VITE_API_KEY` | Frontend API key (same as API_KEY) | `your-secure-key-here` |
| `VITE_API_BASE_URL` | Your deployed site URL | `https://yoursite.pages.dev` |

## Data Migration
If you have existing data in your Replit database:
1. Export data as CSV from current system
2. Use the CSV import feature in the new deployment
3. Verify all codes transferred correctly