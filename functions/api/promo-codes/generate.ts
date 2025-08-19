// Single promo code generation endpoint
import { storage } from "../../../server/storage-cloudflare";
import { insertPromoCodeSchema } from "../../../shared/schema";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
};

function requireApiKey(request: Request, env: any) {
  const apiKey = request.headers.get('x-api-key');
  const expectedApiKey = env.API_KEY || 'promo-manager-2024-secure-key';
  
  if (!apiKey || apiKey !== expectedApiKey) {
    return new Response(JSON.stringify({ 
      message: 'Unauthorized: Valid API key required' 
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  return null;
}

function generateCode(format: string = "PROMO-XXXX"): string {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return format.replace(/X/g, () => {
    return characters.charAt(Math.floor(Math.random() * characters.length));
  });
}

async function generateUniqueCode(format: string, env: any): Promise<string> {
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

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const authError = requireApiKey(request, env);
  if (authError) return authError;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ message: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const { format = "PROMO-XXXX", campaignName, discountValue, expiresAt } = body;
    
    const code = await generateUniqueCode(format, env);
    const storageInstance = storage(env);
    
    const promoCode = await storageInstance.createPromoCode({ 
      code, 
      campaignName, 
      discountValue, 
      expiresAt: expiresAt ? new Date(expiresAt) : undefined
    });
    
    return new Response(JSON.stringify(promoCode), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      message: error instanceof Error ? error.message : 'Internal Server Error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}