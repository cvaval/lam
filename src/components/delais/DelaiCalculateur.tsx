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

/**
 * La colonne de saisie à gauche ; à droite, la colonne d'aide — et le résultat quand il existe.
 *
 * DEUX DISPOSITIONS (aperçu Agora, 9 oct. 2026), sous `lg` une seule colonne dans les deux cas,
 * la saisie d'abord (§ 6.5) :
 *  - **sans résultat** : saisie (≈ 57 %) | colonne d'aide (≈ 43 %), 36 px d'écart. L'aide peut
 *    rester visible au défilement (`lg:sticky`), bornée à la hauteur de l'écran et défilante
 *    elle-même : elle ne cache jamais son propre contenu ;
 *  - **avec résultat** : la saisie reprend une colonne fixe et le RÉSULTAT ENTIER a toute la
 *    largeur restante, comme avant — la colonne d'aide passe SOUS lui, repliée, jamais collante.
 *    Le résultat n'hérite donc ni de la colonne étroite ni du fond sauge de l'aide.
 */
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
  const resultat = calcul && calcul.ok ? calcul : null
  return (
    // Aucun défilement horizontal, aucune barre latérale collante sur téléphone.
    <div
      className={`ag-calculator-grid grid gap-9 lg:items-start ${
        resultat ? 'lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]' : 'lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]'
      }`}
    >
      <div className="no-print order-1 min-w-0">{saisie}</div>
      {resultat ? (
        <div className="order-2 flex min-w-0 flex-col gap-8">
          <section aria-labelledby="delai-resultat-titre" aria-live="polite" className="min-w-0">
            <DelaiResult
              locale={locale}
              t={t}
              resultat={resultat.resultat}
              entree={resultat.entree}
              permalien={resultat.permalien}
              versionCalendrier={resultat.versionCalendrier}
              versionFenetres={resultat.versionFenetres}
              fenetres={resultat.fenetres}
              bandeau={resultat.bandeau}
              avertissementsSaisie={resultat.avertissementsSaisie}
              connecte={connecte}
            />
          </section>
          <DelaiPedagogie t={t} />
        </div>
      ) : (
        // Une erreur de paramètre est déjà rendue SOUS le champ fautif par le formulaire ;
        // ici on ne remet que la colonne d'aide, jamais une seconde copie du message.
        //
        // ⚠️ **Un seul titre.** La section portait `aria-labelledby="delai-resultat-titre"`
        // et rendait un `<h2 sr-only>{d.emptyTitle}</h2>` juste avant le titre VISIBLE de
        // `DelaiPedagogie`, qui porte exactement le même texte : un lecteur d'écran
        // annonçait « How this calculator counts How this calculator counts ». La région
        // est désormais nommée par le titre visible.
        <section
          aria-labelledby="delai-pedagogie"
          aria-live="polite"
          // Collante sous l’en-tête applicatif (lui-même collant, ≈ 78 px) : 22 px d’air au-dessus.
          // Bornée à la hauteur de l'écran et défilante : dépliée, l'aide ne masque jamais sa fin.
          className="ag-calculator-aside order-2 min-w-0 lg:sticky lg:top-[100px] lg:max-h-[calc(100vh-124px)] lg:overflow-y-auto"
        >
          <DelaiPedagogie t={t} />
        </section>
      )}
    </div>
  )
}
