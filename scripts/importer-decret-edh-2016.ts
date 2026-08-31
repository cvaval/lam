/**
 * ÉLECTRICITÉ D'HAÏTI — le QUATRIÈME décret du Moniteur n° 23 du 3 février 2016.
 *
 *     npx tsx scripts/importer-decret-edh-2016.ts            # simulation
 *     npx tsx scripts/importer-decret-edh-2016.ts --apply    # Me Vaval, elle seule
 *
 * ⚠️ CE VERSEMENT COMPLÈTE LE FASCICULE. Le 30 août, trois des quatre décrets du n° 23 ont été
 * versés ; celui-ci manquait, et je l'avais signalé comme la pièce à réclamer en priorité. La
 * réforme électrique du 6 janvier 2016 cesse d'être amputée de son opérateur : marché (décret
 * énergie), régulateur (ANARSE), opérateur historique (EDH).
 *
 * ⚠️ SON ARTICLE 39 N'EST PAS UNE CLAUSE-BALAI : il abroge QUATRE textes NOMMÉMENT.
 *   1) la Loi du 18 juin 1948 faisant de la production et de la vente de l'énergie électrique un
 *      monopole de l'État ;
 *   2) le Décret du 7 septembre 1950 modifiant ses articles 4, 5 et 7 ;
 *   3) l'Arrêté du 20 mai 1976 conférant à l'EDH le droit d'établir des servitudes d'utilité
 *      publique ;
 *   4) le Décret du 20 août 1989 aménageant la structure organisationnelle de l'EDH.
 * C'EST LA RÉPONSE À UNE QUESTION LAISSÉE OUVERTE. Le 30 août, la note d'audit du décret énergie
 * disait que « l'abrogation implicite du monopole de la Loi du 18 juin 1948 ne peut pas être
 * mesurée ». Elle n'a jamais été implicite : elle est EXPRESSE, dans le décret frère du même jour.
 * Le script porte la rectification sur la fiche du décret énergie, dans un canal VISIBLE.
 *
 * ⚠️ L'ARTICLE 40, lui, est la clause-balai : aucun renvoi n'en est tiré.
 *
 * ⚠️ LE SOMMAIRE PORTE LA SEGMENTATION. Sans lui, « Section 1re.- » à « Section 4.- » entrent en
 * collision avec les articles 1 à 4 — comme sur l'ANARSE. Corps et sommaire dans la MÊME
 * transaction.
 *
 * ⚠️ LES QUATRE TEXTES ABROGÉS SONT ABSENTS DU CORPUS. Les renvois se posent PAR DÉSIGNATION, et
 * ces quatre pièces sont désormais nommées avec précision — c'est ce qui les rend réclamables.
 */
import { prisma } from '../src/lib/db'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { audit } from '../src/lib/auth/audit'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated } from '../src/lib/legislation/annotated'
import { articleAnchorFromHeading } from '../src/lib/doc/anchors'

const APPLY = process.argv.includes('--apply')
const D = join(process.cwd(), 'scripts/data/edh-2016')
const lire = (f: string) => readFileSync(join(D, f), 'utf8').replace(/\n+$/, '')
const lireJson = <T>(f: string): T => JSON.parse(lire(f)) as T

const SOURCE = 'DECRET_EDH_2016'
const TITRE =
  'Décret du 6 janvier 2016 créant un organisme autonome à caractère industriel et commercial, ' +
  'jouissant de la personnalité juridique et de l’autonomie financière, dénommé « Électricité ' +
  'd’Haïti (EDH) »'
const MONITEUR = 'Le Moniteur · LM2016-23 · 171ᵉ année, n° 23 du mercredi 3 février 2016, pages 42 à 56'
const ARTICLES = 40
const DIVISIONS = 10

/** Les quatre textes que l'article 39 abroge NOMMÉMENT. Aucun n'est au corpus. */
const ABROGES = [
  'Loi du 18 juin 1948 faisant de la production et de la vente de l’énergie électrique un monopole de l’État',
  'Décret du 7 septembre 1950 modifiant les articles 4, 5 et 7 de la Loi du 18 juin 1948 faisant de la production et de la vente de l’énergie électrique un monopole d’État',
  'Arrêté du 20 mai 1976 conférant à l’Électricité d’Haïti le droit d’établir des servitudes d’utilité publique',
  'Décret du 20 août 1989 aménageant la structure organisationnelle de l’Électricité d’Haïti (EDH) dans le dessein de lui permettre de mieux remplir sa mission et d’améliorer la gestion de ses biens et de ses affaires',
]

type Toc = { level: number; label: string; anchor: string; kind: string }
type Idx = { subject: string; ctRefs: number[] }
type Rub = { tete: string; rubrique: string }
type Noeud = { label: string; anchor: string; children: Noeud[] }

function navDepuisToc(toc: Toc[]): Noeud[] {
  const r: Noeud[] = []
  const pile: { level: number; noeud: Noeud }[] = []
  for (const t of toc) {
    const n: Noeud = { label: t.label, anchor: t.anchor, children: [] }
    while (pile.length && pile[pile.length - 1].level >= t.level) pile.pop()
    if (pile.length) pile[pile.length - 1].noeud.children.push(n)
    else r.push(n)
    pile.push({ level: t.level, noeud: n })
  }
  return r
}
const compter = (n: Noeud[]): number => n.reduce((s, x) => s + 1 + compter(x.children), 0)
const libelle = (a: string) => {
  const n = a.replace('art-', '').replace(/-/g, '.')
  return `Article ${n === '1' ? '1er' : n}`
}

/** ⚠️ Canal VISIBLE : `annotationAuthor` n'est rendu par AUCUN composant (leçon du 30 août). */
const AVERT =
  'Sommaire analytique et index : annexes éditoriales. Les rubriques placées en regard de chaque ' +
  'article sont ajoutées pour le repérage — le décret ne comporte pas d’intitulés d’articles.'

async function main() {
  // ⚠️ L'IDEMPOTENCE SE TESTE EN PREMIER.
  if (await prisma.document.findFirst({ where: { source: SOURCE }, select: { id: true } })) {
    console.log('le décret EDH est déjà versé — rien à faire.'); await prisma.$disconnect(); return
  }

  const corps = lire('corps-edh.txt')
  const toc = lireJson<Toc[]>('toc-edh.json')
  const index = lireJson<Idx[]>('index-edh.json')
  const rubriques = lireJson<Rub[]>('rubriques-edh.json')
  if (toc.length !== DIVISIONS) throw new Error(`sommaire ${toc.length}, ${DIVISIONS} attendues. STOP`)

  const jeu = new Set(corps.split('\n').map((x) => x.trim()))
  const orph = toc.filter((t) => !jeu.has(t.label))
  if (orph.length) throw new Error(`${orph.length} libellé(s) de sommaire absent(s) — « ${orph[0].label.slice(0, 56)} ». STOP`)

  const blocs = segmentAnnotated(corps, toc) as { kind: string; anchor?: string | null; jurisKey?: string | null }[]
  const porteurs = blocs.filter((b) => b.kind === 'body' && b.anchor)
  const cpt = new Map<string, number>()
  for (const b of porteurs) cpt.set(b.anchor!, (cpt.get(b.anchor!) ?? 0) + 1)
  const col = [...cpt].filter(([, n]) => n > 1)
  if (col.length) throw new Error(`ancres en COLLISION — ${col.map(([a, n]) => `${a}×${n}`).join(', ')}. STOP`)
  if (porteurs.length !== ARTICLES) throw new Error(`${porteurs.length} blocs à ancre, ${ARTICLES} attendus. STOP`)
  if (blocs.filter((b) => b.kind === 'section').length !== DIVISIONS) throw new Error(`sections rendues ≠ ${DIVISIONS}. STOP`)

  const anc = [...cpt.keys()]
  const ancres = new Set(anc)
  const cle = new Map(porteurs.map((b) => [b.anchor!, b.jurisKey!]))

  const commentaires: Record<string, string[]> = {}
  for (const r of rubriques) {
    const a = articleAnchorFromHeading(r.tete)
    if (!a) throw new Error(`tête de rubrique non reconnue « ${r.tete} ». STOP`)
    const k = cle.get(a)
    if (!k) throw new Error(`la rubrique « ${r.tete} » ne trouve pas son bloc (${a}). STOP`)
    if (commentaires[k]) throw new Error(`deux rubriques pour ${a}. STOP`)
    commentaires[k] = [`Rubrique du sommaire analytique : ${r.rubrique}`]
  }
  if (Object.keys(commentaires).length !== ARTICLES) throw new Error(`${Object.keys(commentaires).length} rubriques, ${ARTICLES} articles. STOP`)

  const morts = index.flatMap((e) => e.ctRefs.filter((n) => !ancres.has(`art-${n}`)).map((n) => `${e.subject.slice(0, 24)}→art-${n}`))
  if (morts.length) throw new Error(`${morts.length} renvoi(s) mort(s) — ${morts.slice(0, 4).join(' · ')}. STOP`)

  const nav = navDepuisToc(toc)
  if (compter(nav) !== toc.length) throw new Error(`${compter(nav)} nœuds pour ${toc.length} entrées. STOP`)

  // ⚠️ Le script AFFIRME que l'article 39 abroge quatre textes nommément : il le vérifie.
  const a39 = corps.split('\n').findIndex((l) => /^Article 39\.-/.test(l.trim()))
  if (a39 < 0) throw new Error('article 39 introuvable. STOP')
  const bloc39 = corps.split('\n').slice(a39, a39 + 6).join(' ')
  for (const t of ['18 juin 1948', '7 septembre 1950', '20 mai 1976', '20 août 1989'])
    if (!bloc39.includes(t)) throw new Error(`l’article 39 ne nomme pas « ${t} » — l’affirmation du script est fausse. STOP`)

  const codePenal = await prisma.document.findFirst({ where: { source: 'CODE_PENAL_ANNOTE' }, select: { id: true } })
  if (!codePenal) throw new Error('CODE_PENAL_ANNOTE introuvable — l’article 37 y renvoie. STOP')
  const theme = await prisma.theme.findFirst({ where: { slug: 'energie-electricite' }, select: { id: true, labelFr: true, _count: { select: { documents: true } } } })
  if (!theme) throw new Error('thème energie-electricite introuvable. STOP')
  const energie = await prisma.document.findFirst({ where: { source: 'DECRET_ENERGIE_ELECTRIQUE_2016' }, select: { id: true, titleFr: true, annotationsJson: true } })
  if (!energie) throw new Error('DECRET_ENERGIE_ELECTRIQUE_2016 introuvable — la rectification n’aurait pas de support. STOP')

  const memeJour = await prisma.document.findMany({ where: { adoptionDate: new Date('2016-01-06T00:00:00Z') }, select: { titleFr: true, type: true } })
  const titres = [...memeJour.map((d) => d.titleFr ?? ''), TITRE]
  if (new Set(titres).size !== titres.length) throw new Error('deux actes du 6 janvier 2016 porteraient le même intitulé. STOP')

  // ⚠️ La rectification va dans un canal VISIBLE (crossRefs, ancre de la 1ʳᵉ section).
  const aEn = JSON.parse(String(energie.annotationsJson ?? '{}'))
  const sec1 = ((aEn.toc ?? []) as Toc[])[0]?.anchor
  if (!sec1) throw new Error('la fiche du décret énergie n’a pas de section où accrocher la rectification. STOP')
  const RECTIF =
    '⚠️ RECTIFICATION (30 août 2026). Il était noté au versement que l’abrogation du monopole de la ' +
    'Loi du 18 juin 1948 « ne pouvait pas être mesurée ». Elle n’a jamais été implicite : l’article 39 ' +
    'du Décret du 6 janvier 2016 créant l’Électricité d’Haïti — quatrième acte du même fascicule — ' +
    'abroge EXPRESSÉMENT la Loi du 18 juin 1948, le Décret du 7 septembre 1950 qui la modifie, ' +
    'l’Arrêté du 20 mai 1976 sur les servitudes et le Décret du 20 août 1989 sur l’EDH.'
  const dejaRectifie = ((aEn.crossRefs ?? []) as { note?: string }[]).some((c) => (c.note ?? '').includes('RECTIFICATION (30 août 2026)'))

  console.log(`${TITRE}\n`)
  console.log(`  ${corps.split('\n').length} lignes · ${porteurs.length} articles · sommaire ${toc.length} · menu ${compter(nav)} nœuds · rubriques ${Object.keys(commentaires).length}`)
  console.log(`  index ${index.length} entrées · ${index.reduce((n, e) => n + e.ctRefs.length, 0)} renvois · 0 mort · couverture ${new Set(index.flatMap((e) => e.ctRefs)).size}/${ARTICLES}`)
  console.log(`  adopté 2016-01-06 · publié 2016-02-03 · thème « ${theme.labelFr} » (${theme._count.documents} doc → ${theme._count.documents + 1})`)
  console.log(`  actes du 6 janvier 2016 en base : ${memeJour.filter((d) => d.type !== 'INDEX').length} texte(s) intégral(aux) — tous d’intitulé distinct (contrôlé)`)
  console.log(`\n  ARTICLE 39 — quatre abrogations NOMINATIVES, vérifiées dans le corps :`)
  for (const t of ABROGES) console.log(`     ABROGE → ${t.slice(0, 96)}${t.length > 96 ? '…' : ''}`)
  console.log(`  ARTICLE 37 → Code pénal [lien]`)
  console.log(`  ARTICLE 40 — clause-balai : aucun renvoi n’en est tiré`)
  console.log(`\n  rectification sur la fiche « ${energie.titleFr?.slice(0, 52)}… » : ${dejaRectifie ? 'déjà portée' : `à porter (crossRefs, ancre ${sec1})`}`)
  console.log(`  ⚠️ les quatre textes abrogés sont ABSENTS du corpus — renvois par désignation, et quatre pièces à réclamer`)

  if (!APPLY) { console.log('\nSIMULATION — rien n’a été écrit.'); await prisma.$disconnect(); return }

  let docId = ''
  await prisma.$transaction(async (tx) => {
    const doc = await tx.document.create({
      data: {
        type: 'LEGISLATION', status: 'EN_VIGUEUR', titleFr: TITRE, number: TITRE,
        bodyOriginal: corps, originalLang: 'fr', source: SOURCE, category: 'LEGISLATION',
        moniteurRef: MONITEUR,
        adoptionDate: new Date('2016-01-06T00:00:00Z'),
        publicationDate: new Date('2016-02-03T00:00:00Z'),
        annotationsJson: JSON.stringify({
          title: TITRE, annotationAuthor: '', toc, navToc: nav,
          connexes: [], connexe: {}, jurisprudence: {},
          indexEntries: index, commentaires,
          // ⚠️ La note d'appareil va dans crossRefs, canal RENDU — annotationAuthor ne l'est pas.
          crossRefs: [{ anchor: toc[0].anchor, articles: [], note: AVERT }],
          labels: Object.fromEntries(anc.map((a) => [a, libelle(a)])),
        }),
      },
    })
    docId = doc.id
    await tx.documentTheme.create({ data: { documentId: doc.id, themeId: theme.id, isPrimary: true, assignedBy: 'IMPORT' } })

    await tx.crossRef.createMany({
      data: [
        ...ABROGES.map((t, i) => ({
          fromId: doc.id, toType: 'LEGISLATION', kind: 'ABROGE', position: i, source: 'EDITORIAL',
          toNumber: t, toLabel: t.slice(0, 120),
          note: `Article 39 du Décret : « Le présent Décret abroge : … ${i + 1}) ${t} ». Abrogation NOMINATIVE, ` +
            `à ne pas confondre avec la clause-balai de l’article 40. Renvoi PAR DÉSIGNATION : ce texte n’est pas au corpus.`,
        })),
        {
          fromId: doc.id, toId: codePenal.id, toType: 'LEGISLATION', kind: 'CITE', position: 4, source: 'EDITORIAL',
          toLabel: 'Code pénal d’Haïti',
          note: 'Article 37 du Décret : renvoi nominatif au Code pénal.',
        },
      ],
    })

    if (!dejaRectifie) {
      const xr = [...((aEn.crossRefs ?? []) as { anchor: string; articles: number[]; note?: string }[])]
      xr.unshift({ anchor: sec1, articles: [], note: RECTIF })
      await tx.document.update({ where: { id: energie.id }, data: { annotationsJson: JSON.stringify({ ...aEn, crossRefs: xr }) } })
      await tx.crossRef.create({
        data: {
          fromId: doc.id, toId: energie.id, toType: 'LEGISLATION', kind: 'VOIR', position: 5, source: 'EDITORIAL',
          toLabel: energie.titleFr ?? 'Décret du 6 janvier 2016 régissant le secteur de l’énergie électrique',
          note: 'Décrets frères du même fascicule et du même jour : le premier régit le marché, celui-ci refonde l’opérateur historique. L’ANARSE, régulateur, est le troisième volet.',
        },
      })
    }

    await audit({
      action: 'DOC_PUBLISHED', targetType: 'Document', targetId: doc.id,
      meta: {
        motif:
          'Décret du 6 janvier 2016 créant l’Électricité d’Haïti (EDH) versé en Législation annotée — ' +
          'QUATRIÈME acte du Moniteur n° 23 du 3 février 2016, pages 42 à 56. Le fascicule est désormais ' +
          'complet : le décret régissant le secteur (marché), l’ANARSE (régulateur), le DSIS et l’EDH ' +
          '(opérateur historique). 40 articles, 5 chapitres, 5 sections, index de 162 entrées et 252 ' +
          'renvois couvrant les 40 articles, 40 rubriques du sommaire analytique. ' +
          '⚠️ SON ARTICLE 39 ABROGE QUATRE TEXTES NOMMÉMENT : la Loi du 18 juin 1948 sur le monopole ' +
          'd’État, le Décret du 7 septembre 1950 qui la modifie, l’Arrêté du 20 mai 1976 sur les ' +
          'servitudes d’utilité publique et le Décret du 20 août 1989 sur l’EDH. Il était noté le 30 août, ' +
          'au versement du décret énergie, que « l’abrogation implicite du monopole de la Loi du 18 juin ' +
          '1948 ne peut pas être mesurée » : elle n’a jamais été implicite, elle est EXPRESSE, et la ' +
          'rectification est portée sur la fiche du décret énergie dans un canal visible. ' +
          '⚠️ L’article 40 est la clause-balai : aucun renvoi n’en est tiré. ' +
          'Les quatre textes abrogés sont absents du corpus : renvois par désignation, et quatre pièces ' +
          'désormais nommées avec précision, donc réclamables.',
        articles: porteurs.length, index: index.length, abrogationsNominatives: ABROGES.length,
      },
    }, tx)
  }, { timeout: 180_000, maxWait: 30_000 })

  // ── contrôles de sortie : on RELIT la base ─────────────────────────────────────────
  await reindexDocument(docId)
  await reindexDocument(energie.id)
  const d = await prisma.document.findUnique({
    where: { id: docId },
    select: { bodyOriginal: true, annotationsJson: true, titleFr: true, number: true, adoptionDate: true, searchText: true, themes: { select: { isPrimary: true, theme: { select: { slug: true } } } } },
  })
  const a = JSON.parse(String(d?.annotationsJson ?? '{}'))
  const rendu = new Set((segmentAnnotated(d?.bodyOriginal ?? '', a.toc ?? []) as { kind: string; anchor?: string | null }[])
    .filter((x) => x.kind === 'body' && x.anchor).map((x) => x.anchor))
  const mortsApres = (a.indexEntries ?? []).flatMap((e: Idx) => e.ctRefs.filter((n) => !rendu.has(`art-${n}`)))
  const xr = await prisma.crossRef.findMany({ where: { fromId: docId }, select: { kind: true, toId: true } })
  const aEn2 = JSON.parse(String((await prisma.document.findUnique({ where: { id: energie.id }, select: { annotationsJson: true } }))?.annotationsJson ?? '{}'))
  const rect = ((aEn2.crossRefs ?? []) as { note?: string }[]).some((c) => (c.note ?? '').includes('RECTIFICATION (30 août 2026)'))
  const n23 = await prisma.document.count({ where: { publicationDate: new Date('2016-02-03T00:00:00Z'), type: 'LEGISLATION' } })
  console.log(`\n✓ ${rendu.size} ancres · toc ${(a.toc ?? []).length} · menu ${compter(a.navToc ?? [])} · rubriques ${Object.keys(a.commentaires ?? {}).length} · index ${(a.indexEntries ?? []).length} · morts ${mortsApres.length}`)
  console.log(`  titre=réf ${d?.titleFr === d?.number ? 'oui' : 'NON'} · adopté ${d?.adoptionDate?.toISOString().slice(0, 10)} · ${d?.themes.filter((t) => t.isPrimary).length} primaire (${d?.themes.map((t) => t.theme.slug).join(',')}) · ${d?.searchText?.length ?? 0} c.`)
  console.log(`  ${xr.length} renvois posés — ${xr.filter((r) => r.kind === 'ABROGE').length} ABROGE nominatifs, ${xr.filter((r) => r.toId).length} cliquables`)
  console.log(`  rectification sur la fiche énergie : ${rect ? '✓ portée et visible' : '✗ ABSENTE'}`)
  console.log(`  fascicule n° 23 du 3 février 2016 : ${n23} texte(s) intégral(aux) au corpus`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  const m = e instanceof Error ? e.message : String(e)
  console.error('ÉCHEC :', m.trim() ? m : e)
  await prisma.$disconnect(); process.exit(1)
})
