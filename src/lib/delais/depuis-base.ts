/**
 * § 5.1 — LA CONVERSION INVERSE DE `graine.ts` : une LIGNE DE BASE → la forme que le moteur
 * consomme. `graine.ts` fait `EntreeGrainee → DelaiEntry` (l'écriture) ; ce fichier fait
 * `DelaiEntry → EntreeDelai` (la lecture). Sans lui, chaque route reconstruirait l'objet à la
 * main, et la première qui oublierait `regimeIncertain` afficherait un délai comme franc
 * alors que la rédaction ne l'a pas qualifié.
 *
 * ⚠️ **FONCTIONS PURES, ET AUCUN `Date`.** Ce fichier ne connaît ni Prisma ni le réseau : il
 * prend une ligne déjà lue et rend un objet. C'est ce qui permet de le tester sans base — et
 * les tables `Delai*` n'existent pas encore.
 *
 * ⚠️ **AUCUN `as` SUR UNE COLONNE `String`.** Le schéma stocke `code`, `kind`, `regime`,
 * `prorogation991`, `typeEntree`, `categorie`, `autorite`, `journee` en `String` : une valeur
 * hors énumération est donc représentable en base. La convertir par un transtypage produirait
 * un `EntreeDelai` menteur, que le moteur traiterait comme valide — et le moteur, lui, calcule
 * une date. On REFUSE (§ 0, règle 1), on ne devine pas.
 */
import { z } from 'zod'
import { isValidCivil, parseIso } from './civil'
import type { EntreeCalendrier } from './feries'
import type { EntreeDelai, KindDelai, Supplement } from './calcul'
import type { CodeDelai, Prorogation991, Regime } from './regimes'

// ---------------------------------------------------------------------------
// Les énumérations que le schéma stocke en `String`
// ---------------------------------------------------------------------------

export const CODES: readonly CodeDelai[] = ['CPC', 'TRAVAIL', 'CIVIL']
export const KINDS: readonly KindDelai[] = [
  'JOURS',
  'JOURS_PLUS_DISTANCE_KM',
  'JOURS_DISTANCE_NON_CHIFFREE',
  'HEURES',
  'MOIS',
  'ANNEES',
  'INDETERMINE',
]
export const REGIMES: readonly Regime[] = ['FRANC', 'ORDINAIRE', 'A_VERIFIER']
export const PROROGATIONS: readonly Prorogation991[] = ['OUI', 'NON', 'INCERTAIN']
export const STATUTS = ['visible', 'masque', 'supprime'] as const
export type StatutEntree = (typeof STATUTS)[number]
export const TYPES_ENTREE = ['PERMANENT', 'A_SURVEILLER'] as const
export const CATEGORIES = ['FETE_LEGALE', 'FETE_NATIONALE', 'CHOMAGE_PAR_ARRETE'] as const
export const AUTORITES = ['TEXTE', 'REDACTION', 'OBSERVATION'] as const
export const JOURNEES = ['JOURNEE_ENTIERE', 'DEMI_JOURNEE_APRES_MIDI'] as const
export const AVIS_DISTANCE = ['A5', 'A5_BIS'] as const

/**
 * § 4.2 — les sept décalages admis, et AUCUN autre. Un huitième décalage introduirait au
 * calendrier une fête mobile que personne n'a datée.
 */
export const OFFSETS_PAQUES_ADMIS: readonly number[] = [-48, -47, -46, -3, -2, 39, 60]

// ---------------------------------------------------------------------------
// La forme d'une ligne, telle qu'on la LIT
// ---------------------------------------------------------------------------

/**
 * Les colonnes de `DelaiEntry` que la lecture exploite. Volontairement structurel plutôt que
 * `Prisma.DelaiEntry` : le modèle n'est pas migré, le client généré ne le connaît pas encore
 * (cf. l'avertissement en tête de `graine.ts`). Le jour de la migration, remplacer ce type par
 * celui de Prisma fera dire au compilateur, seul, si la lecture tient.
 */
export type LigneDelaiEntry = {
  id?: string
  slug: string
  code: string
  codeLibelle: string
  article: string
  articleOccurrence?: number
  articleContexte?: string | null
  ordre?: number
  tableau?: number
  tableauTitreFr?: string | null
  objetFr: string
  objetEn?: string
  objetHt?: string
  traductionRelue?: boolean
  dureeTexte: string
  dureeFondementFr?: string | null
  kind: string
  jours?: number | null
  nbDistances?: number
  distanceDoubleFr?: string | null
  distanceAideFr?: string | null
  supplementJson?: string | null
  avisDistance?: string | null
  citationArticle?: string | null
  surchargeAppliquee?: string | null
  regime: string
  regimeIncertain?: boolean
  regimeFondement: string
  prorogation991: string
  prorogationFondement: string
  motifRefusFr?: string | null
  motifRefusEn?: string | null
  motifRefusHt?: string | null
  pointDepartFr: string
  pointDepartEn?: string
  pointDepartHt?: string
  sanctionFr?: string | null
  sanctionEn?: string | null
  sanctionHt?: string | null
  statut?: string
  masqueMotif?: string | null
  revision?: number
}

/** Les colonnes de `DelaiFerie` que la lecture exploite. */
export type LigneDelaiFerie = {
  id?: string
  versionCalendrier?: number
  cle: string
  typeEntree?: string
  libelleFr: string
  libelleEn?: string
  libelleHt?: string
  categorie: string
  autorite: string
  journee?: string
  noteJourneeFr?: string | null
  noteJourneeEn?: string | null
  noteJourneeHt?: string | null
  traductionRelue?: boolean
  mobile?: boolean
  offsetPaques?: number | null
  mois?: number | null
  jour?: number | null
  source: string
  sourceDocId?: string | null
  appliqueDepuis: string
  observationsN?: number | null
  observationsTexteFr?: string | null
  observationsTexteEn?: string | null
  observationsTexteHt?: string | null
  observationsBorneFr?: string | null
  observationsBorneEn?: string | null
  observationsBorneHt?: string | null
  rechercheCorpusQ?: string | null
}

/** Une conversion réussit, ou elle dit POURQUOI elle a échoué. Jamais de repli silencieux. */
export type Conversion<T> = { ok: true; valeur: T } | { ok: false; motif: string }

// ---------------------------------------------------------------------------
// Le supplément (art. 74) — § 4.5
// ---------------------------------------------------------------------------

/**
 * La forme de `supplementJson`. Une option SANS `jours` ni `fondement` est refusée (§ 7.1).
 *
 * Le couple exact, tel que la donnée réelle l'impose (les six surcharges de l'art. 74) :
 *  - `jours` est TOUJOURS obligatoire — une option sans nombre ne dit rien ;
 *  - une option qui AJOUTE des jours doit porter son `fondement` : ajouter trente jours sans
 *    dire d'où ils viennent est exactement ce que ce produit refuse ;
 *  - une option qui n'ajoute RIEN (« En Haïti » : `jours: 0`) n'a pas de jours à fonder, mais
 *    doit dire POURQUOI elle n'ajoute rien — d'où la note (« L'article 74 ne s'applique
 *    pas. »). Exiger `fondement` sur celle-là aurait obligé à inventer une citation.
 */
const optionSupplement = z
  .object({
    cle: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'clé en minuscules, sans accent, tirets simples'),
    jours: z.number().int().min(0).max(3650),
    libelleFr: z.string().trim().min(1).max(200),
    noteFr: z.string().trim().max(600).optional(),
    fondement: z.string().trim().min(1).max(600).optional(),
  })
  .refine((o) => (o.jours > 0 ? !!o.fondement : !!(o.fondement || o.noteFr)), {
    message:
      'une option qui ajoute des jours porte son fondement ; une option qui n’en ajoute pas dit pourquoi',
  })

export const schemaSupplement = z.object({
  type: z.literal('ART_74'),
  questionFr: z.string().trim().min(1).max(400),
  obligatoire: z.boolean(),
  options: z.array(optionSupplement).min(1).max(12),
})

/** Relit `supplementJson`. `null` en base = pas de question de suite : ce n'est pas une erreur. */
export function lireSupplement(json: string | null | undefined): Conversion<Supplement | null> {
  if (json == null || json.trim() === '') return { ok: true, valeur: null }
  let brut: unknown
  try {
    brut = JSON.parse(json)
  } catch {
    return { ok: false, motif: 'supplementJson n’est pas du JSON valide.' }
  }
  const parsed = schemaSupplement.safeParse(brut)
  if (!parsed.success) {
    return {
      ok: false,
      motif: `supplementJson mal formé : ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join(' ; ')}`,
    }
  }
  return { ok: true, valeur: parsed.data }
}

// ---------------------------------------------------------------------------
// DelaiEntry → EntreeDelai
// ---------------------------------------------------------------------------

function dansListe<T extends string>(liste: readonly T[], v: string, champ: string): Conversion<T> {
  return liste.includes(v as T)
    ? { ok: true, valeur: v as T }
    : { ok: false, motif: `${champ} : « ${v} » n’est pas une valeur admise (${liste.join(' | ')}).` }
}

/**
 * La ligne devient l'objet que `calculer()` consomme. Tout ce qui n'est pas convertible est
 * REFUSÉ : mieux vaut une route en erreur qu'une date fondée sur une colonne illisible.
 */
export function versEntreeDelai(l: LigneDelaiEntry): Conversion<EntreeDelai> {
  const code = dansListe(CODES, l.code, 'code')
  if (!code.ok) return code
  const kind = dansListe(KINDS, l.kind, 'kind')
  if (!kind.ok) return kind
  const regime = dansListe(REGIMES, l.regime, 'regime')
  if (!regime.ok) return regime
  const prorogation = dansListe(PROROGATIONS, l.prorogation991, 'prorogation991')
  if (!prorogation.ok) return prorogation
  const supplement = lireSupplement(l.supplementJson)
  if (!supplement.ok) return supplement
  if (l.avisDistance != null && l.avisDistance !== '') {
    const avis = dansListe(AVIS_DISTANCE, l.avisDistance, 'avisDistance')
    if (!avis.ok) return avis
  }
  const nb = l.nbDistances ?? 0
  if (nb !== 0 && nb !== 1 && nb !== 2) {
    return { ok: false, motif: `nbDistances : ${nb} — seuls 0, 1 et 2 existent (§ 2.12).` }
  }

  return {
    ok: true,
    valeur: {
      slug: l.slug,
      code: code.valeur,
      codeLibelle: l.codeLibelle,
      article: l.article,
      articleContexte: l.articleContexte ?? null,
      objetFr: l.objetFr,
      dureeTexte: l.dureeTexte,
      dureeFondementFr: l.dureeFondementFr ?? null,
      kind: kind.valeur,
      jours: l.jours ?? null,
      nbDistances: nb,
      supplement: supplement.valeur,
      regime: regime.valeur,
      regimeIncertain: l.regimeIncertain ?? false,
      regimeFondement: l.regimeFondement,
      prorogation991: prorogation.valeur,
      prorogationFondement: l.prorogationFondement,
      pointDepartFr: l.pointDepartFr,
      motifRefusFr: l.motifRefusFr ?? null,
      // § 8.2 — le motif de refus est ce que l'écran affiche quand l'article ne produit pas
      // de date : il suit le repli de traduction du répertoire, comme l'objet et la sanction.
      motifRefusEn: l.motifRefusEn ?? null,
      motifRefusHt: l.motifRefusHt ?? null,
      traductionRelue: l.traductionRelue ?? false,
      avisDistance: (l.avisDistance as 'A5' | 'A5_BIS' | null) ?? null,
      citationArticle: l.citationArticle ?? null,
      revision: l.revision ?? 1,
    },
  }
}

/**
 * La copie gelée d'une révision (`DelaiEntryRevision.payloadJson`) redevient une ligne.
 * C'est ce qui rend un permalien reproductible : le calcul rejoué l'est sur la RÈGLE D'ALORS.
 */
export function ligneDepuisPayload(payloadJson: string): Conversion<LigneDelaiEntry> {
  let brut: unknown
  try {
    brut = JSON.parse(payloadJson)
  } catch {
    return { ok: false, motif: 'payloadJson n’est pas du JSON valide.' }
  }
  const o = brut as Partial<LigneDelaiEntry> | null
  if (!o || typeof o !== 'object') return { ok: false, motif: 'payloadJson n’est pas un objet.' }
  const requis: (keyof LigneDelaiEntry)[] = [
    'slug',
    'code',
    'codeLibelle',
    'article',
    'objetFr',
    'dureeTexte',
    'kind',
    'regime',
    'regimeFondement',
    'prorogation991',
    'prorogationFondement',
    'pointDepartFr',
  ]
  const manquants = requis.filter((c) => typeof o[c] !== 'string' || o[c] === '')
  if (manquants.length > 0) {
    return { ok: false, motif: `payloadJson incomplet : ${manquants.join(', ')}.` }
  }
  return { ok: true, valeur: o as LigneDelaiEntry }
}

// ---------------------------------------------------------------------------
// DelaiFerie → EntreeCalendrier
// ---------------------------------------------------------------------------

/**
 * Une ligne du calendrier devient une entrée que le moteur sait dater. Les contrôles portent
 * sur ce dont le moteur a BESOIN pour ne pas se tromper de jour : une fête mobile sans
 * décalage, ou une fête fixe sans mois, ne se date pas — et une entrée qui ne se date pas ne
 * doit jamais entrer dans un calcul.
 */
export function versEntreeCalendrier(f: LigneDelaiFerie): Conversion<EntreeCalendrier> {
  const typeEntree = dansListe(TYPES_ENTREE, f.typeEntree ?? 'PERMANENT', 'typeEntree')
  if (!typeEntree.ok) return typeEntree
  const categorie = dansListe(CATEGORIES, f.categorie, 'categorie')
  if (!categorie.ok) return categorie
  const autorite = dansListe(AUTORITES, f.autorite, 'autorite')
  if (!autorite.ok) return autorite
  const journee = dansListe(JOURNEES, f.journee ?? 'JOURNEE_ENTIERE', 'journee')
  if (!journee.ok) return journee

  const mobile = f.mobile ?? false
  if (mobile) {
    if (f.offsetPaques == null || !OFFSETS_PAQUES_ADMIS.includes(f.offsetPaques)) {
      return {
        ok: false,
        motif: `${f.cle} : entrée mobile dont le décalage pascal est absent ou hors des sept admis (${OFFSETS_PAQUES_ADMIS.join(', ')}).`,
      }
    }
  } else if (
    f.mois == null ||
    f.jour == null ||
    !isValidCivil({ y: 2024, m: f.mois, d: f.jour }) // 2024 est bissextile : le 29 février passe
  ) {
    return { ok: false, motif: `${f.cle} : entrée fixe dont le mois/jour n’est pas une date.` }
  }
  if (!f.source || f.source.trim() === '') {
    return { ok: false, motif: `${f.cle} : source vide — une entrée sans source est une opinion.` }
  }
  if (!parseIso(f.appliqueDepuis)) {
    return { ok: false, motif: `${f.cle} : appliqueDepuis « ${f.appliqueDepuis} » n’est pas une date ISO.` }
  }

  return {
    ok: true,
    valeur: {
      cle: f.cle,
      typeEntree: typeEntree.valeur,
      libelleFr: f.libelleFr,
      libelleEn: f.libelleEn || f.libelleFr,
      libelleHt: f.libelleHt || f.libelleFr,
      categorie: categorie.valeur,
      autorite: autorite.valeur,
      journee: journee.valeur,
      noteJourneeFr: f.noteJourneeFr ?? null,
      noteJourneeEn: f.noteJourneeEn ?? null,
      noteJourneeHt: f.noteJourneeHt ?? null,
      traductionRelue: f.traductionRelue ?? false,
      mobile,
      offsetPaques: f.offsetPaques ?? null,
      mois: f.mois ?? null,
      jour: f.jour ?? null,
      source: f.source,
      sourceDocId: f.sourceDocId ?? null,
      appliqueDepuis: f.appliqueDepuis,
      observationsN: f.observationsN ?? null,
      observationsTexteFr: f.observationsTexteFr ?? null,
      observationsTexteEn: f.observationsTexteEn ?? null,
      observationsTexteHt: f.observationsTexteHt ?? null,
      observationsBorneFr: f.observationsBorneFr ?? null,
      observationsBorneEn: f.observationsBorneEn ?? null,
      observationsBorneHt: f.observationsBorneHt ?? null,
      rechercheCorpusQ: f.rechercheCorpusQ ?? null,
    },
  }
}

/**
 * Le jeu complet d'une version. **Une seule ligne illisible fait échouer la version entière**
 * — et c'est voulu : un calendrier amputé d'une fête donne une date plus PRÉCOCE que le droit,
 * c'est-à-dire la forclusion que le produit prétend empêcher. Mieux vaut refuser de calculer.
 */
export function versCalendrier(
  lignes: readonly LigneDelaiFerie[],
): Conversion<readonly EntreeCalendrier[]> {
  const entrees: EntreeCalendrier[] = []
  for (const l of lignes) {
    const c = versEntreeCalendrier(l)
    if (!c.ok) return c
    entrees.push(c.valeur)
  }
  return { ok: true, valeur: entrees }
}
