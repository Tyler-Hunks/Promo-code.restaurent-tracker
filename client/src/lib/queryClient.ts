import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // For production, use environment-specific API base URL
  // If no VITE_API_BASE_URL is set, use current origin (for Cloudflare Workers)
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 
    (typeof window !== 'undefined' ? window.location.origin : '');
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
  
  const headers: Record<string, string> = {
    'x-api-key': import.meta.env.VITE_API_KEY || 'promo-manager-2024-secure-key', // API key for authentication
  };
  
  if (data) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(fullUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // If no VITE_API_BASE_URL is set, use current origin (for Cloudflare Workers)
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 
      (typeof window !== 'undefined' ? window.location.origin : '');
    const url = queryKey.join("/") as string;
    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
    
    const res = await fetch(fullUrl, {
      headers: {
        'x-api-key': import.meta.env.VITE_API_KEY || 'promo-manager-2024-secure-key', // API key for authentication
      },
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
