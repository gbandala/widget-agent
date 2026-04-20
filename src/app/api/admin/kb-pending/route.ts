import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('kb_pending_questions')
    .select('id, question, source_url, status, admin_notes, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ questions: data ?? [] })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createServiceClient()
  const body = await req.json()
  const { id, status, admin_notes } = body

  if (!id || !status) return NextResponse.json({ error: 'id y status requeridos' }, { status: 400 })

  const { error } = await supabase
    .from('kb_pending_questions')
    .update({
      status,
      admin_notes: admin_notes ?? null,
      resolved_at: status !== 'pending' ? new Date().toISOString() : null,
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
