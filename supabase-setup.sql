-- Run this SQL in your Supabase SQL Editor to set up the database schema

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
CREATE POLICY "Allow all operations" ON users FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON promo_codes FOR ALL USING (true);

-- Create API tokens table for permanent token management
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
CREATE POLICY "Allow all operations" ON api_tokens FOR ALL USING (true);

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