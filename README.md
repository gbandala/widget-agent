# Widget Agent

Asistente de consultoría con IA, embebible en cualquier landing page. Responde preguntas sobre servicios, captura leads cualificados con consentimiento explícito, agenda citas en Google Calendar con Meet, y aprende de cada conversación.

---

<!-- ================================================================
     SECCION EFIMERA — BORRAR DESPUES DE PRIMER DEPLOY EXITOSO
     ================================================================ -->
## [WIP] Iteracion actual — Primer deploy a Vercel

> **Contexto:** El código está listo. El build local falla por restricciones de la unidad USB
> (Turbopack necesita junction points). El build en Vercel funciona sin problema.

### Paso 1 — Commit inicial en el repo

```cmd
cd D:\devUSB\projects\widget-agent
git add .
git commit -m "feat: initial widget-agent implementation

- Chat con streaming via OpenRouter (AI SDK v6)
- RAG sobre Knowledge Base con pgvector
- Captura de leads con cifrado AES-256
- Agendamiento via Google Calendar
- Admin panel (KB, tokens, leads, logs)
- Seguridad: rate limiting Upstash, SSRF guard, PII filter, prompt injection guard
- Middleware de autenticacion admin (x-admin-key)
- Token cache 60s, abort signal en streamText"

git push origin main
```

### Paso 2 — Importar en Vercel

1. Ir a [vercel.com/new](https://vercel.com/new) → **Import Git Repository**
2. Seleccionar el repo `widget-agent`
3. Framework: **Next.js** (auto-detectado)
4. En **Environment Variables**, agregar todas las vars de `.env.example`:

| Variable | Fuente |
|----------|--------|
| `OPENROUTER_API_KEY` | openrouter.ai → Keys |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API |
| `PII_ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ADMIN_SECRET_KEY` | igual que arriba |
| `UPSTASH_REDIS_REST_URL` | upstash.com → Redis → REST API |
| `UPSTASH_REDIS_REST_TOKEN` | upstash.com → Redis → REST API |
| `NEXT_PUBLIC_APP_URL` | URL de Vercel (ej: `https://widget-agent.vercel.app`) |

5. Click **Deploy**

### Paso 3 — Post-deploy

```bash
# Aplicar migración en Supabase antes de usar el widget
# Supabase Dashboard → SQL Editor → pegar supabase/migrations/001_initial_schema.sql

# Generar el primer widget token
npm run setup
```

### Paso 4 — Verificar que funciona

- `GET https://widget-agent.vercel.app/` → Demo page del widget
- `GET https://widget-agent.vercel.app/kb` → Panel Knowledge Base (requiere x-admin-key)
- `POST https://widget-agent.vercel.app/api/widget/chat` con Bearer token → respuesta en streaming

### Pendientes conocidos tras primer deploy

- [ ] Agregar `NEXT_PUBLIC_DEMO_WIDGET_TOKEN` en Vercel con un token real (para la demo page)
- [ ] Crear `supabase/seed/kb.json` con los servicios reales del negocio
- [ ] Configurar `GOOGLE_*` vars si se requiere agendamiento
- [ ] Actualizar `allowed_origin` del token con el dominio de la landing real

<!-- ================================================================
     FIN SECCION EFIMERA
     ================================================================ -->

---

## Capacidades

| Capacidad | Descripción |
|-----------|-------------|
| **Chat con IA** | Respuestas en streaming usando OpenRouter (Claude Haiku por defecto) |
| **RAG sobre KB** | Búsqueda semántica en la base de conocimiento de servicios/proyectos |
| **Lectura de landing** | Lee el HTML de la landing para orientar al visitante en contexto |
| **Captura de leads** | Detecta interés genuino, solicita datos con aviso de privacidad y consentimiento explícito |
| **Agendamiento** | Consulta disponibilidad en Google Calendar y crea eventos con Google Meet |
| **Audio STT** | Input de voz transcrito con Whisper |
| **Resumen descargable** | Genera y permite descargar un resumen de la conversación |
| **Multi-landing** | Un token único por landing page, validado en cada request |
| **Panel admin** | CRUD de Knowledge Base, gestión de leads, historial, logs de errores, tokens |
| **Seguridad** | Rate limiting, prompt injection guard, PII filter, scope guard, SSRF protection |

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
│  /api/widget/chat    ←── RAG    │
│  /api/widget/leads              │
│  /api/widget/session            │
│  /api/widget/summary            │
│  /api/widget/transcribe         │
│  /api/appointments              │
│                                 │
│  /kb  /tokens  /leads  /logs    │  ← Panel Admin (protegido)
└────────────┬────────────────────┘
             │
     ┌───────┼────────┐
     ▼       ▼        ▼
 Supabase  OpenRouter  Google
 (DB+RLS)  (LLM+STT)  Calendar
```

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS · Supabase · AI SDK v6 · OpenRouter · Upstash Redis · Cheerio

---

## Requisitos previos

- Node.js 20+
- Cuenta en [Supabase](https://supabase.com) (proyecto nuevo, tier gratuito funciona)
- Cuenta en [OpenRouter](https://openrouter.ai) con créditos
- Cuenta en [Upstash](https://upstash.com) — Redis (tier gratuito funciona)
- Google Cloud Project con Calendar API habilitada (para agendamiento)

---

## Setup inicial

### 1. Instalar dependencias

```bash
git clone https://github.com/gbandala/widget-agent.git
cd widget-agent
npm install --legacy-peer-deps
```

### 2. Variables de entorno

```bash
cp .env.example .env.local
```

Editar `.env.local` con los valores reales (ver sección [Variables de entorno](#variables-de-entorno)).

### 3. Aplicar migraciones en Supabase

Las migraciones **no se aplican automáticamente**. Ejecutar manualmente:

1. Ir al [Supabase Dashboard](https://supabase.com/dashboard) → tu proyecto → **SQL Editor**
2. Abrir `supabase/migrations/001_initial_schema.sql`
3. Pegar el contenido completo y ejecutar

Esto crea las tablas: `widget_tokens`, `kb_entries`, `widget_sessions`, `widget_messages`, `widget_leads`, `widget_appointments`, `widget_error_logs`.

> **Nota:** Requiere la extensión `pgvector` habilitada. En Supabase, ir a **Database → Extensions → vector** y activarla antes de ejecutar la migración.

### 4. Configurar Google Calendar OAuth (opcional)

Solo necesario si quieres habilitar agendamiento de citas.

1. Ir a [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services → Credentials**
2. Crear **OAuth 2.0 Client ID** de tipo "Web application"
3. Agregar redirect URI: `http://localhost:3000/api/auth/google/callback`
4. Anotar `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`
5. Obtener el refresh token ejecutando una vez el flujo OAuth:

```bash
# Abrir en el navegador:
https://accounts.google.com/o/oauth2/auth?client_id=TU_CLIENT_ID&redirect_uri=http://localhost:3000/api/auth/google/callback&response_type=code&scope=https://www.googleapis.com/auth/calendar&access_type=offline&prompt=consent
```

6. Copiar el `code` del redirect, intercambiarlo por tokens:

```bash
curl -X POST https://oauth2.googleapis.com/token \
  -d client_id=TU_CLIENT_ID \
  -d client_secret=TU_CLIENT_SECRET \
  -d code=EL_CODE \
  -d redirect_uri=http://localhost:3000/api/auth/google/callback \
  -d grant_type=authorization_code
```

7. El `refresh_token` del response va en `GOOGLE_REFRESH_TOKEN`.

### 5. CLI de setup

Una vez con las variables configuradas y la migración aplicada, ejecutar el wizard interactivo:

```bash
npm run setup
```

El CLI realiza:
- ✓ Valida que todas las variables de entorno estén presentes
- ✓ Crea el primer `widget_token` para tu landing
- ✓ Configura nombre e imagen del bot
- ✓ Carga la KB semilla desde `supabase/seed/kb.json` (si existe)
- ✓ Muestra el snippet de integración listo para copiar

**Output de ejemplo:**
```
════════════════════════════════════════
     Setup Completado ✓
════════════════════════════════════════

  Bot Name:      Sofia
  Token ID:      uuid-xxxx
  Widget Token:  abc123def456...
  Origin:        https://miempresa.com

  Agrega esto a tu landing:

  <script>
    window.WIDGET_TOKEN = "abc123def456...";
  </script>
  <script src="https://miempresa.com/widget.js" defer></script>
```

### 6. Cargar la Knowledge Base

Editar `supabase/seed/kb.example.json` con los servicios, FAQs y casos de uso reales y guardarlo como `supabase/seed/kb.json`. El setup CLI lo carga automáticamente.

Formato de cada entrada:
```json
{
  "title": "Servicio: Nombre del servicio",
  "content": "Descripción detallada del servicio, qué incluye, para quién es ideal...",
  "category": "service",
  "tags": ["tag1", "tag2"]
}
```

Categorías disponibles: `service` · `project_case` · `capability` · `faq` · `pricing`

---

## Variables de entorno

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `OPENROUTER_API_KEY` | ✅ | API key de OpenRouter |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | URL de tu proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Anon key pública de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key de Supabase (solo server) |
| `PII_ENCRYPTION_KEY` | ✅ prod | Clave AES-256 para cifrar datos de contacto. Generar: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ADMIN_SECRET_KEY` | ✅ prod | Clave para proteger el panel admin. Enviar como header `x-admin-key`. Generar igual que PII_ENCRYPTION_KEY |
| `UPSTASH_REDIS_REST_URL` | Recomendada | URL REST de Upstash Redis para rate limiting distribuido |
| `UPSTASH_REDIS_REST_TOKEN` | Recomendada | Token de Upstash Redis |
| `GOOGLE_CLIENT_ID` | Opcional | Para agendamiento en Google Calendar |
| `GOOGLE_CLIENT_SECRET` | Opcional | Para agendamiento en Google Calendar |
| `GOOGLE_REFRESH_TOKEN` | Opcional | Token permanente del flujo OAuth |
| `GOOGLE_CALENDAR_ID` | Opcional | ID del calendario (default: `primary`) |
| `NEXT_PUBLIC_APP_URL` | ✅ | URL pública del deploy (ej: `https://widget.miempresa.com`) |
| `NEXT_PUBLIC_DEMO_WIDGET_TOKEN` | Dev | Token para la demo page en `/` |
| `WIDGET_RATE_LIMIT_RPM` | Opcional | Límite por IP por minuto (default: 20) |
| `WIDGET_TOKEN_RATE_LIMIT_RPH` | Opcional | Límite por token por hora (default: 200) |

---

## Desarrollo local

```bash
npm run dev        # Servidor de desarrollo en http://localhost:3000
npm run build      # Build de producción
npm run typecheck  # Verificar tipos TypeScript
```

---

## Despliegue en Vercel

### Pasos

1. **Importar repositorio** en [vercel.com/new](https://vercel.com/new)

2. **Configurar variables de entorno** en Vercel Dashboard → Settings → Environment Variables. Agregar todas las variables de `.env.example` con sus valores reales.

   > `NEXT_PUBLIC_APP_URL` debe apuntar a tu dominio en Vercel (ej: `https://widget-agent.vercel.app`)

3. **Desplegar.** Vercel detecta automáticamente Next.js.

### Timeouts configurados (`vercel.json`)

| Endpoint | Timeout |
|----------|---------|
| `/api/widget/chat` | 30s |
| `/api/widget/summary` | 30s |
| `/api/appointments` | 15s |

> El plan Hobby de Vercel tiene un límite de 10s. Para estos endpoints necesitas **Vercel Pro** (15s+) o usar el plan con `maxDuration: 30`.

### Post-deploy

1. Actualizar `NEXT_PUBLIC_APP_URL` con el dominio real
2. Actualizar `GOOGLE_REDIRECT_URI` con el dominio real si usas Calendar
3. Volver a ejecutar `npm run setup` con las nuevas URLs para generar tokens de producción

---

## Integración en la Landing Page

### Opción A — iframe (cualquier sitio, recomendada para sitios no-React)

```html
<!-- En cualquier landing page HTML -->
<iframe
  src="https://TU_DOMINIO.vercel.app/embed?token=TU_WIDGET_TOKEN"
  style="position:fixed; bottom:0; right:0; width:400px; height:100vh; border:none; z-index:9999;"
  allow="microphone"
  title="Asistente de consultoría"
></iframe>
```

> **Nota:** Requiere crear la ruta `/embed` en el proyecto (ver Roadmap).

### Opción B — Componente React (si tu landing usa Next.js o React)

Instalar el paquete o copiar el componente directamente:

```bash
# En tu proyecto de landing (si es Next.js)
# Copiar src/features/widget/components/WidgetLauncher.tsx y sus dependencias
```

Uso:

```tsx
import { WidgetLauncher } from './WidgetLauncher'

export default function LandingPage() {
  return (
    <>
      {/* ... tu landing page ... */}

      <WidgetLauncher
        token="TU_WIDGET_TOKEN"
        botName="Sofia"
        botAvatarUrl="https://tudominio.com/avatar-sofia.jpg"
        welcomeMessage="¡Hola! Soy Sofia. ¿En qué te puedo ayudar hoy?"
      />
    </>
  )
}
```

### Props del WidgetLauncher

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| `token` | `string` | requerido | Widget token generado por el CLI o panel admin |
| `botName` | `string` | `'Asistente'` | Nombre del bot que se muestra en el chat |
| `botAvatarUrl` | `string` | — | URL de la imagen del avatar del bot |
| `welcomeMessage` | `string` | Mensaje genérico | Primer mensaje del bot al abrir el widget |
| `primaryColor` | `string` | — | Color primario (preparado para theming futuro) |

### Obtener el widget token

1. Ejecutar `npm run setup` (genera el primer token interactivamente)
2. O crear desde el panel admin: `https://TU_DOMINIO/tokens`

Cada token está ligado a un `allowed_origin`. Si la landing está en `https://miempresa.com`, el token solo funciona desde esa URL.

---

## Panel de Administración

Acceso: `https://TU_DOMINIO/` → links a `/kb`, `/tokens`, `/leads`, `/logs`

**Requiere header `x-admin-key: TU_ADMIN_SECRET_KEY`** en el navegador. Usar una extensión como [ModHeader](https://modheader.com) para enviarlo, o proteger la ruta con una VPN/IP allowlist desde Vercel.

| Sección | Ruta | Descripción |
|---------|------|-------------|
| Knowledge Base | `/kb` | CRUD de servicios, FAQs, casos de uso |
| Tokens | `/tokens` | Crear/desactivar tokens por landing |
| Leads | `/leads` | Ver leads capturados (datos cifrados en DB) |
| Logs | `/logs` | Errores de uso: inyecciones, rate limits, fallos de API |

---

## Seguridad

El widget implementa múltiples capas de protección:

```
Request del visitante
  ↓
[Proxy (middleware)]   → 401 si no tiene x-admin-key (solo rutas admin)
  ↓
[Widget Token Validator] → 401 si token inexistente/inactivo o origin no coincide
  ↓
[Rate Limiter IP]      → 429 si supera 20 req/min por IP
  ↓
[Rate Limiter Token]   → 429 si supera 200 req/hora por token
  ↓
[Prompt Injection Guard] → bloquea intentos de manipulación del sistema
  ↓
[Scope Guard]          → declina preguntas no relacionadas con consultoría
  ↓
[PII Input Filter]     → limpia datos sensibles del input antes del modelo
  ↓
Modelo (OpenRouter)
  ↓
[PII Output Filter]    → limpia PII de la respuesta antes de enviarla
  ↓
Response al cliente
```

**SSRF Protection:** El `landingReader` solo permite URLs `https://` públicas. Bloquea `localhost`, rangos privados (10.x, 192.168.x, 172.16-31.x), AWS metadata (169.254.x) y loopback IPv6.

**Datos de contacto:** Cifrados con AES-256-CBC. `PII_ENCRYPTION_KEY` es obligatoria en producción (falla con error 500 si no está configurada).

---

## API Reference

### Widget endpoints (públicos, requieren Bearer token)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/widget/chat` | Chat con streaming. Body: `{ messages, sessionId, sourceUrl }` |
| `POST` | `/api/widget/session` | Crear/recuperar sesión. Body: `{ anonId, tokenId, sourceUrl }` |
| `POST` | `/api/widget/leads` | Guardar lead. Body: `{ sessionId, name, email, privacyAccepted: true, ... }` |
| `POST` | `/api/widget/summary` | Generar resumen de sesión. Body: `{ sessionId }` |
| `GET` | `/api/widget/summary` | Obtener resumen. Query: `?sessionId=xxx` |
| `POST` | `/api/widget/transcribe` | STT. FormData: `audio` (webm/mp4/ogg/wav/mp3, max 10MB) |
| `GET` | `/api/appointments` | Slots disponibles. Query: `?date=YYYY-MM-DD` |

### Admin endpoints (requieren `x-admin-key` header)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/admin/tokens` | Listar tokens |
| `POST` | `/api/admin/tokens` | Crear token. Body: `{ label, allowed_origin, bot_name? }` |
| `PATCH` | `/api/admin/tokens` | Actualizar token. Body: `{ id, is_active?, bot_name?, label? }` |
| `GET` | `/api/admin/kb` | Listar entradas KB |
| `POST` | `/api/admin/kb` | Crear entrada KB |
| `PATCH` | `/api/admin/kb` | Actualizar entrada KB |
| `DELETE` | `/api/admin/kb` | Eliminar entrada KB. Query: `?id=xxx` |

### Endpoint público

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/admin/tokens/validate` | Valida token desde el widget. Body: `{ token }` |

---

## Roadmap

- [ ] Ruta `/embed` para integración vía iframe sin dependencias React
- [ ] Bundle standalone `widget.js` para integración con `<script>`
- [ ] TTS — respuesta en audio del bot
- [ ] Dashboard de analytics de conversaciones
- [ ] Exportación de leads a CSV
- [ ] Soporte multi-idioma

---

## Licencia

MIT
