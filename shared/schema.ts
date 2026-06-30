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
  // One Google Sheet file (the Document ID) holding the campaign's lead tabs.
  documentId: text("document_id").notNull(),
  // The tab gids inside that document (at least 2 — e.g. lead lists).
  sheetIds: text("sheet_ids").array().notNull().default(sql`'{}'::text[]`),
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
  // Optional on a template — you may reuse just the scripts.
  documentId: text("document_id"),
  sheetIds: text("sheet_ids").array().notNull().default(sql`'{}'::text[]`),
  defaultMainScript: text("default_main_script"),
  defaultFollowUps: text("default_follow_ups").array().notNull().default(sql`'{}'::text[]`),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Full launch history — one row per launch attempt (success or failure), so the
// Campaigns tab can show "every launch" as well as a per-campaign rollup.
export const emailCampaignLaunches = pgTable("email_campaign_launches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull(),
  campaignName: text("campaign_name").notNull(), // snapshot at launch time
  status: text("status", { enum: ["success", "failed"] }).notNull(),
  detail: text("detail"), // truncated n8n response body or error message
  launchedAt: timestamp("launched_at").notNull().defaultNow(),
});

// Lenient format checks so obvious typos are caught without rejecting valid IDs.
const documentIdField = z
  .string()
  .min(1, "Google Sheet Document ID is required")
  .regex(/^[A-Za-z0-9_-]+$/, "Document ID should be just the ID from the URL (letters, numbers, - and _)");
const sheetIdsField = z
  .array(
    z.string().regex(/^\d+$/, "Each Sheet ID (gid) should be a number, e.g. 0 or 123456789"),
  )
  .min(2, "Add at least 2 Sheet IDs (gids)");

export const insertEmailCampaignSchema = createInsertSchema(emailCampaigns)
  .omit({ id: true, status: true, lastLaunchedAt: true, createdAt: true })
  .extend({
    campaignName: z.string().min(1, "Campaign name is required"),
    campaignType: z.string().optional().nullable(),
    documentId: documentIdField,
    sheetIds: sheetIdsField,
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
    documentId: documentIdField.optional().nullable(),
    sheetIds: z
      .array(z.string().regex(/^\d+$/, "Each Sheet ID (gid) should be a number"))
      .optional()
      .default([]),
    defaultMainScript: z.string().optional().nullable(),
    defaultFollowUps: z.array(z.string()).optional().default([]),
    notes: z.string().optional().nullable(),
  });

export const insertEmailCampaignLaunchSchema = createInsertSchema(emailCampaignLaunches).omit({
  id: true,
  launchedAt: true,
});

// Finds every {{ placeholder }} token used across a campaign's scripts so the UI
// can show which variables n8n must fill, and so they can ride along in the
// launch payload. Shared by the frontend (live chips) and backend (payload).
export function extractPlaceholders(input: {
  mainScript?: string | null;
  followUps?: string[] | null;
}): string[] {
  const texts = [input.mainScript ?? "", ...(input.followUps ?? [])];
  const found = new Set<string>();
  const re = /\{\{\s*([^{}]+?)\s*\}\}/g;
  for (const text of texts) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const token = match[1].trim();
      if (token) found.add(token);
    }
  }
  return Array.from(found);
}

export type EmailCampaign = typeof emailCampaigns.$inferSelect;
export type InsertEmailCampaign = z.infer<typeof insertEmailCampaignSchema>;
export type UpdateEmailCampaign = z.infer<typeof updateEmailCampaignSchema>;
export type EmailCampaignTemplate = typeof emailCampaignTemplates.$inferSelect;
export type InsertEmailCampaignTemplate = z.infer<typeof insertEmailCampaignTemplateSchema>;
export type EmailCampaignLaunch = typeof emailCampaignLaunches.$inferSelect;
export type InsertEmailCampaignLaunch = z.infer<typeof insertEmailCampaignLaunchSchema>;
