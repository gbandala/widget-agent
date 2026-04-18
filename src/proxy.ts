import { NextRequest, NextResponse } from 'next/server'

const ADMIN_PATTERNS = [
  /^\/api\/admin\/kb(\/|$)/,
  /^\/api\/admin\/tokens(\/|$)/,
  /^\/kb(\/|$)/,
  /^\/tokens(\/|$)/,
  /^\/leads(\/|$)/,
  /^\/logs(\/|$)/,
  /^\/conversaciones(\/|$)/,
]

const ADMIN_PUBLIC_EXCEPTIONS = [
  /^\/api\/admin\/tokens\/validate(\/|$)/,
  /^\/api\/admin\/auth(\/|$)/,
]

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isAdminRoute = ADMIN_PATTERNS.some(p => p.test(pathname))
  const isPublicException = ADMIN_PUBLIC_EXCEPTIONS.some(p => p.test(pathname))

  if (isAdminRoute && !isPublicException) {
    const adminKey = req.headers.get('x-admin-key')
    const cookieKey = req.cookies.get('admin_key')?.value
    const expectedKey = process.env.ADMIN_SECRET_KEY

    if (!expectedKey) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: 'Panel de administración no configurado' },
          { status: 503 }
        )
      }
      console.warn('[Admin Proxy] ADMIN_SECRET_KEY not set — admin routes are unprotected in dev')
      return NextResponse.next()
    }

    const isAuthorized = adminKey === expectedKey || cookieKey === expectedKey
    if (!isAuthorized) {
      // Redirect browser requests to login, return JSON for API requests
      const isApiRequest = pathname.startsWith('/api/')
      if (isApiRequest) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(loginUrl)
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
    '/conversaciones/:path*',
  ],
}
