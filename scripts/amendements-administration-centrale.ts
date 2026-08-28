/**
 * Porte au Décret du 17 mai 2005 les quinze interventions du Décret du 6 janvier 2016.
 *
 *   npx tsx scripts/amendements-administration-centrale.ts [--commit]
 *
 * SIX articles réécrits · QUATRE ajoutés · CINQ abrogés. Relevé deux fois — dans le
 * dispositif ET dans le sommaire fourni par la rédaction — les deux relevés concordent.
 *
 * ⚠️ UN ARTICLE AJOUTÉ NE PEUT PAS ÊTRE UN OVERLAY. `applyAmendments` REMPLACE le segment
 * d'une ancre existante ; il n'insère rien. Les articles 23.1, 23.2, 23.3 et 29.2 n'existent
 * pas dans le texte de 2005 : posés en `ArticleVersion`, ils ne s'afficheraient nulle part,
 * en silence. Ils entrent donc dans le CORPS, à leur rang, marqués de leur source — comme
 * les 57 articles neufs que le décret des sûretés a insérés au Code civil.
 *
 * ⚠️ ET 29.1 EXISTE DÉJÀ dans le texte de 2005 : le 29.2 s'y enchaîne, il ne le remplace pas.
 */
import { PrismaClient } from '@prisma/client'
import { buildSearchText, fold } from '../src/lib/search/normalize'
import { articleAnchorFromHeading } from '../src/lib/doc/anchors'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const TETE = /^Article\s+(\d+(?:er)?(?:[.-]\d+)?)\s*\.?\s*[—–-]/
const ancre = (n: string) => articleAnchorFromHeading(`Article ${n}.- x`) ?? `art-${n}`

const REECRITS = ['23', '64', '71', '72', '108', '113']
const AJOUTES = [
  { num: '23.1', apres: '23' },
  { num: '23.2', apres: '23.1' },
  { num: '23.3', apres: '23.2' },
  { num: '29.2', apres: '29.1' },
]
const ABROGES = ['110', '111', '112', '114', '115']

/** Le bloc d'un article dans un corps, de sa tête à la tête suivante. */
function bloc(body: string, num: string): { d: number; f: number; texte: string } | null {
  const L = body.split('\n')
  const d = L.findIndex((l) => TETE.exec(l.trim())?.[1] === num)
  if (d < 0) return null
  let f = L.length
  for (let i = d + 1; i < L.length; i++) if (TETE.test(L[i].trim())) { f = i; break }
  return { d, f, texte: L.slice(d, f).join('\n').trim() }
}

/**
 * La rédaction que donne le décret de 2016 pour un article.
 *
 * ⚠️ ELLE PORTE DÉJÀ SA PROPRE TÊTE — « Article 23.- Le Secrétariat Général… » — entre
 * guillemets, après une ligne d'instruction. On retire les guillemets et l'on garde la tête :
 * `applyAmendments` reconnaît un corps qui commence par « Article » et n'en rajoute pas.
 */
function redaction(body2016: string, num: string): string | null {
  const L = body2016.split('\n')
  const i = L.findIndex((l) =>
    new RegExp(`^(L[’']article ${num.replace('.', '\\.')} se lit|Il est ajouté un article ${num.replace('.', '\\.')} )`).test(l.trim()),
  )
  if (i < 0) return null
  const out: string[] = []
  for (let k = i + 1; k < L.length; k++) {
    const l = L[k].trim()
    if (/^(L[’']article \d|Il est ajouté un article|Les articles \d|Article \d+\.-\s*Le présent)/.test(l)) break
    out.push(L[k])
  }
  const t = out.join('\n').trim().replace(/^«\s*/, '').replace(/\s*»\s*$/, '').trim()
  return t || null
}

async function main() {
  const commit = process.argv.includes('--commit')
  const d2005 = await prisma.document.findFirst({ where: { source: 'DECRET_ADMIN_CENTRALE_2005' } })
  const d2016 = await prisma.document.findFirst({ where: { source: 'DECRET_ADMIN_CENTRALE_AMEND_2016' } })
  if (!d2005 || !d2016) { console.error('⛔ ARRÊT — textes absents.'); process.exit(1) }
  const body2016 = d2016.bodyOriginal ?? ''
  let corps = d2005.bodyOriginal ?? ''

  console.log('DÉCRET DU 6 JANVIER 2016 — quinze interventions\n')

  // ── 1. Les AJOUTS entrent dans le corps, à leur rang ─────────────────────────────────
  const inseres: string[] = []
  for (const a of AJOUTES) {
    if (bloc(corps, a.num)) { console.log(`   = art. ${a.num} déjà présent`); continue }
    const t = redaction(body2016, a.num)
    const ancrage = bloc(corps, a.apres)
    if (!t || !ancrage) { console.log(`   ⚠ art. ${a.num} : ${!t ? 'rédaction' : 'point d’insertion'} introuvable`); continue }
    const L = corps.split('\n')
    L.splice(ancrage.f, 0, `Article ${a.num}.- (D. du 6 janvier 2016) ${t.replace(new RegExp(`^Article\\s+${a.num.replace('.', '\\.')}\\s*\\.?-\\s*`), '')}`)
    corps = L.join('\n')
    inseres.push(a.num)
    console.log(`   + art. ${a.num.padEnd(5)} inséré après l’article ${a.apres}`)
  }

  // ── 2. Les RÉÉCRITURES et les ABROGATIONS sont des overlays ──────────────────────────
  const versions: { documentId: string; anchor: string; status: string; body: string; note: string }[] = []
  for (const n of REECRITS) {
    const ancien = bloc(corps, n)
    const neuf = redaction(body2016, n)
    if (!ancien || !neuf) { console.log(`   ⚠ art. ${n} : introuvable`); continue }
    versions.push({ documentId: d2005.id, anchor: ancre(n), status: 'MODIFIE', body: ancien.texte,
      note: "Rédaction d'origine du 17 mai 2005, remplacée par le Décret du 6 janvier 2016." })
    versions.push({ documentId: d2005.id, anchor: ancre(n), status: 'EN_VIGUEUR', body: neuf,
      note: "Rédaction issue du Décret du 6 janvier 2016 portant amendement du Décret du 17 mai 2005." })
    console.log(`   ~ art. ${n.padEnd(5)} réécrit`)
  }
  for (const n of ABROGES) {
    const a = bloc(corps, n)
    if (!a) { console.log(`   ⚠ art. ${n} : introuvable`); continue }
    versions.push({ documentId: d2005.id, anchor: ancre(n), status: 'ABROGE', body: a.texte,
      note: "Abrogé par l'article 2 du Décret du 6 janvier 2016, qui le nomme." })
    console.log(`   ✗ art. ${n.padEnd(5)} abrogé`)
  }

  console.log(`\n   ${inseres.length} insérés · ${versions.filter((v) => v.status === 'MODIFIE').length} réécrits · ${versions.filter((v) => v.status === 'ABROGE').length} abrogés`)
  const apres = corps.split('\n').filter((l) => TETE.test(l.trim())).length
  console.log(`   articles du corps : ${(d2005.bodyOriginal ?? '').split('\n').filter((l) => TETE.test(l.trim())).length} → ${apres}`)

  if (!commit) { console.log('\n(à blanc — ajouter --commit pour écrire)'); await prisma.$disconnect(); return }
  if (await prisma.articleVersion.count({ where: { documentId: d2005.id } })) {
    console.error('\n⛔ ARRÊT — des versions existent déjà.'); process.exit(1)
  }
  await prisma.document.update({
    where: { id: d2005.id },
    data: {
      bodyOriginal: corps,
      searchText: [buildSearchText({ titleFr: d2005.titleFr, number: d2005.number, moniteurRef: d2005.moniteurRef }), fold(corps)].filter(Boolean).join(' '),
    },
  })
  for (const v of versions) await prisma.articleVersion.create({ data: v })
  await prisma.crossRef.createMany({ data: [
    { fromId: d2016.id, toId: d2005.id, toLabel: d2005.titleFr, kind: 'MODIFIE', source: 'EDITORIAL', position: 0,
      note: "Réécrit les articles 23, 64, 71, 72, 108 et 113 ; ajoute les articles 23.1, 23.2, 23.3 et 29.2 ; abroge les articles 110 à 112 et 114 à 115." },
    { fromId: d2005.id, toId: d2016.id, toLabel: d2016.titleFr, kind: 'VOIR', source: 'EDITORIAL', position: 0,
      note: 'Amendé par le Décret du 6 janvier 2016.' },
  ] })
  await audit({ action: 'DOC_PUBLISHED', targetType: 'DOCUMENT', meta: { via: 'amendements-administration-centrale', inseres: inseres.length, versions: versions.length } })
  console.log(`\n✅ ${inseres.length} articles insérés, ${versions.length} versions, 2 renvois.`)
  await prisma.$disconnect()
}

main()
