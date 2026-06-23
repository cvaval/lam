/**
 * Import de la table des tarifs douaniers (Système Harmonisé 2022, NDP Haïti) dans
 * CustomsTariff, depuis le CSV audité (audit_statut=VALIDÉ pour 100 % des lignes).
 *
 *   npx tsx scripts/import-tarifs.ts            (analyse + simulation, aucune écriture)
 *   npx tsx scripts/import-tarifs.ts --commit   (PURGE puis recharge la table)
 *
 * Mapping : code ← ndp_formatted · designation ← libelle (tirets = hiérarchie SH) ·
 * unite ← unite_normalisee · dd ← droit_douane_pct formaté « X % » · chapter ← chapitre ·
 * position ← Number(ndp_code) (ordre intra-chapitre). tca/accises = null (absents du CSV).
 * Idempotent : --commit fait deleteMany puis recharge (miroir exact du CSV).
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { audit } from '../src/lib/auth/audit'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)
const prisma = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL || env.DATABASE_URL } } })
const COMMIT = process.argv.includes('--commit')
const CSV = '/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur/Douane/tarifs_douaniers_haiti_ndp_sh2022_audites.csv'

/** Parseur CSV à automate : gère les guillemets, virgules et sauts de ligne encadrés. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let q = false
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text // BOM
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++ } else q = false }
      else field += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (c === '\r') { /* ignore */ }
    else field += c
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows
}

/** Taux douanier « 0.0 » → « 0 % », « 3.5 » → « 3,5 % », « 0.82 » → « 0,82 % ». */
function fmtDd(v: string): string | null {
  const t = (v ?? '').trim()
  if (!t) return null
  const n = Number(t)
  if (!Number.isFinite(n)) return t
  return (Number.isInteger(n) ? String(n) : String(n).replace('.', ',')) + ' %'
}
const norm = (v: string | undefined) => { const s = (v ?? '').trim(); return s ? s : null }

async function main() {
  const all = parseCsv(readFileSync(CSV, 'utf8'))
  const header = all[0]
  const idx = (name: string) => header.indexOf(name)
  const iCode = idx('ndp_formatted'), iRaw = idx('ndp_code'), iLib = idx('libelle')
  const iUnite = idx('unite_normalisee'), iDd = idx('droit_douane_pct'), iChap = idx('chapitre'), iAudit = idx('audit_statut')
  if ([iCode, iRaw, iLib, iUnite, iDd, iChap].some((i) => i < 0)) { console.error('Colonnes manquantes', header); process.exit(1) }

  const data: { code: string; searchCode: string | null; designation: string; unite: string | null; dd: string | null; tca: null; accises: null; note: null; chapter: string | null; position: number }[] = []
  let skipped = 0
  let nonValide = 0
  for (let r = 1; r < all.length; r++) {
    const row = all[r]
    if (!row || row.length < header.length) { if (row && row.join('').trim()) skipped++; continue }
    const code = (row[iCode] ?? '').trim()
    const designation = (row[iLib] ?? '').trim()
    if (!code || !designation) { skipped++; continue }
    if ((row[iAudit] ?? '').trim() !== 'VALIDÉ') nonValide++
    data.push({
      code, searchCode: norm((row[iRaw] ?? '').replace(/\D/g, '')), designation,
      unite: norm(row[iUnite]),
      dd: fmtDd(row[iDd]),
      tca: null, accises: null, note: null,
      chapter: norm(row[iChap]),
      position: Number((row[iRaw] ?? '').replace(/\D/g, '')) || 0,
    })
  }

  // Analyse
  const codes = new Set(data.map((d) => d.code))
  const chapters = new Set(data.map((d) => d.chapter))
  const ddDist = new Map<string, number>()
  for (const d of data) ddDist.set(d.dd ?? '∅', (ddDist.get(d.dd ?? '∅') ?? 0) + 1)
  console.log(`CSV : ${all.length - 1} lignes de données · à importer : ${data.length} · ignorées : ${skipped} · non-VALIDÉ : ${nonValide}`)
  console.log(`codes uniques : ${codes.size} (doublons : ${data.length - codes.size}) · chapitres : ${chapters.size}`)
  console.log(`taux : ${[...ddDist.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join('  ')}`)
  console.log('échantillon :', data.slice(0, 3).map((d) => `${d.code} | ${d.dd} | ${d.unite} | ${d.designation.slice(0, 40)}`))

  if (!COMMIT) { console.log('\nSIMULATION — relancer avec --commit pour charger.'); await prisma.$disconnect(); return }

  const before = await prisma.customsTariff.count()
  await prisma.customsTariff.deleteMany({})
  let created = 0
  for (let i = 0; i < data.length; i += 1000) {
    const res = await prisma.customsTariff.createMany({ data: data.slice(i, i + 1000) })
    created += res.count
  }
  await audit({ action: 'DOC_PUBLISHED', targetType: 'TARIFF', meta: { op: 'bulk-import', source: 'tarifs_douaniers_haiti_ndp_sh2022_audites.csv', purged: before, created } }, prisma)
  console.log(`\n✓ purge ${before} → ${created} positions chargées.`)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
