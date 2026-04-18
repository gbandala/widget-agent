import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'admin_key'
const COOKIE_MAX_AGE = 60 * 60 * 8 // 8 horas

export async function POST(req: NextRequest) {
  const { key } = await req.json()
  const expected = process.env.ADMIN_SECRET_KEY

  if (!expected) {
    return NextResponse.json({ error: 'Admin no configurado' }, { status: 503 })
  }
  if (key !== expected) {
    return NextResponse.json({ error: 'Clave incorrecta' }, { status: 401 })
  }

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, key, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === 'production',
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
  return NextResponse.json({ ok: true })
}
