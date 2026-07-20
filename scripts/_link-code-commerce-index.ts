/**
 * INDEX MAÎTRE Vandal — liaison multi-documents (tâche 3 du téléversement) :
 *   1. résout chaque désignation datée de l'index (« D. 28 août 1960 ») vers le
 *      document plateforme (titre primaire d'abord ; ambiguïtés → tous les
 *      candidats, consignés) ;
 *   2. sujets PROPRES à chaque satellite → indexEntries de son annotationsJson
 *      (ancres validées contre ses labels — anti-lien-mort) ;
 *   3. sujets du CODE enrichis de docRefs (liens « D. 28 août 1960, art 6 › »
 *      vers /doc/{id}#art-6) — pages imprimées remplacées par ces liens ;
 *   4. CrossRef EDITORIAL « VOIR » Code → chaque texte cité par l'index (le
 *      rétrolien « cité par » apparaît automatiquement sur le satellite), et
 *      Code → Code des douanes pour les renvois « Code douanier ».
 * Relançable (recalcule annotationsJson.indexEntries et remplace les CrossRef
 * note='Index Vandal'). Écrit le rapport de résolution dans
 * scripts/data/code-commerce/parsed/resolution-report.json.
 *
 *   npx tsx scripts/_link-code-commerce-index.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'

const DATA = 'scripts/data/code-commerce'
const MONTHS = ['', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const NAT_LABEL: Record<string, string> = { decret: 'D.', loi: 'L.', arrete: 'Arr.', reglement: 'Règl.' }
const NAT_TITLE: Record<string, RegExp> = {
  decret: /^(décret(-loi)?)/i,
  loi: /^loi/i,
  arrete: /^arrêté/i,
  reglement: /^règlements?/i,
}

function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

interface Ref { target: string; arts?: string[]; regles?: string[]; pages?: string[] }
interface Sub { label: string; refs: Ref[]; voir: string[] }
interface Entry { subject: string; subs: Sub[] }

async function main() {
  const master: Entry[] = JSON.parse(readFileSync(`${DATA}/parsed/index-master.json`, 'utf8'))

  // ── Documents du lot ──
  const sats = await prisma.document.findMany({
    where: { source: { startsWith: 'CC_VANDAL_' } },
    select: { id: true, titleFr: true, source: true, annotationsJson: true, metaJson: true, publicationDate: true },
  })
  const code = await prisma.document.findFirstOrThrow({
    where: { source: 'CODE_COMMERCE_ANNOTE' },
    select: { id: true, annotationsJson: true },
  })
  const douanes = await prisma.document.findFirst({
    where: { source: 'CODE_DOUANES_ANNOTE', type: 'LEGISLATION' },
    select: { id: true, annotationsJson: true },
  })

  // ── 1) Résolution désignation datée → documents ──
  // clé 'decret:28:8:1960' ; primaire = le TITRE commence par la nature ET contient la date.
  const keys = new Set<string>()
  for (const e of master) for (const s of e.subs) for (const r of s.refs) if (/^(decret|loi|arrete|reglement):/.test(r.target)) keys.add(r.target)

  const resolution: Record<string, { docs: { id: string; vandalId: string; title: string }[]; primary: boolean }> = {}
  const anomalies: string[] = []
  for (const key of keys) {
    const [nat, d, mo, y] = key.split(':')
    const dayLabel = d === '1' ? '1er' : d
    const dateRe = new RegExp(`\\b(du|des)\\s+${dayLabel === '1er' ? '1er' : d}\\s+${fold(MONTHS[Number(mo)] ?? '')}\\.?\\s+${y}\\b`)
    const matches = sats.filter((s) => dateRe.test(fold(s.titleFr)))
    const primary = matches.filter((s) => NAT_TITLE[nat]?.test(s.titleFr.trim()))
    const chosen = primary.length ? primary : matches
    resolution[key] = {
      primary: primary.length > 0,
      docs: chosen.map((s) => ({ id: s.id, vandalId: JSON.parse(s.metaJson ?? '{}').vandalId ?? s.source, title: s.titleFr })),
    }
    if (chosen.length === 0) anomalies.push(`désignation hors lot : ${NAT_LABEL[nat] ?? nat} ${dayLabel} ${MONTHS[Number(mo)] ?? mo} ${y}`)
    if (chosen.length > 1) anomalies.push(`désignation ambiguë (${chosen.length} textes) : ${NAT_LABEL[nat] ?? nat} ${dayLabel} ${MONTHS[Number(mo)] ?? mo} ${y} → ${chosen.map((c) => JSON.parse(c.metaJson ?? '{}').vandalId ?? '?').join(', ')}`)
  }

  const label = (key: string, art?: string) => {
    const [nat, d, mo, y] = key.split(':')
    return `${NAT_LABEL[nat] ?? nat} ${d === '1' ? '1er' : d} ${(MONTHS[Number(mo)] ?? mo).slice(0, 4)}${(MONTHS[Number(mo)] ?? '').length > 4 ? '.' : ''} ${y}${art ? `, art ${art}` : ''}`
  }

  // ── 2) indexEntries par satellite + 3) docRefs du Code ──
  const bySat = new Map<string, Map<string, Set<string>>>() // docId → sujet → arts
  const codeDocRefs = new Map<string, Map<string, { label: string; id: string; anchor?: string }>>() // sujet → refs
  let deadSat = 0
  for (const e of master) {
    for (const s of e.subs) {
      for (const r of s.refs) {
        if (r.target === 'code') continue
        let targets: { id: string; labels: Set<string> | null }[] = []
        if (/^(decret|loi|arrete|reglement):/.test(r.target)) {
          targets = (resolution[r.target]?.docs ?? []).map((dd) => {
            const sat = sats.find((x) => x.id === dd.id)!
            const st = sat.annotationsJson ? JSON.parse(sat.annotationsJson) : null
            return { id: dd.id, labels: st ? new Set(Object.keys(st.labels ?? {})) : null }
          })
        } else if (r.target === 'douanier' && douanes) {
          const st = douanes.annotationsJson ? JSON.parse(douanes.annotationsJson) : null
          targets = [{ id: douanes.id, labels: st ? new Set(Object.keys(st.labels ?? {})) : null }]
        } else {
          continue // conventions : traitées par leurs propres clés datées quand elles en ont
        }
        for (const t of targets) {
          const arts = (r.arts ?? []).concat(r.regles ?? [])
          // sujets du satellite (ancres internes valides seulement)
          const valid = arts.filter((a) => !t.labels || t.labels.has(`art-${a}`))
          deadSat += arts.length - valid.length
          if (t.id !== douanes?.id && valid.length) {
            const subj = bySat.get(t.id) ?? new Map<string, Set<string>>()
            const set = subj.get(e.subject) ?? new Set<string>()
            valid.forEach((a) => set.add(a))
            subj.set(e.subject, set)
            bySat.set(t.id, subj)
          }
          // docRefs côté Code : un lien par (sujet, doc) vers le 1er article cité (ou le doc)
          const refs = codeDocRefs.get(e.subject) ?? new Map()
          const first = valid[0]
          const key = r.target === 'douanier' ? 'douanier' : r.target
          const lbl = r.target === 'douanier' ? `Code douanier${first ? `, art ${first}` : ''}` : label(key, first)
          refs.set(`${t.id}#${lbl}`, { label: lbl, id: t.id, ...(first ? { anchor: `art-${first}` } : {}) })
          codeDocRefs.set(e.subject, refs)
        }
      }
    }
  }

  // Écrit indexEntries des satellites (merge annotationsJson) + réindexe
  let satUpdated = 0
  for (const [docId, subjects] of bySat) {
    const sat = sats.find((s) => s.id === docId)!
    const st = sat.annotationsJson ? JSON.parse(sat.annotationsJson) : null
    if (!st) continue
    st.indexEntries = [...subjects.entries()]
      .map(([subject, arts]) => ({
        subject,
        ctRefs: [...arts].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })).map((a) => (/^\d+$/.test(a) ? Number(a) : a)),
      }))
      .sort((a, b) => fold(a.subject).localeCompare(fold(b.subject)))
    await prisma.document.update({ where: { id: docId }, data: { annotationsJson: JSON.stringify(st) } })
    await reindexDocument(docId)
    satUpdated++
  }

  // Écrit docRefs du Code (merge sur les indexEntries existants, sujets sans refs internes ajoutés)
  const codeSt = JSON.parse(code.annotationsJson!)
  const byName = new Map<string, any>((codeSt.indexEntries as any[]).map((e) => [e.subject, e]))
  for (const [subject, refs] of codeDocRefs) {
    const entry = byName.get(subject) ?? { subject, ctRefs: [] }
    entry.docRefs = [...refs.values()].sort((a, b) => a.label.localeCompare(b.label))
    byName.set(subject, entry)
  }
  // Alias de l'index (« Nolissement, V. Affrètement » : sujet sans référence propre) →
  // reprennent les renvois de leur sujet cible : trouvables dans l'index latéral ET par
  // la recherche (annotationsText).
  const byFold = new Map([...byName.values()].map((e) => [fold(e.subject), e]))
  let aliases = 0
  for (const e of master) {
    const hasRefs = e.subs.some((s) => s.refs.length > 0)
    if (hasRefs || byFold.has(fold(e.subject))) continue
    for (const s of e.subs) {
      for (const v of s.voir) {
        const target = byFold.get(fold(v)) ?? byFold.get(fold(v.split(',')[0]))
        if (target) {
          byName.set(e.subject, { subject: e.subject, ctRefs: target.ctRefs, docRefs: target.docRefs })
          aliases++
          break
        }
      }
      if (byName.has(e.subject)) break
    }
  }
  console.log(`Alias d'index résolus (« V. sujet ») : ${aliases}`)
  codeSt.indexEntries = [...byName.values()].sort((a, b) => fold(a.subject).localeCompare(fold(b.subject)))
  await prisma.document.update({ where: { id: code.id }, data: { annotationsJson: JSON.stringify(codeSt) } })
  await reindexDocument(code.id)

  // ── 4) CrossRef Code → textes cités (relançable : remplace les nôtres) ──
  await prisma.crossRef.deleteMany({ where: { fromId: code.id, note: 'Index Vandal' } })
  const cited = new Map<string, string>() // docId → libellé
  for (const refs of codeDocRefs.values()) for (const r of refs.values()) if (!cited.has(r.id)) cited.set(r.id, r.label.replace(/, art .*$/, ''))
  let pos = 0
  for (const [toId] of cited) {
    const to = toId === douanes?.id ? { titleFr: 'Code des douanes' } : sats.find((s) => s.id === toId)
    await prisma.crossRef.create({
      data: {
        fromId: code.id, toId, kind: 'VOIR', source: 'EDITORIAL', note: 'Index Vandal',
        toLabel: (to as any)?.titleFr?.slice(0, 180) ?? null, position: pos++,
      },
    })
  }

  const report = { resolution, anomalies, satellites: satUpdated, codeSubjectsWithDocRefs: codeDocRefs.size, crossRefs: cited.size, deadSatRefs: deadSat }
  writeFileSync(`${DATA}/parsed/resolution-report.json`, JSON.stringify(report, null, 1))
  console.log(`Désignations résolues : ${Object.values(resolution).filter((r) => r.docs.length > 0).length}/${keys.size} (primaires : ${Object.values(resolution).filter((r) => r.primary).length})`)
  console.log(`Satellites avec index : ${satUpdated} · sujets du Code avec docRefs : ${codeDocRefs.size} · CrossRef créés : ${cited.size}`)
  console.log(`Refs satellites invalides (ancres absentes, sans lien mort) : ${deadSat}`)
  console.log(`Anomalies (${anomalies.length}) :`)
  anomalies.slice(0, 25).forEach((a) => console.log('  ·', a))
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
