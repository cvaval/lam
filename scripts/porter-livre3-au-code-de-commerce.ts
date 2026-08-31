/**
 * Porte au Code de commerce la refonte de son Livre III par le Décret du 19 août 2020.
 *
 *   npx tsx scripts/porter-livre3-au-code-de-commerce.ts [--apply]
 *
 * SECOND passage — le décret doit être versé (script `importer-decret-insolvabilite.ts`).
 *
 * Trois effets, tous nommés par l'article 3 du décret ou par son article 1er :
 *   · 158 articles du Code (477 à 634) passent à `abrogé` — abrogation EXPRESSE ;
 *   · 297 articles neufs entrent au Livre III, pastille `nouveau` NOMMANT le décret ;
 *   · la Loi du 21 avril 1940 passe à `partiellement abrogé` sur ses articles 1 à 3.
 *
 * ⚠️ L'ARTICLE 600 CHANGE DE CAMP. Il porte aujourd'hui `modifié` — du Décret du 9 avril 2020
 * réformant le Droit des Sûretés. Le décret d'insolvabilité est SIGNÉ QUATRE MOIS PLUS TARD
 * (19 août 2020) et l'abroge nommément. L'abrogation l'emporte ; mais sa rédaction antérieure
 * (`oldVersions`) et sa trace d'amendement (`ArticleVersion`) restent — un article abrogé
 * garde son histoire, il cesse seulement de s'annoncer comme modifié.
 *
 * ⚠️ ET L'ABROGATION DE LA LOI DE 1940 EST PARTIELLE. Le décret n'abroge pas la loi : il
 * abroge « les dispositions faisant du Directeur Général des Contributions le syndic
 * provisoire ou définitif de faillite ». La loi lui confie QUATRE fonctions ; une seule tombe.
 * Ses articles 1, 2 et 3 nomment le syndic ; les articles 4 à 6 ne le nomment pas.
 *
 * ⚠️ UN ARTICLE ABROGÉ N'EST PAS UN ARTICLE MORT. L'article 2 du décret laisse les procédures
 * collectives ouvertes AVANT son entrée en vigueur sous l'empire des articles 477 à 634. La
 * note de tête du Livre III le dit — sans quoi le lecteur croirait le régime éteint.
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { articleAnchorFromHeading } from '../src/lib/doc/anchors'
import { buildSearchText, fold } from '../src/lib/search/normalize'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const ACTE_COURT = 'D. 19 août 2020 — insolvabilité'
const ART = /^Article\s+(\d{3,5}-\d+)\.-/

async function main() {
  const apply = process.argv.includes('--apply')
  const cc = await prisma.document.findFirst({ where: { source: 'CODE_COMMERCE_ANNOTE' } })
  const dec = await prisma.document.findFirst({ where: { source: 'DECRET_INSOLVABILITE_2020' } })
  const loi1940 = await prisma.document.findFirst({ where: { source: 'CPC_APPENDICE_IV_16_1' } })
  if (!cc || !dec || !loi1940) { console.error('⛔ ARRÊT — Code de commerce, décret ou Loi de 1940 absent.'); process.exit(1) }

  const ann = JSON.parse(String(cc.annotationsJson ?? '{}'))
  const statut: Record<string, string> = { ...(ann.status ?? {}) }
  const labels: Record<string, string> = { ...(ann.labels ?? {}) }
  const actes: Record<string, { label: string; href: string }> = { ...(ann.statusActe ?? {}) }
  const avant = { abroge: 0, modifie: 0, nouveau: 0 }
  for (const v of Object.values(statut)) { if (v === 'abrogé') avant.abroge++; if (v === 'modifié') avant.modifie++; if (v === 'nouveau') avant.nouveau++ }

  const L = (cc.bodyOriginal ?? '').split('\n')
  const href = `/fr/doc/${dec.id}`

  // ── 1. Les 158 articles abrogés ──────────────────────────────────────────────────────────
  const abroges: string[] = []
  for (const l of L) {
    const a = articleAnchorFromHeading(l.trim())
    if (!a) continue
    const n = Number(a.replace('art-', ''))
    if (!Number.isInteger(n) || n < 477 || n > 634 || abroges.includes(a)) continue
    abroges.push(a)
  }
  const etait600 = statut['art-600']
  for (const a of abroges) { statut[a] = 'abrogé'; actes[a] = { label: ACTE_COURT, href } }

  // ── 2. Les 297 articles neufs, insérés après l'article 634 ───────────────────────────────
  const corpsDec = readFileSync('scripts/data/insolvabilite-2020/corps-decret.txt', 'utf8').split('\n')
  const d0 = corpsDec.findIndex((l) => l.trim().startsWith('LIVRE III'))
  const nouveau = corpsDec.slice(d0).map((l) => l.trim()).filter(Boolean)
  const neufs: string[] = []
  for (const l of nouveau) {
    const m = ART.exec(l)
    if (!m) continue
    const a = articleAnchorFromHeading(l)!
    if (statut[a]) { console.log(`   ⚠ ${a} porte déjà « ${statut[a]} » — non touché`); continue }
    neufs.push(a); statut[a] = 'nouveau'; labels[a] = `Article ${m[1]}`; actes[a] = { label: ACTE_COURT, href }
  }

  const i634 = L.findIndex((l) => articleAnchorFromHeading(l.trim()) === 'art-634')
  let fin = i634 + 1
  while (fin < L.length && !/^Livre\s+Quatri/i.test(L[fin].trim())) fin++
  const bandeau = [
    '',
    'Livre Troisième — De l’Insolvabilité (rédaction du Décret du 19 août 2020)',
    'Le Décret du 19 août 2020 régissant l’insolvabilité (Le Moniteur, 176ᵉ année, Spécial n° 24 du ' +
      '11 mai 2021) a renommé le présent Livre et en a édicté les 297 articles ci-après. Il abroge ' +
      'expressément les articles 477 à 634 qui précèdent ; ceux-ci demeurent toutefois applicables aux ' +
      'procédures collectives ouvertes avant son entrée en vigueur (article 2 du Décret).',
    '',
  ]
  const corps = [...L.slice(0, fin), ...bandeau, ...nouveau.filter((l) => !/^LIVRE III$|^DE L’INSOLVABILITÉ$/.test(l)), '', ...L.slice(fin)].join('\n')

  // ── 3. La Loi du 21 avril 1940 — abrogation PARTIELLE ────────────────────────────────────
  const ann40 = JSON.parse(String(loi1940.annotationsJson ?? '{}'))
  const st40: Record<string, string> = { ...(ann40.status ?? {}) }
  const act40: Record<string, { label: string; href: string }> = { ...(ann40.statusActe ?? {}) }
  const vises = ['art-1', 'art-2', 'art-3']
  const avant40 = vises.map((a) => `${a}:${st40[a] ?? '—'}`).join(' · ')
  for (const a of vises) { st40[a] = 'partiellement abrogé'; act40[a] = { label: ACTE_COURT, href } }

  console.log('LIVRE III DU CODE DE COMMERCE — REFONTE DE 2020\n')
  console.log(`   abrogés  : ${abroges.length} (attendu 158) · art-600 « ${etait600 ?? '—'} » → « abrogé »`)
  console.log(`   nouveaux : ${neufs.length} (attendu 297) · insérés après l’article 634, ligne ${fin}`)
  console.log(`   Loi 1940 : ${avant40}  →  partiellement abrogé ×3`)
  console.log(`\n   status du Code : abrogé ${avant.abroge} → ${avant.abroge + abroges.length - (etait600 === 'abrogé' ? 1 : 0)}` +
    ` · modifié ${avant.modifie} → ${avant.modifie - (etait600 === 'modifié' ? 1 : 0)}` +
    ` · nouveau ${avant.nouveau} → ${avant.nouveau + neufs.length}`)
  console.log(`   corps ${(cc.bodyOriginal ?? '').length / 1000 | 0} Kc → ${corps.length / 1000 | 0} Kc`)
  console.log(`   oldVersions du Code : ${Object.keys(ann.oldVersions ?? {}).length} (inchangé)`)

  if (!apply) { console.log('\n(simulation — ajouter --apply pour écrire)'); await prisma.$disconnect(); return }

  await prisma.document.update({
    where: { id: cc.id },
    data: {
      bodyOriginal: corps,
      annotationsJson: JSON.stringify({ ...ann, status: statut, labels, statusActe: actes }),
      searchText: [buildSearchText({ titleFr: cc.titleFr, number: cc.number, moniteurRef: cc.moniteurRef }), fold(corps)].filter(Boolean).join(' '),
    },
  })
  await prisma.document.update({
    where: { id: loi1940.id },
    data: { annotationsJson: JSON.stringify({ ...ann40, status: st40, statusActe: act40 }) },
  })
  const renvois = [
    { fromId: dec.id, toId: cc.id, toLabel: cc.titleFr, kind: 'MODIFIE', source: 'EDITORIAL', position: 0,
      note: 'Le Livre III du Code de Commerce est désormais intitulé « De l’Insolvabilité » et comprend les 297 articles édictés par l’article 1er du Décret.' },
    { fromId: dec.id, toId: cc.id, toLabel: `${cc.titleFr} — articles 477 à 634`, kind: 'ABROGE', source: 'EDITORIAL', position: 1,
      note: 'Abrogation expresse par l’article 3 du Décret. Ces articles demeurent applicables aux procédures collectives ouvertes avant son entrée en vigueur (article 2).' },
    { fromId: dec.id, toId: loi1940.id, toLabel: loi1940.titleFr, kind: 'ABROGE', source: 'EDITORIAL', position: 2,
      note: 'Abrogation PARTIELLE : seules tombent les dispositions faisant du Directeur Général des Contributions le syndic provisoire ou définitif de faillite. Les fonctions d’administrateur des biens d’absents ou d’interdits, des biens de communauté en instance de partage et de séquestre judiciaire subsistent.' },
  ]
  let liens = 0
  for (const r of renvois) {
    if (await prisma.crossRef.count({ where: { fromId: r.fromId, toId: r.toId, kind: r.kind } })) continue
    await prisma.crossRef.create({ data: r }); liens++
  }
  await audit({ action: 'DOC_PUBLISHED', targetType: 'DOCUMENT', targetId: cc.id, meta: { via: 'porter-livre3-au-code-de-commerce', abroges: abroges.length, neufs: neufs.length, liens } })
  console.log(`\n✅ ${abroges.length} abrogés · ${neufs.length} nouveaux · Loi 1940 partiellement abrogée · ${liens} renvois.`)
  await prisma.$disconnect()
}

main()
