import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireWidgetToken } from '@/lib/security/widgetTokenValidator'

/** POST /api/widget/session — Crea o recupera una sesión por anonId */
export async function POST(req: NextRequest) {
  const auth = await requireWidgetToken(req)
  if (!auth.ok) return auth.response

  try {
    const supabase = await createServiceClient()
    const { anonId, tokenId, sourceUrl } = await req.json()

    if (!anonId || !tokenId) {
      return NextResponse.json({ error: 'anonId y tokenId requeridos' }, { status: 400 })
    }

    // Buscar sesión existente activa (últimas 2 horas)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const { data: existing } = await supabase
      .from('widget_sessions')
      .select('*')
      .eq('anon_id', anonId)
      .eq('token_id', tokenId)
      .gte('last_active', twoHoursAgo)
      .order('last_active', { ascending: false })
      .limit(1)
      .single()

    if (existing) {
      return NextResponse.json({ session: existing })
    }

    // Crear nueva sesión
    const { data, error } = await supabase
      .from('widget_sessions')
      .insert({
        anon_id: anonId,
        token_id: tokenId,
        source_url: sourceUrl,
        intent_detected: 'browsing',
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ session: data }, { status: 201 })
  } catch (err) {
    console.error('[session]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
