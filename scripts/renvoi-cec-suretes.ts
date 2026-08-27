/**
 * DÉCRET SÛRETÉS → LOI CEC 2002 — LE RENVOI QUE LA PREUVE A DÉBLOQUÉ (§ 13.12a, close).
 *
 *     npx tsx scripts/renvoi-cec-suretes.ts            # simulation
 *     npx tsx scripts/renvoi-cec-suretes.ts --apply    # Me Vaval, elle seule
 *
 * Le visa du décret cite « la Loi du 26 JUIN 2002 sur les coopératives d'épargne et de
 * crédit » ; la fiche du corpus s'intitule « Loi du 10 JUILLET 2002 ». Le renvoi avait été
 * ÉCARTÉ (drapeau --cec du script A, jamais levé) : identifier deux textes par leur seul
 * objet fabrique des liens faux.
 *
 * LA PREUVE, TROUVÉE LE 27 AOÛT DANS LE CORPS MÊME DE LA LOI : « Donnée à la Chambre des
 * Députés le mercredi 26 juin 2002 ». Le 26 juin est le vote de la Chambre, le 10 juillet la
 * publication (Moniteur n° 54). MÊME LOI, citée par deux de ses dates. Ce script vérifie la
 * preuve sur pièce avant d'écrire — si l'une des deux phrases manque, il refuse.
 *
 * Le script A ne peut plus être relancé pour cela : sa première assertion fige l'empreinte du
 * corps d'avant son passage. D'où ce geste séparé, qui ne pose QUE ce CrossRef.
 */
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'

const APPLY = process.argv.includes('--apply')

async function main() {
  const dec = await prisma.document.findFirst({
    where: { source: 'DECRET_SURETES' }, select: { id: true, bodyOriginal: true },
  })
  if (!dec) throw new Error('DECRET_SURETES introuvable')
  const cec = await prisma.document.findFirst({
    where: { source: 'LOI_CEC_2002' },
    select: { id: true, type: true, number: true, titleFr: true, bodyOriginal: true },
  })
  if (!cec) throw new Error('LOI_CEC_2002 introuvable')

  // La preuve, sur pièce, ou rien.
  if (!(dec.bodyOriginal ?? '').includes('Loi du 26 juin 2002 sur les coopératives d’épargne et de crédit'))
    throw new Error('le visa « Loi du 26 juin 2002 … » est introuvable au corps du décret')
  if (!(cec.bodyOriginal ?? '').includes('Donnée à la Chambre des Députés le mercredi 26 juin 2002'))
    throw new Error('la preuve « Donnée à la Chambre des Députés le mercredi 26 juin 2002 » est introuvable au corps de la loi — NE PAS poser le renvoi')

  const deja = await prisma.crossRef.findFirst({ where: { fromId: dec.id, toId: cec.id } })
  if (deja) {
    console.log(`Le renvoi existe déjà (${deja.id}, kind=${deja.kind}). Rien à faire.`)
    await prisma.$disconnect()
    return
  }
  const posMax = await prisma.crossRef.aggregate({ where: { fromId: dec.id }, _max: { position: true } })
  const position = (posMax._max.position ?? -1) + 1

  const note =
    'Visé au préambule : « Vu la Loi du 26 juin 2002 sur les coopératives d’épargne et de crédit ' +
    'communément appelées : « Caisses populaires »… ». Le décret cite la loi par sa date d’adoption ' +
    'à la Chambre des Députés — son texte porte « Donnée à la Chambre des Députés le mercredi ' +
    '26 juin 2002 » — quand la présente fiche la titre par sa date de publication au Moniteur ' +
    '(n° 54 du 10 juillet 2002). Même loi, citée par deux de ses dates.'

  console.log(`✓ décret ${dec.id} → loi CEC ${cec.id} (« ${cec.titleFr.slice(0, 60)} »)`)
  console.log(`  kind CITE · position ${position} · preuve vérifiée dans les DEUX corps`)
  console.log(`  note : ${note.slice(0, 110)}…`)

  if (!APPLY) {
    console.log('\nSIMULATION — rien n’a été écrit. --apply est réservé à Me Vaval.')
    await prisma.$disconnect()
    return
  }

  await prisma.$transaction(async (tx) => {
    await tx.crossRef.create({
      data: { fromId: dec.id, toId: cec.id, toType: cec.type, toNumber: cec.number,
              toLabel: cec.titleFr, kind: 'CITE', note, position, source: 'EDITORIAL' },
    })
    await audit({
      action: 'CROSSREF_ADDED', targetType: 'Document', targetId: dec.id,
      meta: { motif: '§ 13.12a close : le visa « 26 juin 2002 » et la fiche « 10 juillet 2002 » désignent la même loi — preuve au corps de la loi (« Donnée à la Chambre des Députés le mercredi 26 juin 2002 »), vérifiée sur pièce le 27 août 2026.', toId: cec.id },
    }, tx)
  }, { timeout: 60_000, maxWait: 15_000 })

  const journalise = await prisma.auditLog.count({ where: { targetId: dec.id, action: 'CROSSREF_ADDED' } })
  await reindexDocument(dec.id)
  console.log(`✓ écrit · CROSSREF_ADDED sur le décret : ${journalise} (recompté) · réindexé`)
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error('ÉCHEC :', e instanceof Error ? e.message : e); await prisma.$disconnect(); process.exit(1) })
