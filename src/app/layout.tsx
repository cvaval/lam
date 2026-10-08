import type { Metadata, Viewport } from 'next'
import { FONT_VARS } from './fonts'
import { BRAND } from '@/lib/brand'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.url),
  title: `${BRAND.name} — ${BRAND.baseline.fr}`,
  description:
    "Agora (anciennement Lam) — plateforme trilingue (FR/EN/HT) de recherche juridique haïtienne : législation, circulaires BRH, jurisprudence, doctrine, lois de finances et marques — sourcées au Moniteur.",
  manifest: '/site.webmanifest',
  /**
   * ⚠️ LE SUFFIXE `?v=` N'EST PAS DÉCORATIF. Les navigateurs conservent le favicon dans un
   * cache SÉPARÉ de celui des pages, qui ignore largement les en-têtes : l'ancienne icône
   * survit des semaines. Changer l'URL est le seul moyen fiable de basculer TOUS les
   * visiteurs sans leur demander de vider leur cache. À incrémenter à chaque changement
   * d'icône (`klinik3` → `agora1`, kit Agora v2).
   */
  icons: {
    icon: [
      { url: '/favicon.ico?v=agora1', sizes: '48x48' },
      { url: '/favicon.svg?v=agora1', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png?v=agora1',
  },
}

/** Encre Agora — la barre du navigateur prend le sombre de référence de la marque. */
export const viewport: Viewport = { themeColor: '#152E38' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={FONT_VARS}>
      <body>{children}</body>
    </html>
  )
}
