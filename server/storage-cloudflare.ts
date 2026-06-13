import { type User, type InsertUser, type PromoCode, type InsertPromoCode, type ApiToken, type ApiTokenGenerate } from "@shared/schema";
import { createClient } from '@supabase/supabase-js';
import type { IStorage, PaginationOptions, PaginatedResult } from "./storage";

// Cloudflare-compatible database storage
export class CloudflareStorage implements IStorage {
  private supabase: any;

  constructor(env: any) {
    // Initialize Supabase client for Cloudflare Workers
    this.supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  // Helper to map database snake_case to frontend camelCase
  private mapPromoCodeFromDb(dbRecord: any): PromoCode {
    if (!dbRecord) return dbRecord;
    return {
      id: dbRecord.id,
      code: dbRecord.code,
      status: dbRecord.status,
      campaignName: dbRecord.campaign_name,
      discountValue: dbRecord.discount_value,
      expiresAt: dbRecord.expires_at ? new Date(dbRecord.expires_at) : null,
      createdAt: new Date(dbRecord.created_at),
      usedAt: dbRecord.used_at ? new Date(dbRecord.used_at) : null,
    };
  }

  async getUser(id: string): Promise<User | undefined> {
    const { data: user } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const { data: user } = await this.supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const { data: user } = await this.supabase
      .from('users')
      .insert(insertUser)
      .select()
      .single();
    return user;
  }

  async getAllPromoCodes(): Promise<PromoCode[]> {
    const { data: codes } = await this.supabase
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false });
    return (codes || []).map((code: any) => this.mapPromoCodeFromDb(code));
  }

  async getPaginatedPromoCodes(options: PaginationOptions): Promise<PaginatedResult<PromoCode>> {
    let query = this.supabase
      .from('promo_codes')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (options.search) {
      query = query.or(`code.ilike.%${options.search}%,campaign_name.ilike.%${options.search}%`);
    }
    if (options.campaign) {
      query = query.eq('campaign_name', options.campaign);
    }
    if (options.status) {
      query = query.eq('status', options.status);
    }
    if (options.discount) {
      query = query.ilike('discount_value', `%${options.discount}%`);
    }

    const offset = (options.page - 1) * options.limit;
    const { data, count } = await query.range(offset, offset + options.limit - 1);

    return {
      data: (data || []).map((code: any) => this.mapPromoCodeFromDb(code)),
      total: count || 0,
      page: options.page,
      limit: options.limit,
      totalPages: Math.ceil((count || 0) / options.limit)
    };
  }

  async getPromoCodeByCode(code: string): Promise<PromoCode | undefined> {
    const { data: promoCode } = await this.supabase
      .from('promo_codes')
      .select('*')
      .eq('code', code)
      .single();
    return promoCode ? this.mapPromoCodeFromDb(promoCode) : undefined;
  }

  async createPromoCode(promoCode: InsertPromoCode): Promise<PromoCode> {
    const { data: created } = await this.supabase
      .from('promo_codes')
      .insert({
        code: promoCode.code,
        campaign_name: promoCode.campaignName,
        discount_value: promoCode.discountValue,
        expires_at: promoCode.expiresAt,
        status: 'unused'
      })
      .select()
      .single();
    
    // Convert snake_case to camelCase for frontend compatibility
    return this.mapPromoCodeFromDb(created);
  }

  async createBulkPromoCodes(promoCodeArray: InsertPromoCode[]): Promise<PromoCode[]> {
    const insertData = promoCodeArray.map(code => ({
      code: code.code,
      campaign_name: code.campaignName,
      discount_value: code.discountValue,
      expires_at: code.expiresAt,
      status: 'unused'
    }));
    
    const { data: created } = await this.supabase
      .from('promo_codes')
      .insert(insertData)
      .select();
    return (created || []).map((code: any) => this.mapPromoCodeFromDb(code));
  }

  async markPromoCodeAsUsed(code: string): Promise<PromoCode | undefined> {
    const { data: updated } = await this.supabase
      .from('promo_codes')
      .update({ 
        status: 'used', 
        used_at: new Date().toISOString() 
      })
      .eq('code', code)
      .select()
      .single();
    return updated ? this.mapPromoCodeFromDb(updated) : undefined;
  }

  async togglePromoCodeStatus(code: string, newStatus: "unused" | "used"): Promise<PromoCode | undefined> {
    const { data: updated } = await this.supabase
      .from('promo_codes')
      .update({ 
        status: newStatus,
        used_at: newStatus === 'used' ? new Date().toISOString() : null
      })
      .eq('code', code)
      .select()
      .single();
    return updated ? this.mapPromoCodeFromDb(updated) : undefined;
  }

  async deletePromoCode(code: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('promo_codes')
      .delete()
      .eq('code', code);
    return !error;
  }

  async deleteBulkPromoCodes(codes: string[]): Promise<number> {
    const { data: deletedCodes } = await this.supabase
      .from('promo_codes')
      .delete()
      .in('code', codes)
      .select('id');
    return deletedCodes?.length || 0;
  }

  async deleteAllPromoCodes(): Promise<number> {
    const { data: deletedCodes } = await this.supabase
      .from('promo_codes')
      .delete()
      .neq('id', 'non-existent-id')
      .select('id');
    return deletedCodes?.length || 0;
  }

  async deleteBulkByFilters(filters: { campaign?: string; status?: string; discountValue?: string }): Promise<number> {
    // Filters are already validated and sanitized by Zod schema
    let query = this.supabase
      .from('promo_codes')
      .delete();
    
    if (filters.campaign) {
      query = query.eq('campaign_name', filters.campaign);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.discountValue) {
      query = query.eq('discount_value', filters.discountValue);
    }
    
    const { data: deletedCodes, error } = await query.select('id');
    
    if (error) {
      console.error('Delete by filters error:', error);
      throw new Error(`Failed to delete codes: ${error.message}`);
    }
    
    return deletedCodes?.length || 0;
  }

  async getPromoCodeStats(): Promise<{ total: number; used: number; available: number; expired: number }> {
    // Update expired codes first
    await this.supabase
      .from('promo_codes')
      .update({ status: 'expired' })
      .lt('expires_at', new Date().toISOString())
      .eq('status', 'unused');

    // Use SQL aggregation for accurate stats - no row limits needed
    const { data: stats } = await this.supabase
      .rpc('get_promo_stats');
    
    if (stats && stats.length > 0) {
      return stats[0];
    }

    // Fallback: Use manual SQL-like aggregation via Supabase
    const { count: total } = await this.supabase
      .from('promo_codes')
      .select('*', { count: 'exact', head: true });
    
    const { count: used } = await this.supabase
      .from('promo_codes')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'used');
      
    const { count: expired } = await this.supabase
      .from('promo_codes')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'expired');
      
    const { count: available } = await this.supabase
      .from('promo_codes')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'unused');

    return { 
      total: total || 0, 
      used: used || 0, 
      available: available || 0, 
      expired: expired || 0 
    };
  }

  async getCampaigns(): Promise<string[]> {
    console.log('getCampaigns: Starting query...');
    
    // Preferred path: use the get_campaign_stats RPC. This avoids Supabase's
    // default row limit so all unique campaigns are returned even with large
    // datasets (10,000+ codes).
    const { data: campaignStats, error } = await this.supabase
      .rpc('get_campaign_stats');
    
    if (!error && campaignStats) {
      const result = campaignStats
        .map((stat: any) => stat.campaign_name)
        .filter((name: string) => name && name.trim() !== '');
      console.log('getCampaigns: Campaign names from RPC:', result);
      return result;
    }
    
    // The RPC may be missing (e.g. a freshly provisioned database where
    // supabase-setup.sql has not been run yet). Fall back to a direct query
    // instead of failing the request so the UI keeps working.
    console.warn('getCampaigns: RPC unavailable, falling back to direct query:', error);
    const { data: campaigns, error: selectError } = await this.supabase
      .from('promo_codes')
      .select('campaign_name')
      .not('campaign_name', 'is', null)
      .neq('campaign_name', '');
    
    if (selectError) {
      // Don't crash the dropdown — return an empty list and log the cause.
      console.error('getCampaigns: Fallback query failed:', selectError);
      return [];
    }
    
    const uniqueNames = new Set(campaigns?.map((c: any) => c.campaign_name) || []);
    const result = Array.from(uniqueNames).filter(Boolean) as string[];
    console.log('getCampaigns: Campaign names from fallback:', result);
    return result;
  }

  async getCampaignStats(): Promise<Array<{ campaignName: string; available: number; used: number; total: number }>> {
    // Update expired codes first
    await this.supabase
      .from('promo_codes')
      .update({ status: 'expired' })
      .lt('expires_at', new Date().toISOString())
      .eq('status', 'unused');

    // Use SQL aggregation for campaign stats
    const { data: campaignStats } = await this.supabase
      .rpc('get_campaign_stats');
    
    if (campaignStats && campaignStats.length > 0) {
      return campaignStats.map((stat: any) => ({
        campaignName: stat.campaign_name,
        total: stat.total,
        used: stat.used,
        available: stat.available
      }));
    }

    // Fallback: Get campaigns and calculate stats manually
    const { data: campaigns } = await this.supabase
      .from('promo_codes')
      .select('campaign_name')
      .not('campaign_name', 'is', null);
    
    if (!campaigns) return [];
    
    const uniqueNames = Array.from(new Set(campaigns.map((c: any) => c.campaign_name)));
    const stats = [];
    
    for (const campaignName of uniqueNames) {
      const { count: total } = await this.supabase
        .from('promo_codes')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_name', campaignName);
        
      const { count: used } = await this.supabase
        .from('promo_codes')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_name', campaignName)
        .eq('status', 'used');
        
      const { count: available } = await this.supabase
        .from('promo_codes')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_name', campaignName)
        .eq('status', 'unused');
        
      stats.push({
        campaignName: campaignName as string,
        total: total || 0,
        used: used || 0,
        available: available || 0
      });
    }
    
    return stats;
  }

  async importPromoCodes(promoCodeArray: InsertPromoCode[]): Promise<{ imported: number; skipped: number; errors: string[] }> {
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const promoCode of promoCodeArray) {
      try {
        // Check if code already exists
        const existing = await this.getPromoCodeByCode(promoCode.code);
        if (existing) {
          skipped++;
          continue;
        }

        await this.createPromoCode(promoCode);
        imported++;
      } catch (error) {
        errors.push(`Failed to import ${promoCode.code}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { imported, skipped, errors };
  }

  // API Token management
  async getAllApiTokens(): Promise<ApiToken[]> {
    const { data } = await this.supabase
      .from('api_tokens')
      .select('*')
      .order('created_at', { ascending: false });
    
    return (data || []).map((token: any) => ({
      id: token.id,
      name: token.name,
      token: token.token,
      createdAt: new Date(token.created_at),
      lastUsedAt: token.last_used_at ? new Date(token.last_used_at) : null,
    }));
  }

  async getApiTokenByToken(token: string): Promise<ApiToken | undefined> {
    const { data } = await this.supabase
      .from('api_tokens')
      .select('*')
      .eq('token', token)
      .single();
    
    if (!data) return undefined;
    
    return {
      id: data.id,
      name: data.name,
      token: data.token,
      createdAt: new Date(data.created_at),
      lastUsedAt: data.last_used_at ? new Date(data.last_used_at) : null,
    };
  }

  async createApiToken(apiTokenData: ApiTokenGenerate): Promise<ApiToken> {
    // Generate a secure token
    const token = 'sk-' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    const { data, error } = await this.supabase
      .from('api_tokens')
      .insert({
        name: apiTokenData.name,
        token: token,
        created_at: new Date().toISOString(),
        last_used_at: null
      })
      .select()
      .single();
    
    if (error) {
      console.error('Supabase token creation error:', error);
      throw new Error(`Failed to create API token: ${error.message}`);
    }
    
    if (!data) {
      console.error('Supabase returned null data for token creation');
      throw new Error('Failed to create API token: No data returned');
    }
    
    return {
      id: data.id,
      name: data.name,
      token: data.token,
      createdAt: new Date(data.created_at),
      lastUsedAt: data.last_used_at ? new Date(data.last_used_at) : null,
    };
  }

  async deleteApiToken(id: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('api_tokens')
      .delete()
      .eq('id', id);
    
    return !error;
  }

  async updateTokenLastUsed(token: string): Promise<void> {
    await this.supabase
      .from('api_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('token', token);
  }
}

// Factory function for Cloudflare Workers
export const storage = (env: any) => new CloudflareStorage(env);