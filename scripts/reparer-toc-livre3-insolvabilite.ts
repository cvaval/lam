/**
 * Rattache au sommaire du Code de commerce les 72 divisions du Livre III refondu.
 *
 *   npx tsx scripts/reparer-toc-livre3-insolvabilite.ts [--apply]
 *
 * ⚠️ CONSTAT À L'ÉCRAN, INVISIBLE EN BASE. Le portage des 297 articles a inséré le nouveau
 * Livre III dans le corps, mais SANS inscrire ses divisions au `toc`. Conséquences, toutes
 * visibles sur la charnière de l'article 634 :
 *   · « Livre Troisième — De l'Insolvabilité » se lisait comme un paragraphe ordinaire,
 *     indistinct du bandeau qui le suit — alors que « Livre Troisième — Des faillites et
 *     banqueroutes », dix lignes plus haut, est une division en titre ;
 *   · « LIVRE III — DE L'INSOLVABILITÉ » et les 71 divisions suivantes n'étaient NI
 *     navigables NI ancrées ;
 *   · les renvois d'index se raccrochaient à ces lignes au lieu des articles, faute de
 *     frontière de section.
 *
 * ⚠️ L'ORDRE DU `toc` EST L'ORDRE DU CORPS. `segmentAnnotated` l'avance ligne à ligne : une
 * entrée hors position ferait manquer toutes les suivantes. Les nouvelles s'insèrent donc
 * exactement là où leur ligne apparaît, entre l'ancien Livre III et le Livre Quatrième.
 *
 * ⚠️ ET LES ANCRES EXISTANTES NE BOUGENT PAS : `sec-1` à `sec-131` sont citées par l'index et
 * par les renvois. Les nouvelles prennent la suite.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DIV = /^(LIVRE\s+[IVX]+|TITRE\s+(?:PRÉLIMINAIRE|[IVX]+)|CHAPITRE\s+[IVX]+|Section\s+\d+|Sous-section\s+\d+)\s+—\s+/
const BANDEAU = /^Livre Troisième — De l’Insolvabilité \(rédaction du Décret/

function genre(l: string): { kind: string; level: number } {
  if (/^Livre|^LIVRE/.test(l)) return { kind: 'livre', level: 1 }
  if (/^TITRE/.test(l)) return { kind: 'titre', level: 3 }
  if (/^CHAPITRE/.test(l)) return { kind: 'chapitre', level: 3 }
  if (/^Section/.test(l)) return { kind: 'section', level: 4 }
  return { kind: 'section', level: 5 }
}

async function main() {
  const apply = process.argv.includes('--apply')
  const d = await prisma.document.findFirst({ where: { source: 'CODE_COMMERCE_ANNOTE' } })
  if (!d) { console.error('⛔ ARRÊT — Code de commerce absent.'); process.exit(1) }
  const ann = JSON.parse(String(d.annotationsJson ?? '{}'))
  const toc: { level: number; label: string; anchor: string; kind: string }[] = ann.toc ?? []
  const connus = new Set(toc.map((e) => e.label.replace(/\s+/g, ' ').trim()))
  const L = (d.bodyOriginal ?? '').split('\n').map((l) => l.trim())

  /**
   * ⚠️ LE SOMMAIRE DOIT SUIVRE LE CORPS LIGNE À LIGNE — et il ne le suivait pas.
   *
   * `segmentAnnotated` avance un pointeur dans le `toc` et ne recule jamais : une entrée hors
   * position fait manquer TOUTES les suivantes. Mesuré avant toute intervention de ma part :
   * **46 divisions reconnues sur 131**. Le pointeur atteignait « Section Première » (sec-40),
   * attendait ensuite « Section II — De la provision » (sec-21) — qui vient plus tôt dans le
   * corps — et décrochait là. Les 85 autres divisions du Code, dont tout le Livre Quatrième,
   * n'étaient ni ancrées ni navigables depuis le début.
   *
   * ⚠️ AUCUN LIBELLÉ N'EST PÉRIMÉ : les 131 se retrouvent tous dans le corps. Le seul défaut
   * est l'ORDRE. On reconstruit donc le sommaire en PARCOURANT LE CORPS : chaque ligne de
   * division consomme la prochaine entrée non encore employée qui porte ce libellé — ce qui
   * conserve les ancres existantes (citées par l'index) et respecte les libellés RÉPÉTÉS
   * (« Section Première » revient sous plusieurs chapitres : les apparier au premier venu
   * était précisément ce qui désordonnait le sommaire).
   */
  const norm = (x: string) => x.replace(/\s+/g, ' ').trim()
  const dispo = new Map<string, typeof toc>()
  for (const e of toc) {
    const k = norm(e.label)
    if (!dispo.has(k)) dispo.set(k, [])
    dispo.get(k)!.push(e)
  }
  const libelles = new Set(dispo.keys())
  let n = Math.max(0, ...toc.map((e) => Number(e.anchor.replace('sec-', '')) || 0))
  const fusion: { level: number; label: string; anchor: string; kind: string }[] = []
  let reutilisees = 0
  const ajout: { label: string; anchor: string; kind: string }[] = []
  for (const l of L) {
    const k = norm(l)
    const estDiv = libelles.has(k) || BANDEAU.test(l) || DIV.test(l)
    if (!estDiv) continue
    const file = dispo.get(k)
    if (file && file.length) { fusion.push(file.shift()!); reutilisees++; continue }
    const g = genre(l)
    const e = { ...g, label: l, anchor: `sec-${++n}` }
    fusion.push(e); ajout.push(e)
  }
  const orphelines = [...dispo.values()].flat()

  console.log('SOMMAIRE DU CODE DE COMMERCE — REMISE EN ORDRE\n')
  console.log(`   sommaire d'origine : ${toc.length} entrées`)
  console.log(`   divisions trouvées dans le corps : ${fusion.length}`)
  console.log(`   ancres réutilisées : ${reutilisees} · nouvelles : ${ajout.length} (sec-${n - ajout.length + 1} → sec-${n})`)
  console.log(`   entrées d'origine sans ligne correspondante : ${orphelines.length}${orphelines.length ? ' → ' + orphelines.slice(0, 4).map((e) => e.anchor).join(', ') : ' ✔'}`)
  const par = new Map<string, number>()
  for (const a of ajout) par.set(a.kind, (par.get(a.kind) ?? 0) + 1)
  console.log(`   ajouts par genre : ${[...par].map(([k, v]) => `${k} ${v}`).join(' · ') || '—'}`)

  if (!apply) { console.log('\n(simulation — ajouter --apply pour écrire)'); await prisma.$disconnect(); return }
  await prisma.document.update({ where: { id: d.id }, data: { annotationsJson: JSON.stringify({ ...ann, toc: fusion }) } })
  console.log(`\n✅ sommaire remis en ordre : ${fusion.length} divisions, dont ${ajout.length} nouvelles.`)
  await prisma.$disconnect()
}

main()
