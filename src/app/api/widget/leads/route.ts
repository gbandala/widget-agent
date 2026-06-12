import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWidgetToken } from '@/lib/security/widgetTokenValidator'
import { z } from 'zod'
import crypto from 'crypto'

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

/**
 * Cifra un valor con AES-256-CBC.
 * Requiere PII_ENCRYPTION_KEY en producción.
 */
function encrypt(text: string): string {
  const key = process.env.PII_ENCRYPTION_KEY
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('PII_ENCRYPTION_KEY no configurada — no se puede almacenar datos personales')
    }
    console.warn('[leads] PII_ENCRYPTION_KEY no configurada — datos guardados sin cifrar (solo dev)')
    return text
  }
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key.slice(0, 32)), iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

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
    const encryptedEmail = encrypt(email)
    const encryptedPhone = phone ? encrypt(phone) : null

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

    return NextResponse.json({ leadId }, { status: 201 })
  } catch (err) {
    console.error('[leads]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
