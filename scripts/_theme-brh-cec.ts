/**
 * Les dix normes CEC de la BRH rejoignent leur loi dans l'arborescence.
 *
 * Elles étaient sans thème : consultables par la section « Circulaires de la BRH », mais
 * absentes de l'arbre thématique, donc invisibles à côté de la loi du 10 juillet 2002 qui
 * les fonde. On les range sous « Banques & institutions financières », comme elle.
 *
 * ⚠️ C'est une EXCEPTION assumée : les 141 circulaires BRH sont toutes sans thème, par
 * construction. On ne théme ici que les dix qui prolongent un texte de loi publié, parce que
 * le lecteur de cette loi doit trouver ses normes d'application. Étendre le classement aux
 * 131 autres demanderait une taxonomie que personne n'a arrêtée.
 *
 * Idempotent.  npx tsx scripts/_theme-brh-cec.ts [--check]
 */
import { prisma } from '../src/lib/db'

async function main() {
  const theme = await prisma.theme.findFirst({ where: { slug: 'droit-bancaire' } })
  if (!theme) throw new Error('thème droit-bancaire introuvable')

  const normes = await prisma.document.findMany({
    where: { source: 'BRH-CEC' },
    select: { id: true, titleFr: true, number: true, themes: { select: { themeId: true } } },
    orderBy: { number: 'asc' },
  })
  if (normes.length !== 10) throw new Error(`${normes.length} normes CEC trouvées, 10 attendues — annulé`)

  const loi = await prisma.document.findFirst({ where: { source: 'LOI_CEC_2002' }, select: { id: true } })
  if (!loi) throw new Error('la loi CEC de 2002 doit être publiée d’abord — annulé')

  const aRanger = normes.filter((n) => !n.themes.some((t) => t.themeId === theme.id))
  console.log(`normes CEC : ${normes.length} · déjà rangées : ${normes.length - aRanger.length} · à ranger : ${aRanger.length}`)
  if (process.argv.includes('--check')) {
    console.log('— mode contrôle : rien n’a été écrit')
    return prisma.$disconnect()
  }

  for (const n of aRanger) {
    await prisma.documentTheme.create({
      data: { documentId: n.id, themeId: theme.id, isPrimary: true, assignedBy: 'IMPORT' },
    })
    console.log(`  ✓ ${(n.number ?? '').padEnd(22)} ${n.titleFr.slice(0, 62)}`)
  }

  const total = await prisma.documentTheme.count({ where: { themeId: theme.id } })
  console.log(`\n« ${theme.labelFr} » : ${total} documents`)
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
