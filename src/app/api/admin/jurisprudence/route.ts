import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { audit } from '@/lib/auth/audit'
import { reindexDocument } from '@/lib/search/reindex'
import { paragraphesDuDocx } from '@/lib/jurisprudence/docx'
import { analyserRecueil } from '@/lib/jurisprudence/parse'
import { analyserTextesIntegraux } from '@/lib/jurisprudence/full-text'
import { SOLUTIONS, TRAITEMENTS, PORTEES } from '@/lib/jurisprudence/constants'
import { compositionSommaire } from '@/lib/jurisprudence/corps'

export const runtime = 'nodejs'

/**
 * Décisions judiciaires — saisie manuelle et versement de recueils (§3 et §4 du prompt).
 *
 * DEUX VERBES, DEUX RÔLES :
 *   PUT  analyse un .docx et REND ce qu'il a compris — n'écrit RIEN. C'est ce qui alimente
 *        l'écran de contrôle : sur un corpus juridique, un import muet est indéfendable.
 *   POST enregistre les décisions telles que l'opérateur les a validées ou corrigées.
 *
 * ⚠️ MASTER_ADMIN **et** EDITEUR. La rédaction doit pouvoir verser un recueil sans passer
 * par un développeur — c'est l'objet même de la demande.
 */
function autorise(role: string | undefined) {
  return role === 'MASTER_ADMIN' || role === 'EDITEUR'
}

const decisionSchema = z.object({
  id: z.string().optional(), // présent = mise à jour
  numero: z.string().trim().min(1).max(20),
  intitule: z.string().trim().min(1).max(500),
  juridiction: z.string().trim().max(200).nullable().optional(),
  chambre: z.string().trim().max(120).nullable().optional(),
  dateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  decisionAttaquee: z.string().trim().max(2000).nullable().optional(),
  dispositif: z.string().trim().max(2000).nullable().optional(),
  solution: z.enum(SOLUTIONS).nullable().optional(),
  resume: z.string().trim().max(20000).nullable().optional(),
  domaines: z.string().trim().max(2000).nullable().optional(),
  traitement: z.enum(TRAITEMENTS).nullable().optional(),
  traitementNote: z.string().trim().max(1000).nullable().optional(),
  portee: z.enum(PORTEES).nullable().optional(),
  porteeNote: z.string().trim().max(1000).nullable().optional(),
  noteRedaction: z.string().trim().max(20000).nullable().optional(),
  /** Texte intégral de la décision — 400 000 caractères couvrent le plus long des arrêts. */
  texteIntegral: z.string().trim().max(400000).nullable().optional(),
})

const postSchema = z.object({
  recueilRef: z.string().trim().max(200).nullable().optional(),
  exerciceDebut: z.number().int().min(1800).max(2200).nullable().optional(),
  exerciceFin: z.number().int().min(1800).max(2200).nullable().optional(),
  source: z.string().trim().min(1).max(80),
  sourceFileUrl: z.string().trim().max(500).nullable().optional(),
  decisions: z.array(decisionSchema).min(1).max(500),
})

/** Référence stable d'une décision : c'est elle qui fait la clé de dédoublonnage. */
function referenceDecision(juridiction: string | null, chambre: string | null, numero: string, annee: number): string {
  const j = (juridiction ?? 'JUR').replace(/\s+/g, ' ').trim()
  return [j, chambre?.trim(), `n° ${numero}`, annee].filter(Boolean).join(' · ')
}

/**
 * GET — de quoi alimenter l'écran d'édition : sans paramètre, les recueils déjà versés ;
 * avec `?source=`, les décisions de ce recueil et l'état de leur appareil éditorial.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !autorise(user.role)) return apiError('unauthorized', 401)

  const source = req.nextUrl.searchParams.get('source')
  if (!source) {
    const groupes = await prisma.document.groupBy({
      by: ['source'],
      where: { type: 'JURISPRUDENCE' },
      _count: { _all: true },
    })
    return NextResponse.json({
      ok: true,
      sources: groupes
        .filter((g) => g.source)
        .map((g) => ({ source: g.source as string, total: g._count._all }))
        .sort((a, b) => a.source.localeCompare(b.source)),
    })
  }

  const decisions = await prisma.document.findMany({
    where: { type: 'JURISPRUDENCE', source },
    orderBy: [{ publicationDate: 'asc' }, { number: 'asc' }],
    select: {
      id: true, number: true, titleFr: true, publicationDate: true,
      summaryFr: true, bodyOriginal: true, dispositif: true,
      traitement: true, traitementNote: true, portee: true, porteeNote: true,
      noteRedaction: true, noteRedactionBy: true, recueilRef: true,
    },
  })
  return NextResponse.json({
    ok: true,
    decisions: decisions.map((d) => ({
      ...d,
      publicationDate: d.publicationDate ? d.publicationDate.toISOString().slice(0, 10) : null,
      // Le corps composé au versement du sommaire (résumé + dispositif) n'est PAS un texte
      // intégral : on le signale pour que l'éditeur sache ce qu'il remplace.
      texteIntegralPresent: !!d.bodyOriginal && d.bodyOriginal !== compositionSommaire(d.summaryFr, d.dispositif),
    })),
  })
}

/** PUT — analyse un .docx et rend le résultat. AUCUNE écriture. */
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !autorise(user.role)) return apiError('unauthorized', 401)

  const form = await req.formData().catch(() => null)
  const fichier = form?.get('file')
  const mode = String(form?.get('mode') ?? 'sommaire')
  if (!(fichier instanceof File)) return apiError('invalidFields', 400)
  // 20 Mo : un recueil de plusieurs centaines d'arrêts reste très en deçà.
  if (fichier.size > 20 * 1024 * 1024) return apiError('tooLarge', 413)

  try {
    const paras = await paragraphesDuDocx(Buffer.from(await fichier.arrayBuffer()))

    // Un seul champ (résumé éditorial OU texte intégral d'une décision) : le fichier vaut
    // pour son texte, sans découpage. C'est l'équivalent téléversé du copier-coller.
    if (mode === 'texte') {
      return NextResponse.json({ ok: true, nomFichier: fichier.name, texte: paras.join('\n') })
    }

    // Recueil de TEXTES INTÉGRAUX : on découpe par arrêt et on recoupe avec la base.
    if (mode === 'integral') {
      const source = String(form?.get('source') ?? '').trim()
      const r = analyserTextesIntegraux(paras)
      const enBase = source
        ? await prisma.document.findMany({
            where: { type: 'JURISPRUDENCE', source },
            select: { id: true, number: true, publicationDate: true },
          })
        : []
      const parNumero = new Map(enBase.map((d) => [d.number ?? '', d]))
      const textes = r.textes.map((t) => {
        const d = parNumero.get(t.numero)
        const dateEnBase = d?.publicationDate ? d.publicationDate.toISOString().slice(0, 10) : null
        return {
          ...t,
          existeEnBase: !!d,
          dateEnBase,
          // ⚠️ Un écart de date se SIGNALE, il ne se corrige pas tout seul : c'est le
          // symptôme d'un rapprochement erroné entre deux arrêts.
          ecartDate: !!(t.dateISO && dateEnBase && t.dateISO !== dateEnBase),
        }
      })
      const orphelins = textes.filter((t) => !t.existeEnBase).map((t) => t.numero)
      const avertissements = [...r.avertissements]
      if (source && orphelins.length) {
        avertissements.push(`Sans correspondance dans « ${source} » : n° ${orphelins.join(', ')}.`)
      }
      const ecarts = textes.filter((t) => t.ecartDate).map((t) => `n° ${t.numero} (${t.dateISO} ≠ ${t.dateEnBase})`)
      if (ecarts.length) avertissements.push(`Date différente de la base : ${ecarts.join(', ')}.`)
      return NextResponse.json({
        ok: true, nomFichier: fichier.name, textes,
        notesParArret: r.notesParArret, notesGenerales: r.notesGenerales, avertissements,
      })
    }

    const analyse = analyserRecueil(paras)

    // Doublons : on interroge la base AVANT l'écran de contrôle, pour que l'opérateur
    // sache ce qu'il écrasera. Les signaler après coup serait les signaler trop tard.
    const numeros = analyse.decisions.map((d) => d.numero).filter(Boolean) as string[]
    const existants = numeros.length
      ? await prisma.document.findMany({
          where: { type: 'JURISPRUDENCE', number: { in: numeros } },
          select: { id: true, number: true, titleFr: true, publicationDate: true },
        })
      : []

    return NextResponse.json({
      ok: true,
      nomFichier: fichier.name,
      decisions: analyse.decisions,
      synthese: analyse.synthese,
      avertissements: analyse.avertissements,
      existants,
    })
  } catch (e) {
    if ((e as Error).message === 'notDocx') return apiError('notDocx', 400)
    console.error('PUT /api/admin/jurisprudence :', e)
    return apiError('parse', 422)
  }
}

/** POST — enregistre les décisions validées à l'écran de contrôle. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !autorise(user.role)) return apiError('unauthorized', 401)

  const parsed = postSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError('invalidFields', 400)
  const { recueilRef, exerciceDebut, exerciceFin, source, sourceFileUrl, decisions } = parsed.data

  if (exerciceDebut && exerciceFin && exerciceFin < exerciceDebut) return apiError('invalidFields', 400)

  let crees = 0
  let modifies = 0
  const signataire = user.name ?? user.email

  for (const d of decisions) {
    const date = new Date(`${d.dateISO}T00:00:00Z`)
    const reference = referenceDecision(d.juridiction ?? null, d.chambre ?? null, d.numero, date.getUTCFullYear())

    const corps = d.texteIntegral?.trim() || compositionSommaire(d.resume ?? null, d.dispositif ?? null)
    if (!corps.trim()) return apiError('emptyBody', 400)

    const donnees = {
      type: 'JURISPRUDENCE',
      status: 'PUBLIE',
      originalLang: 'fr',
      source,
      titleFr: d.intitule,
      bodyOriginal: corps,
      summaryFr: d.resume ?? null,
      number: d.numero,
      juridiction: d.juridiction ?? null,
      chambre: d.chambre ?? null,
      matiere: d.domaines ?? null,
      publicationDate: date,
      decisionAttaquee: d.decisionAttaquee ?? null,
      dispositif: d.dispositif ?? null,
      solution: d.solution ?? null,
      moniteurRef: reference,
      recueilRef: recueilRef ?? null,
      exerciceDebut: exerciceDebut ?? null,
      exerciceFin: exerciceFin ?? null,
      traitement: d.traitement ?? null,
      traitementNote: d.traitementNote ?? null,
      portee: d.portee ?? null,
      porteeNote: d.porteeNote ?? null,
      sourceFileUrl: sourceFileUrl ?? null,
      ...(d.noteRedaction
        ? { noteRedaction: d.noteRedaction, noteRedactionBy: signataire, noteRedactionAt: new Date() }
        : {}),
    }

    // Dédoublonnage par (type, source, numéro) : rejouer le MÊME recueil met à jour au
    // lieu de créer une seconde série — l'idempotence est un contrôle du prompt.
    const champs = { id: true, type: true, bodyOriginal: true, summaryFr: true, dispositif: true } as const
    const existant = d.id
      ? await prisma.document.findUnique({ where: { id: d.id }, select: champs })
      : await prisma.document.findFirst({
          where: { type: 'JURISPRUDENCE', source, number: d.numero },
          select: champs,
        })

    // GARDE-FOU d'intégrité : ne JAMAIS écrire, via cette route, sur autre chose qu'une
    // décision. Un identifiant erroné écraserait sinon le texte d'une loi.
    if (existant && existant.type !== 'JURISPRUDENCE') return apiError('wrongType', 409)

    if (existant) {
      // ⚠️ REVERSER LE SOMMAIRE NE DOIT PAS EFFACER LE TEXTE INTÉGRAL. Sans cette garde,
      // rejouer le recueil analytique — geste anodin, et idempotent par ailleurs —
      // remplacerait le texte des arrêts par la composition résumé + dispositif.
      const dejaIntegral =
        !!existant.bodyOriginal &&
        existant.bodyOriginal !== compositionSommaire(existant.summaryFr, existant.dispositif)
      if (dejaIntegral && !d.texteIntegral?.trim()) donnees.bodyOriginal = existant.bodyOriginal
      await prisma.document.update({ where: { id: existant.id }, data: donnees })
      await reindexDocument(existant.id)
      modifies++
    } else {
      const doc = await prisma.document.create({ data: donnees })
      // ⚠️ SANS CET APPEL, la décision existe en base mais reste INTROUVABLE à la
      // recherche — défaut invisible à la relecture d'une fiche.
      await reindexDocument(doc.id)
      crees++
    }
  }

  await audit({
    action: 'DOC_PUBLISHED',
    actorId: user.id,
    targetType: 'Document',
    targetId: source,
    meta: { via: 'jurisprudence-admin', source, recueilRef, crees, modifies, total: decisions.length },
  })
  return NextResponse.json({ ok: true, crees, modifies, total: decisions.length })
}

const patchSchema = z.object({
  majs: z
    .array(
      z.object({
        id: z.string().min(1),
        /** Résumé ÉDITORIAL — écrit par la rédaction, distinct du texte de la décision. */
        resumeEditorial: z.string().trim().max(50000).nullable().optional(),
        /** Texte INTÉGRAL de la décision — la parole du juge, jamais réécrite. */
        texteIntegral: z.string().trim().max(400000).nullable().optional(),
        noteRedaction: z.string().trim().max(20000).nullable().optional(),
        traitement: z.enum(TRAITEMENTS).nullable().optional(),
        traitementNote: z.string().trim().max(1000).nullable().optional(),
        portee: z.enum(PORTEES).nullable().optional(),
        porteeNote: z.string().trim().max(1000).nullable().optional(),
      }),
    )
    .min(1)
    .max(500),
})

/**
 * PATCH — appareil éditorial d'une ou plusieurs décisions déjà en base : résumé éditorial,
 * texte intégral, note d'édition, qualifications.
 *
 * ⚠️ ÉCRITURE PARTIELLE ASSUMÉE : un champ ABSENT du corps n'est pas touché ; un champ à
 * `null` est effacé. Confondre les deux ferait qu'enregistrer un résumé viderait la note
 * d'édition de la même décision.
 */
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !autorise(user.role)) return apiError('unauthorized', 401)

  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError('invalidFields', 400)

  const signataire = user.name ?? user.email
  let modifies = 0

  for (const m of parsed.data.majs) {
    const doc = await prisma.document.findUnique({
      where: { id: m.id },
      select: { id: true, type: true, summaryFr: true, dispositif: true },
    })
    if (!doc) return apiError('notFound', 404)
    // GARDE-FOU : cette route n'écrit que sur des décisions.
    if (doc.type !== 'JURISPRUDENCE') return apiError('wrongType', 409)

    const data: Record<string, unknown> = {}
    if (m.resumeEditorial !== undefined) data.summaryFr = m.resumeEditorial || null
    if (m.texteIntegral !== undefined) {
      // Un texte intégral vidé ne laisse pas un corps vide : on retombe sur la composition
      // du sommaire, faute de quoi la fiche afficherait une décision sans contenu.
      const resume = m.resumeEditorial !== undefined ? m.resumeEditorial : doc.summaryFr
      const corps = m.texteIntegral?.trim() || compositionSommaire(resume ?? null, doc.dispositif)
      if (!corps.trim()) return apiError('emptyBody', 400)
      data.bodyOriginal = corps
    }
    if (m.traitement !== undefined) data.traitement = m.traitement
    if (m.traitementNote !== undefined) data.traitementNote = m.traitementNote || null
    if (m.portee !== undefined) data.portee = m.portee
    if (m.porteeNote !== undefined) data.porteeNote = m.porteeNote || null
    if (m.noteRedaction !== undefined) {
      data.noteRedaction = m.noteRedaction || null
      // ⚠️ L'ÉDITEUR N'EST JAMAIS ANONYME : la note porte toujours sa signature et sa date.
      data.noteRedactionBy = m.noteRedaction ? signataire : null
      data.noteRedactionAt = m.noteRedaction ? new Date() : null
    }
    if (!Object.keys(data).length) continue

    await prisma.document.update({ where: { id: doc.id }, data })
    // Sans réindexation, le texte intégral versé resterait introuvable à la recherche.
    await reindexDocument(doc.id)
    modifies++
  }

  await audit({
    action: 'DOC_PUBLISHED',
    actorId: user.id,
    targetType: 'Document',
    targetId: parsed.data.majs.map((m) => m.id).join(','),
    meta: { via: 'jurisprudence-editorial', modifies, total: parsed.data.majs.length },
  })
  return NextResponse.json({ ok: true, modifies })
}
