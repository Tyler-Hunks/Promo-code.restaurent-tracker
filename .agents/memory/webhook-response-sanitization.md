---
name: Webhook response sanitization
description: Server-to-external webhook calls must not echo the webhook's response back to the client.
---

When the server calls an external webhook (e.g. the n8n campaign launch in `server/n8n.ts`), return only controlled, generic messages to the client: success, "service returned status N", timed out, or unreachable. Never forward the webhook's raw response body, and never forward the caught fetch error's `message`.

**Why:** the external response body, or a fetch error string, can reflect the request URL or headers — including the server-only `X-Trigger-Secret` and the webhook URL — indirectly leaking secrets that must never reach the browser.

**How to apply:** read/drain the response to free the connection, then map to a fixed set of safe strings. Apply this in both the Express and Worker launch handlers (they share `triggerN8nWebhook`).
