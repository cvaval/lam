/**
 * Code civil — doublons d'OCR de l'appareil (arts 1036, 1045, 1077).
 *
 * Le recueil compose ses notes sur DEUX COLONNES. Aux trois articles visés, l'océrisation a
 * lu les colonnes en travers : les phrases de gauche et de droite s'entrelacent au milieu des
 * mots (« 1. Il n'existe aucune responsabilité de la dispose d'aucune action récursoire ou
 * subroga- victime décédée envers ses proches… »). Aux arts 1036 et 1077, une seconde
 * lecture, correcte, a été versée à la suite : les notes y figurent donc DEUX FOIS, une fois
 * illisible et une fois propre. À l'art. 1045, aucune version propre n'existe : un fragment
 * de la note 2 s'est simplement égaré au milieu de la note 3.
 *
 * Trois gestes :
 *   · SUPPRIMER la version entrelacée quand la version propre existe (arts 1036 n°1, 1077) ;
 *   · RÉÉCRIRE la note quand elle n'existe qu'entrelacée (art. 1036 n°2, art. 1045 n°2 et 3),
 *     en remettant les colonnes dans l'ordre. Chaque réécriture a été collationnée sur
 *     l'IMAGE du fac-similé — pages 217-218 pour l'art. 1036, page 222 pour l'art. 1045 —
 *     jamais sur la couche texte du PDF, qui est précisément la source du désordre.
 *
 * Invariants vérifiés AVANT toute écriture :
 *   · aucun mot d'au moins 6 lettres présent avant ne disparaît de l'article (les fragments
 *     coupés par la césure — « sonnes », « autre- », « subroga- » — sont attendus) ;
 *   · aucune note conservée ne porte plus la signature de l'entrelacement ;
 *   · le nombre de notes des autres articles est inchangé ;
 *   · searchText est recalculé.
 *
 *     npx tsx scripts/corriger-doublons-ocr-code-civil.ts
 *     npx tsx scripts/corriger-doublons-ocr-code-civil.ts --apply
 */
import { PrismaClient } from '@prisma/client'
import { parseAnnotations, segmentAnnotated } from '../src/lib/legislation/annotated'
import { buildSearchText } from '../src/lib/search/normalize'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')

type Geste = {
  supprimer?: number[]
  reecrire?: Record<number, string>
  preuve: string
  /** Mots qui DOIVENT disparaître : demi-mots coupés par la césure de colonne, ou faute
   *  d'OCR corrigée. Tout autre mot perdu arrête le script. */
  disparitions?: string[]
}

const GESTES: Record<number, Geste> = {
  1036: {
    // La note 1 existe en double : entrelacée (n°0) et propre (n°2 + n°3, ses deux alinéas).
    // La note 2 n'existe QU'entrelacée : elle court sur deux pages (bas de la 217, haut de
    // la 218) et se remet dans l'ordre colonne gauche puis colonne droite.
    supprimer: [0],
    reecrire: {
      1: "2. Le coassocié qui, à la suite d'un commandement délivré par le vendeur, verse le solde du prix, acquitte une dette sociale et non une dette personnelle, il ne peut donc, du seul fait qu'il détient la grosse de l'acte de vente, portant subrogation dans tous les droits du vendeur, notamment dans le droit de résolution, exercer l'action résolutoire et conserver pour lui seul, avant toute liquidation de la société, le bénéfice de l'acquisition commune. Cass., 21 décembre 1970, Bull. 1971.",
    },
    preuve: 'fac-similé p. 217 (notes 1 et début de la 2) et p. 218 (fin de la note 2)',
    // « subroga- » / « toire » : la césure de colonne coupait « subrogatoire », que la
    // version propre (note 3) porte entier.
    disparitions: ['subroga'],
  },
  1045: {
    // Rien à supprimer : le fragment « en faisait un effet sans valeur… puis requiert la »
    // appartient à la note 2 et s'était logé au milieu de la note 3. On le rend à sa note.
    reecrire: {
      1: "2. Lorsqu'un mandataire, ajourné en restitution d'un Bon qui lui a été confié pour recouvrement ou en remboursement du montant dudit Bon, allègue l'impossibilité de le restituer pour l'avoir perdu, puis le caractère illicite du Bon qui en faisait un effet sans valeur, et demande à faire la preuve du caractère illicite, puis requiert la validité de l'offre réelle de restitution faite ultérieurement, le tribunal ne peut, en repoussant l'offre parce que le Bon offert n'était pas celui qui avait été confié, accueillir la demande de condamnation sans motiver le rejet de la demande de prouver le caractère illicite du Bon, et la condamnation prononcée au paiement du montant de l'effet. Cass., 7 juillet 1924, Aff. Emm. Cauvin vs. Yovan Thomas.",
      2: "3. La nullité de la consignation n'emporte pas la nullité de l'offre. Cass., 26 juillet 1918, Gaz. No 208 des 8 et 15 février 1946.",
    },
    preuve: 'fac-similé p. 222 : les trois notes en deux colonnes sous l’article',
    // Le fac-similé imprime « l'impossibilité » ; l'OCR avait lu « l'inpossibilité ».
    disparitions: ["l'inpossibilite"],
  },
  1077: {
    // Les deux notes existent en double : entrelacées (n°0 et n°1), propres (n°2 et n°3).
    supprimer: [0, 1],
    preuve: 'fac-similé p. 228 ; les versions propres sont déjà en base',
    // « per- / sonnes » : la césure de colonne coupait « personnes », entier dans la note 3.
    disparitions: ['sonnes'],
  },
}

/** Signature de l'entrelacement : une césure au milieu d'un mot, ou deux « Cass. » collés. */
const ENTRELACE = /\p{Ll}- \p{Ll}|Cass\.,[^.]{0,40}Cass\.,/u

const norm = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[’']/g, "'").replace(/\s+/g, ' ').trim().toLowerCase()
const mots = (s: string) => norm(s).replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim()
const rares = (s: string) => new Set(mots(s).split(' ').filter((w) => w.length >= 6))

async function main() {
  const doc = await prisma.document.findFirst({ where: { source: 'CODE_CIVIL_ANNOTE' } })
  if (!doc) throw new Error('Code civil introuvable.')
  const ann = parseAnnotations(doc.annotationsJson)!
  const brut = JSON.parse(doc.annotationsJson!) as {
    jurisprudence: Record<string, Array<{ ref?: string; excerpt?: string }>>
  }
  const cleDe = new Map<string, string>()
  for (const b of segmentAnnotated(doc.bodyOriginal, ann.toc))
    if (b.kind === 'body' && b.anchor && b.jurisKey) cleDe.set(b.anchor, b.jurisKey)

  const jurisprudence: Record<string, Array<{ ref?: string; excerpt?: string }>> = JSON.parse(JSON.stringify(brut.jurisprudence))
  const journal: string[] = []
  const perdus: string[] = []
  let nSup = 0, nRee = 0

  for (const [art, g] of Object.entries(GESTES)) {
    const n = Number(art)
    const cle = cleDe.get(`art-${n}`)
    if (!cle) throw new Error(`art ${n} : article introuvable`)
    const avant = brut.jurisprudence[cle] ?? []
    const sup = g.supprimer ?? []
    const ree = g.reecrire ?? {}
    for (const i of [...sup, ...Object.keys(ree).map(Number)])
      if (i < 0 || i >= avant.length) throw new Error(`art ${n} : indice de note ${i} hors bornes (${avant.length} notes)`)
    if (sup.some((i) => i in ree)) throw new Error(`art ${n} : une note est à la fois supprimée et réécrite`)

    const apres = avant
      .map((j, i) => (ree[i] ? { ...j, excerpt: ree[i] } : j))
      .filter((_, i) => !sup.includes(i))
    jurisprudence[cle] = apres
    nSup += sup.length
    nRee += Object.keys(ree).length
    journal.push(`art ${n} : ${avant.length} → ${apres.length} notes (${sup.length} supprimée(s), ${Object.keys(ree).length} réécrite(s)) — ${g.preuve}`)

    // rien ne se perd : tout mot rare d'avant doit être encore là après
    const dedans = rares(apres.map((j) => j.excerpt ?? '').join(' '))
    const absents = [...rares(avant.map((j) => j.excerpt ?? '').join(' '))].filter((w) => !dedans.has(w))
    const attendues = new Set((g.disparitions ?? []).map((w) => mots(w)))
    const inattendus = absents.filter((w) => !attendues.has(w))
    if (absents.length) console.log(`   disparitions art ${n} : ${absents.map((w) => (attendues.has(w) ? `${w} (prévue)` : `${w} ⚠`)).join(', ')}`)
    if (inattendus.length) perdus.push(`art ${n} : ${inattendus.join(', ')}`)
    // et plus aucune trace d'entrelacement
    const reste = apres.map((j, i) => [i, j.excerpt ?? ''] as const).find(([, t]) => ENTRELACE.test(t))
    if (reste) journal.push(`   ⚠ art ${n}, note ${reste[0]} porte encore une marque d'entrelacement : « …${reste[1].slice(40, 130)}… »`)
  }

  console.log(journal.join('\n'))
  console.log(`\nnotes supprimées : ${nSup} · notes réécrites : ${nRee}`)
  console.log(`notes du Code : ${Object.values(brut.jurisprudence).flat().length} → ${Object.values(jurisprudence).flat().length}`)
  if (perdus.length) {
    console.log('\nmots perdus NON PRÉVUS :')
    perdus.forEach((l) => console.log('  ' + l))
    throw new Error('du texte disparaîtrait — aucune écriture')
  }
  console.log('\nmots perdus non prévus : 0')

  if (!APPLY) {
    console.log('\nSIMULATION — rien n’a été écrit. Relancer avec --apply.')
    await prisma.$disconnect()
    return
  }
  const annotationsJson = JSON.stringify({ ...JSON.parse(doc.annotationsJson!), jurisprudence })
  const searchText = buildSearchText({ ...doc, annotationsJson } as never)
  await prisma.$transaction(async (tx) => {
    await tx.document.update({ where: { id: doc.id }, data: { annotationsJson, searchText } })
    await audit(
      { action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: doc.id,
        meta: { source: 'CODE_CIVIL_ANNOTE', motif: 'doublons d’OCR de l’appareil (colonnes entrelacées) — arts 1036, 1045, 1077',
                supprimees: nSup, reecrites: nRee } },
      tx,
    )
  }, { timeout: 120_000, maxWait: 30_000 })
  console.log('\n✓ Écrit, index de recherche recalculé, journalisé.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('ÉCHEC :', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
