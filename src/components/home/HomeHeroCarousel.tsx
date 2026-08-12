'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Carrousel du héros (2 diapositives exactement) — accessible et sobre :
 *  - rotation automatique toutes les 8 s ;
 *  - arrêt au survol, tant qu'un élément a le focus, quand l'onglet est caché,
 *    et DÉFINITIVEMENT si prefers-reduced-motion est actif ;
 *  - reprise différée (15 s) après une interaction ;
 *  - flèches + 2 indicateurs, PLACÉS HORS des liens de diapositive (pas de
 *    contrôles imbriqués dans un lien) ;
 *  - hauteur réservée (aucun déplacement cumulatif de la page) ;
 *  - les diapositives sont rendues par le SERVEUR et passées en enfants.
 */
export function HomeHeroCarousel({
  label, slideLabels, prevLabel, nextLabel, goToLabel, children,
}: {
  label: string
  slideLabels: [string, string]
  prevLabel: string
  nextLabel: string
  goToLabel: string
  children: [React.ReactNode, React.ReactNode]
}) {
  const [active, setActive] = useState(0)
  const pausedRef = useRef(false)
  const resumeAtRef = useRef(0)
  const regionRef = useRef<HTMLElement>(null)
  const reducedRef = useRef(false)

  useEffect(() => {
    reducedRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = setInterval(() => {
      if (reducedRef.current || pausedRef.current || document.hidden) return
      if (Date.now() < resumeAtRef.current) return
      setActive((a) => (a + 1) % 2)
    }, 8000)
    return () => clearInterval(timer)
  }, [])

  const interact = useCallback((index: number) => {
    setActive(index)
    resumeAtRef.current = Date.now() + 15_000 // reprise après un délai raisonnable
  }, [])

  return (
    <section
      ref={regionRef}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => { pausedRef.current = true }}
      onMouseLeave={() => { pausedRef.current = false }}
      onFocusCapture={() => { pausedRef.current = true }}
      onBlurCapture={(e) => { if (!regionRef.current?.contains(e.relatedTarget as Node)) pausedRef.current = false }}
      className="relative"
    >
      {/* Hauteur réservée : les deux diapositives occupent la même grille. */}
      <div className="grid">
        {[0, 1].map((i) => (
          <div
            key={i}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} / 2 — ${slideLabels[i]}`}
            aria-hidden={active !== i}
            className={`col-start-1 row-start-1 transition-opacity duration-200 motion-reduce:transition-none ${
              active === i ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
            // inert empêche le focus clavier d'atteindre la diapositive masquée
            {...(active !== i ? { inert: '' as unknown as boolean } : {})}
          >
            {children[i]}
          </div>
        ))}
      </div>

      {/* Commandes HORS des liens de diapositive. */}
      <div className="mt-2 flex items-center justify-center gap-3 pb-2">
        <button
          type="button"
          onClick={() => interact((active + 1) % 2)}
          aria-label={prevLabel}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-koton/20 text-koton/70 outline-none ring-sitwon transition hover:border-liy hover:text-koton focus-visible:ring-2"
        >
          ‹
        </button>
        {[0, 1].map((i) => (
          <button
            key={i}
            type="button"
            aria-label={`${goToLabel} ${i + 1} — ${slideLabels[i]}`}
            aria-current={active === i}
            onClick={() => interact(i)}
            className={`flex h-11 items-center rounded-full px-2 outline-none ring-sitwon focus-visible:ring-2`}
          >
            <span className={`block h-2.5 rounded-full transition-all ${active === i ? 'w-8 bg-sitwon' : 'w-2.5 bg-koton/30 hover:bg-koton/50'}`} />
            <span className="sr-only">{slideLabels[i]}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => interact((active + 1) % 2)}
          aria-label={nextLabel}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-koton/20 text-koton/70 outline-none ring-sitwon transition hover:border-liy hover:text-koton focus-visible:ring-2"
        >
          ›
        </button>
      </div>
    </section>
  )
}
