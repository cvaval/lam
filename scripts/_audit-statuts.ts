/** Audit d'uniformité du vocabulaire des statuts d'articles, tous textes annotés. */
import { prisma } from '@/lib/db'
;(async () => {
  const docs = await prisma.document.findMany({
    where: { annotationsJson: { not: null } },
    select: { id: true, source: true, titleFr: true, annotationsJson: true },
  })
  const global: Record<string, number> = {}
  const lignes: string[] = []
  for (const d of docs) {
    let a: any
    try { a = JSON.parse(d.annotationsJson!) } catch { continue }
    const st = a.status as Record<string, string> | undefined
    if (!st || !Object.keys(st).length) continue
    const c: Record<string, number> = {}
    for (const v of Object.values(st)) { if (!v) continue; c[v] = (c[v] || 0) + 1; global[v] = (global[v] || 0) + 1 }
    // Règle d'affichage : « modifié » et « abrogé » doivent avoir une ancienne version repliable
    const ov = a.oldVersions ?? {}
    const sansOld = Object.entries(st).filter(([k, v]) => (v === 'modifié' || v === 'abrogé' || v === 'partiellement abrogé') && !ov[k])
    lignes.push(`  ${String(d.source).padEnd(30)} ${Object.entries(c).map(([k, n]) => `${k}×${n}`).join(' · ')}`
      + (sansOld.length ? `   ⚠ ${sansOld.length} sans ancienne version` : ''))
  }
  console.log('═══ VOCABULAIRE PAR DOCUMENT ═══')
  lignes.sort().forEach((l) => console.log(l))
  console.log('\n═══ VOCABULAIRE GLOBAL ═══')
  for (const [k, n] of Object.entries(global).sort((a, b) => b[1] - a[1])) console.log(`  « ${k} » ×${n}`)
  const interdits = Object.keys(global).filter((k) => /amend/i.test(k))
  console.log(`\n  terme « amendé » : ${interdits.length ? '✗ ' + interdits.join(', ') : '0 occurrence ✓ (terme écarté)'}`)
  const attendu = new Set(['modifié', 'nouveau', 'abrogé', 'partiellement abrogé'])
  const hors = Object.keys(global).filter((k) => !attendu.has(k))
  console.log(`  hors vocabulaire : ${hors.length ? '✗ ' + hors.join(', ') : '0 ✓'}`)
  await prisma.$disconnect()
})().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1) })
