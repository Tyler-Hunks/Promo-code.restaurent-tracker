import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Token management
const TOKEN_KEY = 'promo_app_token';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeStoredToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

// Called when the server rejects our token (e.g. it expired while the app sat idle).
// Clears the stored token and notifies the app so it can return to the login screen.
export function handleUnauthorized(): void {
  if (typeof window === 'undefined') return;
  // If there's no token, we've already handled this (dedupes a burst of 401s).
  if (!getStoredToken()) return;
  removeStoredToken();
  window.dispatchEvent(new CustomEvent('auth:unauthorized'));
}

export async function loginWithApiKey(apiKey: string): Promise<{ token: string; expiresIn: number }> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 
    (typeof window !== 'undefined' ? window.location.origin : '');
    
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ apiKey })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Login failed');
  }
  
  const result = await response.json();
  setStoredToken(result.token);
  return result;
}

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
  
  const headers: Record<string, string> = {};
  
  // Add Authorization header if token exists
  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  if (data) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(fullUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  if (res.status === 401) {
    handleUnauthorized();
  }

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
    
    const headers: Record<string, string> = {};
    const token = getStoredToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const res = await fetch(fullUrl, {
      headers,
      credentials: "include",
    });

    if (res.status === 401) {
      handleUnauthorized();
      if (unauthorizedBehavior === "returnNull") {
        return null;
      }
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
