// Google OAuth + Sheets helpers for the raw-sheet row check.
//
// IMPORTANT: This file runs in BOTH runtimes — the dev Express server (Node)
// and the production Cloudflare Worker. Only use fetch + WebCrypto
// (globalThis.crypto.subtle) + atob. No node: imports.

export interface GoogleOAuthClient {
  clientId: string;
  clientSecret: string;
}

// Accepts the downloaded OAuth client file — either the raw {"web": {...}}
// wrapper Google gives you, or an already-flat object.
export function parseOAuthClientJson(raw: string | undefined | null): GoogleOAuthClient | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const inner = parsed.web ?? parsed.installed ?? parsed;
    if (typeof inner?.client_id === "string" && typeof inner?.client_secret === "string") {
      return { clientId: inner.client_id, clientSecret: inner.client_secret };
    }
    return null;
  } catch {
    return null;
  }
}

const OAUTH_SCOPES = "https://www.googleapis.com/auth/spreadsheets.readonly openid email";
const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

async function hmacHex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// CSRF state for the OAuth redirect. Both runtimes are stateless (the Worker
// especially), so the state carries its own proof: timestamp + random nonce,
// HMAC-signed with the client secret. Only our server can mint one, and it
// expires after 10 minutes.
export async function createOAuthState(clientSecret: string): Promise<string> {
  const timestamp = Date.now();
  const nonceBytes = new Uint8Array(16);
  crypto.getRandomValues(nonceBytes);
  const nonce = Array.from(nonceBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const sig = await hmacHex(clientSecret, `${timestamp}.${nonce}`);
  return `${timestamp}.${nonce}.${sig}`;
}

export async function verifyOAuthState(state: string | null, clientSecret: string): Promise<boolean> {
  if (!state) return false;
  const parts = state.split(".");
  if (parts.length !== 3) return false;
  const [timestampStr, nonce, sig] = parts;
  const timestamp = parseInt(timestampStr, 10);
  if (!Number.isFinite(timestamp)) return false;
  if (Date.now() - timestamp > STATE_MAX_AGE_MS) return false;
  const expected = await hmacHex(clientSecret, `${timestamp}.${nonce}`);
  return sig === expected;
}

export function buildGoogleAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: OAUTH_SCOPES,
    access_type: "offline", // ask for a refresh token
    prompt: "consent", // guarantees Google re-issues the refresh token
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface TokenExchangeResult {
  ok: true;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  email: string | null;
}
export interface TokenError {
  ok: false;
  invalidGrant: boolean;
  detail: string;
}

// Display-only email from the id_token payload. We do NOT verify the JWT
// signature — the token came to us directly from Google's token endpoint over
// TLS, and the email is only shown in the UI ("Connected as ...").
function decodeIdTokenEmail(idToken: string | undefined): string | null {
  if (!idToken) return null;
  try {
    const payloadPart = idToken.split(".")[1];
    if (!payloadPart) return null;
    let b64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4 !== 0) b64 += "=";
    const payload = JSON.parse(atob(b64));
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

async function postTokenEndpoint(body: URLSearchParams): Promise<{ status: number; json: any }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  let json: any = {};
  try {
    json = await res.json();
  } catch {
    // leave as {}
  }
  return { status: res.status, json };
}

export async function exchangeCodeForTokens(
  client: GoogleOAuthClient,
  code: string,
  redirectUri: string,
): Promise<TokenExchangeResult | TokenError> {
  const { status, json } = await postTokenEndpoint(
    new URLSearchParams({
      client_id: client.clientId,
      client_secret: client.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  );
  if (status !== 200 || !json.access_token) {
    return {
      ok: false,
      invalidGrant: json.error === "invalid_grant",
      detail: typeof json.error === "string" ? json.error : `HTTP ${status}`,
    };
  }
  return {
    ok: true,
    accessToken: json.access_token,
    refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : null,
    expiresAt: new Date(Date.now() + (Number(json.expires_in) || 3600) * 1000),
    email: decodeIdTokenEmail(json.id_token),
  };
}

export async function refreshAccessToken(
  client: GoogleOAuthClient,
  refreshToken: string,
): Promise<{ ok: true; accessToken: string; expiresAt: Date } | TokenError> {
  const { status, json } = await postTokenEndpoint(
    new URLSearchParams({
      client_id: client.clientId,
      client_secret: client.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  );
  if (status !== 200 || !json.access_token) {
    return {
      ok: false,
      invalidGrant: json.error === "invalid_grant",
      detail: typeof json.error === "string" ? json.error : `HTTP ${status}`,
    };
  }
  return {
    ok: true,
    accessToken: json.access_token,
    expiresAt: new Date(Date.now() + (Number(json.expires_in) || 3600) * 1000),
  };
}

// Minimal slice of IStorage the check needs — keeps this file free of any
// storage-implementation imports so both runtimes can share it.
export interface GoogleTokenStore {
  getGoogleTokens(): Promise<
    | {
        refreshToken: string;
        accessToken: string | null;
        accessTokenExpiresAt: Date | null;
        connectedEmail: string | null;
      }
    | undefined
  >;
  updateGoogleAccessToken(accessToken: string, expiresAt: Date): Promise<void>;
  deleteGoogleTokens(): Promise<void>;
}

export type RawSheetCheckResponse =
  | { connected: false }
  | { connected: true; rows: number; email: string | null }
  | { connected: true; error: "no_access" | "tab_not_found" | "api_error"; email: string | null };

// The whole raw-sheet check: load tokens, refresh the access token if stale,
// count the rows. Shared verbatim by the Express server and the Worker.
export async function performRawSheetCheck(
  store: GoogleTokenStore,
  client: GoogleOAuthClient,
  documentId: string,
  rawSheetGid: string,
): Promise<RawSheetCheckResponse> {
  const tokens = await store.getGoogleTokens();
  if (!tokens) return { connected: false };
  const email = tokens.connectedEmail ?? null;

  // Reuse the cached access token if it has >60s of life left.
  let accessToken = tokens.accessToken;
  const expiresAt = tokens.accessTokenExpiresAt;
  const stillValid = accessToken && expiresAt && expiresAt.getTime() - Date.now() > 60_000;

  if (!stillValid) {
    const refreshed = await refreshAccessToken(client, tokens.refreshToken);
    if (!refreshed.ok) {
      if (refreshed.invalidGrant) {
        // The user revoked access (or the token expired for good) — clear the
        // dead connection so the UI offers "Connect Google Sheets" again.
        await store.deleteGoogleTokens();
        return { connected: false };
      }
      return { connected: true, error: "api_error", email };
    }
    accessToken = refreshed.accessToken;
    await store.updateGoogleAccessToken(refreshed.accessToken, refreshed.expiresAt);
  }

  const result = await countRawSheetRows(accessToken!, documentId, rawSheetGid);
  if (!result.ok) {
    return { connected: true, error: result.reason, email };
  }
  return { connected: true, rows: result.rows, email };
}

export type RawSheetCountResult =
  | { ok: true; rows: number; tabTitle: string }
  | { ok: false; reason: "no_access" | "tab_not_found" | "api_error"; detail?: string };

// Counts data rows in one tab of a spreadsheet. rawSheetId is the tab's gid
// (numeric, but stored as text). Two calls: gid -> tab title, then values.
export async function countRawSheetRows(
  accessToken: string,
  documentId: string,
  rawSheetGid: string,
): Promise<RawSheetCountResult> {
  const authHeaders = { Authorization: `Bearer ${accessToken}` };

  // 1) Map the gid to the tab title (the values API only takes titles).
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(documentId)}?fields=sheets.properties(sheetId,title)`,
    { headers: authHeaders },
  );
  if (metaRes.status === 403 || metaRes.status === 404) {
    return { ok: false, reason: "no_access", detail: `HTTP ${metaRes.status}` };
  }
  if (!metaRes.ok) {
    return { ok: false, reason: "api_error", detail: `HTTP ${metaRes.status}` };
  }
  const meta: any = await metaRes.json();
  const gidNum = Number(rawSheetGid);
  const tab = (meta.sheets ?? []).find((s: any) => s?.properties?.sheetId === gidNum);
  if (!tab) {
    return { ok: false, reason: "tab_not_found" };
  }
  const title: string = tab.properties.title;

  // 2) Fetch the tab's values. Range is capped at columns A–Z — Google trims
  // trailing empty rows, so the payload scales with actual data, and lead
  // sheets never need more than 26 columns for a presence check.
  const escapedTitle = title.replace(/'/g, "''");
  const range = encodeURIComponent(`'${escapedTitle}'!A1:Z`);
  const valuesRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(documentId)}/values/${range}?majorDimension=ROWS`,
    { headers: authHeaders },
  );
  if (valuesRes.status === 403 || valuesRes.status === 404) {
    return { ok: false, reason: "no_access", detail: `HTTP ${valuesRes.status}` };
  }
  if (!valuesRes.ok) {
    return { ok: false, reason: "api_error", detail: `HTTP ${valuesRes.status}` };
  }
  const data: any = await valuesRes.json();
  const rows: any[][] = Array.isArray(data.values) ? data.values : [];
  const nonEmpty = rows.filter(
    (row) => Array.isArray(row) && row.some((cell) => typeof cell === "string" ? cell.trim() !== "" : cell != null),
  ).length;
  // First non-empty row is the header.
  return { ok: true, rows: Math.max(0, nonEmpty - 1), tabTitle: title };
}
