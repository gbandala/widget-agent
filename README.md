# Widget Agent

Asistente de ventas con IA, embebible en cualquier landing page. Arquitectura **agnóstica de dominio**: personalidad, idioma, scope e instrucciones se configuran por token desde el panel admin — sin código. Soporta múltiples clientes con aislamiento completo de Knowledge Base.

---

## Capacidades

| Capacidad | Descripción |
|-----------|-------------|
| **Chat con streaming** | Respuestas en tiempo real via OpenRouter (Claude Haiku 4.5 por defecto) |
| **RAG sobre KB** | Búsqueda semántica con pgvector — aislada por token (multi-tenant) |
| **Lectura de landing** | Lee el HTML de la página del visitante para contexto adicional |
| **Captura de leads** | Detecta interés, solicita datos con consentimiento explícito, cifra con AES-256 |
| **Agendamiento** | Consulta disponibilidad en Google Calendar, crea eventos con Meet link |
| **Audio STT** | Input de voz via Web Speech API (Chrome/Edge) |
| **Resumen descargable** | Genera resumen de la conversación al final |
| **Personalidad por token** | Cada token tiene: idioma, tono, instrucciones, scope, welcome message, emojis on/off |
| **Panel admin** | CRUD de KB, gestión de leads, tokens, logs de errores |
| **Seguridad** | Rate limiting Upstash, prompt injection guard, PII filter, scope guard, SSRF protection |

---

## Arquitectura

```
Landing Page (cualquier sitio)
    │
    │  Authorization: Bearer <widget_token>
    ▼
┌─────────────────────────────────┐
│         Widget Agent            │
│         (Next.js 16)            │
│                                 │
│  /api/widget/chat    ← RAG      │
│  /api/widget/leads              │
│  /api/widget/session            │
│  /api/widget/summary            │
│  /api/appointments              │
│                                 │
│  /kb  /tokens  /leads  /logs    │  ← Panel Admin (x-admin-key)
└────────────┬────────────────────┘
             │
     ┌───────┼────────┐
     ▼       ▼        ▼
 Supabase  OpenRouter  Google
 (DB+vec)  (LLM+emb)  Calendar
```

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS · Supabase + pgvector · AI SDK v6 · OpenRouter · Upstash Redis

### Pipeline de cada mensaje

```
Request → Rate limit IP → Token validation (60s cache) → Rate limit token
        → Prompt injection guard → Scope guard → RAG search (KB scoped al token)
        → Landing HTML (cache sesión) → streamText (OpenRouter)
        → PII filter output → widget_messages
```

---

## Setup inicial

### 1. Instalar dependencias

```bash
git clone https://github.com/gbandala/widget-agent.git
cd widget-agent
pnpm install
```

### 2. Variables de entorno

```bash
cp .env.example .env.local
```

| Variable | Req | Descripción |
|----------|-----|-------------|
| `OPENROUTER_API_KEY` | ✅ | API key de OpenRouter |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Anon key pública de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key (solo server) |
| `NEXT_PUBLIC_APP_URL` | ✅ | URL pública del deploy |
| `PII_ENCRYPTION_KEY` | ✅ prod | AES-256 para cifrar leads. Generar: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ADMIN_SECRET_KEY` | ✅ prod | Header `x-admin-key` del panel admin |
| `UPSTASH_REDIS_REST_URL` | Recomendada | Rate limiting distribuido |
| `UPSTASH_REDIS_REST_TOKEN` | Recomendada | — |
| `GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN` | Opcional | Agendamiento Google Calendar |
| `GOOGLE_CALENDAR_ID` | Opcional | Default: `primary` |
| `NEXT_PUBLIC_DEMO_WIDGET_TOKEN` | Dev | Token para la demo en `/` |

### 3. Aplicar migraciones en Supabase

Las migraciones se aplican **manualmente** en Supabase Dashboard → SQL Editor. Aplicar en orden:

| Archivo | Contenido |
|---------|-----------|
| `supabase/migrations/001_initial_schema.sql` | Schema base, pgvector, RLS |
| `supabase/migrations/002_kb_pending_questions.sql` | Tabla `kb_pending_questions` |
| `supabase/migrations/003_dynamic_categories.sql` | Elimina constraint de categorías |
| `supabase/migrations/004_agent_config.sql` | Personalidad del agente por token |
| `supabase/migrations/005_kb_per_token.sql` | Aislamiento KB multi-tenant |

> **Requisito previo:** activar la extensión `vector` en Supabase → Database → Extensions → `vector`.

### 4. CLI de setup

```bash
pnpm setup
```

Crea el primer token, configura el bot y carga la KB semilla.

### 5. Google Calendar OAuth (opcional)

```bash
node scripts/get-google-token.mjs
```

Levanta un servidor en `localhost:3001/callback`, abre el navegador para autorizar, imprime el `refresh_token`. Requiere `http://localhost:3001/callback` como URI autorizado en Google Cloud Console.

---

## Desarrollo local

```bash
pnpm dev        # http://localhost:3000 (Turbopack)
pnpm build      # Build de producción + typecheck
pnpm lint       # ESLint
pnpm setup      # Wizard de primer deploy
```

> En Windows con unidades USB/junction-points, usar `pnpm exec next dev` si Turbopack falla.

---

## Despliegue en Vercel

1. Importar repo en [vercel.com/new](https://vercel.com/new)
2. Agregar todas las variables de entorno en Settings → Environment Variables
3. Deploy automático

> **Plan requerido:** Vercel **Pro** ($20/mes). El plan Hobby (a) prohíbe uso comercial en ToS y (b) tiene timeout de 10s en functions — insuficiente para streaming de chat.

### Timeouts (`vercel.json`)

| Endpoint | Timeout |
|----------|---------|
| `/api/widget/chat` | 30s |
| `/api/widget/summary` | 30s |
| `/api/appointments` | 15s |

---

## Personalidad del agente por token

Cada `widget_token` tiene su propia configuración de agente — sin código:

| Campo | Default | Descripción |
|-------|---------|-------------|
| `agent_language` | `'es'` | Idioma de respuestas |
| `agent_tone` | `'profesional'` | `profesional` / `amigable` / `casual` / `tecnico` |
| `agent_instructions` | null | Misión e instrucciones en texto libre |
| `agent_scope` | null | Temas permitidos (enforced en system prompt) |
| `agent_use_emojis` | `true` | false → inyecta "No uses emojis" en system prompt |
| `welcome_message` | null | Mensaje inicial del widget |

Configurar desde el panel admin en `/tokens` → Editar → sección "Personalidad del Agente".

---

## Knowledge Base multi-tenant

Cada entrada de KB puede ser:
- **Global** (`token_id = NULL`): visible a todos los tokens
- **Scoped** (`token_id = <uuid>`): visible solo al token asignado

El RAG search filtra automáticamente por token — los clientes nunca ven KB de otro cliente.

### Importación desde archivos

Panel admin `/kb` → tab "Importar":
1. **Upload**: PDF, PPTX, PPT, DOCX, TXT, XLSX (máx 5 MB)
2. **Procesamiento**: extracción de texto + estructuración con IA
3. **Revisión**: grid de entradas propuestas, editables antes de importar — con selector de token

---

## Integración en landing page

### Iframe (recomendado para sitios no-React)

```html
<iframe
  src="https://TU_DOMINIO/embed?token=TU_WIDGET_TOKEN"
  style="position:fixed;bottom:0;right:0;width:400px;height:100vh;border:none;z-index:9999;"
  allow="microphone"
></iframe>
```

### Componente React

```tsx
import { WidgetLauncher } from './WidgetLauncher'

<WidgetLauncher token="TU_WIDGET_TOKEN" />
```

El `welcome_message`, `bot_name` y `bot_avatar_url` se leen desde la BD — no hace falta pasarlos como props.

---

## Panel de administración

Acceso: `https://TU_DOMINIO/kb` · `/tokens` · `/leads` · `/logs`

Requiere header `x-admin-key: TU_ADMIN_SECRET_KEY`. Usar [ModHeader](https://modheader.com) en el navegador.

| Sección | Descripción |
|---------|-------------|
| `/kb` | CRUD de KB, importación desde archivos, filtro por token |
| `/tokens` | Crear tokens, editar personalidad del agente |
| `/leads` | Leads capturados (datos descifrados on demand) |
| `/logs` | Rate limits, errores de API, inyecciones detectadas |

---

## API Reference

### Widget (Bearer token)

| Método | Ruta | Body |
|--------|------|------|
| `POST` | `/api/widget/chat` | `{ messages, sessionId, sourceUrl }` |
| `POST` | `/api/widget/session` | `{ anonId, tokenId, sourceUrl }` |
| `POST` | `/api/widget/leads` | `{ sessionId, name, email, privacyAccepted: true }` |
| `POST` | `/api/widget/summary` | `{ sessionId }` |
| `GET` | `/api/appointments` | `?date=YYYY-MM-DD` |

### Admin (x-admin-key)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET/POST/PATCH` | `/api/admin/tokens` | CRUD tokens + personalidad |
| `GET/POST/PATCH/DELETE` | `/api/admin/kb` | CRUD KB (`?token_id=` para filtrar) |
| `POST` | `/api/admin/kb/bulk` | Importar entradas en lote (con `tokenId`) |
| `POST` | `/api/admin/kb/parse-file` | Extraer texto de archivo |
| `POST` | `/api/admin/kb/structure` | Estructurar texto con IA |

---

## Seguridad

```
Request → Proxy (admin guard) → Token validator → Rate limit IP
        → Rate limit token → Prompt injection → Scope guard
        → RAG (scoped) → LLM → PII output filter → Response
```

- PII cifrado AES-256-CBC en `widget_leads`
- Rate limiting via Upstash Redis (IP + token)
- SSRF protection: bloquea localhost, rangos privados, AWS metadata
- Prompt injection guard en cada mensaje

---

## Costos de infraestructura (modelo por cliente)

Mínimo requerido para producción:

| Servicio | Plan | Costo |
|----------|------|-------|
| Vercel | Pro | $20/mes |
| Supabase | Pro | $25/mes |
| OpenRouter | Pay-as-you-go | ~$2–15/mes (200–1000 conv) |
| **Total típico** | | **~$47–60/mes** |

> El free tier de Vercel prohíbe uso comercial. El free tier de Supabase pausa proyectos tras 7 días de inactividad — no viable en producción.

---

## Roadmap

- [ ] Bundle standalone `widget.js` para integración con `<script>`
- [ ] TTS — respuesta en audio
- [ ] Dashboard de analytics
- [ ] Exportación de leads a CSV
- [ ] Soporte multi-idioma automático por detección

---

## Licencia

MIT
