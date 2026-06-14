import { Resend } from 'resend'
import { readFileSync } from 'fs'

// Load .env.local manually
const envVars = readFileSync('.env.local', 'utf8').split('\n')
for (const line of envVars) {
  const [k, ...v] = line.split('=')
  if (k && v.length) process.env[k.trim()] = v.join('=').trim()
}

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'Serena de Clarifica <serena@clariifica.com>'
const TO = 'bandala@outlook.com'

const dx = {
  zeroDimension: 'temporal',
  zeroDimensionLabel: 'Temporal — toda la operación depende del fundador para funcionar',
  dimensionLevels: { financiero: 'medio', temporal: 'bajo', cognitivo: 'medio', relacional: 'medio' },
  top3Risks: [
    'Dependencia total del fundador: si no estás, la operación se detiene. Cada semana que sigue así es una semana que no construyes nada escalable.',
    'Crecimiento atado a tu esfuerzo personal: doblar la facturación requiere doblar tus horas. La física no cuadra con el objetivo de escalar.',
    'Pipeline sin sistema: los clientes llegan por referidos o por tu contacto directo. No hay motor de adquisición autónomo.',
  ],
  transformationIn90Days: [
    'Liberar 10-15h semanales del fundador mediante protocolos de delegación y decisión',
    'Al menos 2 procesos operativos corriendo sin supervisión directa',
    'Sistema de seguimiento a prospectos que no depende de ti para activarse',
  ],
}

const summary = 'Gabriel lleva 8 años en logística, factura 4M al año. El problema central: todo depende de él para operar — si no está, el negocio se para. Necesita escalar pero la estructura actual lo tiene atrapado en el día a día.'

// ── helpers duplicados aquí para no depender del build ────────────────────────

const NAMES = { financiero: 'Financiero', temporal: 'Temporal', cognitivo: 'Cognitivo', relacional: 'Relacional' }

function levelBar(level, isZero) {
  const filled = level === 'alto' ? 4 : level === 'medio' ? 2 : 1
  const color = isZero ? '#92400E' : level === 'alto' ? '#22C55E' : level === 'medio' ? '#F59E0B' : '#92400E'
  const dots = [1,2,3,4].map(i =>
    `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:3px;background:${i<=filled?color:'#e2e8f0'}"></span>`
  ).join('')
  const label = isZero ? `<span style="color:#92400E;font-size:11px;font-weight:700;margin-left:4px">CERO ⚡</span>` : ''
  return `<span style="vertical-align:middle">${dots}</span>${label}`
}

function summaryHtml(s) {
  return s.split('\n').filter(l=>l.trim()).map(l=>`<p style="margin:0 0 8px;font-size:14px;color:#334155;line-height:1.7">${l}</p>`).join('')
}

function privacy() {
  return `<tr><td style="background:#fff;padding:20px 36px 0"><div style="border-top:1px solid #e2e8f0"></div></td></tr>
  <tr><td style="background:#fff;border-radius:0 0 12px 12px;padding:16px 36px 28px">
    <p style="margin:0 0 8px;font-size:11px;color:#64748b;line-height:1.6"><strong style="color:#0f172a">Aviso de Privacidad —</strong> Tus datos son tratados por <strong>Clarifica</strong> (México) para darte seguimiento sobre los servicios solicitados. Almacenados cifrados, no compartidos con terceros. Derechos ARCO: <a href="mailto:contacto@clariifica.com" style="color:#0891B2;text-decoration:none">contacto@clariifica.com</a></p>
    <p style="margin:0;font-size:11px;color:#94a3b8">Si no iniciaste esta conversación, ignora este correo.</p>
  </td></tr>`
}

function wrap(rows) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px">${rows}</table>
</td></tr></table></body></html>`
}

// ── VARIANTE A ─────────────────────────────────────────────────────────────────
const htmlA = wrap(`
  <tr><td style="background:#0F172A;border-radius:12px 12px 0 0;padding:32px 36px 28px">
    <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#0891B2;font-weight:600">CLARIFICA</p>
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#F8FAFC;line-height:1.3">Gabriel, tu negocio tiene un techo.<br>Acabas de dar el primer paso para verlo.</h1>
    <p style="margin:0;font-size:14px;color:#94A3B8">Aquí tienes el resumen de tu conversación y un pre-diagnóstico de tu situación.</p>
  </td></tr>
  <tr><td style="background:#fff;padding:24px 36px 0">
    <p style="margin:0 0 10px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#0891B2;font-weight:600">Lo que conversamos</p>
    <div style="background:#f8fafc;border-left:3px solid #0891B2;border-radius:0 6px 6px 0;padding:16px 20px">${summaryHtml(summary)}</div>
  </td></tr>
  <tr><td style="background:#fff;padding:24px 36px 0">
    <p style="margin:0 0 10px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#0891B2;font-weight:600">Pre-diagnóstico Excedente Estratégico</p>
    <div style="background:#0F172A;border-radius:10px;padding:20px 24px">
      <p style="margin:0 0 14px;font-size:12px;color:#94A3B8">Estimado a partir de tu conversación con Serena. El diagnóstico completo se realiza en la sesión.</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${['financiero','temporal','cognitivo','relacional'].map(dim => {
          const isZero = dx.zeroDimension === dim
          return `<tr>
            <td style="padding:5px 0;width:110px;font-size:13px;font-weight:${isZero?'700':'400'};color:${isZero?'#F8FAFC':'#94A3B8'}">${NAMES[dim]}</td>
            <td style="padding:5px 0">${levelBar(dx.dimensionLevels[dim], isZero)}</td>
          </tr>`
        }).join('')}
      </table>
      <div style="margin-top:16px;border-top:1px solid rgba(255,255,255,0.08);padding-top:14px">
        <p style="margin:0 0 4px;font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:1px">Cero Estratégico probable</p>
        <p style="margin:0;font-size:14px;font-weight:700;color:#92400E">⚡ ${dx.zeroDimensionLabel}</p>
      </div>
    </div>
  </td></tr>
  <tr><td style="background:#fff;padding:20px 36px 0">
    <p style="margin:0 0 10px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#0891B2;font-weight:600">Potencial de transformación — primeros 90 días</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${dx.transformationIn90Days.map(kpi => `
        <tr><td style="padding:6px 0">
          <span style="display:inline-block;width:20px;height:20px;background:#0891B2;border-radius:50%;text-align:center;line-height:20px;font-size:11px;font-weight:700;color:#0F172A;margin-right:10px;vertical-align:middle">→</span>
          <span style="font-size:14px;color:#334155;vertical-align:middle">${kpi}</span>
        </td></tr>`).join('')}
    </table>
  </td></tr>
  <tr><td style="background:#fff;padding:24px 36px 0">
    <p style="margin:0 0 14px;font-size:14px;color:#334155;line-height:1.6">
      El diagnóstico completo toma <strong>30 minutos</strong>. Al terminar tienes el mapa exacto de dónde está el techo, qué dimensión lo sostiene, y cuál es la primera palanca para moverlo.
    </p>
    <a href="https://clariifica.com" style="display:inline-block;background:#0891B2;color:#0F172A;text-decoration:none;padding:13px 28px;border-radius:8px;font-size:15px;font-weight:700">Agendar diagnóstico gratuito →</a>
  </td></tr>
  ${privacy()}`)

// ── VARIANTE B ─────────────────────────────────────────────────────────────────
const htmlB = wrap(`
  <tr><td style="background:#0F172A;border-radius:12px 12px 0 0;padding:32px 36px 28px">
    <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#92400E;font-weight:600">CLARIFICA — REPORTE DE ALERTA</p>
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#F8FAFC;line-height:1.3">Gabriel, hay señales en tu negocio<br>que cuestan más de lo que parecen.</h1>
    <p style="margin:0;font-size:14px;color:#94A3B8">Serena detectó patrones en tu conversación. Te los compartimos.</p>
  </td></tr>
  <tr><td style="background:#fff;padding:24px 36px 0">
    <p style="margin:0 0 10px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#0891B2;font-weight:600">Lo que conversamos</p>
    <div style="background:#f8fafc;border-left:3px solid #0891B2;border-radius:0 6px 6px 0;padding:16px 20px">${summaryHtml(summary)}</div>
  </td></tr>
  <tr><td style="background:#fff;padding:24px 36px 0">
    <p style="margin:0 0 10px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#92400E;font-weight:600">3 señales detectadas en tu negocio</p>
    ${dx.top3Risks.map((risk, i) => `
      <div style="margin-bottom:12px;background:#fffbeb;border-left:3px solid ${i<2?'#92400E':'#B45309'};border-radius:0 8px 8px 0;padding:12px 16px">
        <span style="font-size:16px;margin-right:8px">${i<2?'🔴':'🟡'}</span>
        <span style="font-size:13px;color:#334155;line-height:1.6">${risk}</span>
      </div>`).join('')}
  </td></tr>
  <tr><td style="background:#fff;padding:16px 36px 0">
    <div style="background:#0F172A;border-radius:10px;padding:20px 24px">
      <p style="margin:0 0 6px;font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:1px">El Cero Estratégico en tu caso</p>
      <p style="margin:0 0 14px;font-size:15px;font-weight:700;color:#92400E">⚡ ${dx.zeroDimensionLabel}</p>
      <p style="margin:0 0 16px;font-size:13px;color:#94A3B8;line-height:1.6">
        Mientras esta dimensión esté en cero, el resto de tus esfuerzos se multiplica por cero. No es falta de trabajo — es geometría.
      </p>
      <p style="margin:0 0 10px;font-size:12px;color:#0891B2;font-weight:600;text-transform:uppercase;letter-spacing:1px">Lo que cambia cuando se resuelve:</p>
      ${dx.transformationIn90Days.map(kpi => `<p style="margin:0 0 6px;font-size:13px;color:#F8FAFC">✓ ${kpi}</p>`).join('')}
    </div>
  </td></tr>
  <tr><td style="background:#fff;padding:24px 36px 0">
    <p style="margin:0 0 14px;font-size:14px;color:#334155;line-height:1.6">
      El diagnóstico de 30 minutos hace exactamente esto: mapa del techo, primera palanca, hoja de ruta. Sin costo.
    </p>
    <a href="https://clariifica.com" style="display:inline-block;background:#1D4ED8;color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-size:15px;font-weight:700">Ver mi diagnóstico completo →</a>
  </td></tr>
  ${privacy()}`)

// ── Enviar ambas ───────────────────────────────────────────────────────────────
const [rA, rB] = await Promise.all([
  resend.emails.send({ from: FROM, to: TO, subject: '[VARIANTE A] Gabriel, tu negocio tiene un techo. Aquí empieza el mapa.', html: htmlA }),
  resend.emails.send({ from: FROM, to: TO, subject: '[VARIANTE B] Gabriel, 3 señales que Serena detectó en tu negocio', html: htmlB }),
])

console.log('Variante A:', rA.error ?? 'OK ✅', rA.data?.id)
console.log('Variante B:', rB.error ?? 'OK ✅', rB.data?.id)
