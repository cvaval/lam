/**
 * DÉCRET DU 9 AVRIL 2020 SUR LE BAIL À USAGE PROFESSIONNEL → signalisation au Code civil.
 *
 * ⚠️ CE DÉCRET N'ABROGE AUCUN ARTICLE DU CODE CIVIL. Son article 1729-3 (inséré au Code de
 * commerce) dispose que les dispositions contraires du chapitre II de la Loi nº 23 du Code
 * civil « ne sont pas applicables au bail à usage professionnel ». C'est une mise à l'écart
 * SECTORIELLE, non une abrogation : ces articles demeurent pleinement en vigueur pour tous
 * les autres baux (habitation, ferme…). Aucun statut « abrogé » n'est donc posé — le faire
 * tromperait l'avocat venu chercher le droit du bail d'habitation.
 *
 * Opération : un encadré repliable sous CHACUN des 66 articles du chapitre « Du louage des
 * choses » (arts. 1484 à 1549), cliquable vers l'article 1729-3 du Code de commerce. Posé
 * sur tous les articles et non sur le seul chef de chapitre, car la recherche plein-texte
 * et les ancres #art-N amènent le lecteur DIRECTEMENT sur un article isolé.
 *
 * ⚠️ Le renvoi ne passe PAS par `crossRefs.articles` : ce champ vise des articles DU MÊME
 * document, et le Code civil possède lui aussi un article 1729 — « 1729-3 » y deviendrait
 * un lien faux. On emploie un bloc connexe inter-documents (docId + anchor).
 *
 * Sauvegarde préalable : backups/backup-before-bail-pro-*.json. Idempotent.
 *   npx tsx scripts/_apply-decret-bail-pro-cc.ts
 */
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated, type Annotations, type ConnexeBlock } from '../src/lib/legislation/annotated'

const LABEL = 'Bail à usage professionnel — Code de commerce, art. 1729-3'
const NOTE =
  'Les dispositions du présent chapitre qui sont contraires au chapitre II du titre VII du livre 1er ' +
  'du Code de commerce (« Du bail à usage professionnel », art. 1721-1 à 1729-3) NE SONT PAS APPLICABLES ' +
  'au bail à usage professionnel — art. 1729-3 du Code de commerce, issu du décret du 9 avril 2020 ' +
  '(Le Moniteur, 175e Année, Spécial N° 4 du 11 mai 2020). Elles demeurent applicables aux autres baux. ' +
  'Sont écartées dans les mêmes conditions les lois du 14 septembre 1947, du 17 mai 1948, du 8 septembre 1948 ' +
  'et du 19 juillet 1961 sur les loyers.'

async function main() {
  const cc = await prisma.document.findFirst({ where: { source: 'CODE_CIVIL_ANNOTE' } })
  const ccom = await prisma.document.findFirst({ where: { source: 'CODE_COMMERCE_ANNOTE' }, select: { id: true } })
  const dec = await prisma.document.findFirst({ where: { source: 'DECRET_BAIL_PRO_2020' }, select: { id: true } })
  if (!cc?.bodyOriginal || !cc.annotationsJson) throw new Error('Code civil introuvable')
  if (!ccom || !dec) throw new Error('Code de commerce ou décret introuvable — lancer les scripts précédents')
  const ann = JSON.parse(cc.annotationsJson) as Annotations & Record<string, any>

  // ── Délimitation du chapitre par SEGMENTATION (jamais par plage de numéros figée) ──
  const blocks = segmentAnnotated(cc.bodyOriginal, ann.toc)
  const iStart = blocks.findIndex((b: any) => b.kind === 'section' && /LOUAGE DES CHOSES/i.test(b.text))
  if (iStart < 0) throw new Error('chapitre « Du louage des choses » introuvable')
  const niveau = (blocks[iStart] as any).level
  const arts: string[] = []
  for (let k = iStart + 1; k < blocks.length; k++) {
    const b: any = blocks[k]
    if (b.kind === 'section' && b.level <= niveau) break
    if (b.kind === 'body' && b.anchor) arts.push(b.anchor)
  }
  const nums = arts.map((a) => Number(a.replace('art-', ''))).filter(Number.isFinite)
  if (arts.length !== 66 || Math.min(...nums) !== 1484 || Math.max(...nums) !== 1549)
    throw new Error(`chapitre inattendu : ${arts.length} articles, ${Math.min(...nums)}–${Math.max(...nums)} — annulé`)
  console.log(`✓ chapitre « Du louage des choses » : ${arts.length} articles (${Math.min(...nums)} → ${Math.max(...nums)})`)

  // ── Encadré repliable, AJOUTÉ aux blocs connexes existants (jamais substitué) ──
  const connexe: Record<string, ConnexeBlock[]> = (ann.connexe ??= {})
  let poses = 0
  let deja = 0
  for (const a of arts) {
    const list: ConnexeBlock[] = connexe[a] ?? (connexe[a] = [])
    const i = list.findIndex((b) => b.label === LABEL)
    const bloc: ConnexeBlock = { label: LABEL, text: NOTE, docId: ccom.id, anchor: 'art-1729-3' }
    if (i >= 0) { list[i] = bloc; deja++ } else { list.push(bloc); poses++ }
  }
  console.log(`✓ encadré : ${poses} posés, ${deja} mis à jour`)

  // ── Contrôle : AUCUN statut d'abrogation posé sur la plage ──
  const abroges = arts.filter((a) => ann.status?.[a])
  if (abroges.length) throw new Error(`statut inattendu sur ${abroges.join(', ')} — ces articles ne sont PAS abrogés`)
  const orphelins = arts.filter((a) => !connexe[a]?.some((b) => b.label === LABEL))
  if (orphelins.length) throw new Error(`articles sans encadré : ${orphelins.slice(0, 5).join(', ')} — annulé`)
  console.log(`✓ contrôles : 0 statut d’abrogation sur la plage · ${arts.length}/${arts.length} articles signalés`)

  await prisma.document.update({ where: { id: cc.id }, data: { annotationsJson: JSON.stringify(ann) } })
  await reindexDocument(cc.id)
  console.log(`✓ Code civil mis à jour (${cc.id}) — corps INCHANGÉ, ${arts.length} encadrés de renvoi, réindexé`)
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
