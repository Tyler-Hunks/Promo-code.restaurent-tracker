import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPromoCodeSchema, bulkGenerateSchema, campaignGenerateSchema, csvImportSchema, apiTokenGenerateSchema, deleteBulkByFiltersSchema, insertEmailCampaignSchema, updateEmailCampaignSchema, insertEmailCampaignTemplateSchema, runCallbackSchema, parseExpiresAt, LIST_LABELS, type BulkGenerate, type CampaignGenerate, type CsvImport, type ApiTokenGenerate } from "@shared/schema";
import crypto from "crypto";
import { z } from "zod";
import { buildLaunchRequestBody, triggerN8nWebhook } from "./n8n";
import {
  parseOAuthClientJson,
  createOAuthState,
  verifyOAuthState,
  buildGoogleAuthUrl,
  exchangeCodeForTokens,
  performRawSheetCheck,
} from "./google";

// The OAuth client file the user downloaded from Google Cloud Console.
// GOOGLE_SERVICE_ACCOUNT_JSON is a legacy fallback — the same file was first
// saved under that (misleading) name.
function getGoogleClient() {
  return parseOAuthClientJson(
    process.env.GOOGLE_OAUTH_CLIENT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
  );
}

// Generate secure token
function generateSecureToken(): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return token;
}

// Create a stateless token with timestamp and signature (for temporary tokens)
function createStatelessToken(apiKey: string): string {
  const timestamp = Date.now();
  const payload = `${timestamp}.${apiKey}`;
  const secret = process.env.API_KEY || 'temp-fallback';
  const signature = crypto.createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return `temp.${timestamp}.${signature}`;
}

// Verify stateless token
function verifyStatelessToken(token: string, expectedApiKey: string): boolean {
  try {
    if (!token.startsWith('temp.')) return false;
    
    const parts = token.substring(5).split('.'); // Remove 'temp.' prefix
    if (parts.length !== 2) return false;
    
    const [timestampStr, signature] = parts;
    const timestamp = parseInt(timestampStr);
    const now = Date.now();
    
    // Token expires after 30 days
    if (now - timestamp > 30 * 24 * 60 * 60 * 1000) return false;
    
    const payload = `${timestamp}.${expectedApiKey}`;
    const secret = process.env.API_KEY || 'temp-fallback';
    const expectedSignature = crypto.createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return signature === expectedSignature;
  } catch {
    return false;
  }
}

// Bearer Token Authentication Middleware
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      message: 'Unauthorized: Bearer token required'
    });
  }
  
  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  
  // Temporary session tokens are stateless: always enforce expiry via the signed
  // timestamp instead of trusting in-memory state (which would let a token outlive
  // its expiry window for as long as the server process stays alive).
  if (token.startsWith('temp.')) {
    const apiKey = process.env.API_KEY;
    if (apiKey && verifyStatelessToken(token, apiKey)) {
      return next();
    }
    return res.status(401).json({ 
      message: 'Unauthorized: Invalid token'
    });
  }
  
  // Check if it's a permanent API token
  try {
    const permanentToken = await storage.getApiTokenByToken(token);
    if (permanentToken) {
      // Update last used timestamp
      await storage.updateTokenLastUsed(token);
      return next();
    }
  } catch (error) {
    console.error('Error checking permanent token:', error);
  }
  
  return res.status(401).json({ 
    message: 'Unauthorized: Invalid token'
  });
}

function generateCode(format: string = "PROMO-XXXX"): string {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  
  return format.replace(/X/g, () => {
    return characters.charAt(Math.floor(Math.random() * characters.length));
  });
}

async function generateUniqueCode(format: string = "PROMO-XXXX"): Promise<string> {
  let code: string;
  let attempts = 0;
  const maxAttempts = 100;

  do {
    code = generateCode(format);
    attempts++;
    
    if (attempts > maxAttempts) {
      throw new Error("Unable to generate unique code after maximum attempts");
    }
  } while (await storage.getPromoCodeByCode(code));

  return code;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Login endpoint (no auth required)
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { apiKey } = req.body;
      
      // Verify the API key (stored securely in environment)
      const expectedApiKey = process.env.API_KEY;
      if (!expectedApiKey) {
        return res.status(500).json({ message: 'Server configuration error' });
      }
      if (apiKey !== expectedApiKey) {
        return res.status(401).json({ message: 'Invalid API key' });
      }
      
      // Generate stateless token instead of storing in memory
      const token = createStatelessToken(apiKey);

      res.json({ token, expiresIn: 30 * 24 * 60 * 60 });
    } catch (error) {
      res.status(400).json({ message: 'Invalid request' });
    }
  });
  
  // Apply Bearer token authentication to all other API routes
  app.use('/api', (req, res, next) => {
    // Skip auth for login endpoint
    if (req.path === '/auth/login') {
      return next();
    }
    // Skip Bearer auth for the n8n run callback — it authenticates with the
    // shared N8N_WEBHOOK_SECRET header instead (checked inside the route).
    if (req.path === '/campaign-runs/callback') {
      return next();
    }
    // Skip Bearer auth for the Google OAuth redirect target — the browser
    // arrives here straight from Google with no Authorization header. It is
    // protected by the HMAC-signed state parameter instead.
    if (req.path === '/google/callback') {
      return next();
    }
    requireAuth(req, res, next);
  });

  // Get all promo codes with pagination and search
  app.get("/api/promo-codes", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100; // Default to 100 records per page
      const search = req.query.search as string || '';
      const campaign = req.query.campaign as string || '';
      const status = req.query.status as string || '';
      const discount = req.query.discount as string || '';
      
      // Handle export=all parameter for downloading all codes
      if (req.query.export === 'all') {
        const codes = await storage.getAllPromoCodes();
        return res.json(codes);
      }
      
      // If no pagination requested, use legacy behavior but with warning
      if (!req.query.page && !req.query.limit) {
        const codes = await storage.getAllPromoCodes();
        if (codes.length > 1000) {
          res.setHeader('X-Warning', 'Large dataset detected. Consider using pagination: ?page=1&limit=100');
        }
        return res.json(codes);
      }
      
      const result = await storage.getPaginatedPromoCodes({
        page,
        limit: Math.min(limit, 100000), // Support up to 100K codes
        search,
        campaign,
        status,
        discount
      });
      
      res.json(result);
    } catch (error) {
      console.error('Error fetching promo codes:', error);
      res.status(500).json({ message: "Failed to fetch promo codes" });
    }
  });

  // Create a single promo code with specific code value
  app.post("/api/promo-codes", async (req, res) => {
    try {
      const validation = insertPromoCodeSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid promo code data", 
          errors: validation.error.errors 
        });
      }

      const promoCodeData = validation.data;
      const createdCode = await storage.createPromoCode({
        ...promoCodeData,
        expiresAt: promoCodeData.expiresAt ? new Date(promoCodeData.expiresAt) : undefined
      });
      
      res.status(201).json(createdCode);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("unique constraint") || error.message.includes("duplicate") || error.message.includes("already exists")) {
          return res.status(409).json({ message: "Code already exists" });
        }
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to create promo code" });
      }
    }
  });

  // Get promo code stats
  app.get("/api/promo-codes/stats", async (req, res) => {
    try {
      const stats = await storage.getPromoCodeStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Generate a single promo code
  app.post("/api/promo-codes/generate", async (req, res) => {
    try {
      const { format = "PROMO-XXXX", campaignName, discountValue, expiresAt } = req.body;
      const parsedExpiry = parseExpiresAt(expiresAt);
      if (!parsedExpiry.ok) {
        return res.status(400).json({ message: 'Invalid expiresAt. Send an ISO date like 2026-01-31T00:00:00Z, or "", null or "null" for no expiry.' });
      }
      const code = await generateUniqueCode(format);
      
      const validation = insertPromoCodeSchema.safeParse({ 
        code, 
        campaignName, 
        discountValue, 
        expiresAt: parsedExpiry.value 
      });
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid code format" });
      }

      const promoCode = await storage.createPromoCode({ 
        code, 
        campaignName, 
        discountValue, 
        expiresAt: parsedExpiry.value 
      });
      res.json(promoCode);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to generate promo code" 
      });
    }
  });

  // Generate bulk promo codes
  app.post("/api/promo-codes/generate-bulk", async (req, res) => {
    try {
      const validation = bulkGenerateSchema.safeParse(req.body);
      if (!validation.success) {
        console.error("Bulk generation validation error:", validation.error);
        return res.status(400).json({ 
          message: "Invalid bulk generation parameters",
          errors: validation.error.issues 
        });
      }

      const { count, format, campaignName, discountValue, expiresAt } = validation.data;
      const codes: string[] = [];

      // Generate unique codes
      for (let i = 0; i < count; i++) {
        const code = await generateUniqueCode(format);
        codes.push(code);
      }

      const insertData = codes.map(code => ({ 
        code, 
        campaignName, 
        discountValue, 
        expiresAt: expiresAt ? new Date(expiresAt) : undefined 
      }));
      const promoCodes = await storage.createBulkPromoCodes(insertData);
      res.json(promoCodes);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to generate bulk promo codes" 
      });
    }
  });

  // Mark a promo code as used
  app.patch("/api/promo-codes/:code/redeem", async (req, res) => {
    try {
      const { code } = req.params;
      const promoCode = await storage.markPromoCodeAsUsed(code);
      
      if (!promoCode) {
        return res.status(404).json({ message: "Promo code not found or already used" });
      }

      res.json(promoCode);
    } catch (error) {
      res.status(500).json({ message: "Failed to redeem promo code" });
    }
  });

  // Generate campaign codes
  app.post("/api/promo-codes/generate-campaign", async (req, res) => {
    try {
      const validation = campaignGenerateSchema.safeParse(req.body);
      if (!validation.success) {
        console.error("Campaign generation validation error:", validation.error);
        return res.status(400).json({ 
          message: "Invalid campaign parameters",
          errors: validation.error.issues 
        });
      }

      const { campaignName, discountValue, count, format, expiresAt } = validation.data;
      const codes: string[] = [];

      // Generate unique codes
      for (let i = 0; i < count; i++) {
        const code = await generateUniqueCode(format);
        codes.push(code);
      }

      const insertData = codes.map(code => ({ 
        code, 
        campaignName, 
        discountValue, 
        expiresAt: expiresAt ? new Date(expiresAt) : undefined 
      }));
      const promoCodes = await storage.createBulkPromoCodes(insertData);
      res.json(promoCodes);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to generate campaign codes" 
      });
    }
  });

  // Get campaigns
  app.get("/api/campaigns", async (req, res) => {
    try {
      const campaigns = await storage.getCampaigns();
      res.json(campaigns);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });

  // Validate a promo code
  app.get("/api/promo-codes/:code/validate", async (req, res) => {
    try {
      const { code } = req.params;
      const promoCode = await storage.getPromoCodeByCode(code);
      
      if (!promoCode) {
        return res.status(404).json({ message: "Promo code not found" });
      }

      // Check if expired
      const now = new Date();
      const isExpired = promoCode.expiresAt && promoCode.expiresAt < now;
      const isValid = promoCode.status === "unused" && !isExpired;

      res.json({ 
        valid: isValid,
        status: isExpired ? "expired" : promoCode.status,
        promoCode 
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to validate promo code" });
    }
  });

  // Delete all promo codes for optimization.
  // Must be registered BEFORE the "/:code" route below, otherwise Express
  // matches "all" as a :code param and this handler never runs.
  app.delete("/api/promo-codes/all", async (req, res) => {
    try {
      const deletedCount = await storage.deleteAllPromoCodes();
      res.json({ 
        message: `All ${deletedCount} promo codes deleted successfully`, 
        deletedCount 
      });
    } catch (error) {
      console.error("Delete all codes error:", error);
      res.status(500).json({ 
        message: "Failed to delete all promo codes",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Delete a promo code
  app.delete("/api/promo-codes/:code", async (req, res) => {
    try {
      const { code } = req.params;
      const deleted = await storage.deletePromoCode(code);
      
      if (!deleted) {
        return res.status(404).json({ message: "Promo code not found" });
      }

      res.json({ message: "Promo code deleted successfully", code });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete promo code" });
    }
  });

  // Delete multiple promo codes
  app.delete("/api/promo-codes", async (req, res) => {
    try {
      const { codes } = req.body;
      if (!Array.isArray(codes) || codes.length === 0) {
        return res.status(400).json({ message: "Invalid codes array" });
      }

      const deletedCount = await storage.deleteBulkPromoCodes(codes);
      res.json({ 
        message: `${deletedCount} promo codes deleted successfully`, 
        deletedCount 
      });
    } catch (error) {
      console.error("Bulk delete error:", error);
      res.status(500).json({ 
        message: "Failed to delete promo codes",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Advanced bulk delete by filters
  app.post("/api/promo-codes/delete-by-filters", async (req, res) => {
    try {
      // Validate using Zod schema - parse() throws on validation failure
      const filters = deleteBulkByFiltersSchema.parse(req.body);
      
      // Pass validated, sanitized data directly to storage without revalidation
      const deletedCount = await storage.deleteBulkByFilters(filters);
      
      res.json({ 
        message: `${deletedCount} promo codes deleted successfully`, 
        deletedCount,
        filters
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: error.errors[0]?.message || "Invalid filter parameters",
          errors: error.errors
        });
      }
      console.error("Delete by filters error:", error);
      res.status(500).json({ 
        message: "Failed to delete promo codes by filters",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Toggle promo code status
  app.patch("/api/promo-codes/:code/toggle-status", async (req, res) => {
    try {
      const { code } = req.params;
      const promoCode = await storage.getPromoCodeByCode(code);
      
      if (!promoCode) {
        return res.status(404).json({ message: "Promo code not found" });
      }

      // Toggle between unused and used (don't allow toggling expired codes)
      if (promoCode.status === "expired") {
        return res.status(400).json({ message: "Cannot toggle expired promo codes" });
      }

      const newStatus = promoCode.status === "unused" ? "used" : "unused";
      const updatedPromoCode = await storage.togglePromoCodeStatus(code, newStatus);
      
      res.json({
        message: `Promo code status changed to ${newStatus}`,
        promoCode: updatedPromoCode
      });
    } catch (error) {
      console.error("Toggle status error:", error);
      res.status(500).json({ 
        message: "Failed to toggle promo code status",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Import promo codes from CSV
  app.post("/api/promo-codes/import", async (req, res) => {
    try {
      const validation = csvImportSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid import data", 
          errors: validation.error.errors 
        });
      }

      const { codes } = validation.data;
      
      // Convert the data to the correct format for storage
      const insertData = codes.map(code => ({
        code: code.code,
        campaignName: code.campaignName || undefined,
        discountValue: code.discountValue || undefined,
        expiresAt: code.expiresAt ? new Date(code.expiresAt) : undefined,
      }));

      const result = await storage.importPromoCodes(insertData);
      
      res.json({
        message: `Import completed: ${result.imported} imported, ${result.skipped} skipped`,
        ...result
      });
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to import promo codes" 
      });
    }
  });

  // Campaign stats endpoint
  app.get('/api/campaigns/stats', async (req, res) => {
    try {
      const campaignStats = await storage.getCampaignStats();
      res.json(campaignStats);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch campaign stats' });
    }
  });

  // Permanent API Token endpoints
  app.get('/api/tokens', async (req, res) => {
    try {
      const tokens = await storage.getAllApiTokens();
      res.json(tokens);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch tokens' });
    }
  });

  app.post('/api/tokens', async (req, res) => {
    try {
      const validation = apiTokenGenerateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: 'Invalid token data' });
      }

      const token = await storage.createApiToken(validation.data);
      res.json(token);
    } catch (error) {
      res.status(500).json({ message: 'Failed to create token' });
    }
  });

  app.delete('/api/tokens/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteApiToken(id);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Token not found' });
      }
      
      res.json({ message: 'Token deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete token' });
    }
  });

  // ===========================================================================
  // Email Campaigns ("Campaigns" tab) — triggers external n8n cold-email flows.
  // Namespaced under /api/email-campaigns so it never collides with the promo
  // /api/campaigns and /api/campaigns/stats endpoints above.
  // ===========================================================================
  app.get("/api/email-campaigns", async (_req, res) => {
    try {
      const campaigns = await storage.getEmailCampaigns();
      res.json(campaigns);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to fetch campaigns" });
    }
  });

  app.post("/api/email-campaigns", async (req, res) => {
    try {
      const validation = insertEmailCampaignSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid campaign data", errors: validation.error.errors });
      }
      const created = await storage.createEmailCampaign(validation.data);
      res.status(201).json(created);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to create campaign" });
    }
  });

  app.patch("/api/email-campaigns/:id", async (req, res) => {
    try {
      const validation = updateEmailCampaignSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid campaign data", errors: validation.error.errors });
      }
      const updated = await storage.updateEmailCampaign(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to update campaign" });
    }
  });

  // Delete a campaign. Launch history is intentionally untouched — each launch
  // row snapshots the campaign name, so the History tab keeps showing it.
  app.delete("/api/email-campaigns/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteEmailCampaign(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json({ message: "Campaign deleted" });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to delete campaign" });
    }
  });

  // Launch / Relaunch: fire the right n8n webhook server-side (secrets stay
  // hidden), then mark launched. "launch" runs the normal workflow (processes
  // new leads first); "relaunch" hits the separate Campaign Relaunch workflow
  // (skips lead processing, re-sends to existing leads with the current
  // scripts). Same payload shape and same X-Trigger-Secret header for both —
  // only the URL and secret value differ.
  const fireCampaignWebhook = async (req: any, res: any, mode: "launch" | "relaunch") => {
    try {
      const campaign = await storage.getEmailCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      const webhookUrl =
        mode === "relaunch" ? process.env.N8N_RELAUNCH_WEBHOOK_URL : process.env.N8N_WEBHOOK_URL;
      const secret =
        mode === "relaunch" ? process.env.N8N_RELAUNCH_WEBHOOK_SECRET : process.env.N8N_WEBHOOK_SECRET; // optional — only used if your n8n webhook has Header Auth
      if (!webhookUrl) {
        return res.status(503).json({
          message:
            mode === "relaunch"
              ? "Relaunching isn't configured yet. Add your n8n relaunch webhook URL (N8N_RELAUNCH_WEBHOOK_URL)."
              : "Campaign launching isn't configured yet. Add your n8n webhook URL (N8N_WEBHOOK_URL).",
        });
      }

      // Guard legacy/migrated rows: a campaign must have a Document ID and at
      // least 2 Sheet IDs before it can launch with a valid payload.
      if (!campaign.documentId || !campaign.sheetIds || campaign.sheetIds.length < 2) {
        return res.status(400).json({
          message:
            "This campaign needs a Document ID and at least 2 Sheet IDs before it can launch. Open it, add them, then try again.",
        });
      }

      // The raw-leads Sheet ID must be set, so n8n knows where to pull
      // unprocessed leads from.
      if (!campaign.rawSheetId?.trim()) {
        return res.status(400).json({
          message:
            "This campaign needs a Raw leads Sheet ID before it can launch. Open it, add the raw sheet's gid, then try again.",
        });
      }

      // Both main scripts (one per list) must be filled in, otherwise a list
      // in the payload would have no message and n8n would email nobody on it.
      const scripts = campaign.mainScripts ?? [];
      if (scripts.length < 2 || scripts.some((s) => !s?.trim())) {
        return res.status(400).json({
          message: `Both main scripts ("${LIST_LABELS[0]}" and "${LIST_LABELS[1]}") must be filled in before launching. Open the campaign, add them, then try again.`,
        });
      }

      // The launch record's id doubles as the runId n8n reports back with, so
      // it's generated up front and sent along in the payload.
      const runId = crypto.randomUUID();
      const callbackUrl = `${req.protocol}://${req.get("host")}/api/campaign-runs/callback`;
      const payload = {
        ...buildLaunchRequestBody(campaign, mode),
        runId,
        callbackUrl,
      };
      const result = await triggerN8nWebhook(webhookUrl, secret, payload);

      // Record every launch attempt (success OR failure) in the history. When
      // the webhook was accepted, the workflow is now running — mark the run
      // "in_progress" until n8n calls back to say it finished or failed.
      await storage.createEmailCampaignLaunch({
        id: runId,
        campaignId: campaign.id,
        campaignName: campaign.campaignName,
        status: result.ok ? "success" : "failed",
        detail: result.detail ?? result.message ?? null,
        launchType: mode,
        runStatus: result.ok ? "in_progress" : null,
      });

      if (!result.ok) {
        return res.status(502).json({
          message: result.message || "The automation service rejected the request",
          status: result.status,
          detail: result.detail,
        });
      }

      const updated = await storage.markEmailCampaignLaunched(campaign.id);
      res.json({
        message: result.message || (mode === "relaunch" ? "Campaign relaunched" : "Campaign launched"),
        detail: result.detail,
        campaign: updated,
      });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to launch campaign" });
    }
  };

  app.post("/api/email-campaigns/:id/launch", (req, res) => fireCampaignWebhook(req, res, "launch"));
  app.post("/api/email-campaigns/:id/relaunch", (req, res) => fireCampaignWebhook(req, res, "relaunch"));

  // ==========================================================================
  // Google Sheets connection (raw-sheet row check before a launch)
  // ==========================================================================

  // Is a Google account connected? (Bearer-protected by the /api middleware.)
  app.get("/api/google/status", async (_req, res) => {
    try {
      const tokens = await storage.getGoogleTokens();
      res.json({ connected: !!tokens, email: tokens?.connectedEmail ?? null });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to check Google connection" });
    }
  });

  // Returns the Google consent-screen URL. The frontend redirects the browser
  // there; Google sends the user back to /api/google/callback.
  app.get("/api/google/auth-url", async (req, res) => {
    try {
      const client = getGoogleClient();
      if (!client) {
        return res.status(503).json({
          message: "Google connection isn't configured yet. Add the OAuth client file (GOOGLE_OAUTH_CLIENT_JSON).",
        });
      }
      const redirectUri = `${req.protocol}://${req.get("host")}/api/google/callback`;
      const state = await createOAuthState(client.clientSecret);
      res.json({ url: buildGoogleAuthUrl(client.clientId, redirectUri, state) });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to build Google auth URL" });
    }
  });

  // Google redirects here after consent. No Bearer token (browser redirect) —
  // the HMAC-signed state param proves the flow started on our server.
  app.get("/api/google/callback", async (req, res) => {
    try {
      const client = getGoogleClient();
      if (!client) return res.redirect("/campaigns?google=error");
      // User clicked "Cancel" on the consent screen, or Google errored.
      if (req.query.error || typeof req.query.code !== "string") {
        return res.redirect("/campaigns?google=error");
      }
      const stateOk = await verifyOAuthState(
        typeof req.query.state === "string" ? req.query.state : null,
        client.clientSecret,
      );
      if (!stateOk) return res.redirect("/campaigns?google=error");

      const redirectUri = `${req.protocol}://${req.get("host")}/api/google/callback`;
      const result = await exchangeCodeForTokens(client, req.query.code, redirectUri);
      if (!result.ok) return res.redirect("/campaigns?google=error");

      // Google only returns a refresh_token on the first consent (we force it
      // with prompt=consent, but keep the old one as a fallback anyway).
      const existing = await storage.getGoogleTokens();
      const refreshToken = result.refreshToken ?? existing?.refreshToken;
      if (!refreshToken) return res.redirect("/campaigns?google=error");

      await storage.saveGoogleTokens({
        refreshToken,
        accessToken: result.accessToken,
        accessTokenExpiresAt: result.expiresAt,
        connectedEmail: result.email ?? existing?.connectedEmail ?? null,
      });
      res.redirect("/campaigns?google=connected");
    } catch (error) {
      console.error("Google OAuth callback failed:", error);
      res.redirect("/campaigns?google=error");
    }
  });

  // Counts data rows in the campaign's raw-leads tab. Purely informational —
  // the launch dialog shows the result but never blocks the launch.
  app.get("/api/email-campaigns/:id/raw-sheet-count", async (req, res) => {
    try {
      const campaign = await storage.getEmailCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      if (!campaign.documentId || !campaign.rawSheetId?.trim()) {
        return res.status(400).json({ message: "This campaign has no Document ID or Raw leads Sheet ID." });
      }
      const client = getGoogleClient();
      if (!client) {
        return res.status(503).json({
          message: "Google connection isn't configured yet. Add the OAuth client file (GOOGLE_OAUTH_CLIENT_JSON).",
        });
      }
      const result = await performRawSheetCheck(storage, client, campaign.documentId, campaign.rawSheetId.trim());
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to check the raw sheet" });
    }
  });

  // Called BY n8n when a workflow run ends (last node or Error Trigger).
  // Authenticated with the shared secret header, not a Bearer token.
  app.post("/api/campaign-runs/callback", async (req, res) => {
    try {
      // Either workflow may call back — the launch one authenticates with
      // N8N_WEBHOOK_SECRET, the relaunch one with N8N_RELAUNCH_WEBHOOK_SECRET.
      const validSecrets = [process.env.N8N_WEBHOOK_SECRET, process.env.N8N_RELAUNCH_WEBHOOK_SECRET].filter(
        (s): s is string => !!s,
      );
      if (validSecrets.length === 0) {
        return res.status(503).json({ message: "Run callbacks are not configured (missing N8N_WEBHOOK_SECRET)." });
      }
      const provided = req.get("X-Callback-Secret");
      if (!provided || !validSecrets.includes(provided)) {
        return res.status(401).json({ message: "Invalid callback secret" });
      }

      const parsed = runCallbackSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid callback body" });
      }

      const { runId, status, campaignName, detail } = parsed.data;

      // The n8n Error Trigger workflow never sees the original launch payload,
      // so it can't send a runId. Fall back to the newest run that's still
      // in progress (optionally narrowed by campaignName) — with launches
      // fired manually one at a time, that's the run that just crashed.
      let targetId = runId ?? null;
      if (!targetId) {
        const launches = await storage.getEmailCampaignLaunches();
        const wanted = campaignName?.trim().toLowerCase();
        const candidate = launches
          .filter((l) => l.runStatus === "in_progress")
          .filter((l) => !wanted || l.campaignName.trim().toLowerCase() === wanted)
          .sort((a, b) => new Date(b.launchedAt).getTime() - new Date(a.launchedAt).getTime())[0];
        if (!candidate) {
          return res.status(404).json({
            message: campaignName
              ? `No in-progress run found for campaign "${campaignName}"`
              : "No in-progress run found to update",
          });
        }
        targetId = candidate.id;
      }

      const updated = await storage.completeEmailCampaignRun(targetId, status, detail ?? null);
      if (!updated) {
        return res.status(404).json({ message: "No launch found for that runId" });
      }
      res.json({ message: "Run status updated", runId: updated.id, runStatus: updated.runStatus });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to update run status" });
    }
  });

  app.get("/api/email-campaign-launches", async (_req, res) => {
    try {
      const launches = await storage.getEmailCampaignLaunches();
      res.json(launches);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to fetch launch history" });
    }
  });

  app.get("/api/email-campaign-templates", async (_req, res) => {
    try {
      const templates = await storage.getEmailCampaignTemplates();
      res.json(templates);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to fetch templates" });
    }
  });

  app.post("/api/email-campaign-templates", async (req, res) => {
    try {
      const validation = insertEmailCampaignTemplateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid template data", errors: validation.error.errors });
      }
      const created = await storage.createEmailCampaignTemplate(validation.data);
      res.status(201).json(created);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to create template" });
    }
  });

  app.delete("/api/email-campaign-templates/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteEmailCampaignTemplate(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json({ message: "Template deleted" });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to delete template" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
