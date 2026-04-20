# Lecciones Técnicas — Widget Agent

Registro de problemas no obvios encontrados durante el desarrollo, con causa raíz y fix.
Útil para onboarding, debugging futuro y decisiones de arquitectura.

---

## React / Next.js

### React Strict Mode rompe `useRef` como guard de init
**Síntoma:** Session init no se ejecuta en el segundo mount (el real). El chat queda en estado loading indefinido.
**Causa:** `initRef.current = true` persiste entre el desmontaje/remontaje que Strict Mode hace en desarrollo. El segundo mount (el real) ve el ref en `true` y omite el init.
**Fix correcto:** Patrón `cancelled` flag local al closure del useEffect:
```ts
useEffect(() => {
  let cancelled = false
  async function init() {
    // ...
    if (cancelled) return
    setState(value)
  }
  init()
  return () => { cancelled = true }
}, [deps])
```
El flag es creado de nuevo en cada invocación del efecto — no persiste entre mounts.

---

### Tailwind v4 no garantiza color de texto en inputs sin clase explícita
**Síntoma:** Texto invisible en formularios (blanco sobre blanco) dependiendo del tema del browser.
**Causa:** Sin `text-gray-900`, los `<input>`, `<textarea>` y `<select>` heredan el color del sistema. En modo oscuro o temas con `color-scheme: dark`, el texto es blanco.
**Fix:** Siempre agregar `text-gray-900 bg-white` a todos los campos de formulario.

---

### Next.js App Router: `searchParams` en Server Components es async en Next 16
**Síntoma:** Warning/error al acceder `searchParams.token` directamente.
**Fix:** `const { token } = await searchParams` (con await).

---

## Browser / Fetch

### Chromium omite el header `Origin` en fetch same-origin
**Síntoma:** Token validation falla con "missing origin" cuando el widget en `/embed` llama a `/api/widget/chat` en el mismo servidor.
**Causa:** El spec de Fetch dice que `Origin` se omite en same-origin requests. Chromium lo cumple.
**Fix:** Enviar siempre `x-source-origin: <parentSiteOrigin>` como header explícito desde el widget. Todos los endpoints deben leer `x-source-origin || origin`.
```ts
const origin = req.headers.get('x-source-origin') || req.headers.get('origin') || ''
```

---

### `document.fonts.ready` no resuelve en iframes con fuentes cross-origin
**Síntoma:** `page.screenshot()` de Playwright cuelga indefinidamente cuando el page tiene iframes con Google Fonts u otras fuentes externas.
**Causa:** Playwright espera `document.fonts.ready` antes de capturar. En iframes con fuentes bloqueadas por CORS o de origen cruzado, la promise nunca resuelve.
**Fix:** Bloquear fuentes en Playwright + mockear `document.fonts`:
```ts
await page.route('**/*.woff*', r => r.abort())
await page.route('**/*.ttf', r => r.abort())
await page.addInitScript(() => {
  Object.defineProperty(document, 'fonts', {
    get: () => ({ ready: Promise.resolve(), check: () => true, status: 'loaded' }),
    configurable: true,
  })
})
```

---

## Playwright

### `.fill()` no activa el `onChange` de React
**Síntoma:** Input aparece con valor en pantalla pero el state de React no se actualiza. Botón de submit permanece `disabled`.
**Causa:** `.fill()` de Playwright setea el valor directamente sin disparar eventos de teclado. React escucha `input` events, pero algunos builds/versiones no los detectan.
**Fix:** Usar `pressSequentially(value, { delay: 20 })` para inputs React que controlen estado de botones.

---

## Windows / Entorno

### `taskkill` falla en Git Bash (Windows)
**Síntoma:** `taskkill /PID 1234 /F` sale con error "Argumento u opción no válido".
**Causa:** Git Bash transforma `/PID` como path de Unix.
**Fix:** Usar PowerShell: `powershell -Command "Stop-Process -Id 1234 -Force"`

### Next.js con Turbopack falla en USB/junction points (Windows)
**Causa:** Turbopack crea symlinks/junction points que Windows restringe en USB o rutas con permisos especiales.
**Fix:** `pnpm dev -- --no-turbopack`

---

## OpenRouter / AI SDK

### OpenRouter no soporta audio transcriptions
**Síntoma:** `POST /api/v1/audio/transcriptions` devuelve 500 con HTML de error.
**Causa:** OpenRouter solo proxea Chat Completions y Embeddings. No Whisper ni otros endpoints de OpenAI.
**Fix:** Usar Web Speech API nativa del browser para STT, o llamar a OpenAI directamente con `OPENAI_API_KEY`.

### `@ai-sdk/openai` v3 usa Responses API — OpenRouter no lo soporta
**Síntoma:** Requests fallan con error de formato de respuesta.
**Causa:** `createOpenAI` de la nueva versión usa el Responses API de OpenAI que OpenRouter no implementa.
**Fix:** Usar `@ai-sdk/openai-compatible` con `createOpenAICompatible` — fuerza Chat Completions API.

### AI SDK v6: `inputSchema` en tools, no `parameters`
```ts
// ✅ correcto
tool({ inputSchema: z.object({ ... }), execute: async (args) => {} })
// ❌ rompe en AI SDK v6
tool({ parameters: z.object({ ... }), execute: async (args) => {} })
```

---

## Supabase

### Trailing slash en `allowed_origin` rompe comparación de origen
**Síntoma:** Token de `https://clariifica.com/` (con slash final) no valida requests de `https://clariifica.com` (sin slash).
**Fix:** Normalizar antes de comparar:
```ts
const normalizeOrigin = (o: string) => o.replace(/\/+$/, '').toLowerCase()
```

### `PATCH /api/admin/tokens` no actualizaba `allowed_origin`
El handler PATCH original solo mapeaba `is_active`, `bot_name`, `bot_avatar_url`, `label`.
Si se necesita cambiar `allowed_origin`, hacerlo directamente en Supabase Dashboard o agregar el campo al handler.

---

## Arquitectura de embed

### Pasar `sourceUrl` como parámetro de URL al iframe
El iframe de `/embed` no puede leer `window.parent.location` (cross-origin). El `sourceUrl` (URL de la página host) se pasa como query param al cargar el iframe desde `widget.js`:
```js
iframe.src = `${baseUrl}/embed?token=${token}&sourceUrl=${encodeURIComponent(window.location.href)}`
```
El hook `useWidgetChat` lo recibe como prop y lo envía en cada request como `x-source-origin`.

### `widget.js` autodescubre su `baseUrl` desde `script.src`
```js
const script = document.currentScript
const baseUrl = new URL(script.src).origin
```
Así funciona en producción (Vercel) y local sin cambiar la URL hardcodeada.
