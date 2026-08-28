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
 * en silence. Ils entrent donc dans le CORPS, à leur rang — comme les 57 articles neufs que
 * le décret des sûretés a insérés au Code civil.
 *
 * ⚠️ ET LEUR PROVENANCE NE S'ÉCRIT PAS DANS LE CORPS. La marquer « Article 23.1.- (D. du
 * 6 janvier 2016) … » prêterait au décret une mention qu'il n'imprime pas (§02). Elle est
 * portée par une ligne `AJOUTE` (addArticle) que le lecteur rend en PASTILLE, cliquable
 * vers l'acte modificatif. Les codes consolidés d'Haïti, eux, IMPRIMENT cette parenthèse —
 * Code pénal, Code d'instruction criminelle, CFPB : celles-là sont du texte officiel.
 *
 * ⚠️ ET 29.1 EXISTE DÉJÀ dans le texte de 2005 : le 29.2 s'y enchaîne, il ne le remplace pas.
 *
 * Le script est REJOUABLE : chaque écriture vérifie d'abord si elle a déjà eu lieu.
 */
import { PrismaClient } from '@prisma/client'
import { buildSearchText, fold } from '../src/lib/search/normalize'
import { articleAnchorFromHeading } from '../src/lib/doc/anchors'
import { addArticle } from '../src/lib/legislation/amendments'
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

/** Désignation courte (pastille) et marqueur qui a pu être écrit dans le corps par erreur. */
const ACTE_COURT = 'Décret du 6 janvier 2016'
const MARQUEUR = /^(Article\s+[\d.]+\s*\.?-\s*)\((?:D\.|Décret) du 6 janvier 2016\)\s*/

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

  // ── 1. Les AJOUTS entrent dans le corps, à leur rang — SANS marqueur de provenance ───
  const inseres: string[] = []
  const demarques: string[] = []
  for (const a of AJOUTES) {
    const present = bloc(corps, a.num)
    if (present) {
      // Rejeu : l'article est là. Reste à lui ôter la parenthèse de provenance si une
      // version antérieure de ce script la lui avait écrite — c'est la pastille qui la porte.
      const L = corps.split('\n')
      if (MARQUEUR.test(L[present.d].trim())) {
        L[present.d] = L[present.d].replace(MARQUEUR, '$1')
        corps = L.join('\n')
        demarques.push(a.num)
        console.log(`   ⌫ art. ${a.num.padEnd(5)} parenthèse « (D. du 6 janvier 2016) » retirée du corps`)
      } else console.log(`   = art. ${a.num} déjà présent`)
      continue
    }
    const t = redaction(body2016, a.num)
    const ancrage = bloc(corps, a.apres)
    if (!t || !ancrage) { console.log(`   ⚠ art. ${a.num} : ${!t ? 'rédaction' : 'point d’insertion'} introuvable`); continue }
    const L = corps.split('\n')
    L.splice(ancrage.f, 0, `Article ${a.num}.- ${t.replace(new RegExp(`^Article\\s+${a.num.replace('.', '\\.')}\\s*\\.?-\\s*`), '')}`)
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

  console.log(`\n   ${inseres.length} insérés · ${demarques.length} démarqués · ${versions.filter((v) => v.status === 'MODIFIE').length} réécrits · ${versions.filter((v) => v.status === 'ABROGE').length} abrogés`)
  const apres = corps.split('\n').filter((l) => TETE.test(l.trim())).length
  console.log(`   articles du corps : ${(d2005.bodyOriginal ?? '').split('\n').filter((l) => TETE.test(l.trim())).length} → ${apres}`)

  if (!commit) { console.log('\n(à blanc — ajouter --commit pour écrire)'); await prisma.$disconnect(); return }

  if (corps !== d2005.bodyOriginal) {
    await prisma.document.update({
      where: { id: d2005.id },
      data: {
        bodyOriginal: corps,
        searchText: [buildSearchText({ titleFr: d2005.titleFr, number: d2005.number, moniteurRef: d2005.moniteurRef }), fold(corps)].filter(Boolean).join(' '),
      },
    })
  }

  // Réécritures et abrogations : une seule fois, quel que soit le nombre de rejeux.
  let posees = 0
  for (const v of versions) {
    const deja = await prisma.articleVersion.count({ where: { documentId: v.documentId, anchor: v.anchor, status: v.status } })
    if (deja) continue
    await prisma.articleVersion.create({ data: v })
    posees++
  }

  // ── 3. La PASTILLE des articles ajoutés ──────────────────────────────────────────────
  // Elle nomme l'acte et y renvoie. ⚠️ Le titre COMPLET est indispensable : DEUX décrets
  // ont été signés le 6 janvier 2016 — celui-ci et celui sur l'administration électronique,
  // publiés dans deux Moniteurs consécutifs. « Décret du 6 janvier 2016 » seul ne désigne rien.
  let pastilles = 0
  for (const a of AJOUTES) {
    const b = bloc(corps, a.num)
    if (!b) continue
    const pose = await addArticle({
      documentId: d2005.id,
      anchor: ancre(a.num),
      label: `Article ${a.num}`,
      body: b.texte,
      amendedByDocId: d2016.id,
      amendedByNumber: ACTE_COURT,
      effectiveDate: d2016.publicationDate ?? null,
      note: `Article ajouté par : ${d2016.titleFr}`,
    })
    if (pose) { pastilles++; console.log(`   ● art. ${a.num.padEnd(5)} pastille « Ajout — ${ACTE_COURT} »`) }
  }

  const renvois = [
    { fromId: d2016.id, toId: d2005.id, toLabel: d2005.titleFr, kind: 'MODIFIE', source: 'EDITORIAL', position: 0,
      note: "Réécrit les articles 23, 64, 71, 72, 108 et 113 ; ajoute les articles 23.1, 23.2, 23.3 et 29.2 ; abroge les articles 110 à 112 et 114 à 115." },
    { fromId: d2005.id, toId: d2016.id, toLabel: d2016.titleFr, kind: 'VOIR', source: 'EDITORIAL', position: 0,
      note: `Amendé par : ${d2016.titleFr}` },
  ]
  let liens = 0
  for (const r of renvois) {
    if (await prisma.crossRef.count({ where: { fromId: r.fromId, toId: r.toId, kind: r.kind } })) continue
    await prisma.crossRef.create({ data: r })
    liens++
  }

  await audit({ action: 'DOC_PUBLISHED', targetType: 'DOCUMENT', meta: { via: 'amendements-administration-centrale', inseres: inseres.length, demarques: demarques.length, versions: posees, pastilles } })
  console.log(`\n✅ ${inseres.length} insérés · ${demarques.length} démarqués · ${posees} versions · ${pastilles} pastilles · ${liens} renvois.`)
  await prisma.$disconnect()
}

main()
