-- IMPORTANT: Run this COMPLETE SQL script in your Supabase SQL Editor to set up the database schema
-- This creates all required tables including api_tokens (required for API token management)
-- It's safe to run this multiple times - all tables use "IF NOT EXISTS"

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::VARCHAR,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
);

-- Create promo_codes table
CREATE TABLE IF NOT EXISTS promo_codes (
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
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_status ON promo_codes(status);
CREATE INDEX IF NOT EXISTS idx_promo_codes_campaign ON promo_codes(campaign_name);
CREATE INDEX IF NOT EXISTS idx_promo_codes_created_at ON promo_codes(created_at);

-- Enable Row Level Security (RLS) - optional but recommended
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your authentication needs)
-- For now, allow all operations with valid API key (handled in application layer)
-- DROP first so this script is safe to re-run on a database where the tables
-- already exist (e.g. created via the Supabase dashboard, which turns on RLS
-- with NO policy and silently blocks all writes via the anon key).
DROP POLICY IF EXISTS "Allow all operations" ON users;
DROP POLICY IF EXISTS "Allow all operations" ON promo_codes;
CREATE POLICY "Allow all operations" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON promo_codes FOR ALL USING (true) WITH CHECK (true);

-- ========================================
-- CRITICAL: API TOKENS TABLE (Required for Token Management)
-- ========================================
-- This table is REQUIRED for the TokenManager feature to work
-- If missing, you'll get "Could not find table 'public.api_tokens'" error
CREATE TABLE IF NOT EXISTS api_tokens (
    id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::VARCHAR,
    name TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE
);

-- Index for token lookups
CREATE INDEX IF NOT EXISTS idx_api_tokens_token ON api_tokens(token);

-- RLS for API tokens
ALTER TABLE api_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations" ON api_tokens;
CREATE POLICY "Allow all operations" ON api_tokens FOR ALL USING (true) WITH CHECK (true);

-- Optional: RPC function for campaign stats (backup method)
CREATE OR REPLACE FUNCTION get_campaign_stats()
RETURNS TABLE (
    campaign_name TEXT,
    total INTEGER,
    available INTEGER,
    used INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pc.campaign_name,
        COUNT(*)::INTEGER as total,
        COUNT(CASE WHEN pc.status = 'unused' THEN 1 END)::INTEGER as available,
        COUNT(CASE WHEN pc.status = 'used' THEN 1 END)::INTEGER as used
    FROM promo_codes pc 
    WHERE pc.campaign_name IS NOT NULL
    GROUP BY pc.campaign_name
    ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- SETUP VERIFICATION
-- ========================================
-- Run this query to verify all tables were created successfully:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
-- Expected tables: api_tokens, promo_codes, users

-- Optional: RPC function for promo code stats (backup method)
CREATE OR REPLACE FUNCTION get_promo_stats()
RETURNS TABLE (
    total INTEGER,
    used INTEGER,
    expired INTEGER,
    available INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total,
        COUNT(CASE WHEN status = 'used' THEN 1 END)::INTEGER as used,
        COUNT(CASE WHEN status = 'expired' THEN 1 END)::INTEGER as expired,
        COUNT(CASE WHEN status = 'unused' THEN 1 END)::INTEGER as available
    FROM promo_codes;
END;
$$ LANGUAGE plpgsql;