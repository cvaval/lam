'use client'

import { useRouter } from 'next/navigation'

/**
 * Lien « retour » de la fiche document : revient à la page de RÉSULTATS d'où l'on vient
 * — sa pagination et ses filtres exacts — plutôt qu'à une recherche reconstruite depuis
 * la première page.
 *
 * ⚠️ IL PROMET UNE LISTE : IL DOIT RENDRE UNE LISTE. `router.back()` seul ramenait à la
 * page précédente quelle qu'elle fût : en venant d'une décision qui en cite une autre,
 * « ← Recueil de jurisprudence » renvoyait à la décision précédente, pas au recueil. On
 * ne revient donc en arrière que si la page précédente est bien une liste ; sinon on va
 * là où l'intitulé le dit.
 */
const LISTES = /\/(search|dashboard|legislationannotee|editionsmoniteur|tarifs|juridictions|juge)(\?|\/|$)/

export function BackLink({ fallback, label }: { fallback: string; label: string }) {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => {
        const ref = typeof document !== 'undefined' ? document.referrer : ''
        const memeSite = !!ref && typeof window !== 'undefined' && ref.startsWith(window.location.origin)
        if (memeSite && LISTES.test(ref) && window.history.length > 1) router.back()
        else router.push(fallback)
      }}
      className="text-sm text-ank/80 hover:text-ank"
    >
      ← {label}
    </button>
  )
}
