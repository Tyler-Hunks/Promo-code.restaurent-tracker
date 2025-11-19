import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPromoCodeSchema, bulkGenerateSchema, campaignGenerateSchema, csvImportSchema, apiTokenGenerateSchema, deleteBulkByFiltersSchema, type BulkGenerate, type CampaignGenerate, type CsvImport, type ApiTokenGenerate } from "@shared/schema";
import crypto from "crypto";
import { z } from "zod";

// Generate secure token
function generateSecureToken(): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return token;
}

// Store active tokens (in production, use KV storage)
const activeTokens = new Set<string>();

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
    
    // Token expires after 24 hours
    if (now - timestamp > 24 * 60 * 60 * 1000) return false;
    
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
  
  // Check if it's a temporary session token (both in-memory and stateless)
  if (activeTokens.has(token)) {
    return next();
  }
  
  // Check if it's a stateless temporary token
  if (token.startsWith('temp.')) {
    const apiKey = process.env.API_KEY;
    if (apiKey && verifyStatelessToken(token, apiKey)) {
      return next();
    }
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
      // Still add to activeTokens for backward compatibility during this session
      activeTokens.add(token);
      
      res.json({ token, expiresIn: 86400 });
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
      const code = await generateUniqueCode(format);
      
      const validation = insertPromoCodeSchema.safeParse({ 
        code, 
        campaignName, 
        discountValue, 
        expiresAt 
      });
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid code format" });
      }

      const promoCode = await storage.createPromoCode({ 
        code, 
        campaignName, 
        discountValue, 
        expiresAt 
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

  // Delete all promo codes for optimization
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

  const httpServer = createServer(app);
  return httpServer;
}
