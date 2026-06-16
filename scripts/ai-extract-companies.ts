/**
 * Extraction IA des sociétés de l'Index du Moniteur — sans exiger de guillemets.
 *
 * Le parseur regex (src/lib/moniteur/companies.ts) couvre les formats courants ; ce
 * script complète avec l'IA les entrées SOCIETE qu'il n'a pas pu traiter (formats
 * libres : « suivantes : X; Y », « de la Société X », « Fondation … », sigles…), tout
 * en distinguant une vraie société d'un décret/traité de portée générale.
 *
 * Par défaut : seules les entrées SOCIETE SANS aucune société liée (le gisement sûr,
 * zéro risque de doublon). --all : toutes les entrées SOCIETE.
 *
 *   npx tsx scripts/ai-extract-companies.ts            # aperçu
 *   npx tsx scripts/ai-extract-companies.ts --commit   # écrit
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'
import { withAiFallback, modelFor, parseGeminiJson } from '../src/lib/ai/provider'
import { companyId } from '../src/lib/moniteur/companies'
import { fold } from '../src/lib/search/normalize'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)
const prisma = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL || env.DATABASE_URL } } })

const COMMIT = process.argv.includes('--commit')
const ALL = process.argv.includes('--all')
const LIMIT = (() => { const i = process.argv.indexOf('--limit'); return i >= 0 ? parseInt(process.argv[i + 1], 10) : 0 })()
const MODELS = { anthropic: 'claude-haiku-4-5-20251001', gemini: 'gemini-2.0-flash' }
const BATCH = 15

const PROMPT = `Tu reçois des intitulés d'avis du journal officiel haïtien « Le Moniteur ».
Pour CHAQUE intitulé, extrais le(s) nom(s) de SOCIÉTÉ COMMERCIALE HAÏTIENNE (ou fondation/association locale) qui est autorisée, constituée, modifiée ou dissoute.

RÈGLES :
- Donne le nom officiel EXACT, avec son suffixe (S.A., S.A.R.L.) et les sigles entre parenthèses ou après une barre s'ils font partie du nom (ex. « SOGEBANK », « ITC S.A. »).
- Plusieurs sociétés possibles : listes « 1) … 2) … », « suivantes : X ; Y ; Z », « X et Y ». Renvoie-les TOUTES.
- N'inclus JAMAIS de mots descriptifs (Avis, Décret, Arrêté, dénommée, fonctionnement, acte, statuts, modification…).
- Renvoie une liste VIDE si l'intitulé est une loi/décret/arrêté de PORTÉE GÉNÉRALE (règles, formalités, programmes), un traité/accord international, ou concerne une ORGANISATION INTERNATIONALE (FMI, BID, Banque Caraïbéenne de Développement, OLAVI, etc.) — donc PAS une société commerciale haïtienne précise.

Réponds UNIQUEMENT en JSON : [{"i":0,"names":["…"]}, {"i":1,"names":[]}, …] — un objet par intitulé, dans l'ordre, sans commentaire.

INTITULÉS :
`

async function extractBatch(titles: string[]): Promise<string[][]> {
  const numbered = titles.map((t, i) => `${i}. ${t}`).join('\n')
  const raw = await withAiFallback({
    anthropic: async () => {
      const msg = await new Anthropic().messages.create({ model: modelFor('anthropic', MODELS), max_tokens: 4000, messages: [{ role: 'user', content: PROMPT + numbered }] })
      const b = msg.content.find((x): x is Anthropic.TextBlock => x.type === 'text')
      return b?.text ?? '[]'
    },
    gemini: async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
      const r = await ai.models.generateContent({ model: modelFor('gemini', MODELS), contents: PROMPT + numbered })
      return r.text ?? '[]'
    },
  })
  let parsed: { i: number; names: string[] }[]
  try { parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()) } catch { try { parsed = parseGeminiJson(raw) as any } catch { return titles.map(() => []) } }
  const out: string[][] = titles.map(() => [])
  for (const o of parsed || []) if (o && typeof o.i === 'number' && out[o.i]) out[o.i] = (o.names || []).filter((n) => typeof n === 'string' && n.trim().length >= 3)
  return out
}

async function main() {
  const where = ALL
    ? { type: 'INDEX', category: 'SOCIETE' as const }
    : { type: 'INDEX', category: 'SOCIETE' as const, publications: { none: {} } }
  const docs = await prisma.document.findMany({ where, select: { id: true, bodyOriginal: true, publicationDate: true, moniteurRef: true }, take: LIMIT || undefined, orderBy: { publicationDate: 'asc' } })
  console.log(`Entrées SOCIETE à traiter (${ALL ? 'TOUTES' : 'sans société liée'}) : ${docs.length}`)

  const existingCompanyIds = new Set((await prisma.company.findMany({ select: { id: true } })).map((c) => c.id))
  const existingPubs = new Set((await prisma.companyPublication.findMany({ where: { documentId: { not: null } }, select: { companyId: true, documentId: true } })).map((p) => `${p.companyId}|${p.documentId}`))

  const newCompanies = new Map<string, { id: string; name: string; searchName: string }>()
  const newPubs: any[] = []
  let processed = 0

  for (let i = 0; i < docs.length; i += BATCH) {
    const batch = docs.slice(i, i + BATCH)
    let names: string[][]
    try { names = await extractBatch(batch.map((d) => (d.bodyOriginal || '').slice(0, 400))) }
    catch (e) { console.warn(`  ⚠ lot ${i}: ${(e as Error).message.slice(0, 80)}`); continue }
    batch.forEach((d, j) => {
      for (const name of names[j] || []) {
        const id = companyId(name)
        if (!existingCompanyIds.has(id) && !newCompanies.has(id)) newCompanies.set(id, { id, name, searchName: fold(name) })
        const k = `${id}|${d.id}`
        if (!existingPubs.has(k)) { existingPubs.add(k); newPubs.push({ id: `idx-p-${randomUUID()}`, companyId: id, documentId: d.id, kind: 'STATUTS', label: (d.bodyOriginal || '').slice(0, 160), date: d.publicationDate, moniteurRef: d.moniteurRef }) }
      }
    })
    processed += batch.length
    process.stdout.write(`\r  traité ${processed}/${docs.length} · ${newCompanies.size} sociétés trouvées`)
  }
  console.log(`\n\n${COMMIT ? '✏️  À ÉCRIRE' : '👁  APERÇU'} : ${newCompanies.size} nouvelles sociétés · ${newPubs.length} liens`)
  console.log('\nSociétés extraites par l\'IA :')
  for (const c of [...newCompanies.values()]) console.log('  • ' + c.name)

  if (!COMMIT) { console.log('\n(Aperçu — relancer avec --commit pour écrire.)'); return }
  const comps = [...newCompanies.values()]
  for (let i = 0; i < comps.length; i += 1000) await prisma.company.createMany({ data: comps.slice(i, i + 1000), skipDuplicates: true })
  for (let i = 0; i < newPubs.length; i += 1000) await prisma.companyPublication.createMany({ data: newPubs.slice(i, i + 1000), skipDuplicates: true })
  console.log(`\n✅ Écrit : ${comps.length} sociétés + ${newPubs.length} liens.`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
