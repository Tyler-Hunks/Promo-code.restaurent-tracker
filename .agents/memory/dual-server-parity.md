---
name: Dual server parity
description: This app ships two server runtimes that must stay in feature parity.
---

The app runs two independent backend implementations that must be kept in sync:
- Express dev server: `server/routes.ts` (routes) + `server/storage.ts` (Drizzle `DatabaseStorage` + in-memory `MemStorage`).
- Cloudflare Worker (production): `server/worker.ts` (manual router) + `server/storage-cloudflare.ts` (supabase-js, snake_case↔camelCase mapping).

**Rule:** every new API endpoint and storage method must be added to BOTH sides with matching behavior. The Worker uses a hand-written router where order matters — register exact collection paths first, then `/:id/sub-action` (e.g. `/:id/launch`), then `/:id` PATCH, before the final 404.

**Why:** dev and prod use different code paths. A feature added only to Express works in the Replit preview but silently 404s or misbehaves on the live Cloudflare site.

**How to apply:** when adding or altering any endpoint or storage CRUD, edit routes.ts + storage.ts AND worker.ts + storage-cloudflare.ts. Put shared request/response shapes in a shared module (e.g. `server/n8n.ts`, `shared/schema.ts`) so they can't drift between the two runtimes.
