import { NextRequest, NextResponse } from 'next/server'
import { kbService } from '@/features/knowledge-base/services/kbService'
import { z } from 'zod'

const KBEntrySchema = z.object({
  title: z.string().min(3).max(200),
  content: z.string().min(10).max(10000),
  category: z.enum(['service', 'project_case', 'capability', 'faq', 'pricing']),
  tags: z.array(z.string()).optional(),
})

const INTERNAL_ERROR = { error: 'Error interno del servidor' }

export async function GET() {
  try {
    const entries = await kbService.list()
    return NextResponse.json({ entries })
  } catch (err) {
    console.error('[KB GET]', err)
    return NextResponse.json(INTERNAL_ERROR, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = KBEntrySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', detail: parsed.error.flatten() }, { status: 400 })
    }
    const entry = await kbService.create(parsed.data)
    return NextResponse.json({ entry }, { status: 201 })
  } catch (err) {
    console.error('[KB POST]', err)
    return NextResponse.json(INTERNAL_ERROR, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, isActive, ...rest } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    if (typeof isActive === 'boolean') {
      await kbService.setActive(id, isActive)
    } else {
      const parsed = KBEntrySchema.partial().safeParse(rest)
      if (!parsed.success) {
        return NextResponse.json({ error: 'Datos inválidos', detail: parsed.error.flatten() }, { status: 400 })
      }
      await kbService.update(id, parsed.data)
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[KB PATCH]', err)
    return NextResponse.json(INTERNAL_ERROR, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    await kbService.delete(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[KB DELETE]', err)
    return NextResponse.json(INTERNAL_ERROR, { status: 500 })
  }
}
