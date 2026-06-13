/**
 * Import de l'Index du Moniteur (1900-2023) dans le corpus Lam.
 * ~28 000 entrées → documents du service « Index » (références seules, type INDEX)
 * + extraction des sociétés et marques vers l'index transversal (§01).
 *
 * Idempotent : supprime puis ré-importe tout ce qui porte source='MONITEUR'
 * (préfixe 'idx-' pour les sociétés). Importable par le seed (npm run setup) ou
 * autonome : npm run import:index
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { buildSearchText, fold } from '../src/lib/search/normalize'
import { audit } from '../src/lib/auth/audit'
import type { IndexCategory } from '../src/lib/types'

const MONTHS: Record<string, number> = {
  janvier: 0, fevrier: 1, mars: 2, avril: 3, mai: 4, juin: 5,
  juillet: 6, aout: 7, septembre: 8, octobre: 9, novembre: 10, decembre: 11,
}

function parseFrenchDate(raw: string | undefined, fallbackYear: number): Date {
  const fb = new Date(Date.UTC(fallbackYear, 0, 1))
  if (!raw) return fb
  const m = fold(raw).match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/)
  if (!m) return fb
  const day = Number(m[1])
  const month = MONTHS[m[2]]
  const year = Number(m[3])
  if (month == null || !year) return fb
  const d = new Date(Date.UTC(year, month, Math.min(day || 1, 28)))
  return isNaN(d.getTime()) ? fb : d
}

// Sous-catégorie (conservée en métadonnées) + nature de publication société.
function classify(text: string): { category: IndexCategory; company?: 'STATUTS' | 'MODIF_CAPITAL' | 'MARQUE' } {
  const t = fold(text)
  const isMarque = t.includes('marque') && (t.includes('fabrique') || t.includes('commerce') || t.includes('registre des marques'))
  const isSociete =
    t.includes('societe anonyme') ||
    t.includes('societes anonymes') ||
    t.includes('acte constitutif') ||
    t.includes('acte de constitution') ||
    (t.includes('statuts') && !isMarque) ||
    t.includes('fonctionnement des soci')
  if (isMarque) return { category: 'MARQUE', company: 'MARQUE' }
  if (isSociete) {
    const kind = t.includes('augmentation') || t.includes('modification du capital') ? 'MODIF_CAPITAL' : 'STATUTS'
    return { category: 'SOCIETE', company: kind }
  }
  if (t.includes('circulaire')) return { category: 'CIRCULAIRE' }
  if (t.startsWith('loi') || t.includes('decret-loi')) return { category: 'LOI' }
  if (t.startsWith('decret')) return { category: 'DECRET' }
  if (t.startsWith('arrete') || t.startsWith('aret')) return { category: 'ARRETE' }
  if (t.startsWith('avis') || t.startsWith('avi ')) return { category: 'AVIS' }
  return { category: 'AUTRE' }
}

const CREOLE_START = /^(arete|lwa|dekre|avi ki|kominike|nominasyon|odonans)/
const QUOTE_RE = /[«"“]([^«»"“”]{3,90})[»"”]/g

function extractCompanies(text: string): string[] {
  const out = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = QUOTE_RE.exec(text))) {
    const name = m[1].replace(/\s+/g, ' ').trim()
    const f = fold(name)
    if (name.length < 3) continue
    if (!/[a-zà-ÿ]/i.test(name)) continue
    if (f.includes('registre des marques') || f.includes('le moniteur') || f === 'statuts') continue
    out.add(name)
  }
  return [...out].slice(0, 8)
}

function hashId(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

// Localise le fichier d'index : variable d'env explicite, sinon le plus gros .json
// trouvé dans le dossier de données (aucun nom de fichier codé en dur).
function locateSource(explicit?: string): string | null {
  if (explicit && existsSync(explicit)) return explicit
  const env = process.env.MONITEUR_INDEX_PATH
  if (env && existsSync(env)) return env
  // Voie nominale : MONITEUR_INDEX_PATH (env). Repli heuristique : le plus gros
  // .json des dossiers conventionnels — toujours loggué avant import.
  const dirs = [join(process.cwd(), '..', 'DATA ACEVIEWER'), join(process.cwd(), 'data')]
  let best: { path: string; size: number } | null = null
  for (const dir of dirs) {
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir)) {
      if (!f.toLowerCase().endsWith('.json')) continue
      const p = join(dir, f)
      const size = statSync(p).size
      if (!best || size > best.size) best = { path: p, size }
    }
  }
  if (best) console.log(`   source (heuristique « plus gros .json ») : ${best.path}`)
  return best?.path ?? null
}

interface DocRow {
  id: string
  type: string
  status: string
  titleFr: string
  titleHt: string | null
  bodyOriginal: string
  originalLang: string
  number: string | null
  moniteurRef: string | null
  publicationDate: Date
  searchText: string
  source: string
  category: string
  editionType: string
  metaJson: string
}

export async function importMoniteurIndex(
  prisma: PrismaClient,
  opts: { path?: string; quiet?: boolean } = {},
): Promise<{ documents: number; companies: number; publications: number; skipped?: boolean }> {
  const log = (m: string) => !opts.quiet && console.log(m)

  const path = locateSource(opts.path)
  if (!path) {
    log("⚠️  Index du Moniteur : fichier de données introuvable — import ignoré.")
    return { documents: 0, companies: 0, publications: 0, skipped: true }
  }

  log(`📚  Index du Moniteur : lecture de ${path}`)
  const data = JSON.parse(readFileSync(path, 'utf8'))

  // (year, reference, date, text)
  const entries: [number, string, string | undefined, string][] = []
  const s1 = data.index_des_lois_1900_1944?.annees ?? {}
  for (const [year, y] of Object.entries<any>(s1)) {
    for (const mo of y.moniteurs ?? []) {
      for (const e of mo.entrees ?? []) entries.push([Number(year), mo.code, mo.date, e])
    }
  }
  const s2 = data.index_du_moniteur_1969_2023 ?? {}
  for (const [year, y] of Object.entries<any>(s2)) {
    for (const mois of Object.values<any>(y)) {
      if (!mois || typeof mois !== 'object') continue
      for (const pub of mois.publications ?? []) {
        for (const a of pub.articles ?? []) entries.push([Number(year), pub.reference, pub.date, a])
      }
    }
  }
  log(`   ${entries.length} entrées à importer`)

  // Idempotence : purge l'import précédent — tracée dans AuditLog (toute suppression
  // de documents doit laisser une trace). Vu le volume (~28 000 entrées), on consigne
  // le décompte exact et un échantillon d'ids/références plutôt que la liste complète.
  const toPurge = await prisma.document.findMany({
    where: { source: 'MONITEUR' },
    select: { id: true, number: true },
  })
  const purgedPubs = await prisma.companyPublication.deleteMany({ where: { companyId: { startsWith: 'idx-c-' } } })
  const purgedCompanies = await prisma.company.deleteMany({ where: { id: { startsWith: 'idx-c-' } } })
  const purgedDocs = await prisma.document.deleteMany({ where: { source: 'MONITEUR' } })
  if (purgedDocs.count > 0) {
    const SAMPLE = 100
    await audit(
      {
        action: 'DOC_DELETED',
        targetType: 'DOCUMENT',
        meta: {
          actor: 'script:import-moniteur',
          reason: 'purge avant ré-import (idempotence)',
          source: 'MONITEUR',
          count: purgedDocs.count,
          companiesDeleted: purgedCompanies.count,
          publicationsDeleted: purgedPubs.count,
          ids: toPurge.slice(0, SAMPLE).map((d) => d.id),
          numbers: [...new Set(toPurge.map((d) => d.number).filter(Boolean))].slice(0, SAMPLE),
          truncated: toPurge.length > SAMPLE,
        },
      },
      prisma,
    )
    log(`   purge : ${purgedDocs.count} documents MONITEUR supprimés (tracé AuditLog DOC_DELETED)`)
  }

  const docs: DocRow[] = []
  const companies = new Map<string, { id: string; name: string }>()
  const publications: { id: string; companyId: string; documentId: string; kind: string; label: string; date: Date; moniteurRef: string | null }[] = []

  for (const [year, ref, dateRaw, text] of entries) {
    const clean = text.trim()
    if (!clean) continue
    // Les circulaires de la BRH ne sont pas des textes du Moniteur : exclues de
    // l'index (elles vivent dans la section Circulaires BRH). Demande du 13 juin 2026.
    if (/circulaire/i.test(clean) && /\bBRH\b|banque de la r[ée]publique/i.test(clean)) continue
    const { category, company } = classify(clean)
    const id = randomUUID()
    const date = parseFrenchDate(dateRaw, year)
    const moniteurRef = `Le Moniteur · ${ref ?? `LM${year}`}${dateRaw ? ` · ${dateRaw}` : ''}`
    const isCreole = CREOLE_START.test(fold(clean))

    docs.push({
      id,
      type: 'INDEX',
      status: 'PUBLIE',
      titleFr: clean.slice(0, 400),
      titleHt: isCreole ? clean.slice(0, 400) : null,
      bodyOriginal: clean,
      originalLang: isCreole ? 'ht' : 'fr',
      number: ref ?? null,
      moniteurRef,
      publicationDate: date,
      searchText: buildSearchText({ titleFr: clean, number: ref, moniteurRef, bodyOriginal: clean }),
      source: 'MONITEUR',
      category,
      // Édition spéciale signalée par « SP » dans la référence (ex. LM2023-SP17).
      editionType: /-SP/i.test(ref ?? '') ? 'SPECIALE' : 'REGULIERE',
      metaJson: JSON.stringify({ category, reference: ref, year }),
    })

    if (company) {
      for (const name of extractCompanies(clean)) {
        const key = fold(name).replace(/\s+/g, ' ').trim()
        let c = companies.get(key)
        if (!c) {
          c = { id: `idx-c-${hashId(key)}`, name }
          companies.set(key, c)
        }
        publications.push({
          id: `idx-p-${randomUUID()}`,
          companyId: c.id,
          documentId: id,
          kind: company,
          label: clean.slice(0, 160),
          date,
          moniteurRef,
        })
      }
    }
  }

  log(`   → ${docs.length} documents, ${companies.size} sociétés, ${publications.length} publications`)

  await batch(docs, 1000, (chunk) => prisma.document.createMany({ data: chunk }))
  await batch(
    [...companies.values()].map((c) => ({ id: c.id, name: c.name, searchName: fold(c.name) })),
    1000,
    (chunk) => prisma.company.createMany({ data: chunk }),
  )
  await batch(publications, 1000, (chunk) => prisma.companyPublication.createMany({ data: chunk }))

  log('✅  Import de l\'Index du Moniteur terminé.')
  return { documents: docs.length, companies: companies.size, publications: publications.length }
}

async function batch<T>(rows: T[], size: number, fn: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size))
}

// Exécution autonome.
if (process.argv[1] && process.argv[1].includes('import-moniteur')) {
  const prisma = new PrismaClient()
  importMoniteurIndex(prisma)
    .then((r) => console.log('Résultat :', r))
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(() => prisma.$disconnect())
}
