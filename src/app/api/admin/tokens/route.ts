import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const TokenSchema = z.object({
  label: z.string().min(1).max(100),
  allowed_origin: z.string().url(),
  bot_name: z.string().min(1).max(50).optional(),
  bot_avatar_url: z.string().url().optional().nullable(),
})

export async function GET() {
  try {
    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .from('widget_tokens')
      .select('id, token, label, allowed_origin, is_active, bot_name, bot_avatar_url, created_at')
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ tokens: data })
  } catch (err) {
    console.error('[tokens]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServiceClient()
    const body = await req.json()
    const parsed = TokenSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const { data, error } = await supabase
      .from('widget_tokens')
      .insert(parsed.data)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ token: data }, { status: 201 })
  } catch (err) {
    console.error('[tokens]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createServiceClient()
    const { id, is_active, ...rest } = await req.json()
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof is_active === 'boolean') updates.is_active = is_active
    if (rest.bot_name) updates.bot_name = rest.bot_name
    if (rest.bot_avatar_url !== undefined) updates.bot_avatar_url = rest.bot_avatar_url
    if (rest.label) updates.label = rest.label

    const { error } = await supabase.from('widget_tokens').update(updates).eq('id', id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[tokens]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
