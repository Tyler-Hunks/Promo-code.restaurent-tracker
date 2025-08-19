// Cloudflare Pages Function for promo codes API
import { storage } from "../../server/storage-cloudflare";
import { insertPromoCodeSchema, bulkGenerateSchema } from "../../shared/schema";

// API Key Authentication
function requireApiKey(request: Request, env: any) {
  const apiKey = request.headers.get('x-api-key');
  const expectedApiKey = env.API_KEY || 'promo-manager-2024-secure-key';
  
  if (!apiKey || apiKey !== expectedApiKey) {
    return new Response(JSON.stringify({ 
      message: 'Unauthorized: Valid API key required',
      hint: 'Include x-api-key header with your request'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
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

// Code generation utility
function generateCode(format: string = "PROMO-XXXX"): string {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return format.replace(/X/g, () => {
    return characters.charAt(Math.floor(Math.random() * characters.length));
  });
}

async function generateUniqueCode(format: string = "PROMO-XXXX", env: any): Promise<string> {
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

export async function onRequest(context: any): Promise<Response> {
  const { request, env } = context;
  const method = request.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  // Check API key
  const authError = requireApiKey(request, env);
  if (authError) {
    return new Response(authError.body, {
      status: authError.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const storageInstance = storage(env);

  try {
    // GET /api/promo-codes - Get all promo codes
    if (method === 'GET') {
      const codes = await storageInstance.getAllPromoCodes();
      return new Response(JSON.stringify(codes), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /api/promo-codes - Generate single promo code
    if (method === 'POST') {
      const body = await request.json();
      const { format = "PROMO-XXXX", campaignName, discountValue, expiresAt } = body;
      const code = await generateUniqueCode(format, env);
      
      const validation = insertPromoCodeSchema.safeParse({ 
        code, 
        campaignName, 
        discountValue, 
        expiresAt 
      });
      
      if (!validation.success) {
        return new Response(JSON.stringify({ message: "Invalid code format" }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const promoCode = await storageInstance.createPromoCode({ 
        code, 
        campaignName, 
        discountValue, 
        expiresAt 
      });
      
      return new Response(JSON.stringify(promoCode), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ message: 'Method not allowed' }), {
      status: 405,
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