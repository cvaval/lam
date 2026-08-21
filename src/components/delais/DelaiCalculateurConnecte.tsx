import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'
import { CadreCalculateur } from './DelaiCalculateur'
import { lireCalculateur, type RechercheDelai } from './noyau-calculateur'
import { DelaiForm } from './DelaiForm'

/**
 * LA SURFACE CONNECTÉE — `/[locale]/outils/delais`, dans le chrome applicatif.
 *
 * Elle porte le répertoire entier : ses 393 entrées, leur régime et son fondement, le
 * sélecteur de code, le filtre, les kilométrages, les questions de suite, la question « ce
 * délai est-il franc ? ». Rien de tout cela ne doit atteindre la page publique — ni en
 * données, ni en code : c'est pourquoi `DelaiForm` n'est importé QUE d'ici.
 *
 * ⚠️ **`connecte: true` est posé ici, jamais lu dans la requête.** La page hôte est sous
 * `(app)` et a déjà exigé sa session ; `&base=/outils/delais` dans l'URL ne décide que de
 * l'adresse du permalien émis.
 */
export async function DelaiCalculateurConnecte({
  locale,
  t,
  recherche,
  action,
}: {
  locale: Locale
  t: Dictionary
  recherche: RechercheDelai
  /** `/fr/outils/delais` — l'URL de la surface, jamais une constante. */
  action: string
}) {
  const etat = await lireCalculateur({ locale, t, recherche, action, connecte: true })
  if (!etat.pret) return etat.ecran

  return (
    <CadreCalculateur
      locale={locale}
      t={t}
      connecte
      calcul={etat.calcul}
      saisie={
        <DelaiForm
          locale={locale}
          t={t}
          action={action}
          codes={etat.codes}
          valeurs={etat.valeurs}
          erreur={etat.erreur}
        />
      }
    />
  )
}
