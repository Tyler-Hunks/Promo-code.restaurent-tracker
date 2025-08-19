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
async function handleStatic(request: Request): Promise<Response> {
  // This will be configured to serve from static assets
  const url = new URL(request.url);
  
  // Default to index.html for SPA routing
  if (url.pathname === '/' || !url.pathname.includes('.')) {
    return new Response(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Promo Code Manager</title>
  <link rel="icon" type="image/svg+xml" href="/vite.svg" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/assets/index.js"></script>
  <link rel="stylesheet" href="/assets/index.css">
</body>
</html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
  
  return new Response('Static file', { status: 404 });
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

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
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
      const codes = await storageInstance.getAllPromoCodes();
      return new Response(JSON.stringify(codes), {
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
      const validation = bulkGenerateSchema.safeParse(body);
      
      if (!validation.success) {
        return new Response(JSON.stringify({ 
          message: "Invalid bulk generation parameters" 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { count, format, campaignName, discountValue, expiresAt } = validation.data;
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

    // Additional routes can be added here...

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
    return handleStatic(request);
  },
};