/**
 * Verse le Décret du 19 août 2020 régissant l'insolvabilité — Livre III refondu du Code de
 * commerce, 297 articles.
 *
 *   npx tsx scripts/importer-decret-insolvabilite.ts            (simulation)
 *   npx tsx scripts/importer-decret-insolvabilite.ts --apply
 *
 * PREMIER PASSAGE : la fiche du décret seule. Le portage des 297 articles au Code de commerce
 * et les 158 pastilles d'abrogation font l'objet d'un SECOND script, une fois celui-ci vérifié.
 *
 * ⚠️ LE SOMMAIRE PORTE LA SEGMENTATION. Sans les 72 divisions au `toc`, « Section 1 »,
 * « Titre I » et « Chapitre I » retombent sur `articleAnchorFromHeading` et produisent
 * `art-1`, `art-2`, `art-3` — en collision avec les vrais articles.
 *
 * ⚠️ DEUX RENVOIS DE L'INDEX VISENT DES ARTICLES QUI N'EXISTENT PAS. « Juge-commissaire —
 * art. 3321-1 à 3321-4 » : la section s'arrête à 3321-2. « Ministère public — art. 3323-1 et
 * 3323-2 » : il n'y a que 3323-1. Le plan écrit « (art. 3321-1s) », sans borne haute — c'est
 * l'index qui a fermé l'intervalle trop loin. On borne aux articles RÉELS et on le dit ; créer
 * l'ancre manquante ferait mentir le corps.
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { articleAnchorFromHeading, anchorFromDesignation } from '../src/lib/doc/anchors'
import { buildSearchText, fold } from '../src/lib/search/normalize'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const DATA = 'scripts/data/insolvabilite-2020'
const SOURCE = 'DECRET_INSOLVABILITE_2020'
const TITRE = 'Décret du 19 août 2020 régissant l’insolvabilité'
const REF = 'Le Moniteur · LM2021-SP24 · 176ᵉ année, Spécial n° 24 du mardi 11 mai 2021'

const DIV = /^(LIVRE\s+[IVX]+|TITRE\s+(?:PRÉLIMINAIRE|[IVX]+)|CHAPITRE\s+[IVX]+|Section\s+\d+|Sous-section\s+\d+)\s+—\s+/
const ART = /^Article\s+(\d{3,5}-\d+)\.-/

/** Niveau d'une division, pour le sommaire et l'arbre de navigation. */
function niveau(l: string): number {
  if (/^LIVRE/.test(l)) return 0
  if (/^TITRE/.test(l)) return 1
  if (/^CHAPITRE/.test(l)) return 2
  if (/^Section/.test(l)) return 3
  return 4
}

function lireIndex(): { entries: { subject: string; ctRefs: string[] }[]; rapport: string[] } {
  const L = readFileSync(`${DATA}/index-client.txt`, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)
  const REFS = /\b(\d{4,5}-\d+)\b/g
  const entries: { subject: string; ctRefs: string[] }[] = []
  const rapport: string[] = []
  let porteur = ''
  for (const l of L) {
    if (/^[A-ZÀÉÈ]$/.test(l)) continue                                   // lettre de section
    if (/^\d+ entrées principales/.test(l)) { rapport.push(`décompte annoncé par l'index : « ${l.slice(0, 60)}… »`); continue }
    if (/^Les renvois sont faits/.test(l) || /^(DÉCRET|INDEX|Le Moniteur)/.test(l)) continue
    const refs = [...l.matchAll(REFS)].map((m) => m[1])
    const sous = /^[–-]\s*(.+)$/.exec(l)
    if (sous) {
      // ⚠️ UNE SOUS-ENTRÉE SANS SON PORTEUR NE VEUT RIEN DIRE : « – de plein droit » se lit
      // « Actes inopposables à la masse — de plein droit ». On préfixe, toujours.
      const sujet = sous[1].replace(REFS, '').replace(/[,\s]+$/, '').trim()
      entries.push({ subject: porteur ? `${porteur} — ${sujet}` : sujet, ctRefs: refs })
      continue
    }
    // ⚠️ UNE ENTRÉE À TIRET CADRATIN GARDE SON LIBELLÉ ENTIER. « Juge-commissaire — art. 3321-1
    // à 3321-4 ; passim » renvoie à une DIVISION autant qu'à des articles : lui retirer ses
    // numéros laissait lire « Juge-commissaire — art.  à  ; passim ». Le libellé reste tel
    // quel, seuls les `ctRefs` sont filtrés sur les articles réels.
    const cadratin = / — /.test(l)
    const sujet = cadratin ? l : l.replace(REFS, '').replace(/[,;\s]+$/, '').trim()
    if (!refs.length) rapport.push(`sujet porteur sans renvoi propre : « ${sujet.slice(0, 52)} »`)
    porteur = (cadratin ? l.split(' — ')[0] : sujet).trim()
    entries.push({ subject: sujet, ctRefs: refs })
  }
  return { entries, rapport }
}

async function main() {
  const apply = process.argv.includes('--apply')
  const corps = readFileSync(`${DATA}/corps-decret.txt`, 'utf8')
  const L = corps.split('\n')

  // ── Sommaire et navigation, bâtis sur le DISPOSITIF ──────────────────────────────────────
  // ⚠️ LE PLAN DE L'ARTICLE 1er ENTRE AUSSI AU SOMMAIRE — sous le genre `plan`.
  // `articleAnchorFromHeading` accepte « section N » : les 71 lignes du plan revendiquaient
  // `art-1`, `art-2`, `art-3`… et, venant AVANT eux dans le corps, prenaient l'ancre des
  // articles 2 et 3 du décret — dont l'article 3, celui qui abroge les articles 477 à 634 du
  // Code de commerce. Inscrites au `toc`, elles deviennent des blocs de section : plus
  // d'ancre d'article. Le lecteur les rend en prose (`tocKind === 'plan'`), et ni le sommaire
  // affiché ni la navigation ne les montrent — seules les 72 divisions du DISPOSITIF y sont.
  const PLAN = /^(Titre\s+(?:Préliminaire|[IVX]+)|Chapitre\s+[IVX]+|Section\s+\d+|Sous-section\s+\d+)\s*\.-/
  const toc: { level: number; label: string; anchor: string; kind: string }[] = []
  const labels: Record<string, string> = {}
  let n = 0
  let dansDispositif = false
  for (const raw of L) {
    const l = raw.trim()
    if (l.startsWith('LIVRE III')) dansDispositif = true
    if (DIV.test(l)) { toc.push({ level: niveau(l), label: l, anchor: `sec-${++n}`, kind: 'code' }); continue }
    if (!dansDispositif && PLAN.test(l)) { toc.push({ level: niveau(l.toUpperCase()), label: l, anchor: `sec-${++n}`, kind: 'plan' }); continue }
    const a = ART.exec(l)
    if (a) labels[anchorFromDesignation(a[1])!] = `Article ${a[1]}`
  }
  // navToc : titres → chapitres → sections, trois niveaux réellement navigables.
  const navToc: { label: string; anchor: string; children: { label: string; anchor: string; children?: any[] }[] }[] = []
  for (const e of toc.filter((x) => x.kind === 'code')) {
    if (e.level <= 1) navToc.push({ label: e.label, anchor: e.anchor, children: [] })
    else if (navToc.length) {
      const g = navToc[navToc.length - 1]
      if (e.level === 2) g.children.push({ label: e.label, anchor: e.anchor, children: [] })
      else if (g.children.length) (g.children[g.children.length - 1].children ??= []).push({ label: e.label, anchor: e.anchor })
      else g.children.push({ label: e.label, anchor: e.anchor })
    }
  }

  // ── Index ────────────────────────────────────────────────────────────────────────────────
  const { entries, rapport } = lireIndex()
  const ancres = new Set(Object.keys(labels))
  let morts = 0
  const bornes: string[] = []
  for (const e of entries) {
    const gardes = e.ctRefs.filter((r) => ancres.has(anchorFromDesignation(r)!))
    if (gardes.length !== e.ctRefs.length) {
      bornes.push(`${e.subject.slice(0, 42)} : ${e.ctRefs.filter((r) => !gardes.includes(r)).join(', ')}`)
      morts += e.ctRefs.length - gardes.length
    }
    e.ctRefs = gardes
  }

  const arts = L.map((l) => ART.exec(l.trim())?.[1]).filter(Boolean) as string[]
  // ⚠️ « Section 1 — … » EST LUE COMME UNE TÊTE D'ARTICLE par `articleAnchorFromHeading`
  // (son motif accepte « section »). Dans le lecteur annoté, ces lignes sont reconnues au
  // `toc` et rendues en division (`sec-N`, `noAnchors`) : elles ne produisent pas d'ancre
  // d'article. On les écarte ici du même compte, sans quoi le total est faux de 71.
  const auToc = new Set(toc.map((e) => e.label))
  const divisions = toc.filter((e) => e.kind === 'code')
  const ancresCorps = L.map((l) => l.trim()).filter((l) => !auToc.has(l)).map((l) => articleAnchorFromHeading(l)).filter(Boolean) as string[]
  const simples = ancresCorps.filter((a) => !/^art-3\d{3,4}-/.test(a))

  console.log('DÉCRET DU 19 AOÛT 2020 RÉGISSANT L’INSOLVABILITÉ\n')
  console.log(`   corps ${(corps.length / 1000).toFixed(0)} Kc · ${arts.length} articles du Livre III · ${ancresCorps.length} ancres au total`)
  console.log(`   art-33410-1 : ${ancresCorps.includes('art-33410-1') ? '✔' : '⛔ PERDU'}`)
  console.log(`   ancres hors série 3xxx- : ${simples.length} → ${[...new Set(simples)].slice(0, 12).join(', ')}`)
  console.log(`   sommaire ${divisions.length} divisions du dispositif · ${toc.length - divisions.length} lignes de plan neutralisées · navigation ${navToc.length} groupes / ${navToc.reduce((a, g) => a + g.children.length + g.children.reduce((b, c: any) => b + (c.children?.length ?? 0), 0), 0)} enfants`)
  console.log(`   index ${entries.length} entrées · ${entries.reduce((a, e) => a + e.ctRefs.length, 0)} renvois retenus`)
  console.log(`\n   ⚠ renvois bornés (article inexistant) : ${morts}`)
  for (const b of bornes) console.log(`      ${b}`)
  console.log(`\n   ⚠ à signaler :`)
  for (const r of rapport) console.log(`      ${r}`)

  const existe = await prisma.document.findFirst({ where: { source: SOURCE }, select: { id: true } })
  console.log(`\n   fiche déjà en base : ${existe ? '⛔ OUI — le script ne réécrit pas' : 'non ✔'}`)
  if (!apply) { console.log('\n(simulation — ajouter --apply pour écrire)'); await prisma.$disconnect(); return }
  if (existe) { console.error('⛔ ARRÊT — la fiche existe déjà.'); process.exit(1) }

  const annotations = JSON.stringify({ title: TITRE, toc, navToc, labels, indexEntries: entries })
  const doc = await prisma.document.create({
    data: {
      type: 'LEGISLATION', status: 'EN_VIGUEUR', source: SOURCE,
      titleFr: TITRE, number: TITRE, originalLang: 'fr',
      adoptionDate: new Date('2020-08-19'), publicationDate: new Date('2021-05-11'), moniteurRef: REF,
      bodyOriginal: corps, annotationsJson: annotations,
      searchText: [buildSearchText({ titleFr: TITRE, number: TITRE, moniteurRef: REF }), fold(corps)].join(' '),
    },
  })
  await audit({ action: 'DOC_PUBLISHED', targetType: 'DOCUMENT', targetId: doc.id, meta: { via: 'importer-decret-insolvabilite', articles: arts.length } })
  console.log(`\n✅ fiche créée — ${doc.id}`)
  await prisma.$disconnect()
}

main()
