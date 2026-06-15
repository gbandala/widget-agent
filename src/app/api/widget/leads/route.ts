import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWidgetToken } from '@/lib/security/widgetTokenValidator'
import { encryptPii } from '@/lib/security/piiCrypto'
import { z } from 'zod'

const LeadSchema = z.object({
  sessionId: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().max(320),
  company: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  privacyAccepted: z.boolean().default(true),
  privacyVersion: z.string().default('2.0'),
  sourceUrl: z.string().url().optional(),
  contactPreference: z.enum(['whatsapp', 'call', 'email']).optional(),
  leadScore: z.number().int().min(0).max(20).optional(),
})

const QUALIFIED_SCORE_THRESHOLD = 5

/** POST /api/widget/leads — Guarda un lead con datos cifrados */
export async function POST(req: NextRequest) {
  const auth = await requireWidgetToken(req)
  if (!auth.ok) return auth.response

  try {
    const body = await req.json()
    const parsed = LeadSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { sessionId, name, email, company, phone, privacyVersion, sourceUrl, contactPreference, leadScore } = parsed.data

    // Cifrar PII
    const encryptedEmail = encryptPii(email)
    const encryptedPhone = phone ? encryptPii(phone) : null

    // Crear lead
    const leadRows = await db`
      INSERT INTO widget_leads ${db({
        session_id: sessionId,
        name: name ?? null,
        email: encryptedEmail,
        company: company ?? null,
        phone: encryptedPhone,
        privacy_accepted: true,
        privacy_accepted_at: new Date().toISOString(),
        privacy_version: privacyVersion,
        source_url: sourceUrl ?? null,
        contact_preference: contactPreference ?? null,
        lead_score: leadScore ?? 0,
      })}
      RETURNING id
    `

    const leadId = leadRows[0].id as string

    // Actualizar sesión con lead_id e intent
    await db`
      UPDATE widget_sessions
      SET lead_id = ${leadId},
          intent_detected = 'lead_captured',
          last_active = ${new Date().toISOString()}
      WHERE id = ${sessionId}
    `

    // Promover a CRM si el score supera el umbral de calificación
    const score = leadScore ?? 0
    if (score >= QUALIFIED_SCORE_THRESHOLD) {
      try {
        await db`
          INSERT INTO contacts
            (widget_lead_id, nombre, empresa, email_enc, telefono_enc,
             origen, preferred_contact, bant_score, etapa)
          VALUES
            (${leadId}, ${name ?? 'Sin nombre'}, ${company ?? null},
             ${encryptedEmail}, ${encryptedPhone ?? null},
             'widget', ${contactPreference ?? null}, ${score}, 'T0')
          ON CONFLICT (widget_lead_id) DO UPDATE
            SET bant_score       = EXCLUDED.bant_score,
                preferred_contact = EXCLUDED.preferred_contact,
                updated_at        = NOW()
        `
      } catch (crmErr) {
        // No bloquear la captura del lead si el CRM falla
        console.error('[leads → crm]', crmErr)
      }
    }

    return NextResponse.json({ leadId }, { status: 201 })
  } catch (err) {
    console.error('[leads]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
