/**
 * § 6.3 — LE PERMALIEN. Fonctions PURES, aucun `Date`.
 *
 * `/{locale}/delais?d=2026-06-04&e=cpc-354-appel-parties-demeurant-haiti&r=1&c=1&w=1&rl=2&km=0`
 *
 * Trois exigences, et l'ordre des paramètres découle de la troisième :
 *  1. il porte TOUT ce dont le calcul dépend — date, entrée, **révision de l'entrée**,
 *     **version du calendrier**, **version des fenêtres**, **version des règles de lecture**,
 *     kilométrages, réponse à la question de suite. Un permalien qui omettrait la révision
 *     rendrait, dans six mois, une autre date sous la même adresse ;
 *  2. c'est un `GET` pur : aucune écriture serveur, reproductible à l'identique dans dix ans ;
 *  3. **l'ordre des paramètres est FIGÉ**, parce que le bloc 12 des tests exige qu'un
 *     permalien rechargé rende un résultat « identique au caractère près » — et le permalien
 *     fait partie de ce que le résultat affiche. Deux ordres possibles feraient deux chaînes
 *     pour un même calcul.
 */

/**
 * L'ordre canonique. Ne le change pas sans changer le bloc 12.
 *
 * `sig` n'en fait PAS partie : c'est la signature de cette chaîne-ci, elle se pose après
 * (§ 7.3, `permalien-signature.ts`). L'inclure signerait la signature.
 */
export const PARAMS_PERMALIEN = ['d', 'e', 'r', 'c', 'w', 'rl', 'km', 'sup', 'n', 'f', 'src'] as const

/**
 * § 6.4 — LES DEUX SURFACES. `/{locale}/delais` en public, `/{locale}/outils/delais` dans le
 * chrome applicatif. Le permalien partagé depuis l'espace connecté doit y RESTER : il était
 * codé en dur sur la page publique, si bien que « Refaire le calcul avec la règle actuelle »
 * faisait sortir l'utilisatrice connectée de l'application et lui faisait perdre les liens
 * profonds vers le corpus.
 */
export type SurfaceDelais = '/delais' | '/outils/delais'
export const SURFACE_PUBLIQUE: SurfaceDelais = '/delais'
export const SURFACE_CONNECTEE: SurfaceDelais = '/outils/delais'

/** La surface que porte l'`action` d'un formulaire (`/fr/outils/delais` → `/outils/delais`). */
export function surfaceDepuisAction(action: string): SurfaceDelais {
  return action.includes('/outils/') ? SURFACE_CONNECTEE : SURFACE_PUBLIQUE
}

/** Le genre « Autre » (§ 4.12) : le slug réservé, qui ne désigne aucune ligne du répertoire. */
export const SLUG_AUTRE = 'autre'

/**
 * Le paramètre `f` — LE MODE DE DÉCOMPTE de la saisie manuelle. `oui` = jours FRANCS (départ +
 * N + 1), `non` = jours CALENDAIRES (départ + N). Un jour d'écart, et le recours est forclos.
 *
 * ⚠️ **Trois valeurs se relisent, DEUX se proposent.** Depuis le 20 août 2026 le formulaire du
 * portail porte un commutateur à deux positions (§ 2, Me Vaval) : on ne demande plus à
 * l'utilisatrice de QUALIFIER son délai — « ce délai est-il franc ? », une question de droit —,
 * on lui demande comment elle veut qu'on compte. « Je ne sais pas » n'est pas une réponse à
 * cette question-là, et le commutateur ne l'offre plus.
 *
 * ⚠️ **`ne-sais-pas` reste néanmoins une valeur VALIDE, et le retirer d'ici serait une faute.**
 * Les permaliens émis avant cette date la portent ; le § 6.3 exige qu'ils se rejouent à
 * l'identique dans dix ans, et un lien copié de bonne foi échouerait en 400. Le moteur, lui,
 * n'a pas changé : `regimeIncertain` calcule la tête d'affiche en ORDINAIRE et nomme le
 * décompte franc en lecture concurrente.
 */
export const REPONSES_FRANC = ['oui', 'non', 'ne-sais-pas'] as const
export type ReponseFranc = (typeof REPONSES_FRANC)[number]

/** Les DEUX positions du commutateur — ce que le formulaire propose aujourd'hui. */
export const POSITIONS_DECOMPTE = ['oui', 'non'] as const satisfies readonly ReponseFranc[]

export type ParamsPermalien = {
  /** Date de départ, AAAA-MM-JJ. */
  d: string
  /** Slug de l'entrée, ou « autre ». */
  e: string
  /** Révision de l'entrée. Absente pour « autre », qui n'a pas de ligne en base. */
  r?: number | null
  /** Version du calendrier des fêtes. */
  c: number
  /** Version des fenêtres de signification. */
  w: number
  /**
   * § 4.6 — **LA VERSION DES RÈGLES DE LECTURE** (`regles-lecture.ts`) : les fêtes nationales
   * prorogent-elles, et la prorogation joue-t-elle en cascade ?
   *
   * ⚠️ **AJOUTÉE LE 20 AOÛT 2026 (SOIR), ET C'EST LE SEUL JOUR OÙ ELLE COÛTAIT ZÉRO.** La règle
   * de tête a changé deux fois en vingt-quatre heures (R6 le matin, R1 et R3 le soir) : c'est
   * donc une VARIABLE du calcul, et l'exigence n° 1 ci-dessus la réclame au même titre que `c`
   * et `w`. Elle est introduite avant la mise en ligne — aucun permalien n'a jamais été émis,
   * aucune signature n'est invalidée. Après, il aurait fallu deviner ce que vaut le paramètre
   * ABSENT des liens déjà partagés, c'est-à-dire rendre une date de forclusion sur une
   * supposition. Le raisonnement complet, contradictoire compris, est en tête de
   * `regles-lecture.ts`.
   *
   * ⚠️ **TOUJOURS ÉMISE, jamais omise quand elle vaut la courante** — même règle que `c` et
   * `w` : un lien copié aujourd'hui doit rendre la date d'aujourd'hui le jour où la version
   * courante aura changé.
   */
  rl: number
  /** Un kilométrage par distance à mesurer (0, 1 ou 2 valeurs). */
  km?: readonly number[] | null
  /** Réponse à la question de suite (art. 74) : « haiti » | « antilles » | « outre-ocean ». */
  sup?: string | null
  /** « Autre » : le nombre de jours lu dans le document. */
  n?: number | null
  /** « Autre » : ce délai est-il franc ? */
  f?: ReponseFranc | null
  /** « Autre » : la nature du délai, saisie par l'utilisatrice. Obligatoire pour « autre ». */
  src?: string | null
}

/** Le permalien complet, signature comprise. `sig` se pose TOUJOURS en dernier. */
export function avecSignature(chemin: string, signature: string | null): string {
  return signature ? `${chemin}&sig=${signature}` : chemin
}

/** La partie « query » du permalien, sans le `?`. Les paramètres vides sont OMIS, pas vides. */
export function queryPermalien(p: ParamsPermalien): string {
  const q = new URLSearchParams()
  q.set('d', p.d)
  q.set('e', p.e)
  if (p.r != null) q.set('r', String(p.r))
  q.set('c', String(p.c))
  q.set('w', String(p.w))
  q.set('rl', String(p.rl))
  // Les kilométrages tiennent dans UN paramètre séparé par des virgules : deux `km=` répétés
  // se relisent différemment selon les serveurs, et l'ordre des deux distances compte
  // (art. 517, art. 586).
  if (p.km && p.km.length > 0) q.set('km', p.km.join(','))
  if (p.sup) q.set('sup', p.sup)
  if (p.n != null) q.set('n', String(p.n))
  if (p.f) q.set('f', p.f)
  if (p.src) q.set('src', p.src)

  // On réémet dans l'ordre canonique : `URLSearchParams` conserve l'ordre d'insertion, mais
  // l'expliciter protège d'un réordonnancement introduit par une édition future.
  const ordonne = new URLSearchParams()
  for (const cle of PARAMS_PERMALIEN) {
    const v = q.get(cle)
    if (v != null) ordonne.set(cle, v)
  }
  return ordonne.toString()
}

/**
 * Le permalien complet, relatif — jamais d'origine en dur : la page peut être servie ailleurs.
 * La SURFACE est un paramètre : un permalien émis depuis l'espace connecté y reste (§ 6.4).
 */
export function construirePermalien(
  locale: string,
  p: ParamsPermalien,
  base: SurfaceDelais = SURFACE_PUBLIQUE,
): string {
  return `/${locale}${base}?${queryPermalien(p)}`
}

/**
 * Relit la liste des kilométrages. `« 267,120 »` → `[267, 120]`. Une valeur non entière, ou
 * négative, rend `null` : la route refuse alors la requête plutôt que d'arrondir (§ 2.12,
 * interdit n° 4 — la distance ne s'arrondit JAMAIS).
 */
export function lireKm(brut: string | null | undefined, maximum = 2): number[] | null {
  if (brut == null || brut.trim() === '') return []
  const morceaux = brut.split(',').map((s) => s.trim())
  if (morceaux.length > maximum) return null
  const km: number[] = []
  for (const m of morceaux) {
    if (!/^\d{1,5}$/.test(m)) return null
    const n = Number(m)
    if (!Number.isInteger(n) || n < 0 || n > 20_000) return null
    km.push(n)
  }
  return km
}
