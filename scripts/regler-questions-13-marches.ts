/**
 * MARCHÉS PUBLICS — les décisions de Me Vaval du 28 août 2026 sur le § 13.
 *
 *     npx tsx scripts/regler-questions-13-marches.ts            # simulation
 *     npx tsx scripts/regler-questions-13-marches.ts --apply    # Me Vaval, elle seule
 *
 * Quatre décisions, aucune inventée ici :
 *
 * § 13.3  « il y a différents types de marchés […] si les seuils affectent les mêmes marchés,
 *          cela a implicitement abrogé les anciens seuils. »
 *          ⇒ Les arrêtés de 2012 et de 2021 passent ABROGE au 1ᵉʳ octobre 2022, et les deux
 *          renvois de l'arrêté de 2022 passent de CITE à ABROGE.
 *          La condition qu'elle pose est MESURABLE, et elle a été mesurée sur les trois corps :
 *          même objet (art. 1ᵉʳ de 2022 = les deux objets de l'art. 1ᵉʳ de 2012), mêmes trois
 *          natures de marchés, et TOUTES les catégories d'autorités contractantes reprises sans
 *          résidu (2012 art. 2 et 3 → 2022 art. 3 et 3-1 ; 4 → 4-1 ; 4-1 → 4-3 ; 4-2 → 4-5 ;
 *          5 → 5, texte identique).
 * § 13.4  « le corps reste intact. » ⇒ la note perd « en attente », la décision est datée.
 * § 13.10 « ok » ⇒ l'écart d'intitulé de l'art. 7-1 reste relevé et non tranché ; la mention
 *          SIC est CONSERVÉE mot pour mot dans la nouvelle note.
 * § 13.11 « accepter la réserve, on ne complètera pas la suite. » ⇒ la réserve doit être DITE
 *          au lecteur : elle n'existait nulle part dans la fiche. Elle est portée en commentaire.
 *
 * ⚠️ POURQUOI LE COMMENTAIRE DU MANUEL S'ACCROCHE À `sec-0|art-1` ET NON À LA FIN DU TEXTE.
 * Le lecteur annoté ne pose un commentaire que sur un bloc PORTANT UN ARTICLE
 * (`commentMap[b.jurisKey]`, AnnotatedText l. 232). Mesuré par `segmentAnnotated` sur cette
 * fiche : 52 blocs, et TROIS clés seulement — `sec-0|art-1`, `sec-0|art-2`, `sec-0|art-3`, les
 * articles de l'arrêté qui sanctionne le Manuel. La coupure, elle, tombe dans le Manuel annexé,
 * qui n'a pas d'article : un commentaire posé là ne s'afficherait jamais. On l'accroche donc à
 * l'article 1ᵉʳ — celui qui donne au Manuel sa force — pour que le lecteur l'apprenne AVANT de
 * lire, et le script REFUSE d'écrire si la clé n'est pas dans les clés réellement calculées.
 *
 * ⚠️ Le `kind` d'un CrossRef AFFIRME. ABROGE est ici une décision d'ÉDITEUR, pas une clause
 * nominative : la note le dit en toutes lettres et cite ses appuis (art. 10, 7 et 7-1).
 */
import { prisma } from '../src/lib/db'
import { audit } from '../src/lib/auth/audit'
import { reindexDocument } from '../src/lib/search/reindex'
// ⚠️ `searchText` est FOLÉ (bas de casse, sans accents) : une vérification qui y cherche la
// forme accentuée répond toujours « non » et fait croire à une régression. Vécu le 28 août.
import { fold } from '../src/lib/search/normalize'
import { segmentAnnotated } from '../src/lib/legislation/annotated'

const APPLY = process.argv.includes('--apply')
const LE_1ER_OCTOBRE_2022 = new Date('2022-10-01T00:00:00Z')

/** Garde le « — dispositif … » / « — considérant … » VERBATIM : on ne réécrit qu'en amont. */
function remplacerPrefixe(note: string, prefixe: string, id: string): string {
  const i = Math.min(
    ...[' — dispositif', ' — considérant'].map((m) => (note.indexOf(m) === -1 ? Infinity : note.indexOf(m))),
  )
  if (!Number.isFinite(i))
    throw new Error(`${id} — la note ne porte ni « — dispositif » ni « — considérant » : impossible d'en préserver la citation verbatim. STOP`)
  return prefixe + note.slice(i)
}

const APPUIS =
  'Appuis au dispositif de l’arrêté de 2022 : art. 10 (« Le présent Arrêté rapporte tout Arrêté ou ' +
  'toute disposition d’Arrêté qui lui est contraire »), art. 7 (entrée en vigueur le 1ᵉʳ octobre 2022) ' +
  'et art. 7-1 (le régime antérieur vaut « jusqu’au 30 septembre 2022 ») — les deux dates se rejoignent ' +
  'sans intervalle.'

const PREFIXE_2012 =
  'ABROGÉ EN FAIT au 1ᵉʳ octobre 2022, sans abrogation nominative — DÉCISION D’ÉDITION de Me Vaval, ' +
  '28 août 2026 : les seuils de 2022 portant sur les mêmes marchés, ils abrogent implicitement les ' +
  'anciens. Mesuré sur les trois corps : même objet (art. 1ᵉʳ de 2022, « réviser les seuils de passation ' +
  'des marchés publics et les seuils de contrôle a priori de la CNMP » = les deux objets de l’art. 1ᵉʳ de ' +
  '2012) ; mêmes trois natures de marchés (travaux ; fournitures ; services et prestations intellectuelles) ; ' +
  'toutes les catégories d’autorités contractantes reprises SANS RÉSIDU — 2012 art. 2 et 3 → 2022 art. 3 et ' +
  '3-1 ; art. 4 → 4-1 ; art. 4-1 → 4-3 ; art. 4-2 → 4-5 ; art. 5 → 5 (texte identique). ' + APPUIS

const PREFIXE_2021 =
  'ABROGÉ EN FAIT au 1ᵉʳ octobre 2022, sans abrogation nominative — DÉCISION D’ÉDITION de Me Vaval, ' +
  '28 août 2026 (mêmes marchés, mêmes seuils : substitution complète). L’arrêté de 2021 ne portait que les ' +
  'seuils de passation SOUS le contrôle a priori (son art. 1ᵉʳ) et laissait exprès inchangés les seuils ' +
  'd’intervention de 2012 (son art. 6) ; l’arrêté de 2022 reprend les deux à son compte, et son considérant ' +
  'vise expressément les seuils « fixés par l’Arrêté du 25 mai 2012 et repris dans l’Arrêté du 21 octobre ' +
  '2021 ». ' + APPUIS +
  ' ⚠️ SIC conservé : l’article 7-1 désigne l’arrêté du 21 octobre 2021 sous l’intitulé de celui de 2012 ' +
  '(« …et les seuils d’intervention »), alors que le VISA du même arrêté (« Vu l’Arrêté du 21 octobre 2021 ' +
  'fixant les seuils de passation des marchés publics en dessous des seuils d’intervention de la CNMP ») le ' +
  'désigne correctement. Écart d’intitulé relevé et LAISSÉ TEL QUEL (Me Vaval, 28 août 2026) : la date du ' +
  '21 octobre 2021 identifie le texte sans ambiguïté ; rien n’est affirmé sur la coquille.'

const PREFIXE_DEFENSE =
  'Pastille et note seulement, SANS substitution du corps — DÉCISION de Me Vaval, 28 août 2026 : ' +
  '« le corps reste intact ». L’étendue exacte de la modification (la clause remplace « la définition » — ' +
  'couvre-t-elle la liste des onze catégories ?) n’est donc pas tranchée par le corps : le lecteur voit la ' +
  'clause modificatrice et l’article 2 dans sa rédaction de 2020.'

const RESERVE_MANUEL =
  '⚠️ Réserve de complétude. La transcription du « Manuel de procédures » annexé au présent arrêté ' +
  's’interrompt sans colophon, au point 2 de la section 4.2.1 (recours au marché de gré à gré ou par ' +
  'entente directe). La suite n’a pas été retrouvée sur les pièces communiquées. Par décision de Me Vaval ' +
  'du 28 août 2026, la réserve est ACCEPTÉE et le texte ne sera pas complété : ce qui précède est intégral, ' +
  'ce qui manque est signalé plutôt que suppléé.'

async function main() {
  const docs = await prisma.document.findMany({
    where: { source: { in: ['MARCHES_ARR_SEUILS_2012', 'MARCHES_ARR_SEUILS_2021', 'MARCHES_ARR_SEUILS_2022', 'MARCHES_ARR_MANUEL_2009'] } },
    select: { id: true, source: true, status: true, effectiveDate: true, bodyOriginal: true, annotationsJson: true },
  })
  const par = (s: string) => {
    const d = docs.find((x) => x.source === s)
    if (!d) throw new Error(`${s} introuvable — le lot n'est pas celui d'hier. STOP`)
    return d
  }
  const a2012 = par('MARCHES_ARR_SEUILS_2012'), a2021 = par('MARCHES_ARR_SEUILS_2021')
  const a2022 = par('MARCHES_ARR_SEUILS_2022'), manuel = par('MARCHES_ARR_MANUEL_2009')

  for (const d of [a2012, a2021]) {
    if (d.status !== 'EN_VIGUEUR')
      throw new Error(`${d.source} porte déjà le statut ${d.status} — quelqu'un est passé ; relire avant d'écraser. STOP`)
  }

  // ── Les trois renvois à reprendre, retrouvés par leurs EXTRÉMITÉS, jamais par un identifiant ──
  const trouver = async (fromSrc: string, toSrc: string, kind: string, motif: string) => {
    const r = await prisma.crossRef.findMany({
      where: { from: { source: fromSrc }, to: { source: toSrc }, kind },
      select: { id: true, note: true },
    })
    if (r.length !== 1) throw new Error(`${fromSrc} --${kind}--> ${toSrc} : ${r.length} renvoi(s), 1 attendu. STOP`)
    if (!r[0].note?.includes(motif))
      throw new Error(`${fromSrc} --${kind}--> ${toSrc} : la note ne porte plus « ${motif} » — déjà reprise ? STOP`)
    return r[0]
  }
  const ref2012 = await trouver('MARCHES_ARR_SEUILS_2022', 'MARCHES_ARR_SEUILS_2012', 'CITE', '§ 13.3')
  const ref2021 = await trouver('MARCHES_ARR_SEUILS_2022', 'MARCHES_ARR_SEUILS_2021', 'CITE', '§ 13.10')
  const refDef = await trouver('MARCHES_DECRET_BENEFICIAIRES_2021', 'MARCHES_ARR_DEFENSE_2020', 'MODIFIE', '§ 13.4')

  // ── La clé du commentaire doit exister DANS LES CLÉS CALCULÉES, pas dans mon idée ──
  const annManuel = JSON.parse(String(manuel.annotationsJson ?? '{}'))
  const cles = new Set(
    (segmentAnnotated(manuel.bodyOriginal ?? '', annManuel.toc ?? []) as { jurisKey?: string | null }[])
      .map((b) => b.jurisKey)
      .filter((k): k is string => Boolean(k)),
  )
  const CLE = 'sec-0|art-1'
  if (!cles.has(CLE))
    throw new Error(`Manuel 2009 : la clé « ${CLE} » n'est pas parmi les ${cles.size} clés calculées (${[...cles].join(', ')}) — le commentaire ne s'afficherait jamais. STOP`)
  if (Object.keys(annManuel.commentaires ?? {}).length)
    throw new Error('Manuel 2009 : la fiche porte déjà des commentaires — relire avant d’écrire. STOP')

  const notes = {
    [ref2012.id]: remplacerPrefixe(ref2012.note!, PREFIXE_2012, 'renvoi 2022→2012'),
    [ref2021.id]: remplacerPrefixe(ref2021.note!, PREFIXE_2021, 'renvoi 2022→2021'),
    [refDef.id]: remplacerPrefixe(refDef.note!, PREFIXE_DEFENSE, 'renvoi défense'),
  }

  console.log('§ 13.3  statut ABROGE  → MARCHES_ARR_SEUILS_2012, MARCHES_ARR_SEUILS_2021')
  console.log('        renvois CITE → ABROGE (2 renvois de l’arrêté de 2022)')
  console.log(`        effectiveDate de l’arrêté de 2022 : ${a2022.effectiveDate?.toISOString().slice(0, 10) ?? 'NULL'} → 2022-10-01 (son art. 7)`)
  console.log('§ 13.4  note de la défense : « en attente » retiré, décision datée')
  console.log('§ 13.10 mention SIC conservée mot pour mot, écart laissé tel quel')
  console.log(`§ 13.11 réserve de complétude portée en commentaire sur « ${CLE} » (clés calculées : ${[...cles].join(', ')})`)
  console.log('\nnouvelles notes (début) :')
  for (const [id, n] of Object.entries(notes)) console.log(`\n  [${id}]\n  ${n.slice(0, 230)}…`)

  if (!APPLY) {
    console.log('\nSIMULATION — rien n’a été écrit. --apply est réservé à Me Vaval.')
    await prisma.$disconnect()
    return
  }

  await prisma.$transaction(
    async (tx) => {
      for (const d of [a2012, a2021]) await tx.document.update({ where: { id: d.id }, data: { status: 'ABROGE' } })
      if (!a2022.effectiveDate)
        await tx.document.update({ where: { id: a2022.id }, data: { effectiveDate: LE_1ER_OCTOBRE_2022 } })
      await tx.crossRef.update({ where: { id: ref2012.id }, data: { kind: 'ABROGE', note: notes[ref2012.id] } })
      await tx.crossRef.update({ where: { id: ref2021.id }, data: { kind: 'ABROGE', note: notes[ref2021.id] } })
      await tx.crossRef.update({ where: { id: refDef.id }, data: { note: notes[refDef.id] } })
      await tx.document.update({
        where: { id: manuel.id },
        data: { annotationsJson: JSON.stringify({ ...annManuel, commentaires: { [CLE]: [RESERVE_MANUEL] } }) },
      })
      await audit(
        {
          action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: 'MARCHES_PUBLICS_S13',
          meta: {
            motif:
              'Décisions de Me Vaval du 28 août 2026 sur le § 13 des marchés publics : 13.3 abrogation ' +
              'implicite des arrêtés de seuils 2012 et 2021 au 1ᵉʳ oct. 2022 (condition posée par elle — ' +
              '« mêmes marchés » — vérifiée sur les trois corps, aucune catégorie sans reprise) ; 13.4 corps ' +
              'du défense 2020 laissé intact ; 13.10 écart d’intitulé de l’art. 7-1 laissé tel quel, SIC ' +
              'conservé ; 13.11 réserve de complétude du Manuel 2009 acceptée et DITE au lecteur.',
            statutsAbroges: 2, renvoisRequalifies: 2, notesReprises: 3, commentaires: 1,
          },
        },
        tx,
      )
    },
    { timeout: 120_000, maxWait: 30_000 },
  )

  const journal = await prisma.auditLog.count({ where: { targetId: 'MARCHES_PUBLICS_S13' } })
  // Le texte de recherche LIT annotationsJson (commentaires, index) : le Manuel doit être réindexé.
  for (const d of [a2012, a2021, a2022, manuel]) await reindexDocument(d.id)

  const ctrl = await prisma.document.findMany({
    where: { source: { in: ['MARCHES_ARR_SEUILS_2012', 'MARCHES_ARR_SEUILS_2021'] } },
    select: { source: true, status: true },
  })
  const kinds = await prisma.crossRef.findMany({
    where: { from: { source: 'MARCHES_ARR_SEUILS_2022' }, to: { source: { in: ['MARCHES_ARR_SEUILS_2012', 'MARCHES_ARR_SEUILS_2021'] } } },
    select: { kind: true },
  })
  const m = await prisma.document.findUnique({ where: { id: manuel.id }, select: { annotationsJson: true, searchText: true } })
  const cm = JSON.parse(String(m?.annotationsJson ?? '{}')).commentaires ?? {}

  console.log(`\n✓ AuditLog ${journal} (recompté) · 4 documents réindexés`)
  console.log(`  statuts : ${ctrl.map((x) => `${x.source}=${x.status}`).join(' · ')}`)
  console.log(`  renvois de 2022 : ${kinds.map((k) => k.kind).join(', ')}`)
  console.log(`  commentaire du Manuel : clé « ${Object.keys(cm).join(', ')} » · repris au texte de recherche : ${String(m?.searchText ?? '').includes(fold('Réserve de complétude')) ? 'oui' : 'NON'}`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('ÉCHEC :', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
