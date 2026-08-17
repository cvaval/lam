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

/**
 * ARBITRAGES DU 17 AOÛT 2026, après versement du recueil 1965-1966.
 *
 * Ce recueil a fait apparaître neuf fiches nouvelles, dont six ne sont que des coquilles
 * d'océrisation de magistrats déjà fichés : chacune porte une ou deux décisions face à une
 * fiche principale qui en porte 43 à 86. La rédaction les a reconnues et les réunit.
 *
 * ⚠️ Les graphies d'origine RESTENT dans chaque arrêt (`DecisionJudge.nameAsWritten`) :
 * le recueil n'est jamais réécrit, seul l'affichage est unifié. L'opération est réversible.
 */
const FUSIONS_1965_1966 = [
  { garde: 'Félix Diambois', absorbe: 'Félix DAIMBOIS', nomRetenu: 'Félix Diambois' },
  { garde: 'Léonce Pierre-Antoine', absorbe: 'Léonce PIERRE-ANOTOINE', nomRetenu: 'Léonce Pierre-Antoine' },
  { garde: 'Clément Romulus', absorbe: 'Clément Roumulus', nomRetenu: 'Clément Romulus' },
  { garde: 'Max C. Duplessy', absorbe: 'Max C. DUPLESSYS', nomRetenu: 'Max C. Duplessy' },
  { garde: 'Max C. Duplessy', absorbe: 'Max C. DUPPLESSY', nomRetenu: 'Max C. Duplessy' },
  { garde: 'Max C. Duplessy', absorbe: 'Max DUPLESSIS', nomRetenu: 'Max C. Duplessy' },
  { garde: 'Frédéric Robinson', absorbe: 'Frédérice ROBINSON', nomRetenu: 'Frédéric Robinson' },
  /**
   * ⚠️ RENVERSEMENT ASSUMÉ DE LA DÉCISION DU 17 AOÛT AU MATIN. « Anthony Rivière » et
   * « Antony Rivière » avaient alors été MAINTENUS DISTINCTS, faute de certitude. Le recueil
   * 1965-1966 a levé le doute : le même substitut sert les deux Sections sur la même période,
   * et la seconde graphie ne porte que 2 décisions contre 42. La rédaction les réunit le
   * même jour, en connaissance de la décision qu'elle défait.
   */
  { garde: 'Anthony Rivière', absorbe: 'Antony Rivière', nomRetenu: 'Anthony Rivière' },
]

/** Rapprochements suggérés par la clé mais REFUSÉS par la rédaction : ils restent distincts. */
/**
 * Rapprochements suggérés par la clé mais REFUSÉS par la rédaction : ils restent distincts.
 *
 * ⚠️ VIDE À CE JOUR. Le seul cas qui y figurait — Anthony / Antony Rivière — a été tranché
 * dans l'autre sens le 17 août au soir, après que le recueil 1965-1966 eut levé le doute.
 * Le laisser ici aurait fait dire au script le contraire de ce qu'il applique.
 */
const DISTINCTS: { a: string; b: string; motif: string }[] = []

async function main() {
  console.log(APPLY ? 'ARBITRAGE DES GRAPHIES — écriture\n' : 'ARBITRAGE DES GRAPHIES — simulation\n')

  for (const f of [...FUSIONS, ...FUSIONS_1965_1966]) {
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
