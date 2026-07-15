/**
 * Loi sur la Paternité, la Maternité et la Filiation (28 mai 2014) → lecteur ANNOTÉ
 * (patron Code civil / Décret régimes matrimoniaux) : sommaire, index alphabétique,
 * renvois croisés — demande cliente du 14 juil. 2026.
 *
 * Le document (source LOI_FILIATION_2014, importé le 3 juil.) n'avait AUCUN annotationsJson.
 * Structure réelle : préambule (visas + considérants) · dispositif de 13 articles (dont les
 * articles 293, 311 et 606 du Code civil cités in extenso → ancres propres) · signatures
 * des deux chambres + promulgation. Aucun intitulé interne — le sommaire s'appuie sur les
 * lignes charnières VERBATIM du corps (titre, formule d'adoption, signatures, promulgation).
 *
 * Renvois croisés :
 *   - INTERNES : linkArtRefs (« l'article 1 de la présente loi » → #art-1 ; « l'article 293
 *     du Code Civil » → bloc cité #art-293 ; anti-lien-mort : les articles abrogés 294, 302…
 *     ne sont pas des ancres → non liés) ;
 *   - VERS LE CODE CIVIL : bloc connexe repliable sous chaque article modificateur/abrogatif
 *     → fiche du Code civil, à l'ancre exacte (art-293, art-294, art-302, art-311, art-313,
 *     art-606, art-611) — miroir des liens CC → loi posés le 3 juil.
 *
 * Idempotent (recalcule l'état cible). bodyOriginal INCHANGÉ (§02).
 *   npx tsx scripts/_annotate-loi-filiation.ts
 */
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated, type TocEntry } from '../src/lib/legislation/annotated'

const SOURCE = 'LOI_FILIATION_2014'

async function main() {
  const doc = await prisma.document.findFirst({ where: { source: SOURCE } })
  if (!doc?.bodyOriginal) throw new Error('Loi Filiation introuvable')
  const cc = await prisma.document.findFirst({ where: { source: 'CODE_CIVIL_ANNOTE' }, select: { id: true } })
  if (!cc) throw new Error('Code civil introuvable')
  const lines = doc.bodyOriginal.split('\n')
  const lineStarting = (prefix: string): string => {
    const l = lines.find((x) => x.trim().startsWith(prefix))
    if (!l) throw new Error(`ligne charnière introuvable : ${prefix}`)
    return l.trim()
  }

  // ── Sommaire : lignes charnières verbatim ──
  const toc: TocEntry[] = [
    { label: lineStarting('LOI SUR LA PATERNITÉ'), level: 1, anchor: 'sec-1', kind: 'code' }, // titre → préambule
    { label: lineStarting('Le Parlement a voté la loi suivante'), level: 2, anchor: 'sec-2', kind: 'code' }, // dispositif
    { label: lineStarting('Donnée à la Chambre des Députés'), level: 4, anchor: 'sec-3', kind: 'code' }, // signatures (clôt l'art. 13)
    { label: lineStarting('AU NOM DE LA RÉPUBLIQUE'), level: 2, anchor: 'sec-4', kind: 'code' }, // promulgation
  ]

  // ── Libellés : 13 articles de la loi + les 3 articles du Code civil cités ──
  const labels: Record<string, string> = {}
  for (let n = 1; n <= 13; n++) labels[`art-${n}`] = `Article ${n}`
  labels['art-293'] = 'Article 293 — C. civ. (nouvelle rédaction)'
  labels['art-311'] = 'Article 311 — C. civ. (nouvelle rédaction)'
  labels['art-606'] = 'Article 606 — C. civ. (nouvelle rédaction)'

  // ── navToc descriptif ──
  const navToc = [{
    label: 'Loi sur la Paternité, la Maternité et la Filiation', anchor: 'sec-1',
    children: [
      { label: 'Préambule (visas et considérants)', anchor: 'sec-1' },
      {
        label: 'Dispositif (articles 1 à 13)', anchor: 'sec-2',
        children: [
          { label: 'Article 1 — Égalité des filiations', anchor: 'art-1' },
          { label: 'Article 2 — Établissement de la filiation (état civil, nom)', anchor: 'art-2' },
          { label: 'Article 3 — Art. 293 C. civ. modifié (désaveu, preuve ADN)', anchor: 'art-3' },
          { label: 'Article 4 — Abrogation des articles 294 et 295 C. civ.', anchor: 'art-4' },
          { label: 'Article 5 — Confirmation judiciaire de paternité / maternité', anchor: 'art-5' },
          { label: 'Article 6 — Fausse indication de parenté (sanction)', anchor: 'art-6' },
          { label: 'Article 7 — Action en recherche : référé, ADN, contrainte', anchor: 'art-7' },
          { label: 'Article 8 — Abrogation des articles 302 à 309 C. civ.', anchor: 'art-8' },
          { label: 'Article 9 — Art. 311 C. civ. modifié (recherche permise)', anchor: 'art-9' },
          { label: 'Article 10 — Abrogation de l’article 313 C. civ.', anchor: 'art-10' },
          { label: 'Article 11 — Art. 606 C. civ. modifié (successions)', anchor: 'art-11' },
          { label: 'Article 12 — Abrogation de l’article 611 C. civ.', anchor: 'art-12' },
          { label: 'Article 13 — Clause abrogatoire', anchor: 'art-13' },
        ],
      },
      { label: 'Signatures (Chambre des Députés, Sénat)', anchor: 'sec-3' },
      { label: 'Promulgation (28 mai 2014)', anchor: 'sec-4' },
    ],
  }]

  // ── Index alphabétique curé (réfs = ancres du document) ──
  const IDX: [string, (number | string)[]][] = [
    ['Abrogations (articles du Code civil)', [4, 8, 10, 12, 13]],
    ['Action en recherche de paternité ou de maternité', [5, 7, 311]],
    ['Contrainte par corps (refus d’examen)', [7]],
    ['Crédits budgétaires (tests ADN)', [7]],
    ['Désaveu de paternité', [3, 293]],
    ['Égalité des filiations', [1, 606]],
    ['État civil (inscription de la naissance)', [2]],
    ['Fausse indication de parenté', [6]],
    ['Juge des référés', [7]],
    ['Nom de famille de l’enfant', [2]],
    ['Ordonnance permissive du Doyen', [5]],
    ['Personnel diplomatique et consulaire', [7]],
    ['Preuve biologique (test ADN)', [293, 7, 311]],
    ['Reconnaissance d’enfant (refus)', [5]],
    ['Successions (égalité des enfants)', [11, 606]],
  ]
  const indexEntries = IDX.map(([subject, ctRefs]) => ({ subject, ctRefs })).sort((a, b) => a.subject.localeCompare(b.subject, 'fr'))

  // ── Renvois croisés VERS le Code civil (repliables, à l'ancre exacte) ──
  const MONITEUR = 'Le Moniteur N° 105 du 4 juin 2014'
  const cx = (anchor: string, text: string): { label: string; text: string; docId: string; anchor: string } =>
    ({ label: 'Code civil d’Haïti (texte à jour)', text, docId: cc.id, anchor })
  const connexe: Record<string, ReturnType<typeof cx>[]> = {
    'art-3': [cx('art-293', 'Voir l’article 293 dans le Code civil annoté (texte en vigueur issu de la présente loi).')],
    'art-4': [cx('art-294', 'Les articles 294 et 295 portent la pastille « abrogé » dans le Code civil annoté.')],
    'art-8': [cx('art-302', 'Les articles 302, 303, 304, 306, 308 et 309 portent la pastille « abrogé » dans le Code civil annoté.')],
    'art-9': [cx('art-311', 'Voir l’article 311 dans le Code civil annoté (texte en vigueur issu de la présente loi).')],
    'art-10': [cx('art-313', 'L’article 313 porte la pastille « abrogé » dans le Code civil annoté.')],
    'art-11': [cx('art-606', 'Voir l’article 606 dans le Code civil annoté (texte en vigueur issu de la présente loi).')],
    'art-12': [cx('art-611', 'L’article 611 porte la pastille « abrogé » dans le Code civil annoté.')],
  }

  const ann = {
    title: 'Loi sur la Paternité, la Maternité et la Filiation',
    annotationAuthor: '',
    navToc, toc, connexes: [], jurisprudence: {}, indexEntries, labels, connexe,
  }

  // ── Vérif de segmentation AVANT écriture ──
  const blocks = segmentAnnotated(doc.bodyOriginal, toc)
  const secs = blocks.filter((b) => b.kind === 'section').length
  const anchors = new Set(blocks.filter((b: any) => b.kind === 'body' && b.anchor).map((b: any) => b.anchor))
  if (secs !== toc.length) throw new Error(`segmentation ${secs}/${toc.length} — annulé`)
  const missing = Object.keys(labels).filter((a) => !anchors.has(a))
  if (missing.length) throw new Error(`ancres sans bloc : ${missing.join(', ')} — annulé`)
  const deadIdx = indexEntries.flatMap((e) => e.ctRefs).filter((r) => !anchors.has(`art-${r}`))
  if (deadIdx.length) throw new Error(`index : renvois morts ${deadIdx.join(', ')} — annulé`)
  console.log(`✓ segmentation : ${secs}/${toc.length} charnières · ${anchors.size} ancres (13 articles + 293/311/606) · index ${indexEntries.length} sujets, 0 mort`)

  await prisma.document.update({ where: { id: doc.id }, data: { annotationsJson: JSON.stringify(ann) } })
  await reindexDocument(doc.id)
  console.log(`✓ ${doc.id} : sommaire + index + renvois écrits, réindexé (annotationsText inclus).`)
  console.log(`  Moniteur : ${MONITEUR} — liens connexes → Code civil ${cc.id} (7 articles ciblés).`)
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
