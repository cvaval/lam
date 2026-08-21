import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'
import { lireCalculateur, type RechercheDelai } from './noyau-calculateur'
import { DelaiDatePublique } from './DelaiDatePublique'
import { DelaiFormPublic } from './DelaiFormPublic'

/**
 * LA SURFACE PUBLIQUE — `/[locale]/delais`, sans compte, sans quota, sans journal.
 *
 * ⚠️ **DEUX CHAMPS, ET LA DATE. RIEN D'AUTRE** (Me Vaval, 20 août 2026 : « Le portail public
 * doit uniquement afficher la date. Pas besoin de […] lui expliquer le raisonnement qui a
 * mené au résultat. »). Le cadre à deux colonnes du portail — `CadreCalculateur`, avec son
 * `DelaiResult` et son `DelaiPedagogie` — n'est plus rendu ici : cette page n'a plus de
 * seconde colonne à remplir. Elle empile la saisie, puis la date.
 *
 * ⚠️ **CETTE ENVELOPPE EXISTE POUR CE QU'ELLE N'IMPORTE PAS.** `DelaiCalculateur` importait
 * statiquement `DelaiForm` ET `DelaiFormPublic` alors qu'il n'en rendait qu'un : Next plaçait
 * donc les deux dans le graphe client de CHAQUE route, et le chunk du formulaire connecté —
 * son filtre du répertoire, ses kilométrages, sa question de suite — était téléchargé par la
 * page d'entrée publique. Le même raisonnement vaut désormais pour l'écran de RÉSULTAT : le
 * noyau vit dans `noyau-calculateur.tsx`, qui n'importe ni `DelaiResult`, ni `DelaiPedagogie`,
 * ni `DelaiActions`. Ce n'est pas une fuite de DONNÉES — c'est la mécanique complète d'un
 * écran réservé livrée à qui ne la voit pas, et du poids inutile.
 *
 * Le noyau — frein de débit, lecture de base, calcul — reste partagé : deux chemins de calcul
 * seraient deux vérités.
 */
export async function DelaiCalculateurPublic({
  locale,
  t,
  recherche,
  action,
}: {
  locale: Locale
  t: Dictionary
  recherche: RechercheDelai
  /** `/fr/delais` — l'URL de la surface, jamais une constante. */
  action: string
}) {
  const etat = await lireCalculateur({ locale, t, recherche, action, connecte: false })
  if (!etat.pret) return etat.ecran

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <DelaiFormPublic
        locale={locale}
        t={t}
        action={action}
        valeurs={{ d: etat.valeurs.d, n: etat.valeurs.n }}
        erreur={etat.erreur}
      />
      {/* `aria-live` : après une soumission sans rechargement d'onglet, la date apparaît sous
          le formulaire — un lecteur d'écran doit l'annoncer. Rien n'est rendu tant qu'il n'y
          a pas de calcul : l'état vide de cette page, c'est la page elle-même. */}
      <section aria-live="polite" className="min-w-0">
        {etat.calcul && etat.calcul.ok && (
          <DelaiDatePublique
            locale={locale}
            t={t}
            resultat={etat.calcul.resultat}
            mentions={etat.calcul.mentionsJour}
            report={etat.calcul.report}
            lectureStricte={etat.calcul.lectureStricte}
            /* ⚠️ § 4.6 — le second permalien du § 6.3 : la MÊME saisie, sans coordonnée de
               version, donc rejouée sous les règles du jour. Il n'est utile que si le calcul
               affiché a été rendu sous une version périmée ; `DelaiDatePublique` ne rend la
               ligne que dans ce cas-là. */
            refaireHref={`${action}?d=${encodeURIComponent(etat.valeurs.d)}&n=${encodeURIComponent(etat.valeurs.n)}`}
          />
        )}
      </section>
    </div>
  )
}
