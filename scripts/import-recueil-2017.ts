/**
 * Téléversement du recueil « Circulaires en vigueur » (51 textes, Moniteur Spécial
 * n°18 du 6 juin 2017) : un .docx (version HTML : bodyClean + tableaux) + un .pdf
 * (original → Blob) par texte. Métadonnées tirées du nom de fichier
 * (NN_CAT_REF_DATE_slug) + en-tête du docx (type Circulaire vs Lettre-Circulaire).
 *
 *   npx tsx scripts/import-recueil-2017.ts            (simulation — n'écrit rien)
 *   npx tsx scripts/import-recueil-2017.ts --commit
 *
 * Déduplication « la nouvelle version prévaut » : pour chaque numéro canonique, on
 * SUPPRIME les fiches existantes de MÊME numéro normalisé (tag « (réserves
 * obligatoires) » ignoré ; préfixe « CIRC-RES » NON fusionné = série distincte, à
 * signaler) avec trace AuditLog DOC_DELETED, puis on crée la nouvelle.
 * source='BRH-WEB' (hors purge import-brh) ; status='EN_VIGUEUR' ; bodyOriginal =
 * texte officiel du docx (§02).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import mammoth from 'mammoth'
import { wordToHtmlVersion } from '../src/lib/doc/word'
import { extractKeywords, joinKeywords, normalizeKeywords } from '../src/lib/ai/keywords'
import { buildSearchText } from '../src/lib/search/normalize'
import { uploadToBlob } from '../src/lib/storage/blob'
import { audit } from '../src/lib/auth/audit'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)
for (const k of ['BLOB_READ_WRITE_TOKEN', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'LV_AI_PROVIDER']) if (env[k]) process.env[k] = env[k]
const prisma = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL || env.DATABASE_URL } } })
const COMMIT = process.argv.includes('--commit')
const PDF_DIR = '/Users/cvaval/Downloads/circulaires'
const DOCX_DIR = '/Users/cvaval/Downloads/circulaires_DOCX_tous'

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const frDate = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}` }
const humanize = (slug: string) => { const s = slug.replace(/-/g, ' ').trim(); return s.charAt(0).toUpperCase() + s.slice(1) }

/** Clé de déduplication : type (C/L) + numéro normalisé (tag réserves ignoré ; CIRC-RES conservé). */
function dedupKey(number: string): string {
  const kind = /lettre/i.test(number) ? 'L' : 'C'
  const n = number.toLowerCase()
    .replace(/\(r[ée]serves? obligatoires?\)/g, '')
    .replace(/lettre-circulaire|circulaire/g, '')
    .replace(/n[°ºo]\.?/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return `${kind}|${n}`
}

interface Job { order: string; cat: string; ref: string; date: string; slug: string; docx: string; pdf: string }

function buildJobs(): Job[] {
  const docx = readdirSync(DOCX_DIR).filter((f) => f.endsWith('.docx'))
  const pdfs = readdirSync(PDF_DIR).filter((f) => f.endsWith('.pdf'))
  const pdfByOrder = new Map(pdfs.map((f) => [f.match(/^(\d+)_/)?.[1] ?? '', f]))
  const jobs: Job[] = []
  for (const f of docx.sort()) {
    const m = f.match(/^(\d+)_([A-Z]+)_(.+?)_(\d{4}-\d{2}-\d{2})_(.+)\.docx$/)
    if (!m) { console.warn('nom non reconnu:', f); continue }
    const [, order, cat, ref, date, slug] = m
    const pdf = pdfByOrder.get(order)
    if (!pdf) { console.warn('PDF manquant pour', f); continue }
    jobs.push({ order, cat, ref, date, slug, docx: f, pdf })
  }
  return jobs
}

async function main() {
  const jobs = buildJobs()
  console.log(`Recueil 2017 — ${jobs.length} circulaire(s) · ${COMMIT ? 'COMMIT' : 'SIMULATION'}\n`)
  if (jobs.length !== 51) console.warn(`⚠ attendu 51, trouvé ${jobs.length}`)

  // Index des fiches existantes par clé de dédup.
  const existing = await prisma.document.findMany({ where: { type: 'CIRCULAIRE_BRH' }, select: { id: true, number: true, titleFr: true } })
  const byKey = new Map<string, { id: string; number: string | null; titleFr: string }[]>()
  for (const e of existing) {
    if (!e.number) continue
    const k = dedupKey(e.number)
    if (!byKey.has(k)) byKey.set(k, [])
    byKey.get(k)!.push(e)
  }

  let created = 0, replaced = 0
  for (const j of jobs) {
    const buf = readFileSync(`${DOCX_DIR}/${j.docx}`)
    const rawText = (await mammoth.extractRawText({ buffer: buf })).value.trim()
    const { bodyClean, richBlocks } = await wordToHtmlVersion(buf)
    const richJson = richBlocks.length ? JSON.stringify(richBlocks) : null
    const isLettre = /lettre[- ]circulaire/i.test(rawText.slice(0, 600))

    // Numéro canonique
    let number: string, numLabel: string
    const cm = j.ref.match(/^C(\d[0-9A-Za-z.-]*)$/i)
    if (cm) {
      let num = cm[1].replace(/\./g, '-')
      if (isLettre) num = num.replace(/^(\d)(\D|$)/, '0$1$2') // pad 1 chiffre (lettres : 7 → 07)
      number = `${isLettre ? 'Lettre-Circulaire' : 'Circulaire'} n° ${num}`
      numLabel = `${isLettre ? 'Lettre-Circulaire' : 'Circulaire'} BRH n° ${num}`
    } else {
      const code = j.ref === 'sansnum' ? '' : ` (${j.ref.replace(/-/g, '/')})`
      number = `${isLettre ? 'Lettre-Circulaire' : 'Circulaire'} du ${frDate(j.date)}`
      numLabel = `${isLettre ? 'Lettre-Circulaire' : 'Circulaire'} BRH du ${frDate(j.date)}${code}`
    }

    // Le slug du nom de fichier = description topique fiable (curée par l'utilisatrice) ;
    // extractSubject attrapait des fragments parfois faux → on privilégie le slug.
    const subject = humanize(j.slug).slice(0, 140)
    const title = `${numLabel} — ${subject}`
    const key = dedupKey(number)
    const dups = byKey.get(key) ?? []

    const kw = await extractKeywords({ titleFr: title, matiere: 'Droit bancaire', body: rawText })
    const keywords = joinKeywords(normalizeKeywords([...kw.keywords, 'BRH', 'circulaire']))
    const searchText = buildSearchText({ titleFr: title, number, bodyOriginal: rawText, matiere: 'Droit bancaire', keywords })

    console.log(`#${j.order} → ${number}${isLettre ? '' : ''}`)
    console.log(`   ${title.slice(0, 88)}`)
    console.log(`   body ${rawText.length}c · ${richBlocks.filter((b) => b.type === 'table').length} tbl · pub ${j.date}` + (dups.length ? `  ⟲ remplace: ${dups.map((d) => `«${d.number}»`).join(', ')}` : '  (nouveau)'))

    if (!COMMIT) continue

    if (dups.length) {
      const ids = dups.map((d) => d.id)
      await prisma.document.deleteMany({ where: { id: { in: ids } } })
      await audit({ action: 'DOC_DELETED', targetType: 'DOCUMENT', targetId: ids[0], meta: { actor: 'script:import-recueil-2017', reason: `remplacement (recueil 2017) par ${number}`, number, removed: dups.map((d) => d.number), ids } }, prisma)
      replaced += ids.length
      byKey.set(key, [])
    }
    const sourcePdfUrl = await uploadToBlob(`source-pdf/CIRCULAIRE_BRH/recueil-${j.order}.pdf`, new Uint8Array(readFileSync(`${PDF_DIR}/${j.pdf}`)), 'application/pdf', { multipart: true })
    const d = await prisma.document.create({
      data: {
        type: 'CIRCULAIRE_BRH', status: 'EN_VIGUEUR', originalLang: 'fr',
        titleFr: title, bodyOriginal: rawText, bodyClean, richBlocksJson: richJson,
        number, publicationDate: new Date(`${j.date}T00:00:00Z`),
        matiere: 'Droit bancaire', keywords, source: 'BRH-WEB', sealed: true, sourcePdfUrl, searchText,
      },
    })
    created++
    console.log(`   ✓ ${d.id}`)
  }
  console.log(`\n${COMMIT ? `Terminé : ${created} créées, ${replaced} anciennes remplacées (supprimées).` : 'Simulation — relancer avec --commit.'}`)
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
