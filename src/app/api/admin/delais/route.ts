import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api'
import { prisma } from '@/lib/db'
import { requireAdminApi, requireCapabilityApi } from '@/lib/auth/guard'
import { audit } from '@/lib/auth/audit'
import { PREFIXE_CODE, SLUG_VALIDE, slugifierArticle, suffixeObjet } from '@/lib/delais/repertoire'
import { AVIS_DISTANCE, CODES, KINDS, PROROGATIONS, REGIMES } from '@/lib/delais/depuis-base'
import { numeroArticle } from '@/lib/delais/calcul'
import { ABREGE_CODE } from '@/lib/delais/regimes'
import type { CodeDelai } from '@/lib/delais/regimes'
import { confirmationTypeeValide, validerEntree, validerMotif } from '@/lib/delais/validation-admin'
import type { Anomalie } from '@/lib/delais/validation-admin'
import { estSchemaAbsent } from '@/lib/delais/service-base'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * § 7 — LE RÉPERTOIRE DES DÉLAIS : **ajouter, masquer, supprimer — trois verbes, trois
 * comportements**, et c'est la différence entre eux qui compte :
 *
 *  - **ajouter** (POST) écrit la ligne ET sa copie gelée, dans UNE transaction ;
 *  - **modifier** (PATCH `op: 'modifier'`) incrémente `revision` et gèle la nouvelle ;
 *  - **masquer** (PATCH `op: 'masquer'`) retire du menu, **sans toucher à `revision`** — un
 *    permalien antérieur reste reproductible à l'identique — et se **défait** ;
 *  - **supprimer** (DELETE) est réservé au **master admin**, exige une confirmation typée, et
 *    n'efface JAMAIS rien physiquement.
 *
 * > **RÈGLE ABSOLUE (§ 7.3) : aucune action d'administration ne modifie, ne recalcule ni
 * > n'efface un résultat déjà rendu.** Un calcul a pu être imprimé, collé dans une écriture,
 * > envoyé à un confrère, cité devant un tribunal. Ce qu'il disait doit rester lisible et
 * > reproductible. C'est `DelaiEntryRevision` — table **en ajout seul** — qui le garantit :
 * > jamais de `update`, jamais de `delete` sur elle.
 *
 * **Double garde, sans exception.** Consulter / ajouter / modifier / masquer / démasquer :
 * `corpus.manage`. **Supprimer : master admin seul.** La page porte la même paire (§ 7).
 */

// ---------------------------------------------------------------------------
// Le corps des requêtes
// ---------------------------------------------------------------------------

const texte = (max: number) => z.string().trim().max(max)
const texteOpt = (max: number) => z.string().trim().max(max).nullish()

/** Les colonnes que le formulaire du § 7.1 renseigne. Le `slug` n'en est pas : il se DÉRIVE. */
const champsEntree = z.object({
  code: z.enum(CODES as unknown as [string, ...string[]]),
  codeLibelle: texte(120).optional(),
  article: texte(120).min(1),
  articleOccurrence: z.number().int().min(1).max(50).default(1),
  articleContexte: texteOpt(400),
  ordre: z.number().int().min(0).max(10_000).default(0),
  tableau: z.number().int().min(1).max(100),
  tableauTitreFr: texteOpt(300),
  objetFr: texte(500).min(1),
  objetEn: texte(500).default(''),
  objetHt: texte(500).default(''),
  traductionRelue: z.boolean().default(false),
  dureeTexte: texte(500).min(1),
  dureeFondementFr: texteOpt(1000),
  kind: z.enum(KINDS as unknown as [string, ...string[]]),
  jours: z.number().int().min(0).max(3650).nullish(),
  nbDistances: z.number().int().min(0).max(2).default(0),
  distanceDoubleFr: texteOpt(600),
  distanceAideFr: texteOpt(600),
  supplementJson: texteOpt(4000),
  avisDistance: z.enum(AVIS_DISTANCE as unknown as [string, ...string[]]).nullish(),
  citationArticle: texteOpt(2000),
  surchargeAppliquee: texteOpt(400),
  regime: z.enum(REGIMES as unknown as [string, ...string[]]),
  regimeIncertain: z.boolean().default(false),
  regimeFondement: texte(2000).min(1),
  prorogation991: z.enum(PROROGATIONS as unknown as [string, ...string[]]),
  prorogationFondement: texte(2000).min(1),
  motifRefusFr: texteOpt(1000),
  motifRefusEn: texteOpt(1000),
  motifRefusHt: texteOpt(1000),
  pointDepartFr: texte(400).min(1),
  pointDepartEn: texte(400).default(''),
  pointDepartHt: texte(400).default(''),
  sanctionFr: texteOpt(400),
  sanctionEn: texteOpt(400),
  sanctionHt: texteOpt(400),
})
type ChampsEntree = z.infer<typeof champsEntree>

const corpsPatch = z.discriminatedUnion('op', [
  z.object({ op: z.literal('modifier'), id: z.string().min(1).max(60), champs: champsEntree }),
  z.object({ op: z.literal('masquer'), id: z.string().min(1).max(60), motif: texte(600) }),
  z.object({ op: z.literal('reafficher'), id: z.string().min(1).max(60) }),
  /**
   * § 7.3 — DÉFAIRE UNE SUPPRESSION EST UN VERBE À PART, et il n'est pas « réafficher ».
   *
   * Supprimer est réservé au master admin, exige un motif et une confirmation typée ; défaire
   * une suppression doit coûter EXACTEMENT le même prix, sinon la garde de la suppression ne
   * garde rien : un éditeur `corpus.manage` remettrait au menu du calculateur une entrée
   * retirée parce qu'elle était juridiquement fausse. Le verbe est donc distinct — jamais une
   * branche de `reafficher` —, gardé par `requireAdminApi()`, et journalisé sous son propre
   * nom (`DELAI_ENTRY_UNDELETED`) pour qu'un aller-retour se lise au journal.
   */
  z.object({
    op: z.literal('restaurer-suppression'),
    id: z.string().min(1).max(60),
    motif: texte(600),
    confirmation: texte(120),
  }),
])

const corpsDelete = z.object({
  id: z.string().min(1).max(60),
  motif: texte(600),
  /** § 7.3 — l'éditeur recopie le numéro d'article. Une case à cocher se coche sans lire. */
  confirmation: texte(120),
})

const LIBELLE_CODE_DEFAUT: Record<string, string> = {
  CPC: 'Code de procédure civile',
  TRAVAIL: 'Code du travail',
  CIVIL: 'Code civil',
}

/** Le refus, avec la LISTE des anomalies : trois fautes se corrigent en une fois, pas en trois. */
function refusValidation(anomalies: Anomalie[]) {
  return NextResponse.json({ ok: false, error: 'invalidFields', anomalies }, { status: 400 })
}

/** Les colonnes, prêtes pour Prisma. `undefined` ne se verse jamais : on normalise en `null`. */
function versColonnes(c: ChampsEntree) {
  const n = (v: string | null | undefined) => (v && v.trim() !== '' ? v.trim() : null)
  return {
    code: c.code,
    codeLibelle: c.codeLibelle?.trim() || LIBELLE_CODE_DEFAUT[c.code] || c.code,
    article: c.article,
    articleOccurrence: c.articleOccurrence,
    articleContexte: n(c.articleContexte),
    ordre: c.ordre,
    tableau: c.tableau,
    tableauTitreFr: n(c.tableauTitreFr),
    objetFr: c.objetFr,
    // Une traduction absente retombe sur le français à l'affichage (§ 5.2) ; on ne stocke pas
    // une chaîne vide qui, elle, s'afficherait vide.
    objetEn: c.objetEn || c.objetFr,
    objetHt: c.objetHt || c.objetFr,
    traductionRelue: c.traductionRelue,
    dureeTexte: c.dureeTexte,
    dureeFondementFr: n(c.dureeFondementFr),
    kind: c.kind,
    jours: c.jours ?? null,
    nbDistances: c.nbDistances,
    distanceDoubleFr: n(c.distanceDoubleFr),
    distanceAideFr: n(c.distanceAideFr),
    supplementJson: n(c.supplementJson),
    avisDistance: n(c.avisDistance),
    citationArticle: n(c.citationArticle),
    surchargeAppliquee: n(c.surchargeAppliquee),
    regime: c.regime,
    regimeIncertain: c.regimeIncertain,
    regimeFondement: c.regimeFondement,
    prorogation991: c.prorogation991,
    prorogationFondement: c.prorogationFondement,
    motifRefusFr: n(c.motifRefusFr),
    motifRefusEn: n(c.motifRefusEn),
    motifRefusHt: n(c.motifRefusHt),
    pointDepartFr: c.pointDepartFr,
    pointDepartEn: c.pointDepartEn || c.pointDepartFr,
    pointDepartHt: c.pointDepartHt || c.pointDepartFr,
    sanctionFr: n(c.sanctionFr),
    sanctionEn: n(c.sanctionEn),
    sanctionHt: n(c.sanctionHt),
  }
}

/**
 * § 5.2 bis — LE SLUG NE SE SAISIT PAS, IL SE DÉRIVE, avec la règle exacte des 393 lignes de
 * la graine : `code-article`, et `code-article-objet` quand le numéro est déjà pris. Il est
 * gravé dans chaque permalien : une fois écrit, **il ne change jamais** — modifier l'objet
 * d'une entrée incrémente `revision`, cela ne recalcule pas son adresse.
 */
async function deriverSlug(
  code: string,
  article: string,
  objetFr: string,
): Promise<{ ok: true; slug: string } | { ok: false; motif: 'slugImpossible' | 'slugExiste' }> {
  const base = `${PREFIXE_CODE[code] ?? 'x'}-${slugifierArticle(article)}`
  const candidats = [base, `${base}-${suffixeObjet(objetFr)}`].filter(
    (s) => SLUG_VALIDE.test(s) && s.length <= 100,
  )
  // Un article dont il ne reste rien après slugification (« ### ») ne donne aucune adresse :
  // ce n'est pas un doublon, et le dire autrement enverrait l'éditeur chercher une collision
  // qui n'existe pas.
  if (candidats.length === 0) return { ok: false, motif: 'slugImpossible' }
  for (const candidat of candidats) {
    const pris = await prisma.delaiEntry.findUnique({ where: { slug: candidat }, select: { id: true } })
    if (!pris) return { ok: true, slug: candidat }
  }
  return { ok: false, motif: 'slugExiste' }
}

/** La copie GELÉE : l'entrée entière, telle qu'elle est au moment où on l'écrit. */
function payloadGele(colonnes: Record<string, unknown>, slug: string, revision: number): string {
  return JSON.stringify({ ...colonnes, slug, statut: 'visible', revision })
}

// ---------------------------------------------------------------------------
// § 7.1 — AJOUTER
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const admin = await requireCapabilityApi('corpus.manage')
  if (!admin) return apiError('forbidden', 403)
  const parsed = champsEntree.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError('invalidFields', 400)

  // Les validations du § 7.1, dans la MÊME fonction que celle qu'appelle l'aperçu de l'écran :
  // l'écran et la route rendent le même verdict, ou l'un des deux ment.
  const verdict = validerEntree(parsed.data)
  if (verdict.anomalies.length > 0) return refusValidation(verdict.anomalies)

  try {
    const colonnes = versColonnes(parsed.data)
    const derive = await deriverSlug(colonnes.code, colonnes.article, colonnes.objetFr)
    if (!derive.ok) return apiError(derive.motif, derive.motif === 'slugExiste' ? 409 : 400)
    const slug = derive.slug

    // UNE SEULE TRANSACTION : une entrée sans sa copie gelée serait une entrée dont le premier
    // permalien ne pourrait jamais être rejoué.
    const ligne = await prisma.$transaction(async (tx) => {
      const creee = await tx.delaiEntry.create({
        data: { ...colonnes, slug, statut: 'visible', revision: 1 },
      })
      await tx.delaiEntryRevision.create({
        data: {
          entryId: creee.id,
          revision: 1,
          payloadJson: payloadGele(colonnes, slug, 1),
          actorId: admin.id,
        },
      })
      return creee
    })

    await audit({
      action: 'DELAI_ENTRY_CREATED',
      actorId: admin.id,
      targetType: 'DELAI',
      targetId: ligne.id,
      meta: { slug, code: colonnes.code, article: colonnes.article, revision: 1 },
    })
    return NextResponse.json({ ok: true, id: ligne.id, slug, avertissements: verdict.avertissements })
  } catch (e) {
    if (estSchemaAbsent(e)) return apiError('delaisSchemaAbsent', 503)
    throw e
  }
}

// ---------------------------------------------------------------------------
// § 7.1 (modifier) et § 7.2 (masquer / réafficher)
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  const admin = await requireCapabilityApi('corpus.manage')
  if (!admin) return apiError('forbidden', 403)
  const parsed = corpsPatch.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError('invalidFields', 400)
  const corps = parsed.data

  try {
    const existante = await prisma.delaiEntry.findUnique({ where: { id: corps.id } })
    if (!existante) return apiError('notFound', 404)

    if (corps.op === 'modifier') {
      const verdict = validerEntree(corps.champs)
      if (verdict.anomalies.length > 0) return refusValidation(verdict.anomalies)
      // Une entrée supprimée ne se modifie pas : elle a quitté le répertoire. La rétablir est
      // une décision à part (« Réafficher »), et elle se journalise comme telle.
      if (existante.statut === 'supprime') return apiError('entreeSupprimee', 409)

      const colonnes = versColonnes(corps.champs)
      const revision = existante.revision + 1
      await prisma.$transaction(async (tx) => {
        await tx.delaiEntry.update({ where: { id: corps.id }, data: { ...colonnes, revision } })
        await tx.delaiEntryRevision.create({
          data: {
            entryId: corps.id,
            revision,
            // Le slug ne bouge PAS : il est gravé dans les permaliens déjà émis.
            payloadJson: payloadGele(colonnes, existante.slug, revision),
            actorId: admin.id,
          },
        })
      })
      await audit({
        action: 'DELAI_ENTRY_UPDATED',
        actorId: admin.id,
        targetType: 'DELAI',
        targetId: corps.id,
        meta: { slug: existante.slug, de: existante.revision, vers: revision },
      })
      return NextResponse.json({ ok: true, revision, avertissements: verdict.avertissements })
    }

    /**
     * ⚠️ **`supprime` n'est pas un `masque` plus discret.** Les deux verbes réversibles —
     * masquer et réafficher — ne s'appliquent qu'à une entrée qui n'a PAS été supprimée :
     *
     *  - `masquer` sur une entrée supprimée la REQUALIFIERAIT en simple masquage, effaçant du
     *    statut la décision du master admin ;
     *  - `reafficher` sur une entrée supprimée la remettrait au menu public, ce qui défait une
     *    suppression sans en payer la garde.
     *
     * `modifier` le refuse déjà (plus bas). On aligne les trois, et on renvoie sur le verbe
     * qui existe pour cela.
     */
    if (
      existante.statut === 'supprime' &&
      (corps.op === 'masquer' || corps.op === 'reafficher')
    ) {
      return apiError('entreeSupprimee', 409)
    }

    if (corps.op === 'restaurer-suppression') {
      // ⚠️ Garde PLUS ÉTROITE que celle du PATCH : master admin seul, comme la suppression
      // qu'elle défait (§ 7). `requireCapabilityApi` a déjà laissé passer l'éditeur ; c'est
      // ici, et seulement ici, que le rôle est réexaminé.
      const master = await requireAdminApi()
      if (!master) return apiError('forbidden', 403)
      if (existante.statut !== 'supprime') return apiError('entreeNonSupprimee', 409)
      const fautif = validerMotif(corps.motif)
      if (fautif) return refusValidation([fautif])
      // La même confirmation typée que la suppression : on recopie le numéro d'article. Une
      // case à cocher se coche sans lire.
      if (!confirmationTypeeValide(existante.article, corps.confirmation)) {
        return apiError('confirmationInvalide', 400)
      }
      // `revision` n'est PAS touchée : la règle n'a pas changé, c'est sa présence au menu qui
      // change. Un permalien antérieur reste reproductible à l'identique.
      await prisma.delaiEntry.update({
        where: { id: corps.id },
        data: { statut: 'visible', masqueMotif: corps.motif, masqueAt: null },
      })
      await audit({
        action: 'DELAI_ENTRY_UNDELETED',
        actorId: master.id,
        targetType: 'DELAI',
        targetId: corps.id,
        meta: {
          slug: existante.slug,
          article: existante.article,
          motif: corps.motif,
          motifSuppression: existante.masqueMotif,
          revision: existante.revision,
        },
      })
      return NextResponse.json({ ok: true })
    }

    if (corps.op === 'masquer') {
      const fautif = validerMotif(corps.motif)
      if (fautif) return refusValidation([fautif])
      // ⚠️ **`revision` n'est PAS incrémentée.** Masquer n'est pas une modification de fond :
      // la règle n'a pas changé, seule sa présence au menu a changé. Un permalien antérieur
      // doit rester reproductible à l'identique (§ 7.2).
      await prisma.delaiEntry.update({
        where: { id: corps.id },
        data: { statut: 'masque', masqueMotif: corps.motif, masqueAt: new Date() },
      })
      await audit({
        action: 'DELAI_ENTRY_HIDDEN',
        actorId: admin.id,
        targetType: 'DELAI',
        targetId: corps.id,
        meta: { slug: existante.slug, motif: corps.motif, revision: existante.revision },
      })
      return NextResponse.json({ ok: true })
    }

    // op === 'reafficher' — le pendant exact de « masquer », et de lui SEUL : une entrée
    // supprimée a été écartée plus haut (elle se rétablit par `restaurer-suppression`). Le
    // motif d'origine reste dans l'historique (il est au journal d'audit du masquage ; on le
    // reporte ici pour qu'une seule ligne de journal suffise à lire l'aller-retour).
    await prisma.delaiEntry.update({
      where: { id: corps.id },
      data: { statut: 'visible', masqueAt: null },
    })
    await audit({
      action: 'DELAI_ENTRY_RESTORED',
      actorId: admin.id,
      targetType: 'DELAI',
      targetId: corps.id,
      meta: {
        slug: existante.slug,
        statutPrecedent: existante.statut,
        motifPrecedent: existante.masqueMotif,
      },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (estSchemaAbsent(e)) return apiError('delaisSchemaAbsent', 503)
    throw e
  }
}

// ---------------------------------------------------------------------------
// § 7.3 — SUPPRIMER. Master Admin seul, confirmation typée, jamais physique.
// ---------------------------------------------------------------------------

/**
 * § 6.3 — LA DÉSIGNATION D'UNE ENTRÉE, telle qu'un fondement la cite : « C. pr. civ.,
 * art. 354 », « C. trav., art. 164 ». C'est cette chaîne-là, et jamais le slug, qui figure
 * dans la prose juridique des autres lignes.
 *
 * Le champ `article` porte déjà parfois son préfixe (« Art. 164 », « Arts. 30–34 ») : on le
 * retire pour ne garder que le NUMÉRO, puis on recompose. Voir `numeroArticle`.
 */
function motifRenvoi(code: string, article: string): string {
  const abrege = ABREGE_CODE[code as CodeDelai] ?? code
  return `${abrege}, art. ${numeroArticle(article)}`
}

/**
 * `art. 354` ne doit pas s'apparier à `art. 3540` ni à `art. 354-1`. Prisma n'a pas de
 * `regex` portable sur tous les connecteurs : on ratisse LARGE en base (`contains`, qui est
 * indexable et borné) puis on tranche EN MÉMOIRE sur une frontière de mot. Le filtre large
 * peut ramener des faux positifs ; le filtre fin, lui, ne rend que de vrais renvois.
 */
function citeVraiment(champ: string | null | undefined, motif: string): boolean {
  const texte = champ ?? ''
  let i = texte.indexOf(motif)
  while (i !== -1) {
    // Ce qui suit immédiatement la référence : un chiffre ou un tiret la prolongerait en un
    // AUTRE article (« 3540 », « 354-1 »), et ce n'est alors pas un renvoi vers celle-ci.
    const suivant = texte.charAt(i + motif.length)
    if (!/[0-9\-–—]/.test(suivant)) return true
    i = texte.indexOf(motif, i + 1)
  }
  return false
}

/**
 * « Supprimer exige que rien n'y renvoie, ou refuse. » Le schéma n'autorise aujourd'hui que
 * deux façons de désigner une entrée depuis une autre ligne : la citer dans un fondement (ou
 * dans la question de suite) d'une AUTRE entrée, et la citer dans la `source` d'une ligne du
 * calendrier. On les compte toutes les deux. Ses PROPRES révisions ne comptent pas : elles ne
 * renvoient pas à l'entrée, elles SONT l'entrée, gelée — et c'est justement ce qui doit
 * survivre à la suppression.
 *
 * ⚠️ **On cherche la DÉSIGNATION, jamais le slug.** La version d'origine cherchait
 * `contains: slug` dans quatre champs de prose juridique : les 393 slugs de la graine n'y
 * apparaissent pas une seule fois, et le 409 ne pouvait donc jamais se déclencher. Ces champs
 * citent des articles (« C. pr. civ., art. 987 — « tous les délais… » »), pas des adresses.
 */
async function renvoisVers(id: string, code: string, article: string): Promise<string[]> {
  const motif = motifRenvoi(code, article)
  const [entrees, feries] = await Promise.all([
    prisma.delaiEntry.findMany({
      where: {
        id: { not: id },
        statut: { not: 'supprime' },
        OR: [
          { regimeFondement: { contains: motif } },
          { prorogationFondement: { contains: motif } },
          { dureeFondementFr: { contains: motif } },
          { supplementJson: { contains: motif } },
        ],
      },
      select: {
        slug: true,
        regimeFondement: true,
        prorogationFondement: true,
        dureeFondementFr: true,
        supplementJson: true,
      },
      take: 50,
    }),
    prisma.delaiFerie.findMany({
      where: { source: { contains: motif } },
      select: { cle: true, versionCalendrier: true, source: true },
      take: 50,
    }),
  ])
  return [
    ...entrees
      .filter((e) =>
        [e.regimeFondement, e.prorogationFondement, e.dureeFondementFr, e.supplementJson].some(
          (champ) => citeVraiment(champ, motif),
        ),
      )
      .map((e) => `répertoire : ${e.slug} (« ${motif} »)`),
    ...feries
      .filter((f) => citeVraiment(f.source, motif))
      .map((f) => `calendrier v${f.versionCalendrier} : ${f.cle} (« ${motif} »)`),
  ]
}

export async function DELETE(req: NextRequest) {
  // ⚠️ Garde PLUS ÉTROITE que celle des autres verbes : master admin seul (§ 7).
  const admin = await requireAdminApi()
  if (!admin) return apiError('forbidden', 403)
  const parsed = corpsDelete.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError('invalidFields', 400)
  const { id, motif, confirmation } = parsed.data

  const fautif = validerMotif(motif)
  if (fautif) return refusValidation([fautif])

  try {
    const existante = await prisma.delaiEntry.findUnique({ where: { id } })
    if (!existante) return apiError('notFound', 404)
    if (!confirmationTypeeValide(existante.article, confirmation)) {
      return apiError('confirmationInvalide', 400)
    }

    const renvois = await renvoisVers(id, existante.code, existante.article)
    if (renvois.length > 0) {
      return NextResponse.json({ ok: false, error: 'renvoisExistants', renvois }, { status: 409 })
    }

    // **JAMAIS `prisma.delaiEntry.delete()`.** La ligne reste en base, ses copies gelées
    // aussi : un calcul déjà rendu reste lisible et reproductible (§ 7.3).
    await prisma.delaiEntry.update({
      where: { id },
      data: { statut: 'supprime', masqueMotif: motif, masqueAt: new Date() },
    })
    await audit({
      action: 'DELAI_ENTRY_DELETED',
      actorId: admin.id,
      targetType: 'DELAI',
      targetId: id,
      meta: { slug: existante.slug, article: existante.article, motif, revision: existante.revision },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (estSchemaAbsent(e)) return apiError('delaisSchemaAbsent', 503)
    throw e
  }
}
