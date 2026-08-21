import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api'
import { prisma } from '@/lib/db'
import { requireAdminApi, requireCapabilityApi } from '@/lib/auth/guard'
import { audit } from '@/lib/auth/audit'
import { AUTORITES, CATEGORIES, JOURNEES, TYPES_ENTREE } from '@/lib/delais/depuis-base'
import type { LigneDelaiFerie } from '@/lib/delais/depuis-base'
import { confirmationTypeeValide, validerFerie, validerMotif } from '@/lib/delais/validation-admin'
import type { Anomalie } from '@/lib/delais/validation-admin'
import { estSchemaAbsent, estVersionConcurrente } from '@/lib/delais/service-base'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * § 7.4 — LE CALENDRIER DES FÊTES. **Toute modification crée une NOUVELLE
 * `versionCalendrier`** : copie complète du jeu, plus la différence. Rien n'est modifié sur
 * place, rien n'est supprimé d'une version antérieure.
 *
 * Pourquoi ce coût plutôt qu'un `update` : un permalien pointe **une version**, jamais « le
 * calendrier courant ». Éditer une ligne en place changerait rétroactivement une date déjà
 * rendue, déjà imprimée, déjà citée. La version est ce qui rend le calcul reproductible.
 *
 * **Les trois verbes s'appliquent AUX DEUX TABLEAUX à l'identique** — permanents et jours à
 * surveiller (exigence de la cliente : la liste des jours à surveiller doit pouvoir grandir
 * sans toucher au code). Ce qui les sépare n'est pas le verbe, c'est `typeEntree` :
 * **PERMANENT proroge, A_SURVEILLER n'a AUCUN effet sur le calcul** et ne produit qu'un
 * avertissement (§ 4.13).
 *
 * Gardes : `corpus.manage` pour ajouter / modifier / masquer ; **master admin seul** pour
 * supprimer.
 */

const texteOpt = (max: number) => z.string().trim().max(max).nullish()

const ligneFerie = z.object({
  cle: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  typeEntree: z.enum(TYPES_ENTREE as unknown as [string, ...string[]]).default('PERMANENT'),
  libelleFr: z.string().trim().min(1).max(200),
  libelleEn: z.string().trim().max(200).default(''),
  libelleHt: z.string().trim().max(200).default(''),
  categorie: z.enum(CATEGORIES as unknown as [string, ...string[]]),
  autorite: z.enum(AUTORITES as unknown as [string, ...string[]]),
  journee: z.enum(JOURNEES as unknown as [string, ...string[]]).default('JOURNEE_ENTIERE'),
  noteJourneeFr: texteOpt(600),
  noteJourneeEn: texteOpt(600),
  noteJourneeHt: texteOpt(600),
  traductionRelue: z.boolean().default(false),
  mobile: z.boolean().default(false),
  offsetPaques: z.number().int().min(-60).max(90).nullish(),
  mois: z.number().int().min(1).max(12).nullish(),
  jour: z.number().int().min(1).max(31).nullish(),
  /** JAMAIS VIDE (§ 7.4). C'est la règle qui empêche que la liste redevienne une opinion. */
  source: z.string().trim().min(1).max(2000),
  sourceDocId: texteOpt(60),
  appliqueDepuis: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/),
  observationsN: z.number().int().min(0).max(100_000).nullish(),
  observationsTexteFr: texteOpt(2000),
  observationsTexteEn: texteOpt(2000),
  observationsTexteHt: texteOpt(2000),
  observationsBorneFr: texteOpt(2000),
  observationsBorneEn: texteOpt(2000),
  observationsBorneHt: texteOpt(2000),
  rechercheCorpusQ: texteOpt(120),
})
type LigneSaisie = z.infer<typeof ligneFerie>

const corpsPost = z.object({
  op: z.enum(['ajouter', 'modifier']),
  ligne: ligneFerie,
  motif: z.string().trim().max(600).optional(),
})

const corpsPatch = z.discriminatedUnion('op', [
  z.object({ op: z.literal('masquer'), cle: z.string().trim().min(1).max(60), motif: z.string().trim().max(600) }),
  z.object({ op: z.literal('reafficher'), cle: z.string().trim().min(1).max(60), motif: z.string().trim().max(600) }),
])

const corpsDelete = z.object({
  cle: z.string().trim().min(1).max(60),
  motif: z.string().trim().max(600),
  /** § 7.4 — confirmation typée sur la `cle`. */
  confirmation: z.string().trim().max(60),
})

/** Les colonnes recopiées d'une version à l'autre. `id`, `createdAt` et la version exclus. */
const COLONNES_REPORTEES = [
  'cle',
  'typeEntree',
  'libelleFr',
  'libelleEn',
  'libelleHt',
  'categorie',
  'autorite',
  'journee',
  'noteJourneeFr',
  'noteJourneeEn',
  'noteJourneeHt',
  'traductionRelue',
  'mobile',
  'offsetPaques',
  'mois',
  'jour',
  'source',
  'sourceDocId',
  'appliqueDepuis',
  'observationsN',
  'observationsTexteFr',
  'observationsTexteEn',
  'observationsTexteHt',
  'observationsBorneFr',
  'observationsBorneEn',
  'observationsBorneHt',
  'rechercheCorpusQ',
] as const

type LigneReportee = Record<(typeof COLONNES_REPORTEES)[number], unknown>

function reporter(l: Record<string, unknown>): LigneReportee {
  const out = {} as LigneReportee
  for (const c of COLONNES_REPORTEES) out[c] = l[c] ?? null
  return out
}

function refusValidation(anomalies: Anomalie[]) {
  return NextResponse.json({ ok: false, error: 'invalidFields', anomalies }, { status: 400 })
}

/** La saisie devient une ligne complète, prête à être reportée. */
function versLigne(l: LigneSaisie): LigneReportee {
  const n = (v: string | null | undefined) => (v && v.trim() !== '' ? v.trim() : null)
  return reporter({
    cle: l.cle,
    typeEntree: l.typeEntree,
    libelleFr: l.libelleFr,
    // Une traduction non fournie retombe sur le français à l'affichage (§ 5.1, `traductionRelue`).
    libelleEn: l.libelleEn || l.libelleFr,
    libelleHt: l.libelleHt || l.libelleFr,
    categorie: l.categorie,
    autorite: l.autorite,
    journee: l.journee,
    noteJourneeFr: n(l.noteJourneeFr),
    noteJourneeEn: n(l.noteJourneeEn),
    noteJourneeHt: n(l.noteJourneeHt),
    traductionRelue: l.traductionRelue,
    mobile: l.mobile,
    offsetPaques: l.offsetPaques ?? null,
    mois: l.mois ?? null,
    jour: l.jour ?? null,
    source: l.source,
    sourceDocId: n(l.sourceDocId),
    appliqueDepuis: l.appliqueDepuis,
    observationsN: l.observationsN ?? null,
    observationsTexteFr: n(l.observationsTexteFr),
    observationsTexteEn: n(l.observationsTexteEn),
    observationsTexteHt: n(l.observationsTexteHt),
    observationsBorneFr: n(l.observationsBorneFr),
    observationsBorneEn: n(l.observationsBorneEn),
    observationsBorneHt: n(l.observationsBorneHt),
    rechercheCorpusQ: n(l.rechercheCorpusQ),
  })
}

/** Ce que le journal doit porter : le diff, pas « quelque chose a changé » (§ 7.4). */
function diffCalendrier(avant: LigneReportee[], apres: LigneReportee[]) {
  const parCle = (xs: LigneReportee[]) => new Map(xs.map((x) => [String(x.cle), x]))
  const a = parCle(avant)
  const b = parCle(apres)
  const ajoutees = [...b.keys()].filter((k) => !a.has(k))
  const retirees = [...a.keys()].filter((k) => !b.has(k))
  const modifiees: { cle: string; champs: string[] }[] = []
  for (const [cle, apresLigne] of b) {
    const avantLigne = a.get(cle)
    if (!avantLigne) continue
    const champs = COLONNES_REPORTEES.filter((c) => avantLigne[c] !== apresLigne[c])
    if (champs.length > 0) modifiees.push({ cle, champs: [...champs] })
  }
  return { ajoutees, retirees, modifiees }
}

/** La version courante = la plus haute présente. Il n'y a pas de « version active » stockée. */
async function versionCourante(): Promise<number> {
  const derniere = await prisma.delaiFerie.findFirst({
    orderBy: { versionCalendrier: 'desc' },
    select: { versionCalendrier: true },
  })
  return derniere?.versionCalendrier ?? 0
}

/**
 * Écrit la version suivante — la copie complète, en une transaction. Une version à moitié
 * écrite serait un calendrier amputé, c'est-à-dire des dates plus précoces que le droit.
 */
async function publierVersion(
  lignes: LigneReportee[],
  base: number,
): Promise<number> {
  const version = base + 1
  await prisma.$transaction(
    lignes.map((l) =>
      prisma.delaiFerie.create({ data: { ...(l as object), versionCalendrier: version } as never }),
    ),
  )
  return version
}

/**
 * La ligne telle que la version la PLUS RÉCENTE qui la portait l'a écrite — masquée ou non.
 * C'est la seule lecture qui rende la bascule indétournable : une clé masquée puis réajoutée
 * garde son passé (§ 7.4).
 */
async function precedentDeLaCle(cle: string): Promise<LigneReportee | undefined> {
  const derniere = await prisma.delaiFerie.findFirst({
    where: { cle },
    orderBy: { versionCalendrier: 'desc' },
  })
  return derniere ? reporter(derniere as unknown as Record<string, unknown>) : undefined
}

async function lireVersion(version: number): Promise<LigneReportee[]> {
  const lignes = await prisma.delaiFerie.findMany({
    where: { versionCalendrier: version },
    orderBy: { cle: 'asc' },
  })
  return lignes.map((l) => reporter(l as unknown as Record<string, unknown>))
}

// ---------------------------------------------------------------------------
// Ajouter / modifier
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const admin = await requireCapabilityApi('corpus.manage')
  if (!admin) return apiError('forbidden', 403)
  const parsed = corpsPost.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError('invalidFields', 400)
  const { op, ligne } = parsed.data

  try {
    const base = await versionCourante()
    const avant = base === 0 ? [] : await lireVersion(base)
    const existante = avant.find((l) => l.cle === ligne.cle)

    if (op === 'ajouter' && existante) return apiError('cleExistante', 409)
    if (op === 'modifier' && !existante) return apiError('notFound', 404)

    /**
     * Le `precedent` sert à détecter LA BASCULE `A_SURVEILLER → PERMANENT` : le seul chemin
     * par lequel un jour à surveiller se met à proroger, et il exige un texte versé au corpus.
     *
     * ⚠️ Il se cherche sur **TOUTE L'HISTOIRE de la clé**, jamais sur la seule version
     * courante. `masquer` publie une version d'où la ligne est ABSENTE : au coup suivant,
     * `ajouter` avec la même clé ne trouvait plus de précédent, la bascule n'était plus
     * détectée, et la ligne repartait en PERMANENT sans texte. Deux appels `corpus.manage`
     * suffisaient à faire proroger un jour que rien ne proroge.
     */
    const precedent = await precedentDeLaCle(ligne.cle)
    const verdict = validerFerie(
      ligne as unknown as LigneDelaiFerie,
      precedent as unknown as LigneDelaiFerie | undefined,
    )
    if (verdict.anomalies.length > 0) return refusValidation(verdict.anomalies)

    const nouvelle = versLigne(ligne)
    const apres = existante
      ? avant.map((l) => (l.cle === ligne.cle ? nouvelle : l))
      : [...avant, nouvelle]
    const diff = diffCalendrier(avant, apres)
    const version = await publierVersion(apres, base)

    await audit({
      action: 'DELAI_CALENDAR_UPDATED',
      actorId: admin.id,
      targetType: 'DELAI',
      targetId: `calendrier-v${version}`,
      meta: { op, cle: ligne.cle, versionPrecedente: base, version, diff, motif: parsed.data.motif ?? null },
    })
    return NextResponse.json({ ok: true, version, diff, avertissements: verdict.avertissements })
  } catch (e) {
    if (estVersionConcurrente(e)) return apiError('versionConcurrente', 409)
    if (estSchemaAbsent(e)) return apiError('delaisSchemaAbsent', 503)
    throw e
  }
}

// ---------------------------------------------------------------------------
// Masquer / réafficher
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  const admin = await requireCapabilityApi('corpus.manage')
  if (!admin) return apiError('forbidden', 403)
  const parsed = corpsPatch.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError('invalidFields', 400)
  const corps = parsed.data

  const fautif = validerMotif(corps.motif)
  if (fautif) return refusValidation([fautif])

  try {
    const base = await versionCourante()
    if (base === 0) return apiError('calendrierVide', 404)
    const avant = await lireVersion(base)

    let apres: LigneReportee[]
    if (corps.op === 'masquer') {
      // « Masquer » au calendrier = **ne pas reporter la ligne** dans la nouvelle version.
      // Les permaliens qui pointent l'ancienne continuent de la rendre à l'identique.
      if (!avant.some((l) => l.cle === corps.cle)) return apiError('notFound', 404)
      apres = avant.filter((l) => l.cle !== corps.cle)
    } else {
      if (avant.some((l) => l.cle === corps.cle)) return apiError('dejaPresente', 409)
      // Réafficher : on reprend la ligne dans la version la PLUS RÉCENTE qui la portait —
      // jamais une ligne réinventée, dont la source ne serait plus celle qui l'avait fondée.
      const derniere = await prisma.delaiFerie.findFirst({
        where: { cle: corps.cle },
        orderBy: { versionCalendrier: 'desc' },
      })
      if (!derniere) return apiError('notFound', 404)
      apres = [...avant, reporter(derniere as unknown as Record<string, unknown>)]
    }

    const diff = diffCalendrier(avant, apres)
    const version = await publierVersion(apres, base)
    await audit({
      action: 'DELAI_CALENDAR_UPDATED',
      actorId: admin.id,
      targetType: 'DELAI',
      targetId: `calendrier-v${version}`,
      meta: { op: corps.op, cle: corps.cle, motif: corps.motif, versionPrecedente: base, version, diff },
    })
    return NextResponse.json({ ok: true, version, diff })
  } catch (e) {
    if (estVersionConcurrente(e)) return apiError('versionConcurrente', 409)
    if (estSchemaAbsent(e)) return apiError('delaisSchemaAbsent', 503)
    throw e
  }
}

// ---------------------------------------------------------------------------
// Supprimer — master admin seul, confirmation typée, jamais de suppression physique
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin) return apiError('forbidden', 403)
  const parsed = corpsDelete.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError('invalidFields', 400)
  const { cle, motif, confirmation } = parsed.data

  const fautif = validerMotif(motif)
  if (fautif) return refusValidation([fautif])
  if (!confirmationTypeeValide(cle, confirmation)) return apiError('confirmationInvalide', 400)

  try {
    const base = await versionCourante()
    if (base === 0) return apiError('calendrierVide', 404)
    const avant = await lireVersion(base)
    if (!avant.some((l) => l.cle === cle)) return apiError('notFound', 404)

    // **Aucun `delete()` rétroactif.** On crée une version SANS la ligne ; l'ancienne reste,
    // et les calculs rendus sous elle restent reproductibles (§ 7.4).
    const apres = avant.filter((l) => l.cle !== cle)
    const diff = diffCalendrier(avant, apres)
    const version = await publierVersion(apres, base)

    await audit({
      action: 'DELAI_CALENDAR_UPDATED',
      actorId: admin.id,
      targetType: 'DELAI',
      targetId: `calendrier-v${version}`,
      meta: { op: 'supprimer', cle, motif, versionPrecedente: base, version, diff },
    })
    return NextResponse.json({ ok: true, version, diff })
  } catch (e) {
    if (estVersionConcurrente(e)) return apiError('versionConcurrente', 409)
    if (estSchemaAbsent(e)) return apiError('delaisSchemaAbsent', 503)
    throw e
  }
}
