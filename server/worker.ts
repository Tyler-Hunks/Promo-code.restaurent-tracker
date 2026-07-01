// Cloudflare Worker entry point
import { storage } from "./storage-cloudflare";
import { insertPromoCodeSchema, bulkGenerateSchema, apiTokenGenerateSchema, deleteBulkByFiltersSchema, insertEmailCampaignSchema, updateEmailCampaignSchema, insertEmailCampaignTemplateSchema } from "../shared/schema";
import { z } from "zod";
import { buildLaunchRequestBody, triggerN8nWebhook } from "./n8n";

// Types for Cloudflare Worker environment
interface Env {
  DATABASE_URL: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  API_KEY: string;
  // n8n webhook for the Campaigns tab (set via `wrangler secret put`).
  N8N_WEBHOOK_URL?: string;
  N8N_WEBHOOK_SECRET?: string;
}

// Serve static files (built React app)
async function handleStatic(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url);
  
  // Try to serve the asset first
  try {
    const asset = await env.ASSETS.fetch(request);
    if (asset.status !== 404) {
      return asset;
    }
  } catch (error) {
    console.log('Asset fetch error:', error);
  }
  
  // For SPA routing - serve index.html for non-asset routes
  if (!url.pathname.includes('.') || url.pathname === '/') {
    try {
      const indexRequest = new Request(new URL('/index.html', request.url), request);
      return await env.ASSETS.fetch(indexRequest);
    } catch (error) {
      console.log('Index.html fetch error:', error);
      // Fallback HTML if assets don't work
      return new Response(
        `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Promo Code Manager</title>
</head>
<body>
  <div id="root"></div>
  <p>Loading application...</p>
</body>
</html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }
  }
  
  return new Response('Not found', { status: 404 });
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
async function createStatelessToken(apiKey: string): Promise<string> {
  const timestamp = Date.now();
  const payload = `${timestamp}.${apiKey}`;
  const secret = apiKey; // Use the API key itself as secret for workers
  
  // Use Web Crypto API for HMAC
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    messageData
  );
  
  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
    
  return `temp.${timestamp}.${signatureHex}`;
}

// Verify stateless token
async function verifyStatelessToken(token: string, expectedApiKey: string): Promise<boolean> {
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
    const secret = expectedApiKey; // Use the API key itself as secret for workers
    
    // Use Web Crypto API for HMAC verification
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(payload);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const expectedSignatureBuffer = await crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      messageData
    );
    
    const expectedSignature = Array.from(new Uint8Array(expectedSignatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return signature === expectedSignature;
  } catch {
    return false;
  }
}

// Bearer Token Authentication
async function requireAuth(request: Request, env: Env) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ 
      message: 'Unauthorized: Bearer token required'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
  
  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  
  // Temporary session tokens are stateless: always enforce expiry via the signed
  // timestamp instead of trusting in-memory state (which would let a token outlive
  // its expiry window for as long as the isolate stays alive).
  if (token.startsWith('temp.')) {
    const apiKey = env.API_KEY;
    if (apiKey && await verifyStatelessToken(token, apiKey)) {
      return null;
    }
    return new Response(JSON.stringify({ 
      message: 'Unauthorized: Invalid token'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
  
  // Check if it's a permanent API token
  try {
    const storageInstance = storage(env);
    const permanentToken = await storageInstance.getApiTokenByToken(token);
    if (permanentToken) {
      // Update last used timestamp
      await storageInstance.updateTokenLastUsed(token);
      return null;
    }
  } catch (error) {
    console.error('Error checking permanent token:', error);
  }
  
  return new Response(JSON.stringify({ 
    message: 'Unauthorized: Invalid token'
  }), {
    status: 401,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

// CORS headers with no-cache for API responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
};

// Code generation utilities
function generateCode(format: string = "PROMO-XXXX"): string {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return format.replace(/X/g, () => {
    return characters.charAt(Math.floor(Math.random() * characters.length));
  });
}

async function generateUniqueCode(format: string, env: Env): Promise<string> {
  let code: string;
  let attempts = 0;
  const maxAttempts = 100;
  const storageInstance = storage(env);

  do {
    code = generateCode(format);
    attempts++;
    
    if (attempts > maxAttempts) {
      throw new Error("Unable to generate unique code after maximum attempts");
    }
  } while (await storageInstance.getPromoCodeByCode(code));

  return code;
}

// Handle API routes
async function handleAPI(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Handle login endpoint (no auth required)
  if (path === '/api/auth/login' && method === 'POST') {
    try {
      const body = await request.json() as any;
      const { apiKey } = body;
      
      // Verify the API key (stored securely in Worker env)
      if (apiKey !== env.API_KEY) {
        return new Response(JSON.stringify({ message: 'Invalid API key' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Generate stateless token
      const token = await createStatelessToken(body.apiKey);

      return new Response(JSON.stringify({ token, expiresIn: 30 * 24 * 60 * 60 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ message: 'Invalid request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
  
  // Check Bearer token for all other API routes
  const authError = await requireAuth(request, env);
  if (authError) return authError;

  const storageInstance = storage(env);

  try {
    // Route handling  
    if (path === '/api/promo-codes' && method === 'GET') {
      const urlParams = new URLSearchParams(url.search);
      const page = parseInt(urlParams.get('page') || '1');
      const limit = parseInt(urlParams.get('limit') || '100');
      const search = urlParams.get('search') || '';
      const campaign = urlParams.get('campaign') || '';
      const status = urlParams.get('status') || '';
      const discount = urlParams.get('discount') || '';
      
      console.log('Promo codes request params:', { page, limit, search, campaign, status, discount });
      
      // Handle export=all parameter for downloading all codes
      if (urlParams.get('export') === 'all') {
        console.log('Export all codes requested');
        const codes = await storageInstance.getAllPromoCodes();
        return new Response(JSON.stringify(codes), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Always use pagination when page or limit is provided
      const usePagination = urlParams.has('page') || urlParams.has('limit');
      console.log('Pagination check:', { usePagination, hasPage: urlParams.has('page'), hasLimit: urlParams.has('limit') });
      
      if (!usePagination) {
        console.log('No pagination - returning all codes');
        const codes = await storageInstance.getAllPromoCodes();
        return new Response(JSON.stringify(codes), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      console.log('Using pagination with params:', { page, limit });
      const result = await storageInstance.getPaginatedPromoCodes({
        page,
        limit: Math.min(limit, 100000),
        search,
        campaign,
        status,
        discount
      });
      
      console.log('Pagination result:', { dataLength: result.data.length, total: result.total, page: result.page });
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (path === '/api/promo-codes/stats' && method === 'GET') {
      const stats = await storageInstance.getPromoCodeStats();
      return new Response(JSON.stringify(stats), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (path === '/api/campaigns' && method === 'GET') {
      try {
        const campaigns = await storageInstance.getCampaigns();
        console.log('Campaigns fetched:', campaigns);
        return new Response(JSON.stringify(campaigns), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error in /api/campaigns:', error);
        return new Response(JSON.stringify({ 
          message: 'Failed to fetch campaigns',
          error: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (path === '/api/campaigns/stats' && method === 'GET') {
      const campaignStats = await storageInstance.getCampaignStats();
      return new Response(JSON.stringify(campaignStats), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (path === '/api/promo-codes/generate' && method === 'POST') {
      const body = await request.json();
      const { format = "PROMO-XXXX", campaignName, discountValue, expiresAt } = body;
      const code = await generateUniqueCode(format, env);
      
      const promoCode = await storageInstance.createPromoCode({ 
        code, 
        campaignName, 
        discountValue, 
        expiresAt: expiresAt ? new Date(expiresAt) : undefined
      });
      
      return new Response(JSON.stringify(promoCode), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (path === '/api/promo-codes/generate-bulk' && method === 'POST') {
      const body = await request.json();
      const { count, format, campaignName, discountValue, expiresAt } = body;
      const codes: string[] = [];

      // Generate unique codes
      for (let i = 0; i < count; i++) {
        const code = await generateUniqueCode(format, env);
        codes.push(code);
      }

      const insertData = codes.map(code => ({ 
        code, 
        campaignName, 
        discountValue, 
        expiresAt: expiresAt ? new Date(expiresAt) : undefined 
      }));
      
      const promoCodes = await storageInstance.createBulkPromoCodes(insertData);
      return new Response(JSON.stringify(promoCodes), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (path === '/api/promo-codes/generate-campaign' && method === 'POST') {
      const body = await request.json();
      const { campaignName, discountValue, count, format, expiresAt } = body;
      const codes: string[] = [];

      // Generate unique codes
      for (let i = 0; i < count; i++) {
        const code = await generateUniqueCode(format, env);
        codes.push(code);
      }

      const insertData = codes.map(code => ({ 
        code, 
        campaignName, 
        discountValue, 
        expiresAt: expiresAt ? new Date(expiresAt) : undefined 
      }));
      
      const promoCodes = await storageInstance.createBulkPromoCodes(insertData);
      return new Response(JSON.stringify(promoCodes), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Redeem promo code
    if (path.startsWith('/api/promo-codes/') && path.endsWith('/redeem') && method === 'PATCH') {
      const code = path.split('/')[3];
      const updated = await storageInstance.markPromoCodeAsUsed(code);
      
      if (!updated) {
        return new Response(JSON.stringify({ message: "Promo code not found or already used" }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ message: "Promo code redeemed successfully", promoCode: updated }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Toggle promo code status
    if (path.startsWith('/api/promo-codes/') && path.endsWith('/toggle-status') && method === 'PATCH') {
      const code = path.split('/')[3];
      const promoCode = await storageInstance.getPromoCodeByCode(code);
      
      if (!promoCode) {
        return new Response(JSON.stringify({ message: "Promo code not found" }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (promoCode.status === "expired") {
        return new Response(JSON.stringify({ message: "Cannot toggle expired promo codes" }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const newStatus = promoCode.status === "unused" ? "used" : "unused";
      const updatedPromoCode = await storageInstance.togglePromoCodeStatus(code, newStatus);
      
      return new Response(JSON.stringify({
        message: `Promo code status changed to ${newStatus}`,
        promoCode: updatedPromoCode
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Delete single promo code
    if (path.startsWith('/api/promo-codes/') && !path.includes('/redeem') && !path.includes('/toggle-status') && !path.includes('/delete-by-filters') && method === 'DELETE') {
      const code = path.split('/')[3];
      const deleted = await storageInstance.deletePromoCode(code);
      
      if (!deleted) {
        return new Response(JSON.stringify({ message: "Promo code not found" }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ message: "Promo code deleted successfully", code }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Advanced bulk delete by filters
    if (path === '/api/promo-codes/delete-by-filters' && method === 'POST') {
      try {
        const body = await request.json();
        console.log('Delete by filters request:', body);
        
        // Validate using Zod schema
        const filters = deleteBulkByFiltersSchema.parse(body);
        console.log('Validated filters:', filters);
        
        // Delete codes matching filters
        const deletedCount = await storageInstance.deleteBulkByFilters(filters);
        console.log('Deleted count:', deletedCount);
        
        return new Response(JSON.stringify({ 
          message: `${deletedCount} promo codes deleted successfully`, 
          deletedCount,
          filters
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Delete by filters error:', error);
        if (error instanceof Error && error.name === 'ZodError') {
          return new Response(JSON.stringify({ 
            message: 'Invalid filter parameters',
            error: error.message
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        return new Response(JSON.stringify({ 
          message: 'Failed to delete promo codes by filters',
          error: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Token management endpoints
    if (path === '/api/tokens' && method === 'GET') {
      const tokens = await storageInstance.getAllApiTokens();
      return new Response(JSON.stringify(tokens), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (path === '/api/tokens' && method === 'POST') {
      const body = await request.json() as any;
      const validation = apiTokenGenerateSchema.safeParse(body);
      if (!validation.success) {
        return new Response(JSON.stringify({ message: 'Invalid token data' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const token = await storageInstance.createApiToken(validation.data);
      return new Response(JSON.stringify(token), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (path.startsWith('/api/tokens/') && method === 'DELETE') {
      const id = path.split('/').pop();
      if (!id) {
        return new Response(JSON.stringify({ message: 'Token ID required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const deleted = await storageInstance.deleteApiToken(id);
      if (!deleted) {
        return new Response(JSON.stringify({ message: 'Token not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ message: 'Token deleted successfully' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ========================================================================
    // Email Campaigns ("Campaigns" tab) — mirrors the Express routes. Order
    // matters: exact collection paths first, then /:id/launch, then /:id PATCH.
    // ========================================================================
    if (path === '/api/email-campaigns' && method === 'GET') {
      const campaigns = await storageInstance.getEmailCampaigns();
      return new Response(JSON.stringify(campaigns), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (path === '/api/email-campaigns' && method === 'POST') {
      const body = await request.json() as any;
      const validation = insertEmailCampaignSchema.safeParse(body);
      if (!validation.success) {
        return new Response(JSON.stringify({ message: 'Invalid campaign data', errors: validation.error.errors }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const created = await storageInstance.createEmailCampaign(validation.data);
      return new Response(JSON.stringify(created), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (path.startsWith('/api/email-campaigns/') && path.endsWith('/launch') && method === 'POST') {
      const id = path.split('/')[3];
      const campaign = await storageInstance.getEmailCampaign(id);
      if (!campaign) {
        return new Response(JSON.stringify({ message: 'Campaign not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!env.N8N_WEBHOOK_URL) {
        return new Response(JSON.stringify({ message: "Campaign launching isn't configured yet. Add your n8n webhook URL (N8N_WEBHOOK_URL)." }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Guard legacy/migrated rows: a campaign must have a Document ID and at
      // least 2 Sheet IDs before it can launch with a valid payload.
      if (!campaign.documentId || !campaign.sheetIds || campaign.sheetIds.length < 2) {
        return new Response(JSON.stringify({
          message: "This campaign needs a Document ID and at least 2 Sheet IDs before it can launch. Open it, add them, then try again.",
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // There must be at least one non-empty main-script variant (Variant A),
      // otherwise the payload's `lists` would be empty and n8n would email nobody.
      if (!campaign.mainScripts?.some((s) => s?.trim())) {
        return new Response(JSON.stringify({
          message: "Add at least the Variant A main script before launching, so there's a message to send.",
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const payload = buildLaunchRequestBody(campaign);
      const result = await triggerN8nWebhook(env.N8N_WEBHOOK_URL, env.N8N_WEBHOOK_SECRET, payload);

      // Record every launch attempt (success OR failure) in the history.
      await storageInstance.createEmailCampaignLaunch({
        campaignId: campaign.id,
        campaignName: campaign.campaignName,
        status: result.ok ? 'success' : 'failed',
        detail: result.detail ?? result.message ?? null,
      });

      if (!result.ok) {
        return new Response(JSON.stringify({ message: result.message || 'The automation service rejected the request', status: result.status, detail: result.detail }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const updated = await storageInstance.markEmailCampaignLaunched(id);
      return new Response(JSON.stringify({ message: result.message || 'Campaign launched', detail: result.detail, campaign: updated }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (path === '/api/email-campaign-launches' && method === 'GET') {
      const launches = await storageInstance.getEmailCampaignLaunches();
      return new Response(JSON.stringify(launches), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (path.startsWith('/api/email-campaigns/') && method === 'PATCH') {
      const id = path.split('/')[3];
      const body = await request.json() as any;
      const validation = updateEmailCampaignSchema.safeParse(body);
      if (!validation.success) {
        return new Response(JSON.stringify({ message: 'Invalid campaign data', errors: validation.error.errors }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const updated = await storageInstance.updateEmailCampaign(id, validation.data);
      if (!updated) {
        return new Response(JSON.stringify({ message: 'Campaign not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify(updated), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (path === '/api/email-campaign-templates' && method === 'GET') {
      const templates = await storageInstance.getEmailCampaignTemplates();
      return new Response(JSON.stringify(templates), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (path === '/api/email-campaign-templates' && method === 'POST') {
      const body = await request.json() as any;
      const validation = insertEmailCampaignTemplateSchema.safeParse(body);
      if (!validation.success) {
        return new Response(JSON.stringify({ message: 'Invalid template data', errors: validation.error.errors }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const created = await storageInstance.createEmailCampaignTemplate(validation.data);
      return new Response(JSON.stringify(created), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ message: 'Route not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ 
      message: error instanceof Error ? error.message : 'Internal Server Error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Main Worker export
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Route API calls
    if (url.pathname.startsWith('/api/')) {
      return handleAPI(request, env);
    }
    
    // Serve static files (React app)
    return handleStatic(request, env);
  },
};