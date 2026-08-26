/**
 * Mesure du « trou d'indexation » de deduireSolution() — LECTURE SEULE.
 *
 *   npx tsx scripts/_mesure-issue-hors-filtre.ts
 *
 * ⚠️ N'ÉCRIT RIEN. Une seule requête : prisma.document.findMany(select …).
 * ⚠️ N'IMPORTE PAS runSearch() — cette fonction journalise dans SearchLog, et une
 *    mesure ne doit pas laisser de trace dans les statistiques d'usage.
 *
 * Deux populations distinctes, à ne pas confondre :
 *   A. les dispositifs DÉJÀ RÉDIGÉS — le trou constaté aujourd'hui en production ;
 *   B. les dispositifs À RÉDIGER — le trou à venir, estimé sur le texte de l'arrêt
 *      après son dernier « PAR CES MOTIFS ».
 *
 * ⚠️ L'ESTIMATION B REPOSE SUR UNE HYPOTHÈSE VÉRIFIÉE, PAS SUR UNE DEVINETTE. Les 29
 * dispositifs déjà rédigés NOMINALISENT la phrase de la Cour (« casse et annule » →
 * « Cassation ; … »). On teste donc les LEMMES (casse/cassation, déchu/déchéance…),
 * pas les seuls mots codés : mesurer sur les mots codés seuls donnerait 109/133, ce
 * qui décrirait la langue de la Cour, pas le travail de la rédaction.
 */
import { readFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))
for (const k of ['DATABASE_URL', 'DIRECT_URL']) if (env[k]) process.env[k] = env[k]

import { PrismaClient } from '@prisma/client'
import { deduireSolution } from '../src/lib/jurisprudence/constants'

const prisma = new PrismaClient()
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Texte après le DERNIER « PAR CES MOTIFS » — le dispositif prononcé. */
function queue(body: string): string | null {
  const n = norm(body)
  const re = /par\s+ces\s+motifs/g
  let last = -1, m: RegExpExecArray | null
  while ((m = re.exec(n)) !== null) last = m.index + m[0].length
  return last < 0 ? null : body.slice(last)
}

/** Lemmes qui, nominalisés, donnent littéralement l'un des quatre mots codés. */
const LEMMES: RegExp[] = [
  /\bcasse\b|\bcassent\b|cassation/,
  /\bdechu\b|\bdechue\b|\bdechus\b|\bdechues\b|decheance/,
  /\brejette\b|\brejettent\b|\brejet\b|\brejete/,
  /irrecevab|non\s+recevable|non-recevable/,
]
const codable = (t: string) => LEMMES.some((re) => re.test(norm(t)))

/** Nature du dispositif non codable — pour cartographier le trou, pas pour le combler. */
const NATURES: [string, RegExp][] = [
  ['Prise à partie / requête non admise', /pas\s+lieu\s+d['’ ]?admettre|pas\s+lieu\s+a\s+poursuivre|prise\s+a\s+partie/],
  ['Avant dire droit (enquête, comparution)', /avant\s+(faire[- ]droit|dire[- ]?droit)|ordonne\s+qu['’ ]?une\s+enquete|par\s+enquete|appointe\b|ordonne\s+.{0,40}comparution/],
  ['Sursis à statuer', /surseoit|sursoit|sursis/],
  ['Désistement / pourvoi sans objet', /desistement|sans\s+objet/],
  ['Incompétence / dessaisissement', /incompetent|dessaisissement|se\s+dessaisit/],
  ['Débouté / demande non fondée', /deboute|n['’ ]?est\s+pas\s+fondee|mal\s+fondee/],
  ['Statuant au fond (art. 116)', /statuant\s+au\s+fond|au\s+fond,/],
  ['Autre (injonction ponctuelle)', /./],
]

async function main() {
  const docs = await prisma.document.findMany({
    where: { type: 'JURISPRUDENCE' },
    select: { number: true, chambre: true, titleFr: true, dispositif: true, solution: true, bodyOriginal: true, recueilRef: true },
    orderBy: [{ recueilRef: 'asc' }, { number: 'asc' }],
  })
  const rediges = docs.filter((d) => (d.dispositif ?? '').trim().length > 0)
  const aRediger = docs.filter((d) => (d.dispositif ?? '').trim().length === 0)
  console.log(`FONDS JURISPRUDENCE : ${docs.length} fiches — ${rediges.length} dispositifs rédigés, ${aRediger.length} à rédiger\n`)

  console.log('── A. EN PRODUCTION : dispositif rédigé que deduireSolution ne classe pas')
  const muets = rediges.filter((d) => deduireSolution(d.dispositif!) === null)
  console.log(`   ${muets.length} / ${rediges.length}`)
  for (const d of muets) console.log(`   • ${d.chambre} n° ${d.number} — « ${d.dispositif!.trim()} » — ${d.titleFr}`)

  const ecarts = rediges.filter((d) => (deduireSolution(d.dispositif!) ?? null) !== (d.solution ?? null))
  console.log(`\n── A bis. Écarts solution stockée / solution déduite : ${ecarts.length}`)

  console.log(`\n── B. À VENIR : arrêts dont le dispositif ne portera aucun lemme codable`)
  const futurs = aRediger.map((d) => ({ d, q: queue(d.bodyOriginal ?? '') }))
    .filter((x): x is { d: (typeof docs)[number]; q: string } => x.q !== null && !codable(x.q))
  const sansAncre = aRediger.filter((d) => queue(d.bodyOriginal ?? '') === null).length
  console.log(`   ${futurs.length} / ${aRediger.length}  (${((futurs.length / aRediger.length) * 100).toFixed(1)} %) · sans ancre « PAR CES MOTIFS » : ${sansAncre}`)
  const parNature = new Map<string, typeof futurs>()
  for (const f of futurs) {
    const nom = NATURES.find(([, re]) => re.test(norm(f.q)))![0]
    parNature.set(nom, [...(parNature.get(nom) ?? []), f])
  }
  for (const [nom] of NATURES) {
    const l = parNature.get(nom); if (!l) continue
    console.log(`\n   ▸ ${nom} — ${l.length}`)
    for (const { d, q } of l) {
      console.log(`      • ${d.chambre} n° ${d.number} — ${d.titleFr.slice(0, 64)}`)
      console.log(`        « …${q.trim().replace(/\s+/g, ' ').slice(0, 160)} »`)
    }
  }

  console.log(`\n── C. Répartition du champ solution en base`)
  const par = new Map<string, number>()
  for (const d of docs) par.set(d.solution ?? 'null', (par.get(d.solution ?? 'null') ?? 0) + 1)
  for (const [k, v] of [...par].sort((a, b) => b[1] - a[1])) console.log(`   ${String(v).padStart(4)}  ${k}`)
}

main().finally(() => prisma.$disconnect())
