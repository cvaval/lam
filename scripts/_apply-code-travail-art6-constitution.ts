/**
 * Code du travail annoté — Article 6 → renvoi à la Constitution de 1987.
 *
 * Demande cliente : « à l'article 6, la référence à la Constitution de 1987 doit être faite…
 * la Constitution doit être COLLAPSABLE en dessous de l'article 6… le terme Constitution doit
 * être cliquable et cross-référencé à l'article 35 de la Constitution téléversée. »
 *
 * État initial : le texte de la Constitution (art. 35 + §1-5) est INLINE dans le corps, juste
 * après l'article 6 (note « * Constitution de 1987 »). Deux défauts : (1) il n'est pas pliable ;
 * (2) sa ligne « Article 35. » entre en COLLISION d'ancre avec le VRAI article 35 du Code du
 * travail (deux #art-35 → le saut d'ancre tombait sur la mauvaise cible).
 *
 * Ce script, idempotent :
 *   1) retire le bloc Constitution inline du corps (marqueur « * Constitution de 1987 » →
 *      jusqu'avant « Article 7. ») et l'astérisque sur « Constitution* » de l'article 6 ;
 *   2) ajoute annotations.connexe['art-6'] = bloc pliable « Constitution de 1987 » (texte
 *      verbatim, sous-paragraphes relabellés « Article 35-N.- »), intitulé CLIQUABLE vers
 *      /doc/{Constitution}#art-35 (docId + anchor) ;
 *   3) contrôle la segmentation (en-têtes toc inchangés) puis réindexe.
 *
 *   npx tsx scripts/_apply-code-travail-art6-constitution.ts
 */
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated, type Annotations, type ConnexeBlock, type AnnBlock } from '../src/lib/legislation/annotated'

type BodyBlock = Extract<AnnBlock, { kind: 'body' }>

const CONSTITUTION_ANCHOR = 'art-35'

async function main() {
  const ct = await prisma.document.findFirst({
    where: { source: 'CODE_TRAVAIL_ANNOTE' },
    select: { id: true, bodyOriginal: true, annotationsJson: true },
  })
  if (!ct?.bodyOriginal || !ct.annotationsJson) throw new Error('Code du travail annoté introuvable')
  const cst = await prisma.document.findFirst({ where: { source: 'CONSTITUTION_1987' }, select: { id: true } })
  if (!cst) throw new Error('Constitution 1987 introuvable (cible du renvoi)')

  const ann = JSON.parse(ct.annotationsJson) as Annotations
  const secBefore = segmentAnnotated(ct.bodyOriginal, ann.toc).filter((b) => b.kind === 'section').length

  // ── 1) Retrait du bloc Constitution inline + capture verbatim pour le pliable ──
  const lines = ct.bodyOriginal.split('\n')
  const start = lines.findIndex((l) => /^\*\s*Constitution de 1987\s*$/.test(l))
  let connexeText: string
  let body = ct.bodyOriginal
  if (start >= 0) {
    // fin = première ligne « Article 7. » après le marqueur (exclue).
    let end = start + 1
    while (end < lines.length && !/^Article\s*7\.\s/.test(lines[end])) end++
    // Lignes retirées après le marqueur (art. 35 + sous-paragraphes) → texte du pliable.
    const removed = lines.slice(start + 1, end)
    connexeText = removed
      .map((l) => {
        const art35 = l.match(/^Article\s*35\.\s*-?\s*(.*)$/)
        if (art35) return `Article 35.- ${art35[1].trim()}`
        const sub = l.match(/^(\d)\.-\s*(.*)$/) // « 1.- … » → « Article 35-1.- … »
        if (sub) return `Article 35-${sub[1]}.- ${sub[2].trim()}`
        return l
      })
      .join('\n')
      .trim()
    // Retrait des lignes [start, end) et de l'astérisque sur « Constitution* » de l'art. 6.
    const kept = [...lines.slice(0, start), ...lines.slice(end)]
    body = kept.join('\n').replace(/reconnues par la Constitution\*/, 'reconnues par la Constitution')
  } else {
    // Déjà retiré du corps : on reconstruit le texte du pliable depuis le connexe existant
    // (idempotence) ou, à défaut, on échoue explicitement plutôt que d'inventer.
    const existing = ann.connexe?.['art-6']?.find((b) => /Constitution/i.test(b.label))
    if (!existing) throw new Error('Bloc inline déjà retiré ET connexe art-6 absent — état incohérent, arrêt.')
    connexeText = existing.text
    console.log('  (corps déjà nettoyé — réapplication du connexe)')
  }

  // ── 2) Bloc connexe pliable sous l'article 6, intitulé cliquable → Constitution art. 35 ──
  const block: ConnexeBlock = {
    label: 'Constitution de 1987',
    text: connexeText,
    docId: cst.id,
    anchor: CONSTITUTION_ANCHOR,
  }
  ann.connexe = { ...(ann.connexe ?? {}), 'art-6': [block] }

  // ── 3) Ré-attribution de la JURISPRUDENCE de l'article 6 (défaut hérité du parseur) ──
  // La jurisprudence de l'art. 6 (arrêts LAVACHE/HASCO, Spalding…) avait été rattachée par le
  // parseur à un art-35 FANTÔME : la ligne « Article 35. » de la note Constitution INLINE, qui
  // suivait l'art. 6, faisait basculer le contexte d'article avant le bloc « Jurisprudence ».
  // En retirant cette note inline (étape 1), le bloc qui portait cette clé disparaît → la
  // jurisprudence ne s'affichait plus. On la ré-attribue à l'article 6 (clé de sa section).
  const blocks = segmentAnnotated(body, ann.toc)
  const secAfter = blocks.filter((b) => b.kind === 'section').length
  if (secAfter !== secBefore) throw new Error(`segmentation modifiée : ${secBefore} → ${secAfter} en-têtes — annulé`)
  const bodyBlocks = blocks.filter((b): b is BodyBlock => b.kind === 'body')
  const art6Key = bodyBlocks.find((b) => b.anchor === 'art-6')?.jurisKey
  if (!art6Key) throw new Error('bloc art-6 introuvable après édition — annulé')
  const usedKeys = new Set(bodyBlocks.map((b) => b.jurisKey).filter((k): k is string => !!k))
  const orphanKey = `${art6Key.split('|')[0]}|art-35` // ex. « sec-7|art-35 » (art-35 fantôme, même section que l'art. 6)
  // Sécurité : ne déplacer QUE si la clé orpheline n'est réclamée par AUCUN bloc du corps
  // (le vrai art. 35 du Code vit dans une autre section → sa jurisprudence n'est pas touchée).
  const rehome = (map: Record<string, any[]> | undefined, label: string) => {
    if (!map || usedKeys.has(orphanKey) || !map[orphanKey]?.length) return
    const dest = map[art6Key] ?? []
    const seen = new Set(dest.map((c) => JSON.stringify(c)))
    for (const c of map[orphanKey]) if (!seen.has(JSON.stringify(c))) dest.push(c)
    map[art6Key] = dest
    delete map[orphanKey]
    console.log(`  ${label} : ${map[art6Key].length} entrée(s) ré-attribuée(s) ${orphanKey} → ${art6Key}.`)
  }
  rehome(ann.jurisprudence as Record<string, any[]>, 'Jurisprudence')
  rehome(ann.commentaires as Record<string, any[]> | undefined, 'Commentaires')

  const anchors = blocks.filter((b) => b.kind === 'body' && b.anchor).map((b) => b.anchor)
  const art35count = anchors.filter((a) => a === 'art-35').length
  console.log(`Segmentation : ${secAfter} en-têtes (inchangé) · #art-35 dans le corps : ${art35count} · jurisprudence art-6 : ${(ann.jurisprudence as Record<string, any[]>)?.[art6Key]?.length ?? 0} arrêt(s).`)

  await prisma.document.update({ where: { id: ct.id }, data: { bodyOriginal: body, annotationsJson: JSON.stringify(ann) } })
  await reindexDocument(ct.id)
  console.log(`✅ Article 6 : encadré pliable « Constitution de 1987 » → /doc/${cst.id}#${CONSTITUTION_ANCHOR}`)
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
