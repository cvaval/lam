'use client'

import { useRef, useState } from 'react'
import { ActionButton } from '../ActionButton'
import { PrintButton } from '../PrintButton'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'
import type { Resultat } from '@/lib/delais'
import type { Bandeau } from '@/lib/delais/bandeau'
import { texteRaisonnement } from '@/lib/delais/affichage'

/**
 * § 6.3 j — LES DEUX ACTIONS. **Copier met le raisonnement INTÉGRAL dans le presse-papiers,
 * jamais la date seule.**
 *
 * C'est la citation que l'avocate collera dans une écriture : elle doit être opposable telle
 * quelle. Une date nue, copiée sans ses réserves, ses jours écartés et son permalien, est
 * exactement le défaut du § 0 — un chiffre qui a l'air sûr et que rien ne fonde.
 *
 * Le texte n'est pas recomposé ici : il vient de `texteRaisonnement()`, la MÊME fonction pure
 * que le composant serveur emploie pour ses blocs. Deux rédactions du même raisonnement, et
 * la version opposable serait celle que personne n'a relue.
 *
 * ⚠️ **Repli obligatoire quand le presse-papiers est refusé** (Safari hors geste utilisateur,
 * contexte non sécurisé, permission déniée) : un `<textarea>` sélectionné, avec sa consigne.
 * Un bouton qui ne fait rien et n'explique rien est pire qu'un bouton absent.
 */
export function DelaiActions({
  t,
  locale,
  resultat,
  entree,
  permalien,
  versionCalendrier,
  versionFenetres,
  revision,
  bandeau,
  collante = false,
}: {
  t: Dictionary
  locale: Locale
  resultat: Resultat
  entree: {
    slug?: string
    code: string
    article: string
    objetFr: string
    dureeTexte: string
    dureeFondementFr?: string | null
    citationArticle?: string | null
  }
  permalien: string
  versionCalendrier: number
  versionFenetres: number
  revision: number | null
  /**
   * § 7.3 — **CE QUI RELATIVISE LA DATE PART AVEC ELLE.** L'impression emportait les
   * bandeaux (ils n'ont pas de classe `.no-print`) ; le presse-papiers, non. Le texte collé
   * dans une écriture ne disait donc pas un mot du retrait de l'entrée ni du changement de
   * règle — une date sûre en apparence, sous une règle que la plateforme ne propose plus.
   */
  bandeau?: Bandeau
  /** § 6.5 — la variante collante en bas d'écran, sous 1024 px. */
  collante?: boolean
}) {
  const d = t.delais
  const [copie, setCopie] = useState(false)
  const [repli, setRepli] = useState<string | null>(null)
  const zone = useRef<HTMLTextAreaElement>(null)

  function composer(): string {
    // L'origine ne se lit qu'au navigateur : le serveur ne sait pas sous quel domaine il est
    // servi, et une origine en dur périmerait le jour d'un changement de domaine.
    const origine = typeof window !== 'undefined' ? window.location.origin : ''
    return texteRaisonnement({
      resultat,
      entree,
      permalien,
      origine,
      versionCalendrier,
      versionFenetres,
      revision,
      locale,
      bandeau: bandeau ?? null,
    })
  }

  async function copier() {
    const texte = composer()
    try {
      await navigator.clipboard.writeText(texte)
      setCopie(true)
      setRepli(null)
      setTimeout(() => setCopie(false), 2500)
    } catch {
      setRepli(texte)
      // Le focus part sur la zone de repli, sélectionnée : au clavier, Ctrl/Cmd+C suffit.
      setTimeout(() => {
        zone.current?.focus()
        zone.current?.select()
      }, 0)
    }
  }

  return (
    <div
      className={
        collante
          ? // § 6.5 — « Barre d'actions collante en bas (Copier / Imprimer) » sur mobile. Sur
            // un résultat long — raisonnement, jours écartés, réserves, sept avertissements,
            // textes intégraux — les deux boutons sortaient de vue dès la première ligne lue.
            'no-print sticky bottom-0 z-20 -mx-4 flex flex-col gap-2 border-t border-liy bg-white/95 px-4 py-2 backdrop-blur lg:hidden'
          : 'flex flex-col gap-2'
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton ariaLive="polite" onClick={copier}>
          {copie ? d.copied : `❝ ${d.copyReasoning}`}
        </ActionButton>
        <PrintButton label={d.print} />
      </div>
      {repli !== null && (
        <div>
          <label htmlFor="delai-copie-repli" className="block text-xs text-ank">
            {d.copyFallbackHint}
          </label>
          <textarea
            id="delai-copie-repli"
            ref={zone}
            readOnly
            rows={6}
            value={repli}
            className="mt-1 w-full rounded-lg border border-liy bg-white p-2 font-mono text-[11px] text-ank"
          />
        </div>
      )}
    </div>
  )
}
