import { NextRequest, NextResponse } from 'next/server'
import { LOCALES, DEFAULT_LOCALE, isLocale } from './lib/types'
import { LOCALE_COOKIE } from './lib/i18n/config'

const PUBLIC_FILE = /\.(.*)$/

/**
 * Content-Security-Policy à nonce (durcissement anti-XSS, §09).
 *  - script-src : 'self' + nonce + 'strict-dynamic' → seuls les scripts Next.js
 *    (porteurs du nonce généré par requête) s'exécutent ; tout script injecté est bloqué.
 *  - object-src 'self' blob: → REQUIS par l'aperçu PDF de l'admin (<object data=blob:>).
 *  - style-src 'unsafe-inline' → React/Next injectent du style en ligne (risque faible).
 *  - En développement : 'unsafe-eval' + ws: sont ajoutés (compilation/HMR de Next).
 */
function buildCsp(nonce: string): string {
  const dev = process.env.NODE_ENV === 'development'
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(dev ? ["'unsafe-eval'"] : [])],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", ...(dev ? ['ws:', 'wss:'] : [])],
    'object-src': ["'self'", 'blob:'],
    'frame-src': ["'self'", 'blob:'],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
  }
  let csp = Object.entries(directives)
    .map(([k, v]) => `${k} ${v.join(' ')}`)
    .join('; ')
  if (!dev) csp += '; upgrade-insecure-requests'
  return csp
}

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

  // CSP à nonce pour les réponses HTML (pages). Le nonce est transmis à Next via les
  // en-têtes de requête (Next l'applique automatiquement à ses balises <script>) et
  // renvoyé au navigateur dans l'en-tête de réponse.
  const nonce = crypto.randomUUID().replace(/-/g, '')
  const csp = buildCsp(nonce)

  const hasLocale = LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))
  if (hasLocale) {
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-nonce', nonce)
    requestHeaders.set('Content-Security-Policy', csp)
    const res = NextResponse.next({ request: { headers: requestHeaders } })
    res.headers.set('Content-Security-Policy', csp)
    return res
  }

  const cookieLocale = req.cookies.get(LOCALE_COOKIE)?.value
  const locale = cookieLocale && isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE
  const url = req.nextUrl.clone()
  url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
