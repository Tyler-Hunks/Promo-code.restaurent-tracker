import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPromoCodeSchema, bulkGenerateSchema, campaignGenerateSchema, csvImportSchema, type BulkGenerate, type CampaignGenerate, type CsvImport } from "@shared/schema";

// API Key Authentication Middleware
function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  const expectedApiKey = process.env.API_KEY || 'promo-manager-2024-secure-key';
  
  if (!apiKey || apiKey !== expectedApiKey) {
    return res.status(401).json({ 
      message: 'Unauthorized: Valid API key required',
      hint: 'Include x-api-key header with your request'
    });
  }
  
  next();
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
  // Apply API key authentication to all API routes
  app.use('/api', requireApiKey);

  // Get all promo codes
  app.get("/api/promo-codes", async (req, res) => {
    try {
      const codes = await storage.getAllPromoCodes();
      res.json(codes);
    } catch (error) {
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
        return res.status(400).json({ message: "Invalid bulk generation parameters" });
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
        return res.status(400).json({ message: "Invalid campaign parameters" });
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
      res.status(500).json({ message: "Failed to delete promo codes" });
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

  const httpServer = createServer(app);
  return httpServer;
}
