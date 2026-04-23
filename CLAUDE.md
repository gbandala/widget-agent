# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Dev server at http://localhost:3000
pnpm build        # Compiles widget.js + Next.js production build (type checking)
pnpm build:widget # Only compiles public/widget.js from src/widget/loader.ts (esbuild)
pnpm typecheck    # Alias for build — runs tsc/next build
pnpm lint         # ESLint
pnpm setup        # Interactive CLI: creates DB tables, first widget token, loads KB seed
```

> Local dev on Windows: `pnpm dev` uses Turbopack by default. If it fails on USB/junction-point drives use `pnpm exec next dev` instead.

## Architecture

**Widget Agent** is a Next.js 16 app — an embeddable AI chat widget for any landing page. It is **domain-agnostic**: personality, language, scope, tone and instructions are configured per token from the admin panel, not hardcoded. A landing page authenticates via a `Bearer <widget_token>` header — each token is tied to a single `allowed_origin`.

### Request pipeline (every widget chat message)

```
Landing Page
  → Authorization: Bearer <widget_token>  +  Origin header
  → [proxy.ts middleware]        admin-only route guard (x-admin-key)
  → [/api/widget/chat]
      1. Rate limit by IP hash
      2. Token validation (60s in-memory cache, checks is_active + allowed_origin)
      3. Rate limit by token
      4. Gibberish guard (heuristic, no AI cost — too short, no alpha, char repetition)
      5. Velocity guard (per session, min 1s between messages — blocks bots)
      6. Prompt injection guard
      7. Scope guard (off-topic → polite decline)
      8. RAG search against kb_entries (pgvector cosine similarity)
      9. Landing HTML read/cache in widget_sessions.landing_content
     10. streamText via OpenRouter (AI SDK v6)
     11. PII filter on output before saving to widget_messages
```

### Key abstractions

| Path | Role |
|------|------|
| `src/lib/ai/openrouter.ts` | OpenRouter provider (usa `@ai-sdk/openai-compatible`) + model constants (`MODELS.fast/balanced/powerful/embeddings/whisper`) |
| `src/lib/security/` | `promptGuard`, `scopeGuard`, `piiFilter`, `rateLimiter`, `widgetTokenValidator` |
| `src/features/knowledge-base/services/` | `kbService` (Supabase search), `embeddingService` (OpenRouter embeddings) |
| `src/features/widget/hooks/useWidgetChat.ts` | React hook — manages session init, `DefaultChatTransport`, and streaming |
| `src/proxy.ts` | Next.js middleware — guards `/api/admin/*`, `/kb`, `/tokens`, `/leads`, `/logs` |
| `scripts/setup.ts` | One-time CLI wizard for first deploy |

### Tools in the chat route

`captureContact` — no `execute`, requires frontend form completion before confirming.  
`getAvailableSlots` — calls `/api/appointments` internally.  
`bookAppointment` — no `execute`, requires a captured lead first.

AI SDK v6 conventions used here: `inputSchema` (not `parameters`), `stopWhen: stepCountIs(5)`, `convertToModelMessages`, `toUIMessageStreamResponse`.

**OpenRouter gotcha:** usar `@ai-sdk/openai-compatible` (no `@ai-sdk/openai`). El provider `createOpenAI` v3 usa el nuevo Responses API de OpenAI que OpenRouter no soporta. `createOpenAICompatible` fuerza Chat Completions API. Los embeddings usan `.embeddingModel()` (no `.embedding()`).

### Knowledge Base — file import

The KB admin has a 3-step file import wizard (`/kb` → tab "Importar"):

1. **Upload** — drag-and-drop dropzone, supports PDF, PPTX, PPT, DOCX, TXT, XLSX/XLS (max 5 MB)
2. **Processing** — `POST /api/admin/kb/parse-file` extracts raw text, then `POST /api/admin/kb/structure` calls OpenRouter to split and label entries
3. **Review** — grid of proposed cards, each editable (title, content, category combobox, tags); checkboxes to select; bulk save via `POST /api/admin/kb/bulk`

Categories are now **dynamic** (no enum constraint) — the 5 predefined ones (`service`, `project_case`, `capability`, `faq`, `pricing`) are suggestions in a `<datalist>` combobox; admins can type any new category.

| New API route | Purpose |
|---|---|
| `POST /api/admin/kb/parse-file` | Multipart file → `{ rawText, filename, fileType, charCount }` |
| `POST /api/admin/kb/structure` | `{ rawText, existingCategories }` → `{ entries: ProposedEntry[] }` |
| `POST /api/admin/kb/bulk` | `{ entries: KBEntryInput[] }` → embeds + bulk insert, returns `{ imported, failed }` |

**PPT gotcha:** `officeparser` requires a file path (not a Buffer) — PPTX is written to `os.tmpdir()` first, then cleaned up. Old `.ppt` binary format uses the `cfb` library with recursive record traversal (TextCharsAtom 0x0FA0).

### Google Calendar — appointment scheduling

Booking flow: `captureContact` (lead) → `getAvailableSlots` → `bookAppointment` (creates Google Calendar event + Meet link).

**OAuth2 setup (one-time):** Run `node scripts/get-google-token.mjs` locally — starts a server on `localhost:3001/callback`, opens browser for Google auth, prints the refresh token. Requires `http://localhost:3001/callback` as an authorized redirect URI in Google Cloud Console.

**Business hours** are configured via env vars (dynamic, no code change needed):

| Variable | Example | Description |
|---|---|---|
| `APPOINTMENTS_AVAILABLE_DAYS` | `1,2,3,4,5,6` | Days available (0=Sun…6=Sat) |
| `APPOINTMENTS_START_HOUR` | `15:00` | Start time (24h local timezone) |
| `APPOINTMENTS_END_HOUR` | `20:00` | End time (24h local timezone) |
| `APPOINTMENTS_TIMEZONE` | `America/Mexico_City` | IANA timezone |

**Timezone gotcha:** Vercel runs in UTC — `new Date('YYYY-MM-DDThh:mm')` without suffix is UTC, not local time. Slot count is calculated dynamically from hour range ÷ duration (no hardcoded `slice(8)`).

**Calendly note:** Free plan has no booking API — only manual scheduling page. Google Calendar integration is the production solution.

### Agent personality per token

Each `widget_token` carries its own agent config — no hardcoded domain anywhere:

| Field | Default | Purpose |
|---|---|---|
| `agent_language` | `'es'` | Response language |
| `agent_tone` | `'profesional'` | `profesional` / `amigable` / `casual` / `tecnico` |
| `agent_instructions` | null | Free-text mission/instructions (bullets or prose) |
| `agent_scope` | null | Allowed topics — model enforced via system prompt |
| `agent_use_emojis` | `true` | When false, injects "No uses emojis" into system prompt |
| `welcome_message` | null | Opening message shown in the widget UI |

`buildSystemPrompt()` (`src/app/api/widget/chat/route.ts`) assembles the system prompt fully from token config. `scopeGuard.ts` only blocks universally harmful content — topic scope is model-enforced.

`embed/page.tsx` reads `bot_name`, `bot_avatar_url`, `welcome_message` directly from Supabase (server component) — URL params are optional overrides only.

### CLI setup vs Admin panel

Both coexist by design — different lifecycle moments:
- **`pnpm setup`** (CLI): first deploy only — creates DB tables, generates first token, creates KB seed template. Run once per new installation.
- **Admin `/tokens`**: day-to-day — create additional tokens, edit personality, activate/deactivate.

### Database (Supabase + pgvector)

Tables: `widget_tokens`, `kb_entries` (with `embedding VECTOR(1536)`), `widget_sessions`, `widget_messages`, `widget_leads`, `appointments`, `widget_error_logs`.

Migrations are **manual** — paste SQL files from `supabase/migrations/` into Supabase SQL Editor in order. Enable the `vector` extension first.

| Migration | Contents |
|---|---|
| `001_initial_schema.sql` | Base schema — all tables, pgvector, indexes, RLS |
| `002_kb_pending_questions.sql` | `kb_pending_questions` table |
| `003_dynamic_categories.sql` | Drops CHECK constraint on `kb_entries.category` |
| `004_agent_config.sql` | Adds agent personality columns + `agent_use_emojis` to `widget_tokens` |

PII fields (`email`, `phone` in `widget_leads`) are encrypted AES-256 server-side using `PII_ENCRYPTION_KEY`. The key is mandatory in production.

### Admin panel

Routes `/kb`, `/tokens`, `/leads`, `/logs` require `x-admin-key: <ADMIN_SECRET_KEY>` header. In dev, missing `ADMIN_SECRET_KEY` logs a warning and allows access. In production, missing key returns 503.

### Embedding integration

The widget is a React component (`src/features/widget/`) consumed from the same Next.js app. `NEXT_PUBLIC_DEMO_WIDGET_TOKEN` powers the demo on `/`.

For external sites, the recommended integration is the **`widget.js` script tag**:

```html
<script src="https://TU_DOMINIO/widget.js" data-token="..." data-color="#2563eb"></script>
```

**How it works:** `public/widget.js` is a compiled IIFE loader (esbuild, 4.6 KB minified) that injects a FAB button and an iframe pointing to `/embed`. The iframe preloads via `requestIdleCallback` after page load, so first-click latency is near zero.

**Source:** `src/widget/loader.ts` — edit here, then run `pnpm build:widget` to compile.

**Features:** lazy iframe, mobile full-screen (< 640 px), configurable color + position, ESC key, `aria-expanded`, postMessage API (`widget-open` / `widget-close`).

**Cache:** `next.config.ts` serves `/widget.js` with `Cache-Control: no-cache, must-revalidate` — consumers always get the latest version without changing their script tag.

## Environment variables

Required for local dev: `OPENROUTER_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`.  
Required for production: add `PII_ENCRYPTION_KEY`, `ADMIN_SECRET_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.  
Optional: `GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN/CALENDAR_ID` for appointment scheduling.
