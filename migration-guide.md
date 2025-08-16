# Migration Guide: Replit → Cloudflare + Supabase

## Overview
Migrating your promo code management system from Replit to Cloudflare Pages with Supabase database.

## Architecture Changes
- **Frontend**: React app → Cloudflare Pages (static hosting)
- **Backend**: Express.js → Cloudflare Pages Functions (serverless)
- **Database**: Neon PostgreSQL → Supabase PostgreSQL
- **Deployment**: Replit → GitHub + Cloudflare Pages

## Step 1: Supabase Database Setup

### 1.1 Create Supabase Project
1. Go to https://supabase.com and create account
2. Create new project
3. Note down your project URL and anon key

### 1.2 Database Schema Migration
Run these SQL commands in Supabase SQL Editor:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE users (
    id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::VARCHAR,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
);

-- Create promo_codes table
CREATE TABLE promo_codes (
    id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::VARCHAR,
    code TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'unused' CHECK (status IN ('unused', 'used', 'expired')),
    campaign_name TEXT,
    discount_value TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    used_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better performance
CREATE INDEX idx_promo_codes_code ON promo_codes(code);
CREATE INDEX idx_promo_codes_status ON promo_codes(status);
CREATE INDEX idx_promo_codes_campaign ON promo_codes(campaign_name);
```

## Step 2: Code Modifications for Supabase

### 2.1 Database Connection
- Replace Neon driver with Supabase
- Update connection string
- Modify Drizzle configuration

### 2.2 Frontend Deployment Prep
- Build configuration for Cloudflare Pages
- Environment variable setup
- API endpoint configuration

### 2.3 Backend Serverless Adaptation
- Convert Express routes to Cloudflare Functions
- Handle CORS for cross-origin requests
- Environment variable management

## Step 3: Cloudflare Pages Setup

### 3.1 GitHub Repository
- Push code to GitHub
- Set up proper folder structure

### 3.2 Cloudflare Configuration
- Connect GitHub repo to Cloudflare Pages
- Configure build settings
- Set environment variables

## Step 4: Testing & Deployment

### 4.1 Local Testing
- Test with Supabase connection locally
- Verify all functionality works

### 4.2 Production Deployment
- Deploy to Cloudflare Pages
- Test live application
- Monitor for issues

## Environment Variables Needed
- `DATABASE_URL` (Supabase connection string)
- `SUPABASE_URL` (your project URL)
- `SUPABASE_ANON_KEY` (public anon key)
- `API_KEY` (for API authentication)