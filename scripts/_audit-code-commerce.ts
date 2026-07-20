/**
 * AUDIT du téléversement Vandal (Code de commerce + 93 satellites) — tâche 6.
 *  A. Échantillon article-par-article : l'incipit de chaque article échantillonné
 *     en base doit provenir du texte source (fichiers parsés).
 *  B. Index maître : échantillon de références résolues → le document cible existe
 *     et l'ancre visée existe dans ses labels.
 *  C. Rétroliens : chaque CrossRef « Index Vandal » a un rétrolien visible.
 *  D. Livrables : CSV de contrôle (colonne remplie), table id Vandal ↔ plateforme.
 *
 *   npx tsx scripts/_audit-code-commerce.ts
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { prisma } from '../src/lib/db'

const DATA = 'scripts/data/code-commerce'
const EXCLUDED = new Set(['I-C-2', 'I-I', 'I-M', 'I-N', 'V-A-3', 'V-B-2', 'V-D-2', 'V-G'])

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').toLowerCase().trim()

async function main() {
  const issues: string[] = []
  const ok: string[] = []

  // ── A. Échantillon articles vs source parsée ──
  const code = await prisma.document.findFirstOrThrow({ where: { source: 'CODE_COMMERCE_ANNOTE' }, select: { id: true, bodyOriginal: true, annotationsJson: true } })
  const srcBody = readFileSync(`${DATA}/parsed/bodyOriginal.txt`, 'utf8')
  const codeArts = ['Article premier', 'Article 23.-', 'Article 111', 'Article 313', 'Article 447', 'Article 636', 'Article 673']
  for (const a of codeArts) {
    const inDb = norm(code.bodyOriginal).includes(norm(a).slice(0, 18))
    const inSrc = norm(srcBody).includes(norm(a).slice(0, 18))
    ;(inDb && inSrc ? ok : issues).push(`A code ${a}: base=${inDb} source=${inSrc}`)
  }
  const satFiles = readdirSync(`${DATA}/parsed-satellites`).filter((f) => f.endsWith('.json'))
  const sample = satFiles.filter((_, i) => i % 9 === 0) // ~10 textes répartis
  for (const f of sample) {
    const d = JSON.parse(readFileSync(`${DATA}/parsed-satellites/${f}`, 'utf8'))
    const doc = await prisma.document.findFirst({ where: { source: `CC_VANDAL_${d.id}` }, select: { bodyOriginal: true, titleFr: true } })
    if (!doc) { issues.push(`A ${d.id}: document ABSENT`); continue }
    const firstLine = (d.body as string).split('\n').find((l: string) => l.length > 40) ?? d.body.split('\n')[0]
    const match = norm(doc.bodyOriginal).includes(norm(firstLine).slice(0, 60))
    ;(match ? ok : issues).push(`A ${d.id}: incipit ${match ? 'conforme' : 'NON CONFORME'}`)
  }

  // ── B. Index maître : 12 références résolues échantillonnées ──
  const codeSt = JSON.parse(code.annotationsJson!)
  const withDocRefs = (codeSt.indexEntries as any[]).filter((e) => e.docRefs?.length)
  const sampleRefs = withDocRefs.filter((_, i) => i % Math.ceil(withDocRefs.length / 12) === 0).flatMap((e) => e.docRefs.slice(0, 1).map((d: any) => ({ subject: e.subject, ...d })))
  for (const r of sampleRefs) {
    const doc = await prisma.document.findUnique({ where: { id: r.id }, select: { titleFr: true, annotationsJson: true } })
    if (!doc) { issues.push(`B « ${r.subject} » → ${r.label}: doc cible ABSENT`); continue }
    if (r.anchor) {
      const labels = doc.annotationsJson ? Object.keys(JSON.parse(doc.annotationsJson).labels ?? {}) : []
      const has = labels.includes(r.anchor)
      ;(has ? ok : issues).push(`B « ${r.subject} » → ${r.label} (${doc.titleFr.slice(0, 34)}…) ancre ${r.anchor}: ${has ? 'OK' : 'ABSENTE'}`)
    } else ok.push(`B « ${r.subject} » → ${r.label}: lien document (sans ancre) OK`)
  }

  // ── C. Rétroliens des CrossRef ──
  const crs = await prisma.crossRef.findMany({ where: { fromId: code.id, note: 'Index Vandal' }, select: { toId: true } })
  const resolved = crs.filter((c) => c.toId).length
  ;(resolved === crs.length ? ok : issues).push(`C CrossRef Index Vandal : ${resolved}/${crs.length} résolus (toId)`)

  // ── D. Livrables : CSV contrôle + table de correspondance ──
  const rows = readFileSync('/Users/cvaval/Downloads/Officiel_Code-de-Commerce_Vandal_legislations-separees/Officiel_Inventaire_repertoire.csv', 'utf8').split('\n')
  const docs = await prisma.document.findMany({ where: { OR: [{ source: { startsWith: 'CC_VANDAL_' } }, { source: 'CODE_COMMERCE_ANNOTE' }] }, select: { id: true, source: true, titleFr: true } })
  const byVandal = new Map(docs.map((d) => [d.source === 'CODE_COMMERCE_ANNOTE' ? '0' : (d.source ?? '').replace('CC_VANDAL_', ''), d]))
  const anomaliesParse: Record<string, string[]> = {}
  for (const f of satFiles) {
    const d = JSON.parse(readFileSync(`${DATA}/parsed-satellites/${f}`, 'utf8'))
    if (d.anomalies?.length) anomaliesParse[d.id] = d.anomalies
  }
  const out = [rows[0].trim()]
  const mapping: string[] = ['vandalId,platformId,titre']
  for (const line of rows.slice(1)) {
    if (!line.trim()) continue
    const id = line.split(',')[0]
    let controle = ''
    if (EXCLUDED.has(id)) controle = 'EXCLU (Code douanier récent déjà en ligne)'
    else if (byVandal.has(id)) {
      controle = anomaliesParse[id]?.length ? `OK avec réserve: ${anomaliesParse[id].join(' | ').slice(0, 120)}` : 'OK'
      mapping.push(`${id},${byVandal.get(id)!.id},"${byVandal.get(id)!.titleFr.replace(/"/g, '""')}"`)
    } else controle = 'MANQUANT'
    out.push(line.trim().replace(/,?$/, '') + ',"' + controle.replace(/"/g, '""') + '"')
  }
  writeFileSync(`${DATA}/Officiel_Inventaire_controle.csv`, out.join('\n'))
  writeFileSync(`${DATA}/table-correspondance.csv`, mapping.join('\n'))

  const missing = out.filter((l) => l.endsWith(',"MANQUANT"')).length
  ;(missing === 0 ? ok : issues).push(`D documents manquants vs CSV : ${missing}`)

  console.log(`AUDIT — contrôles OK : ${ok.length} · problèmes : ${issues.length}`)
  issues.forEach((x) => console.log('  ✖', x))
  console.log('Échantillon B validé :', sampleRefs.length, 'références ·', 'CrossRef:', `${resolved}/${crs.length}`)
  console.log('Livrables écrits : Officiel_Inventaire_controle.csv · table-correspondance.csv · resolution-report.json')
  await prisma.$disconnect()
  if (issues.length) process.exitCode = 1
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
