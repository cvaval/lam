/**
 * MANUEL DE PROCÉDURES 2009 — LEVER la réserve de complétude, sur pièce.
 *
 *     npx tsx scripts/lever-reserve-manuel-2009.ts            # simulation
 *     npx tsx scripts/lever-reserve-manuel-2009.ts --apply    # Me Vaval, elle seule
 *
 * ⚠️ CE SCRIPT CORRIGE UNE NOTE QUE J'AI ÉCRITE QUELQUES HEURES PLUS TÔT.
 * Le 28 août 2026, en appliquant la décision de Me Vaval sur le § 13.11 (« accepter la réserve,
 * on ne complètera pas la suite »), j'ai porté sur la fiche une note disant que la transcription
 * s'interrompait « sans colophon » et que « la suite n'a pas été retrouvée sur les pièces
 * communiquées ». La prémisse était FAUSSE, et le fac-similé attaché ensuite l'a montrée telle.
 *
 * DEUX MESURES, LUES SUR LE SCAN DU SPÉCIAL N° 10 DU 4 NOVEMBRE 2009 :
 *   1. la dernière page du Manuel est la page 114 du fascicule ; le texte s'y arrête au point 2
 *      de la section 4.2.1, et il est suivi du TRAIT DE CLÔTURE du Journal officiel — la même
 *      double règle qui ferme les autres textes du Moniteur ;
 *   2. la page 115 du MÊME fascicule ouvre l'arrêté suivant (« ARRÊTÉ DÉTERMINANT LES MODALITÉS
 *      D'ORGANISATION ET DE FONCTIONNEMENT DE LA CNMP »). Il n'y a donc AUCUN intervalle : rien
 *      ne manque entre les deux.
 *
 * Le Manuel se termine bien là où notre transcription se termine. La réserve n'est pas
 * « acceptée » — elle est LEVÉE, et la note doit le dire au lecteur.
 */
import { prisma } from '../src/lib/db'
import { audit } from '../src/lib/auth/audit'
import { reindexDocument } from '../src/lib/search/reindex'

const APPLY = process.argv.includes('--apply')
const CLE = 'sec-0|art-1'

const ANCIEN_DEBUT = '⚠️ Réserve de complétude.'
const NOUVELLE =
  '⚠️ Le Manuel s’achève ici, et ce n’est PAS une lacune de la transcription. Vérifié sur le ' +
  'fac-similé joint à cette fiche (Le Moniteur, 164ᵉ année, Spécial n° 10 du mercredi 4 novembre ' +
  '2009) : le texte publié s’arrête à la page 114 du fascicule, au point 2 de la section 4.2.1 ' +
  '(recours au marché de gré à gré ou par entente directe), suivi du trait de clôture du Journal ' +
  'officiel ; et la page 115 du même fascicule ouvre déjà l’arrêté suivant, celui qui détermine ' +
  'les modalités d’organisation et de fonctionnement de la CNMP. Aucun intervalle, donc rien qui ' +
  'manque. La réserve de complétude ouverte le 27 août 2026 est LEVÉE sur pièce le 28 août 2026 : ' +
  'le Manuel est intégral.'

async function main() {
  const d = await prisma.document.findFirst({
    where: { source: 'MARCHES_ARR_MANUEL_2009' },
    select: { id: true, annotationsJson: true, sourcePdfUrl: true },
  })
  if (!d) throw new Error('MARCHES_ARR_MANUEL_2009 introuvable. STOP')
  // La note NOUVELLE invoque le fac-similé : refuser de l'écrire s'il n'est pas là.
  if (!d.sourcePdfUrl) throw new Error('la fiche ne porte aucun fac-similé — la note s’appuierait sur une pièce absente. STOP')

  const a = JSON.parse(String(d.annotationsJson ?? '{}'))
  const actuel: string[] = a.commentaires?.[CLE] ?? []
  if (actuel.length !== 1 || !actuel[0].startsWith(ANCIEN_DEBUT))
    throw new Error(`la clé « ${CLE} » ne porte pas la note attendue (${actuel.length} commentaire(s)) — déjà corrigée ? STOP`)

  console.log('ANCIENNE (fausse) :\n  ' + actuel[0].slice(0, 200) + '…')
  console.log('\nNOUVELLE :\n  ' + NOUVELLE.slice(0, 220) + '…')
  if (!APPLY) {
    console.log('\nSIMULATION — rien n’a été écrit.')
    await prisma.$disconnect()
    return
  }

  await prisma.document.update({
    where: { id: d.id },
    data: { annotationsJson: JSON.stringify({ ...a, commentaires: { ...a.commentaires, [CLE]: [NOUVELLE] } }) },
  })
  await audit({
    action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: 'MARCHES_ARR_MANUEL_2009',
    meta: {
      motif:
        'Réserve de complétude du Manuel 2009 LEVÉE sur pièce. La note posée quelques heures plus ' +
        'tôt le même jour affirmait que la transcription s’interrompait et que la suite n’avait pas ' +
        'été retrouvée : c’était faux. Le fac-similé du Spécial n° 10 du 4 novembre 2009 montre que ' +
        'le Manuel s’arrête page 114 avec le trait de clôture du Journal officiel, et que la page 115 ' +
        'ouvre l’arrêté suivant. Aucun intervalle : le texte est intégral.',
    },
  })
  await reindexDocument(d.id)
  const n = await prisma.auditLog.count({ where: { targetId: 'MARCHES_ARR_MANUEL_2009' } })
  const apres = JSON.parse(String((await prisma.document.findUnique({ where: { id: d.id }, select: { annotationsJson: true } }))?.annotationsJson ?? '{}'))
  console.log(`\n✓ note remplacée · AuditLog ${n} (recompté) · commentaire présent : ${Boolean(apres.commentaires?.[CLE]?.[0]?.startsWith('⚠️ Le Manuel s’achève'))}`)
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error('ÉCHEC :', e instanceof Error ? e.message : e); await prisma.$disconnect(); process.exit(1) })
