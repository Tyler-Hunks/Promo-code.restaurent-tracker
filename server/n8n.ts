import type { EmailCampaign } from "../shared/schema";

// Builds the exact JSON body POSTed to the n8n webhook when a campaign launches.
// Shared by the Express dev server (routes.ts) and the Cloudflare Worker
// (worker.ts) so the payload shape never drifts between environments.
export function buildLaunchPayload(campaign: EmailCampaign) {
  return {
    campaignId: campaign.id,
    campaignName: campaign.campaignName,
    campaignType: campaign.campaignType ?? null,
    documentId: campaign.documentId,
    documentId2: campaign.documentId2 ?? null,
    campaignInfoGid: campaign.campaignInfoGid,
    mainScript: campaign.mainScript ?? null,
    followUps: campaign.followUps ?? [],
    expiryDate: campaign.expiryDate ?? null,
    triggeredAt: new Date().toISOString(),
  };
}

export interface N8nTriggerResult {
  ok: boolean;
  status: number;
  message: string;
}

// Fires the n8n webhook server-side with the secret header. Never throws — it
// returns a structured result so callers can decide whether to mark the
// campaign as launched. The secret is never logged or returned to the client.
export async function triggerN8nWebhook(
  webhookUrl: string,
  secret: string,
  payload: Record<string, unknown>,
  timeoutMs = 25000,
): Promise<N8nTriggerResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Trigger-Secret": secret,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    // Drain the body so the connection can be reused, but never forward the
    // webhook's raw response to the client — it could reflect the request URL,
    // the secret header, or other server-only details. Return controlled
    // messages only.
    try {
      await res.text();
    } catch {
      // ignore body read errors
    }

    return {
      ok: res.ok,
      status: res.status,
      message: res.ok ? "Workflow triggered" : `The automation service returned status ${res.status}`,
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
