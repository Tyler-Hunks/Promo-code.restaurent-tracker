import { type User, type InsertUser, type PromoCode, type InsertPromoCode, type ApiToken, type InsertApiToken, type EmailCampaign, type InsertEmailCampaign, type UpdateEmailCampaign, type EmailCampaignTemplate, type InsertEmailCampaignTemplate, type EmailCampaignLaunch, type InsertEmailCampaignLaunch, users, promoCodes, apiTokens, emailCampaigns, emailCampaignTemplates, emailCampaignLaunches } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, sql, and, inArray } from "drizzle-orm";

export interface PaginationOptions {
  page: number;
  limit: number;
  search?: string;
  campaign?: string;
  status?: string;
  discount?: string;
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
  
  // API Token methods
  getAllApiTokens(): Promise<ApiToken[]>;
  getApiTokenByToken(token: string): Promise<ApiToken | undefined>;
  createApiToken(apiToken: InsertApiToken): Promise<ApiToken>;
  deleteApiToken(id: string): Promise<boolean>;
  updateTokenLastUsed(token: string): Promise<void>;
  
  // Promo code methods
  getAllPromoCodes(): Promise<PromoCode[]>;
  getPaginatedPromoCodes(options: PaginationOptions): Promise<PaginatedResult<PromoCode>>;
  getPromoCodeByCode(code: string): Promise<PromoCode | undefined>;
  createPromoCode(promoCode: InsertPromoCode): Promise<PromoCode>;
  createBulkPromoCodes(promoCodes: InsertPromoCode[]): Promise<PromoCode[]>;
  markPromoCodeAsUsed(code: string): Promise<PromoCode | undefined>;
  deletePromoCode(code: string): Promise<boolean>;
  deleteBulkPromoCodes(codes: string[]): Promise<number>;
  deleteAllPromoCodes(): Promise<number>;
  deleteBulkByFilters(filters: { campaign?: string; status?: string; discountValue?: string }): Promise<number>;
  togglePromoCodeStatus(code: string, newStatus: "unused" | "used"): Promise<PromoCode | undefined>;
  getPromoCodeStats(): Promise<{ total: number; used: number; available: number; expired: number }>;
  getCampaigns(): Promise<string[]>;
  getCampaignStats(): Promise<Array<{ campaignName: string; available: number; used: number; total: number }>>;
  importPromoCodes(promoCodes: InsertPromoCode[]): Promise<{ imported: number; skipped: number; errors: string[] }>;

  // Email campaign methods (Campaigns tab — n8n trigger)
  getEmailCampaigns(): Promise<EmailCampaign[]>;
  getEmailCampaign(id: string): Promise<EmailCampaign | undefined>;
  createEmailCampaign(data: InsertEmailCampaign): Promise<EmailCampaign>;
  updateEmailCampaign(id: string, data: UpdateEmailCampaign): Promise<EmailCampaign | undefined>;
  markEmailCampaignLaunched(id: string): Promise<EmailCampaign | undefined>;
  getEmailCampaignTemplates(): Promise<EmailCampaignTemplate[]>;
  createEmailCampaignTemplate(data: InsertEmailCampaignTemplate): Promise<EmailCampaignTemplate>;
  deleteEmailCampaignTemplate(id: string): Promise<boolean>;
  getEmailCampaignLaunches(): Promise<EmailCampaignLaunch[]>;
  createEmailCampaignLaunch(data: InsertEmailCampaignLaunch): Promise<EmailCampaignLaunch>;
  // Called when n8n reports back that a workflow run ended (finished/failed).
  completeEmailCampaignRun(
    id: string,
    status: "finished" | "failed",
    detail?: string | null,
  ): Promise<EmailCampaignLaunch | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private promoCodes: Map<string, PromoCode>;
  private apiTokens: Map<string, ApiToken>;
  private emailCampaigns: Map<string, EmailCampaign>;
  private emailCampaignTemplates: Map<string, EmailCampaignTemplate>;
  private emailCampaignLaunches: Map<string, EmailCampaignLaunch>;

  constructor() {
    this.users = new Map();
    this.promoCodes = new Map();
    this.apiTokens = new Map();
    this.emailCampaigns = new Map();
    this.emailCampaignTemplates = new Map();
    this.emailCampaignLaunches = new Map();
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

  async getAllApiTokens(): Promise<ApiToken[]> {
    return Array.from(this.apiTokens.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getApiTokenByToken(token: string): Promise<ApiToken | undefined> {
    return Array.from(this.apiTokens.values()).find(
      (apiToken) => apiToken.token === token
    );
  }

  async createApiToken(insertApiToken: InsertApiToken): Promise<ApiToken> {
    const id = randomUUID();
    const token = this.generatePermanentToken();
    const apiToken: ApiToken = {
      ...insertApiToken,
      id,
      token,
      createdAt: new Date(),
      lastUsedAt: null,
    };
    this.apiTokens.set(id, apiToken);
    return apiToken;
  }

  async deleteApiToken(id: string): Promise<boolean> {
    return this.apiTokens.delete(id);
  }

  async updateTokenLastUsed(token: string): Promise<void> {
    const apiToken = await this.getApiTokenByToken(token);
    if (apiToken) {
      apiToken.lastUsedAt = new Date();
      this.apiTokens.set(apiToken.id, apiToken);
    }
  }

  private generatePermanentToken(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = 'pmt_'; // Permanent token prefix
    for (let i = 0; i < 40; i++) {
      token += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return token;
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
    
    if (options.discount) {
      const discountLower = options.discount.toLowerCase();
      allCodes = allCodes.filter(code => 
        code.discountValue && code.discountValue.toLowerCase().includes(discountLower)
      );
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

  async deleteAllPromoCodes(): Promise<number> {
    const total = this.promoCodes.size;
    this.promoCodes.clear();
    return total;
  }

  async deleteBulkByFilters(filters: { campaign?: string; status?: string; discountValue?: string }): Promise<number> {
    // Filters are already validated and sanitized by Zod schema
    const allCodes = Array.from(this.promoCodes.values());
    const codesToDelete = allCodes.filter(code => {
      if (filters.campaign && code.campaignName !== filters.campaign) return false;
      if (filters.status && code.status !== filters.status) return false;
      if (filters.discountValue && code.discountValue !== filters.discountValue) return false;
      return true;
    });
    
    codesToDelete.forEach(code => this.promoCodes.delete(code.id));
    return codesToDelete.length;
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

  async getCampaignStats(): Promise<Array<{ campaignName: string; available: number; used: number; total: number }>> {
    const campaignMap = new Map<string, { available: number; used: number; total: number }>();
    
    Array.from(this.promoCodes.values()).forEach(code => {
      if (!code.campaignName) return;
      
      const current = campaignMap.get(code.campaignName) || { available: 0, used: 0, total: 0 };
      current.total++;
      
      if (code.status === 'used') {
        current.used++;
      } else if (code.status === 'unused') {
        // Check if expired
        const isExpired = code.expiresAt && new Date(code.expiresAt) < new Date();
        if (!isExpired) {
          current.available++;
        }
      }
      
      campaignMap.set(code.campaignName, current);
    });
    
    return Array.from(campaignMap.entries()).map(([campaignName, stats]) => ({
      campaignName,
      ...stats
    })).sort((a, b) => b.total - a.total);
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

  // Email campaign methods
  async getEmailCampaigns(): Promise<EmailCampaign[]> {
    return Array.from(this.emailCampaigns.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getEmailCampaign(id: string): Promise<EmailCampaign | undefined> {
    return this.emailCampaigns.get(id);
  }

  async createEmailCampaign(data: InsertEmailCampaign): Promise<EmailCampaign> {
    const id = randomUUID();
    const campaign: EmailCampaign = {
      id,
      campaignName: data.campaignName,
      campaignType: data.campaignType ?? null,
      documentId: data.documentId,
      sheetIds: data.sheetIds ?? [],
      rawSheetId: data.rawSheetId ?? null,
      mainScripts: data.mainScripts ?? [],
      followUps: data.followUps ?? [],
      expiryDate: data.expiryDate ?? null,
      notes: data.notes ?? null,
      status: "draft",
      lastLaunchedAt: null,
      createdAt: new Date(),
    };
    this.emailCampaigns.set(id, campaign);
    return campaign;
  }

  async updateEmailCampaign(id: string, data: UpdateEmailCampaign): Promise<EmailCampaign | undefined> {
    const existing = this.emailCampaigns.get(id);
    if (!existing) return undefined;
    const updated: EmailCampaign = {
      ...existing,
      campaignName: data.campaignName ?? existing.campaignName,
      campaignType: data.campaignType !== undefined ? (data.campaignType ?? null) : existing.campaignType,
      documentId: data.documentId ?? existing.documentId,
      sheetIds: data.sheetIds !== undefined ? (data.sheetIds ?? []) : existing.sheetIds,
      rawSheetId: data.rawSheetId !== undefined ? (data.rawSheetId ?? null) : existing.rawSheetId,
      mainScripts: data.mainScripts !== undefined ? (data.mainScripts ?? []) : existing.mainScripts,
      followUps: data.followUps !== undefined ? (data.followUps ?? []) : existing.followUps,
      expiryDate: data.expiryDate !== undefined ? (data.expiryDate ?? null) : existing.expiryDate,
      notes: data.notes !== undefined ? (data.notes ?? null) : existing.notes,
    };
    this.emailCampaigns.set(id, updated);
    return updated;
  }

  async markEmailCampaignLaunched(id: string): Promise<EmailCampaign | undefined> {
    const existing = this.emailCampaigns.get(id);
    if (!existing) return undefined;
    const updated: EmailCampaign = {
      ...existing,
      status: "launched",
      lastLaunchedAt: new Date(),
    };
    this.emailCampaigns.set(id, updated);
    return updated;
  }

  async getEmailCampaignTemplates(): Promise<EmailCampaignTemplate[]> {
    return Array.from(this.emailCampaignTemplates.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async createEmailCampaignTemplate(data: InsertEmailCampaignTemplate): Promise<EmailCampaignTemplate> {
    const id = randomUUID();
    const template: EmailCampaignTemplate = {
      id,
      name: data.name,
      campaignType: data.campaignType ?? null,
      documentId: data.documentId ?? null,
      sheetIds: data.sheetIds ?? [],
      defaultRawSheetId: data.defaultRawSheetId ?? null,
      defaultMainScripts: data.defaultMainScripts ?? [],
      defaultFollowUps: data.defaultFollowUps ?? [],
      notes: data.notes ?? null,
      createdAt: new Date(),
    };
    this.emailCampaignTemplates.set(id, template);
    return template;
  }

  async deleteEmailCampaignTemplate(id: string): Promise<boolean> {
    return this.emailCampaignTemplates.delete(id);
  }

  async getEmailCampaignLaunches(): Promise<EmailCampaignLaunch[]> {
    return Array.from(this.emailCampaignLaunches.values()).sort(
      (a, b) => new Date(b.launchedAt).getTime() - new Date(a.launchedAt).getTime()
    );
  }

  async createEmailCampaignLaunch(data: InsertEmailCampaignLaunch): Promise<EmailCampaignLaunch> {
    const id = data.id ?? randomUUID();
    const launch: EmailCampaignLaunch = {
      id,
      campaignId: data.campaignId,
      campaignName: data.campaignName,
      status: data.status,
      detail: data.detail ?? null,
      runStatus: data.runStatus ?? null,
      runDetail: data.runDetail ?? null,
      runFinishedAt: null,
      launchedAt: new Date(),
    };
    this.emailCampaignLaunches.set(id, launch);
    return launch;
  }

  async completeEmailCampaignRun(
    id: string,
    status: "finished" | "failed",
    detail?: string | null,
  ): Promise<EmailCampaignLaunch | undefined> {
    const existing = this.emailCampaignLaunches.get(id);
    if (!existing) return undefined;
    const updated: EmailCampaignLaunch = {
      ...existing,
      runStatus: status,
      runDetail: detail ?? null,
      runFinishedAt: new Date(),
    };
    this.emailCampaignLaunches.set(id, updated);
    return updated;
  }
}

// DatabaseStorage implementation
export class DatabaseStorage implements IStorage {
  
  async getAllApiTokens(): Promise<ApiToken[]> {
    const tokens = await db.select().from(apiTokens).orderBy(sql`${apiTokens.createdAt} DESC`);
    return tokens;
  }

  async getApiTokenByToken(token: string): Promise<ApiToken | undefined> {
    const [result] = await db.select().from(apiTokens).where(eq(apiTokens.token, token));
    return result || undefined;
  }

  async createApiToken(insertApiToken: InsertApiToken): Promise<ApiToken> {
    const token = this.generatePermanentToken();
    const [result] = await db.insert(apiTokens).values({
      ...insertApiToken,
      token,
    }).returning();
    return result;
  }

  async deleteApiToken(id: string): Promise<boolean> {
    const result = await db.delete(apiTokens).where(eq(apiTokens.id, id));
    return (result.rowCount || 0) > 0;
  }

  async updateTokenLastUsed(token: string): Promise<void> {
    await db.update(apiTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiTokens.token, token));
  }

  private generatePermanentToken(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = 'pmt_'; // Permanent token prefix
    for (let i = 0; i < 40; i++) {
      token += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return token;
  }
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
    
    if (options.discount) {
      conditions.push(
        sql`${promoCodes.discountValue} ILIKE ${'%' + options.discount + '%'}`
      );
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

  async deleteAllPromoCodes(): Promise<number> {
    const result = await db.delete(promoCodes);
    return result.rowCount || 0;
  }

  async deleteBulkByFilters(filters: { campaign?: string; status?: string; discountValue?: string }): Promise<number> {
    // Filters are already validated and sanitized by Zod schema
    const conditions = [];
    if (filters.campaign) {
      conditions.push(eq(promoCodes.campaignName, filters.campaign));
    }
    if (filters.status) {
      conditions.push(eq(promoCodes.status, filters.status as any));
    }
    if (filters.discountValue) {
      conditions.push(eq(promoCodes.discountValue, filters.discountValue));
    }
    
    const result = await db.delete(promoCodes).where(and(...conditions));
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

  async getCampaignStats(): Promise<Array<{ campaignName: string; available: number; used: number; total: number }>> {
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

    // Get campaign stats
    const campaignStats = await db
      .select({
        campaignName: promoCodes.campaignName,
        total: sql<number>`COUNT(*)::int`,
        available: sql<number>`COUNT(CASE WHEN ${promoCodes.status} = 'unused' THEN 1 END)::int`,
        used: sql<number>`COUNT(CASE WHEN ${promoCodes.status} = 'used' THEN 1 END)::int`,
      })
      .from(promoCodes)
      .where(sql`${promoCodes.campaignName} IS NOT NULL`)
      .groupBy(promoCodes.campaignName)
      .orderBy(sql`COUNT(*) DESC`);

    return campaignStats.map(stat => ({
      campaignName: stat.campaignName || 'Unknown',
      available: stat.available,
      used: stat.used,
      total: stat.total
    }));
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

  // Email campaign methods
  async getEmailCampaigns(): Promise<EmailCampaign[]> {
    return await db.select().from(emailCampaigns).orderBy(sql`${emailCampaigns.createdAt} DESC`);
  }

  async getEmailCampaign(id: string): Promise<EmailCampaign | undefined> {
    const [row] = await db.select().from(emailCampaigns).where(eq(emailCampaigns.id, id));
    return row || undefined;
  }

  async createEmailCampaign(data: InsertEmailCampaign): Promise<EmailCampaign> {
    const [created] = await db.insert(emailCampaigns).values({
      campaignName: data.campaignName,
      campaignType: data.campaignType ?? null,
      documentId: data.documentId,
      sheetIds: data.sheetIds ?? [],
      rawSheetId: data.rawSheetId ?? null,
      mainScripts: data.mainScripts ?? [],
      followUps: data.followUps ?? [],
      expiryDate: data.expiryDate ?? null,
      notes: data.notes ?? null,
    }).returning();
    return created;
  }

  async updateEmailCampaign(id: string, data: UpdateEmailCampaign): Promise<EmailCampaign | undefined> {
    const patch: Record<string, any> = {};
    if (data.campaignName !== undefined) patch.campaignName = data.campaignName;
    if (data.campaignType !== undefined) patch.campaignType = data.campaignType ?? null;
    if (data.documentId !== undefined) patch.documentId = data.documentId;
    if (data.sheetIds !== undefined) patch.sheetIds = data.sheetIds ?? [];
    if (data.rawSheetId !== undefined) patch.rawSheetId = data.rawSheetId ?? null;
    if (data.mainScripts !== undefined) patch.mainScripts = data.mainScripts ?? [];
    if (data.followUps !== undefined) patch.followUps = data.followUps ?? [];
    if (data.expiryDate !== undefined) patch.expiryDate = data.expiryDate ?? null;
    if (data.notes !== undefined) patch.notes = data.notes ?? null;

    if (Object.keys(patch).length === 0) {
      return this.getEmailCampaign(id);
    }

    const [updated] = await db.update(emailCampaigns).set(patch).where(eq(emailCampaigns.id, id)).returning();
    return updated || undefined;
  }

  async markEmailCampaignLaunched(id: string): Promise<EmailCampaign | undefined> {
    const [updated] = await db
      .update(emailCampaigns)
      .set({ status: "launched", lastLaunchedAt: new Date() })
      .where(eq(emailCampaigns.id, id))
      .returning();
    return updated || undefined;
  }

  async getEmailCampaignTemplates(): Promise<EmailCampaignTemplate[]> {
    return await db.select().from(emailCampaignTemplates).orderBy(sql`${emailCampaignTemplates.createdAt} DESC`);
  }

  async createEmailCampaignTemplate(data: InsertEmailCampaignTemplate): Promise<EmailCampaignTemplate> {
    const [created] = await db.insert(emailCampaignTemplates).values({
      name: data.name,
      campaignType: data.campaignType ?? null,
      documentId: data.documentId ?? null,
      sheetIds: data.sheetIds ?? [],
      defaultRawSheetId: data.defaultRawSheetId ?? null,
      defaultMainScripts: data.defaultMainScripts ?? [],
      defaultFollowUps: data.defaultFollowUps ?? [],
      notes: data.notes ?? null,
    }).returning();
    return created;
  }

  async deleteEmailCampaignTemplate(id: string): Promise<boolean> {
    const deleted = await db.delete(emailCampaignTemplates).where(eq(emailCampaignTemplates.id, id)).returning();
    return deleted.length > 0;
  }

  async getEmailCampaignLaunches(): Promise<EmailCampaignLaunch[]> {
    return await db.select().from(emailCampaignLaunches).orderBy(sql`${emailCampaignLaunches.launchedAt} DESC`);
  }

  async createEmailCampaignLaunch(data: InsertEmailCampaignLaunch): Promise<EmailCampaignLaunch> {
    const [created] = await db.insert(emailCampaignLaunches).values({
      ...(data.id ? { id: data.id } : {}),
      campaignId: data.campaignId,
      campaignName: data.campaignName,
      status: data.status,
      detail: data.detail ?? null,
      runStatus: data.runStatus ?? null,
      runDetail: data.runDetail ?? null,
    }).returning();
    return created;
  }

  async completeEmailCampaignRun(
    id: string,
    status: "finished" | "failed",
    detail?: string | null,
  ): Promise<EmailCampaignLaunch | undefined> {
    const [updated] = await db
      .update(emailCampaignLaunches)
      .set({ runStatus: status, runDetail: detail ?? null, runFinishedAt: new Date() })
      .where(eq(emailCampaignLaunches.id, id))
      .returning();
    return updated || undefined;
  }
}

export const storage = new DatabaseStorage();
