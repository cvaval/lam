/**
 * Codes pénal et de procédure pénale révisés (2025) — l'INDEX ALPHABÉTIQUE du lecteur annoté, proposé
 * article par article par un modèle, sous contrainte, et JOURNALISÉ pour être rejouable sans l'API.
 *
 *   set -a; source .env; set +a
 *   npx tsx scripts/data/codes-penaux-2025/indexer.ts cp  [--concurrence 4]
 *   npx tsx scripts/data/codes-penaux-2025/indexer.ts cpp [--concurrence 4]
 *
 * Aucune cliente n'a fourni d'index pour ces deux codes (le Code fiscal 2026 avait le sien). Le format
 * « lecteur annoté » en exige un. Il est donc ÉDITORIAL, et se dit tel dans la note de livraison.
 *
 * Contraintes, vérifiées ici et non laissées au modèle :
 *   · une entrée vise UN article du lot, par son numéro tel qu'imprimé (« 38 », « 30-1 », « 1128.1 ») ;
 *     le second « Article 562 » du Code pénal s'appelle « 562-2 » (son ancre) ;
 *   · la VEDETTE (avant « — ») doit se lire dans l'article ou dans l'intitulé de sa division : chacun de
 *     ses mots de plus de trois lettres s'y retrouve, accents et casse neutralisés. Sinon l'entrée tombe,
 *     et le rejet est compté.
 * Écrit `<code>/index-ia.jsonl` (une ligne par lot : articles, réponse brute) et ne touche pas la base.
 * `parse.py` lit ce journal et en tire `indexEntries` — c'est lui seul qui fait foi.
 */
import Anthropic from '@anthropic-ai/sdk'
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseAnnotations, segmentAnnotated } from '../../../src/lib/legislation/annotated'

const code = process.argv[2]
if (code !== 'cp' && code !== 'cpp') throw new Error('cp | cpp')
const args = process.argv.slice(3)
const CONC = Number(args.includes('--concurrence') ? args[args.indexOf('--concurrence') + 1] : 4)
const MODELE = 'claude-opus-5-5'
const DIR = join(__dirname, code)
const NOM = code === 'cp' ? 'Code pénal (Décret du 24 juin 2025 révisant celui du 11 mars 2020)' : 'Code de procédure pénale (Décret du 24 juin 2025 révisant celui du 11 mars 2020)'

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/[’']/g, ' ').toLowerCase()

const body = readFileSync(join(DIR, 'bodyOriginal.txt'), 'utf8')
const ann = parseAnnotations(readFileSync(join(DIR, 'annotations.json'), 'utf8'))!
const blocs = segmentAnnotated(body, ann.toc, ann.pointAnchors, ann.repeatedHeads)

// Chemin de divisions de chaque article (libellés du navToc, du plus général au plus particulier).
const chemin = new Map<string, string[]>()
let pile: string[] = []
const niveauDe = new Map(ann.toc.map((t) => [t.anchor, t]))
const libelleNav = new Map<string, string>()
const visit = (n: { label: string; anchor: string; children?: unknown[] }) => {
  libelleNav.set(n.anchor, n.label)
  for (const c of (n.children ?? []) as typeof n[]) visit(c)
}
for (const g of ann.navToc as unknown as { label: string; anchor: string; children?: unknown[] }[]) visit(g)
const niveaux: { level: number; label: string }[] = []
type Art = { num: string; anchor: string; texte: string; divisions: string[] }
const articles: Art[] = []
for (const b of blocs) {
  if (b.kind === 'section') {
    const t = niveauDe.get(b.anchor!)
    if (t && libelleNav.has(b.anchor!)) {
      while (niveaux.length && niveaux[niveaux.length - 1].level >= t.level) niveaux.pop()
      niveaux.push({ level: t.level, label: libelleNav.get(b.anchor!)! })
    }
    continue
  }
  if (b.kind === 'body' && b.anchor?.startsWith('art-')) {
    const lab = ann.labels?.[b.anchor] ?? b.anchor
    const num = b.anchor === 'art-562-2' ? '562-2' : lab.replace(/^Article\s+/, '').replace(/^1er$/, '1')
    articles.push({ num, anchor: b.anchor, texte: b.text, divisions: niveaux.map((n) => n.label) })
  }
}
pile = []
void pile

// Lots : articles consécutifs d'une même division de dernier rang, ~30 000 caractères au plus.
const lots: Art[][] = []
let cur: Art[] = []
let taille = 0
for (const a of articles) {
  const memeDiv = cur.length && cur[0].divisions.join('|') === a.divisions.join('|')
  if (cur.length && (!memeDiv || taille + a.texte.length > 30000)) {
    lots.push(cur)
    cur = []
    taille = 0
  }
  cur.push(a)
  taille += a.texte.length
}
if (cur.length) lots.push(cur)

const JOURNAL = join(DIR, 'index-ia.jsonl')
const faits = new Set<string>()
if (existsSync(JOURNAL)) for (const l of readFileSync(JOURNAL, 'utf8').split('\n').filter(Boolean)) faits.add((JSON.parse(l) as { cle: string }).cle)

const CONSIGNE = `Tu dresses l'INDEX ALPHABÉTIQUE d'un code haïtien publié au Journal officiel : ${NOM}.
Pour CHAQUE article ci-dessous, propose de 1 à 3 entrées d'index, de la forme « Vedette — sous-entrée » (ou « Vedette » seule).
Règles :
- la vedette est une notion juridique NOMMÉE dans le texte de l'article ou dans l'intitulé de sa division, avec les mêmes mots (au singulier, initiale majuscule) : « Légitime défense », « Garde à vue », « Récidive » ;
- la sous-entrée précise l'aspect que traite l'article, avec les mots du texte : « conditions », « durée », « personne morale » ;
- aucune entrée ne contient de numéro d'article ; n'invente rien ; ne qualifie pas le droit ;
- un article sans notion propre (simple renvoi, formule d'exécution) reçoit une liste vide.
Réponds UNIQUEMENT par un tableau JSON, sans commentaire : [{"article": "38", "entrees": ["Légitime défense — conditions"]}, …]
Le numéro d'article est celui donné entre crochets.`

async function appel<T>(fn: () => Promise<T>): Promise<T> {
  for (let essai = 1; ; essai++) {
    try {
      return await fn()
    } catch (e) {
      const status = (e as { status?: number }).status
      if (essai >= 6 || !(status === undefined || status === 429 || status >= 500)) throw e
      await new Promise((r) => setTimeout(r, Math.min(2000 * 2 ** (essai - 1), 60000)))
    }
  }
}

async function main() {
  const client = new Anthropic()
  const aFaire = lots.filter((l) => !faits.has(l.map((a) => a.anchor).join(',')))
  console.log(`${articles.length} articles · ${lots.length} lots · ${aFaire.length} à faire (${MODELE})`)
  let i = 0
  let fini = 0
  await Promise.all(
    Array.from({ length: Math.min(CONC, aFaire.length) }, async () => {
      while (i < aFaire.length) {
        const lot = aFaire[i++]
        const texte = `Divisions : ${lot[0].divisions.join(' › ')}\n\n` + lot.map((a) => `[${a.num}] ${a.texte}`).join('\n\n')
        const m = await appel(() =>
          client.messages.stream({ model: MODELE, max_tokens: 8000, messages: [{ role: 'user', content: `${CONSIGNE}\n\n${texte}` }] }).finalMessage(),
        )
        const rep = m.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('')
        appendFileSync(JOURNAL, JSON.stringify({ cle: lot.map((a) => a.anchor).join(','), modele: MODELE, articles: lot.map((a) => a.num), reponse: rep, usage: m.usage }) + '\n')
        if (++fini % 10 === 0) console.log(`   ${fini}/${aFaire.length}`)
      }
    }),
  )
  // Contrôle (le même que parse.py) : combien d'entrées passent la contrainte de la vedette.
  const parNum = new Map(articles.map((a) => [a.num, a]))
  let ok = 0
  let rejet = 0
  let illisible = 0
  const rejets: string[] = []
  for (const l of readFileSync(JOURNAL, 'utf8').split('\n').filter(Boolean)) {
    const j = JSON.parse(l) as { reponse: string; articles: string[] }
    let data: { article: string; entrees: string[] }[]
    try {
      data = JSON.parse(j.reponse.slice(j.reponse.indexOf('['), j.reponse.lastIndexOf(']') + 1))
    } catch {
      illisible++
      continue
    }
    for (const d of data) {
      const a = parNum.get(String(d.article))
      for (const e of d.entrees ?? []) {
        const vedette = e.split(' — ')[0]
        const source = fold(`${a?.texte ?? ''} ${a?.divisions.join(' ') ?? ''}`)
        const mots = fold(vedette).split(/[^a-z0-9]+/).filter((w) => w.length > 3)
        if (a && j.articles.includes(String(d.article)) && mots.every((w) => source.includes(w))) ok++
        else {
          rejet++
          if (rejets.length < 30) rejets.push(`[${d.article}] ${e}`)
        }
      }
    }
  }
  console.log(`✅ ${ok} entrée(s) retenue(s) · ${rejet} rejetée(s) · ${illisible} lot(s) illisible(s)`)
  if (rejets.length) console.log('   exemples de rejets :\n   ' + rejets.join('\n   '))
  writeFileSync(join(DIR, 'index-ia.controle.txt'), `${ok} retenues, ${rejet} rejetées, ${illisible} lots illisibles\n${rejets.join('\n')}\n`)
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
