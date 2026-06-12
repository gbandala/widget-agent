import { Resend } from 'resend'

const FROM = 'Serena de Clarifica <serena@clariifica.com>'

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY no configurada')
  return new Resend(key)
}

interface WelcomeEmailParams {
  to: string
  conversationSummary: string
  sessionId: string
}

export async function sendWelcomeEmail({ to, conversationSummary, sessionId }: WelcomeEmailParams) {
  const { data, error } = await getResend().emails.send({
    from: FROM,
    to,
    subject: 'Gracias por tu interés en Clarifica',
    html: buildWelcomeHtml(conversationSummary, sessionId),
  })

  if (error) throw new Error(`Email error: ${error.message}`)
  return data
}

function buildWelcomeHtml(summary: string, sessionId: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Gracias por tu interés en Clarifica</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
  .card { background: white; border-radius: 12px; max-width: 560px; margin: 0 auto; padding: 40px; }
  h1 { font-size: 22px; color: #0f172a; margin: 0 0 8px; }
  .subtitle { color: #64748b; font-size: 14px; margin: 0 0 28px; }
  .summary { background: #f8fafc; border-left: 3px solid #2563eb; padding: 16px; border-radius: 6px; font-size: 14px; color: #334155; line-height: 1.6; margin-bottom: 28px; }
  .cta { display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 15px; font-weight: 600; }
  .divider { border: none; border-top: 1px solid #e2e8f0; margin: 32px 0; }
  .privacy { font-size: 11px; color: #94a3b8; line-height: 1.6; }
</style>
</head>
<body>
<div class="card">
  <h1>Hola, gracias por hablar con Serena</h1>
  <p class="subtitle">Aquí va un resumen de lo que conversamos y los próximos pasos.</p>

  <div class="summary">
    <strong style="display:block;margin-bottom:8px;color:#0f172a">Resumen de tu conversación:</strong>
    ${summary.replace(/\n/g, '<br>')}
  </div>

  <p style="color:#334155;font-size:14px;margin-bottom:20px">
    Clarifica diagnostica por qué los negocios de servicios no crecen al ritmo del esfuerzo —
    casi siempre hay una razón estructural que no se ve desde adentro.
    El primer paso es una sesión de diagnóstico de 30 minutos, sin costo.
  </p>

  <a href="https://widget.clariifica.com/api/appointments" class="cta">Agendar sesión de diagnóstico</a>

  <hr class="divider">

  <p class="privacy">
    <strong>Aviso de Privacidad</strong><br>
    Tus datos personales son tratados por <strong>Clarifica</strong> como responsable, con domicilio en México.
    <strong>Finalidad:</strong> contactarte sobre los servicios de consultoría y arquitectura de negocio que solicitaste.
    <strong>Derechos ARCO:</strong> puedes acceder, rectificar, cancelar u oponerte al tratamiento de tus datos
    escribiendo a <a href="mailto:contacto@clariifica.com" style="color:#2563eb">contacto@clariifica.com</a>.
    Tus datos se almacenan cifrados y no se comparten con terceros sin tu consentimiento.
    Plazo de conservación: 2 años o hasta que solicites su eliminación.
  </p>
  <p class="privacy" style="margin-top:8px">
    Si no solicitaste esta información, ignora este correo o escríbenos a
    <a href="mailto:contacto@clariifica.com" style="color:#2563eb">contacto@clariifica.com</a>.
  </p>
</div>
</body>
</html>`
}
