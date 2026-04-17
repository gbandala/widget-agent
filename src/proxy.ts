import { NextRequest, NextResponse } from 'next/server'

// Routes that are admin-only (require x-admin-key header)
const ADMIN_PATTERNS = [
  /^\/api\/admin\/kb(\/|$)/,
  /^\/api\/admin\/tokens(\/|$)/,
  /^\/kb(\/|$)/,
  /^\/tokens(\/|$)/,
  /^\/leads(\/|$)/,
  /^\/logs(\/|$)/,
]

// Public admin sub-routes (widget calls these directly)
const ADMIN_PUBLIC_EXCEPTIONS = [
  /^\/api\/admin\/tokens\/validate(\/|$)/,
]

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isAdminRoute = ADMIN_PATTERNS.some(p => p.test(pathname))
  const isPublicException = ADMIN_PUBLIC_EXCEPTIONS.some(p => p.test(pathname))

  if (isAdminRoute && !isPublicException) {
    const adminKey = req.headers.get('x-admin-key')
    const expectedKey = process.env.ADMIN_SECRET_KEY

    if (!expectedKey) {
      // If key not configured, block all access in production
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: 'Panel de administración no configurado' },
          { status: 503 }
        )
      }
      // In dev, warn and allow (to avoid blocking local development)
      console.warn('[Admin Proxy] ADMIN_SECRET_KEY not set — admin routes are unprotected in dev')
      return NextResponse.next()
    }

    if (adminKey !== expectedKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/admin/:path*',
    '/kb/:path*',
    '/tokens/:path*',
    '/leads/:path*',
    '/logs/:path*',
  ],
}
