/**
 * Rend son TITRE COMPLET pour référence à chaque texte de Législation annotée qui n'en
 * portait qu'un fragment.
 *
 *   npx tsx scripts/reference-titre-complet.ts            (à blanc)
 *   npx tsx scripts/reference-titre-complet.ts --commit   (écrit)
 *
 * RÈGLE DE LA RÉDACTION, 26 août 2026 : « il faut toujours donner le titre complet, à moins
 * d'indication contraire ».
 *
 * ⚠️ CE N'EST PAS UNE QUESTION DE STYLE, C'EST UNE QUESTION D'IDENTITÉ. Onze conventions
 * internationales portaient toutes la référence « Convention ». Les trois grandes réformes
 * du 9 avril 2020 — régimes matrimoniaux, sûretés, bail à usage professionnel — portaient
 * toutes « Décret du 9 avril 2020 ». Trois lois bancaires du même jour partageaient
 * « Loi du 17 août 1979 ». À l'écran, des textes différents se présentaient sous une même
 * référence, sans rien pour les distinguer.
 *
 * ⚠️ ON NE TOUCHE PAS AUX « Appendice N » — 21 références, 55 textes. Ce ne sont pas des
 * troncatures : c'est la numérotation propre de l'appendice du Code de procédure civile,
 * qui situe le texte dans le recueil. Le remplacer perdrait cette position. C'est
 * l'« indication contraire » de la règle.
 */
import { PrismaClient } from '@prisma/client'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()

/**
 * ⚠️ TROIS TEXTES DONT LE TITRE NE PORTE PAS LEUR DATE, et dont la référence ne portait
 * QUE la date : les trois grandes réformes du 9 avril 2020 se présentaient toutes sous
 * « Décret du 9 avril 2020 ». Ni le titre seul ni la date seule ne les distingue — il faut
 * les composer. Écrit à la main plutôt que deviné : trois cas ne valent pas une heuristique.
 */
const COMPOSES: Record<string, string> = {
  DECRET_BAIL_PRO_2020: 'Décret du 9 avril 2020 sur le Bail à Usage Professionnel',
  DECRET_REGIMES_MATRIMONIAUX: 'Décret du 9 avril 2020 portant réforme des régimes matrimoniaux',
  DECRET_SURETES: 'Décret du 9 avril 2020 réformant le Droit des Sûretés',
}

async function main() {
  const commit = process.argv.includes('--commit')
  const docs = await prisma.document.findMany({
    where: { type: 'LEGISLATION', source: { not: { startsWith: 'MONITEUR_PDF' } }, number: { not: null } },
    select: { id: true, number: true, titleFr: true, source: true },
    orderBy: { titleFr: 'asc' },
  })

  /** La référence que le texte DOIT porter, ou null s'il garde la sienne. */
  const cible = (d: { number: string | null; titleFr: string; source: string | null }): string | null => {
    const compose = d.source ? COMPOSES[d.source] : undefined
    if (compose) return compose === d.number ? null : compose
    if (d.number === d.titleFr) return null
    if (d.number!.startsWith('Appendice')) return null
    // Le titre COMMENCE par la référence : celle-ci n'en est qu'un fragment.
    return d.titleFr.startsWith(d.number!) ? d.titleFr : null
  }
  const aCorriger = docs.filter((d) => cible(d) !== null)

  // Ce que la correction résout : les références portées par PLUSIEURS textes.
  const par = new Map<string, number>()
  for (const d of docs) par.set(d.number!, (par.get(d.number!) ?? 0) + 1)
  const collisions = aCorriger.filter((d) => (par.get(d.number!) ?? 1) > 1)

  console.log(`${docs.length} textes de Législation annotée`)
  console.log(`   ${aCorriger.length} à compléter · dont ${collisions.length} qui partagent leur référence avec un autre texte`)
  console.log(`   ${docs.filter((d) => d.number!.startsWith('Appendice')).length} « Appendice N » laissés intacts (numérotation du recueil)\n`)

  for (const d of aCorriger.slice(0, 10)) {
    const n = par.get(d.number!) ?? 1
    console.log(`   « ${d.number} »${n > 1 ? ` (partagée par ${n} textes)` : ''}`)
    console.log(`      → « ${cible(d)!.slice(0, 96)}${cible(d)!.length > 96 ? '…' : ''} »`)
  }
  if (aCorriger.length > 10) console.log(`   … et ${aCorriger.length - 10} autres`)

  // ⚠️ CONTRÔLE AVANT ÉCRITURE : le titre complet doit être UNIQUE, sinon on remplace une
  // collision par une autre.
  const apres = new Map<string, number>()
  for (const d of docs) {
    const v = cible(d) ?? d.number!
    apres.set(v, (apres.get(v) ?? 0) + 1)
  }
  const restantes = [...apres].filter(([r, n]) => n > 1 && !r.startsWith('Appendice'))
  console.log(`\nAPRÈS correction : ${restantes.length ? `⚠ ${restantes.length} référence(s) resteraient partagées — ${restantes.map(([r, n]) => `« ${r.slice(0, 40)} » ×${n}`).join(', ')}` : '✔ aucune référence partagée hors Appendice'}`)

  if (!commit) {
    console.log('\n(à blanc — ajouter --commit pour écrire)')
    await prisma.$disconnect()
    return
  }
  for (const d of aCorriger) {
    await prisma.document.update({ where: { id: d.id }, data: { number: cible(d)! } })
  }
  await audit({
    action: 'DOC_PUBLISHED',
    targetType: 'DOCUMENT',
    meta: { via: 'reference-titre-complet', textes: aCorriger.length, collisions: collisions.length },
  })
  console.log(`\n✅ ${aCorriger.length} textes portent désormais leur titre complet en référence.`)
  console.log('   Penser à réindexer (npx tsx scripts/reindex.ts) — la référence est indexée.')
  await prisma.$disconnect()
}

main()
