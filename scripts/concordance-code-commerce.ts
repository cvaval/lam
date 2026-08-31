/**
 * Sort du CORPS les notes de concordance de l'édition Vandal, et les range dans l'appareil.
 *
 *   npx tsx scripts/concordance-code-commerce.ts [--commit]
 *
 * ⚠️ « NOUVEAU » N'EST PAS UN STATUT D'AMENDEMENT. Dans l'édition Vandal, c'est une note
 * marginale de CONCORDANCE : l'article n'a pas d'antécédent dans le Code de commerce
 * FRANÇAIS. Elle voisine avec 66 « Anc. art. N fr. » et 40 « Anc. art. N fr. mod. D-L … »
 * qui disent la correspondance quand elle existe.
 *
 * ⚠️ ET ELLE CONTREDIT LE STATUT SUR 17 ARTICLES. Aplatie dans le corps par l'import de
 * juillet, la note se lisait comme du texte de loi — et le lecteur voyait « Nouveau » en gras
 * au-dessus d'un article que `annotations.status` donne pour MODIFIÉ (79, 89, 109, 114 à 118…)
 * ou pour ABROGÉ (93, 94, 95). Les 28 autres ne sont adossées à aucun statut.
 *
 * ⚠️ RIEN N'EST PERDU : la note quitte le corps pour `annotations.concordance`, où le lecteur
 * la rend en retrait, nommée, distincte de la pastille d'état.
 */
import { PrismaClient } from '@prisma/client'
import { articleAnchorFromHeading } from '../src/lib/doc/anchors'
import { buildSearchText, fold } from '../src/lib/search/normalize'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
/** La seule note que le corps ait retenue. Les « Anc. art. » ont été perdus à l'import. */
const NOTE = /^Nouveau$/

async function main() {
  const commit = process.argv.includes('--commit')
  const d = await prisma.document.findFirst({ where: { source: 'CODE_COMMERCE_ANNOTE' } })
  if (!d) { console.error('⛔ ARRÊT — Code de commerce absent.'); process.exit(1) }
  const ann = JSON.parse(String(d.annotationsJson ?? '{}'))
  const statut: Record<string, string> = ann.status ?? {}
  const L = (d.bodyOriginal ?? '').split('\n')

  const trouves: { i: number; anchor: string; note: string; statut: string }[] = []
  for (let i = 0; i < L.length; i++) {
    if (!NOTE.test(L[i].trim())) continue
    // L'article que la note surmonte : la première ligne non vide qui suit.
    let k = i + 1
    while (k < L.length && !L[k].trim()) k++
    const anchor = articleAnchorFromHeading(L[k]?.trim() ?? '')
    if (!anchor) { console.log(`   ⚠ ligne ${i} : la note ne surmonte aucun article — laissée en place`); continue }
    trouves.push({ i, anchor, note: L[i].trim(), statut: statut[anchor] ?? '—' })
  }

  const contredites = trouves.filter((t) => t.statut !== '—')
  console.log(`NOTES DE CONCORDANCE — CODE DE COMMERCE\n`)
  console.log(`   ${trouves.length} notes « Nouveau » dans le corps`)
  console.log(`   ${contredites.length} surmontent un article DÉJÀ qualifié par son statut :`)
  for (const c of contredites) console.log(`      ${c.anchor.padEnd(12)} statut « ${c.statut} »`)
  console.log(`   ${trouves.length - contredites.length} sans statut adossé\n`)

  if (!commit) { console.log('(à blanc — ajouter --commit pour écrire)'); await prisma.$disconnect(); return }

  const conc: Record<string, string> = { ...(ann.concordance ?? {}) }
  for (const t of trouves) conc[t.anchor] = t.note
  // On retire les lignes de la fin vers le début : les index restent valides.
  for (const t of [...trouves].sort((a, b) => b.i - a.i)) L.splice(t.i, 1)
  const corps = L.join('\n').replace(/\n{4,}/g, '\n\n\n')

  await prisma.document.update({
    where: { id: d.id },
    data: {
      bodyOriginal: corps,
      annotationsJson: JSON.stringify({ ...ann, concordance: conc }),
      searchText: [buildSearchText({ titleFr: d.titleFr, number: d.number, moniteurRef: d.moniteurRef }), fold(corps)].filter(Boolean).join(' '),
    },
  })
  await audit({ action: 'DOC_PUBLISHED', targetType: 'DOCUMENT', targetId: d.id, meta: { via: 'concordance-code-commerce', notes: trouves.length } })
  console.log(`✅ ${trouves.length} notes sorties du corps et rangées en concordance.`)
  await prisma.$disconnect()
}

main()
