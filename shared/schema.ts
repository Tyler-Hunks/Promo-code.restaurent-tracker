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
  status: text("status", { enum: ["unused", "used"] }).notNull().default("unused"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  usedAt: timestamp("used_at"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertPromoCodeSchema = createInsertSchema(promoCodes).pick({
  code: true,
});

export const bulkGenerateSchema = z.object({
  count: z.number().min(1).max(100),
  format: z.enum(["PROMO-XXXX", "SAVE-XXXX-XX", "DISCOUNT-XXXXXX"]).default("PROMO-XXXX"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertPromoCode = z.infer<typeof insertPromoCodeSchema>;
export type PromoCode = typeof promoCodes.$inferSelect;
export type BulkGenerate = z.infer<typeof bulkGenerateSchema>;
