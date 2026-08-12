import type { Metadata, Viewport } from 'next'
import { FONT_VARS } from './fonts'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://lam.ht'),
  title: 'Lam — Le fruit du savoir',
  description:
    "Plateforme trilingue (FR/EN/HT) de recherche juridique haïtienne : législation, circulaires BRH, jurisprudence, doctrine, lois de finances et marques — sourcées au Moniteur.",
  manifest: '/site.webmanifest',
  /**
   * ⚠️ LE SUFFIXE `?v=` N'EST PAS DÉCORATIF. Les fichiers d'icône portent bien la marque
   * Klinik et le serveur les rend en `max-age=0, must-revalidate` — mais les navigateurs
   * conservent le favicon dans un cache SÉPARÉ de celui des pages, qui ignore largement
   * ces en-têtes : l'ancienne icône survit des semaines. Changer l'URL est le seul moyen
   * fiable de basculer TOUS les visiteurs sans leur demander de vider leur cache.
   * À incrémenter à chaque changement d'icône.
   */
  icons: {
    icon: [
      { url: '/favicon.ico?v=klinik3', sizes: '48x48' },
      { url: '/Lam_Marque_Klinik.svg?v=klinik3', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png?v=klinik3',
  },
}

/** Chabon — la barre du navigateur prend le sombre de référence de la marque. */
export const viewport: Viewport = { themeColor: '#414042' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={FONT_VARS}>
      <body>{children}</body>
    </html>
  )
}
