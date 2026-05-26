# Lecciones Aprendidas — widget-agent

Bugs y patrones descubiertos en producción o en pruebas. Se propagan a sw-factory para blindar futuros proyectos.

---

## WL-001 · `promptGuard` — cubrir todos los determinantes en patrones de bloqueo

**Fecha:** 2026-05-26  
**Contexto:** Unit tests del guard de prompt injection.  
**Bug:** El patrón `"Ignora las directrices"` no era bloqueado. El regex solo cubría `"tus"`:  
```ts
// ❌ Bug — solo bloquea "Ignora tus instrucciones"
/ignora\s+(tus\s+)?(instrucciones|reglas|directrices)/i
```  
**Fix:**  
```ts
// ✅ Cubre tus/las/sus/mis/estas/esas
/ignora\s+(?:(?:tus|las|sus|mis|estas|esas)\s+)?(instrucciones|reglas|directrices)/i
```  
**Regla:** Los patrones de prompt injection deben cubrir variantes de determinantes del español: `tus`, `las`, `sus`, `mis`, `estas`, `esas`, y también el caso sin artículo (`"Ignora instrucciones"`).  
**Archivo:** `src/lib/security/promptGuard.ts`

---

## WL-002 · `scopeGuard` — el flag `/i` no cubre equivalencia de acentos

**Fecha:** 2026-05-26  
**Contexto:** Unit tests del guard de contenido.  
**Bug:** `"inyeccion sql"` (sin acento en la `ó`) no era bloqueado:  
```ts
// ❌ Bug — /i solo cubre ASCII case, no equivalencia de acentos
/\b(ddos|ataque de denegación|exploit|payload malicioso|inyección sql)\b/i
```  
**Fix:**  
```ts
// ✅ Usar clases de caracter para vocales acentuadas
/\b(ddos|ataque de denegaci[oó]n|exploit|payload malicioso|inyecci[oó]n sql)\b/i
```  
**Regla:** El flag `/i` de regex en JavaScript cubre mayúsculas/minúsculas ASCII pero **NO** normaliza acentos. Para palabras con vocales acentuadas, usar clases `[aá]`, `[eé]`, `[ií]`, `[oó]`, `[uú]`.  
**Archivo:** `src/lib/security/scopeGuard.ts`

---

## WL-003 · `piiFilter` — orden de patrones importa: CC antes que teléfono

**Fecha:** 2026-05-26  
**Contexto:** Unit tests del filtro de PII.  
**Bug:** El patrón de teléfono consumía los primeros 8 dígitos de un número de 16 (tarjeta de crédito), dejando el resto sin matchear. Resultado: la tarjeta no era redactada.  
**Causa raíz:** El patrón de teléfono (`\d{3,4}[\s-]?\d{4}`) matcheaba en el interior del número de 16 dígitos antes de que el patrón de CC corriera.  
**Fix:** Mover el patrón de tarjeta de crédito (16 dígitos) **antes** del patrón de teléfono en el array `PII_PATTERNS`.  
```ts
// ✅ Orden correcto en PII_PATTERNS:
// 1. emails
// 2. tarjetas de crédito (16 dígitos) ← ANTES de teléfonos
// 3. teléfonos (7-10 dígitos)
// 4. CURP
// 5. RFC
```  
**Regla:** En arrays de patrones regex, ordenar de más específico/largo a menos específico/corto. Los patrones más cortos deben correr después para no "consumir" partes de patrones más largos.  
**Archivo:** `src/lib/security/piiFilter.ts`

---

## WL-004 · Tests unitarios de guards deben cubrir variantes con/sin acento

**Fecha:** 2026-05-26  
**Contexto:** Los 3 bugs anteriores (WL-001, WL-002, WL-003) hubieran sido detectados antes si los tests cubrían variantes de entrada.  
**Regla:** Para cada patrón de bloqueo/filtrado, los tests deben incluir:
- La variante canónica con acento (`"inyección"`)
- La variante sin acento (`"inyeccion"`)
- Variantes de determinante en español (`"tus"`, `"las"`, `"sus"`)
- Ordenación completa de payloads PII (emails con +, tarjetas con espacios, teléfonos con +52)  
**Archivo de referencia:** `tests/unit/guards.test.ts` — 19 tests, todos pasando tras los fixes.

---

## WL-005 · Widget lazy-load: no confiar en window.postMessage para cierre si el origen no está allowlisted

**Fecha:** 2026-05-26  
**Contexto:** El widget se cierra via `window.postMessage({ type: 'widget-close' })` desde el iframe hacia el parent.  
**Regla:** El handler `message` en el parent **debe verificar `event.origin`** antes de procesar el mensaje. Sin verificación, cualquier página cargada en un iframe puede enviar mensajes de cierre arbitrarios.  
**Cómo aplicar:**  
```ts
window.addEventListener('message', (e) => {
  if (e.origin !== 'https://widget.clariifica.com') return
  if (e.data?.type === 'widget-close') closeWidget()
})
```  
**Archivo:** `src/components/WidgetSerena.tsx` en el parent (clariifica).
