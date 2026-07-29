/**
 * Attache le fac-similé du Journal officiel (Le Moniteur, Spécial N° 24 du 25 août
 * 2020) au Décret IMF 2020 : téléverse le PDF sur le Blob privé « lam-pdfs » et
 * renseigne Document.sourcePdfUrl. Idempotent (allowOverwrite, chemin déterministe).
 *   npx tsx scripts/_attach-imf-pdf.ts
 */
import { readFileSync } from 'node:fs'
const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)
for (const k of ['BLOB_READ_WRITE_TOKEN', 'DATABASE_URL', 'DIRECT_URL']) if (env[k]) process.env[k] = env[k]
import { prisma } from '../src/lib/db'
import { uploadToBlob } from '../src/lib/storage/blob'

const PDF = process.env.HOME + '/Library/CloudStorage/Dropbox/Moniteur/Microfinance.pdf'
const SOURCE = 'DECRET_IMF_2020'

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN manquant')
  const doc = await prisma.document.findFirst({ where: { source: SOURCE }, select: { id: true } })
  if (!doc) throw new Error('document IMF introuvable — importer d’abord')
  const buf = readFileSync(PDF)
  const url = await uploadToBlob(`source-pdf/legislation/${doc.id}.pdf`, buf, 'application/pdf', { multipart: true })
  await prisma.document.update({ where: { id: doc.id }, data: { sourcePdfUrl: url } })
  console.log(`✓ fac-similé (${(buf.length/1024/1024).toFixed(1)} Mo) → ${url.slice(0, 70)}…`)
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
