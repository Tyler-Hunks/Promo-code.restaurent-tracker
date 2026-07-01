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

-- ========================================
-- EMAIL CAMPAIGNS ("Campaigns" tab — triggers n8n cold-email workflows)
-- ========================================
-- These are SEPARATE from the promo-code "campaigns" (which live on
-- promo_codes.campaign_name). Required for the Campaigns tab to work.
-- A campaign points at ONE Google Sheet document (document_id) and an ARRAY of
-- tab gids (sheet_ids, at least 2). The older document_id_2 / campaign_info_gid
-- columns are gone.
CREATE TABLE IF NOT EXISTS email_campaigns (
    id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::VARCHAR,
    campaign_name TEXT NOT NULL,
    campaign_type TEXT,
    document_id TEXT NOT NULL,
    sheet_ids TEXT[] NOT NULL DEFAULT '{}',
    main_scripts TEXT[] NOT NULL DEFAULT '{}',
    follow_ups TEXT[] NOT NULL DEFAULT '{}',
    expiry_date DATE,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'launched')),
    last_launched_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_campaign_templates (
    id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::VARCHAR,
    name TEXT NOT NULL,
    campaign_type TEXT,
    document_id TEXT,
    sheet_ids TEXT[] NOT NULL DEFAULT '{}',
    default_main_scripts TEXT[] NOT NULL DEFAULT '{}',
    default_follow_ups TEXT[] NOT NULL DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Full launch history: one row per launch attempt (success OR failure), so the
-- Campaigns tab can show every launch and a per-campaign rollup.
CREATE TABLE IF NOT EXISTS email_campaign_launches (
    id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::VARCHAR,
    campaign_id VARCHAR NOT NULL,
    campaign_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
    detail TEXT,
    launched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Reconcile older versions of these tables (safe to run repeatedly).
-- 1) Add the new array column first.
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS sheet_ids TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE email_campaign_templates ADD COLUMN IF NOT EXISTS sheet_ids TEXT[] NOT NULL DEFAULT '{}';

-- 2) Preserve any old single gid (campaign_info_gid) by copying it into sheet_ids
--    BEFORE the obsolete columns are dropped, so existing data is never silently
--    destroyed. Uses dynamic SQL guarded by a column-exists check so it is safe
--    to run on both old and already-migrated databases. Only fills empty
--    sheet_ids (won't clobber rows you've already updated). Migrated campaigns
--    will have 1 gid and must have a 2nd added before they can launch again.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_campaigns' AND column_name = 'campaign_info_gid'
  ) THEN
    EXECUTE $sql$
      UPDATE email_campaigns
      SET sheet_ids = ARRAY[campaign_info_gid]
      WHERE COALESCE(cardinality(sheet_ids), 0) = 0
        AND campaign_info_gid IS NOT NULL
        AND campaign_info_gid <> ''
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_campaign_templates' AND column_name = 'campaign_info_gid'
  ) THEN
    EXECUTE $sql$
      UPDATE email_campaign_templates
      SET sheet_ids = ARRAY[campaign_info_gid]
      WHERE COALESCE(cardinality(sheet_ids), 0) = 0
        AND campaign_info_gid IS NOT NULL
        AND campaign_info_gid <> ''
    $sql$;
  END IF;
END $$;

-- 3) Now that any gid data is preserved, drop the obsolete columns.
ALTER TABLE email_campaigns DROP COLUMN IF EXISTS document_id_2;
ALTER TABLE email_campaigns DROP COLUMN IF EXISTS campaign_info_gid;
ALTER TABLE email_campaign_templates DROP COLUMN IF EXISTS document_id_2;
ALTER TABLE email_campaign_templates DROP COLUMN IF EXISTS campaign_info_gid;
ALTER TABLE email_campaign_templates ALTER COLUMN document_id DROP NOT NULL;

-- 4) A/B main-script variants: the single main_script / default_main_script
--    columns become arrays (main_scripts / default_main_scripts), where index 0
--    is Variant A and index 1 is Variant B. Same safe pattern as above:
--    add the new array column, backfill the old single value into it BEFORE
--    dropping the old column, and only fill empty arrays so re-runs are safe.
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS main_scripts TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE email_campaign_templates ADD COLUMN IF NOT EXISTS default_main_scripts TEXT[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_campaigns' AND column_name = 'main_script'
  ) THEN
    EXECUTE $sql$
      UPDATE email_campaigns
      SET main_scripts = ARRAY[main_script]
      WHERE COALESCE(cardinality(main_scripts), 0) = 0
        AND main_script IS NOT NULL
        AND main_script <> ''
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_campaign_templates' AND column_name = 'default_main_script'
  ) THEN
    EXECUTE $sql$
      UPDATE email_campaign_templates
      SET default_main_scripts = ARRAY[default_main_script]
      WHERE COALESCE(cardinality(default_main_scripts), 0) = 0
        AND default_main_script IS NOT NULL
        AND default_main_script <> ''
    $sql$;
  END IF;
END $$;

-- 5) Now that any script data is preserved, drop the obsolete single columns.
ALTER TABLE email_campaigns DROP COLUMN IF EXISTS main_script;
ALTER TABLE email_campaign_templates DROP COLUMN IF EXISTS default_main_script;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_campaigns_created_at ON email_campaigns(created_at);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_type ON email_campaigns(campaign_type);
CREATE INDEX IF NOT EXISTS idx_email_campaign_templates_name ON email_campaign_templates(name);
CREATE INDEX IF NOT EXISTS idx_email_campaign_launches_launched_at ON email_campaign_launches(launched_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_campaign_launches_campaign_id ON email_campaign_launches(campaign_id);

-- RLS: access is enforced in the app layer via Bearer tokens. Allow the anon
-- key (used by the Cloudflare Worker) to read/write, matching the other tables.
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaign_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaign_launches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations" ON email_campaigns;
DROP POLICY IF EXISTS "Allow all operations" ON email_campaign_templates;
DROP POLICY IF EXISTS "Allow all operations" ON email_campaign_launches;
CREATE POLICY "Allow all operations" ON email_campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON email_campaign_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON email_campaign_launches FOR ALL USING (true) WITH CHECK (true);

-- Tell Supabase's API layer (PostgREST) to reload its cached schema. Without
-- this, freshly added columns (e.g. default_main_scripts) can report
-- "Could not find the '<col>' column ... in the schema cache" from the deployed
-- Cloudflare Worker until the cache refreshes. Safe to run every time.
NOTIFY pgrst, 'reload schema';