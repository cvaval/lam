/**
 * Arbitrage des graphies de magistrats — décision de la rédaction du 17 août 2026.
 *
 * Le modèle `Judge` sépare délibérément deux choses : `displayName`, le nom que la rédaction
 * retient, et `DecisionJudge.nameAsWritten`, la graphie de CHAQUE arrêt. Rapprocher deux
 * magistrats ne réécrit donc jamais les recueils : les graphies d'origine restent lisibles
 * décision par décision. C'est ce qui rend l'opération réversible et honnête.
 *
 * La clé `matchKey` SUGGÈRE un rapprochement, elle ne le décide pas — deux homonymes ne sont
 * pas le même homme. Les trois cas ci-dessous attendaient depuis le 15 août ; ils sont tranchés.
 *
 *   npx tsx scripts/arbitrer-graphies-magistrats.ts            (simulation)
 *   npx tsx scripts/arbitrer-graphies-magistrats.ts --apply
 */
import { PrismaClient } from '@prisma/client'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')

/** Fusion décidée : le second est absorbé par le premier, qui prend le nom retenu. */
const FUSIONS = [
  {
    garde: 'Jh. Marthyl SAINT-JULIEN',
    absorbe: 'Jh. M. St Julien',
    // ⚠️ « MarthylE », avec un E final, alors qu'AUCUNE des sept graphies du recueil ne le
    // porte. Ce n'est donc pas un choix entre deux formes attestées : c'est une RECTIFICATION
    // du nom par la rédaction, qui connaît le magistrat. Les graphies d'origine demeurent
    // dans `nameAsWritten` — le recueil n'est pas réécrit, seul l'affichage est corrigé.
    nomRetenu: 'Jh. Marthyle Saint-Julien',
  },
]

/** Rapprochements suggérés par la clé mais REFUSÉS par la rédaction : ils restent distincts. */
const DISTINCTS = [
  {
    a: 'Anthony Rivière',
    b: 'Antony Rivière',
    motif:
      "Maintenus séparés sur décision de la rédaction du 17 août 2026. La clé de rapprochement " +
      'les rapproche, la rédaction ne les confond pas : en l’absence de certitude, deux entrées ' +
      'valent mieux qu’une fusion fausse, qu’on ne saurait plus défaire.',
  },
]

async function main() {
  console.log(APPLY ? 'ARBITRAGE DES GRAPHIES — écriture\n' : 'ARBITRAGE DES GRAPHIES — simulation\n')

  for (const f of FUSIONS) {
    const garde = await prisma.judge.findFirst({ where: { displayName: f.garde } })
    const absorbe = await prisma.judge.findFirst({ where: { displayName: f.absorbe } })
    if (!garde) {
      console.log(`  ⚠ « ${f.garde} » introuvable — rien fait`)
      continue
    }
    const nGarde = await prisma.decisionJudge.count({ where: { judgeId: garde.id } })
    const nAbs = absorbe ? await prisma.decisionJudge.count({ where: { judgeId: absorbe.id } }) : 0
    console.log(`  « ${f.absorbe} » (${nAbs}) ⟶ « ${f.garde} » (${nGarde})`)
    console.log(`      nom retenu : « ${f.nomRetenu} »`)

    if (!APPLY) continue
    await prisma.$transaction(async (tx) => {
      if (absorbe) {
        // Une décision où les DEUX entrées figurent ferait doublon sur (documentId, judgeId).
        // On ne peut pas le supposer absent : on le mesure et on écarte le cas échéant.
        const aDeplacer = await tx.decisionJudge.findMany({ where: { judgeId: absorbe.id } })
        for (const d of aDeplacer) {
          const collision = await tx.decisionJudge.findUnique({
            where: { documentId_judgeId: { documentId: d.documentId, judgeId: garde.id } },
          })
          if (collision) await tx.decisionJudge.delete({ where: { id: d.id } })
          else await tx.decisionJudge.update({ where: { id: d.id }, data: { judgeId: garde.id } })
        }
        await tx.judge.delete({ where: { id: absorbe.id } })
      }
      await tx.judge.update({ where: { id: garde.id }, data: { displayName: f.nomRetenu } })
      await audit(
        {
          action: 'DOC_PUBLISHED',
          targetType: 'JUDGE',
          targetId: garde.id,
          meta: {
            actor: 'script:arbitrer-graphies-magistrats',
            motif: 'arbitrage de la rédaction du 17 août 2026',
            fusionne: f.absorbe,
            participationsDeplacees: nAbs,
            ancienNom: f.garde,
            nouveauNom: f.nomRetenu,
            note: 'graphies d’origine conservées dans DecisionJudge.nameAsWritten',
          },
        },
        tx,
      )
    })
    console.log('      ✓ fusionné et renommé')
  }

  for (const d of DISTINCTS) {
    const [a, b] = await Promise.all([
      prisma.judge.findFirst({ where: { displayName: d.a } }),
      prisma.judge.findFirst({ where: { displayName: d.b } }),
    ])
    console.log(`\n  « ${d.a} » et « ${d.b} » : MAINTENUS DISTINCTS${a && b ? '' : ' (une entrée manque)'}`)
    console.log(`      ${d.motif}`)
    if (APPLY && a && b) {
      await audit({
        action: 'DOC_PUBLISHED',
        targetType: 'JUDGE',
        targetId: a.id,
        meta: { actor: 'script:arbitrer-graphies-magistrats', decision: 'NON FUSIONNÉS', avec: b.id, motif: d.motif },
      })
    }
  }

  console.log(
    APPLY
      ? '\n✓ Arbitrage appliqué et journalisé.'
      : '\nSIMULATION — rien n’a été écrit. Relancer avec --apply.',
  )
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('ÉCHEC :', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
