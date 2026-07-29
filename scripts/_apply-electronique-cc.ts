/**
 * SIGNATURE ÉLECTRONIQUE → CODE CIVIL, et recâblage du renvoi de l'article 30 du notariat.
 *
 * ⚠️ Le point le plus important du dossier. Les articles 1101, 1102, 1111 et 1112 du Code
 * civil affichaient encore leur rédaction de 1825 : la réforme de 2017 n'avait jamais été
 * portée. Un avocat y lisait donc une règle de preuve ANTÉRIEURE à la réforme.
 *
 *   C. civ. 1101 ← art. 1 de la loi du 14 février 2017 (preuve littérale ; écrit électronique)
 *   C. civ. 1102 ← art. 2 de la loi, TEL QU'AMENDÉ par le décret du 20 août 2025
 *                  (« conditions fixées par l'ARRÊTÉ D'APPLICATION », et non « par la loi »)
 *   C. civ. 1111 ← art. 3 de la loi (billet ou promesse sous seing privé, support électronique)
 *   C. civ. 1112 ← art. 4 de la loi (discordance entre le corps de l'acte et le bon)
 *
 * ⚠️ DOUBLE CASCADE sur l'article 1102 : la rédaction à retenir n'est pas celle de 2017 mais
 * celle que le décret de 2025 lui substitue. Le texte est donc pris dans la loi CONSOLIDÉE.
 *
 * Convention de la plateforme : le texte en vigueur est le corps de l'article, la rédaction
 * de 1825 va dans `oldVersions` (repliable), `status` porte la pastille, `connexe` le renvoi.
 *
 * Sauvegarde : backups/backup-before-notariat.json (Code civil). Idempotent.
 *   npx tsx scripts/_apply-electronique-cc.ts
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { type Annotations, type ConnexeBlock } from '../src/lib/legislation/annotated'

const DIR = 'scripts/data/electronique-2015-2025'

/** article de la loi → article du Code civil qu'il réécrit */
const CASCADE: [string, string][] = [['1', '1101'], ['2', '1102'], ['3', '1111'], ['4', '1112']]

/** Extrait la rédaction citée après « se lit désormais comme suit : ». */
function redactionCitee(texteLoi: string, numCc: string): string {
  const m = texteLoi.match(/se lit désormais comme suit\s*:\s*([\s\S]+)$/i)
  if (!m) throw new Error(`« se lit désormais comme suit » introuvable (C. civ. ${numCc})`)
  return m[1]
    // en-tête de la citation : « Article 1102.- » ou « Article 1101 : »
    .replace(new RegExp(`^\\s*«?\\s*Article\\s+${numCc}\\s*[.:-]+\\s*`), '')
    // guillemets de continuation d'alinéa, propres à la citation longue
    .replace(/\s*»\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function main() {
  const textes = JSON.parse(readFileSync(`${DIR}/textes.json`, 'utf8')) as {
    'loi-2017-signature': { consolide: { num: string; text: string }[] }
  }
  const loi = Object.fromEntries(textes['loi-2017-signature'].consolide.map((a) => [a.num, a.text]))

  const nouvelles = new Map<string, string>()
  for (const [numLoi, numCc] of CASCADE) nouvelles.set(numCc, redactionCitee(loi[numLoi], numCc))

  // ── Sentinelles : chaînes relevées à la main dans la loi et le décret de 2025 ──
  const SENT: [string, string][] = [
    ['1101', 'quels que soient leur support et leurs modalités de transmission'],
    ['1101', 'même force probante que l’écrit sur support papier'],
    ['1102', 'Arrêté d’application de la Loi sur la signature électronique'], // ← rédaction 2025
    ['1111', 'que ce soit sur support papier ou sur support électronique'],
    ['1112', 'à moins qu’il ne soit prouvé de quel côté est l’erreur'],
  ]
  for (const [n, s] of SENT)
    if (!nouvelles.get(n)!.includes(s)) throw new Error(`sentinelle absente pour C. civ. ${n} : « ${s} »`)
  // Garde anti-régression : 1102 ne doit PAS porter la rédaction de 2017.
  if (nouvelles.get('1102')!.includes('conditions fixées par la loi'))
    throw new Error('C. civ. 1102 porte la rédaction de 2017, non celle de 2025 — annulé')
  console.log(`✓ 4 rédactions extraites · ${SENT.length} sentinelles OK · art. 1102 en version 2025`)

  const loi2017 = await prisma.document.findFirst({ where: { source: 'LOI_SIGNATURE_ELECTRONIQUE_2017' }, select: { id: true } })
  const dec2025 = await prisma.document.findFirst({ where: { source: 'DECRET_SIGNATURE_ELECTRONIQUE_2025' }, select: { id: true } })
  const dec2015 = await prisma.document.findFirst({ where: { source: 'DECRET_SIGNATURE_ELECTRONIQUE_2015' }, select: { id: true } })
  if (!loi2017 || !dec2025 || !dec2015) throw new Error('textes « électronique » introuvables — lancer _import-electronique.ts')

  // ══ CODE CIVIL ══
  const cc = await prisma.document.findFirst({ where: { source: 'CODE_CIVIL_ANNOTE' } })
  if (!cc?.bodyOriginal || !cc.annotationsJson) throw new Error('Code civil introuvable')
  const ann = JSON.parse(cc.annotationsJson) as Annotations & Record<string, any>
  ann.status ??= {}
  ann.oldVersions ??= {}
  const connexe: Record<string, ConnexeBlock[]> = (ann.connexe ??= {})
  const entetes = new Set(ann.toc.map((t) => t.label))
  let lignes = cc.bodyOriginal.split('\n')
  let poses = 0

  for (const [numLoi, numCc] of CASCADE) {
    const i = lignes.findIndex((l) => new RegExp(`^Art\\.?\\s+${numCc}\\b`).test(l.trim()))
    if (i < 0) throw new Error(`C. civ. ${numCc} introuvable dans le corps`)
    // ⚠️ Borne : article SUIVANT **ou** en-tête de la table des matières — sans quoi le
    // remplacement du dernier article d'une section engloutit l'intitulé qui suit.
    let j = i + 1
    while (j < lignes.length && !/^Art\.?\s+\d/.test(lignes[j].trim()) && !entetes.has(lignes[j].trim())) j++

    const ancien = lignes.slice(i, j).join('\n').replace(new RegExp(`^Art\\.?\\s+${numCc}\\s*`), '')
    const nouveau = nouvelles.get(numCc)!
    // ⚠️ Comparer le texte ENTIER, jamais un préfixe : la réforme de 2017 CONSERVE la phrase
    // d'ouverture des articles 1101 et 1111 et n'ajoute que des alinéas. Un garde sur les
    // 60 premiers caractères concluait « déjà appliqué » et les laissait en rédaction de 1825.
    const norm = (x: string) => x.replace(/\s+/g, ' ').trim()
    if (norm(ancien) !== norm(nouveau)) {
      lignes.splice(i, j - i, `Art. ${numCc} ${nouveau}`)
      poses++
    }

    ann.status[`art-${numCc}`] = 'modifié'
    if (!ann.oldVersions[`art-${numCc}`]) ann.oldVersions[`art-${numCc}`] = `Rédaction d’origine (Code civil de 1825) :\n${ancien.trim()}`
    const bloc: ConnexeBlock = {
      label: 'Loi du 14 février 2017 sur la signature électronique',
      text: `Article réécrit par l’article ${numLoi} de la loi du 14 février 2017, qui adapte le droit de la preuve `
        + `aux technologies de l’information.`
        + (numCc === '1102'
          ? ' Cette rédaction est celle que lui a donnée le décret du 20 août 2025 : les conditions de l’acte '
            + 'authentique électronique sont désormais fixées par l’Arrêté d’application, et non plus « par la loi ».'
          : '')
        + ' Le décret du 9 décembre 2015 avait déjà procédé à la même réécriture ; il est supplanté par la loi de 2017.',
      docId: loi2017.id,
      anchor: `art-${numLoi}`,
    }
    const liste: ConnexeBlock[] = (connexe[`art-${numCc}`] ??= [])
    const k = liste.findIndex((x) => x.label === bloc.label)
    if (k >= 0) liste[k] = bloc
    else liste.push(bloc)
  }

  // ── C. civ. 1110 : VISÉ sans être réécrit ──
  // Le NOUVEL article 2.1 (décret de 2025) ne réécrit pas l'article 1110 : il dit à quelles
  // conditions ses exigences de validité — le « double original » des conventions
  // synallagmatiques — sont RESPECTÉES par un document électronique. Ni statut « modifié »,
  // ni réécriture : un simple encadré, comme pour les articles du louage des choses écartés
  // sectoriellement par le décret sur le bail à usage professionnel.
  {
    const i1110 = lignes.findIndex((l) => /^Art\.?\s+1110\b/.test(l.trim()))
    if (i1110 < 0) throw new Error('C. civ. 1110 introuvable')
    const art21 = loi['2.1']
    for (const s of ['Toutes les parties ont accès au document électronique',
                     'ne peut être modifié sans le consentement de toutes les parties'])
      if (!art21.includes(s)) throw new Error(`sentinelle absente de l’art. 2.1 : « ${s} »`)
    const bloc: ConnexeBlock = {
      label: 'Convention synallagmatique par voie électronique — loi du 14 février 2017, art. 2.1',
      text:
        'Les exigences de validité du présent article (autant d’originaux qu’il y a de parties ayant un '
        + 'intérêt distinct) sont RESPECTÉES, pour un document électronique, lorsque : a) toutes les parties '
        + 'ont accès au document électronique ; b) le document électronique ne peut être modifié sans le '
        + 'consentement de toutes les parties. — Article 2.1 de la loi du 14 février 2017 sur la signature '
        + 'électronique, ajouté par le décret du 20 août 2025. Le présent article n’est ni modifié ni abrogé : '
        + 'il demeure applicable en toutes ses dispositions.',
      docId: loi2017.id,
      anchor: 'art-2-1',
    }
    const liste: ConnexeBlock[] = (connexe['art-1110'] ??= [])
    const k = liste.findIndex((x) => x.label === bloc.label)
    if (k >= 0) liste[k] = bloc
    else liste.push(bloc)
    if (ann.status['art-1110']) throw new Error('C. civ. 1110 porte un statut : il n’est pourtant PAS modifié — annulé')
    console.log('✓ C. civ. 1110 : encadré « convention synallagmatique électronique » (texte INCHANGÉ, aucun statut)')
  }

  const body = lignes.join('\n')
  // Contrôle : la table des matières doit rester intégralement segmentable.
  const { segmentAnnotated } = await import('../src/lib/legislation/annotated')
  const secs = segmentAnnotated(body, ann.toc).filter((b) => b.kind === 'section').length
  if (secs !== ann.toc.length) throw new Error(`segmentation du Code civil ${secs}/${ann.toc.length} — annulé`)

  await prisma.document.update({ where: { id: cc.id }, data: { bodyOriginal: body, annotationsJson: JSON.stringify(ann) } })
  await reindexDocument(cc.id)
  console.log(`✓ Code civil : ${poses} article(s) réécrit(s), 4 pastilles « modifié », rédactions de 1825 repliées · ${secs}/${ann.toc.length} en-têtes intacts`)

  // ══ Recâblage : article 30 du décret-loi de 1969 sur le notariat ══
  const not = await prisma.document.findFirst({ where: { source: 'DECRET_LOI_NOTARIAT_1969' }, select: { id: true, annotationsJson: true } })
  if (not?.annotationsJson) {
    const a = JSON.parse(not.annotationsJson) as Annotations & Record<string, any>
    const liste: ConnexeBlock[] = a.connexe?.['art-30'] ?? []
    const k = liste.findIndex((x) => /loi du 14 février 2017/i.test(x.label))
    if (k >= 0 && !liste[k].docId) {
      liste[k] = { ...liste[k], docId: loi2017.id, anchor: 'art-5' }
      await prisma.document.update({ where: { id: not.id }, data: { annotationsJson: JSON.stringify(a) } })
      await reindexDocument(not.id)
      console.log('✓ notariat, art. 30 : renvoi vers la loi de 2017 désormais CLIQUABLE')
    } else console.log(`✓ notariat, art. 30 : renvoi ${k >= 0 ? 'déjà câblé' : 'introuvable'}`)
  }

  // ══ Renvoi du décret de 2015 (supplanté) vers la loi de 2017 ══
  const d15 = await prisma.document.findFirst({ where: { source: 'DECRET_SIGNATURE_ELECTRONIQUE_2015' }, select: { id: true, annotationsJson: true } })
  if (d15?.annotationsJson) {
    const a = JSON.parse(d15.annotationsJson) as Annotations & Record<string, any>
    a.connexe ??= {}
    const bloc: ConnexeBlock = {
      label: 'Loi du 14 février 2017 sur la signature électronique',
      text: 'Texte SUPPLANTÉ : la loi du 14 février 2017 reprend la même matière et abroge les dispositions '
        + 'contraires (art. 17). L’abrogation est tacite — elle n’est énoncée article par article nulle part.',
      docId: loi2017.id,
    }
    const liste: ConnexeBlock[] = (a.connexe['art-1'] ??= [])
    const k = liste.findIndex((x) => x.label === bloc.label)
    if (k >= 0) liste[k] = bloc
    else liste.push(bloc)
    await prisma.document.update({ where: { id: d15.id }, data: { annotationsJson: JSON.stringify(a) } })
    await reindexDocument(d15.id)
    console.log('✓ décret de 2015 : renvoi vers la loi qui le supplante')
  }

  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
