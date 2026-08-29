/**
 * LOI CEC 2002 — `adoptionDate` CORRIGÉE selon la règle révisée du 28 août 2026.
 *
 *     npx tsx scripts/corriger-adoption-loi-cec.ts            # simulation
 *     npx tsx scripts/corriger-adoption-loi-cec.ts --apply    # Me Vaval, elle seule
 *
 * ⚠️ POURQUOI CE SCRIPT EXISTE. Le 27 août, la fiche a reçu `adoptionDate = 2002-07-09` — la
 * promulgation présidentielle — sous la règle alors énoncée (« la dernière entité qui l'a
 * adoptée »). Me Vaval a RÉVISÉ cette règle le 28 août :
 *
 *   « la date d'une LOI est la date du DERNIER VOTE (Chambre des Députés ou Sénat), la date de
 *     promulgation par la présidence NE COMPTE PAS. Pour les décrets et les arrêtés, la date
 *     est celle de la promulgation et de la signature. »
 *
 * Une loi existe par le vote du Parlement ; la promulgation est un acte d'exécution. Pour la
 * présente loi, le corps porte — et le script le VÉRIFIE avant d'écrire :
 *   · « Donnée au Sénat de la République le jeudi 20 juin 2002 »
 *   · « Donnée à la Chambre des Députés le mercredi 26 juin 2002 »   ← le dernier vote
 *   · « Donné au Palais National … le 9 juillet 2002 »               ← ne compte plus
 * ⇒ `adoptionDate` : 2002-07-09 → **2002-06-26**.
 *
 * Les DÉCRETS du corpus ne bougent pas : leur date EST la promulgation, la règle révisée le
 * confirme (IR 2005 → 2005-09-29, sûretés → 2020-04-09, fêtes légales → 2024-12-11…).
 * `publicationDate` (2002-07-10, le Moniteur n° 54) est inchangée, ainsi que le corps et
 * l'appareil : ce script ne touche QU'UN champ de date.
 */
import { prisma } from '../src/lib/db'
import { audit } from '../src/lib/auth/audit'

const APPLY = process.argv.includes('--apply')
const AVANT = '2002-07-09'
const APRES = '2002-06-26'
const VOTE_SENAT = 'Donnée au Sénat de la République le jeudi 20 juin 2002'
const VOTE_CHAMBRE = 'Donnée à la Chambre des Députés le mercredi 26 juin 2002'

async function main() {
  const d = await prisma.document.findFirst({
    where: { source: 'LOI_CEC_2002' },
    select: { id: true, titleFr: true, adoptionDate: true, publicationDate: true, bodyOriginal: true },
  })
  if (!d) throw new Error('LOI_CEC_2002 introuvable')
  if (d.adoptionDate?.toISOString().slice(0, 10) !== AVANT)
    throw new Error(
      `adoptionDate vaut ${d.adoptionDate?.toISOString().slice(0, 10) ?? 'NULL'}, attendu ${AVANT} — ` +
        'quelqu’un est passé depuis le 27 août : relire avant d’écrire.',
    )

  // ⚠️ LA PREUVE AVANT L'ÉCRITURE. Les deux votes doivent être au corps, et celui de la
  // Chambre doit être le plus tardif — sinon la règle désignerait une autre date.
  const b = d.bodyOriginal ?? ''
  if (!b.includes(VOTE_SENAT)) throw new Error(`le vote du Sénat est introuvable au corps : « ${VOTE_SENAT} »`)
  if (!b.includes(VOTE_CHAMBRE)) throw new Error(`le vote de la Chambre est introuvable au corps : « ${VOTE_CHAMBRE} »`)
  if (new Date('2002-06-26') <= new Date('2002-06-20'))
    throw new Error('le vote retenu n’est pas le plus tardif — la règle vise le DERNIER vote')

  console.log(`✓ ${d.titleFr.slice(0, 62)}`)
  console.log(`  adoptionDate : ${AVANT} → ${APRES}`)
  console.log(`  appui, LU du corps :`)
  console.log(`    · ${VOTE_SENAT}`)
  console.log(`    · ${VOTE_CHAMBRE}   ← le dernier vote, celui que la règle retient`)
  console.log(`    · la promulgation du 9 juillet 2002 ne compte plus (règle révisée du 28 août)`)
  console.log(`  publicationDate ${d.publicationDate?.toISOString().slice(0, 10)} INCHANGÉE · corps et appareil non touchés`)

  if (!APPLY) {
    console.log('\nSIMULATION — rien n’a été écrit. --apply est réservé à Me Vaval.')
    await prisma.$disconnect()
    return
  }

  await prisma.$transaction(async (tx) => {
    await tx.document.update({ where: { id: d.id }, data: { adoptionDate: new Date(APRES) } })
    await audit(
      {
        action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: d.id,
        meta: {
          source: 'LOI_CEC_2002',
          motif:
            `adoptionDate ${AVANT} → ${APRES} : application de la règle RÉVISÉE par Me Vaval le ` +
            '28 août 2026 — pour une LOI, la date est celle du DERNIER VOTE (ici la Chambre des ' +
            'Députés, 26 juin 2002), la promulgation présidentielle (9 juillet) ne compte pas. ' +
            'La règle du 27 août, qui retenait la promulgation, est remplacée.',
          avant: AVANT, apres: APRES, appui: VOTE_CHAMBRE,
        },
      },
      tx,
    )
  }, { timeout: 60_000, maxWait: 15_000 })

  const n = await prisma.auditLog.count({ where: { targetId: d.id, action: 'ARTICLE_AMENDED' } })
  console.log(`\n✓ écrit · AuditLog ARTICLE_AMENDED sur la fiche : ${n} (recompté — audit() avale ses erreurs)`)
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error('ÉCHEC :', e instanceof Error ? e.message : e); await prisma.$disconnect(); process.exit(1) })
