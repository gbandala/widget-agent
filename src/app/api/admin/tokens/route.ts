import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const TokenSchema = z.object({
  label: z.string().min(1).max(100),
  allowed_origin: z.string().url(),
  bot_name: z.string().min(1).max(50).optional(),
  bot_avatar_url: z.string().url().optional().nullable(),
  agent_language: z.string().max(10).optional(),
  agent_tone: z.string().max(30).optional(),
  agent_instructions: z.string().max(2000).optional().nullable(),
  agent_scope: z.string().max(1000).optional().nullable(),
  agent_use_emojis: z.boolean().optional(),
  welcome_message: z.string().max(300).optional().nullable(),
})

export async function GET() {
  try {
    const tokens = await db`
      SELECT id, token, label, allowed_origin, is_active,
             bot_name, bot_avatar_url, agent_language, agent_tone,
             agent_instructions, agent_scope, agent_use_emojis,
             welcome_message, created_at
      FROM widget_tokens
      ORDER BY created_at DESC
    `
    return NextResponse.json({ tokens })
  } catch (err) {
    console.error('[tokens]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = TokenSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const rows = await db`
      INSERT INTO widget_tokens ${db(parsed.data)}
      RETURNING *
    `

    return NextResponse.json({ token: rows[0] }, { status: 201 })
  } catch (err) {
    console.error('[tokens]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, is_active, ...rest } = await req.json()
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof is_active === 'boolean') updates.is_active = is_active
    if (rest.label) updates.label = rest.label
    if (rest.bot_name) updates.bot_name = rest.bot_name
    if (rest.bot_avatar_url !== undefined) updates.bot_avatar_url = rest.bot_avatar_url
    if (rest.agent_language) updates.agent_language = rest.agent_language
    if (rest.agent_tone) updates.agent_tone = rest.agent_tone
    if ('agent_instructions' in rest) updates.agent_instructions = rest.agent_instructions
    if ('agent_scope' in rest) updates.agent_scope = rest.agent_scope
    if (typeof rest.agent_use_emojis === 'boolean') updates.agent_use_emojis = rest.agent_use_emojis
    if ('welcome_message' in rest) updates.welcome_message = rest.welcome_message

    await db`UPDATE widget_tokens SET ${db(updates)} WHERE id = ${id}`
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[tokens]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
