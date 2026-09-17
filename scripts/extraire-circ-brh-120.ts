/**
 * CIRCULAIRE BRH n° 120 (25 mai 2021) — EXTRACTION du .docx du Cabinet Salès vers le jeu
 * `scripts/data/circ-brh-120/` : `_body.txt` (corps versé), `_struct.json` (points, libellés,
 * sommaire, arbre de navigation), `rapport.md`.
 *
 *     npx tsx scripts/extraire-circ-brh-120.ts
 *
 * Rejouable, sans base. Prompt : « Lam — Prompt circulaire BRH n° 120 (texte du Cabinet Salès,
 * lecteur annoté).md ».
 *
 * ─── CE QUE L'EXTRACTION FAIT, ET POURQUOI ─────────────────────────────────────────────────
 *  · Runs assemblés `<w:t>` | `<w:tab/>` | `<w:br/>` — leçon UCREF : un `<w:tab/>` avalé colle
 *    les colonnes. Ici 0 `<w:tab/>` mais 318 tabulations LITTÉRALES (U+0009) après les lettres
 *    d'alinéa (« a)⇥ Action ») → une espace.
 *  · Les TROIS notes de bas de page (`word/footnotes.xml`) sont replacées IMMÉDIATEMENT après
 *    le paragraphe qui les appelle, sur leur propre ligne « (n) … » ; l'appel devient « (n) »
 *    dans le paragraphe (décision D2). Le fac-similé les met au bas des pages 28, 43 et 48 :
 *    l'extraction précédente les avait donc laissées au milieu du texte, loin de leur appel.
 *  · QUATRE COQUILLES DE LA BRH, corrigées en silence par le transcripteur, sont RÉTABLIES
 *    (cinq occurrences) : le fac-similé fait foi, fautes comprises — « le plut tôt »,
 *    « établit un document », « ne suit pas à l'émetteur », « qu'elle qu'en soit » ×2. Chaque
 *    substitution est comptée ; un compte différent de 1 (ou 2) arrête l'extraction.
 *  · Le sommaire (`toc`) porte les 8 sections, la « Liste des Annexes », les 4 annexes et
 *    TOUTES leurs subdivisions (Heading2 → niveau 2, Heading3 → niveau 3 ; le titre d'annexe,
 *    Heading3 sous le Heading1 « ANNEXE N », est niveau 2). Les 45 articles ne sont PAS des
 *    entrées de sommaire : ce sont des divisions (`pointAnchors`), ancrées art-1 … art-45.
 *  · ⚠️ Les annexes renumérotent depuis « 1. » : « 1. Renseignements concernant l'opération »
 *    a la forme d'une tête d'article. Parce que `segmentAnnotated` apparie le sommaire AVANT de
 *    tester les points, l'inscrire au sommaire en fait une section, jamais un faux article.
 *  · « SECTION I » et « GENERALITES » sont deux lignes au fac-similé : deux lignes au corps.
 *    L'entrée de sommaire est « SECTION I » ; « GENERALITES » reste la première ligne de la
 *    section. On ne fusionne pas ce que l'original sépare.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(process.cwd(), 'scripts/data/circ-brh-120')
const DOCX = join(DIR, 'BRH_Circulaire_120.docx')
const NB_ARTICLES = 45

/**
 * Les coquilles de la BRH (fac-similé, pdftotext l. 674, 706, 1747, 1536, 2161) et ce que le .docx
 * en a fait. Le .docx mêle apostrophes droites et typographiques, comme le fac-similé : le motif
 * accepte les deux et la substitution ne touche qu'au mot, jamais à l'apostrophe voisine.
 */
const REVERSIONS: { nom: string; docx: RegExp; facsimile: string; attendu: number }[] = [
  { nom: 'le plus tôt → le plut tôt', docx: /le plus tôt possible/g, facsimile: 'le plut tôt possible', attendu: 1 },
  { nom: 'établi → établit', docx: /il doit être établi un document complémentaire/g, facsimile: 'il doit être établit un document complémentaire', attendu: 1 },
  { nom: 'ne nuit pas → ne suit pas', docx: /dont la divulgation ne nuit pas à l(['’])émetteur/g, facsimile: 'dont la divulgation ne suit pas à l$1émetteur', attendu: 1 },
  { nom: 'quelle qu’en → qu’elle qu’en', docx: /quelle qu(['’])en soit la nature/g, facsimile: 'qu$1elle qu$1en soit la nature', attendu: 2 },
]

const unzip = (entry: string) => execFileSync('unzip', ['-p', DOCX, entry], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))

interface Para { style: string; text: string; notes: string[] }

/** Texte d'un paragraphe : runs, tabulations, appels de note « (n) ». */
function texteParagraphe(p: string, notes: Map<string, string>, appels: string[]): string {
  let out = ''
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>|<w:footnoteReference w:id="(\d+)"\/>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(p))) {
    if (m[2] !== undefined) {
      if (!notes.has(m[2])) throw new Error(`appel de note ${m[2]} sans texte`)
      appels.push(m[2])
      out += ` (${m[2]})`
    } else if (m[0] === '<w:tab/>' || m[0] === '<w:br/>') out += ' '
    else out += decode(m[1])
  }
  // Tabulation et insécable → espace, espaces repliés — et RIEN d'autre : l'espace avant « : »
  // ou « ; » est celle du fac-similé, on ne retouche pas la ponctuation de la BRH.
  return out.replace(/[\t\u00a0]/g, ' ').replace(/ {2,}/g, ' ').trim()
}

function lireNotes(): Map<string, string> {
  const xml = unzip('word/footnotes.xml')
  const notes = new Map<string, string>()
  for (const m of xml.matchAll(/<w:footnote (?:[^>]*?)w:id="(-?\d+)"[^>]*>([\s\S]*?)<\/w:footnote>/g)) {
    const t = [...m[2].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((x) => decode(x[1])).join('').replace(/\s+/g, ' ').trim()
    if (t) notes.set(m[1], t)
  }
  return notes
}

function main() {
  mkdirSync(DIR, { recursive: true })
  const notes = lireNotes()
  const xml = unzip('word/document.xml')
  const paras: Para[] = []
  for (const m of xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)) {
    const p = m[0]
    const style = /<w:pStyle w:val="([^"]+)"/.exec(p)?.[1] ?? ''
    const appels: string[] = []
    const text = texteParagraphe(p, notes, appels)
    if (!text) continue
    paras.push({ style, text, notes: appels.map((n) => `(${n}) ${notes.get(n)}`) })
  }

  // ── Reversions (fac-similé fait foi) ──
  const compte = new Map<string, number>()
  for (const para of paras) {
    for (const r of REVERSIONS) {
      const n = (para.text.match(r.docx) ?? []).length
      if (n) { compte.set(r.nom, (compte.get(r.nom) ?? 0) + n); para.text = para.text.replace(r.docx, r.facsimile) }
    }
  }
  for (const r of REVERSIONS) {
    const n = compte.get(r.nom) ?? 0
    if (n !== r.attendu) throw new Error(`reversion « ${r.nom} » : ${n} occurrence(s), ${r.attendu} attendue(s) — le .docx a changé ? STOP`)
  }

  // ── Structure ──
  const lignes: string[] = []
  const toc: { level: number; label: string; anchor: string; kind: 'code' }[] = []
  type Nav = { label: string; anchor: string; children: Nav[] }
  const navToc: Nav[] = []
  const points: string[] = []
  const labels: Record<string, string> = {}
  let enAnnexe = false
  let secN = 0
  let dernierH1: Nav | null = null
  let dernierH2: Nav | null = null
  let prevStyle = ''
  const notesPlacees: string[] = []
  const NAV_SECTION: Record<string, string> = { 'SECTION I': 'Section I — Généralités' }

  for (const para of paras) {
    const t = para.text
    const estH1 = para.style === 'Heading1'
    const estH2 = para.style === 'Heading2'
    const estH3 = para.style === 'Heading3'
    const art = /^(\d{1,2})\.\s+\S/.exec(t)
    if (estH1 && /^ANNEXE\b/.test(t)) enAnnexe = true

    if (estH1) {
      // « GENERALITES » suit « SECTION I » sur sa propre ligne : pas une section, une ligne du corps.
      if (prevStyle === 'Heading1' && dernierH1 && /^SECTION I$/.test(dernierH1.label.replace(/ — .*$/, '').toUpperCase()) && t === 'GENERALITES') {
        lignes.push(t); prevStyle = para.style; continue
      }
      const anchor = `sec-${++secN}`
      toc.push({ level: 1, label: t, anchor, kind: 'code' })
      dernierH1 = { label: NAV_SECTION[t] ?? joli(t), anchor, children: [] }
      dernierH2 = null
      navToc.push(dernierH1)
    } else if (!enAnnexe && estH2 && art && Number(art[1]) === points.length + 1) {
      // Un article du dispositif : division ancrée, PAS une entrée de sommaire.
      points.push(art[1])
      labels[`art-${art[1]}`] = `Article ${art[1]}`
      dernierH1!.children.push({ label: t, anchor: `art-${art[1]}`, children: [] })
    } else if (estH2 || estH3) {
      // Sous-titres : « Liste des Annexes », titres et subdivisions d'annexes.
      const anchor = `sec-${++secN}`
      const titreAnnexe = estH3 && prevStyle === 'Heading1'
      const level = titreAnnexe || estH2 ? 2 : 3
      toc.push({ level, label: t, anchor, kind: 'code' })
      const noeud: Nav = { label: t, anchor, children: [] }
      if (level === 2) { dernierH1!.children.push(noeud); dernierH2 = noeud }
      else (dernierH2 ?? dernierH1!).children.push(noeud)
    }
    lignes.push(t)
    for (const n of para.notes) { lignes.push(n); notesPlacees.push(n) }
    prevStyle = para.style
  }

  const body = lignes.join('\n')
  if (points.length !== NB_ARTICLES) throw new Error(`${points.length} articles reconnus, ${NB_ARTICLES} attendus — STOP`)
  if (notesPlacees.length !== notes.size) throw new Error(`${notesPlacees.length} notes placées pour ${notes.size} lues — STOP`)
  if (/\t| /.test(body)) throw new Error('tabulation ou insécable résiduelle — STOP')
  if (/^\[\d+\]$/m.test(body)) throw new Error('marqueur de page — STOP')

  writeFileSync(join(DIR, '_body.txt'), body + '\n')
  writeFileSync(join(DIR, '_struct.json'), JSON.stringify({ points, labels, toc, navToc }, null, 1) + '\n')
  const rapport = [
    '# Extraction — circulaire BRH n° 120 (.docx du Cabinet Salès)', '',
    `- paragraphes non vides : ${paras.length} · lignes du corps : ${lignes.length} · caractères : ${body.length}`,
    `- articles (pointAnchors) : ${points.length} (art-1 … art-${points.length})`,
    `- entrées de sommaire : ${toc.length} (niveau 1 : ${toc.filter((t) => t.level === 1).length} · niveau 2 : ${toc.filter((t) => t.level === 2).length} · niveau 3 : ${toc.filter((t) => t.level === 3).length})`,
    `- notes de bas de page replacées après leur appel : ${notesPlacees.length}`,
    '- reversions (le fac-similé fait foi) :',
    ...REVERSIONS.map((r) => `  - ${r.nom} : ${compte.get(r.nom)} occurrence(s)`),
    `- sha256 _body.txt : ${createHash('sha256').update(body + '\n').digest('hex')}`,
    '', '## Sommaire', ...toc.map((t) => `${'  '.repeat(t.level - 1)}- ${t.anchor} · ${t.label}`),
  ].join('\n')
  writeFileSync(join(DIR, 'rapport.md'), rapport + '\n')
  console.log(rapport.split('\n').slice(0, 12).join('\n'))
}

function joli(titre: string): string {
  // « SECTION II - EMETTEURS » → « Section II — Émetteurs » (libellé de navigation seulement ; le corps reste sic)
  const [num, ...reste] = titre.split(/\s[-–]\s/)
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replace(/(^|\s)(l’|d’|de |des |du |et |la |le |les |à |aux |au |sur )/g, '$1$2')
  const n = num.replace(/^SECTION/, 'Section').replace(/^ANNEXE/, 'Annexe')
  return reste.length ? `${n} — ${cap(reste.join(' — '))}` : n
}

main()
