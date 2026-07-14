/**
 * AUDIT STRUCTUREL du Code civil annoté (source CODE_CIVIL_ANNOTE, « Législation annotée »).
 *
 * LECTURE SEULE — n'écrit rien. Rejouable à volonté ; à relancer après tout ré-import ou
 * enrichissement (index IA, jurisprudence, amendements) pour vérifier la non-régression.
 *
 * Contrôle :
 *   1. Fiche document + thèmes + poids des champs
 *   2. Anatomie de annotationsJson (12 clés)
 *   3. Segmentation : appariement toc↔corps, ancres, doublons, lacunes de numérotation
 *   4. Clés ORPHELINES (jurisprudence/commentaires/connexe/oldVersions/status/labels qui
 *      n'atteignent aucun bloc affiché) — le défaut qui avait fait disparaître la
 *      jurisprudence de l'art. 6 du Code du travail
 *   5. Index alphabétique : renvois morts, couverture
 *   6. Amendements : les DEUX mécanismes (overlay ArticleVersion ↔ badge annotationsJson)
 *   7. Liens sortants (connexe.docId, crossRefs.docs) : documents cibles existants
 *
 *   npx tsx scripts/_audit-code-civil.ts
 */
import { prisma } from '../src/lib/db'
import { segmentAnnotated, indexBacklinks, type Annotations, type AnnBlock } from '../src/lib/legislation/annotated'

type BodyBlock = Extract<AnnBlock, { kind: 'body' }>
const SOURCE = 'CODE_CIVIL_ANNOTE'
const ok = (b: boolean) => (b ? '✓' : '✗')

async function main() {
  const doc = await prisma.document.findFirst({ where: { source: SOURCE } })
  if (!doc?.annotationsJson || !doc.bodyOriginal) throw new Error(`${SOURCE} introuvable ou sans annotations`)
  const a = JSON.parse(doc.annotationsJson) as Annotations & Record<string, any>
  const body = doc.bodyOriginal

  // ── 1. Fiche ──
  console.log(`\n══ 1. DOCUMENT ══`)
  console.log(`  id ${doc.id} · ${doc.type} · ${doc.status} · matière « ${doc.matiere} »`)
  console.log(`  « ${doc.titleFr} » — ${doc.number}`)
  console.log(`  corps ${(body.length / 1024).toFixed(0)} Ko (${body.split('\n').length} lignes) · annotations ${(doc.annotationsJson.length / 1024).toFixed(0)} Ko · searchText ${((doc.searchText?.length ?? 0) / 1024).toFixed(0)} Ko`)

  // ── 2. Anatomie annotationsJson ──
  console.log(`\n══ 2. annotationsJson ══`)
  for (const k of Object.keys(a)) {
    const v = a[k]
    const shape = Array.isArray(v) ? `array[${v.length}]` : v && typeof v === 'object' ? `object{${Object.keys(v).length}}` : typeof v
    console.log(`  ${k.padEnd(17)} ${shape.padEnd(18)} ${(JSON.stringify(v).length / 1024).toFixed(1)} Ko`)
  }

  // ── 3. Segmentation ──
  const blocks = segmentAnnotated(body, a.toc)
  const bodies = blocks.filter((b): b is BodyBlock => b.kind === 'body')
  const secs = blocks.filter((b) => b.kind === 'section')
  const arts = bodies.filter((b) => b.anchor)
  const anchors = arts.map((b) => b.anchor as string)
  const uniq = new Set(anchors)
  const dupes = [...new Set(anchors.filter((x, i) => anchors.indexOf(x) !== i))]
  console.log(`\n══ 3. SEGMENTATION ══`)
  console.log(`  en-têtes toc appariés : ${secs.length}/${a.toc.length} ${ok(secs.length === a.toc.length)}`)
  console.log(`  articles : ${arts.length} · ancres distinctes ${uniq.size} · doublons ${dupes.length ? dupes.join(',') : 'aucun ' + ok(true)}`)
  console.log(`  blocs de corps SANS ancre (intertitres hors toc) : ${bodies.length - arts.length}`)
  const gaps: number[] = []
  const maxArt = Math.max(...[...uniq].map((s) => Number(s.replace('art-', ''))).filter(Number.isInteger))
  for (let n = 1; n <= maxArt; n++) if (!uniq.has(`art-${n}`)) gaps.push(n)
  console.log(`  numérotation 1..${maxArt} · lacunes : ${gaps.length ? gaps.join(', ') : 'aucune ' + ok(true)}`)

  // ── 4. Clés orphelines ──
  console.log(`\n══ 4. CLÉS ORPHELINES (n'atteignent aucun bloc affiché) ══`)
  const usedJuris = new Set(bodies.map((b) => b.jurisKey).filter(Boolean) as string[])
  const check = (m: Record<string, unknown> | undefined, name: string, byAnchor: boolean) => {
    if (!m) return
    const bad = Object.keys(m).filter((k) => (byAnchor ? !uniq.has(k) : !usedJuris.has(k)))
    console.log(`  ${name.padEnd(14)} ${String(Object.keys(m).length).padStart(4)} clés · orphelines : ${bad.length ? bad.join(', ') : 'aucune ' + ok(true)}`)
  }
  check(a.jurisprudence, 'jurisprudence', false)
  check(a.commentaires, 'commentaires', false)
  check(a.connexe, 'connexe', true)
  check(a.oldVersions, 'oldVersions', true)
  check(a.status, 'status', true)
  check(a.labels, 'labels', true)

  // ── 5. Index ──
  const bl = indexBacklinks(a.indexEntries)
  const refs = a.indexEntries.flatMap((e) => e.ctRefs ?? [])
  const dead = [...new Set(refs.filter((r) => !uniq.has(`art-${r}`)))]
  console.log(`\n══ 5. INDEX ALPHABÉTIQUE ══`)
  console.log(`  ${a.indexEntries.length} sujets · ${refs.length} renvois (${(refs.length / a.indexEntries.length).toFixed(1)}/sujet)`)
  console.log(`  couverture : ${bl.size}/${uniq.size} articles · renvois morts : ${dead.length ? dead.join(', ') : 'aucun ' + ok(true)}`)
  console.log(`  articles sans entrée d'index : ${[...uniq].filter((x) => !bl.has(x)).join(', ') || 'aucun'}`)

  // ── 6. Amendements : les deux mécanismes ──
  const avs = await prisma.articleVersion.findMany({ where: { documentId: doc.id }, orderBy: [{ anchor: 'asc' }, { seq: 'asc' }] })
  const avAnchors = new Set(avs.map((v) => v.anchor))
  const statusKeys = Object.keys(a.status ?? {})
  const badgeOnly = statusKeys.filter((k) => !avAnchors.has(k))
  const bare = badgeOnly.filter((k) => !a.oldVersions?.[k] && !a.connexe?.[k])
  console.log(`\n══ 6. AMENDEMENTS ══`)
  console.log(`  (A) overlay ArticleVersion : ${avs.length} lignes / ${avAnchors.size} articles — ${JSON.stringify(avs.reduce((c: any, v) => ((c[v.status] = (c[v.status] ?? 0) + 1), c), {}))}`)
  console.log(`      ancres hors corps : ${avs.filter((v) => !uniq.has(v.anchor)).map((v) => v.anchor).join(', ') || 'aucune ' + ok(true)}`)
  console.log(`  (B) badge annotationsJson seul (texte déjà consolidé) : ${badgeOnly.length} articles`)
  console.log(`  ⚠ badge SANS aucune explication (ni ancienne version, ni note connexe, ni overlay) : ${bare.length}`)
  if (bare.length) console.log(`      ${bare.map((k) => k.replace('art-', '')).join(', ')}`)

  // ── 7. Liens sortants ──
  const cxDocIds = [...new Set(Object.values(a.connexe ?? {}).flat().map((b: any) => b.docId).filter(Boolean))] as string[]
  const xrDocIds = [...new Set((a.crossRefs ?? []).flatMap((c) => (c.docs ?? []).map((d) => d.id)))]
  const ids = [...new Set([...cxDocIds, ...xrDocIds])]
  const found = await prisma.document.findMany({ where: { id: { in: ids } }, select: { id: true, titleFr: true } })
  console.log(`\n══ 7. LIENS SORTANTS ══`)
  console.log(`  documents cibles : ${ids.length} · résolus : ${found.length} ${ok(ids.length === found.length)}`)
  for (const f of found) console.log(`    ${f.id} → ${f.titleFr}`)
  const missing = ids.filter((i) => !found.some((f) => f.id === i))
  if (missing.length) console.log(`  ⚠ LIENS MORTS : ${missing.join(', ')}`)
  const secAnchors = new Set(a.toc.map((t) => t.anchor))
  const badXr = (a.crossRefs ?? []).filter((c) => !secAnchors.has(c.anchor))
  console.log(`  crossRefs sur ancre inconnue : ${badXr.length ? badXr.map((c) => c.anchor).join(', ') : 'aucun ' + ok(true)}`)

  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
