'use client'

import { useState } from 'react'
import type { Locale } from '@/lib/types'
import { JurisprudenceEditor } from './JurisprudenceEditor'
import { JurisprudenceCorpusEditor } from './JurisprudenceCorpusEditor'

/**
 * Deux gestes distincts, deux onglets : VERSER un recueil (créer les fiches à partir du
 * sommaire analytique) et ÉDITER le corpus (résumé éditorial, texte intégral, note).
 * Les mêler sur un seul écran ferait ressaisir tout un recueil pour corriger un résumé.
 */

const ONGLETS = [
  { id: 'versement', fr: 'Verser un recueil', en: 'Upload a volume', ht: 'Depoze yon rekèy' },
  { id: 'corpus', fr: 'Éditer le corpus', en: 'Edit the corpus', ht: 'Edite kòpis la' },
] as const

export function JurisprudenceAdmin({ locale }: { locale: Locale }) {
  const [onglet, setOnglet] = useState<'versement' | 'corpus'>('corpus')

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-ank">
          {locale === 'en' ? 'Judicial decisions' : locale === 'ht' ? 'Desizyon jidisyè' : 'Décisions judiciaires'}
        </h1>
      </div>

      <div role="tablist" aria-label="Sections" className="flex flex-wrap gap-2 border-b border-liy">
        {ONGLETS.map((o) => {
          const actif = onglet === o.id
          return (
            <button
              key={o.id}
              type="button"
              role="tab"
              aria-selected={actif}
              onClick={() => setOnglet(o.id)}
              // L'onglet actif porte son fond Sitwon ET un libellé en gras : l'état ne
              // tient jamais à la seule couleur.
 className={`-mb-px min-h-[44px] rounded-t-lg px-4 text-sm transition ${
                actif ? 'border-b-2 border-wouj bg-pil font-semibold text-chabon' : 'font-medium text-grafit hover:bg-pil'
              }`}
            >
              {locale === 'en' ? o.en : locale === 'ht' ? o.ht : o.fr}
            </button>
          )
        })}
      </div>

      {onglet === 'versement' ? <JurisprudenceEditor locale={locale} /> : <JurisprudenceCorpusEditor locale={locale} />}
    </div>
  )
}
