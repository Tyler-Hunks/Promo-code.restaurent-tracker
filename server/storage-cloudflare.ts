import { type User, type InsertUser, type PromoCode, type InsertPromoCode, users, promoCodes } from "@shared/schema";
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, sql, and } from "drizzle-orm";
import type { IStorage } from "./storage";

// Cloudflare-compatible database storage
export class CloudflareStorage implements IStorage {
  private db: any;

  constructor(env: any) {
    // Initialize database connection with Supabase/PostgreSQL
    const client = postgres(env.DATABASE_URL);
    this.db = drizzle(client, { schema: { users, promoCodes } });
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await this.db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getAllPromoCodes(): Promise<PromoCode[]> {
    const codes = await this.db.select().from(promoCodes).orderBy(sql`${promoCodes.createdAt} DESC`);
    return codes;
  }

  async getPromoCodeByCode(code: string): Promise<PromoCode | undefined> {
    const [promoCode] = await this.db.select().from(promoCodes).where(eq(promoCodes.code, code));
    return promoCode || undefined;
  }

  async createPromoCode(promoCode: InsertPromoCode): Promise<PromoCode> {
    const [created] = await this.db
      .insert(promoCodes)
      .values(promoCode)
      .returning();
    return created;
  }

  async createBulkPromoCodes(promoCodeArray: InsertPromoCode[]): Promise<PromoCode[]> {
    const created = await this.db
      .insert(promoCodes)
      .values(promoCodeArray)
      .returning();
    return created;
  }

  async markPromoCodeAsUsed(code: string): Promise<PromoCode | undefined> {
    const [updated] = await this.db
      .update(promoCodes)
      .set({ 
        status: "used", 
        usedAt: new Date() 
      })
      .where(eq(promoCodes.code, code))
      .returning();
    return updated || undefined;
  }

  async deletePromoCode(code: string): Promise<boolean> {
    const result = await this.db
      .delete(promoCodes)
      .where(eq(promoCodes.code, code));
    return (result.rowCount || 0) > 0;
  }

  async deleteBulkPromoCodes(codes: string[]): Promise<number> {
    const result = await this.db
      .delete(promoCodes)
      .where(sql`${promoCodes.code} = ANY(${codes})`);
    return result.rowCount || 0;
  }

  async getPromoCodeStats(): Promise<{ total: number; used: number; available: number; expired: number }> {
    // Update expired codes first
    await this.db
      .update(promoCodes)
      .set({ status: "expired" })
      .where(
        and(
          sql`${promoCodes.expiresAt} < NOW()`,
          eq(promoCodes.status, "unused")
        )
      );

    // Get stats
    const [stats] = await this.db
      .select({
        total: sql<number>`COUNT(*)::int`,
        used: sql<number>`COUNT(CASE WHEN ${promoCodes.status} = 'used' THEN 1 END)::int`,
        expired: sql<number>`COUNT(CASE WHEN ${promoCodes.status} = 'expired' THEN 1 END)::int`,
        available: sql<number>`COUNT(CASE WHEN ${promoCodes.status} = 'unused' THEN 1 END)::int`,
      })
      .from(promoCodes);

    return stats;
  }

  async getCampaigns(): Promise<string[]> {
    const campaigns = await this.db
      .selectDistinct({ name: promoCodes.campaignName })
      .from(promoCodes)
      .where(sql`${promoCodes.campaignName} IS NOT NULL`);
    
    return campaigns.map(c => c.name).filter(Boolean) as string[];
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
}

// Factory function for Cloudflare Workers
export const storage = (env: any) => new CloudflareStorage(env);