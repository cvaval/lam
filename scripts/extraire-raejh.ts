/**
 * RAEJH — EXTRACTION DU RECUEIL ALPHABÉTIQUE D'EXTRAITS DE JURISPRUDENCE HAÏTIENNE (Salès).
 *
 *     npx tsx scripts/extraire-raejh.ts
 *
 * N'ÉCRIT RIEN EN BASE. Lit le manuscrit .docx et produit `scripts/data/raejh-sales/` :
 * notions, arrêts (identités), extraits, renvois unitaires, rapport d'anomalies, manifeste.
 * Prompt : « Lam — Prompt Répertoire alphabétique de jurisprudence (Salès).md », § 5.
 *
 * ─── CE QU'EST LE DOCUMENT ─────────────────────────────────────────────────────────────────
 * Un RÉPERTOIRE, pas un recueil d'arrêts : sous chaque notion (titre de niveau 1), des
 * entrées « N.- Arrêt du <date>, <formation>, <parties>. - Réf: <articles> » suivies d'un ou
 * plusieurs « Attendu ». Un même arrêt revient sous chaque notion qu'il touche — 610 arrêts
 * sous ≥ 2 notions, un jusqu'à 17 fois. L'UNITÉ EST L'ARRÊT ; l'entrée est une LIAISON.
 *
 * ─── LES PIÈGES QUE CE SCRIPT ÉVITE, ET POURQUOI ───────────────────────────────────────────
 * ⚠️ TÊTES TOLÉRANTES. Le manuscrit écrit « 3.- », mais aussi « 3. » et « 3 .- ». Une regex
 *    stricte a fait passer une tête pour un attendu au premier sondage. La sentinelle n'est
 *    pas la contiguïté (un « 3. » en double la passe) mais l'ÉGALITÉ D'ENSEMBLE : sous chaque
 *    notion, {rangs} = {1…N}.
 * ⚠️ IDENTITÉ D'ARRÊT PAR (date, formation, parties normalisées). Un même arrêt s'écrit
 *    « Brewton Fashion International S.A. » et « …International, S.A. » : la normalisation
 *    absorbe la ponctuation. Elle n'absorbe pas les abréviations — les identités de même
 *    (date, formation) aux parties proches (trigrammes ≥ 0,8) sont RAPPORTÉES, non fusionnées.
 * ⚠️ QUATRE ENTRÉES « 1909 » — Brewton Fashion, une société des années 70-80. Coquille
 *    probable pour 1979 ; VÉRIFIÉE sur la couche texte du PDF publié avant toute fusion.
 * ⚠️ RENVOIS PAR DÉSIGNATION, JAMAIS PAR IDENTIFIANT. Le recueil cite 138 textes hors codes,
 *    la plupart absents du corpus. Chaque unité porte une clé stable (« CTA », « CPC »,
 *    « LOI-1967-08-28 ») et le libellé verbatim ; la résolution est l'affaire d'un autre script.
 *    Ce que l'analyseur ne sait pas découper est COMPTÉ et reste en `refsBrutes`.
 * ⚠️ `posterieur` EST CALCULÉ : la cible datée est postérieure à l'arrêt ⇒ annotation de
 *    l'éditeur (le manuscrit a été enrichi après 1989), pas visa de la Cour.
 * ⚠️ ARTEFACTS D'EXTRACTION. Une lecture par regex des `<w:t>` a laissé des « <w:t> »
 *    dans les attendus au premier sondage. On assemble les runs proprement ; sentinelle :
 *    0 « <w: » dans un texte.
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DOCX =
  "/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur/Recueil Jurisprudences JFS/JFS RECUEIL ALPHABETIQUE LAST VERSION document 1 (aquila's conflicted copy 2023-08-24).docx"
const PDF = '/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur/Recueil Jurisprudences JFS/RAEJH_full.pdf'
const OUT = join(process.cwd(), 'scripts/data/raejh-sales')

function arret(msg: string): never {
  console.error(`\n⛔ ARRÊT — ${msg}`)
  process.exit(1)
}

// ─── Lecture du .docx : paragraphes { style, texte } ─────────────────────────────────────────
function paragraphes(): { style: string; texte: string }[] {
  const xml = execFileSync('unzip', ['-p', DOCX, 'word/document.xml'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  const out: { style: string; texte: string }[] = []
  const decode = (s: string) =>
    s
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
  for (const p of xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []) {
    const style = /<w:pStyle w:val="([^"]+)"/.exec(p)?.[1] ?? ''
    // ⚠️ `<w:t(?:[^>]*)>` avalait `<w:tab/>` comme balise ouvrante (« <w:t » + « ab/ » + « > »)
    // et consommait jusqu'au `</w:t>` suivant : 3 entrées lues sur 2 927. La balise texte
    // est `<w:t>` ou `<w:t xml:space="preserve">` — un espace obligatoire avant l'attribut.
    let texte = ''
    for (const tok of p.match(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>|<w:tab\/>/g) ?? []) {
      texte += tok === '<w:tab/>' ? ' ' : decode(tok.replace(/^<w:t(?:\s[^>]*)?>/, '').replace(/<\/w:t>$/, ''))
    }
    out.push({ style, texte: texte.replace(/\s+/g, ' ').trim() })
  }
  return out
}

// ─── Outils ─────────────────────────────────────────────────────────────────────────────────
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const slugOf = (s: string) => fold(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const MOIS: Record<string, number> = { janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12 }
// ⚠️ `\p{L}` et non `[a-zéû]` : « 21 dècembre 1971 » (accent GRAVE) était refusé, la date
// suivante de la ligne (« Loi du 24 juillet 1961 ») passait pour celle de l'arrêt et les
// parties se vidaient — une fiche fantôme, datée d'avant le recueil.
const RE_DATE = /(\d{1,2})(?:er)?\s+(\p{L}+)\s*(\d{4})/iu // « 12 juillet1989 » existe
function iso(dateTxt: string): string | null {
  const m = RE_DATE.exec(dateTxt)
  if (!m) return null
  const mois = MOIS[fold(m[2])]
  if (!mois) return null
  return `${m[3]}-${String(mois).padStart(2, '0')}-${m[1].padStart(2, '0')}`
}
/** Formation canonique — quatre valeurs, comme le corpus (la 4ᵉ est nouvelle). */
function formation(s: string): { label: string | null; reste: string } {
  const re = /^\s*(1(?:ère|ére|re|er)\s+section|2(?:ème|éme|e)\s+section|sections?\s+r[ée]unies|assembl[ée]e\s+g[ée]n[ée]rale(?:\s+(?:de\s+la\s+)?cour\s+de\s+cassation)?)\s*,?\s*/i // « 2éme » (aigu) existe
  const m = re.exec(s)
  if (!m) return { label: null, reste: s }
  const f = fold(m[1])
  const label = f.startsWith('1') ? 'Première Section' : f.startsWith('2') ? 'Deuxième Section' : f.startsWith('section') ? 'Sections Réunies' : 'Assemblée Générale'
  return { label, reste: s.slice(m[0].length) }
}
const normParties = (s: string) =>
  // ⚠️ Le séparateur « c. » se normalise AVANT le repli de casse, et seulement quand c'est un
  // séparateur : « c. », « C. », « ȼ », ou « c » suivi d'une capitale (« c Nelson »). Un
  // `\\bc\\.?` appliqué après repli attrapait le « c » de « company » et fabriquait un jeton
  // « ompany » — partagé par deux arrêts HASCO du même jour, d'où une fausse ambiguïté.
  fold(s.replace(/ȼ/g, ' c. ').replace(/&/g, ' et ').replace(/\bc\.\s*/gi, ' c ').replace(/\bc\s+(?=[A-ZÀ-Ý0-9])/g, ' c '))
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
function trigrammes(s: string): Set<string> {
  const t = ` ${s} `
  const out = new Set<string>()
  for (let i = 0; i + 3 <= t.length; i++) out.add(t.slice(i, i + 3))
  return out
}
function similarite(a: string, b: string): number {
  const A = trigrammes(a), B = trigrammes(b)
  let inter = 0
  for (const x of A) if (B.has(x)) inter++
  return inter / (A.size + B.size - inter || 1)
}

// ─── Renvois : découpage en unités { cible, cibleLibelle, article } ─────────────────────────
const SIGLES: [RegExp, string][] = [
  [/code\s+du\s+travail\s+annot/i, 'CTA'],
  [/code\s+de\s+proc[ée]dure\s+civile/i, 'CPC'],
  [/code\s+d.instruction\s+criminelle/i, 'CIC'],
  [/code\s+civil/i, 'CC'],
  [/code\s+p[ée]nal/i, 'CP'],
  [/code\s+du\s+travail/i, 'CT'],
  [/code\s+de\s+commerce|\bC\.?\s?Com\.?/i, 'CCOM'],
  [/\bC\.?\s?T\.?\s?A\.?(?=[\s,;.\])]|$)|\bCTA\b/i, 'CTA'],
  [/\bC\.?\s?P\.?\s?C\.?(?=[\s,;.\])]|$)|\bCPC\b/i, 'CPC'],
  [/\bC\.?\s?I\.?\s?C\.?(?=[\s,;.\])]|$)|\bCIC\b/i, 'CIC'],
  [/\bC\.?\s?C\.?(?=[\s,;.\])]|$)|\bcc\.?(?=[\s,;.\])]|$)/i, 'CC'],
  [/\bC\.?\s?P\.?(?=[\s,;.\])]|$)|\bCP\b/i, 'CP'],
  [/\bC\.?\s?T\.?(?=[\s,;.\])]|$)|\bCT\b/i, 'CT'],
]
type Unite = { cible: string; cibleLibelle: string; article: string | null; cibleDate: string | null }
function articlesDe(liste: string): string[] {
  // « 28, 41, 42 et 43 » · « 567-b » / « 567(B) » · « 33 à 37 » (plage développée) ·
  // « 507, 3ème alinéa » (l'ordinal n'est PAS un article) · « I et II » (romains) ·
  // « 112 et suivants » (le seul 112 ; « et suivants » n'est pas une borne).
  const out: string[] = []
  const l = liste.replace(/\b(\d{1,4})\s*\(([a-z])\)/gi, '$1-$2').replace(/\bet\s+suivants?\b/gi, ' ')
  const plage = /\b(\d{1,4})\s*à\s*(\d{1,4})\b/g
  let m: RegExpExecArray | null
  const couverts = new Set<number>()
  while ((m = plage.exec(l))) {
    const a = Number(m[1]), b = Number(m[2])
    if (b > a && b - a <= 60) { for (let k = a; k <= b; k++) out.push(String(k)); couverts.add(m.index) }
  }
  const sansPlages = l.replace(/\b\d{1,4}\s*à\s*\d{1,4}\b/g, ' ')
  for (const x of sansPlages.match(/\b\d{1,4}(?:-[a-z]|\s*(?:bis|ter))?\b(?!\s*(?:[èe]me|er|e)\b)/gi) ?? []) out.push(x.replace(/\s+/g, '').toLowerCase())
  for (const r of sansPlages.match(/\b(?:I{1,3}|IV|VI{0,3}|IX|X{1,3})\b/g) ?? []) out.push(r)
  return [...new Set(out)]
}
function unites(ref: string): { unites: Unite[]; reliquat: string } {
  const out: Unite[] = []
  let reste = ref
  // 1) « article(s) <liste> <SIGLE> » — le sigle peut être suivi d'un point.
  const SIG = 'C\\.?\\s?T\\.?\\s?A\\.?|CTA|C\\.?\\s?P\\.?\\s?C\\.?|CPC|C\\.?\\s?I\\.?\\s?C\\.?|CIC|C\\.?\\s?Com\\.?|C\\.?\\s?C\\.?|cc\\.?|C\\.?\\s?P\\.?|CP|C\\.?\\s?T\\.?|CT|Code\\s+du\\s+Travail(?:\\s+Annot[ée])?|Code\\s+de\\s+Proc[ée]dure\\s+Civile|Code\\s+d.Instruction\\s+Criminelle|Code\\s+Civil|Code\\s+P[ée]nal|Code\\s+de\\s+Commerce'
  // ⚠️ LE CODE DU TRAVAIL A DEUX NUMÉROTATIONS HISTORIQUES avant l'édition annotée : « C.T. de
  // 1961 » et « C.T. de 1984 » (« articles 35, 40, 167 C.T. de 1961 [44, 48, 161 C.T. de 1984] »).
  // La clé porte le millésime quand le livre le donne : CT-1961, CT-1984 ; CT sinon.
  // …et le CPC aussi (« C.P.C. de 1836 [article 292 C.P.C. de 1963] ») : tout sigle daté porte son an.
  const cleAvecAn = (cible: string, an: string | undefined) => (an ? `${cible}-${an}` : cible)
  const reSigle = new RegExp('(?:articles?|arts?\\.?|art\\.?)\\s+([\\dIVX][\\dIVX\\s,\\-\\p{L}.()]*?)\\s*(?:modifi[ée]s?\\s+)?(?:du\\s+|de\\s+la\\s+)?(' + SIG + ')(?![a-z])\\.?(?:\\s+de\\s+(19\\d{2}))?', 'giu')
  reste = reste.replace(reSigle, (_m, liste: string, sigle: string, an?: string) => {
    const cible = SIGLES.find(([re]) => re.test(sigle))?.[1] ?? null
    if (!cible) return _m
    for (const a of articlesDe(liste)) out.push({ cible: cleAvecAn(cible, an), cibleLibelle: sigle.trim() + (an ? ` de ${an}` : ''), article: a, cibleDate: null })
    return ' '
  })
  // 1 bis) « <liste> <SIGLE> » sans le mot article (« 588 et 589 C.T. », « 286 et 282 CPC »)
  const reNu = new RegExp('((?:\\d{1,4}|\\b(?:I{1,3}|IV|VI{0,3}|IX|X{1,3})\\b)(?:\\s*(?:à|et|,)\\s*(?:\\d{1,4}|(?:I{1,3}|IV|VI{0,3}|IX|X{1,3})\\b))*)\\s*(?:modifi[ée]s?\\s+)?(?:du\\s+|de\\s+la\\s+)?(' + SIG + ')(?![a-z])\\.?(?:\\s+de\\s+(19\\d{2}))?', 'gi')
  reste = reste.replace(reNu, (_m, liste: string, sigle: string, an?: string) => {
    const cible = SIGLES.find(([re]) => re.test(sigle))?.[1] ?? null
    if (!cible) return _m
    for (const a of articlesDe(liste)) out.push({ cible: cleAvecAn(cible, an), cibleLibelle: sigle.trim() + (an ? ` de ${an}` : ''), article: a, cibleDate: null })
    return ' '
  })
  // 2) « [article(s) <liste>] <Loi|Décret|Constitution|Code de Commerce|Convention> … »
  const reTexte = /(?:(?:articles?|arts?\.?)?\s*([\d][\d\s,\-a-z]*?)\s*,?\s*(?:de\s+la\s+|du\s+|d[ée]cret\s+)?)?((?:Loi|D[ée]cret(?:-Loi)?|Constitution|Convention\s+de\s+Varsovie)[^;\[\]]*?)(?=\s*(?:;|\]|\[|$|\bet\s+(?:articles?|\d)))/gi
  reste = reste.replace(reTexte, (_m, liste: string | undefined, texte: string) => {
    const lib = texte.replace(/\s+/g, ' ').replace(/[.\s]+$/, '').trim()
    const d = iso(lib)
    let cible: string
    if (/^Constitution/i.test(lib)) {
      const an = /\b(19\d{2}|20\d{2})\b/.exec(lib)?.[1]
      cible = an ? `CONST-${an}` : 'CONST'
    } else if (/^Code\s+de\s+Commerce/i.test(lib)) cible = 'CCOM'
    else if (/^Convention\s+de\s+Varsovie/i.test(lib)) cible = 'CONV-VARSOVIE'
    else if (d) cible = `${/^D/i.test(lib) ? 'DECRET' : 'LOI'}-${d}`
    else cible = `${/^D/i.test(lib) ? 'DECRET' : 'LOI'}-LIB-${slugOf(lib).slice(0, 48)}` // sans date lisible : clé par libellé
    const arts = liste ? articlesDe(liste) : []
    if (arts.length) for (const a of arts) out.push({ cible, cibleLibelle: lib, article: a, cibleDate: d })
    else out.push({ cible, cibleLibelle: lib, article: null, cibleDate: d })
    return ' '
  })
  // Résidus inoffensifs — le mot « articles » resté seul après lecture d'une plage, « et
  // suivants », « modifié », « de 1961 » — ne sont pas des renvois perdus : on les retire
  // AVANT de compter ce qui reste, pour que le compte dise la vérité.
  const reliquat = reste
    .replace(/\b(articles?|arts?\.?|et|suivants?|modifi[ée]s?|de\s+(?:19|20)\d{2}|alin[ée]as?|dernier|\d+(?:[èe]me|er|e))\b/gi, ' ')
    .replace(/[\s;,.\[\]()]+/g, ' ')
    .trim()
  return { unites: out, reliquat }
}

// ─── 1. Parcours ────────────────────────────────────────────────────────────────────────────
type Entree = { notion: string; rang: number; rangLivre: number | null; teteBrute: string; dateIso: string | null; formation: string | null; parties: string; refsBrutes: string | null; attendus: string[] }
type Notion = { label: string; lettre: string; parentLabel: string | null; preambule: string[]; entrees: Entree[] }

const paras = paragraphes()
const notions: Notion[] = []
let lettre = ''
let cur: Notion | null = null
let curEntree: Entree | null = null
// Numéro facultatif (« Arrêt du 2 août 1989 … » nu sous APPEL – MISSION), « 1- » sans point
// (RÉEMBAUCHAGE), « 3.- », « 3. », « 3 .- ». Une tête nue doit porter des parties (« c. »).
// ⚠️ Le « c. » ne se garde pas : « c.Résulma », « c Nelson », « C. Ketty », « ȼ Raymond », ou une
// simple liste « 1) X 2) Y » — 53 têtes numérotées passaient à côté. Une tête NUMÉROTÉE se
// reconnaît à son numéro ; une tête NUE, à sa date ET sa formation.
const RE_TETE_NUM = /^\s*(\d{1,3})\s*[.\-–—]+\s*(?:Arr[êe]t|ARR[ÊE]T)\s+(?:du\s+)?(.*)$/
const RE_TETE_NUE = /^\s*(?:Arr[êe]t|ARR[ÊE]T)\s+du\s+(\d{1,2}(?:er)?\s+[a-zéû]+\s*\d{4}\s*,\s*(?:1(?:ère|re|er)|2(?:ème|e))\s+section.*)$/i
const horsPatron: string[] = []

/**
 * ⚠️ DES TITRES DE NOTION ONT PERDU LEUR STYLE. « CONTRAT DE TRAVAIL - INTERPRÉTATION » est un
 * paragraphe ordinaire, en capitales, entre deux entrées : lu comme un attendu, il fondait
 * ses entrées dans la notion précédente — d'où 17 notions à rangs « [1,1,2,2,3,4] ». Un titre
 * est donc : Heading1, OU une ligne tout en capitales (avec des lettres), courte, qui ne
 * commence ni par un chiffre ni par « Attendu » ni par « *** ».
 */
const ressembleTitre = (t: string) =>
  t.length >= 3 && t.length <= 120 && /\p{L}/u.test(t) && t === t.toUpperCase() && !/^\d/.test(t) && !/^(attendu|\*\*\*)/i.test(t) && !/[:;]\s*$/.test(t)

for (const { style, texte } of paras) {
  if (!texte) continue
  if (style === 'Heading1' || ressembleTitre(texte)) {
    if (/^[A-Z]$/.test(texte)) { lettre = texte; continue }
    const label = texte.replace(/\s+/g, ' ').trim()
    const sep = label.indexOf(' - ')
    cur = { label, lettre, parentLabel: sep > 0 ? label.slice(0, sep).trim() : null, preambule: [], entrees: [] }
    notions.push(cur)
    curEntree = null
    continue
  }
  if (!cur) continue
  const mn = RE_TETE_NUM.exec(texte)
  const mu = mn ? null : RE_TETE_NUE.exec(texte)
  const m = mn ?? (mu ? [mu[0], null, mu[1]] as unknown as RegExpExecArray : null)
  if (m) {
    const rangLivre = m[1] ? Number(m[1]) : null
    const rang = cur.entrees.length + 1 // position d'apparition — la seule qui tienne face aux 6 notions mal numérotées
    let corps = m[2]
    // date
    const dm = RE_DATE.exec(corps)
    const dateIso = dm ? iso(dm[0]) : null
    corps = dm ? corps.slice(dm.index + dm[0].length).replace(/^\s*,?\s*/, '') : corps
    const { label: form, reste } = formation(corps)
    // parties jusqu'à « - Réf: » ou « Réf: »
    const rm = /\s*[-–—]?\s*R[ée]f\s*:\s*/i.exec(reste)
    const parties = (rm ? reste.slice(0, rm.index) : reste).replace(/[.\s]+$/, '').trim()
    const refsBrutes = rm ? reste.slice(rm.index + rm[0].length).trim().replace(/\.$/, '') : null
    curEntree = { notion: cur.label, rang, rangLivre, teteBrute: texte, dateIso, formation: form, parties, refsBrutes, attendus: [] }
    cur.entrees.push(curEntree)
    continue
  }
  if (/^\s*\d{1,3}\s*\.\s*-?\s*\S/.test(texte) && /arr[êe]t/i.test(texte.slice(0, 40))) horsPatron.push(texte.slice(0, 120))
  if (curEntree) curEntree.attendus.push(texte)
  else cur.preambule.push(texte)
}

// ─── 2. Sentinelles de structure ────────────────────────────────────────────────────────────
const entrees = notions.flatMap((n) => n.entrees)
console.log(`notions : ${notions.length} · entrées : ${entrees.length} · attendus : ${entrees.reduce((s, e) => s + e.attendus.length, 0)}`)
const rangsFaux: string[] = []
for (const n of notions) {
  const rangs = n.entrees.map((e) => e.rangLivre ?? -1).sort((a, b) => a - b)
  const attendu = [...Array(n.entrees.length)].map((_, i) => i + 1)
  if (rangs.join(',') !== attendu.join(',')) rangsFaux.push(`${n.label} → livre [${rangs.join(',')}] → stocké 1…${n.entrees.length}`)
}
if (horsPatron.length) console.log(`⚠️ ${horsPatron.length} ligne(s) qui ressemblent à une tête sans passer le patron :\n   ${horsPatron.slice(0, 6).join('\n   ')}`)
if (rangsFaux.length) {
  console.log(`⚠️ ${rangsFaux.length} notion(s) dont les rangs ≠ {1…N} :\n   ${rangsFaux.slice(0, 12).join('\n   ')}`)
}
// « *** - Ce considérant prête à confusion… » : NOTE DE L'AUTEUR, pas un artefact — gardée.
const artefacts = entrees.filter((e) => e.attendus.some((a) => a.includes('<w:')))
if (artefacts.length) arret(`${artefacts.length} entrée(s) portent des artefacts d'extraction`)
const sansDate = entrees.filter((e) => !e.dateIso)
const sansForm = entrees.filter((e) => !e.formation)

// ─── 3. Identités d'arrêt ───────────────────────────────────────────────────────────────────
type Identite = { cle: string; dateIso: string; formation: string | null; parties: string; partiesNorm: string; entrees: Entree[] }
const identites = new Map<string, Identite>()
// ⚠️ ARBITRAGE VÉRIFIÉ SUR L'IMAGE — RAEJH p. 133, ligne rendue à 300 dpi : « Arrêt du 12 juillet
// 1989, 1ère Section, Brewton Fashion International S.A. ». Le manuscrit écrit 1909 (quatre
// fois) : coquille pour 1989 — pas 1979, comme une première lecture le supposait.
let corr1909 = 0
for (const e of entrees) if (e.dateIso === '1909-07-12' && /brewton/i.test(e.parties)) { e.dateIso = '1989-07-12'; corr1909++ }
// ⚠️ « 37 juillet 1981 », Jean L. Dominique c. Veuve Ricardo Widmaer — le LIVRE lui-même imprime
// « 37 » une fois (couche texte, l. 7561) et « 31 juillet 1981 » TROIS fois pour le même arrêt
// (l. 9765, 10360, 26541). Corrigé sur cette attestation ; sans elle, l'entrée serait écartée.
let corr37 = 0
for (const e of entrees) if (e.dateIso === '1981-07-37' && /widmaer/i.test(e.parties)) { e.dateIso = '1981-07-31'; corr37++ }
// SENTINELLE : plus aucune date invalide — Prisma refuse un Date invalide et annule le lot entier.
const invalides = entrees.filter((e) => e.dateIso && isNaN(new Date(e.dateIso + 'T00:00:00Z').getTime()))
if (invalides.length) arret(`${invalides.length} date(s) invalide(s) non arbitrée(s) : ${invalides.map((e) => e.dateIso + ' « ' + e.parties.slice(0, 40) + ' »').join(' ; ')}`)
for (const e of entrees) {
  if (!e.dateIso) continue
  const pn = normParties(e.parties)
  const cle = `${e.dateIso}|${e.formation ?? ''}|${pn}`
  const id = identites.get(cle) ?? { cle, dateIso: e.dateIso, formation: e.formation, parties: e.parties, partiesNorm: pn, entrees: [] }
  id.entrees.push(e)
  identites.set(cle, id)
}
// doublons probables : même (date, formation), parties proches
const parJour = new Map<string, Identite[]>()
for (const id of identites.values()) {
  const k = `${id.dateIso}|${id.formation ?? ''}`
  parJour.set(k, [...(parJour.get(k) ?? []), id])
}
/**
 * ⚠️ FUSION DES VARIANTES D'ÉCRITURE — décision d'exécution du 14 sept. 2026, sur lecture des
 * 106 paires rapportées au premier passage : GUIDEAU/GUITEAU, Plaine/Pleine, « S.A. » présent
 * ou absent, « 1o) » présent ou absent, accents, Mme/Dame, parties INVERSÉES. Même jour, même
 * formation, parties à ≥ 0,8 de similarité trigramme : c'est le même arrêt. On fusionne par
 * fermeture transitive ; la variante la plus longue devient canonique ; CHAQUE fusion est
 * rapportée. Une identité sans formation rejoint celle qui en a une (même jour, parties ≈).
 */
const doublonsProbables: [string, string, number][] = []
const parent = new Map<string, string>()
const find = (k: string): string => (parent.get(k) === k || !parent.has(k) ? k : (parent.set(k, find(parent.get(k)!)), parent.get(k)!))
const union = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb) }
for (const id of identites.values()) parent.set(id.cle, id.cle)
const parJourSansForm = new Map<string, Identite[]>()
for (const id of identites.values()) parJourSansForm.set(id.dateIso, [...(parJourSansForm.get(id.dateIso) ?? []), id])
for (const grp of parJourSansForm.values()) {
  for (let i = 0; i < grp.length; i++)
    for (let j = i + 1; j < grp.length; j++) {
      const a = grp[i], b = grp[j]
      if (a.formation && b.formation && a.formation !== b.formation) continue
      const s = similarite(a.partiesNorm, b.partiesNorm)
      const inv = similarite(a.partiesNorm.split(' c ').reverse().join(' c '), b.partiesNorm)
      if (Math.max(s, inv) >= 0.8) { doublonsProbables.push([a.parties, b.parties, Math.max(s, inv)]); union(a.cle, b.cle) }
    }
}
// Recomposition : une identité par classe, la variante la plus longue en tête, formation connue conservée.
const classes = new Map<string, Identite[]>()
for (const id of identites.values()) { const r = find(id.cle); classes.set(r, [...(classes.get(r) ?? []), id]) }
identites.clear()
for (const membres of classes.values()) {
  const canon = [...membres].sort((x, y) => y.parties.length - x.parties.length)[0]
  const form = membres.find((m) => m.formation)?.formation ?? null
  const fusion: Identite = { ...canon, formation: form, entrees: membres.flatMap((m) => m.entrees) }
  for (const e of fusion.entrees) { e.formation = e.formation ?? form; e.parties = canon.parties }
  identites.set(fusion.cle, fusion)
}

// ─── 4. Les « 1909 » — vérifiés sur le PDF ──────────────────────────────────────────────────
const mille909 = entrees.filter((e) => e.dateIso?.startsWith('1909'))
let verdict1909 = '—'
if (mille909.length) {
  const couche = execFileSync('pdftotext', [PDF, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const hits = [...couche.matchAll(/Brewton[^\n]{0,120}/gi)].map((m) => m[0])
  const dates = new Set<string>()
  for (const h of hits) {
    const idx = couche.indexOf(h)
    const ctx = couche.slice(Math.max(0, idx - 200), idx + 100)
    for (const d of ctx.matchAll(/(\d{1,2})\s+juillet\s+(19\d{2})/gi)) dates.add(d[2])
  }
  verdict1909 = hits.length ? `PDF : ${hits.length} occurrence(s) de « Brewton », années lues autour : ${[...dates].join(', ') || 'aucune'}` : 'PDF : « Brewton » introuvable dans la couche texte'
}

// ─── 5. Renvois unitaires ───────────────────────────────────────────────────────────────────
let nbUnites = 0, nbReliquat = 0, nbPosterieur = 0
const reliquats: string[] = []
const extraits = entrees.map((e) => {
  const u = e.refsBrutes ? unites(e.refsBrutes) : { unites: [] as Unite[], reliquat: '' }
  nbUnites += u.unites.length
  if (u.reliquat.length > 2) { nbReliquat++; if (reliquats.length < 15) reliquats.push(`${u.reliquat}   ⟵ « ${e.refsBrutes} »`) }
  const refs = u.unites.map((x) => {
    const posterieur = !!(x.cibleDate && e.dateIso && x.cibleDate > e.dateIso) || (/^CONST-(\d{4})/.test(x.cible) && !!e.dateIso && Number(/^CONST-(\d{4})/.exec(x.cible)![1]) > Number(e.dateIso.slice(0, 4)))
    if (posterieur) nbPosterieur++
    return { cible: x.cible, cibleLibelle: x.cibleLibelle, article: x.article, posterieur }
  })
  return { notion: e.notion, rang: e.rang, dateIso: e.dateIso, formation: e.formation, parties: e.parties, texte: e.attendus.join('\n'), refsBrutes: e.refsBrutes, refs, reliquatRefs: u.reliquat || null }
})
const parCible = new Map<string, number>()
for (const x of extraits) for (const r of x.refs) parCible.set(r.cible, (parCible.get(r.cible) ?? 0) + 1)

// ─── 6. Notions → arbre (parent = avant le premier tiret) ───────────────────────────────────
const labelsExistants = new Set(notions.map((n) => n.label))
const parentsVirtuels = new Set<string>()
for (const n of notions) if (n.parentLabel && !labelsExistants.has(n.parentLabel)) parentsVirtuels.add(n.parentLabel)
const slugs = new Map<string, string>()
const collisions: string[] = []
const slugPour = (label: string) => {
  let s = `jfs-${slugOf(label)}`
  if ([...slugs.values()].includes(s)) { collisions.push(label); s += '-2' }
  slugs.set(label, s)
  return s
}
const notionsSortie = [
  ...[...parentsVirtuels].map((label) => ({ label, lettre: label[0], parent: null as string | null, slug: slugPour(label), virtuel: true, preambule: [] as string[], nb: 0 })),
  ...notions.map((n) => ({ label: n.label, lettre: n.lettre, parent: n.parentLabel, slug: slugPour(n.label), virtuel: false, preambule: n.preambule, nb: n.entrees.length })),
]
const sigles = notionsSortie.flatMap((n) => (n.label.match(/\b[A-ZÀ-Ý]{2,4}\b/g) ?? []).filter((t) => !['DE', 'DU', 'LA', 'LE', 'ET', 'EN', 'AU', 'DES', 'LES', 'SUR', 'PAR', 'UN', 'UNE', 'D', 'L'].includes(t)))

// ─── 7. Rapport ─────────────────────────────────────────────────────────────────────────────
const vides = notions.filter((n) => !n.entrees.length)
const rapport = `# RAEJH — rapport d'extraction (${new Date().toISOString().slice(0, 10)})

| | |
|---|---|
| notions (H1 hors lettres) | ${notions.length} (+ ${parentsVirtuels.size} parents virtuels créés par le tiret) |
| notions vides | ${vides.length} — ${vides.map((v) => `« ${v.label} »${v.preambule.length ? ' : ' + v.preambule[0].slice(0, 60) : ''}`).join(' ; ')} |
| entrées | ${entrees.length} |
| rangs ≠ {1…N} | ${rangsFaux.length} |
| lignes hors patron (tête manquée ?) | ${horsPatron.length} |
| attendus | ${entrees.reduce((s, e) => s + e.attendus.length, 0)} |
| entrées sans date lisible | ${sansDate.length} |
| entrées sans formation | ${sansForm.length} |
| formations | ${JSON.stringify(Object.fromEntries([...new Set(entrees.map((e) => e.formation))].map((f) => [f ?? '∅', entrees.filter((e) => e.formation === f).length])))} |
| **arrêts distincts** (date, formation, parties normalisées) | **${identites.size}** |
| cités sous ≥ 2 notions | ${[...identites.values()].filter((i) => i.entrees.length > 1).length} · max ${Math.max(...[...identites.values()].map((i) => i.entrees.length))} |
| doublons probables (même jour, parties ≈) | ${doublonsProbables.length} |
| entrées « 1909 » corrigées en 1989 (RAEJH p. 133, image) | ${corr1909} — ${verdict1909} |
| « 37 juillet 1981 » corrigé en 31 juillet (attesté 3× par le livre) | ${corr37} |
| identités fusionnées (variantes d'écriture, ≥ 0,8) | ${doublonsProbables.length} paires |
| entrées avec Réf | ${entrees.filter((e) => e.refsBrutes).length} |
| renvois unitaires | ${nbUnites} · dont postérieurs à l'arrêt : ${nbPosterieur} |
| entrées à reliquat non découpé | ${nbReliquat} |
| slugs en collision (suffixés -2) | ${collisions.length} |
| jetons capitales ≤ 4 (sigles possibles) | ${[...new Set(sigles)].slice(0, 40).join(', ')} |

## Renvois par cible (20 premières)
${[...parCible.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([c, n]) => `- ${c} : ${n}`).join('\n')}

## Variantes d'écriture FUSIONNÉES (même jour, parties ≥ 0,8)
${doublonsProbables.slice(0, 30).map(([a, b, s]) => `- ${(s * 100).toFixed(0)} % · « ${a} » ↔ « ${b} »`).join('\n') || '— aucun —'}

## Reliquats de Réf non découpés (15 premiers)
${reliquats.map((r) => `- ${r}`).join('\n') || '— aucun —'}

## Rangs ≠ {1…N}
${rangsFaux.slice(0, 30).map((r) => `- ${r}`).join('\n') || '— aucun —'}

## Sans formation (10 premières)
${sansForm.slice(0, 10).map((e) => `- ${e.teteBrute.slice(0, 110)}`).join('\n') || '— aucune —'}
`

// ─── 8. Écriture ────────────────────────────────────────────────────────────────────────────
mkdirSync(OUT, { recursive: true })
const fichiers: Record<string, string> = {
  'notions.json': JSON.stringify(notionsSortie, null, 1),
  'arrets.json': JSON.stringify([...identites.values()].map((i) => ({ cle: i.cle, dateIso: i.dateIso, formation: i.formation, parties: i.parties, nbEntrees: i.entrees.length, notions: i.entrees.map((e) => e.notion) })), null, 1),
  'extraits.json': JSON.stringify(extraits, null, 1),
  'rapport.md': rapport,
}
const emp: string[] = []
for (const [nom, c] of Object.entries(fichiers)) {
  writeFileSync(join(OUT, nom), c)
  emp.push(`${createHash('sha256').update(c).digest('hex')}  ${nom}`)
}
writeFileSync(join(OUT, 'EMPREINTES.txt'), emp.join('\n') + '\n')
console.log(rapport.split('\n').slice(0, 26).join('\n'))
console.log(`\n✅ jeu écrit : ${OUT}`)
