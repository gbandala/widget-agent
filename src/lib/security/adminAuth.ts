import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

/**
 * Valida acceso admin vía:
 * 1. Header X-Admin-Key (agentes, API-to-API)
 * 2. Cookie admin_key (browser/panel)
 *
 * Usar en rutas /api/crm/* y /api/admin/*
 */
export async function requireAdmin(
  req: NextRequest
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const expected = process.env.ADMIN_SECRET_KEY
  if (!expected) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Admin no configurado' }, { status: 503 }),
    }
  }

  // Header (agentes / API-to-API)
  const headerKey = req.headers.get('x-admin-key')
  if (headerKey && headerKey === expected) return { ok: true }

  // Cookie (browser)
  const cookieStore = await cookies()
  const cookieKey = cookieStore.get('admin_key')?.value
  if (cookieKey && cookieKey === expected) return { ok: true }

  return {
    ok: false,
    response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  }
}
