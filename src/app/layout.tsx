import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://lam.ht'),
  title: 'Lam — Le fruit du savoir',
  description:
    "Plateforme trilingue (FR/EN/HT) de recherche juridique haïtienne : législation, circulaires BRH, jurisprudence, doctrine, lois de finances et marques — sourcées au Moniteur.",
  icons: { icon: '/favicon.svg' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
