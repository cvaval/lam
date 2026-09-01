/**
 * Verse les deux lois sur la Taxe sur le Chiffre d'Affaires.
 *
 *   npx tsx scripts/importer-tca.ts [--apply]
 *
 * ⚠️ LA LOI DE 2002 N'EST PAS UN AMENDEMENT, C'EST UNE REFONTE — 45 articles, 11 chapitres,
 * qui redisent la matière entière. Son article 45 est une CLAUSE-BALAI (« toutes lois… qui
 * lui sont contraires ») : elle ne nomme personne, donc AUCUN renvoi ABROGE ne se pose de ce
 * chef. Quatre renvois de ce type ont été retirés du corpus le 30 août parce que le rendu
 * public affiche « ABROGE → … · cible non importée » sans jamais lire la note.
 *
 * ⚠️ ET LA DATE D'UNE LOI EST CELLE DE SON DERNIER VOTE. Sénat le 30 octobre 2002, Chambre
 * des Députés le 13 DÉCEMBRE 2002, promulgation le 24 février 2003, publication le 10 mars
 * 2003. `adoptionDate` = le vote de la Chambre ; la promulgation ne compte pas.
 *
 * ⚠️ DEUX FASCICULES « n° 19 » — 6 mars 1995 et 10 mars 2003 — et tous deux portent une loi
 * sur la TCA. `moniteurRef` doit porter l'année.
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { articleAnchorFromHeading, anchorFromDesignation } from '../src/lib/doc/anchors'
import { buildSearchText, fold } from '../src/lib/search/normalize'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const DATA = 'scripts/data/tca-2002'
const THEME = 'fiscalite'
const ACTE_2005 = { label: 'D. 23 novembre 2005 — TCA', href: '' }

const CHAP = /^Chapitre\s+([IVX]+)\s*:/
const TETE = /^Article\s+(\d+(?:er)?)\s*(\([^)]{0,70}\))?\s*[:.\-–—]/i

const FICHES = [
  {
    source: 'LOI_TCA_2002',
    titre: 'Loi du 13 décembre 2002 modifiant la Loi du 19 septembre 1982 relative à la Taxe sur le Chiffre d’Affaires (TCA)',
    fichier: 'corps-loi-2002.txt',
    adoption: '2002-12-13',
    publication: '2003-03-10',
    ref: 'Le Moniteur · LM2003-19 · n° 19 du lundi 10 mars 2003',
    articles: 45,
  },
  {
    source: 'LOI_TCA_1995',
    titre: 'Loi du 17 janvier 1995 portant modifications de la Taxe sur le Chiffre d’Affaires (TCA)',
    fichier: 'corps-loi-1995.txt',
    adoption: '1995-01-17',
    publication: '1995-03-06',
    ref: 'Le Moniteur · LM1995-19 · n° 19 du lundi 6 mars 1995',
    articles: 4,
  },
]

/** Index de la cliente : « Terme » puis « art. N » à la ligne SUIVANTE. */
function lireIndex(): { subject: string; ctRefs: string[] }[] {
  const L = readFileSync(`${DATA}/index-client.txt`, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)
  const out: { subject: string; ctRefs: string[] }[] = []
  for (let i = 0; i < L.length; i++) {
    const l = L[i]
    if (/^[A-ZÀÉÈ]$/.test(l) || /^(RÉPUBLIQUE|LOI DU|modifiant|à la Taxe|Le Moniteur|INDEX|Les renvois)/.test(l)) continue
    const suiv = L[i + 1] ?? ''
    const m = /^art\.\s*(.+)$/i.exec(suiv)
    if (!m) continue
    // ⚠️ « art. 12 à 18 » : l'intervalle se déplie, sinon la moitié des renvois se perd.
    const refs: string[] = []
    for (const seg of m[1].split(/\s*[;,]\s*|\s+et\s+/)) {
      const iv = /^(\d+)\s*(?:à|–|—|-)\s*(\d+)$/.exec(seg.trim())
      if (iv) for (let n = +iv[1]; n <= +iv[2]; n++) refs.push(String(n))
      else { const u = /\d+/.exec(seg); if (u) refs.push(u[0]) }
    }
    if (refs.length) { out.push({ subject: l, ctRefs: refs }); i++ }
  }
  return out
}

async function main() {
  const apply = process.argv.includes('--apply')
  const loi1982 = await prisma.document.findFirst({ where: { source: 'CC_VANDAL_VII-F-1' }, select: { id: true, titleFr: true } })
  const theme = await prisma.theme.findFirst({ where: { slug: THEME }, select: { id: true } })
  if (!loi1982 || !theme) { console.error('⛔ ARRÊT — loi de 1982 ou thème absent.'); process.exit(1) }

  console.log('TAXE SUR LE CHIFFRE D’AFFAIRES\n')
  const prepare = FICHES.map((f) => {
    const corps = readFileSync(`${DATA}/${f.fichier}`, 'utf8')
    const L = corps.split('\n')
    const toc: { level: number; label: string; anchor: string; kind: string }[] = []
    const labels: Record<string, string> = {}
    const statut: Record<string, string> = {}
    const actes: Record<string, { label: string; href: string }> = {}
    let n = 0
    for (const raw of L) {
      const l = raw.trim()
      if (CHAP.test(l)) { toc.push({ level: 3, label: l, anchor: `sec-${++n}`, kind: 'chapitre' }); continue }
      const m = TETE.exec(l)
      if (!m) continue
      const a = anchorFromDesignation(m[1])!
      labels[a] = `Article ${m[1] === '1er' ? '1er' : m[1]}`
      // ⚠️ LA VERSION FOURNIE EST CONSOLIDÉE : les articles 34 à 36 portent la rédaction du
      // Décret du 23 novembre 2005, pas celle de 2002. La pastille le dit ET NOMME L'ACTE.
      // La rédaction de 2002 n'est PAS fournie : rien à replier — la note le dit aussi.
      if (m[2] && /23 novembre 2005/.test(m[2])) { statut[a] = 'modifié'; actes[a] = ACTE_2005 }
    }
    const ancres = L.map((l) => articleAnchorFromHeading(l.trim())).filter(Boolean) as string[]
    return { ...f, corps, toc, labels, statut, actes, ancres }
  })

  const idx = lireIndex()
  const ancres2002 = new Set(prepare[0].ancres)
  const morts = idx.flatMap((e) => e.ctRefs).filter((r) => !ancres2002.has(anchorFromDesignation(r)!))

  for (const p of prepare) {
    console.log(`   ${p.source}`)
    console.log(`      ${p.ancres.length} ancres (attendu ${p.articles}) · uniques ${new Set(p.ancres).size} · ${p.toc.length} chapitres`)
    console.log(`      adoption ${p.adoption} · publication ${p.publication}`)
    console.log(`      pastilles « modifié » : ${Object.keys(p.statut).length}${Object.keys(p.statut).length ? ' → ' + Object.keys(p.statut).join(', ') : ''}`)
  }
  console.log(`\n   index : ${idx.length} entrées · ${idx.reduce((a, e) => a + e.ctRefs.length, 0)} renvois · morts ${morts.length ? '⛔ ' + [...new Set(morts)].join(', ') : 'aucun ✔'}`)
  const deja = await prisma.document.findMany({ where: { source: { in: FICHES.map((f) => f.source) } }, select: { source: true } })
  console.log(`   fiches déjà en base : ${deja.length ? '⛔ ' + deja.map((d) => d.source).join(', ') : 'aucune ✔'}`)

  if (!apply) { console.log('\n(simulation — ajouter --apply pour écrire)'); await prisma.$disconnect(); return }
  if (deja.length) { console.error('⛔ ARRÊT — fiches existantes.'); process.exit(1) }

  const crees: Record<string, string> = {}
  for (const p of prepare) {
    const ann: Record<string, unknown> = { title: p.titre, toc: p.toc, labels: p.labels, status: p.statut, statusActe: p.actes }
    if (p.source === 'LOI_TCA_2002') ann.indexEntries = idx
    const doc = await prisma.document.create({
      data: {
        type: 'LEGISLATION', status: 'EN_VIGUEUR', source: p.source,
        titleFr: p.titre, number: p.titre, originalLang: 'fr',
        adoptionDate: new Date(p.adoption), publicationDate: new Date(p.publication), moniteurRef: p.ref,
        bodyOriginal: p.corps, annotationsJson: JSON.stringify(ann),
        searchText: [buildSearchText({ titleFr: p.titre, number: p.titre, moniteurRef: p.ref }), fold(p.corps)].join(' '),
        themes: { create: [{ themeId: theme.id, isPrimary: true }] },
      },
    })
    crees[p.source] = doc.id
    console.log(`   ✔ ${p.source} — ${doc.id}`)
  }

  // ⚠️ AUCUN RENVOI TIRÉ DE LA CLAUSE-BALAI. La loi de 1982 est REFONDUE, pas nommément
  // abrogée : le lien reste un VOIR, et son statut ne change pas. C'est une décision
  // éditoriale, laissée à la cliente ; le script ne la prend pas à sa place.
  const renvois = [
    { fromId: crees.LOI_TCA_2002, toId: loi1982.id, toLabel: loi1982.titleFr, kind: 'MODIFIE', source: 'EDITORIAL', position: 0,
      note: 'Refonte intégrale de la matière : 45 articles en onze chapitres redisent la Taxe sur le Chiffre d’Affaires. L’article 45 abroge « toutes lois… contraires » sans en nommer aucune.' },
    { fromId: crees.LOI_TCA_1995, toId: loi1982.id, toLabel: loi1982.titleFr, kind: 'MODIFIE', source: 'EDITORIAL', position: 0,
      note: 'Modifie les articles 1er et 4 de la Loi du 19 septembre 1982.' },
    { fromId: crees.LOI_TCA_2002, toId: crees.LOI_TCA_1995, toLabel: FICHES[1].titre, kind: 'VOIR', source: 'EDITORIAL', position: 1,
      note: 'Texte antérieur sur la même matière, emporté par la refonte de 2002.' },
  ]
  for (const r of renvois) await prisma.crossRef.create({ data: r })
  await audit({ action: 'DOC_PUBLISHED', targetType: 'DOCUMENT', meta: { via: 'importer-tca', fiches: Object.keys(crees).length } })
  console.log(`\n✅ ${Object.keys(crees).length} fiches · ${renvois.length} renvois.`)
  await prisma.$disconnect()
}

main()
