/** VÉRIFICATION ADVERSE — LECTURE SEULE, aucun accès base.
 *  Rejoue le chemin exact de la page : annotationsJson (tel que l'import l'écrit)
 *  → parseAnnotations → AnnotatedText (pointMode + segmentAnnotated).
 */
import { readFileSync } from 'fs'
import { parseAnnotations, segmentAnnotated } from '../src/lib/legislation/annotated'

const CIRCS = [
  { name: '105-2', dir: 'scripts/data/circ-brh-105-2', clean: true },
  { name: '117-1', dir: 'scripts/data/circ-brh-117-1', clean: false },
]

for (const c of CIRCS) {
  const st = JSON.parse(readFileSync(`${c.dir}/_struct.json`, 'utf8'))
  const raw = JSON.parse(readFileSync(`${c.dir}/_index.json`, 'utf8'))
  const body = readFileSync(`${c.dir}/_body.txt`, 'utf8').trimEnd()
  const clean = c.clean ? readFileSync(`${c.dir}/_clean.txt`, 'utf8').trimEnd() : null
  const shown = clean ?? body

  const annotations = {
    title: c.name,
    annotationAuthor: 'Lam Veritab',
    navToc: st.navToc,
    toc: st.toc,
    connexes: [],
    jurisprudence: {},
    indexEntries: raw.map((e: any) => ({ subject: e.subject, ctRefs: e.ctRefs })),
    labels: st.labels,
    pointAnchors: st.points,
  }
  const json = JSON.stringify(annotations)

  const parsed = parseAnnotations(json)!
  console.log(`\n===== ${c.name} =====`)
  console.log('  JSON stocké    → pointAnchors :', (annotations.pointAnchors ?? []).length, 'entrées')
  console.log('  parseAnnotations→ pointAnchors :', (parsed as any).pointAnchors)
  const pointModePage = ((parsed as any).pointAnchors ?? []).length > 0
  console.log('  pointMode (AnnotatedText l.65) :', pointModePage)

  const blocksPage = segmentAnnotated(shown, parsed.toc ?? [], (parsed as any).pointAnchors)
  const blocksWant = segmentAnnotated(shown, st.toc, st.points)
  const anch = (bs: any[]) => bs.filter((b) => b.anchor).map((b) => b.anchor)
  console.log(`  blocs PAGE  : ${blocksPage.length}  ancres : ${anch(blocksPage).length}`)
  console.log(`  blocs VOULU : ${blocksWant.length}  ancres : ${anch(blocksWant).length}`)
  console.log('  ancres PAGE :', anch(blocksPage).slice(0, 30).join(', ') || '(aucune)')

  const live = new Set(anch(blocksPage))
  const wantedArt = st.points.map((p: string) => `art-${p.replace(/\./g, '-')}`)
  console.log('  ancres art-… mortes (PAGE) :', wantedArt.filter((a: string) => !live.has(a)).length, '/', wantedArt.length)
  const navAnchors = (JSON.stringify(st.navToc).match(/"anchor":"([^"]+)"/g) ?? []).map((m) => m.slice(10, -1))
  console.log('  sommaire latéral : liens morts', navAnchors.filter((a) => !live.has(a)).length, '/', navAnchors.length)
  const idxAnchors = [...new Set(raw.flatMap((e: any) => e.ctRefs.map((r: string) => `art-${r}`)))] as string[]
  console.log('  index : cibles mortes', idxAnchors.filter((a) => !live.has(a)).length, '/', idxAnchors.length)
  const labelKeys = Object.keys(st.labels ?? {})
  console.log('  labels « Point N » rendus :', labelKeys.filter((a) => live.has(a)).length, '/', labelKeys.length)
  if (blocksPage.length <= 2) console.log('  longueur du bloc unique :', blocksPage[0]?.text.length, 'caractères')
}
