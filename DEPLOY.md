# Despliegue en VPS (Dockploy + Traefik)

## Cambios ya aplicados
- `output: 'standalone'` en `next.config.ts`
- `Dockerfile` multi-stage con build args para vars `NEXT_PUBLIC_*`
- `.dockerignore`

> El build del Dockerfile usa `npm run build` completo, que incluye
> `tsx scripts/build-widget.ts` (esbuild → `public/widget.js`) antes de `next build`.

## Checklist antes del primer deploy

### 1. Supabase Dashboard → Auth → URL Configuration
- [ ] Site URL: `https://tu-dominio.com`
- [ ] Redirect URLs: agregar `https://tu-dominio.com/**`

### 2. Google Cloud Console → OAuth → Redirect URIs
- [ ] Agregar `https://tu-dominio.com/api/auth/google/callback`

### 3. Dockploy — Build Arguments
Se pasan al `docker build` (se hornean en el bundle):

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` |
| `NEXT_PUBLIC_APP_URL` | `https://tu-dominio.com` |
| `NEXT_PUBLIC_DEMO_WIDGET_TOKEN` | token generado con `npm run setup` |

### 4. Dockploy — Environment Variables
Variables de runtime (nunca se incluyen en la imagen):

| Variable | Notas |
|---|---|
| `OPENROUTER_API_KEY` | openrouter.ai/settings/keys |
| `SUPABASE_SERVICE_ROLE_KEY` | Dashboard → Settings → API |
| `PII_ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ADMIN_SECRET_KEY` | mismo método que PII_ENCRYPTION_KEY |
| `UPSTASH_REDIS_REST_URL` | console.upstash.com |
| `UPSTASH_REDIS_REST_TOKEN` | console.upstash.com |
| `GOOGLE_CLIENT_ID` | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | `https://tu-dominio.com/api/auth/google/callback` |
| `GOOGLE_REFRESH_TOKEN` | generado con `node scripts/get-google-token.mjs` |
| `GOOGLE_CALENDAR_ID` | `primary` o ID específico |
| `WHISPER_MODEL` | default: `openai/whisper-1` |
| `TTS_ENABLED` | `false` |
| `WIDGET_RATE_LIMIT_RPM` | default: `20` |
| `WIDGET_TOKEN_RATE_LIMIT_RPH` | default: `200` |

### 5. Dockploy — General
- [ ] Puerto interno: `3000`
- [ ] Build context: raíz del repo (donde está el `Dockerfile`)

## Migración futura a Postgres en VPS
Cuando se abandone Supabase, los cambios serán en `src/lib/supabase/`.
Upstash Redis puede sustituirse por Redis self-hosted cambiando solo
`@upstash/ratelimit` + `@upstash/redis` por `ioredis`.
