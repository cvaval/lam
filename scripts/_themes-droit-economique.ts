/**
 * Sous-thèmes de « Droit économique & des affaires » + recoupements d'arbre — PHASE 1
 * (docs/prompt-sous-themes-droit-economique.md, décisions cliente du 28 juil. 2026).
 *
 * - Crée 6 sous-thèmes sous `economique` (sociétés anonymes, code de commerce &
 *   statut du commerçant, ports & maritime, transport aérien, assurances, fiscalité)
 *   et `arbitrage` sous `droit-prive` (« la section droit civil », décision cliente) ;
 * - renomme `droit-bancaire` → « Banques & institutions financières » ;
 * - classe ~100 textes par COPIE (`DocumentTheme.isPrimary=false` — règle cliente :
 *   reclasser = copier, jamais déplacer ; le thème principal reste inchangé), y compris
 *   les recoupements vers les thèmes existants d'autres branches (fiscalité DGI, douane,
 *   transports, tourisme, agriculture, santé publique, commerce & industrie, PI) ;
 * - réindexe chaque document touché (libellés de thèmes dénormalisés dans la recherche).
 *
 * Idempotent : rejouer = zéro changement. Aucune suppression, aucun corps modifié (§02).
 *   npx tsx scripts/_themes-droit-economique.ts
 */
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'

// ── Thèmes à créer : [slug, parentSlug, labelFr, labelEn, labelHt] ────────────────
const NEW_THEMES: [string, string, string, string, string][] = [
  ['societes-anonymes', 'economique', 'Sociétés anonymes', 'Corporations (sociétés anonymes)', 'Sosyete anonim'],
  ['code-de-commerce', 'economique', 'Code de commerce & statut du commerçant', 'Commercial code & trader status', 'Kòd komès & estati komèsan'],
  ['droit-maritime', 'economique', 'Ports & droit maritime', 'Ports & maritime law', 'Pò & dwa maritim'],
  ['transport-aerien', 'economique', 'Transport aérien', 'Air transport', 'Transpò ayeryen'],
  ['assurances', 'economique', 'Assurances', 'Insurance', 'Asirans'],
  ['fiscalite', 'economique', 'Fiscalité', 'Taxation', 'Fiskalite'],
  ['arbitrage', 'droit-prive', 'Arbitrage & règlement des différends', 'Arbitration & dispute resolution', 'Abitraj & regleman dezakò'],
  // Décision cliente 28 juil. (2ᵉ vague) : « Profession de commerçant » (et non
  // « Professions réglementées du commerce »), ENFANT de code-de-commerce.
  ['profession-de-commercant', 'code-de-commerce', 'Profession de commerçant', 'The trader profession', 'Pwofesyon komèsan'],
]

// ── Renommage décidé (défaut accepté) ────────────────────────────────────────────
const RENAME = {
  slug: 'droit-bancaire',
  labelFr: 'Banques & institutions financières',
  labelEn: 'Banks & financial institutions',
  labelHt: 'Bank & enstitisyon finansye',
}

// ── Affectations par COPIE : slug de thème → sources de documents ────────────────
const V = (s: string) => `CC_VANDAL_${s}`
const ASSIGN: Record<string, string[]> = {
  'societes-anonymes': ['IV-A-1', 'IV-A-2', 'IV-A-3', 'IV-A-4', 'IV-A-5', 'IV-A-6', 'IV-B', 'IV-C'].map(V),
  'code-de-commerce': ['CODE_COMMERCE_ANNOTE', 'LOI_STATUT_COMMERCANT_2018', V('I-A'), V('I-G')],
  'droit-maritime': ['V-A-1', 'V-A-2', 'V-B-1', 'V-C', 'V-D-1', 'V-E', 'V-F', 'V-H', 'V-I', 'V-J', 'I-C-1'].map(V),
  // I-B-1/I-B-2 (agents de change et courtiers) : décision cliente 28 juil. (3ᵉ vague)
  // — ils relèvent de la section bancaire, pas de la profession de commerçant.
  'droit-bancaire': ['II-A', 'II-B-1', 'II-B-2', 'II-B-3', 'II-B-4', 'II-C', 'II-D', 'II-E', 'II-F', 'II-G', 'II-H-1', 'II-H-2', 'II-I-1', 'II-J', 'II-K', 'II-L-1', 'II-L-2', 'II-M', 'I-B-1', 'I-B-2'].map(V),
  fiscalite: ['VII-A-1', 'VII-A-2', 'VII-A-3', 'VII-B-1', 'VII-B-2', 'VII-C', 'VII-D-1', 'VII-D-2', 'VII-D-3', 'VII-D-4', 'VII-E', 'VII-F-1'].map(V),
  'propriete-intellectuelle': ['III-A', 'III-B-1', 'III-B-2', 'III-B-3', 'III-B-4', 'III-C'].map(V),
  arbitrage: ['I-D-1', 'I-D-2', 'I-Annexe-I', 'I-Annexe-II'].map(V),
  // Noyau strict (3ᵉ vague) : agents de change → bancaire, agents maritimes → maritime
  // (déjà classé), commissionnaire en douane → douane (déjà classé).
  'profession-de-commercant': ['LOI_STATUT_COMMERCANT_2018', V('I-G'), V('I-A')],
  'transport-aerien': ['VI-A', 'VI-B', 'VI-C', 'VI-D-1', 'VI-D-2', 'VI-E', 'VI-F'].map(V),
  assurances: ['IV-D-1', 'IV-D-2'].map(V),
  // Recoupements — thèmes existants d'autres branches (mêmes textes, autre foyer).
  'fiscalite-impots': ['VII-A-1', 'VII-A-2', 'VII-A-3', 'VII-B-1', 'VII-B-2', 'VII-C', 'VII-D-1', 'VII-D-2', 'VII-D-3', 'VII-D-4', 'VII-E', 'VII-F-1'].map(V),
  douane: ['I-J', 'VII-D-3'].map(V),
  'travaux-publics-transports': ['V-A-1', 'V-A-2', 'V-B-1', 'V-C', 'V-D-1', 'V-E', 'V-F', 'V-H', 'V-I', 'V-J', 'I-C-1', 'VI-A', 'VI-B', 'VI-C', 'VI-D-1', 'VI-D-2', 'VI-E', 'VI-F'].map(V),
  tourisme: ['I-O'].map(V),
  'agriculture-rural': ['II-F'].map(V),
  'sante-publique': ['I-R-1', 'I-R-2', 'I-R-3'].map(V),
  'commerce-industrie': ['I-E', 'I-F-1', 'I-F-2', 'I-H-1', 'I-H-2', 'I-K', 'I-P-1', 'I-P-2', 'I-Q-1', 'I-Q-2', 'I-Q-3', 'I-Q-4', 'II-D'].map(V),
}

// ── Déclassements EXPLICITES (consigne cliente — seule exception à copier-sans-retirer) :
// ces affectations, créées par la 2ᵉ vague, sont RETIRÉES du thème (le document reste
// dans tous ses autres thèmes ; aucun document n'est supprimé).
const REMOVE: Record<string, string[]> = {
  'profession-de-commercant': ['I-B-1', 'I-B-2', 'I-C-1', 'I-J'].map(V),
}

async function main() {
  // ── 0. Bilan AVANT (garde-fou : droit-commercial ne doit jamais bouger) ─────────
  const dcBefore = await prisma.documentTheme.count({ where: { theme: { slug: 'droit-commercial' } } })
  console.log(`droit-commercial avant : ${dcBefore} docs`)

  // ── 1. Résolution de TOUTES les sources (échec si une manque ou est ambiguë) ────
  const wanted = [...new Set(Object.values(ASSIGN).flat())]
  const docs = await prisma.document.findMany({ where: { source: { in: wanted } }, select: { id: true, source: true } })
  const bySource = new Map<string, string[]>()
  for (const d of docs) {
    const arr = bySource.get(d.source!) ?? []
    arr.push(d.id)
    bySource.set(d.source!, arr)
  }
  const missing = wanted.filter((s) => !bySource.has(s))
  const dupes = [...bySource.entries()].filter(([, ids]) => ids.length > 1)
  if (missing.length) throw new Error(`sources introuvables : ${missing.join(', ')} — annulé`)
  if (dupes.length) throw new Error(`sources ambiguës (${dupes.map(([s, i]) => `${s}×${i.length}`).join(', ')}) — annulé`)
  console.log(`✓ ${wanted.length} sources résolues, uniques`)

  // ── 2. Création des thèmes manquants ────────────────────────────────────────────
  for (const [slug, parentSlug, labelFr, labelEn, labelHt] of NEW_THEMES) {
    if (await prisma.theme.findFirst({ where: { slug } })) {
      console.log(`  thème existant : ${slug}`)
      continue
    }
    const parent = await prisma.theme.findFirst({ where: { slug: parentSlug } })
    if (!parent) throw new Error(`parent ${parentSlug} introuvable — annulé`)
    const maxPos = await prisma.theme.aggregate({ where: { parentId: parent.id }, _max: { position: true } })
    await prisma.theme.create({
      data: { slug, parentId: parent.id, position: (maxPos._max.position ?? 0) + 1, labelFr, labelEn, labelHt },
    })
    console.log(`✓ thème créé : ${parentSlug} → ${labelFr} (${slug})`)
  }

  // ── 3. Renommage de droit-bancaire (idempotent) ────────────────────────────────
  const bank = await prisma.theme.findFirst({ where: { slug: RENAME.slug } })
  if (!bank) throw new Error('droit-bancaire introuvable — annulé')
  if (bank.labelFr !== RENAME.labelFr) {
    await prisma.theme.update({ where: { id: bank.id }, data: { labelFr: RENAME.labelFr, labelEn: RENAME.labelEn, labelHt: RENAME.labelHt } })
    console.log(`✓ renommé : « ${bank.labelFr} » → « ${RENAME.labelFr} »`)
  } else console.log('  renommage déjà appliqué')

  // ── 4. Affectations par copie (isPrimary=false, jamais de déplacement) ─────────
  const touched = new Set<string>()
  let created = 0
  let skipped = 0
  for (const [slug, sources] of Object.entries(ASSIGN)) {
    const theme = await prisma.theme.findFirst({ where: { slug } })
    if (!theme) throw new Error(`thème ${slug} introuvable — annulé`)
    for (const src of sources) {
      const docId = bySource.get(src)![0]
      const existing = await prisma.documentTheme.findFirst({ where: { documentId: docId, themeId: theme.id } })
      if (existing) {
        skipped++
        continue
      }
      await prisma.documentTheme.create({ data: { documentId: docId, themeId: theme.id, isPrimary: false, assignedBy: 'IMPORT' } })
      touched.add(docId)
      created++
    }
  }
  console.log(`✓ affectations : ${created} créées · ${skipped} déjà en place`)

  // ── 4 bis. Déclassements explicites (consigne cliente) ────────────────────────
  let removed = 0
  for (const [slug, sources] of Object.entries(REMOVE)) {
    const theme = await prisma.theme.findFirst({ where: { slug } })
    if (!theme) throw new Error(`thème ${slug} introuvable — annulé`)
    for (const src of sources) {
      const docId = bySource.get(src)?.[0]
      if (!docId) throw new Error(`source à déclasser introuvable : ${src} — annulé`)
      const row = await prisma.documentTheme.findFirst({ where: { documentId: docId, themeId: theme.id } })
      if (!row) continue
      if (row.isPrimary) throw new Error(`refus : ${src} est PRINCIPAL dans ${slug}`)
      await prisma.documentTheme.delete({ where: { documentId_themeId: { documentId: docId, themeId: theme.id } } })
      touched.add(docId)
      removed++
    }
  }
  if (removed) console.log(`✓ déclassements : ${removed} retirés (documents intacts)`)

  // ── 5. Réindexation des documents touchés (libellés de thèmes dans la recherche) ─
  // Le renommage bancaire touche aussi la Loi banques 2012 (libellé dénormalisé).
  const bankDocs = await prisma.documentTheme.findMany({ where: { themeId: bank.id }, select: { documentId: true } })
  for (const b of bankDocs) touched.add(b.documentId)
  let i = 0
  for (const id of touched) {
    await reindexDocument(id)
    if (++i % 20 === 0) console.log(`  … ${i}/${touched.size} réindexés`)
  }
  console.log(`✓ ${touched.size} documents réindexés`)

  // ── 6. Vérifications bloquantes ────────────────────────────────────────────────
  const dcAfter = await prisma.documentTheme.count({ where: { theme: { slug: 'droit-commercial' } } })
  if (dcAfter !== dcBefore) throw new Error(`droit-commercial ${dcBefore} → ${dcAfter} : un déplacement a eu lieu !`)
  const EXPECTED: Record<string, number> = {
    'societes-anonymes': 8, 'code-de-commerce': 4, 'droit-maritime': 11, 'droit-bancaire': 21,
    fiscalite: 12, 'propriete-intellectuelle': 6, arbitrage: 4, 'transport-aerien': 7, assurances: 2,
    'profession-de-commercant': 3,
    'fiscalite-impots': 12, douane: 2, 'travaux-publics-transports': 18, tourisme: 1,
    'agriculture-rural': 1, 'sante-publique': 3, 'commerce-industrie': 13,
  }
  for (const [slug, want] of Object.entries(EXPECTED)) {
    const n = await prisma.documentTheme.count({ where: { theme: { slug } } })
    if (n !== want) throw new Error(`compte ${slug} : ${n} ≠ ${want} attendu`)
  }
  // chaque doc touché garde exactement UN isPrimary (l'original, jamais retiré)
  for (const id of touched) {
    const prim = await prisma.documentTheme.count({ where: { documentId: id, isPrimary: true } })
    if (prim !== 1) throw new Error(`doc ${id} : ${prim} thèmes principaux (attendu 1)`)
  }
  console.log(`✓ vérifications : droit-commercial intact (${dcAfter}), ${Object.keys(EXPECTED).length} comptes exacts, isPrimary uniques`)
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
