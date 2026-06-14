import { Resend } from 'resend'

const FROM = 'Serena de Clarifica <serena@clariifica.com>'

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY no configurada')
  return new Resend(key)
}

export interface PreDiagnostic {
  zeroDimension: 'financiero' | 'temporal' | 'cognitivo' | 'relacional'
  zeroDimensionLabel: string           // "Temporal — todo depende de ti para operar"
  dimensionLevels: {
    financiero: 'bajo' | 'medio' | 'alto'
    temporal: 'bajo' | 'medio' | 'alto'
    cognitivo: 'bajo' | 'medio' | 'alto'
    relacional: 'bajo' | 'medio' | 'alto'
  }
  top3Risks: [string, string, string]           // Señales de alerta específicas al caso
  transformationIn90Days: [string, string, string] // KPIs concretos de mejora
}

interface WelcomeEmailParams {
  to: string
  leadName?: string
  conversationSummary: string
  sessionId: string
  preDiagnostic?: PreDiagnostic
  variant?: 'A' | 'B'
}

export async function sendWelcomeEmail({
  to,
  leadName,
  conversationSummary,
  sessionId,
  preDiagnostic,
  variant = 'A',
}: WelcomeEmailParams) {
  const firstName = leadName?.split(' ')[0] ?? ''
  const subject = variant === 'A'
    ? `${firstName ? firstName + ', tu' : 'Tu'} negocio tiene un techo. Aquí empieza el mapa.`
    : `${firstName ? firstName + ', ' : ''}3 señales que Serena detectó en tu negocio`

  const html = variant === 'A'
    ? buildVariantA(conversationSummary, preDiagnostic, firstName)
    : buildVariantB(conversationSummary, preDiagnostic, firstName)

  const { data, error } = await getResend().emails.send({ from: FROM, to, subject, html })
  if (error) throw new Error(`Email error: ${error.message}`)
  return data
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function summaryBlock(summary: string): string {
  const lines = summary.split('\n').filter(l => l.trim())
    .map(l => `<p style="margin:0 0 8px;font-size:14px;color:#334155;line-height:1.7">${l}</p>`)
    .join('')
  return `
    <tr><td style="background:#fff;padding:24px 36px 0">
      <p style="margin:0 0 10px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#0891B2;font-weight:600">Lo que conversamos</p>
      <div style="background:#f8fafc;border-left:3px solid #0891B2;border-radius:0 6px 6px 0;padding:16px 20px">${lines}</div>
    </td></tr>`
}

function emailWrapper(rows: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px">
${rows}
</table>
</td></tr></table>
</body></html>`
}

function caseStudyBlock(): string {
  return `
    <tr><td style="background:#fff;padding:20px 36px 0">
      <div style="background:#f8fafc;border-radius:8px;padding:16px 20px;border:1px solid #e2e8f0">
        <p style="margin:0 0 4px;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#64748b;font-weight:600">Ejemplo real</p>
        <p style="margin:0 0 8px;font-size:14px;color:#0f172a;font-weight:600;line-height:1.4">Despacho contable — tablero de rentabilidad por cliente</p>
        <p style="margin:0 0 12px;font-size:13px;color:#475569;line-height:1.6">3 clientes absorbían el 60% del tiempo y generaban solo el 22% del ingreso. El tablero lo detectó en 30 minutos.</p>
        <a href="https://demo.clariifica.com/dsp-x7k2/v2" style="font-size:13px;color:#0891B2;font-weight:600;text-decoration:none">Ver tablero de ejemplo →</a>
      </div>
    </td></tr>`
}

function privacyFooter(): string {
  return `
    <tr><td style="background:#fff;padding:20px 36px 0">
      <div style="border-top:1px solid #e2e8f0"></div>
    </td></tr>
    <tr><td style="background:#fff;border-radius:0 0 12px 12px;padding:16px 36px 28px">
      <p style="margin:0 0 8px;font-size:11px;color:#64748b;line-height:1.6">
        <strong style="color:#0f172a">Aviso de Privacidad —</strong>
        Tus datos son tratados por <strong>Clarifica</strong> (México) para darte seguimiento sobre los servicios de consultoría solicitados. Almacenados cifrados, no compartidos con terceros.
        Derechos ARCO: <a href="mailto:contacto@clariifica.com" style="color:#0891B2;text-decoration:none">contacto@clariifica.com</a> · Conservación: 2 años.
      </p>
      <p style="margin:0;font-size:11px;color:#94a3b8">Si no iniciaste esta conversación, ignora este correo.</p>
    </td></tr>`
}

function levelBar(level: 'bajo' | 'medio' | 'alto', isZero: boolean): string {
  const filled = level === 'alto' ? 4 : level === 'medio' ? 2 : 1
  // Bright amber/green visible on dark navy (#0F172A) background
  const color = isZero ? '#F59E0B' : level === 'alto' ? '#4ADE80' : level === 'medio' ? '#FBBF24' : '#F59E0B'
  const dots = [1, 2, 3, 4].map(i =>
    `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:3px;background:${i <= filled ? color : '#1E293B'}"></span>`
  ).join('')
  return `<span style="vertical-align:middle">${dots}</span>`
}

const DIMENSION_NAMES: Record<string, string> = {
  financiero: 'Margen real',
  temporal: 'Sistema vs. presencia',
  cognitivo: 'Claridad para decidir',
  relacional: 'Red activa',
}

// ── VARIANTE A — Pre-diagnóstico visual + potencial de transformación ──────────

function buildVariantA(summary: string, dx?: PreDiagnostic, firstName?: string): string {
  const greeting = firstName ? `${firstName}, tu` : 'Tu'
  const dxSection = dx ? `
    <tr><td style="background:#fff;padding:24px 36px 0">
      <p style="margin:0 0 10px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#0891B2;font-weight:600">Diagnóstico rápido de tu situación</p>
      <div style="background:#0F172A;border-radius:10px;padding:20px 24px">
        <p style="margin:0 0 14px;font-size:12px;color:#94A3B8">Estimado a partir de tu conversación con Serena. El diagnóstico completo se realiza en la sesión.</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${(['financiero','temporal','cognitivo','relacional'] as const).map(dim => {
            const isZero = dx.zeroDimension === dim
            return `<tr>
              <td style="padding:5px 0;width:110px;font-size:13px;font-weight:${isZero?'700':'400'};color:${isZero?'#F8FAFC':'#94A3B8'}">${DIMENSION_NAMES[dim]}</td>
              <td style="padding:5px 0">${levelBar(dx.dimensionLevels[dim], isZero)}</td>
            </tr>`
          }).join('')}
        </table>
        <div style="margin-top:16px;border-top:1px solid rgba(255,255,255,0.08);padding-top:14px">
          <p style="margin:0 0 4px;font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:1px">Lo que más frena tu negocio</p>
          <p style="margin:0;font-size:14px;font-weight:700;color:#FCD34D">⚡ ${dx.zeroDimensionLabel}</p>
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
    </td></tr>` : ''

  const header = `
    <tr><td style="background:#0F172A;border-radius:12px 12px 0 0;padding:32px 36px 28px">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#0891B2;font-weight:600">CLARIFICA</p>
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#F8FAFC;line-height:1.3">
        ${greeting} negocio tiene un techo.<br>Acabas de dar el primer paso para verlo.
      </h1>
      <p style="margin:0;font-size:14px;color:#94A3B8">Aquí tienes el resumen de tu conversación${dx ? ' y un pre-diagnóstico de tu situación' : ''}.</p>
    </td></tr>`

  const cta = `
    <tr><td style="background:#fff;padding:24px 36px 0">
      <p style="margin:0 0 14px;font-size:14px;color:#334155;line-height:1.6">
        El diagnóstico completo toma <strong>30 minutos</strong>. Al terminar tienes el mapa exacto de dónde está el techo, qué dimensión lo sostiene, y cuál es la primera palanca para moverlo.
      </p>
      <a href="https://clariifica.com" style="display:inline-block;background:#0891B2;color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-size:15px;font-weight:700">Agendar diagnóstico gratuito →</a>
    </td></tr>`

  return emailWrapper([header, summaryBlock(summary), dxSection, caseStudyBlock(), cta, privacyFooter()].join(''))
}

// ── VARIANTE B — Señales de alerta + costo de inacción ───────────────────────

function buildVariantB(summary: string, dx?: PreDiagnostic, firstName?: string): string {
  const greeting = firstName ? `${firstName}, hay` : 'Hay'
  const riskColors = ['#92400E', '#92400E', '#B45309']
  const riskLabels = ['⚠', '⚠', '—']

  const alertSection = dx ? `
    <tr><td style="background:#fff;padding:24px 36px 0">
      <p style="margin:0 0 10px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#B45309;font-weight:600">3 señales detectadas en tu negocio</p>
      ${dx.top3Risks.map((risk, i) => `
        <div style="display:flex;margin-bottom:10px;background:#fffbeb;border-left:3px solid ${riskColors[i]};border-radius:0 8px 8px 0;padding:12px 16px">
          <span style="font-size:14px;margin-right:10px;flex-shrink:0;color:${riskColors[i]}">${riskLabels[i]}</span>
          <p style="margin:0;font-size:13px;color:#334155;line-height:1.6">${risk}</p>
        </div>`).join('')}
    </td></tr>
    <tr><td style="background:#fff;padding:16px 36px 0">
      <div style="background:#0F172A;border-radius:10px;padding:20px 24px">
        <p style="margin:0 0 6px;font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:1px">Tu mayor punto de fricción hoy</p>
        <p style="margin:0 0 14px;font-size:15px;font-weight:700;color:#FCD34D">⚡ ${dx.zeroDimensionLabel}</p>
        <p style="margin:0 0 16px;font-size:13px;color:#94A3B8;line-height:1.6">
          Mientras esto no cambie, el resto de tus esfuerzos rinden menos de lo que podrían. No es falta de trabajo — es cómo está diseñada la estructura.
        </p>
        <p style="margin:0 0 10px;font-size:12px;color:#0891B2;font-weight:600;text-transform:uppercase;letter-spacing:1px">Lo que cambia cuando se resuelve:</p>
        ${dx.transformationIn90Days.map(kpi => `
          <p style="margin:0 0 6px;font-size:13px;color:#F8FAFC">✓ ${kpi}</p>`).join('')}
      </div>
    </td></tr>` : `
    <tr><td style="background:#fff;padding:24px 36px 0">
      <div style="background:#fffbeb;border-left:3px solid #92400E;border-radius:0 8px 8px 0;padding:16px 20px">
        <p style="margin:0;font-size:14px;color:#334155;line-height:1.65">
          En el diagnóstico mapeamos exactamente dónde está el techo de tu negocio y cuál dimensión lo sostiene. Sin eso, cualquier movimiento cuesta el doble y avanza la mitad.
        </p>
      </div>
    </td></tr>`

  const header = `
    <tr><td style="background:#0F172A;border-radius:12px 12px 0 0;padding:32px 36px 28px">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#F59E0B;font-weight:600">CLARIFICA — REPORTE DE ALERTA</p>
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#F8FAFC;line-height:1.3">
        ${greeting} señales en tu negocio<br>que cuestan más de lo que parecen.
      </h1>
      <p style="margin:0;font-size:14px;color:#94A3B8">Serena detectó patrones en tu conversación. Te los compartimos.</p>
    </td></tr>`

  const cta = `
    <tr><td style="background:#fff;padding:24px 36px 0">
      <p style="margin:0 0 14px;font-size:14px;color:#334155;line-height:1.6">
        El diagnóstico de 30 minutos hace exactamente esto: mapa del techo, primera palanca, hoja de ruta. Sin costo.
      </p>
      <a href="https://clariifica.com" style="display:inline-block;background:#1D4ED8;color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-size:15px;font-weight:700">Ver mi diagnóstico completo →</a>
    </td></tr>`

  return emailWrapper([header, summaryBlock(summary), alertSection, caseStudyBlock(), cta, privacyFooter()].join(''))
}
