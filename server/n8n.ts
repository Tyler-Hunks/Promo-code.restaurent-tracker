import { type EmailCampaign, buildLaunchPayload } from "../shared/schema";

// The exact JSON body POSTed to the n8n webhook when a campaign launches. The
// payload shape itself lives in shared/schema.ts (buildLaunchPayload) so the
// dev server, the Cloudflare Worker, and the frontend preview never drift. Here
// we only add the server-side `triggeredAt` stamp (the frontend preview omits
// it since it isn't known until the launch actually fires).
export function buildLaunchRequestBody(campaign: EmailCampaign, mode: "launch" | "relaunch") {
  return {
    ...buildLaunchPayload(campaign, mode),
    triggeredAt: new Date().toISOString(),
  };
}

export interface N8nTriggerResult {
  ok: boolean;
  status: number;
  message: string;
  // The (truncated) response body n8n returned. Safe to show: the user owns the
  // n8n workflow and controls exactly what it sends back. Only populated when we
  // actually got an HTTP response — never from a network/timeout error.
  detail?: string;
}

// Fires the n8n webhook server-side with the secret header. Never throws — it
// returns a structured result so callers can decide whether to mark the
// campaign as launched. The secret is never logged or returned to the client.
export async function triggerN8nWebhook(
  webhookUrl: string,
  secret: string | undefined,
  payload: Record<string, unknown>,
  timeoutMs = 25000,
): Promise<N8nTriggerResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  // Only send the auth header when a secret is configured. If the n8n webhook
  // uses Authentication: None, the URL/path alone is the protection.
  if (secret) {
    headers["X-Trigger-Secret"] = secret;
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    // Capture the response body n8n returned so the app can show what happened
    // (e.g. "queued 240 leads"). The user owns the n8n workflow, so its response
    // is their own data — but we cap the length to keep payloads sane.
    let detail: string | undefined;
    try {
      const bodyText = await res.text();
      const trimmed = bodyText?.trim();
      if (trimmed) {
        detail = trimmed.length > 2000 ? `${trimmed.slice(0, 2000)}…` : trimmed;
      }
    } catch {
      // ignore body read errors — detail just stays empty
    }

    return {
      ok: res.ok,
      status: res.status,
      message: res.ok ? "Workflow triggered" : `The automation service returned status ${res.status}`,
      detail,
    };
  } catch (err: any) {
    // Do not surface err.message — fetch errors can contain the webhook URL.
    const isAbort = err?.name === "AbortError";
    return {
      ok: false,
      status: 0,
      message: isAbort
        ? "The automation service timed out. Please try again."
        : "Could not reach the automation service.",
    };
  } finally {
    clearTimeout(timer);
  }
}
