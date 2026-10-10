'use client'

import { usePathname } from 'next/navigation'
import { pageAvecFrise } from '@/lib/frise'

/**
 * Pose la FRISE DES MONUMENTS au bas de la page (voir `src/lib/frise.ts` pour les pages exclues
 * et les mesures du dessin). Monté UNE fois, dans la mise en page racine : aucune page n'a rien à
 * faire. Styles portés par le composant (classes utilitaires), aucune feuille partagée touchée.
 *
 *  - la frise est une bande décorative (`aria-hidden`, sans clic), ligne de sol au bord
 *    inférieur, opacité 0,19 (0,15 sur téléphone), masquée à l'impression ;
 *  - PAGES COURTES : la page racine (`.min-h-screen`) perd la hauteur de la frise, pour que
 *    celle-ci tombe au bas de l'écran et non sous la ligne de flottaison.
 */
export function CadreAvecFrise({ children }: { children: React.ReactNode }) {
  const chemin = usePathname()
  if (!pageAvecFrise(chemin)) return <>{children}</>
  return (
    <div className="[&>.min-h-screen]:min-h-[calc(100vh-260px)] max-sm:[&>.min-h-screen]:min-h-[calc(100vh-180px)] print:[&>.min-h-screen]:min-h-0">
      {children}
      <div
        aria-hidden="true"
        className="pointer-events-none h-[260px] w-full bg-[url('/brand/agora/landmarks-haiti-market-first.png')] bg-[length:1440px_auto] bg-[position:center_bottom_-91px] bg-repeat-x opacity-[.19] max-sm:h-[180px] max-sm:bg-[length:1000px_auto] max-sm:bg-[position:center_bottom_-63px] max-sm:opacity-[.15] print:hidden"
      />
    </div>
  )
}
