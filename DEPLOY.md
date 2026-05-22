# Deploy — widget-agent

## Arquitectura actual

- **Build:** GitHub Actions (7 GB RAM) → imagen Docker → GHCR (`ghcr.io/gbandala/widget-agent:latest`, público)
- **Runtime:** VPS Hetzner CPX21 `5.78.221.16` — usuario `gabriel` (grupo `docker`)
- **Proxy:** Traefik v3 vía Dokploy en red `dokploy-network`
- **Dominio:** `widget.clariifica.com` (Cloudflare proxied → VPS)
- **Env vars runtime:** `/etc/widget-agent.env` en la VPS (chmod 600)

> **Importante:** No crear servicio en Dokploy para widget-agent. Dokploy genera config de Traefik que conflictúa con los labels del contenedor. Este app se gestiona 100% vía GitHub Actions.

---

## Deploy automático

Cualquier push a `main` dispara `.github/workflows/docker-build.yml`:

1. Build imagen Docker con `NEXT_PUBLIC_*` como build-args (se hornean en el bundle)
2. Push a `ghcr.io/gbandala/widget-agent:latest`
3. SSH a VPS → `docker pull` + `docker stop/rm` + `docker run` con labels Traefik

```powershell
git push origin main  # eso es todo
```

---

## Setup desde cero

### Prerequisitos en la VPS

```bash
# gabriel debe estar en grupo docker (solo una vez)
sudo usermod -aG docker gabriel
```

### Crear /etc/widget-agent.env en la VPS

Desde PowerShell local — crear el archivo y subirlo vía SCP:

```powershell
# 1. Crear archivo local con los valores (NO usar heredoc en PowerShell via SSH — CRLF rompe el delimitador)
# Editar widget-agent.env localmente (ya está en .gitignore)

# 2. Subir y mover
scp widget-agent.env gabriel@5.78.221.16:/home/gabriel/widget-agent.env
ssh gabriel@5.78.221.16 "sudo mv /home/gabriel/widget-agent.env /etc/widget-agent.env && sudo chmod 600 /etc/widget-agent.env"
```

Variables requeridas:

```env
NODE_ENV=production
PORT=3000
OPENROUTER_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=https://widget.clariifica.com
NEXT_PUBLIC_DEMO_WIDGET_TOKEN=
ADMIN_SECRET_KEY=
PII_ENCRYPTION_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://widget.clariifica.com/api/auth/google/callback
GOOGLE_REFRESH_TOKEN=
GOOGLE_CALENDAR_ID=primary
APPOINTMENTS_AVAILABLE_DAYS=1,2,3,4,5,6
APPOINTMENTS_START_HOUR=15:00
APPOINTMENTS_END_HOUR=20:00
APPOINTMENTS_TIMEZONE=America/Mexico_City
```

### Secrets en GitHub

`github.com/gbandala/widget-agent` → Settings → Secrets → Actions:

| Secret | Valor |
|--------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key de Supabase |
| `NEXT_PUBLIC_APP_URL` | `https://widget.clariifica.com` |
| `NEXT_PUBLIC_DEMO_WIDGET_TOKEN` | Token demo del widget |
| `VPS_HOST` | `5.78.221.16` |
| `VPS_USER` | `gabriel` (no root — root SSH está deshabilitado) |
| `VPS_SSH_KEY` | Contenido completo de `~/.ssh/id_ed25519` |

### Paquete GHCR público

Tras el primer build exitoso:
`github.com/gbandala` → Packages → `widget-agent` → Package settings → Change visibility → **Public**

---

## Verificar estado

```powershell
# Contenedor corriendo
ssh gabriel@5.78.221.16 "sudo docker ps --filter name=widget-agent"

# Logs de arranque
ssh gabriel@5.78.221.16 "sudo docker logs widget-agent --tail 50"

# Confirmar red Traefik
ssh gabriel@5.78.221.16 "sudo docker inspect widget-agent --format '{{json .NetworkSettings.Networks}}'"
```

## Rollback

```bash
# En la VPS
sudo docker stop widget-agent && sudo docker rm widget-agent
sudo docker run -d --name widget-agent --restart unless-stopped \
  --network dokploy-network \
  --env-file /etc/widget-agent.env \
  --label "traefik.enable=true" \
  --label "traefik.http.routers.widget-agent.rule=Host(\`widget.clariifica.com\`)" \
  --label "traefik.http.routers.widget-agent.entrypoints=websecure" \
  --label "traefik.http.routers.widget-agent.tls.certresolver=letsencrypt" \
  --label "traefik.http.services.widget-agent.loadbalancer.server.port=3000" \
  ghcr.io/gbandala/widget-agent:<sha-o-tag-anterior>
```

---

## Google Calendar — activar agendamiento (pendiente)

El `GOOGLE_REFRESH_TOKEN` debe obtenerse una sola vez corriendo el script OAuth localmente:

```bash
node scripts/get-google-token.mjs
# Abre browser → autentica con Google → imprime el refresh token
```

Requiere `http://localhost:3001/callback` como URI autorizado en Google Cloud Console.

Una vez obtenido, agregarlo a `/etc/widget-agent.env` en la VPS y reiniciar:

```bash
ssh gabriel@5.78.221.16 "sudo docker restart widget-agent"
```

---

## Migración futura

- **Supabase → Postgres propio:** cambios en `src/lib/supabase/`
- **Upstash → Redis self-hosted:** reemplazar `@upstash/ratelimit` + `@upstash/redis` por `ioredis`
