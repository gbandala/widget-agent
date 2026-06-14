import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load .env.local
const envPath = resolve(process.cwd(), '.env.local')
const envVars = readFileSync(envPath, 'utf8').split('\n')
for (const line of envVars) {
  const [k, ...v] = line.split('=')
  if (k?.trim() && v.length) process.env[k.trim()] = v.join('=').trim()
}

import { sendWelcomeEmail } from '../src/lib/email/emailService'

const dx = {
  zeroDimension: 'temporal' as const,
  zeroDimensionLabel: 'Todo depende de ti para que el negocio funcione',
  dimensionLevels: {
    financiero: 'medio' as const,
    temporal: 'bajo' as const,
    cognitivo: 'medio' as const,
    relacional: 'medio' as const,
  },
  top3Risks: [
    'Dependencia total del dueño: si no estás, la operación se detiene. Cada semana que sigue así es una semana que no construyes nada escalable.',
    'Crecimiento atado a tu esfuerzo personal: doblar la facturación requiere doblar tus horas.',
    'Pipeline sin sistema: los clientes llegan por referidos o por tu contacto directo.',
  ] as [string, string, string],
  transformationIn90Days: [
    'Liberar 10-15h semanales delegando operación con protocolos claros',
    'Al menos 2 procesos corriendo sin supervisión directa',
    'Sistema de seguimiento a prospectos que no depende de ti para activarse',
  ] as [string, string, string],
}

const summary = 'Gabriel lleva 8 años en logística, factura 4M al año. El problema central: todo depende de él para operar — si no está, el negocio se para. Necesita escalar pero la estructura actual lo tiene atrapado en el día a día.'

const TO = 'bandala@outlook.com'

async function main() {
  const [rA, rB] = await Promise.all([
    sendWelcomeEmail({ to: TO, leadName: 'Gabriel', conversationSummary: summary, sessionId: 'test-a', preDiagnostic: dx, variant: 'A' }),
    sendWelcomeEmail({ to: TO, leadName: 'Gabriel', conversationSummary: summary, sessionId: 'test-b', preDiagnostic: dx, variant: 'B' }),
  ])
  console.log('Variante A enviada ✅', rA)
  console.log('Variante B enviada ✅', rB)
}

main().catch(e => { console.error(e); process.exit(1) })
