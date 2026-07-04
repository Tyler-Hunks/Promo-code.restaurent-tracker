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

// API clients (like the n8n workflow) may send "", null, or the literal string
// "null" when a code has no expiry — all of these mean "no expiry date".
const NO_EXPIRY_SENTINELS = ["", "null"];

const expiresAtInput = z.preprocess(
  (v) =>
    v === null ||
    (typeof v === "string" && NO_EXPIRY_SENTINELS.includes(v.trim().toLowerCase()))
      ? undefined
      : v,
  z.string().datetime({ offset: true }).optional(),
);

// Same rule for endpoints that don't go through zod: returns { ok: false } only
// for genuinely malformed values, and { ok: true, value: undefined } for the
// "no expiry" sentinels ("", null, "null", undefined).
export function parseExpiresAt(
  value: unknown,
): { ok: true; value: Date | undefined } | { ok: false } {
  if (value === null || value === undefined) return { ok: true, value: undefined };
  if (typeof value !== "string") return { ok: false };
  const trimmed = value.trim();
  if (NO_EXPIRY_SENTINELS.includes(trimmed.toLowerCase())) return { ok: true, value: undefined };
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? { ok: false } : { ok: true, value: parsed };
}

export const bulkGenerateSchema = z.object({
  count: z.number().min(1).max(5000),
  format: z.string().min(1).max(50).default("PROMO-XXXX"),
  campaignName: z.string().optional(),
  discountValue: z.string().optional(),
  expiresAt: expiresAtInput,
});

export const campaignGenerateSchema = z.object({
  campaignName: z.string().min(1),
  discountValue: z.string().min(1),
  count: z.number().min(1).max(5000),
  format: z.string().min(1).max(50).default("PROMO-XXXX"),
  expiresAt: expiresAtInput,
});

export const csvImportSchema = z.object({
  codes: z.array(z.object({
    code: z.string().min(1),
    status: z.enum(["unused", "used", "expired"]).default("unused"),
    campaignName: z.string().optional(),
    discountValue: z.string().optional(),
    usedAt: z.string().datetime().optional(),
    expiresAt: expiresAtInput,
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
  // Tied to the main scripts by position: sheetIds[0] ↔ mainScripts[0]
  // ("A: Yes Location"), sheetIds[1] ↔ mainScripts[1] ("B: No Location").
  sheetIds: text("sheet_ids").array().notNull().default(sql`'{}'::text[]`),
  // The 2 main scripts — one per list. Index 0 = "A: Yes Location", index 1 =
  // "B: No Location". Each pairs with the same-index Sheet ID.
  mainScripts: text("main_scripts").array().notNull().default(sql`'{}'::text[]`),
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
  // Up to 2 default main-script variants (A, B), same as email_campaigns.
  defaultMainScripts: text("default_main_scripts").array().notNull().default(sql`'{}'::text[]`),
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

// Human labels for the two lead lists, tied by position to the Sheet IDs and
// main scripts: index 0 = first sheet, index 1 = second sheet. These labels
// also appear in the n8n launch payload as each list's `label`.
export const LIST_LABELS = ["A: Yes Location", "B: No Location"] as const;

// Both main scripts are always required on a campaign — one per list. Any
// message variations are pasted into the same textbox (n8n detects them), so
// the two boxes are separate scripts for separate lists, not an A/B test.
const mainScriptsField = z
  .array(z.string())
  .max(2, "At most 2 main scripts (one per list)")
  .refine(
    (arr) => arr.length === 2 && arr.every((s) => Boolean(s?.trim())),
    { message: `Both main scripts are required ("${LIST_LABELS[0]}" and "${LIST_LABELS[1]}")` },
  );

// Templates only hold defaults, so their scripts may be left blank.
const defaultMainScriptsField = z
  .array(z.string())
  .max(2, "At most 2 main scripts (one per list)")
  .optional()
  .default([]);

export const insertEmailCampaignSchema = createInsertSchema(emailCampaigns)
  .omit({ id: true, status: true, lastLaunchedAt: true, createdAt: true })
  .extend({
    campaignName: z.string().min(1, "Campaign name is required"),
    campaignType: z.string().optional().nullable(),
    documentId: documentIdField,
    sheetIds: sheetIdsField,
    mainScripts: mainScriptsField,
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
    defaultMainScripts: defaultMainScriptsField,
    defaultFollowUps: z.array(z.string()).optional().default([]),
    notes: z.string().optional().nullable(),
  });

export const insertEmailCampaignLaunchSchema = createInsertSchema(emailCampaignLaunches).omit({
  id: true,
  launchedAt: true,
});

// Finds every {{ placeholder }} token used across the given texts so the UI can
// show which variables n8n must fill, and so they can ride along in the launch
// payload. Pass one text (e.g. a single variant) for per-item chips, or many
// (variants + follow-ups) for a combined list. Shared by frontend + backend.
export function extractPlaceholders(texts: Array<string | null | undefined>): string[] {
  const found = new Set<string>();
  const re = /\{\{\s*([^{}]+?)\s*\}\}/g;
  for (const text of texts) {
    if (!text) continue;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const token = match[1].trim();
      if (token) found.add(token);
    }
  }
  return Array.from(found);
}

// The top-level lead fields n8n fills directly on each contact.
export const TOP_LEVEL_PLACEHOLDER_FIELDS = [
  "email",
  "first_name",
  "last_name",
  "company_name",
  "location",
  "phone_number",
] as const;

// The custom_fields.* keys. In a script these are referenced by their BARE name
// only (e.g. {{Promo_Code}}). "custom_fields" is the upload grouping (for
// Smartlead), NOT part of the placeholder token, so {{custom_fields.Promo_Code}}
// is invalid and gets flagged red.
export const CUSTOM_PLACEHOLDER_FIELDS = [
  "Position",
  "Promo_Code",
  "Industry",
  "Number_of_Employees",
  "Total Cost",
  "Directions",
  "Organisation LinkedIn",
  "Personal LinkedIn",
  "Keywords",
] as const;

// Every supported placeholder name, for docs/UI. A {{ placeholder }} matching one
// of these is "known"; anything else is flagged (shown red in the UI) so the user
// spots it before launch. Missing fields are fine — a script needn't use them all.
export const KNOWN_PLACEHOLDER_FIELDS = [
  ...TOP_LEVEL_PLACEHOLDER_FIELDS,
  ...CUSTOM_PLACEHOLDER_FIELDS,
];

// Matching is EXACT (case- and spelling-sensitive, only whitespace trimmed),
// because Smartlead/n8n fill values by exact key: "{{Email}}", "{{Total_Cost}}",
// "{{first name}}" or "{{custom_fields.Promo_Code}}" would NOT be filled and must
// be flagged. Every valid token is a BARE field name — the "custom_fields."
// grouping is part of the upload, never part of the placeholder token.
const KNOWN_PLACEHOLDER_SET = new Set<string>([
  ...TOP_LEVEL_PLACEHOLDER_FIELDS,
  ...CUSTOM_PLACEHOLDER_FIELDS,
]);

// True when a placeholder token maps to a supported lead field (see above).
export function isKnownPlaceholder(token: string): boolean {
  return KNOWN_PLACEHOLDER_SET.has(token.trim());
}

export type EmailCampaign = typeof emailCampaigns.$inferSelect;
export type InsertEmailCampaign = z.infer<typeof insertEmailCampaignSchema>;
export type UpdateEmailCampaign = z.infer<typeof updateEmailCampaignSchema>;
export type EmailCampaignTemplate = typeof emailCampaignTemplates.$inferSelect;
export type InsertEmailCampaignTemplate = z.infer<typeof insertEmailCampaignTemplateSchema>;
export type EmailCampaignLaunch = typeof emailCampaignLaunches.$inferSelect;
export type InsertEmailCampaignLaunch = z.infer<typeof insertEmailCampaignLaunchSchema>;

// Converts a "YYYY-MM-DD" expiry date to an ISO 8601 UTC timestamp string
// (e.g. "2026-01-31T00:00:00Z"), or null when no date is set. This is what the
// n8n launch payload sends — n8n pings it back to create a promo code, so the
// format must stay "YYYY-MM-DDTHH:mm:ssZ".
export function toIsoUtc(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const ms = Date.parse(`${dateStr}T00:00:00Z`);
  return Number.isNaN(ms) ? null : `${dateStr}T00:00:00Z`;
}

// One "list" in the launch payload: a single main script paired with its Sheet
// ID, plus the shared follow-ups and that list's combined placeholders. The
// `label` alone identifies the list — there is no separate `variant` field.
export interface LaunchList {
  label: string;
  sheetId: string | null;
  mainScript: string;
  followUps: string[];
  placeholders: string[];
}

// Builds the JSON body POSTed to the n8n webhook when a campaign launches
// (without the server-only `triggeredAt` stamp — see buildLaunchRequestBody).
// Shared by the Express dev server, the Cloudflare Worker, and the frontend
// launch preview so the payload shape never drifts between them.
//
// Each non-empty main script becomes a "list" paired with the same-index Sheet
// ID (mainScripts[0] → "A: Yes Location", mainScripts[1] → "B: No Location").
// Follow-ups are shared across every list. Each list also carries its own
// combined placeholders, and the whole campaign gets a combined placeholder
// list too.
export function buildLaunchPayload(campaign: EmailCampaign) {
  const followUps = campaign.followUps ?? [];
  const variants = campaign.mainScripts ?? [];
  const sheetIds = campaign.sheetIds ?? [];

  const lists: LaunchList[] = [];
  variants.forEach((raw, i) => {
    const mainScript = (raw ?? "").trim();
    if (!mainScript) return; // skip empty scripts but keep index-based pairing
    lists.push({
      label: LIST_LABELS[i] ?? `Sheet ${i + 1}`,
      sheetId: sheetIds[i] ?? null,
      mainScript,
      followUps,
      placeholders: extractPlaceholders([mainScript, ...followUps]),
    });
  });

  return {
    campaignId: campaign.id,
    campaignName: campaign.campaignName,
    campaignType: campaign.campaignType ?? null,
    documentId: campaign.documentId,
    sheetIds,
    lists,
    followUps,
    // Combined placeholders across every variant + the shared follow-ups.
    placeholders: extractPlaceholders([...variants, ...followUps]),
    // ISO UTC timestamp like "2026-01-31T00:00:00Z" (or null) — never the raw
    // YYYY-MM-DD string. n8n uses this to create the promo code's expiry.
    expiryDate: toIsoUtc(campaign.expiryDate),
  };
}
