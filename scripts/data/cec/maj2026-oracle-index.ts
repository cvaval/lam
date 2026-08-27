/**
 * Loi CEC 2002 — l'ORACLE de l'index cliente (§ 8 de la feuille de route du 27 août 2026).
 *
 * Rejoue les 600 renvois développés de l'index de la cliente (68 sujets,
 * `maj2026-client-index-parsed.json`) contre le corps EN BASE, par équivalences DE TERME
 * (radicaux à frontière de mot, accents pliés, apostrophes normalisées). Le script de la
 * mesure du 27 août n'avait pas été conservé (seul son résultat brut l'est,
 * `maj2026-client-index-check.json`, 5 paires) — CELUI-CI est le protocole exécutable :
 * la baseline est SON ensemble d'échecs bruts sur le corps intact
 * (`maj2026-oracle-baseline.json`, écrit par maj2026-prevol.ts), et le MÊME module est
 * rejoué par maj2026-lot-corps.ts après le lot. Lecture (§ 8) :
 *   - juste avant / faux après  = régression BLOQUANTE ;
 *   - faux avant / juste après  = réparation (aucune attendue : le corps des articles ne
 *     change pas dans ce lot — les 3 fusions du § 7.4 portent sur des lignes d'EN-TÊTE,
 *     hors du texte des articles) ;
 *   - faux avant et après       = la baseline enregistrée.
 *
 * ⚠️ Contrairement au repère du 27 août (5 échecs bruts, équivalences plus larges), ce
 * protocole matche au RADICAL À FRONTIÈRE DE MOT : « conFUSION » ne s'apparie plus à
 * « Fusion », « enregistrement » ne s'apparie plus à « Registres » — les renvois faux AU
 * FOND du relevé (Fusion→24, Registres et livres→16/17/19/20/21/29/107) tombent donc en
 * échec brut DÈS la baseline, avec Zone→49 (« aire d'activité » au corps). C'est voulu :
 * la baseline porte l'adjudication, pas le protocole.
 *
 * Module PUR : aucun accès base, aucune écriture. Importé par maj2026-prevol.ts (baseline)
 * et maj2026-lot-corps.ts (rejeu § 11.8).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { segmentAnnotated, type TocEntry } from '../../../src/lib/legislation/annotated'

export const DOSSIER = __dirname

/** Plie une chaîne pour l'appariement : bas de casse, accents retirés (NFD), U+2019 → '. */
export function plier(s: string): string {
  return s
    .replace(/’/g, "'")
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/** Radical présent à FRONTIÈRE DE MOT (début de mot) dans un texte déjà plié. */
export function radicalPresent(radical: string, textePlie: string): boolean {
  const esc = radical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${esc}`).test(textePlie)
}

/** Mots-outils écartés de la dérivation automatique des radicaux. */
const MOTS_OUTILS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'et', 'a', 'aux', 'au', 'en', 'ou', 'pour', 'sur', 'par'])

/**
 * Équivalences PAR TERME (§ 8) — clé = terme PLIÉ, valeur = alternatives de radicaux
 * (le renvoi passe si TOUS les radicaux d'UNE alternative sont présents à frontière de
 * mot). Chaque équivalence est LEXICALE, constatée au corps :
 * « autorisée à fonctionner » (arts 24/106), « autorisation de fonctionnent » (sic, art 20),
 * « superviser » (art 10), « dessaisir » (art 93), « dissoute » (art 109), « garantit »
 * (arts 105/115), « inspectée(s) » (arts 55/83), « procès-verbaux », « où siège la CEC »
 * (art 142), « zone d'intervention » (art 146), « affiliée(s) », « 5% du capital » (art 72).
 */
const EQUIVALENCES: Record<string, string[][]> = {
  [plier('Affiliation / désaffiliation')]: [['affili'], ['desaffili']],
  [plier('Autorisation de fonctionnement')]: [['autoris', 'fonctionn']],
  [plier('Capital social')]: [['capital']],
  [plier('Comité de crédit')]: [['comit', 'credit']],
  [plier('Comité de surveillance')]: [['comit', 'surveill']],
  [plier('Dessaisissement')]: [['dessaisi']],
  [plier('Dissolution')]: [['dissol'], ['dissou']],
  [plier('Enregistrement')]: [['enregistr']],
  [plier('Épargne')]: [['epargn']],
  [plier('Fusion')]: [['fusion']],
  [plier('Garanties / hypothèque')]: [['garant'], ['hypothe']],
  [plier('Inspection')]: [['inspect']],
  [plier('Liquidation')]: [['liquid']],
  [plier('Procès-verbal')]: [['proces-verba']],
  [plier('Registres et livres')]: [['registr'], ['livre']],
  [plier('Siège social')]: [['siege']],
  [plier('Supervision')]: [['supervis']],
  [plier('Vérificateur / vérification')]: [['verifi']],
  [plier("Zone géographique d'intervention")]: [['zone']],
}

/** Alternatives de radicaux d'un terme : équivalence déclarée, sinon dérivation (mots
 *  significatifs, « s » final retiré ; « A / B » = alternatives ; « (SIGLE) » = alternative). */
export function radicauxDe(terme: string): string[][] {
  const declare = EQUIVALENCES[plier(terme)]
  if (declare) return declare
  const alts: string[][] = []
  const parentheses = [...terme.matchAll(/\(([^)]*)\)/g)].map((m) => m[1])
  const principal = terme.replace(/\([^)]*\)/g, ' ')
  for (const part of principal.split('/')) {
    const mots = plier(part)
      .split(/[\s,'\-]+/)
      .filter((w) => w && !MOTS_OUTILS.has(w))
    const rads = mots.map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w))
    if (rads.length) alts.push(rads)
  }
  for (const p of parentheses) {
    const w = plier(p).trim()
    if (w && !MOTS_OUTILS.has(w)) alts.push([w])
  }
  return alts
}

/** Texte de chaque article (n° entier → texte), par la MÊME segmentation que le rendu. */
export function textesParArticle(body: string, toc: TocEntry[]): Map<number, string> {
  const m = new Map<number, string>()
  for (const b of segmentAnnotated(body, toc)) {
    if (b.kind !== 'body' || !b.anchor) continue
    const num = /^art-(\d+)$/.exec(b.anchor)
    if (!num) continue
    const n = Number(num[1])
    m.set(n, m.has(n) ? `${m.get(n)}\n${b.text}` : b.text)
  }
  return m
}

export interface PaireOracle {
  term: string
  articles: number[]
}
export interface EchecOracle {
  term: string
  art: number
}
export interface ResultatOracle {
  totalTermes: number
  totalPaires: number
  echecs: EchecOracle[]
}

/** Charge les 68 sujets / 600 renvois développés de l'index cliente. */
export function pairesCliente(): PaireOracle[] {
  const p = JSON.parse(readFileSync(join(DOSSIER, 'maj2026-client-index-parsed.json'), 'utf8')) as PaireOracle[]
  if (!Array.isArray(p) || !p.length) throw new Error('maj2026-client-index-parsed.json vide ou illisible')
  return p
}

/** Rejoue l'oracle : chaque renvoi (terme → article) testé par ses radicaux sur le corps. */
export function jouerOracle(body: string, toc: TocEntry[]): ResultatOracle {
  const paires = pairesCliente()
  const textes = textesParArticle(body, toc)
  const plies = new Map<number, string>()
  for (const [n, t] of textes) plies.set(n, plier(t))
  const echecs: EchecOracle[] = []
  let totalPaires = 0
  for (const p of paires) {
    const alts = radicauxDe(p.term)
    for (const n of p.articles) {
      totalPaires++
      const texte = plies.get(n)
      const ok = texte !== undefined && alts.some((alt) => alt.every((r) => radicalPresent(r, texte)))
      if (!ok) echecs.push({ term: p.term, art: n })
    }
  }
  return { totalTermes: paires.length, totalPaires, echecs }
}

/** Clé stable d'un échec, pour comparer deux ensembles. */
export const cleEchec = (e: EchecOracle) => `${e.term} → ${e.art}`

/** Compare un rejeu à la baseline : { nouveaux (BLOQUANTS), disparus (à investiguer) }. */
export function comparerALaBaseline(rejeu: ResultatOracle, baseline: EchecOracle[]): { nouveaux: EchecOracle[]; disparus: EchecOracle[] } {
  const avant = new Set(baseline.map(cleEchec))
  const apres = new Set(rejeu.echecs.map(cleEchec))
  return {
    nouveaux: rejeu.echecs.filter((e) => !avant.has(cleEchec(e))),
    disparus: baseline.filter((e) => !apres.has(cleEchec(e))),
  }
}
