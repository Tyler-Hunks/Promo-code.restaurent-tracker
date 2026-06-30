import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, date } from "drizzle-orm/pg-core";
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

export const apiTokens = pgTable("api_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  token: text("token").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at"),
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

export const insertApiTokenSchema = createInsertSchema(apiTokens).pick({
  name: true,
});

export const apiTokenGenerateSchema = z.object({
  name: z.string().min(1).max(100),
});

export const deleteBulkByFiltersSchema = z.object({
  campaign: z.string().trim().min(1).optional(),
  status: z.enum(["unused", "used", "expired"]).optional(),
  discountValue: z.string().trim().min(1).optional(),
}).refine((data) => data.campaign || data.status || data.discountValue, {
  message: "At least one filter (campaign, status, or discountValue) is required",
  path: [],
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertPromoCode = z.infer<typeof insertPromoCodeSchema>;
export type PromoCode = typeof promoCodes.$inferSelect;
export type BulkGenerate = z.infer<typeof bulkGenerateSchema>;
export type CampaignGenerate = z.infer<typeof campaignGenerateSchema>;
export type CsvImport = z.infer<typeof csvImportSchema>;
export type InsertApiToken = z.infer<typeof insertApiTokenSchema>;
export type ApiToken = typeof apiTokens.$inferSelect;
export type ApiTokenGenerate = z.infer<typeof apiTokenGenerateSchema>;
export type DeleteBulkByFilters = z.infer<typeof deleteBulkByFiltersSchema>;

// ===========================================================================
// Email Campaigns ("Campaigns" tab) — triggers external n8n cold-email
// workflows. Deliberately separate from the promo-code "campaign" concept
// (promoCodes.campaignName) and the /api/campaigns/stats endpoint.
// ===========================================================================
export const emailCampaigns = pgTable("email_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignName: text("campaign_name").notNull(),
  campaignType: text("campaign_type"),
  documentId: text("document_id").notNull(),
  documentId2: text("document_id_2"),
  campaignInfoGid: text("campaign_info_gid").notNull(),
  mainScript: text("main_script"),
  followUps: text("follow_ups").array().notNull().default(sql`'{}'::text[]`),
  expiryDate: date("expiry_date"),
  notes: text("notes"),
  status: text("status", { enum: ["draft", "launched"] }).notNull().default("draft"),
  lastLaunchedAt: timestamp("last_launched_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const emailCampaignTemplates = pgTable("email_campaign_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  campaignType: text("campaign_type"),
  documentId: text("document_id").notNull(),
  documentId2: text("document_id_2"),
  campaignInfoGid: text("campaign_info_gid").notNull(),
  defaultMainScript: text("default_main_script"),
  defaultFollowUps: text("default_follow_ups").array().notNull().default(sql`'{}'::text[]`),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEmailCampaignSchema = createInsertSchema(emailCampaigns)
  .omit({ id: true, status: true, lastLaunchedAt: true, createdAt: true })
  .extend({
    campaignName: z.string().min(1, "Campaign name is required"),
    campaignType: z.string().optional().nullable(),
    documentId: z.string().min(1, "Google Sheet Document ID is required"),
    documentId2: z.string().optional().nullable(),
    campaignInfoGid: z.string().min(1, "Campaign Info tab GID is required"),
    mainScript: z.string().optional().nullable(),
    followUps: z.array(z.string()).optional().default([]),
    expiryDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Expiry date must be in YYYY-MM-DD format")
      .optional()
      .nullable(),
    notes: z.string().optional().nullable(),
  });

export const updateEmailCampaignSchema = insertEmailCampaignSchema.partial();

export const insertEmailCampaignTemplateSchema = createInsertSchema(emailCampaignTemplates)
  .omit({ id: true, createdAt: true })
  .extend({
    name: z.string().min(1, "Template name is required"),
    campaignType: z.string().optional().nullable(),
    documentId: z.string().min(1, "Google Sheet Document ID is required"),
    documentId2: z.string().optional().nullable(),
    campaignInfoGid: z.string().min(1, "Campaign Info tab GID is required"),
    defaultMainScript: z.string().optional().nullable(),
    defaultFollowUps: z.array(z.string()).optional().default([]),
    notes: z.string().optional().nullable(),
  });

export type EmailCampaign = typeof emailCampaigns.$inferSelect;
export type InsertEmailCampaign = z.infer<typeof insertEmailCampaignSchema>;
export type UpdateEmailCampaign = z.infer<typeof updateEmailCampaignSchema>;
export type EmailCampaignTemplate = typeof emailCampaignTemplates.$inferSelect;
export type InsertEmailCampaignTemplate = z.infer<typeof insertEmailCampaignTemplateSchema>;
