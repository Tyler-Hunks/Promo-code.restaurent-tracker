import { type User, type InsertUser, type PromoCode, type InsertPromoCode } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Promo code methods
  getAllPromoCodes(): Promise<PromoCode[]>;
  getPromoCodeByCode(code: string): Promise<PromoCode | undefined>;
  createPromoCode(promoCode: InsertPromoCode): Promise<PromoCode>;
  createBulkPromoCodes(promoCodes: InsertPromoCode[]): Promise<PromoCode[]>;
  markPromoCodeAsUsed(code: string): Promise<PromoCode | undefined>;
  getPromoCodeStats(): Promise<{ total: number; used: number; available: number }>;
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

  async getPromoCodeStats(): Promise<{ total: number; used: number; available: number }> {
    const allCodes = Array.from(this.promoCodes.values());
    const total = allCodes.length;
    const used = allCodes.filter(code => code.status === "used").length;
    const available = total - used;

    return { total, used, available };
  }
}

export const storage = new MemStorage();
