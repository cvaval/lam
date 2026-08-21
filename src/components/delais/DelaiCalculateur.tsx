import type { ReactNode } from 'react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'
import type { calculPublic } from '@/lib/delais/lecture-publique'
import { DelaiPedagogie } from './DelaiPedagogie'
import { DelaiResult } from './DelaiResult'

/**
 * § 6.3 — LE CADRE DU PORTAIL : la saisie à gauche, le résultat ENTIER à droite.
 *
 * ⚠️ **CE FICHIER EST DÉSORMAIS CELUI DU PORTAIL, ET DE LUI SEUL.** Le noyau — normalisation
 * de la requête, frein de débit, lecture de base, calcul — a été déplacé dans
 * `noyau-calculateur.tsx`, qui n'importe aucun écran de résultat. La raison est celle qui
 * avait déjà commandé la scission des formulaires : depuis le 20 août 2026, la surface
 * publique « doit uniquement afficher la date » (Me Vaval) — lui livrer quand même, dans son
 * graphe client, `DelaiResult`, `DelaiPedagogie` et `DelaiActions` (« Copier le raisonnement »,
 * « Imprimer ») serait la mécanique complète d'un écran réservé téléchargée par qui ne la voit
 * pas. `surfaces-delais.test.ts` vérifie que ce fichier n'est atteignable QUE depuis le
 * portail.
 *
 * ⚠️ **LE PORTAIL, LUI, N'A RIEN PERDU** : raisonnement pas à pas, jours écartés, lectures
 * nommées, « lecture la plus large », dernier jour praticable, avertissements A1…A6,
 * permalien, impression, presse-papiers, répertoire. Ce cadre les rend tous, comme avant.
 *
 * Les deux enveloppes — `DelaiCalculateurConnecte` (ici) et `DelaiCalculateurPublic` (son
 * propre cadre, minuscule) — appellent le MÊME `lireCalculateur` : deux chemins de calcul
 * seraient deux vérités.
 */

/**
 * ⚠️ Ré-exports de TYPE, jamais de valeur : `export type` s'efface à la compilation, donc
 * `import type { RechercheDelai } from './DelaiCalculateur'` n'emporte pas cet écran-ci dans
 * le graphe de qui l'écrit. Ils existent pour que les appelants historiques ne cassent pas ;
 * le code neuf prend le noyau à sa source.
 */
export type {
  EtatCalculateur,
  RechercheDelai,
  ValeursCalculateur,
} from './noyau-calculateur'

/** La colonne de saisie à gauche, le résultat (ou le cadre pédagogique) à droite. */
export function CadreCalculateur({
  locale,
  t,
  connecte,
  calcul,
  saisie,
}: {
  locale: Locale
  t: Dictionary
  connecte: boolean
  calcul: Awaited<ReturnType<typeof calculPublic>> | null
  /** Le formulaire de la surface — le SEUL point où les deux enveloppes diffèrent. */
  saisie: ReactNode
}) {
  return (
    // Une seule colonne sous `lg` : saisie d'abord, résultat ensuite (§ 6.5). Aucun
    // défilement horizontal, aucune barre latérale collante sur téléphone.
    <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
      <div className="no-print order-1 min-w-0">{saisie}</div>
      <section
        aria-labelledby={calcul && calcul.ok ? 'delai-resultat-titre' : 'delai-pedagogie'}
        aria-live="polite"
        className="order-2 min-w-0"
      >
        {calcul && calcul.ok ? (
          <DelaiResult
            locale={locale}
            t={t}
            resultat={calcul.resultat}
            entree={calcul.entree}
            permalien={calcul.permalien}
            versionCalendrier={calcul.versionCalendrier}
            versionFenetres={calcul.versionFenetres}
            fenetres={calcul.fenetres}
            bandeau={calcul.bandeau}
            avertissementsSaisie={calcul.avertissementsSaisie}
            connecte={connecte}
          />
        ) : (
          // Une erreur de paramètre est déjà rendue SOUS le champ fautif par le formulaire ;
          // ici on ne remet que le cadre pédagogique, jamais une seconde copie du message.
          //
          // ⚠️ **Un seul titre.** La section porte `aria-labelledby="delai-resultat-titre"`
          // et rendait un `<h2 sr-only>{d.emptyTitle}</h2>` juste avant le `<h2>` VISIBLE de
          // `DelaiPedagogie`, qui porte exactement le même texte : un lecteur d'écran
          // annonçait « How this calculator counts How this calculator counts ». La région
          // est désormais nommée par le titre visible.
          <DelaiPedagogie t={t} />
        )}
      </section>
    </div>
  )
}
