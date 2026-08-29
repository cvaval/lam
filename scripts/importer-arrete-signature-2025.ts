/**
 * SIGNATURE ÉLECTRONIQUE — l'arrêté du 18 septembre 2025 fixant les modalités d'application.
 *
 *     npx tsx scripts/importer-arrete-signature-2025.ts            # simulation
 *     npx tsx scripts/importer-arrete-signature-2025.ts --apply    # Me Vaval, elle seule
 *
 * ⚠️ DEUX PONCTUATIONS POUR LA MÊME TÊTE D'ARTICLE. Cinq décimaux s'écrivent « Article 1.1.- »
 * (point puis tiret), SIX s'écrivent « Article 11.1- » (tiret seul). Un compte qui exige la
 * première forme en perd six EN SILENCE : 29 têtes au lieu de 35. `articleAnchorFromHeading` gère
 * les deux ; c'est le COMPTAGE qu'il faut écrire large. Le script exige 35, et refuse à 29.
 *
 * ⚠️ LES EN-TÊTES DE CHAPITRE SONT SUR DEUX LIGNES : « CHAPITRE Ier » puis, à la ligne, son
 * intitulé. `segmentAnnotated` reconnaît un en-tête par ÉGALITÉ DE LIGNE : un libellé composé des
 * deux ne correspondrait à rien. Le `toc` retient donc l'INTITULÉ, seule ligne à la fois réelle et
 * informative — « CHAPITRE Ier » seul ne dirait rien dans une navigation.
 *
 * ⚠️ LES RENVOIS SONT EN POINTS, LES ANCRES EN TIRETS. L'index écrit « Art. 13.3 » ; l'ancre est
 * `art-13-3`. La conversion est faite à l'extraction, et VÉRIFIÉE ici contre les ancres réellement
 * rendues : un index qui pointe dans le vide est pire qu'un index absent.
 *
 * ─── CE QUE CE LOT RÉPARE EN PASSANT ───────────────────────────────────────────────────────
 * La section ne portait aucun renvoi reliant la loi de 2017 au décret qui l'amende, et les deux
 * fiches avaient une `adoptionDate` NULLE. Les formules, relevées dans leur corps, tranchent :
 *   · Loi de 2017 — « Donnée à la Chambre des Députés, le 04 septembre 2014 », puis « Donnée au
 *     Sénat de la République, le 14 février 2017 », promulguée le 17 mars 2017. ⚠️ DEUX ANS ET
 *     DEMI séparent les deux chambres : une loi porte la date de son DERNIER VOTE ⇒ 2017-02-14.
 *   · Décret de 2025 — « Donné au Palais National […] le 20 août 2025 » ⇒ 2025-08-20.
 * Les deux dates sont ÉTABLIES SUR LA FORMULE, jamais déduites du titre — même quand elles s'y
 * accordent.
 */
import { prisma } from '../src/lib/db'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { audit } from '../src/lib/auth/audit'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated } from '../src/lib/legislation/annotated'
import { articleAnchorFromHeading } from '../src/lib/doc/anchors'

const APPLY = process.argv.includes('--apply')
const D = join(process.cwd(), 'scripts/data/arrete-sig-2025')
const lire = (f: string) => readFileSync(join(D, f), 'utf8')
const SOURCE = 'ARRETE_SIGNATURE_ELECTRONIQUE_2025'
const TITRE =
  'Arrêté du 18 septembre 2025 fixant les modalités d’application de la Loi du 14 février 2017 sur la signature électronique, adaptant le droit de la preuve aux technologies de l’information et élargissant les compétences du Conseil National des Télécommunications (CONATEL), amendée par le Décret du 20 août 2025'

async function main() {
  const corps = lire('corps-arrete.txt').replace(/\n+$/, '')
  const toc: { level: number; label: string; anchor: string; kind: string }[] = JSON.parse(lire('toc-arrete.json'))
  const { index, table }: { index: { subject: string; ctRefs: string[] }[]; table: { subject: string; ctRefs: string[] }[] } = JSON.parse(lire('index-arrete.json'))

  // ⚠️ COMPTAGE LARGE : les deux ponctuations, sinon six articles disparaissent en silence.
  const anc = [...new Set(corps.split('\n').map((x) => articleAnchorFromHeading(x.trim())).filter(Boolean) as string[])]
  const base = anc.filter((x) => /^art-\d+$/.test(x))
  const dec = anc.filter((x) => /^art-\d+-\d/.test(x))
  if (anc.length !== 35 || base.length !== 24 || dec.length !== 11)
    throw new Error(`${anc.length} têtes (${base.length} base, ${dec.length} décimales) — 35/24/11 attendus. STOP`)
  for (let n = 1; n <= 24; n++) if (!base.includes(`art-${n}`)) throw new Error(`article ${n} manquant. STOP`)
  if (toc.length !== 7) throw new Error(`${toc.length} entrées de sommaire, 7 attendues. STOP`)
  const lignes = new Set(corps.split('\n').map((x) => x.trim()))
  const absents = toc.filter((t) => !lignes.has(t.label))
  if (absents.length) throw new Error(`${absents.length} libellé(s) de sommaire absents du corps. STOP`)
  if (index.length !== 148 || table.length !== 35) throw new Error(`index ${index.length}/148 · table ${table.length}/35. STOP`)

  if (await prisma.document.findFirst({ where: { source: SOURCE } })) { console.log('arrêté déjà versé — rien à faire.'); await prisma.$disconnect(); return }

  const loi = await prisma.document.findFirst({ where: { source: 'LOI_SIGNATURE_ELECTRONIQUE_2017' }, select: { id: true, bodyOriginal: true, annotationsJson: true, adoptionDate: true } })
  const dec25 = await prisma.document.findFirst({ where: { source: 'DECRET_SIGNATURE_ELECTRONIQUE_2025' }, select: { id: true, bodyOriginal: true, adoptionDate: true } })
  if (!loi || !dec25) throw new Error('la loi de 2017 ou le décret de 2025 est introuvable. STOP')
  const empLoi = createHash('md5').update(loi.bodyOriginal ?? '').digest('hex')

  // ── Les dates se LISENT dans les formules, jamais dans le titre ──
  const formule = (txt: string, re: RegExp) => (txt.split('\n').find((x) => re.test(x)) ?? '').trim()
  const senat = formule(loi.bodyOriginal ?? '', /Donnée au Sénat de la République.*14 février 2017/)
  const palais = formule(dec25.bodyOriginal ?? '', /Donné au Palais National.*20 août 2025/)
  if (!senat) throw new Error('la formule du Sénat du 14 février 2017 est introuvable au corps de la loi — ne rien dater. STOP')
  if (!palais) throw new Error('la formule du 20 août 2025 est introuvable au corps du décret — ne rien dater. STOP')

  // ── Les renvois d'index doivent viser des ancres qui EXISTENT ──
  const toutes = [...index, ...table]
  const morts = toutes.flatMap((e) => e.ctRefs.filter((r) => !anc.includes(`art-${r}`)).map((r) => `${e.subject.slice(0, 34)} → art-${r}`))
  if (morts.length) throw new Error(`${morts.length} renvoi(s) mort(s) : ${morts.slice(0, 4).join(' · ')}. STOP`)

  const annLoi = JSON.parse(String(loi.annotationsJson ?? '{}'))
  const ancLoi = new Set((segmentAnnotated(loi.bodyOriginal ?? '', annLoi.toc ?? []) as { anchor?: string | null }[]).map((b) => b.anchor).filter(Boolean) as string[])
  if (!ancLoi.has('art-1-1')) throw new Error('art-1-1 introuvable dans la loi de 2017 : le renvoi de l’article 2 de l’arrêté pointerait dans le vide. STOP')

  console.log(`arrêté : ${corps.split('\n').length} lignes · ${anc.length} têtes (${base.length} base + ${dec.length} décimales)`)
  console.log(`  décimales : ${dec.join(', ')}`)
  console.log(`  sommaire ${toc.length} entrées · index ${index.length} mots-clés + ${table.length} objets = ${toutes.length} entrées, ${toutes.reduce((s, e) => s + e.ctRefs.length, 0)} renvois, aucun mort`)
  console.log(`\nréparations en passant :`)
  console.log(`  loi 2017   adoptionDate ${loi.adoptionDate?.toISOString().slice(0, 10) ?? 'NULL'} → 2017-02-14`)
  console.log(`             « ${senat.slice(0, 92)} »`)
  console.log(`  décret 2025 adoptionDate ${dec25.adoptionDate?.toISOString().slice(0, 10) ?? 'NULL'} → 2025-08-20`)
  console.log(`             « ${palais.slice(0, 92)} »`)
  console.log(`  + renvoi décret 2025 --MODIFIE--> loi 2017 (la section n’en portait aucun)`)

  if (!APPLY) { console.log('\nSIMULATION — rien n’a été écrit.'); await prisma.$disconnect(); return }

  const theme = await prisma.theme.findFirst({ where: { slug: 'signature-electronique' }, select: { id: true } })
  if (!theme) throw new Error('thème signature-electronique introuvable. STOP')
  let id = ''
  await prisma.$transaction(async (tx) => {
    const doc = await tx.document.create({
      data: {
        type: 'LEGISLATION', status: 'EN_VIGUEUR', titleFr: TITRE, number: TITRE,
        bodyOriginal: corps, originalLang: 'fr', source: SOURCE, category: 'LEGISLATION',
        moniteurRef: 'Le Moniteur · LM2025-SP58D · 180ᵉ année, Spécial n° 58-D du vendredi 19 septembre 2025',
        adoptionDate: new Date('2025-09-18T00:00:00Z'), publicationDate: new Date('2025-09-19T00:00:00Z'),
        annotationsJson: JSON.stringify({
          title: TITRE, annotationAuthor: '', toc,
          navToc: toc.map((t) => ({ label: t.label, anchor: t.anchor, children: [] })),
          connexes: [], jurisprudence: {}, indexEntries: toutes,
          labels: Object.fromEntries(anc.map((a) => [a, `Article ${a.replace('art-', '').replace('-', '.')}`])),
        }),
      },
    })
    id = doc.id
    await tx.documentTheme.create({ data: { documentId: doc.id, themeId: theme.id, isPrimary: true, assignedBy: 'IMPORT' } })
    await tx.document.update({ where: { id: loi.id }, data: { adoptionDate: new Date('2017-02-14T00:00:00Z') } })
    await tx.document.update({ where: { id: dec25.id }, data: { adoptionDate: new Date('2025-08-20T00:00:00Z') } })
    await tx.crossRef.createMany({
      data: [
        { fromId: doc.id, toId: loi.id, toType: 'LEGISLATION', kind: 'APPLIQUE', position: 0, source: 'EDITORIAL',
          toLabel: 'Loi du 14 février 2017 sur la signature électronique',
          note: 'dispositif (article 1er de l’Arrêté) : « Le présent Arrêté a pour objet de fixer les modalités d’application de la Loi du 14 février 2017 sur la signature électronique… ». ⚠️ Son article 2 vise nommément l’article 1.1 de cette loi (ancre art-1-1).' },
        { fromId: doc.id, toId: dec25.id, toType: 'LEGISLATION', kind: 'CITE', position: 1, source: 'EDITORIAL',
          toLabel: 'Décret du 20 août 2025 portant amendement de la Loi du 14 février 2017',
          note: 'Le titre même de l’Arrêté vise la loi « amendée par le Décret du 20 août 2025 » : il applique donc la loi DANS SA RÉDACTION AMENDÉE, non dans celle de 2017.' },
        { fromId: dec25.id, toId: loi.id, toType: 'LEGISLATION', kind: 'MODIFIE', position: 0, source: 'EDITORIAL',
          toLabel: 'Loi du 14 février 2017 sur la signature électronique',
          note: 'Renvoi posé le 29 août 2026 : la consolidation était faite dans le corps de la loi (17 pastilles, 9 anciennes rédactions repliées), mais AUCUN lien ne reliait les deux fiches — le lecteur de la loi ne pouvait pas atteindre l’acte qui l’avait amendée.' },
      ],
    })
    await audit({
      action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: 'ARRETE_SIGNATURE_2025',
      meta: {
        motif:
          'Arrêté du 18 septembre 2025 fixant les modalités d’application de la Loi du 14 février 2017 sur ' +
          'la signature électronique (Moniteur Spécial n° 58-D du 19 septembre 2025) : versé sous ' +
          'signature-electronique, 35 articles (24 de base + 11 décimaux, DEUX ponctuations de tête), ' +
          '7 chapitres, index de 183 entrées sans renvoi mort. Réparé en passant : le renvoi qui manquait ' +
          'entre le décret du 20 août 2025 et la loi qu’il amende, et les deux adoptionDate nulles — ' +
          'établies sur les FORMULES, non sur les titres (la loi a été votée par la Chambre le ' +
          '4 septembre 2014 et par le Sénat le 14 février 2017 : c’est le dernier vote qui compte).',
        articles: anc.length, chapitres: toc.length, index: toutes.length, renvois: 3,
      },
    }, tx)
  }, { timeout: 120_000, maxWait: 30_000 })

  const journal = await prisma.auditLog.count({ where: { targetId: 'ARRETE_SIGNATURE_2025' } })
  for (const x of [id, loi.id, dec25.id]) await reindexDocument(x)
  const ap = await prisma.document.findFirst({ where: { source: SOURCE }, select: { bodyOriginal: true, annotationsJson: true, themes: { select: { theme: { select: { slug: true } } } } } })
  const a2 = JSON.parse(String(ap?.annotationsJson ?? '{}'))
  const rendu = new Set((segmentAnnotated(ap?.bodyOriginal ?? '', a2.toc ?? []) as { anchor?: string | null }[]).map((b) => b.anchor).filter(Boolean))
  const l2 = await prisma.document.findFirst({ where: { source: 'LOI_SIGNATURE_ELECTRONIQUE_2017' }, select: { adoptionDate: true, bodyOriginal: true } })
  const d2 = await prisma.document.findFirst({ where: { source: 'DECRET_SIGNATURE_ELECTRONIQUE_2025' }, select: { adoptionDate: true } })
  const cr = await prisma.crossRef.count({ where: { OR: [{ from: { source: { contains: 'SIGNATURE_ELECTRONIQUE' } } }] } })
  console.log(`\n✓ AuditLog ${journal} (recompté) · 3 documents réindexés`)
  console.log(`  arrêté : ${rendu.size} ancres · sommaire ${(a2.toc ?? []).length} · index ${(a2.indexEntries ?? []).length} · thème ${ap?.themes.map((t) => t.theme.slug).join(', ')}`)
  console.log(`  loi 2017 : adoptée ${l2?.adoptionDate?.toISOString().slice(0, 10)} · corps ${createHash('md5').update(l2?.bodyOriginal ?? '').digest('hex') === empLoi ? 'INTACT ✓' : '⚠️ MODIFIÉ'}`)
  console.log(`  décret 2025 : adopté ${d2?.adoptionDate?.toISOString().slice(0, 10)}`)
  console.log(`  renvois dans la section : ${cr}`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  const m = e instanceof Error ? e.message : String(e)
  console.error('ÉCHEC :', m.trim() ? m : e)
  await prisma.$disconnect(); process.exit(1)
})
