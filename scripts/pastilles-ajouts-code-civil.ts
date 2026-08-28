/**
 * Donne leur pastille aux 60 articles que les décrets de mai 2020 ont INSÉRÉS au Code civil.
 *
 *   npx tsx scripts/pastilles-ajouts-code-civil.ts [--commit]
 *
 * Le décret des régimes matrimoniaux (13 mai 2020) en a ajouté 3, celui des sûretés
 * (14 mai 2020) en a ajouté 57. Mes scripts de juillet 2026 les ont écrits dans le corps en
 * marquant leur tête « Art. 1774-1 (D. du 14 mai 2020) … », sans aucune ligne d'overlay :
 * rien ne distinguait donc un article NEUF d'un article de 1825, et rien ne renvoyait au
 * décret. Ils reçoivent ici une ligne `AJOUTE` — la pastille « Ajout — … » du lecteur.
 *
 * ⚠️ LE DISCRIMINANT EST « CCH.docx », PAS LA FORME DU MARQUEUR. Le Code civil annoté IMPRIME
 * lui-même 21 marqueurs de cette forme — « D. L. du 22 décembre 1944 » (9 articles), « Loi du
 * 5 mai 1949 », « D. du 14 novembre 1988 »… Ceux-là appartiennent à l'éditeur et NE SE
 * TOUCHENT PAS. Vérifié dans le fichier source : les 21 y sont, les 60 de 2020 n'y sont pas
 * — ni les articles eux-mêmes. Le script ne connaît donc QUE les deux dates de mai 2020.
 *
 * ⚠️ ET LE MARQUEUR SORT DU CORPS, ICI AUSSI. Ces 60 têtes ne sont dans aucune édition
 * imprimée : le marqueur est de moi, par analogie. La pastille le remplace — cliquable,
 * datée, au titre complet. La tête retrouve la forme ordinaire du Code (« Art. 3 Aucune loi
 * ne peut être abrogée… »), qui ne porte pas de séparateur.
 *
 * ⚠️ LES 129 RÉDACTIONS RÉÉCRITES, ELLES, GARDENT LEUR MARQUEUR. Marquer un article RÉÉCRIT
 * de l'acte qui l'a réécrit est la convention que l'éditeur applique lui-même (« Art. 55
 * (D. du 14 novembre 1988, art. 1) … ») : mes scripts l'ont suivie, elle reste.
 *
 * Rejouable : `addArticle` refuse une ancre qui porte déjà une ligne.
 */
import { PrismaClient } from '@prisma/client'
import { articleAnchorFromHeading } from '../src/lib/doc/anchors'
import { addArticle } from '../src/lib/legislation/amendments'
import { buildSearchText, fold } from '../src/lib/search/normalize'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()

/** Les DEUX seules marques que ce script connaît. Toute autre est celle de l'éditeur. */
const MARQUE = /^((?:Art\.|Article)\s+\d+(?:-\d+)?)\s*\.?-?\s*\(D\. du (1[34] mai 2020)\)\s*/
const ACTE: Record<string, string> = { '13 mai 2020': 'DECRET_REGIMES_MATRIMONIAUX', '14 mai 2020': 'DECRET_SURETES' }
const TETE = /^(?:Art\.|Article)\s+\d/

async function main() {
  const commit = process.argv.includes('--commit')
  const cc = await prisma.document.findFirst({ where: { source: 'CODE_CIVIL_ANNOTE' } })
  const actes = await prisma.document.findMany({
    where: { source: { in: Object.values(ACTE) } },
    select: { id: true, source: true, titleFr: true, moniteurRef: true, publicationDate: true },
  })
  const parSource = new Map(actes.map((a) => [a.source!, a]))
  if (!cc || parSource.size !== 2) { console.error('⛔ ARRÊT — Code civil ou décrets de 2020 absents.'); process.exit(1) }

  const L = (cc.bodyOriginal ?? '').split('\n')
  const trouves: { i: number; anchor: string; acte: string; tete: string }[] = []
  for (let i = 0; i < L.length; i++) {
    const m = MARQUE.exec(L[i].trim())
    if (!m) continue
    const anchor = articleAnchorFromHeading(L[i].trim())
    if (!anchor) { console.log(`   ⚠ ligne ${i} : ancre illisible — « ${L[i].trim().slice(0, 60)} »`); continue }
    trouves.push({ i, anchor, acte: ACTE[m[2]], tete: L[i].trim() })
  }

  console.log('ARTICLES INSÉRÉS AU CODE CIVIL PAR LES DÉCRETS DE MAI 2020\n')
  for (const s of Object.values(ACTE)) {
    const n = trouves.filter((t) => t.acte === s)
    if (!n.length) continue
    const a = parSource.get(s)!
    console.log(`   ${String(n.length).padStart(2)}  ${a.titleFr}`)
    console.log(`       ${n.map((x) => x.anchor.replace('art-', '')).slice(0, 10).join(', ')}${n.length > 10 ? `… (${n.length})` : ''}`)
  }

  // ⚠️ SENTINELLE. Une ancre en double ferait porter la pastille au mauvais article : le
  // lecteur, comme applyAmendments, ne connaît que la PREMIÈRE occurrence d'une ancre.
  const anc = trouves.map((t) => t.anchor)
  const doublons = [...new Set(anc.filter((a, i) => anc.indexOf(a) !== i))]
  if (doublons.length) { console.error(`\n⛔ ARRÊT — ancres en double : ${doublons.join(', ')}`); process.exit(1) }
  const deja = await prisma.articleVersion.count({ where: { documentId: cc.id, anchor: { in: anc } } })
  console.log(`\n   ${trouves.length} têtes · ancres en double : aucune ✔ · ancres portant déjà un overlay : ${deja}`)

  if (!commit) { console.log('\n(à blanc — ajouter --commit pour écrire)'); await prisma.$disconnect(); return }

  // 1. Le marqueur sort du corps — la tête retrouve la forme ordinaire du Code.
  for (const t of trouves) L[t.i] = L[t.i].replace(MARQUE, '$1 ')
  const corps = L.join('\n')

  // 2. Une ligne AJOUTE par article, avec le texte tel qu'il s'affiche.
  let poses = 0
  for (const t of trouves) {
    let f = L.length
    for (let k = t.i + 1; k < L.length; k++) if (TETE.test(L[k].trim())) { f = k; break }
    const a = parSource.get(t.acte)!
    const pose = await addArticle({
      documentId: cc.id,
      anchor: t.anchor,
      label: t.tete.replace(MARQUE, '$1').trim(),
      body: L.slice(t.i, f).join('\n').trim(),
      amendedByDocId: a.id,
      amendedByNumber: a.moniteurRef ? `${a.titleFr} (${a.moniteurRef})` : a.titleFr,
      effectiveDate: a.publicationDate,
      note: `Article ajouté par : ${a.titleFr}${a.moniteurRef ? ` (${a.moniteurRef})` : ''}`,
    })
    if (pose) poses++
  }

  await prisma.document.update({
    where: { id: cc.id },
    data: {
      bodyOriginal: corps,
      searchText: [buildSearchText({ titleFr: cc.titleFr, number: cc.number, moniteurRef: cc.moniteurRef }), fold(corps)].filter(Boolean).join(' '),
    },
  })
  await audit({ action: 'DOC_PUBLISHED', targetType: 'DOCUMENT', targetId: cc.id, meta: { via: 'pastilles-ajouts-code-civil', pastilles: poses, demarques: trouves.length } })
  console.log(`\n✅ ${poses} pastilles posées · ${trouves.length} têtes démarquées.`)
  await prisma.$disconnect()
}

main()
