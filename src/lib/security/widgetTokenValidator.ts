import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export interface TokenValidation {
  valid: boolean
  tokenId?: string
  botName?: string
  botAvatarUrl?: string | null
  reason?: string
}

/**
 * Valida el widget token contra la base de datos.
 * Verifica: existencia, is_active, allowed_origin.
 */
export async function validateWidgetToken(
  token: string,
  origin: string
): Promise<TokenValidation> {
  if (!token || !origin) {
    return { valid: false, reason: 'missing_token_or_origin' }
  }

  try {
    const rows = await db`
      SELECT id, is_active, allowed_origin, bot_name, bot_avatar_url
      FROM widget_tokens
      WHERE token = ${token}
      LIMIT 1
    `
    const data = rows[0]

    if (!data) {
      return { valid: false, reason: 'token_not_found' }
    }

    if (!data.is_active) {
      return { valid: false, reason: 'token_inactive' }
    }

    // Verificar origen (acepta wildcard '*' para desarrollo)
    // Extrae solo el hostname para comparar: "https://clariifica.com" → "clariifica.com"
    const extractHostname = (s: string) => {
      try { return new URL(s).hostname } catch { return s.replace(/\/$/, '') }
    }
    const normalizedOrigin = extractHostname(origin)
    const normalizedAllowed = (data.allowed_origin as string).replace(/\/$/, '')

    if (normalizedAllowed !== '*' && normalizedAllowed !== normalizedOrigin) {
      return { valid: false, reason: 'origin_mismatch' }
    }

    return {
      valid: true,
      tokenId: data.id as string,
      botName: (data.bot_name as string | null) ?? 'Asistente',
      botAvatarUrl: data.bot_avatar_url as string | null,
    }
  } catch {
    return { valid: false, reason: 'validation_error' }
  }
}

/**
 * Middleware helper: validates the widget token from the request and returns
 * either the token data or a ready-to-return 401 NextResponse.
 */
export async function requireWidgetToken(
  req: NextRequest
): Promise<{ ok: true; tokenId: string } | { ok: false; response: NextResponse }> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  const origin = req.headers.get('x-source-origin') || req.headers.get('origin') || ''
  const result = await validateWidgetToken(token, origin)
  if (!result.valid || !result.tokenId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  return { ok: true, tokenId: result.tokenId }
}
