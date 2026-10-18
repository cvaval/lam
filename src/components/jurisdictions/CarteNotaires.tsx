'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { JudicialMapClient } from './JudicialMapClient'

type MapProps = Omit<Parameters<typeof JudicialMapClient>[0], 'vue' | 'heightClass'>

const ORDINATEUR = '(min-width: 1024px)'

/** `null` avant le montage (rendu serveur) : on ne sait pas encore quelle carte afficher. */
function useOrdinateur(): boolean | null {
  const [v, setV] = useState<boolean | null>(null)
  useEffect(() => {
    const m = window.matchMedia(ORDINATEUR)
    const f = () => setV(m.matches)
    f()
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return v
}

/**
 * La VRAIE carte de la plateforme (`JudicialMap` : même fond, mêmes limites, mêmes couches),
 * dans l'onglet « Notaires ». UNE seule instance à la fois :
 *  - `colonne` : sur ordinateur, à gauche de l'annuaire ; rien sur téléphone ;
 *  - `mobile` : sur téléphone, sous le bouton « Afficher la carte » (l'annuaire vient d'abord) ;
 *    rien sur ordinateur.
 * MapLibre n'est jamais initialisé dans un conteneur masqué (il y mesurerait 0 × 0).
 */
export function CarteNotaires({
  place, map, ouverteParDefaut = false, cle = null, labels, entete, pied,
}: {
  place: 'colonne' | 'mobile'
  map: MapProps
  /** Téléphone : carte déjà ouverte (lien « Situer la commune sur la carte »). */
  ouverteParDefaut?: boolean
  /** Commune choisie : chaque nouveau « Situer sur la carte » ramène la carte à l'écran. */
  cle?: string | null
  labels: { show: string; hide: string; region: string }
  /**
   * Contenus serveur : `pied` dans le cadre de la carte (attribution, légende), `entete` SOUS le
   * cadre (choix des couches) — la carte vient d'abord, en haut de la colonne.
   */
  entete?: React.ReactNode
  pied?: React.ReactNode
}) {
  const ordi = useOrdinateur()
  const [ouverte, setOuverte] = useState(ouverteParDefaut)
  const id = useId()
  const boiteRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ouverteParDefaut) return
    setOuverte(true)
    // Téléphone : la carte est sous les filtres ; on l'amène à l'écran.
    if (place === 'mobile' && ordi === false) boiteRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [ouverteParDefaut, cle, ordi, place])

  if (place === 'colonne') {
    return (
      <section aria-label={labels.region} className="flex flex-col gap-3">
        <div className="overflow-hidden rounded-xl border border-liy bg-white">
          {ordi ? (
            <JudicialMapClient {...map} vue="notaires" heightClass="h-[calc(100vh-15rem)] min-h-[420px] max-h-[760px]" />
          ) : (
            // Hauteur réservée : aucun déplacement de la page au montage.
            <div aria-hidden="true" className="h-[calc(100vh-15rem)] min-h-[420px] max-h-[760px] bg-[#E9EDE7]" />
          )}
          {pied}
        </div>
        {entete}
      </section>
    )
  }

  if (ordi) return null
  return (
    <div ref={boiteRef} className="flex scroll-mt-24 flex-col gap-3">
      <button
        type="button"
        aria-expanded={ouverte}
        aria-controls={id}
        onClick={() => setOuverte((o) => !o)}
        className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-chabon bg-white px-4 text-sm font-medium text-chabon transition hover:bg-[#E9EDE7]"
      >
        <span aria-hidden="true">{ouverte ? '▾' : '▸'}</span>
        {ouverte ? labels.hide : labels.show}
      </button>
      <section id={id} aria-label={labels.region} hidden={!ouverte} className="flex flex-col gap-3">
        {ouverte && ordi === false && (
          <>
            <div className="overflow-hidden rounded-xl border border-liy bg-white">
              <JudicialMapClient {...map} vue="notaires" heightClass="h-[60vh] min-h-[320px]" />
              {pied}
            </div>
            {entete}
          </>
        )}
      </section>
    </div>
  )
}
