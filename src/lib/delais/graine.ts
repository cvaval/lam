/**
 * § 5.1 — LA CONVERSION `EntreeGrainee` → LIGNE `DelaiEntry`. Fonction PURE.
 *
 * ⚠️ CORRECTIF (défaut 14 b du cahier de recette). La forme `EntreeGrainee` ne s'applique pas
 * telle quelle sur le modèle : elle produit `supplement` (un OBJET) là où la colonne est
 * `supplementJson String?`, elle produisait `surchargeAppliquee` et `citationArticle` qui
 * n'avaient PAS de colonne, et elle ne produit ni `masqueMotif` ni `masqueAt`. La graine
 * s'arrêtant avant d'écrire, la conversion n'avait jamais été exercée : le jour du `--apply`
 * aurait été le jour où on la découvre. Elle est donc écrite MAINTENANT, et testée.
 *
 * ⚠️ LE TYPE EST ÉCRIT À LA MAIN, à dessein. `Prisma.DelaiEntryCreateInput` n'existe pas
 * encore : le schéma du § 5.1 n'a **pas** été appliqué à la base de production, donc le
 * client généré ne connaît pas le modèle. Le jour de la migration, on remplace
 * `DelaiEntryCreateInput` ci-dessous par le type de Prisma et le compilateur dira, seul, si
 * la conversion tient. En attendant, `graine.test.ts` LIT `prisma/schema.prisma` et compare
 * colonne à colonne : une colonne ajoutée sans être convertie fait rougir le test.
 */
import type { EntreeGrainee } from './repertoire'

/**
 * Les colonnes que la graine RENSEIGNE. Sont volontairement absentes :
 *  - `id`, `createdAt`, `updatedAt` — la base les pose ;
 *  - `masqueMotif`, `masqueAt` — une entrée versée est `visible`, jamais masquée ; les
 *    renseigner à la création serait affirmer un masquage que personne n'a décidé (§ 7.3) ;
 *  - `distanceDoubleFr`, `distanceAideFr` — aides d'écran, à rédiger par la rédaction ;
 *    le répertoire ne les porte pas, et on n'invente pas un libellé d'aide.
 */
export type DelaiEntryCreateInput = {
  slug: string
  code: string
  codeLibelle: string
  article: string
  articleOccurrence: number
  articleContexte: string | null
  ordre: number
  tableau: number
  tableauTitreFr: string | null
  objetFr: string
  objetEn: string
  objetHt: string
  traductionRelue: boolean
  dureeTexte: string
  dureeFondementFr: string | null
  kind: string
  jours: number | null
  nbDistances: number
  supplementJson: string | null
  avisDistance: string | null
  citationArticle: string | null
  surchargeAppliquee: string | null
  regime: string
  regimeIncertain: boolean
  regimeFondement: string
  prorogation991: string
  prorogationFondement: string
  motifRefusFr: string | null
  motifRefusEn: string | null
  motifRefusHt: string | null
  pointDepartFr: string
  pointDepartEn: string
  pointDepartHt: string
  sanctionFr: string | null
  sanctionEn: string | null
  sanctionHt: string | null
  statut: string
  revision: number
}

/** Les colonnes du modèle que la graine laisse à la base ou à la rédaction. Voir ci-dessus. */
export const COLONNES_NON_GRAINEES: readonly string[] = [
  'id',
  'createdAt',
  'updatedAt',
  'masqueMotif',
  'masqueAt',
  'distanceDoubleFr',
  'distanceAideFr',
]

/**
 * `undefined` ne se verse jamais : Prisma le traite comme « ne touche pas à cette colonne »,
 * ce qui n'est pas la même chose que « cette colonne est vide ». On normalise en `null`.
 */
function ouNull<T>(v: T | null | undefined): T | null {
  return v ?? null
}

/** Une entrée du répertoire, telle qu'elle serait ÉCRITE. Aucune valeur inventée. */
export function versCreateInput(e: EntreeGrainee): DelaiEntryCreateInput {
  return {
    slug: e.slug,
    code: e.code,
    codeLibelle: e.codeLibelle,
    article: e.article,
    articleOccurrence: e.articleOccurrence,
    articleContexte: ouNull(e.articleContexte),
    ordre: e.ordre,
    tableau: e.tableau,
    tableauTitreFr: ouNull(e.tableauTitreFr),
    objetFr: e.objetFr,
    objetEn: e.objetEn,
    objetHt: e.objetHt,
    traductionRelue: e.traductionRelue,
    dureeTexte: e.dureeTexte,
    dureeFondementFr: ouNull(e.dureeFondementFr),
    kind: e.kind,
    jours: ouNull(e.jours),
    nbDistances: e.nbDistances ?? 0,
    // L'objet `Supplement` du § 4.5 devient du JSON : c'est la SEULE conversion de forme.
    supplementJson: e.supplement ? JSON.stringify(e.supplement) : null,
    avisDistance: ouNull(e.avisDistance),
    citationArticle: ouNull(e.citationArticle),
    surchargeAppliquee: ouNull(e.surchargeAppliquee),
    regime: e.regime,
    regimeIncertain: e.regimeIncertain,
    regimeFondement: e.regimeFondement,
    prorogation991: e.prorogation991,
    prorogationFondement: e.prorogationFondement,
    motifRefusFr: ouNull(e.motifRefusFr),
    motifRefusEn: ouNull(e.motifRefusEn),
    motifRefusHt: ouNull(e.motifRefusHt),
    pointDepartFr: e.pointDepartFr,
    pointDepartEn: e.pointDepartEn,
    pointDepartHt: e.pointDepartHt,
    sanctionFr: ouNull(e.sanctionFr),
    sanctionEn: ouNull(e.sanctionEn),
    sanctionHt: ouNull(e.sanctionHt),
    statut: e.statut,
    revision: e.revision ?? 1,
  }
}

/**
 * § 5.1 — la copie GELÉE de la révision 1. Sans elle, un calcul imprimé, cité dans une
 * écriture ou envoyé par courriel ne serait plus reproductible après la moindre édition du
 * répertoire. On gèle CE QUI SERA ÉCRIT, pas la forme intermédiaire.
 */
export function versRevisionPayload(e: EntreeGrainee): string {
  return JSON.stringify(versCreateInput(e))
}
