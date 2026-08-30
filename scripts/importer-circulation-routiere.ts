/**
 * CIRCULATION ROUTIÈRE — le « Code de la Route » et deux arrêtés sur les véhicules de l'État.
 *
 *     npx tsx scripts/importer-circulation-routiere.ts            # simulation
 *     npx tsx scripts/importer-circulation-routiere.ts --apply    # Me Vaval, elle seule
 *
 * ⚠️ DIX FICHIERS, TROIS TEXTES. Le décret était transcrit DEUX FOIS, avec chacun son sommaire et
 * son index. Les deux transcriptions couvrent les mêmes 284 articles à 0,74 % de volume près, mais
 * 60 divergent. `Code_de_la_Route_Haiti_2006.docx` L'EMPORTE, sur trois mesures concordantes :
 *   · sens des écarts — le Code plus long sur 17 articles, l'autre sur 7 ;
 *   · nature des mots en plus — le Code apporte des mots GRAMMATICAUX (« de » ×19, « le » ×15,
 *     « et » ×13), l'autre des unités COLLÉES (« 2750cc », « 3500kg », « 400mm ») ;
 *   · corruptions d'OCR de l'écarté — art. 7 « routes nationales départementales » (sans « et »),
 *     art. 8 « villes bourg et village », art. 11 « super structure », art. 16 « est UN
 *     imprescriptible », art. 25 « après avoir REMPLIES », et surtout art. 284 « tous décret ON
 *     dispositions » pour « décretS OU dispositions ».
 * Le fichier écarté reste en pièce ; il n'est pas versé. On choisit, on dit pourquoi.
 *
 * ⚠️ CE DÉCRET N'EST PAS DE 2006 — IL EST DU 1er JUIN 2005. « Donné au Palais National […] le
 * 1er juin 2005, An 202ᵉ de l'Indépendance » ; publié au Moniteur, Spécial n° 1 du 26 mai 2006.
 * PRÈS DE DOUZE MOIS d'écart — le plus grand du corpus. Six des dix noms de fichiers disent
 * « 2006 » : ils nomment la publication. Les deux transcriptions portent la même formule.
 *
 * ⚠️ L'ARRÊTÉ DE 2022 NE S'APPELLE PAS « DÉCLASSEMENT VÉHICULES ÉTAT ». C'est son objet, pas son
 * titre : le Journal officiel l'intitule « Arrêté définissant les modalités d'application des
 * dispositions de l'article 85 du Décret du 12 mai 2022 établissant le Budget général ».
 *
 * ⚠️ LES DEUX ARRÊTÉS SONT SIGNÉS « À LA PRIMATURE » — par le Premier Ministre, non par le
 * Président. Leur date d'adoption est celle de cette signature.
 */
import { prisma } from '../src/lib/db'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { audit } from '../src/lib/auth/audit'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated } from '../src/lib/legislation/annotated'
import { articleAnchorFromHeading } from '../src/lib/doc/anchors'

const APPLY = process.argv.includes('--apply')
const D = join(process.cwd(), 'scripts/data/route')
const lire = (f: string) => readFileSync(join(D, f), 'utf8').replace(/\n+$/, '')

const THEME = {
  slug: 'circulation-routiere-vehicules',
  labelFr: 'Circulation routière et véhicules',
  labelEn: 'Road traffic and vehicles',
  labelHt: 'Sikilasyon wout ak machin',
}

const FICHES = [
  {
    source: 'DECRET_CIRCULATION_VEHICULES_2005', corps: 'corps-code.txt', articles: 284,
    titre: 'Décret du 1er juin 2005 relatif à l’immatriculation et à la circulation des véhicules',
    adoption: '2005-06-01', publication: '2006-05-26',
    moniteur: 'Le Moniteur · LM2006-SP1 · 161ᵉ année, Spécial n° 1 du vendredi 26 mai 2006',
    toc: 'toc-code.json', index: 'code' as const,
  },
  {
    source: 'ARRETE_LOCATION_VEHICULES_2018', corps: 'corps-location.txt', articles: 11,
    titre: 'Arrêté du 22 février 2018 portant réglementation de la location de véhicules au sein de l’Administration Publique',
    adoption: '2018-02-22', publication: '2018-02-28',
    moniteur: 'Le Moniteur · LM2018-37 · 173ᵉ année, n° 37 du mercredi 28 février 2018',
    toc: null, index: null,
  },
  {
    source: 'ARRETE_DECLASSEMENT_VEHICULES_2022', corps: 'corps-arrete2022.txt', articles: 25,
    titre: 'Arrêté du 1er juin 2022 définissant les modalités d’application des dispositions de l’article 85 du Décret du 12 mai 2022 établissant le Budget général de la République d’Haïti, exercice 2021-2022',
    adoption: '2022-06-01', publication: '2022-06-13',
    moniteur: 'Le Moniteur · LM2022-SP16 · 177ᵉ année, Spécial n° 16 du lundi 13 juin 2022',
    toc: null, index: 'a22' as const,
  },
]

async function main() {
  const idx: { code: { subject: string; ctRefs: string[] }[]; a22idx: { subject: string; ctRefs: string[] }[]; a22som: { subject: string; ctRefs: string[] }[] } = JSON.parse(lire('index-route.json'))
  if (idx.code.length !== 221 || idx.a22idx.length !== 86 || idx.a22som.length !== 25)
    throw new Error(`index : ${idx.code.length}/221 · ${idx.a22idx.length}/86 · ${idx.a22som.length}/25. STOP`)

  const parent = await prisma.theme.findFirst({ where: { slug: 'travaux-publics-transports' }, select: { id: true } })
  if (!parent) throw new Error('thème travaux-publics-transports introuvable. STOP')
  if (await prisma.theme.findFirst({ where: { slug: THEME.slug } })) { console.log('sous-thème déjà créé — rien à faire.'); await prisma.$disconnect(); return }
  const deja = await prisma.document.findMany({ where: { source: { in: FICHES.map((f) => f.source) } }, select: { source: true } })
  if (deja.length) throw new Error(`${deja.length} fiche(s) déjà versée(s). STOP`)

  const prep = FICHES.map((f) => {
    const corps = lire(f.corps)
    // ⚠️ Comptage LARGE, par la fonction de la plateforme : les ponctuations varient au J.O.
    const anc = [...new Set(corps.split('\n').map((x) => articleAnchorFromHeading(x.trim())).filter(Boolean) as string[])]
    if (anc.length !== f.articles) throw new Error(`${f.source} : ${anc.length} ancres, ${f.articles} attendues. STOP`)
    const toc: { level: number; label: string; anchor: string; kind: string }[] = f.toc ? JSON.parse(lire(f.toc)) : []
    const lignes = new Set(corps.split('\n').map((x) => x.trim()))
    const absents = toc.filter((t) => !lignes.has(t.label))
    if (absents.length) throw new Error(`${f.source} : ${absents.length} libellé(s) de sommaire absents du corps. STOP`)
    const entries = f.index === 'code' ? idx.code : f.index === 'a22' ? [...idx.a22idx, ...idx.a22som] : []
    // ⚠️ Tout renvoi doit viser une ancre QUI EXISTE.
    const morts = entries.flatMap((e) => e.ctRefs.filter((r) => !anc.includes(`art-${r}`)).map((r) => `${e.subject.slice(0, 30)}→art-${r}`))
    if (morts.length) throw new Error(`${f.source} : ${morts.length} renvoi(s) mort(s) — ${morts.slice(0, 4).join(' · ')}. STOP`)
    return { f, corps, anc, toc, entries }
  })

  const autres = await prisma.document.findMany({
    where: { type: 'LEGISLATION', OR: [{ titleFr: { contains: 'circulation des véhicules' } }, { titleFr: { contains: 'Code de la Route' } }, { titleFr: { contains: 'permis de conduire' } }] },
    select: { source: true, titleFr: true },
  })

  console.log(`sous-thème « ${THEME.labelFr} » [${THEME.slug}] · premier enfant de Travaux publics, transports & communications`)
  console.log(`   En « ${THEME.labelEn} » · Ht « ${THEME.labelHt} »\n`)
  for (const { f, corps, anc, toc, entries } of prep)
    console.log(`  ${f.source.padEnd(38)} ${String(corps.split('\n').length).padStart(4)} l. · ${String(anc.length).padStart(3)} art. · sommaire ${String(toc.length).padStart(2)} · index ${String(entries.length).padStart(3)} · adopté ${f.adoption} · publié ${f.publication}`)
  console.log(`\n  ⚠️ écarté et NON versé : Decret_Immatriculation_Circulation_Vehicules_2006.docx —`)
  console.log(`     transcription rivale du même acte, 60 articles divergents, corruptions d’OCR`)
  console.log(`     (art. 284 : « tous décret ON dispositions » pour « décretS OU dispositions »)`)
  console.log(`\n  autres textes du corpus sur cette matière : ${autres.length ? autres.map((a) => a.source).join(', ') : 'aucun'}`)

  if (!APPLY) { console.log('\nSIMULATION — rien n’a été écrit.'); await prisma.$disconnect(); return }

  const max = await prisma.theme.aggregate({ where: { parentId: parent.id }, _max: { position: true } })
  const ids = new Map<string, string>()
  await prisma.$transaction(async (tx) => {
    const th = await tx.theme.create({ data: { ...THEME, parentId: parent.id, position: (max._max.position ?? -1) + 1 } })
    for (const { f, corps, anc, toc, entries } of prep) {
      const doc = await tx.document.create({
        data: {
          type: 'LEGISLATION', status: 'EN_VIGUEUR', titleFr: f.titre, number: f.titre,
          bodyOriginal: corps, originalLang: 'fr', source: f.source, category: 'LEGISLATION',
          moniteurRef: f.moniteur,
          adoptionDate: new Date(`${f.adoption}T00:00:00Z`), publicationDate: new Date(`${f.publication}T00:00:00Z`),
          annotationsJson: JSON.stringify({
            title: f.titre, annotationAuthor: '', toc,
            navToc: toc.filter((t) => t.level === 1).map((t) => ({ label: t.label, anchor: t.anchor, children: [] })),
            connexes: [], jurisprudence: {}, indexEntries: entries,
            labels: Object.fromEntries(anc.map((a) => [a, `Article ${a.replace('art-', '').replace('-', '.')}`])),
          }),
        },
      })
      ids.set(f.source, doc.id)
      await tx.documentTheme.create({ data: { documentId: doc.id, themeId: th.id, isPrimary: true, assignedBy: 'IMPORT' } })
    }
    const id05 = ids.get('DECRET_CIRCULATION_VEHICULES_2005')!, id22 = ids.get('ARRETE_DECLASSEMENT_VEHICULES_2022')!
    await tx.crossRef.createMany({
      data: [
        { fromId: id05, toType: 'LEGISLATION', kind: 'ABROGE', position: 0, source: 'EDITORIAL',
          toLabel: 'Toutes lois et dispositions contraires (clause générale)',
          note: 'dispositif (article 284 du Décret) : « … tous décrets ou dispositions de décret qui lui est contraire et sera publié et exécuté … ». ⚠️ Clause GÉNÉRALE : aucune pastille n’en est tirée sur un article.' },
        { fromId: id22, toType: 'LEGISLATION', kind: 'APPLIQUE', position: 0, source: 'EDITORIAL',
          toLabel: 'Décret du 12 mai 2022 établissant le Budget général de la République d’Haïti, exercice 2021-2022 — article 85',
          note: 'Texte NON VERSÉ au corpus : renvoi en clair, sans lien. L’Arrêté définit les modalités d’application de l’article 85 de ce décret budgétaire.' },
      ],
    })
    await audit({
      action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: 'CIRCULATION_ROUTIERE',
      meta: {
        motif:
          'Sous-thème « Circulation routière et véhicules » créé sous Travaux publics, transports & ' +
          'communications (décision de Me Vaval du 29 août 2026), et trois textes versés : décret du ' +
          '1er JUIN 2005 relatif à l’immatriculation et à la circulation des véhicules (284 articles, ' +
          '5 titres, 22 chapitres, dit « Code de la Route »), arrêté du 22 février 2018 sur la location ' +
          'de véhicules, arrêté du 1er juin 2022 sur l’article 85 du budget. ' +
          '⚠️ Le décret est de 2005 et non de 2006 : signé le 1er juin 2005, publié le 26 mai 2006, ' +
          'près de douze mois plus tard — six des dix noms de fichiers nommaient la publication. ' +
          '⚠️ Le décret était transcrit DEUX FOIS : la transcription « Code de la Route » l’emporte ' +
          '(60 articles divergents ; l’écartée perd des mots grammaticaux et porte des corruptions ' +
          'd’OCR, dont « décret ON dispositions » à l’article 284). L’écartée n’est pas versée.',
        verses: prep.length, articles: prep.map((p) => p.anc.length), transcriptionEcartee: 'Decret_Immatriculation_Circulation_Vehicules_2006.docx',
      },
    }, tx)
  }, { timeout: 180_000, maxWait: 30_000 })

  const journal = await prisma.auditLog.count({ where: { targetId: 'CIRCULATION_ROUTIERE' } })
  for (const id of ids.values()) await reindexDocument(id)
  const th = await prisma.theme.findFirst({ where: { slug: THEME.slug }, select: { position: true, parent: { select: { labelFr: true } }, _count: { select: { documents: true } } } })
  console.log(`\n✓ AuditLog ${journal} (recompté) · ${ids.size} documents réindexés`)
  console.log(`  sous-thème : sous « ${th?.parent?.labelFr} », position ${th?.position}, ${th?._count.documents} documents`)
  for (const [src, id] of ids) {
    const d = await prisma.document.findUnique({ where: { id }, select: { bodyOriginal: true, annotationsJson: true, adoptionDate: true } })
    const a = JSON.parse(String(d?.annotationsJson ?? '{}'))
    const rendu = new Set((segmentAnnotated(d?.bodyOriginal ?? '', a.toc ?? []) as { anchor?: string | null }[]).map((b) => b.anchor).filter(Boolean))
    console.log(`  ${src.padEnd(38)} ${rendu.size} ancres rendues · sommaire ${(a.toc ?? []).length} · index ${(a.indexEntries ?? []).length} · adopté ${d?.adoptionDate?.toISOString().slice(0, 10)}`)
  }
  await prisma.$disconnect()
}

main().catch(async (e) => {
  const m = e instanceof Error ? e.message : String(e)
  console.error('ÉCHEC :', m.trim() ? m : e)
  await prisma.$disconnect(); process.exit(1)
})
