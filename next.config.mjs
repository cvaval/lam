/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // pdfjs-dist (via pdf-parse) ne supporte pas le bundling webpack côté serveur :
    // chargé en require() au runtime Node.
    serverComponentsExternalPackages: ['pdf-parse', 'pdfjs-dist'],
  },
  // The legal corpus is the source of truth; we never want stale edge caches of
  // official text. Security headers harden the export/anti-scraping posture (§09).
  async headers() {
    const securityHeaders = [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ]
    // HSTS : empêche le SSL-stripping / downgrade MITM (sessions cookie + 2FA). En prod
    // uniquement — l'imposer en dev forcerait https://localhost (constat d'audit §09).
    if (process.env.NODE_ENV === 'production') {
      securityHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      })
    }
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  // Renommage d'URL (22 juil. 2026) : les rubriques servaient sur des chemins qui ne
  // correspondaient pas à leur nom affiché (/doctrine → « Législation annotée »,
  // /legislation → « Éditions Le Moniteur »). Redirections PERMANENTES (308) pour que
  // les favoris et liens partagés existants continuent de fonctionner — y compris les
  // sous-pages par année du Moniteur (/legislation/2024).
  async redirects() {
    return [
      { source: '/:locale(fr|en|ht)/doctrine', destination: '/:locale/legislationannotee', permanent: true },
      { source: '/:locale(fr|en|ht)/legislation', destination: '/:locale/editionsmoniteur', permanent: true },
      { source: '/:locale(fr|en|ht)/legislation/:path*', destination: '/:locale/editionsmoniteur/:path*', permanent: true },
    ]
  },
}

export default nextConfig
