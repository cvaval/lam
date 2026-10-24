'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { indexDepart, indexVoisin } from '@/lib/search/navigation-occurrences'

/**
 * Navigation entre les occurrences du terme cherché, à l'arrivée sur une fiche depuis la recherche
 * (`?q=…`, R2 du 24 oct. 2026). Les occurrences sont les `<mark class="hl">` déjà rendues par le
 * serveur (texte, annotations, jurisprudence, ancienne rédaction — les replis qui en contiennent
 * sont ouverts d'office) : un seul composant pour tous les lecteurs.
 *
 *  - à l'arrivée : la 1ʳᵉ occurrence, ou la 1ʳᵉ APRÈS l'article désigné par l'adresse (`#art-N`) ;
 *  - « Occurrence 3 sur 12 » (annoncé), précédente / suivante, au clavier `n` et `Maj+n` ;
 *  - les occurrences sont relues à chaque pas : un repli ouvert à la main ajoute les siennes ;
 *  - aucune occurrence dans le texte affiché : on le DIT (le terme peut être dans le titre, le
 *    résumé ou le seul original) ; défilement sans animation si l'utilisateur le demande.
 */
export function NavigationOccurrences({ l }: { l: { of: string; prev: string; next: string; hide: string; none: string; region: string } }) {
  const [etat, setEtat] = useState<{ n: number; i: number } | null>(null)
  const [masquee, setMasquee] = useState(false)
  const courante = useRef<HTMLElement | null>(null)

  const lire = () => Array.from(document.querySelectorAll<HTMLElement>('article mark.hl'))

  const aller = useCallback((marques: HTMLElement[], i: number) => {
    const m = marques[i]
    if (!m) return
    if (courante.current) courante.current.style.outline = ''
    m.style.outline = '2px solid #152E38'
    m.style.outlineOffset = '1px'
    courante.current = m
    const doux = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    m.scrollIntoView({ block: 'center', behavior: doux ? 'smooth' : 'auto' })
    setEtat({ n: marques.length, i })
  }, [])

  // Arrivée : après l'ancre de l'adresse si elle désigne un article de la page.
  useEffect(() => {
    const marques = lire()
    if (!marques.length) { setEtat({ n: 0, i: -1 }); return }
    const id = window.location.hash ? decodeURIComponent(window.location.hash.slice(1)) : ''
    const cible = id ? document.getElementById(id) : null
    const apres = marques.map((m) => Boolean(cible && (cible.contains(m) || cible.compareDocumentPosition(m) & Node.DOCUMENT_POSITION_FOLLOWING)))
    // Laisser le navigateur poser l'ancre, puis centrer l'occurrence.
    const t = window.setTimeout(() => aller(marques, indexDepart(apres)), 60)
    return () => window.clearTimeout(t)
  }, [aller])

  const pas = useCallback((sens: 1 | -1) => {
    const marques = lire()
    if (!marques.length) return
    const actuel = courante.current ? marques.indexOf(courante.current) : -1
    aller(marques, indexVoisin(marques.length, actuel, sens))
  }, [aller])

  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.toLowerCase() !== 'n') return
      const cible = e.target as HTMLElement | null
      if (cible && (cible.isContentEditable || /^(input|textarea|select)$/i.test(cible.tagName))) return
      e.preventDefault()
      pas(e.shiftKey ? -1 : 1)
    }
    document.addEventListener('keydown', surTouche)
    return () => document.removeEventListener('keydown', surTouche)
  }, [pas])

  if (!etat || masquee) return null
  const bouton = 'inline-flex h-9 w-9 items-center justify-center rounded-full text-base text-white transition hover:bg-white/15 disabled:opacity-40'
  return (
    <div role="region" aria-label={l.region} className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 print:hidden">
      <div className="flex items-center gap-1 rounded-full bg-chabon py-1 pl-4 pr-1 text-sm text-white shadow-lg">
        {etat.n === 0 ? (
          <p className="max-w-[18rem] py-1 pr-2 text-[13px] leading-snug sm:max-w-md">{l.none}</p>
        ) : (
          <>
            <p aria-live="polite" className="whitespace-nowrap pr-1 tabular-nums">
              {l.of.replace('{i}', String(etat.i + 1)).replace('{n}', String(etat.n))}
            </p>
            <button type="button" onClick={() => pas(-1)} aria-label={l.prev} title={`${l.prev} (Maj+N)`} className={bouton}>‹</button>
            <button type="button" onClick={() => pas(1)} aria-label={l.next} title={`${l.next} (N)`} className={bouton}>›</button>
          </>
        )}
        <button type="button" onClick={() => { if (courante.current) courante.current.style.outline = ''; setMasquee(true) }} aria-label={l.hide} title={l.hide} className={bouton}>×</button>
      </div>
    </div>
  )
}
