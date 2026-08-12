import type { Metadata, Viewport } from 'next'
import { FONT_VARS } from './fonts'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://lam.ht'),
  title: 'Lam — Le fruit du savoir',
  description:
    "Plateforme trilingue (FR/EN/HT) de recherche juridique haïtienne : législation, circulaires BRH, jurisprudence, doctrine, lois de finances et marques — sourcées au Moniteur.",
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/Lam_Marque_Klinik.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
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
