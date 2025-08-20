import { type User, type InsertUser, type PromoCode, type InsertPromoCode, users, promoCodes } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, sql, and, inArray } from "drizzle-orm";

export interface PaginationOptions {
  page: number;
  limit: number;
  search?: string;
  campaign?: string;
  status?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Promo code methods
  getAllPromoCodes(): Promise<PromoCode[]>;
  getPaginatedPromoCodes(options: PaginationOptions): Promise<PaginatedResult<PromoCode>>;
  getPromoCodeByCode(code: string): Promise<PromoCode | undefined>;
  createPromoCode(promoCode: InsertPromoCode): Promise<PromoCode>;
  createBulkPromoCodes(promoCodes: InsertPromoCode[]): Promise<PromoCode[]>;
  markPromoCodeAsUsed(code: string): Promise<PromoCode | undefined>;
  deletePromoCode(code: string): Promise<boolean>;
  deleteBulkPromoCodes(codes: string[]): Promise<number>;
  togglePromoCodeStatus(code: string, newStatus: "unused" | "used"): Promise<PromoCode | undefined>;
  getPromoCodeStats(): Promise<{ total: number; used: number; available: number; expired: number }>;
  getCampaigns(): Promise<string[]>;
  importPromoCodes(promoCodes: InsertPromoCode[]): Promise<{ imported: number; skipped: number; errors: string[] }>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private promoCodes: Map<string, PromoCode>;

  constructor() {
    this.users = new Map();
    this.promoCodes = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getAllPromoCodes(): Promise<PromoCode[]> {
    return Array.from(this.promoCodes.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getPaginatedPromoCodes(options: PaginationOptions): Promise<PaginatedResult<PromoCode>> {
    // In-memory implementation for MemStorage
    let allCodes = Array.from(this.promoCodes.values());
    
    // Apply filters
    if (options.search) {
      const searchLower = options.search.toLowerCase();
      allCodes = allCodes.filter(code => 
        code.code.toLowerCase().includes(searchLower) ||
        (code.campaignName && code.campaignName.toLowerCase().includes(searchLower))
      );
    }
    
    if (options.campaign) {
      allCodes = allCodes.filter(code => code.campaignName === options.campaign);
    }
    
    if (options.status) {
      allCodes = allCodes.filter(code => code.status === options.status);
    }
    
    // Sort by creation date
    allCodes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    const total = allCodes.length;
    const totalPages = Math.ceil(total / options.limit);
    const offset = (options.page - 1) * options.limit;
    const data = allCodes.slice(offset, offset + options.limit);
    
    return {
      data,
      total,
      page: options.page,
      limit: options.limit,
      totalPages
    };
  }

  async getPromoCodeByCode(code: string): Promise<PromoCode | undefined> {
    return Array.from(this.promoCodes.values()).find(
      (promoCode) => promoCode.code === code
    );
  }

  async createPromoCode(insertPromoCode: InsertPromoCode): Promise<PromoCode> {
    const id = randomUUID();
    const promoCode: PromoCode = {
      ...insertPromoCode,
      id,
      status: "unused",
      campaignName: insertPromoCode.campaignName || null,
      discountValue: insertPromoCode.discountValue || null,
      expiresAt: insertPromoCode.expiresAt ? new Date(insertPromoCode.expiresAt) : null,
      createdAt: new Date(),
      usedAt: null,
    };
    this.promoCodes.set(id, promoCode);
    return promoCode;
  }

  async createBulkPromoCodes(insertPromoCodes: InsertPromoCode[]): Promise<PromoCode[]> {
    const promoCodes: PromoCode[] = [];
    
    for (const insertPromoCode of insertPromoCodes) {
      const id = randomUUID();
      const promoCode: PromoCode = {
        ...insertPromoCode,
        id,
        status: "unused",
        campaignName: insertPromoCode.campaignName || null,
        discountValue: insertPromoCode.discountValue || null,
        expiresAt: insertPromoCode.expiresAt ? new Date(insertPromoCode.expiresAt) : null,
        createdAt: new Date(),
        usedAt: null,
      };
      this.promoCodes.set(id, promoCode);
      promoCodes.push(promoCode);
    }
    
    return promoCodes;
  }

  async markPromoCodeAsUsed(code: string): Promise<PromoCode | undefined> {
    const promoCode = await this.getPromoCodeByCode(code);
    if (!promoCode || promoCode.status === "used") {
      return undefined;
    }

    const updatedPromoCode: PromoCode = {
      ...promoCode,
      status: "used",
      usedAt: new Date(),
    };

    this.promoCodes.set(promoCode.id, updatedPromoCode);
    return updatedPromoCode;
  }

  async getPromoCodeStats(): Promise<{ total: number; used: number; available: number; expired: number }> {
    const allCodes = Array.from(this.promoCodes.values());
    const now = new Date();
    
    // Check for expired codes
    const expiredCodes = allCodes.filter(code => 
      code.expiresAt && code.expiresAt < now && code.status === "unused"
    );
    
    // Update expired codes
    for (const code of expiredCodes) {
      const updatedCode = { ...code, status: "expired" as const };
      this.promoCodes.set(code.id, updatedCode);
    }
    
    const updatedCodes = Array.from(this.promoCodes.values());
    const total = updatedCodes.length;
    const used = updatedCodes.filter(code => code.status === "used").length;
    const expired = updatedCodes.filter(code => code.status === "expired").length;
    const available = total - used - expired;

    return { total, used, available, expired };
  }

  async deletePromoCode(code: string): Promise<boolean> {
    const promoCode = await this.getPromoCodeByCode(code);
    if (!promoCode) {
      return false;
    }
    
    this.promoCodes.delete(promoCode.id);
    return true;
  }

  async deleteBulkPromoCodes(codes: string[]): Promise<number> {
    let deletedCount = 0;
    
    for (const code of codes) {
      const promoCode = await this.getPromoCodeByCode(code);
      if (promoCode) {
        this.promoCodes.delete(promoCode.id);
        deletedCount++;
      }
    }
    
    return deletedCount;
  }

  async togglePromoCodeStatus(code: string, newStatus: "unused" | "used"): Promise<PromoCode | undefined> {
    const promoCode = await this.getPromoCodeByCode(code);
    if (!promoCode) return undefined;

    const updated = {
      ...promoCode,
      status: newStatus,
      usedAt: newStatus === "used" ? new Date() : null
    };
    this.promoCodes.set(promoCode.id, updated);
    return updated;
  }

  async getCampaigns(): Promise<string[]> {
    const allCodes = Array.from(this.promoCodes.values());
    const uniqueNames = new Set(allCodes
      .map(code => code.campaignName)
      .filter(name => name !== null && name !== undefined)
    );
    return Array.from(uniqueNames) as string[];
  }

  async importPromoCodes(promoCodes: InsertPromoCode[]): Promise<{ imported: number; skipped: number; errors: string[] }> {
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const promoCode of promoCodes) {
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

// DatabaseStorage implementation
export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getAllPromoCodes(): Promise<PromoCode[]> {
    const codes = await db.select().from(promoCodes).orderBy(sql`${promoCodes.createdAt} DESC`);
    return codes;
  }

  async getPaginatedPromoCodes(options: PaginationOptions): Promise<PaginatedResult<PromoCode>> {
    // Build where conditions
    const conditions = [];
    
    if (options.search) {
      conditions.push(
        sql`(${promoCodes.code} ILIKE ${'%' + options.search + '%'} OR ${promoCodes.campaignName} ILIKE ${'%' + options.search + '%'})`
      );
    }
    
    if (options.campaign) {
      conditions.push(eq(promoCodes.campaignName, options.campaign));
    }
    
    if (options.status) {
      conditions.push(eq(promoCodes.status, options.status as any));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(promoCodes)
      .where(whereClause);

    // Get paginated data
    const data = await db
      .select()
      .from(promoCodes)
      .where(whereClause)
      .orderBy(sql`${promoCodes.createdAt} DESC`)
      .limit(options.limit)
      .offset((options.page - 1) * options.limit);

    const totalPages = Math.ceil(count / options.limit);

    return {
      data,
      total: count,
      page: options.page,
      limit: options.limit,
      totalPages
    };
  }

  async getPromoCodeByCode(code: string): Promise<PromoCode | undefined> {
    const [promoCode] = await db.select().from(promoCodes).where(eq(promoCodes.code, code));
    return promoCode || undefined;
  }

  async createPromoCode(promoCode: InsertPromoCode): Promise<PromoCode> {
    const [created] = await db
      .insert(promoCodes)
      .values(promoCode)
      .returning();
    return created;
  }

  async createBulkPromoCodes(promoCodeArray: InsertPromoCode[]): Promise<PromoCode[]> {
    const created = await db
      .insert(promoCodes)
      .values(promoCodeArray)
      .returning();
    return created;
  }

  async markPromoCodeAsUsed(code: string): Promise<PromoCode | undefined> {
    const [updated] = await db
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
    const result = await db
      .delete(promoCodes)
      .where(eq(promoCodes.code, code));
    return (result.rowCount || 0) > 0;
  }

  async deleteBulkPromoCodes(codes: string[]): Promise<number> {
    const result = await db
      .delete(promoCodes)
      .where(inArray(promoCodes.code, codes));
    return result.rowCount || 0;
  }

  async togglePromoCodeStatus(code: string, newStatus: "unused" | "used"): Promise<PromoCode | undefined> {
    const [updated] = await db
      .update(promoCodes)
      .set({ 
        status: newStatus,
        usedAt: newStatus === "used" ? new Date() : null
      })
      .where(eq(promoCodes.code, code))
      .returning();
    return updated || undefined;
  }

  async getPromoCodeStats(): Promise<{ total: number; used: number; available: number; expired: number }> {
    // Update expired codes first
    await db
      .update(promoCodes)
      .set({ status: "expired" })
      .where(
        and(
          sql`${promoCodes.expiresAt} < NOW()`,
          eq(promoCodes.status, "unused")
        )
      );

    // Get stats
    const [stats] = await db
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
    const campaigns = await db
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

export const storage = new DatabaseStorage();
