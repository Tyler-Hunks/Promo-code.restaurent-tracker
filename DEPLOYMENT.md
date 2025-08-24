# Comprehensive Deployment Guide: Cloudflare Workers + Supabase

## Project Overview
This is a full-stack promo code management system built with:
- **Frontend**: React + TypeScript with Vite
- **Backend**: Express.js API running on Cloudflare Workers
- **Database**: Supabase PostgreSQL
- **Deployment**: Cloudflare Workers via GitHub integration

## Prerequisites
1. **GitHub account** - for code hosting and CI/CD
2. **Cloudflare account** - for Workers hosting
3. **Supabase account** - for PostgreSQL database
4. **Node.js 18+** - for local development

## Part 1: Database Setup (Supabase)

### 1.1 Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Choose organization and enter project details:
   - **Name**: `promo-code-manager`
   - **Database Password**: Choose a secure password
   - **Region**: Select closest to your users
4. Wait for project creation (2-3 minutes)

### 1.2 Set Up Database Schema
1. Go to **SQL Editor** in your Supabase dashboard
2. Copy and paste the contents of `supabase-setup.sql` from your project
3. Click **RUN** to execute the SQL commands
4. Verify tables are created in the **Table Editor**:
   - `users` table for authentication
   - `promo_codes` table for code management

### 1.3 Get Database Connection Details
From your Supabase project settings, collect these values:

**Project Settings → API:**
- **Project URL**: `https://your-project-id.supabase.co`
- **Anon Key**: `eyJ...` (public anonymous key)

**Project Settings → Database → Connection string:**
- **Connection string**: `postgresql://postgres:[YOUR-PASSWORD]@db.your-project-id.supabase.co:5432/postgres`
- Replace `[YOUR-PASSWORD]` with your database password

## Part 2: Code Repository Setup

### 2.1 Initialize Git Repository (if not done)
```bash
# Initialize git repository
git init

# Add all project files
git add .

# Create initial commit
git commit -m "Initial commit: Promo Code Management System"
```

### 2.2 Create GitHub Repository
1. Go to [github.com](https://github.com) and create new repository
2. Name it `promo-code-manager` (or your preferred name)
3. Keep it public or private as desired
4. **Don't** initialize with README (you already have files)

### 2.3 Connect Local Repository to GitHub
```bash
# Add GitHub remote (replace with your username/repo)
git remote add origin https://github.com/YOUR_USERNAME/promo-code-manager.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Part 3: Cloudflare Workers Deployment

### Option A: Deploy via GitHub Integration (Recommended)

This method avoids Wrangler CLI authentication issues and provides automatic deployments.

#### 3.1 Connect GitHub to Cloudflare
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages**
3. Click **Create application**
4. Select **Connect to Git**
5. Authorize GitHub access if prompted
6. Choose your `promo-code-manager` repository
7. Click **Begin setup**

#### 3.2 Configure Build Settings
**Framework preset**: None
**Build command**: 
```bash
npm install && npx vite build --config vite.config.cloudflare.ts
```
**Root directory**: (leave empty)

#### 3.3 Set Environment Variables
In Cloudflare Dashboard → Your App → Settings → Variables, add these **Environment variables**:

```
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.your-project-id.supabase.co:5432/postgres
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-from-supabase
API_KEY=your-secure-api-key-here
```

**Important Notes:**
- Replace all placeholder values with your actual Supabase credentials
- `API_KEY` should be a secure random string (minimum 32 characters)
- Keep these values secure - they provide access to your database

#### 3.4 Deploy
1. Click **Save and Deploy**
2. Wait for build completion (3-5 minutes)
3. Your app will be available at: `https://promo-code-manager.your-subdomain.workers.dev`

### Option B: Deploy via Wrangler CLI (Desktop Only)

Since you mentioned you're trying Wrangler login on desktop, here's the process:

#### 3.1 Install Wrangler (on your desktop)
```bash
npm install -g wrangler
```

#### 3.2 Authenticate with Cloudflare
```bash
# Login to Cloudflare (opens browser for OAuth)
wrangler login

# Verify authentication
wrangler whoami
```

#### 3.3 Build Frontend
```bash
# Build the React frontend for production
npx vite build --config vite.config.cloudflare.ts
```

#### 3.4 Set Environment Secrets
```bash
# Set each environment variable securely
wrangler secret put DATABASE_URL
# Enter: postgresql://postgres:[YOUR-PASSWORD]@db.your-project-id.supabase.co:5432/postgres

wrangler secret put SUPABASE_URL  
# Enter: https://your-project-id.supabase.co

wrangler secret put SUPABASE_ANON_KEY
# Enter: your-anon-key-from-supabase

wrangler secret put API_KEY
# Enter: your-secure-api-key-here
```

#### 3.5 Deploy to Workers
```bash
# Deploy the application
wrangler deploy
```

## Part 4: Testing Your Deployment

### 4.1 Frontend Testing
1. Visit your Cloudflare Workers URL
2. Verify the promo code management interface loads correctly
3. Check that all UI components render properly

### 4.2 API Testing
Test these core features:
- **Code Generation**: Try generating single and bulk promo codes
- **Code Management**: View, search, and filter codes
- **Status Updates**: Toggle code status between used/unused
- **CSV Operations**: Export codes to CSV and import from CSV
- **Database Persistence**: Verify codes are saved and retrievable

### 4.3 Performance Testing
With your current 10,011 codes:
- **Pagination**: Verify pagination loads quickly (should be <3 seconds)
- **Search**: Test search functionality across large dataset
- **Bulk Operations**: Test CSV export with all codes
- **Memory Usage**: Monitor for any memory issues

## Part 5: Ongoing Management

### 5.1 Code Updates
For future updates:
1. Make changes locally
2. Commit and push to GitHub: `git push origin main`
3. **GitHub Integration**: Automatic deployment triggers
4. **Wrangler CLI**: Run `wrangler deploy` manually

### 5.2 Environment Variables
To update environment variables:
- **Cloudflare Dashboard**: Go to Workers → Your App → Settings → Variables
- **Wrangler CLI**: `wrangler secret put VARIABLE_NAME`

### 5.3 Monitoring
Monitor your application:
- **Cloudflare Dashboard**: Analytics and logs
- **Wrangler CLI**: `wrangler tail` for real-time logs

## Part 6: Custom Domain (Optional)

### 6.1 Add Custom Domain
1. In Cloudflare Dashboard → Workers → Your App → Settings
2. Click **Custom Domains**
3. Add your domain name
4. Follow DNS configuration instructions

### 6.2 DNS Configuration
If your domain is managed by Cloudflare:
- DNS records are configured automatically
- If external DNS: Add CNAME record pointing to your Workers URL

## Troubleshooting

### Common Issues

**Build Failures**
- Check environment variables are set correctly
- Verify `package.json` dependencies
- Ensure Node.js compatibility settings

**Database Connection Errors**
- Verify DATABASE_URL format is correct
- Check Supabase project is active
- Confirm database password is correct

**API Authentication Issues**
- Verify API_KEY is set and matches frontend expectations
- Check CORS settings if accessing from different domains

**Performance Issues**
- Large datasets (10,000+ codes) should use pagination
- Consider database indexing for better query performance
- Monitor Cloudflare Workers usage limits

### Support Resources
- **Cloudflare Workers**: [docs.cloudflare.com/workers](https://docs.cloudflare.com/workers)
- **Supabase**: [supabase.com/docs](https://supabase.com/docs)  
- **Wrangler CLI**: [developers.cloudflare.com/workers/wrangler](https://developers.cloudflare.com/workers/wrangler)

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Supabase PostgreSQL connection string | `postgresql://postgres:password@db.abc123.supabase.co:5432/postgres` |
| `SUPABASE_URL` | Your Supabase project URL | `https://abc123.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase public anonymous key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `API_KEY` | Secure API authentication key | `your-secure-32+-character-key-here` |

## Project Architecture Summary

```
Promo Code Management System
├── Frontend (React + TypeScript)
│   ├── Code generation and management UI
│   ├── Pagination for large datasets  
│   ├── CSV import/export functionality
│   └── Real-time statistics dashboard
├── Backend (Express.js on Cloudflare Workers)
│   ├── REST API endpoints
│   ├── Authentication middleware
│   ├── Database operations via Drizzle ORM
│   └── Performance optimizations
└── Database (Supabase PostgreSQL)
    ├── User management
    ├── Promo code storage with indexing
    └── Campaign and analytics data
```

This deployment setup provides:
- ✅ **Scalable hosting** on Cloudflare's global network
- ✅ **Reliable database** with Supabase PostgreSQL
- ✅ **Automatic deployments** via GitHub integration
- ✅ **Performance optimization** with pagination and indexing
- ✅ **Comprehensive management** of 10,000+ promo codes

Your application is now ready for production use with professional-grade hosting and database infrastructure.