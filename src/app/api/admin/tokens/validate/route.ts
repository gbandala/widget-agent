import { NextRequest, NextResponse } from 'next/server'
import { validateWidgetToken } from '@/lib/security/widgetTokenValidator'

/** POST /api/admin/tokens/validate — Valida un token desde el widget frontend */
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()
    const origin = req.headers.get('x-source-origin') || req.headers.get('origin') || ''

    const result = await validateWidgetToken(token, origin)

    if (!result.valid) {
      return NextResponse.json({ valid: false, reason: result.reason }, { status: 401 })
    }

    return NextResponse.json({
      valid: true,
      tokenId: result.tokenId,
      botName: result.botName,
      botAvatarUrl: result.botAvatarUrl,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
