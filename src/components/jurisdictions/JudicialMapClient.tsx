'use client'

import dynamic from 'next/dynamic'
import type { LayerSlug } from '@/lib/jurisdictions/constants'
import type { Locale } from '@/lib/types'

/**
 * Enveloppe client de la carte : MapLibre est importé DYNAMIQUEMENT, sans rendu
 * serveur, et uniquement sur cette page (le héros de l'accueil ne le charge
 * jamais). L'état de chargement réserve la hauteur (aucun déplacement cumulatif) ;
 * sans JavaScript, le repli textuel s'affiche.
 */
const JudicialMap = dynamic(() => import('./JudicialMap').then((m) => m.JudicialMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-[46vh] items-center justify-center bg-lank-50 lg:h-[560px]" aria-hidden="true">
      <span className="animate-pulse font-mono text-xs text-lank/40">…</span>
    </div>
  ),
})

export function JudicialMapClient(props: {
  locale: Locale
  selectedCommuneId: string | null
  layers: LayerSlug[]
  attribution: string
  loadingLabel: string
  fallback: React.ReactNode
}) {
  return (
    <>
      <noscript>{props.fallback}</noscript>
      <JudicialMap
        locale={props.locale}
        selectedCommuneId={props.selectedCommuneId}
        layers={props.layers}
        attribution={props.attribution}
        loadingLabel={props.loadingLabel}
      />
    </>
  )
}
