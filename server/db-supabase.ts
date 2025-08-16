import { createClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

// Supabase connection - you'll need to set these environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const databaseUrl = process.env.DATABASE_URL;

if (!supabaseUrl || !supabaseKey || !databaseUrl) {
  throw new Error(
    "Missing required environment variables: SUPABASE_URL, SUPABASE_ANON_KEY, DATABASE_URL"
  );
}

// Create Supabase client for auth and real-time features (if needed later)
export const supabase = createClient(supabaseUrl, supabaseKey);

// Create database connection using postgres-js for Drizzle
const client = postgres(databaseUrl);
export const db = drizzle(client, { schema });