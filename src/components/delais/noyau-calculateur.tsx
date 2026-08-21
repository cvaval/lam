import type { ReactElement } from 'react'
import { headers } from 'next/headers'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'
import { formatIso, parseFrSaisie, parseIso } from '@/lib/delais'
import { SLUG_AUTRE, surfaceDepuisAction } from '@/lib/delais/permalien'
import {
  calculPublic,
  chargerRepertoirePublic,
  etatPublicDelais,
  lireParamsCalcul,
} from '@/lib/delais/lecture-publique'
import type { AccesDelais, CodeMenu } from '@/lib/delais/lecture-publique'
import type { CivilDate, Resultat } from '@/lib/delais'
import type { MentionJour, ReportPublic } from '@/lib/delais/mention-jour'
import { LIMITS, guard } from '@/lib/security/ratelimit'
import { ChampErreur } from '../ChampErreur'
import { messageErreur } from './messages'

/**
 * LE NOYAU DU CALCULATEUR — **ce que les DEUX surfaces partagent, et rien de plus.**
 *
 * `/[locale]/delais` et le héros de l'accueil (public, sans compte) d'un côté,
 * `/[locale]/(app)/outils/delais` (dans le chrome applicatif) de l'autre, appellent le même
 * moteur et lisent la même requête. Deux chemins de calcul seraient deux vérités.
 *
 * ⚠️ **CE FICHIER N'IMPORTE AUCUN ÉCRAN DE RÉSULTAT, ET C'EST SA RAISON D'ÊTRE.** Le noyau
 * vivait dans `DelaiCalculateur.tsx`, à côté de `CadreCalculateur` — qui rend `DelaiResult` et
 * `DelaiPedagogie`, donc `DelaiActions` (« Copier le raisonnement », « Imprimer »). La surface
 * publique, qui n'a besoin que de `lireCalculateur`, emportait ainsi dans son graphe client
 * TOUT l'appareil du portail : le raisonnement pas à pas, les jours écartés, les lectures
 * nommées, le presse-papiers. Depuis le 20 août 2026 elle n'affiche plus rien de tout cela
 * (« le portail public doit uniquement afficher la date », Me Vaval) : le lui livrer quand
 * même serait exactement le défaut que la scission des formulaires avait corrigé — la
 * mécanique complète d'un écran réservé chez qui ne la voit pas. `surfaces-delais.test.ts`
 * tient la porte fermée dans les deux sens.
 *
 * ⚠️ **Composant SERVEUR.** Le résultat est dans le HTML initial : il existe script désactivé,
 * et il n'y a aucun calcul dans le navigateur — donc aucune divergence possible avec les tests
 * du moteur.
 *
 * ⚠️ **Les tables `Delai*` peuvent ne pas exister.** Tant que la migration du § 5.1 n'est pas
 * passée, la lecture rend un refus `delaisSchemaAbsent` : l'écran affiche alors une phrase
 * lisible, jamais une trace technique.
 *
 * ⚠️ **LES DEUX SURFACES N'OFFRENT PLUS LA MÊME CHOSE.** Publiquement : la date de réception
 * de l'acte et le nombre de jours francs, deux champs, et le répertoire n'est PAS chargé —
 * ni pour l'afficher, ni pour le jeter. Dans l'espace connecté : le répertoire entier, ses
 * 393 entrées, son sélecteur de code, son filtre, ses kilométrages, ses questions de suite.
 * Le refus d'un slug demandé sans session est prononcé DEUX FOIS — ici, pour l'écrire à
 * l'écran, et dans `calculPublic()`, qui est le seul garde qui compte.
 */

export type RechercheDelai = Record<string, string | string[] | undefined>

/**
 * Normalise la requête avant toute lecture. Deux transformations, et deux seulement :
 *
 *  - **`km` répété devient `km` séparé par des virgules.** Les art. 517 et 586 mesurent DEUX
 *    distances, et un formulaire sans JavaScript envoie deux champs de même nom. Le permalien
 *    canonique du § 6.3, lui, n'a qu'un `km` — l'ordre des deux valeurs y compte. On joint,
 *    on n'invente pas de `km2`.
 *  - **la date française devient de l'ISO.** Le champ de saisie est un `<input type="date">`
 *    NATIF (§ 8.3) : sa valeur est toujours `AAAA-MM-JJ`, quelle que soit la locale du poste,
 *    et le permalien l'est aussi. Ce que cette conversion rattrape n'est donc PAS le champ —
 *    c'est une adresse tapée à la main, ou un permalien venu d'une autre origine, qui peut
 *    encore porter du JJ/MM/AAAA. Une seule des deux formes entre dans le moteur.
 */
export function normaliserRecherche(recherche: RechercheDelai): URLSearchParams {
  const sp = new URLSearchParams()
  for (const [cle, valeur] of Object.entries(recherche)) {
    if (valeur == null) continue
    if (Array.isArray(valeur)) {
      if (cle === 'km') {
        // ⚠️ On JOINT, on ne tronque pas : `lireKm` refuse au-delà de deux valeurs, et
        // `calculPublic` compare ensuite le compte au `nbDistances` de l'entrée. Tronquer
        // ici ferait disparaître une distance sans un mot — sur un permalien recopié, la
        // date changerait en silence (défaut 28).
        const joint = valeur.filter((v) => v.trim() !== '').join(',')
        if (joint) sp.set('km', joint)
      } else if (valeur.length > 0) {
        sp.set(cle, valeur[0])
      }
    } else {
      sp.set(cle, valeur)
    }
  }
  const d = sp.get('d')
  if (d && !parseIso(d)) {
    const fr = parseFrSaisie(d)
    if (fr) sp.set('d', formatIso(fr))
  }
  return sp
}

/**
 * § 6.1 — **LE HÉROS DE L'ACCUEIL NE TOUCHE À RIEN TANT QU'ON NE LUI A RIEN DEMANDÉ.**
 *
 * Depuis qu'il calcule sur place, il appelle `lireCalculateur` — donc le frein de débit et
 * deux lectures de base. L'accueil est la page la plus vue du site : un `guard()` et deux
 * `findFirst` sur CHAQUE visite anonyme, pour un formulaire que la plupart ne remplissent
 * pas, seraient une charge inventée. Le héros ne lit donc la base que si la requête porte
 * les deux champs — ce qui est exactement la condition de calcul de la surface publique.
 */
export function estDemandePublique(recherche: RechercheDelai): boolean {
  const sp = normaliserRecherche(recherche)
  return Boolean(sp.get('d') && sp.get('n'))
}

/**
 * Ce que le héros de l'accueil reçoit : la saisie relue, un refus éventuel, la date et sa
 * mention. **Rien de plus** — ni permalien, ni versions, ni entrée, ni fenêtres : le héros
 * n'affiche que la date (Me Vaval, 20 août 2026), et un type qui transporterait le reste
 * inviterait à le rendre.
 */
export type SaisieHeros = {
  valeurs: { d: string; n: string }
  erreur: string | null
  resultat: Resultat | null
  mentions: MentionJour[]
  /** Le report de l'art. 991, s'il a eu lieu — `null` quand la date n'a pas bougé. */
  report: ReportPublic | null
  /**
   * § 0 — la date qu'aurait donnée la lecture STRICTE de l'art. 991 al. 3, quand elle diffère
   * de celle qu'on affiche. C'est celle que le portail rend du même délai, et la plus précoce
   * des deux. ⚠️ **`null` PARTOUT sous le calendrier courant** — mesuré le 20 août 2026 au
   * soir : les deux surfaces rendent la même date sur 1 826 départs × 4 durées, l'écart est de
   * ZÉRO (`franc-pur.test.ts`, § 0) ; elle ne reparaît que sous un permalien `c=1`. L'accueil
   * la porte comme `/[locale]/delais` : les deux surfaces publiques rendent le même écran de
   * résultat, elles doivent en dire la même chose.
   */
  lectureStricte: CivilDate | null
}

/**
 * § 6.1 — **LE CALCUL DU HÉROS SE FAIT DANS LA PAGE, PAS DANS LE HÉROS.**
 *
 * `Landing` et `DelaisHeroSlide` restent des composants SYNCHRONES : c'est une convention que
 * le dépôt documente et qu'un test surveille (`Landing.test.tsx` — `renderToStaticMarkup` rend
 * un composant, pas une promesse). Rendre le héros `async` pour un `await` aurait fait de tout
 * l'accueil une frontière asynchrone, exactement ce qui avait déjà été défait une fois. La
 * seule frontière asynchrone reste donc `src/app/[locale]/page.tsx`, qui est déjà en
 * `force-dynamic`, et le héros reçoit un objet tout prêt.
 *
 * Rend `null` quand il n'y a rien à calculer — c'est le cas de la plupart des visites — et
 * quand la base n'est pas prête : sur l'accueil, une indisponibilité du calculateur ne doit
 * pas remplacer le héros par un message d'échec ; la page `/{locale}/delais`, elle, le dit.
 */
export async function lireHerosDelais({
  locale,
  t,
  recherche,
}: {
  locale: Locale
  t: Dictionary
  recherche: RechercheDelai
}): Promise<SaisieHeros | null> {
  if (!estDemandePublique(recherche)) return null
  const etat = await lireCalculateur({
    locale,
    t,
    recherche,
    // L'accueil EST la surface : le `GET` du héros y revient. `surfaceDepuisAction` n'y voit
    // pas `/outils/` — l'accès reste donc public, comme il doit l'être.
    action: `/${locale}`,
    connecte: false,
  })
  if (!etat.pret) return null
  return {
    valeurs: { d: etat.valeurs.d, n: etat.valeurs.n },
    erreur: etat.erreur,
    resultat: etat.calcul?.ok ? etat.calcul.resultat : null,
    mentions: etat.calcul?.ok ? etat.calcul.mentionsJour : [],
    report: etat.calcul?.ok ? etat.calcul.report : null,
    lectureStricte: etat.calcul?.ok ? etat.calcul.lectureStricte : null,
  }
}

/**
 * § 09 — LE FREIN DE DÉBIT DE LA PAGE.
 *
 * ⚠️ **Les deux routes publiques appelaient `guard()` ; la PAGE, non.** Elle est en
 * `force-dynamic` — donc jamais mise en cache — et appelle `chargerRepertoirePublic()` puis
 * `calculPublic()` DIRECTEMENT. Chaque `GET /fr/delais?d=…&e=…` déclenchait un `findMany` des
 * 393 lignes visibles, deux `findFirst` de version, le chargement du calendrier, des fenêtres,
 * de l'entrée et de sa révision : un script anonyme obtenait exactement le travail que la
 * route facture au seau, sans jamais toucher au seau.
 *
 * ⚠️ Rappel de `ratelimit.ts` : **le limiteur en mémoire est INOPÉRANT sur un déploiement
 * serverless** — chaque invocation part avec sa propre `Map`. Sur Vercel, ce frein ne freine
 * donc pas grand-chose ; il n'en reste pas moins la bonne place pour le poser, et le jour où
 * le dépôt passera au frein persistant, la page en héritera comme les routes.
 */
async function freinDeDebit(): Promise<boolean> {
  const ip =
    headers().get('x-forwarded-for')?.split(',')[0]?.trim() || headers().get('x-real-ip') || null
  return guard(
    { action: 'delais-page', subject: ip ?? 'anon', ...LIMITS.delaisCalcul },
    { ip },
  )
}

/** Les valeurs de la requête, telles que les deux formulaires les relisent. */
export type ValeursCalculateur = {
  d: string
  e: string
  km: string[]
  sup: string
  n: string
  f: string
  src: string
}

/**
 * Ce que la lecture rend aux deux enveloppes : soit un écran d'indisponibilité TERMINÉ (la
 * base n'est pas prête, le seau est vide), soit de quoi rendre la saisie et le résultat.
 */
export type EtatCalculateur =
  | { pret: false; ecran: ReactElement }
  | {
      pret: true
      /** Le menu du répertoire — VIDE en public : il n'y est même pas lu. */
      codes: CodeMenu[]
      valeurs: ValeursCalculateur
      erreur: string | null
      calcul: Awaited<ReturnType<typeof calculPublic>> | null
    }

/**
 * La base n'est pas prête : on le DIT, et on n'affiche pas un formulaire qui échouerait à
 * la première soumission. Un formulaire qui accepte la saisie puis casse se lit comme du
 * travail perdu, pas comme une indisponibilité.
 *
 * Pas de second titre : la page hôte porte déjà le sien. Un « Calculez une date limite »
 * répété au-dessus d'un échec se lit comme une invitation à essayer.
 */
function indisponible(t: Dictionary, code: string): ReactElement {
  return (
    <div className="rounded-xl border border-liy bg-white p-6">
      <ChampErreur prefixe={t.common.echec}>{messageErreur(t, code)}</ChampErreur>
      <p className="mt-3 text-sm leading-relaxed text-grafit">{t.delais.frameworkNote}</p>
    </div>
  )
}

/** Le frein, la lecture de base et le calcul — identiques sur les deux surfaces. */
export async function lireCalculateur({
  locale,
  t,
  recherche,
  action,
  connecte,
}: {
  locale: Locale
  t: Dictionary
  recherche: RechercheDelai
  action: string
  connecte: boolean
}): Promise<EtatCalculateur> {
  const sp = normaliserRecherche(recherche)

  // Le frein AVANT la première lecture de base : refuser après avoir travaillé ne freine rien.
  if (!(await freinDeDebit())) {
    return {
      pret: false,
      ecran: (
        <div className="rounded-xl border border-liy bg-white p-6">
          <ChampErreur prefixe={t.common.echec}>{messageErreur(t, 'rate')}</ChampErreur>
        </div>
      ),
    }
  }

  /**
   * ⚠️ **LE RÉPERTOIRE N'EST LU QUE POUR QUI Y A DROIT.** La page publique en `force-dynamic`
   * relisait les 393 lignes visibles À CHAQUE REQUÊTE pour peupler un menu qu'elle n'affiche
   * plus : c'était le répertoire servi en clair dans le HTML, et le travail de base qui va
   * avec. Publiquement on ne vérifie donc que ce dont on a besoin — que le calendrier et les
   * fenêtres existent —, en deux `findFirst` indexés.
   */
  let codes: CodeMenu[] = []
  if (connecte) {
    const repertoire = await chargerRepertoirePublic(null)
    if (!repertoire.ok) return { pret: false, ecran: indisponible(t, repertoire.code) }
    codes = repertoire.codes
  } else {
    const etat = await etatPublicDelais()
    if (!etat.ok) return { pret: false, ecran: indisponible(t, etat.code) }
  }

  const base = surfaceDepuisAction(action)
  const acces: AccesDelais = connecte ? 'connecte' : 'public'
  const valeurs: ValeursCalculateur = {
    d: sp.get('d') ?? '',
    e: sp.get('e') ?? '',
    km: (sp.get('km') ?? '').split(',').filter(Boolean),
    sup: sp.get('sup') ?? '',
    n: sp.get('n') ?? '',
    f: sp.get('f') ?? '',
    src: sp.get('src') ?? '',
  }

  // Aucun paramètre utile : l'état VIDE. On ne « calcule » pas une page d'accueil.
  // Publiquement, ce qui déclenche un calcul est la paire date + nombre de jours ; dans
  // l'espace connecté, c'est la paire date + entrée du répertoire.
  const demande = connecte ? Boolean(valeurs.d && valeurs.e) : Boolean(valeurs.d && valeurs.n)
  let calcul = null as Awaited<ReturnType<typeof calculPublic>> | null
  let erreur: string | null = null

  /**
   * ⚠️ **UN SLUG SUR LA SURFACE PUBLIQUE EST REFUSÉ, JAMAIS IGNORÉ.** `?e=cpc-354-…` ne doit
   * ni rendre l'entrée, ni retomber en silence sur l'état vide : la visiteuse saurait
   * seulement que « ça n'a rien fait ». On prononce le refus ici pour l'écrire à l'écran ;
   * `calculPublic()` le prononce de son côté, et c'est lui le garde.
   */
  if (!connecte && valeurs.e && valeurs.e !== SLUG_AUTRE) {
    erreur = 'repertoireReserve'
  } else if (demande && !parseIso(valeurs.d)) {
    // « 31/02/2026 » traverse la normalisation SANS devenir une date : le mois n'a pas
    // trente-et-un jours, et rien ne se rattrape au 1er mars. Sans ce contrôle, la
    // validation de la route le rejetterait pour sa FORME (« cette demande n'est pas
    // lisible ») alors que le défaut est le CONTENU — et l'utilisatrice chercherait une
    // faute de frappe dans son URL au lieu de relire son quantième.
    erreur = 'dateImpossible'
  } else if (demande) {
    const lus = lireParamsCalcul(new URLSearchParams({ ...Object.fromEntries(sp), locale, base }))
    if (!lus.ok) {
      erreur = lus.code
    } else {
      const sortie = await calculPublic(lus.valeur, acces)
      if (sortie.ok) calcul = sortie
      else erreur = sortie.code
    }
  }

  return { pret: true, codes, valeurs, erreur, calcul }
}
