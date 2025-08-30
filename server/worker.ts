// Cloudflare Worker entry point
import { storage } from "./storage-cloudflare";
import { insertPromoCodeSchema, bulkGenerateSchema } from "../shared/schema";

// Types for Cloudflare Worker environment
interface Env {
  DATABASE_URL: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  API_KEY: string;
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

// API Key Authentication
function requireApiKey(request: Request, env: Env) {
  const apiKey = request.headers.get('x-api-key');
  const expectedApiKey = env.API_KEY || 'promo-manager-2024-secure-key';
  
  if (!apiKey || apiKey !== expectedApiKey) {
    return new Response(JSON.stringify({ 
      message: 'Unauthorized: Valid API key required'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
  return null;
}

// CORS headers with no-cache for API responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
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

  // Check API key
  const authError = requireApiKey(request, env);
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
        limit: Math.min(limit, 1000),
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
      const campaigns = await storageInstance.getCampaigns();
      return new Response(JSON.stringify(campaigns), {
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
    if (path.startsWith('/api/promo-codes/') && !path.includes('/redeem') && !path.includes('/toggle-status') && method === 'DELETE') {
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