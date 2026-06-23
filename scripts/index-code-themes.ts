/**
 * Indexation thématique par IA du Code des Douanes (Document LEGISLATION LM2023-SP11).
 * Découpe le texte en articles (avec leur contexte TITRE/CHAPITRE/SECTION), demande à
 * l'IA d'attribuer 1-3 thèmes (taxonomie douanière) + un résumé par article, et stocke
 * le tout dans Document.themeIndexJson — base de la recherche par thème, des suggestions
 * de thèmes similaires et des renvois entre articles.
 *
 *   npx tsx scripts/index-code-themes.ts            (aperçu du découpage, sans IA)
 *   npx tsx scripts/index-code-themes.ts --commit   (IA + écriture)
 *   npx tsx scripts/index-code-themes.ts --commit --limit 2   (2 lots, pour tester)
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import Anthropic from '@anthropic-ai/sdk'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)
for (const k of ['GEMINI_API_KEY', 'ANTHROPIC_API_KEY']) if (env[k]) process.env[k] = env[k]
const prisma = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL || env.DATABASE_URL } } })
const COMMIT = process.argv.includes('--commit')
const LIMIT = (() => { const i = process.argv.indexOf('--limit'); return i >= 0 ? Number(process.argv[i + 1]) : Infinity })()
const NUMBER = 'LM2023-SP11'
const BATCH = 18

const TAXONOMY = [
  "Champ d'application et définitions", 'Territoire douanier', 'Droits de douane et taxation',
  'Tarif douanier et espèce tarifaire', 'Origine des marchandises', 'Valeur en douane',
  'Prohibitions et restrictions', 'Contrôle du commerce extérieur', 'Protection des marques et propriété intellectuelle',
  "Organisation de l'Administration des douanes", 'Bureaux et brigades de douane', 'Conduite et mise en douane',
  'Déclaration en détail et dédouanement', 'Régimes douaniers économiques (entrepôt, admission temporaire)',
  'Transit et transbordement', 'Magasins et aires de dédouanement', 'Franchises et exonérations',
  'Voyageurs et envois postaux', 'Moyens de transport', 'Paiement, recouvrement et garanties',
  'Crédit d’enlèvement et cautionnement', 'Contentieux douanier', 'Infractions et contrebande',
  'Sanctions et pénalités', 'Saisie et confiscation', 'Visite, contrôle et droit de communication',
  'Dispositions transitoires et finales',
]

interface Art { num: string; heading: string; body: string }

function parseArticles(raw: string): Art[] {
  const lines = raw.split(/\r?\n/).map((l) => l.trim())
  const isArt = (l: string) => /^Article\s+(?:\d+|premier)/i.test(l)
  const arts: Art[] = []
  let cur: Art | null = null
  let titre = '', chap = '', sec = ''
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (!l) continue
    if (isArt(l)) {
      if (cur) arts.push(cur)
      const m = l.match(/^Article\s+(\d+|premier)(?:\s*(?:er|ère|e)\b)?(?:\s+(bis|ter|quater))?/i)!
      let num = m[1].toLowerCase() === 'premier' ? '1' : m[1]
      if (m[2]) num += '-' + m[2].toLowerCase()
      cur = { num, heading: [titre, chap, sec].filter(Boolean).join(' › '), body: l.replace(/^Article\s+[\dÀ-ÿa-z.\- ]*?[.\-]\s*/i, '') + ' ' }
      continue
    }
    const struct = l.match(/^(LIVRE|TITRE|CHAPITRE)\b\s*(.*)$/i)
    if (struct && l.length < 60) {
      const kind = struct[1].toUpperCase()
      let title = struct[2].trim()
      if (!title || /^(PREMIER|[IVXLC]+|\d+)[\.\-]?$/i.test(title)) {
        const nx = lines[i + 1]
        if (nx && !isArt(nx) && !/^(LIVRE|TITRE|CHAPITRE|Section)/i.test(nx) && nx.length < 80) title = (title ? title + ' — ' : '') + nx
      }
      if (kind === 'TITRE' || kind === 'LIVRE') { titre = `${kind} ${title}`.trim(); chap = ''; sec = '' }
      else { chap = `${kind} ${title}`.trim(); sec = '' }
      continue
    }
    const secm = l.match(/^Section\b\s*(.*)$/i)
    if (secm && l.length < 90) { sec = 'Section ' + secm[1].trim(); continue }
    if (cur) cur.body += l + ' '
  }
  if (cur) arts.push(cur)
  // Dédup (entrées de sommaire / doublons) : garder, par numéro, le corps le plus long.
  const byNum = new Map<string, Art>()
  for (const a of arts) { const ex = byNum.get(a.num); if (!ex || a.body.length > ex.body.length) byNum.set(a.num, a) }
  const order = (n: string) => Number(n.replace(/\D.*$/, '')) * 10 + (n.includes('-') ? 1 : 0)
  return [...byNum.values()].sort((x, y) => order(x.num) - order(y.num))
}

async function tagBatch(client: Anthropic, batch: Art[]): Promise<Record<string, { themes: string[]; summary: string }>> {
  const docs = batch.map((a) => `Article ${a.num} [${a.heading || '—'}] : ${a.body.replace(/\s+/g, ' ').slice(0, 600)}`).join('\n\n')
  const prompt = `Tu es juriste spécialiste du droit douanier haïtien. Pour CHAQUE article ci-dessous du Code des Douanes, attribue 1 à 3 THÈMES (de préférence dans la TAXONOMIE ; n'ajoute un thème concis que si vraiment aucun ne convient) et rédige un RÉSUMÉ d'une phrase (≤ 140 caractères, en français).\n\nTAXONOMIE :\n${TAXONOMY.map((t) => '- ' + t).join('\n')}\n\nARTICLES :\n${docs}\n\nRéponds UNIQUEMENT en JSON (aucun texte autour) : {"articles":[{"num":"12","themes":["…"],"summary":"…"}]}`
  const res = await client.messages.create({ model: 'claude-haiku-4-5', max_tokens: 4096, messages: [{ role: 'user', content: prompt }] })
  const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
  const slice = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  const parsed = JSON.parse(slice || '{}') as { articles?: { num: string; themes: string[]; summary: string }[] }
  const out: Record<string, { themes: string[]; summary: string }> = {}
  for (const a of parsed.articles ?? []) out[String(a.num)] = { themes: (a.themes ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 3), summary: (a.summary ?? '').trim().slice(0, 160) }
  return out
}

async function main() {
  const doc = await prisma.document.findFirst({ where: { type: 'LEGISLATION', number: NUMBER }, select: { id: true, bodyOriginal: true } })
  if (!doc?.bodyOriginal) { console.error('Code des Douanes introuvable.'); process.exit(1) }
  const arts = parseArticles(doc.bodyOriginal)
  console.log(`Articles découpés : ${arts.length}`)
  console.log('échantillon :', arts.slice(0, 3).map((a) => `art ${a.num} [${a.heading.slice(0, 40)}] ${a.body.length}c`))
  console.log('derniers :', arts.slice(-3).map((a) => `art ${a.num}`))
  if (!COMMIT) { console.log('\nAperçu — relancer avec --commit pour l’indexation IA.'); await prisma.$disconnect(); return }

  const client = new Anthropic()
  const index: { num: string; heading: string; themes: string[]; summary: string }[] = []
  const batches = Math.min(LIMIT, Math.ceil(arts.length / BATCH))
  for (let b = 0; b < batches; b++) {
    const slice = arts.slice(b * BATCH, b * BATCH + BATCH)
    let tags: Record<string, { themes: string[]; summary: string }> = {}
    try { tags = await tagBatch(client, slice) } catch (e) { console.warn(`\nlot ${b + 1} échoué :`, (e as Error).message.slice(0, 100)) }
    for (const a of slice) index.push({ num: a.num, heading: a.heading, themes: tags[a.num]?.themes ?? [], summary: tags[a.num]?.summary ?? '' })
    process.stdout.write(`\rlot ${b + 1}/${batches} · ${index.length} articles`)
  }
  console.log('')
  const tagged = index.filter((a) => a.themes.length).length
  const themeCount = new Map<string, number>()
  for (const a of index) for (const t of a.themes) themeCount.set(t, (themeCount.get(t) ?? 0) + 1)
  console.log(`indexés : ${index.length} · avec thèmes : ${tagged} · thèmes distincts : ${themeCount.size}`)
  console.log('top thèmes :', [...themeCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t, n]) => `${t}(${n})`).join(', '))
  if (index.length < arts.length) { console.error('Indexation incomplète — non écrite.'); await prisma.$disconnect(); process.exit(1) }
  await prisma.document.update({ where: { id: doc.id }, data: { themeIndexJson: JSON.stringify(index) } })
  console.log('✓ themeIndexJson écrit.')
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
