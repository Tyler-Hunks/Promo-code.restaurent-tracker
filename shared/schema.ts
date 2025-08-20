import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const promoCodes = pgTable("promo_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  status: text("status", { enum: ["unused", "used", "expired"] }).notNull().default("unused"),
  campaignName: text("campaign_name"),
  discountValue: text("discount_value"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  usedAt: timestamp("used_at"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertPromoCodeSchema = createInsertSchema(promoCodes).pick({
  code: true,
  campaignName: true,
  discountValue: true,
  expiresAt: true,
});

export const bulkGenerateSchema = z.object({
  count: z.number().min(1).max(5000),
  format: z.string().min(1).max(50).default("PROMO-XXXX"),
  campaignName: z.string().optional(),
  discountValue: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

export const campaignGenerateSchema = z.object({
  campaignName: z.string().min(1),
  discountValue: z.string().min(1),
  count: z.number().min(1).max(5000),
  format: z.string().min(1).max(50).default("PROMO-XXXX"),
  expiresAt: z.string().datetime().optional(),
});

export const csvImportSchema = z.object({
  codes: z.array(z.object({
    code: z.string().min(1),
    status: z.enum(["unused", "used", "expired"]).default("unused"),
    campaignName: z.string().optional(),
    discountValue: z.string().optional(),
    usedAt: z.string().datetime().optional(),
    expiresAt: z.string().datetime().optional(),
  }))
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertPromoCode = z.infer<typeof insertPromoCodeSchema>;
export type PromoCode = typeof promoCodes.$inferSelect;
export type BulkGenerate = z.infer<typeof bulkGenerateSchema>;
export type CampaignGenerate = z.infer<typeof campaignGenerateSchema>;
export type CsvImport = z.infer<typeof csvImportSchema>;
