# PRP-001: Consulting AI Widget

> **Estado**: APROBADO
> **Fecha**: 2026-04-15
> **Proyecto**: widget-agent

---

## Objetivo

Construir un widget de chat con IA embebible en cualquier landing page que actúe como consultor inteligente: informa sobre servicios, captura leads cualificados con consentimiento explícito, agenda citas en Google Calendar con Meet, aprende de cada conversación, genera resúmenes descargables del interés del cliente, lee la landing para orientar al visitante, y opera bajo una capa de seguridad que previene inyección de prompts, exposición de datos sensibles y uso no autorizado — todo configurable desde una herramienta de setup inicial.

---

## Por Qué

| Problema | Solución |
|----------|----------|
| Visitantes abandonan sin entender los servicios | Widget 24/7 con KB de la consultoría + lectura de la landing |
| Leads se pierden si no hay persona disponible | Captura contextual de contacto solo ante interés genuino |
| Coordinación de citas manual | Agendamiento directo vía Google Calendar + Meet desde el chat |
| Riesgo legal por datos personales sin aviso | Consentimiento explícito + aviso de privacidad en el flujo |
| Cada conversación es conocimiento perdido | Historial persistente + resumen de interés guardado en DB |
| Widget puede ser usado por sitios no autorizados | Código de acceso único por landing, validado en cada request |
| Conversaciones fuera del tema de la consultoría | Scope guard que declina temas no relacionados con los servicios |
| Fallos de API sin manejo adecuado | Mensajes cordiales + log de errores en DB |

**Valor de negocio**: Reducir tiempo de calificación de leads, aumentar conversiones desde landing, eliminar coordinación manual de citas, cumplir normativa de protección de datos personales (LFPDPPP / RGPD según aplique), reutilizar el widget en múltiples landings bajo control.

---

## Qué

### Criterios de Éxito

**Core**
- [ ] Widget embebible con `<script>` o como componente React en cualquier landing
- [ ] Responde solo preguntas relacionadas con servicios/consultoría (scope guard activo)
- [ ] Usa lenguaje claro, sin jerga técnica innecesaria, adaptado al perfil detectado del visitante
- [ ] Lee el HTML/contenido de la landing para orientar al usuario ("en la sección de servicios, más abajo, encontrarás...")
- [ ] Responde con RAG de la KB de servicios/proyectos/capacidades

**Leads y Contacto**
- [ ] Detecta interés genuino antes de solicitar datos de contacto
- [ ] Muestra aviso de privacidad con checkbox de aceptación explícita
- [ ] Guarda datos cifrados en Supabase
- [ ] Genera y guarda resumen de interés del lead (tópicos consultados, dudas, preferencias detectadas)
- [ ] Permite descargar resumen de la conversación (preguntas + respuestas clave) en PDF o imagen

**Agendamiento**
- [ ] Consulta disponibilidad real en Google Calendar
- [ ] Crea evento + Google Meet link
- [ ] Confirma cita en el chat y envía email de confirmación

**Seguridad y Control**
- [ ] Código de acceso único por landing (widget token) — solo el sitio registrado puede consumir el API
- [ ] Filtro pre-entrada: detecta inyección de prompts, bloquea con mensaje cordial
- [ ] Filtro post-salida: elimina PII y datos internos de la respuesta del modelo
- [ ] Rate limiting por IP y por widget token
- [ ] Widget activable/desactivable desde el panel admin (sin redesploy)
- [ ] Manejo de excepciones con mensajes cordiales: falla de conexión, créditos agotados, timeout
- [ ] Log de errores de uso en DB (tipo, timestamp, sesión, mensaje del error sanitizado)

**Audio (Voice)**
- [ ] Input de audio: el usuario puede enviar un audio y se transcribe antes de enviarse al modelo (Whisper vía OpenRouter)
- [ ] Output de audio (opcional, activable): el modelo responde también en audio (TTS) si el modelo lo soporta

**Setup y Administración**
- [ ] Herramienta CLI/script de setup inicial: configura env, crea tablas, carga KB inicial, configura nombre e imagen del bot
- [ ] Panel admin: CRUD de KB, gestión de leads, historial de conversaciones, estado del widget (on/off), gestión de tokens de landing

**Calidad**
- [ ] `npm run typecheck` sin errores
- [ ] `npm run build` exitoso

---

### Comportamiento Esperado — Happy Path

```
1. Admin ejecuta /setup → configura nombre, avatar, KB inicial, genera widget token
2. Admin activa widget desde panel → estado "active"
3. Landing embebe el widget con su token único
4. Visitante abre el widget → bot saluda con nombre configurado
5. Usuario pregunta algo off-topic → bot declina cordialmente y redirige al tema
6. Usuario pregunta sobre servicios → RAG + referencia a sección de la landing
7. Usuario muestra interés genuino → bot solicita datos + muestra aviso de privacidad
8. Usuario acepta + provee datos → guardados cifrados + resumen generado
9. Bot ofrece slots de disponibilidad real → usuario elige → cita creada + Meet link
10. Usuario puede descargar resumen PDF de su consulta
11. Toda la conversación guardada para análisis
```

### Flujo de Seguridad

```
Request
  ↓
[Widget Token Validator] → 401 si token no existe o está inactivo
  ↓
[CORS / Origin Check] → 403 si origen no coincide con el registrado para el token
  ↓
[Rate Limiter] → 429 si excede límite (por IP y por token)
  ↓
[Scope Guard] → valida que el mensaje sea relevante a los servicios
  ↓
[Prompt Injection Detector] → bloquea patrones de inyección
  ↓
[Input PII Filter] → elimina datos sensibles antes del modelo
  ↓
Modelo (OpenRouter)
  ↓
[Output PII Filter] → elimina datos sensibles en la respuesta
  ↓
[Output Injection Detector] → detecta si el modelo fue manipulado
  ↓
Response → Cliente
```

---

## Contexto

### Stack AI Templates a Usar (en orden)

| Orden | Template | Propósito |
|-------|----------|-----------|
| 00 | `setup-base` | OpenRouter provider + variables de entorno |
| 01 | `chat` | Chat con streaming — núcleo del widget |
| 03 | `historial` | Persistir sesiones y mensajes en Supabase |
| 05 | `tools` | Captura de contacto, agendamiento, descarga de resumen, lectura de landing |
| 06 | `rag` | Búsqueda semántica en KB de servicios/proyectos |

### Integraciones Externas

- **Google Calendar API** — listar disponibilidad, crear eventos con conferencia Meet
- **OpenRouter** — LLM principal (claude-haiku-4.5 para chat, claude-sonnet-4-6 para tools complejas), Whisper para STT, TTS opcional
- **Supabase** — Auth (anónima + admin), DB (historial, leads, KB, logs, tokens), pgvector (RAG)
- **Puppeteer / Cheerio** — scraping del HTML de la landing para orientación contextual
- **@react-pdf/renderer o html2canvas** — generación de PDF/imagen del resumen

---

### Arquitectura Propuesta (Feature-First)

```
src/features/
├── widget/                         # Widget embebible
│   ├── components/
│   │   ├── WidgetLauncher.tsx      # Botón flotante + container
│   │   ├── ChatBubble.tsx          # Mensaje individual
│   │   ├── AudioInput.tsx          # Grabación de audio + transcripción
│   │   ├── PrivacyConsent.tsx      # Aviso de privacidad con checkbox
│   │   ├── AppointmentPicker.tsx   # Selector fecha/hora
│   │   └── SummaryDownload.tsx     # Botón descarga PDF/imagen
│   ├── hooks/
│   │   ├── useWidgetChat.ts        # Estado del chat + streaming
│   │   ├── useLeadCapture.ts       # Detección de interés + captura
│   │   └── useAudioInput.ts        # Grabación y envío de audio
│   └── types/index.ts
│
├── knowledge-base/                 # Base de conocimiento
│   ├── components/
│   │   └── KBAdmin.tsx             # CRUD de entradas de KB
│   ├── services/
│   │   ├── kbService.ts            # Queries a Supabase
│   │   └── embeddingService.ts     # Generar y guardar embeddings
│   └── types/index.ts
│
├── appointments/                   # Agendamiento
│   ├── services/
│   │   └── googleCalendarService.ts
│   └── types/index.ts
│
└── admin/                          # Panel de administración
    ├── components/
    │   ├── WidgetTokenManager.tsx  # Gestión de tokens por landing
    │   ├── WidgetToggle.tsx        # Encender/apagar widget
    │   ├── LeadsTable.tsx          # Vista de leads capturados
    │   └── ErrorLogsTable.tsx      # Logs de errores
    └── types/index.ts

src/app/
├── api/
│   ├── widget/
│   │   ├── chat/route.ts           # Endpoint principal (streaming)
│   │   ├── transcribe/route.ts     # STT: audio → texto
│   │   ├── summary/route.ts        # Generar y guardar resumen de sesión
│   │   └── embed/route.ts          # Servir el bundle del widget
│   ├── appointments/route.ts
│   └── admin/
│       ├── kb/route.ts
│       └── tokens/route.ts         # CRUD de widget tokens
└── (admin)/
    ├── kb/page.tsx
    ├── leads/page.tsx
    ├── tokens/page.tsx
    └── logs/page.tsx

src/lib/
├── security/
│   ├── promptGuard.ts              # Detección inyección de prompts
│   ├── piiFilter.ts                # Filtro PII entrada/salida
│   ├── scopeGuard.ts               # Validar relevancia del mensaje
│   └── widgetTokenValidator.ts     # Autenticación por token de landing
├── google/
│   └── calendarClient.ts
└── landing-reader/
    └── landingReader.ts            # Fetch + parse del HTML de la landing

scripts/
└── setup.ts                        # CLI de setup inicial
```

---

### Modelo de Datos

```sql
-- Habilitar extensiones
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- WIDGET TOKENS (un token por landing)
-- =====================================================
CREATE TABLE widget_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  label TEXT NOT NULL,                      -- Nombre descriptivo ("Landing principal", "Blog")
  allowed_origin TEXT NOT NULL,             -- URL exacta del sitio permitido
  is_active BOOLEAN DEFAULT TRUE,           -- ON/OFF del widget para este token
  bot_name TEXT DEFAULT 'Asistente',
  bot_avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE widget_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage tokens" ON widget_tokens
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- =====================================================
-- KNOWLEDGE BASE
-- =====================================================
CREATE TABLE kb_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT CHECK (
    category IN ('service', 'project_case', 'capability', 'faq', 'pricing')
  ),
  tags TEXT[],
  embedding VECTOR(1536),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kb_entries_embedding ON kb_entries
  USING ivfflat (embedding vector_cosine_ops);

ALTER TABLE kb_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active kb" ON kb_entries
  FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Admins manage kb" ON kb_entries
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- =====================================================
-- SESIONES DEL WIDGET
-- =====================================================
CREATE TABLE widget_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID REFERENCES widget_tokens(id),
  anon_id TEXT NOT NULL,                    -- UUID generado en sessionStorage del visitante
  source_url TEXT,
  intent_detected TEXT CHECK (
    intent_detected IN ('browsing', 'interested', 'lead_captured', 'booked')
  ) DEFAULT 'browsing',
  interest_summary TEXT,                    -- Resumen generado por el modelo al finalizar
  lead_id UUID,
  appointment_id UUID,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE widget_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon insert sessions" ON widget_sessions
  FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Anon update own session" ON widget_sessions
  FOR UPDATE USING (anon_id = (
    current_setting('request.headers', true)::json->>'x-anon-id'
  ));
CREATE POLICY "Admins see all sessions" ON widget_sessions
  FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');

-- =====================================================
-- MENSAJES DEL CHAT
-- =====================================================
CREATE TABLE widget_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES widget_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content TEXT NOT NULL,
  audio_input_url TEXT,                     -- URL del audio original si el input fue voz
  metadata JSONB,                           -- kb_refs, tool calls, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_widget_messages_session ON widget_messages(session_id, created_at ASC);

ALTER TABLE widget_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Insert messages" ON widget_messages FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Admins see messages" ON widget_messages
  FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');

-- =====================================================
-- LEADS / CONTACTOS
-- =====================================================
CREATE TABLE widget_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES widget_sessions(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,                      -- Cifrado con pgcrypto AES-256
  company TEXT,
  phone TEXT,                               -- Cifrado con pgcrypto AES-256
  privacy_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  privacy_accepted_at TIMESTAMPTZ,
  privacy_version TEXT DEFAULT '1.0',
  source_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE widget_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins see leads" ON widget_leads
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- =====================================================
-- CITAS
-- =====================================================
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES widget_sessions(id),
  lead_id UUID REFERENCES widget_leads(id),
  google_event_id TEXT NOT NULL,
  meet_link TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_minutes INT DEFAULT 30,
  status TEXT DEFAULT 'confirmed' CHECK (
    status IN ('confirmed', 'cancelled', 'rescheduled', 'completed')
  ),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage appointments" ON appointments
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- =====================================================
-- LOG DE ERRORES
-- =====================================================
CREATE TABLE widget_error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID,                          -- Puede ser NULL si falla antes de crear sesión
  token_id UUID REFERENCES widget_tokens(id),
  error_type TEXT NOT NULL CHECK (
    error_type IN (
      'api_error',        -- Fallo de OpenRouter / LLM
      'quota_exceeded',   -- Créditos agotados
      'connection_error', -- Timeout / red
      'auth_error',       -- Token inválido / CORS
      'rate_limit',       -- Rate limit activado
      'injection_attempt',-- Inyección de prompt detectada
      'scope_violation',  -- Mensaje fuera de tema
      'tool_error',       -- Fallo de tool (calendar, lead save, etc.)
      'stt_error',        -- Error transcripción de audio
      'unknown'
    )
  ),
  message TEXT,                             -- Mensaje sanitizado (sin PII, sin stack trace en prod)
  source_url TEXT,
  ip_hash TEXT,                             -- Hash de la IP (no se guarda la IP directa)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_error_logs_token ON widget_error_logs(token_id, created_at DESC);
CREATE INDEX idx_error_logs_type ON widget_error_logs(error_type, created_at DESC);

ALTER TABLE widget_error_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins see error logs" ON widget_error_logs
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Insert error logs" ON widget_error_logs FOR INSERT WITH CHECK (TRUE);
```

### Variables de Entorno

```env
# OpenRouter
OPENROUTER_API_KEY=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Google Calendar OAuth2
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
GOOGLE_REFRESH_TOKEN=
GOOGLE_CALENDAR_ID=

# Cifrado PII (AES-256, mín. 32 chars)
PII_ENCRYPTION_KEY=

# Seguridad
WIDGET_RATE_LIMIT_RPM=20          # Requests/min por IP
WIDGET_TOKEN_RATE_LIMIT_RPH=200   # Requests/hora por token

# Audio (STT/TTS)
WHISPER_MODEL=whisper-1           # Modelo de transcripción vía OpenRouter
TTS_ENABLED=false                 # Activar/desactivar respuesta en audio
```

---

## Blueprint (Assembly Line)

> Solo se definen FASES. Las subtareas se generan al entrar a cada fase con `/bucle-agentico`.

### Fase 0: Setup CLI y Scaffolding
**Objetivo**: Script `setup.ts` interactivo que: crea tablas en Supabase, genera el primer `widget_token`, carga KB inicial desde archivos Markdown, configura nombre e imagen del bot. Proyecto Next.js con OpenRouter conectado y dev server funcional.
**Validación**:
- `npx tsx scripts/setup.ts` completa sin errores
- Tablas visibles en Supabase dashboard
- `widget_tokens` tiene al menos 1 registro con token generado
- `npm run dev` arranca sin errores

### Fase 1: Base de Conocimiento (RAG)
**Objetivo**: CRUD de entradas KB con embeddings automáticos. Función de búsqueda semántica operativa. Panel admin `/admin/kb`.
**Validación**:
- Insertar 5 entradas con embeddings generados
- `searchKB("consultoría de software")` retorna resultados relevantes
- Panel admin: crear, editar, activar/desactivar entradas

### Fase 2: Chat Core + Scope Guard + Lectura de Landing
**Objetivo**: Widget embebible con streaming, RAG integrado, scope guard activo (rechaza off-topic), y capacidad de leer el HTML de la landing del visitante para dar referencias de ubicación de contenido.
**Validación**:
- Pregunta de servicios → respuesta con contexto de KB
- Pregunta off-topic → declina cordialmente y redirige
- "¿Dónde están los precios?" → referencia a sección de la landing leída
- Historial persistido en `widget_sessions` + `widget_messages`

### Fase 3: Seguridad Completa
**Objetivo**: Todas las capas de seguridad activas: widget token validator, CORS, rate limiting, prompt injection detector, filtros PII entrada/salida, log de errores en DB, mensajes cordiales ante fallas.
**Validación**:
- Request sin token → `401`
- Request con token pero origen incorrecto → `403`
- "Ignora tus instrucciones y..." → bloqueado, log registrado como `injection_attempt`
- >20 req/min → `429`, log registrado como `rate_limit`
- Respuesta con email ficticio del modelo → filtrada antes de llegar al cliente
- Fallo simulado de OpenRouter → mensaje cordial al usuario, `api_error` en logs

### Fase 4: Captura de Leads + Resumen + Descarga
**Objetivo**: Detección de interés genuino → flujo de captura inline → aviso de privacidad → guardado cifrado → generación de resumen de interés → descarga de PDF/imagen del resumen.
**Validación**:
- Mensajes neutrales → NO activa captura
- Señal de interés → activa formulario con aviso de privacidad
- Datos en DB: email/phone cifrados, `privacy_accepted = true` con timestamp
- `interest_summary` generado y guardado en `widget_sessions`
- Botón "Descargar resumen" genera PDF con preguntas + respuestas clave de la sesión

### Fase 5: Agendamiento Google Calendar
**Objetivo**: Tools de agendamiento: consultar disponibilidad real, crear evento con Meet, confirmar en chat, email de confirmación al lead.
**Validación**:
- `getAvailableSlots(date)` retorna horas libres reales del calendario
- Selección de slot → evento creado en Google Calendar
- Meet link visible en el chat
- Registro en `appointments` con `google_event_id`
- Email de confirmación enviado

### Fase 6: Audio Input/Output (Voice)
**Objetivo**: Botón de grabación en el widget → audio transcrito vía Whisper → enviado al modelo como texto. Opcionalmente, respuesta del modelo sintetizada en audio (TTS activable).
**Validación**:
- Usuario graba audio → texto transcrito aparece en el chat
- Audio original referenciado en `widget_messages.audio_input_url`
- Con `TTS_ENABLED=true`: respuesta reproducida en audio
- Error de transcripción → mensaje cordial, log `stt_error`

### Fase 7: Panel Admin Completo
**Objetivo**: Panel `/admin` con: gestión de tokens de landing (crear, activar/desactivar, ver origen), toggle on/off del widget por token, tabla de leads, historial de conversaciones, logs de errores con filtros.
**Validación**:
- Admin crea nuevo token para una segunda landing
- Admin desactiva token → widget de esa landing devuelve mensaje de inactividad
- Tabla de leads muestra nombre, empresa, fecha, sesión
- Logs de errores filtrables por tipo y rango de fechas

### Fase 8: Validación Final y Embed Público
**Objetivo**: Sistema end-to-end. Bundle del widget publicado como snippet `<script>` embebible en cualquier HTML estático.
**Validación**:
- [ ] `npm run typecheck` sin errores
- [ ] `npm run build` exitoso
- [ ] Flujo completo: pregunta → RAG → interés → lead → cita → confirmación → descarga PDF
- [ ] Widget funciona embebido en HTML plano con `<script src="...">`
- [ ] Token inválido → widget muestra mensaje de configuración pendiente (no error crudo)
- [ ] Widget desactivado → muestra mensaje cordial de "no disponible" en lugar del chat

---

## Gotchas

- [ ] **Widget Token y CORS**: El `allowed_origin` del token debe compararse con el header `Origin` del request, no con `Referer`. El `Origin` es más confiable y difícil de falsificar desde el browser.
- [ ] **Google Calendar OAuth**: Requiere `access_type=offline` para obtener `refresh_token`. El access token expira cada hora — usar `google-auth-library` con auto-refresh. El `refresh_token` solo se entrega una vez, guardarlo en env inmediatamente.
- [ ] **pgvector en Supabase**: Habilitar la extensión `vector` antes de crear la tabla: `CREATE EXTENSION IF NOT EXISTS vector;`
- [ ] **Cifrado PII**: Usar `pgcrypto` con `pgp_sym_encrypt` / `pgp_sym_decrypt` en Supabase, o cifrar en el servidor antes del INSERT. Nunca cifrar en el cliente.
- [ ] **Widget embed como `<script>`**: Compilar un bundle standalone con `esbuild`. El widget NO debe depender del runtime de Next.js del sitio host. Alternativa: iframe sandboxed.
- [ ] **sessionStorage para anon_id**: Usar `sessionStorage` (no `localStorage`) para el identificador del visitante. Se limpia al cerrar la pestaña, respetando la privacidad.
- [ ] **AI SDK 5**: Usar `inputSchema` (no `parameters`) en tools. Usar `stopWhen: stepCountIs(N)` (no `maxSteps`).
- [ ] **Lectura de landing**: El scraping del HTML de la landing debe hacerse una sola vez por sesión (cache en `widget_sessions`). Limitar a ~50KB de contenido para no inflar el contexto del modelo. Usar Cheerio (no Puppeteer) si la landing no requiere JavaScript para renderizar.
- [ ] **Rate limiting**: Usar `@upstash/ratelimit` con Upstash Redis. En desarrollo, puede usarse un `Map` en memoria con TTL manual.
- [ ] **Scope Guard**: El prompt del scope guard debe ser simple y en lenguaje natural para el modelo. Ejemplo: "Solo respondo preguntas sobre los servicios de [empresa]. Si la pregunta no está relacionada, lo digo amablemente y propongo cómo puedo ayudar dentro de mi alcance."
- [ ] **Prompt injection en KB**: Los documentos de KB también pueden contener inyecciones. Sanitizar el contenido al insertar en KB (eliminar patrones como "ignora las instrucciones anteriores").
- [ ] **TTS limitaciones**: No todos los modelos en OpenRouter soportan TTS. Verificar disponibilidad antes de habilitar. Como alternativa usar `Web Speech API` del browser (gratis, sin API key, calidad variable).
- [ ] **Resumen de interés**: El resumen se genera con una llamada separada al modelo al finalizar la sesión (no en streaming). Se guarda en `widget_sessions.interest_summary`. Disparar al detectar inactividad de >5 minutos o al cerrar el widget.
- [ ] **Consentimiento legal**: El texto del aviso de privacidad debe incluir: finalidad del tratamiento, responsable, derechos ARCO/GDPR, plazo de conservación, mecanismo de contacto. Revisar con asesoría legal antes de producción.

---

## Anti-Patrones

- NO guardar emails/teléfonos en texto plano en DB
- NO activar captura de leads en el primer mensaje (requiere señal de interés genuino)
- NO hardcodear tokens de Google Calendar, widget tokens o encryption keys en el código
- NO permitir que el modelo cite nombres de clientes, aunque existan en la KB — instrucción explícita en system prompt
- NO usar `localStorage` para el `anon_id` del widget
- NO guardar IPs directamente — guardar solo un hash (SHA-256) para cumplir privacidad
- NO mostrar stack traces ni mensajes de error técnicos al usuario final
- NO saltar la validación de `allowed_origin` en desarrollo — entrenar el hábito correcto desde el inicio
- NO procesar audios sin validar tipo MIME y tamaño máximo (límite recomendado: 10MB, solo `audio/*`)
- NO generar el resumen de interés sin que el usuario haya tenido al menos 3 intercambios significativos

---

## 🧠 Aprendizajes (Self-Annealing)

> Esta sección crece con cada error encontrado durante la implementación.

*(vacío — se llena durante el desarrollo)*

---

## Notas de Arquitectura

### Mecanismo de Widget Token (Single Consumer)

```
Landing → POST /api/widget/chat
  Headers:
    Authorization: Bearer <widget_token>
    Origin: https://mi-landing.com
    x-anon-id: <uuid-del-visitante>

Servidor:
  1. Busca token en widget_tokens donde token = <widget_token>
  2. Verifica is_active = TRUE
  3. Verifica que request.headers.origin === allowed_origin
  4. Si pasa → procesa. Si falla → 401/403 + log en widget_error_logs
```

### Detección de Interés Genuino

El modelo evalúa el contexto acumulado y llama a `captureLeadTool` cuando detecta:
- Preguntas sobre precios, proceso de contratación, tiempos de entrega
- Frases como "me interesa", "cómo empezamos", "quisiera una propuesta"
- Segunda o tercera pregunta de seguimiento sobre el mismo servicio

La tool no tiene `execute` en el cliente — requiere que el usuario complete el formulario de consentimiento para confirmarla.

### Generación del Resumen de Interés

Al detectar cierre o inactividad de sesión, se hace una llamada separada (no streaming) al modelo:

```
System: "Eres un analista de ventas. Genera un resumen conciso del interés 
del visitante basándote en la conversación. Incluye: servicios consultados, 
dudas principales, nivel de interés detectado, datos relevantes mencionados. 
NO incluyas datos de contacto en el resumen."

User: <historial de la conversación>
```

El resumen se guarda en `widget_sessions.interest_summary` y se usa para:
1. Contexto para el equipo de ventas al recibir el lead
2. Contenido del PDF descargable del visitante

### Respuesta Cordial ante Errores

Todos los errores críticos (API down, quota, timeout) retornan HTTP 200 al cliente con un payload de error estructurado para que el widget muestre un mensaje amigable:

```json
{
  "error": true,
  "errorType": "api_error",
  "message": "En este momento tenemos dificultades técnicas. Por favor intenta de nuevo en unos minutos o escríbenos directamente a contacto@empresa.com",
  "retryable": true
}
```

El error real se guarda en `widget_error_logs` sin exponer detalles al cliente.

### Roles del Sistema

| Rol | Acceso |
|-----|--------|
| `anon` | Chat, lectura KB pública, crear sesión, insertar mensajes |
| `lead` | Mismo que anon + ver su cita |
| `admin` | Todo: gestión KB, tokens, leads, historial completo, logs, toggle widget |

---

*PRP pendiente aprobación. No se ha modificado código.*
