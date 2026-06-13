import { NextRequest, NextResponse } from 'next/server'
import { LOCALES, DEFAULT_LOCALE, isLocale } from './lib/types'
import { LOCALE_COOKIE } from './lib/i18n/config'

const PUBLIC_FILE = /\.(.*)$/

// Routage de locale (§02). L'authentification est vérifiée côté serveur (layouts),
// non en middleware, pour éviter Prisma sur le runtime edge.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/assets') ||
    pathname === '/favicon.ico' ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next()
  }

  const hasLocale = LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))
  if (hasLocale) return NextResponse.next()

  const cookieLocale = req.cookies.get(LOCALE_COOKIE)?.value
  const locale = cookieLocale && isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE
  const url = req.nextUrl.clone()
  url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
