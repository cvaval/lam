/**
 * Téléversement des circulaires BRH n° 105-2 (15 sept. 2025) et n° 117-1 (20 nov. 2025)
 * en « Circulaires BRH », au format LECTEUR ANNOTÉ (Sommaire + Index + renvois cliquables) —
 * les deux premières de la section à en bénéficier.
 *
 * Porte AUSSI la chaîne d'abrogation, la circulaire postérieure étant nommée sur chaque
 * texte abrogé (le bandeau de la fiche résout la cible par NUMÉRO) :
 *     n° 105   → abrogée par n° 105-1  (défaut préexistant : la 105-1 l'abroge en son point 8)
 *     n° 105-1 → abrogée par n° 105-2  (point 12)
 *     n° 117   → abrogée par n° 117-1  (point 10 : « remplacent celles de la circulaire 117 »)
 *
 * Idempotent (upsert par `source`). Données : scripts/data/circ-brh-{105-2,117-1}/.
 *   npx tsx scripts/_import-circ-brh-105-2-117-1.ts
 */
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    }),
)
for (const k of ['BLOB_READ_WRITE_TOKEN', 'DATABASE_URL', 'DIRECT_URL']) if (env[k]) process.env[k] = env[k]

import { prisma } from '../src/lib/db'
import { uploadToBlob } from '../src/lib/storage/blob'
import { buildSearchText } from '../src/lib/search/normalize'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated, type Annotations, type TocEntry } from '../src/lib/legislation/annotated'
import { buildBodySegments, parseRichBlocks } from '../src/lib/doc/richblocks'
import { parseCirculaireRef } from '../src/lib/brh/gaps'

const HOME = process.env.HOME
const BANQUES_ID = 'cms18kwzl0002pt2kbk9kv39y' // Loi du 14 mai 2012 sur les banques
const IMF_ID = 'cms5d6tp200002695mv8c5bdb' // Décret du 5 juin 2020 sur les IMF
const C89_3 = 'cmqmixgub00012xbwz8v3nqr6' // Normes minimales de contrôle interne
const C105_1 = 'cmqbnm0dc000lsmfz6a4ehce5'
const C117 = 'cmqbnm0du0010smfzwe2im3jl'
const C129 = 'cmqbnm0ed001dsmfzjn2r5y8q'
const C129_1 = 'cmqbnm0ef001esmfzx82dettd'

interface Struct {
  points: string[]
  labels: Record<string, string>
  toc: TocEntry[]
  navToc: Annotations['navToc']
}
interface RawIndex {
  subject: string
  ctRefs: string[]
  secRefs?: { label: string; anchor: string }[]
}

const CIRCS = [
  {
    dir: 'scripts/data/circ-brh-105-2',
    source: 'CIRC_BRH_105_2',
    number: 'Circulaire n° 105-2',
    title:
      "Circulaire BRH n° 105-2 — Transmission au Bureau d'Information sur le Crédit (BIC) des informations sur les crédits octroyés",
    publication: '2025-09-15',
    effective: '2025-10-15',
    pdf: `${HOME}/Downloads/Circulaire-No-105-2-de-la-BRH-aux-institutions-financieres-15-septembre-2025_0001.pdf`,
    hasClean: true,
    hasRich: true,
    abrogates: 'Circulaire n° 105-1',
    connexe: {
      'art-1': [
        {
          label: 'Loi du 14 mai 2012 sur les banques et autres institutions financières — art. 87 et 179',
          text: "Fondement de la circulaire : pouvoir de la BRH d'exiger la communication d'informations et d'en sanctionner le défaut.",
          docId: BANQUES_ID,
          anchor: 'art-87',
        },
        {
          label: 'Décret du 5 juin 2020 sur les Institutions de Microfinance — art. 69',
          text: "Étend aux IMF l'obligation de transmission d'informations à la BRH.",
          docId: IMF_ID,
          anchor: 'art-69',
        },
        {
          label: 'Loi du 26 juin 2002 sur les coopératives d’épargne et de crédit — art. 12',
          text: "Troisième fondement visé par la circulaire. Ce texte n'est pas encore disponible sur la plateforme.",
        },
      ],
      'art-12': [
        {
          label: 'Circulaire BRH n° 105-1 du 3 avril 2017 — texte abrogé',
          text: 'Régime antérieur de transmission des informations de crédit au BIC, abrogé par le point 12 de la présente circulaire.',
          docId: C105_1,
        },
      ],
    },
    commentaires: {
      'sec-0|art-1': [
        'Circulaire signée à Port-au-Prince le 15 septembre 2025 par Ronald Gabriel, Gouverneur de la Banque de la République d’Haïti. Fac-similé du texte officiel joint (48 pages, annexes comprises).',
      ],
    },
  },
  {
    dir: 'scripts/data/circ-brh-117-1',
    source: 'CIRC_BRH_117_1',
    number: 'Circulaire n° 117-1',
    title: 'Circulaire BRH n° 117-1 — Pratiques de gouvernance',
    publication: '2025-11-20',
    effective: '2026-01-05',
    pdf: `${HOME}/Downloads/Circulaire-117-1.pdf`,
    hasClean: false,
    hasRich: false,
    abrogates: 'Circulaire n° 117',
    connexe: {
      'art-1': [
        {
          label: 'Loi du 14 mai 2012 sur les banques — art. 23, 27, 28, 33 à 41, 83 et 161',
          text: 'Fondement de la circulaire : administration, direction et contrôle des institutions financières.',
          docId: BANQUES_ID,
          anchor: 'art-23',
        },
        {
          label: 'Décret du 5 juin 2020 sur les Institutions de Microfinance — art. 20 à 31, 34 et 37',
          text: 'Organes de gouvernance et dirigeants des IMF.',
          docId: IMF_ID,
          anchor: 'art-20',
        },
        {
          label: 'Décret du 25 novembre 2020 sur les intermédiaires de change — art. 18 à 21 et 42',
          text: "Troisième fondement visé par la circulaire. Ce texte n'est pas encore disponible sur la plateforme.",
        },
      ],
      'art-3': [
        {
          label: 'Circulaire BRH n° 129-1 — Lutte contre le blanchiment de capitaux',
          text: "Mesures préventives dont les administrateurs et dirigeants doivent s'assurer de la mise en œuvre.",
          docId: C129_1,
        },
      ],
      'art-4-2-2': [
        {
          label: 'Circulaire BRH n° 89-3 — Normes minimales de contrôle interne',
          text: 'Règles de constitution et de fonctionnement des comités spécialisés auxquelles renvoie la présente section.',
          docId: C89_3,
        },
      ],
      'art-6-2': [
        {
          label: 'Circulaire BRH n° 129 — Mesures préventives LBC/FT',
          text: "Dispositif de lutte contre le blanchiment que le cadre organisationnel doit comporter.",
          docId: C129,
        },
      ],
      'art-10': [
        {
          label: 'Circulaire BRH n° 117 du 5 octobre 2020 — texte remplacé',
          text: 'Régime antérieur des pratiques de gouvernance, remplacé à compter du 5 janvier 2026.',
          docId: C117,
        },
      ],
    },
    commentaires: {
      'sec-0|art-10': [
        'Circulaire signée à Port-au-Prince le 20 novembre 2025 par Ronald Gabriel, Gouverneur de la Banque de la République d’Haïti.',
      ],
    },
  },
] as const

/** Abrogations à porter : texte abrogé → circulaire postérieure qui l'abroge. */
const ABROGATIONS: { number: string; by: string; why: string }[] = [
  { number: 'Circulaire n° 105', by: 'Circulaire n° 105-1', why: 'point 8 de la circulaire 105-1 (3 avril 2017)' },
  { number: 'Circulaire n° 105-1', by: 'Circulaire n° 105-2', why: 'point 12 de la circulaire 105-2 (15 septembre 2025)' },
  { number: 'Circulaire n° 117', by: 'Circulaire n° 117-1', why: 'point 10 de la circulaire 117-1 (20 novembre 2025)' },
]

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN manquant')

  for (const c of CIRCS) {
    const st: Struct = JSON.parse(readFileSync(`${c.dir}/_struct.json`, 'utf8'))
    const raw: RawIndex[] = JSON.parse(readFileSync(`${c.dir}/_index.json`, 'utf8'))
    const body = readFileSync(`${c.dir}/_body.txt`, 'utf8').trimEnd()
    const clean = c.hasClean ? readFileSync(`${c.dir}/_clean.txt`, 'utf8').trimEnd() : null
    const rich = c.hasRich ? parseRichBlocks(readFileSync(`${c.dir}/_rich.json`, 'utf8')) : []
    const shown = clean ?? body // texte réellement rendu (page.tsx : bodyClean ?? bodyOriginal)

    // ── Garde-fous bloquants ────────────────────────────────────────────────
    if (!parseCirculaireRef(c.number)) throw new Error(`numéro non canonique : ${c.number}`)
    const blocks = segmentAnnotated(shown, st.toc, st.points)
    const secs = blocks.filter((b) => b.kind === 'section').map((b) => b.anchor)
    const arts = blocks.filter((b) => b.kind === 'body' && b.anchor).map((b) => b.anchor as string)
    if (secs.length !== st.toc.length) throw new Error(`${c.number} : sommaire ${secs.length}/${st.toc.length} — annulé`)
    const wanted = st.points.map((p) => `art-${p.replace(/\./g, '-')}`)
    const missing = wanted.filter((a) => !arts.includes(a))
    if (missing.length) throw new Error(`${c.number} : divisions non ancrées ${missing.join(', ')} — annulé`)
    const ids = [...secs, ...arts]
    const dup = ids.filter((a, i) => ids.indexOf(a) !== i)
    if (dup.length) throw new Error(`${c.number} : ancres dupliquées ${[...new Set(dup)].join(', ')} — annulé`)
    if (blocks.map((b) => b.text).join('\n') !== shown) throw new Error(`${c.number} : texte perdu à la segmentation — annulé`)
    const labelMiss = Object.keys(st.labels).filter((a) => !arts.includes(a))
    if (labelMiss.length) throw new Error(`${c.number} : libellés sans ancre ${labelMiss.join(', ')} — annulé`)

    const anchorSet = new Set(ids)
    const deadIdx = raw.flatMap((e) => [...e.ctRefs.map((r) => `art-${r}`), ...(e.secRefs ?? []).map((s) => s.anchor)]).filter((a) => !anchorSet.has(a))
    if (deadIdx.length) throw new Error(`${c.number} : index — renvois morts ${[...new Set(deadIdx)].join(', ')} — annulé`)
    const covered = new Set(raw.flatMap((e) => [...e.ctRefs.map((r) => `art-${r}`), ...(e.secRefs ?? []).map((s) => s.anchor)]))
    const uncovered = ids.filter((a) => !covered.has(a))
    if (uncovered.length) throw new Error(`${c.number} : divisions hors index ${uncovered.join(', ')} — annulé`)
    const navDead = JSON.stringify(st.navToc).match(/"anchor":"([^"]+)"/g)?.map((m) => m.slice(10, -1)).filter((a) => !anchorSet.has(a)) ?? []
    if (navDead.length) throw new Error(`${c.number} : sommaire — ancres mortes ${[...new Set(navDead)].join(', ')} — annulé`)
    const annKeys = [...Object.keys(c.connexe ?? {})]
    const annDead = annKeys.filter((a) => !anchorSet.has(a))
    if (annDead.length) throw new Error(`${c.number} : annotations orphelines ${annDead.join(', ')} — annulé`)

    if (rich.length) {
      if (rich.length !== 20) throw new Error(`${c.number} : ${rich.length} tableaux au lieu de 20 — annulé`)
      // parseRichBlocks ÉCRÊTE les tableaux trop longs (MAX_ROWS). Comparer les rangées
      // avant/après : un plafond trop bas rendait 265 rangées du J.O. invisibles, sans
      // la moindre alerte — le compte de BLOCS, lui, restait juste.
      const rawRows = (JSON.parse(readFileSync(`${c.dir}/_rich.json`, 'utf8')) as { rows: unknown[] }[])
        .reduce((n, b) => n + b.rows.length, 0)
      const keptRows = rich.reduce((n, b) => n + ((b as { rows?: unknown[] }).rows?.length ?? 0), 0)
      if (keptRows !== rawRows) throw new Error(`${c.number} : ${rawRows - keptRows} rangées perdues à la sanitisation (${keptRows}/${rawRows}) — annulé`)
      const segs = buildBodySegments(shown, rich)
      const orphans = segs.filter((s) => s.kind === 'rich' && (s as any).orphan).length
      if (orphans) throw new Error(`${c.number} : ${orphans} tableaux orphelins — annulé`)
      const leftover = segs.filter((s) => s.kind === 'text').map((s: any) => s.text).join('\n').match(/^.+ \| .+$/gm)?.length ?? 0
      if (leftover) throw new Error(`${c.number} : ${leftover} rangées aplaties non remplacées (doublon) — annulé`)
    }

    // ── Liens sortants : aucun document cible ne doit manquer ────────────────
    const linked = [...new Set(Object.values(c.connexe ?? {}).flat().map((b: any) => b.docId).filter(Boolean))] as string[]
    const found = new Set((await prisma.document.findMany({ where: { id: { in: linked } }, select: { id: true } })).map((d) => d.id))
    const orphanLinks = linked.filter((id) => !found.has(id))
    if (orphanLinks.length) throw new Error(`${c.number} : liens morts ${orphanLinks.join(', ')} — annulé`)

    console.log(
      `✓ ${c.number} : sommaire ${secs.length} · divisions ${arts.length} · index ${raw.length} · ` +
        `tableaux ${rich.length} · ${linked.length} liens résolus`,
    )

    // ── Écriture ────────────────────────────────────────────────────────────
    const existing = await prisma.document.findFirst({ where: { source: c.source }, select: { id: true } })
    const id = existing?.id ?? undefined
    const indexEntries = raw.map((e) => ({
      subject: e.subject,
      ctRefs: e.ctRefs,
      ...(e.secRefs ? { docRefs: e.secRefs.map((s) => ({ label: s.label, id: '', anchor: s.anchor })) } : {}),
    }))
    const annotations: Annotations & Record<string, unknown> = {
      title: c.title,
      annotationAuthor: 'Lam Veritab',
      navToc: st.navToc,
      toc: st.toc,
      connexes: [],
      jurisprudence: {},
      indexEntries,
      labels: st.labels,
      pointAnchors: st.points,
      connexe: c.connexe as any,
      commentaires: c.commentaires as any,
    }

    const base = {
      type: 'CIRCULAIRE_BRH',
      status: 'EN_VIGUEUR',
      titleFr: c.title,
      bodyOriginal: body,
      bodyClean: clean,
      richBlocksJson: rich.length ? readFileSync(`${c.dir}/_rich.json`, 'utf8') : null,
      number: c.number,
      publicationDate: new Date(`${c.publication}T00:00:00Z`),
      effectiveDate: new Date(`${c.effective}T00:00:00Z`),
      matiere: 'Droit bancaire',
      source: c.source,
      sealed: true,
      abrogatedByNumber: null,
    }
    const doc = id
      ? await prisma.document.update({ where: { id }, data: base })
      : await prisma.document.create({ data: base })

    // L'id n'existe qu'après création : les renvois d'index vers les annexes le portent.
    for (const e of indexEntries) if ((e as any).docRefs) for (const d of (e as any).docRefs) d.id = doc.id
    annotations.indexEntries = indexEntries
    const annotationsJson = JSON.stringify(annotations)
    await prisma.document.update({
      where: { id: doc.id },
      data: {
        annotationsJson,
        searchText: buildSearchText({ titleFr: c.title, number: c.number, bodyOriginal: body, matiere: 'Droit bancaire', annotationsJson } as any),
      },
    })

    // ── Fac-similé sur le Blob privé ────────────────────────────────────────
    const buf = readFileSync(c.pdf)
    const url = await uploadToBlob(`source-pdf/brh/${c.number.replace(/^Circulaire n° /, '')}_Circulaire.pdf`, buf, 'application/pdf', { multipart: true })
    await prisma.document.update({ where: { id: doc.id }, data: { sourcePdfUrl: url } })
    await reindexDocument(doc.id)
    console.log(`   → ${doc.id} · fac-similé ${(buf.length / 1024 / 1024).toFixed(1)} Mo déposé`)
  }

  // ── Chaîne d'abrogation ───────────────────────────────────────────────────
  console.log('\nAbrogations :')
  for (const a of ABROGATIONS) {
    const by = await prisma.document.findFirst({ where: { type: 'CIRCULAIRE_BRH', number: a.by }, select: { id: true } })
    if (!by) throw new Error(`circulaire abrogeante introuvable : ${a.by} — annulé`)
    const targets = await prisma.document.findMany({
      where: { type: 'CIRCULAIRE_BRH', number: a.number },
      select: { id: true, titleFr: true, status: true },
    })
    if (!targets.length) throw new Error(`circulaire à abroger introuvable : ${a.number} — annulé`)
    for (const t of targets) {
      // Les « notes additionnelles » partagent le numéro de leur circulaire mère : elles
      // suivent le sort du texte principal, dont elles ne sont qu'un complément.
      await prisma.document.update({
        where: { id: t.id },
        data: { status: 'ABROGE', abrogatedByNumber: a.by },
      })
      await reindexDocument(t.id)
      console.log(`   ${a.number.padEnd(22)} → ABROGE par ${a.by}  (${a.why})`)
      if (targets.length > 1) console.log(`      · ${t.titleFr.slice(0, 74)}`)
    }
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
