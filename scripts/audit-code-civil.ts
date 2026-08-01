/**
 * Audit du Code civil en base : structure des lignes, appareil (jurisprudence et
 * annotations), séquelles d'OCR.
 *
 * LECTURE SEULE. Le rapport donne, pour chaque défaut, un compte et des exemples
 * localisés (numéro de ligne, article) : de quoi confronter au fac-similé sans
 * relire 700 Ko.
 *
 *     npx tsx scripts/audit-code-civil.ts            # rapport résumé
 *     npx tsx scripts/audit-code-civil.ts --detail   # tous les cas, pas seulement des exemples
 */
import { PrismaClient } from '@prisma/client'
import { articleAnchorFromHeading } from '../src/lib/doc/anchors'

const prisma = new PrismaClient()
const DETAIL = process.argv.includes('--detail')
const MAX = DETAIL ? 10_000 : 8

// Le suffixe décimal fait partie du NUMÉRO : « Art. 1181-1 » (décret de 2020) n'est pas
// une seconde occurrence de l'article 1181.
const ART_TETE = /^Art(?:icle)?s?\.?\s*(\d{1,4}(?:-\d{1,2})?)(?:\s*(bis|ter))?\b/i
const INTERTITRE = /^(CHAPITRE|SECTION|TITRE|LIVRE|LOI\b|DISPOSITION)/i
/** Référence d'arrêt : la signature d'une note de l'éditeur. */
const ARRET = /\bCass\.?\s*,?\s*(?:\d{1,2}(?:er)?\s+[a-zéû]+\s+\d{4}|arr[êe]t|\d{4})/i

type Cas = { ligne?: number; article?: string; extrait: string }
const dossiers = new Map<string, { titre: string; cas: Cas[] }>()
function noter(cle: string, titre: string, c: Cas) {
  if (!dossiers.has(cle)) dossiers.set(cle, { titre, cas: [] })
  dossiers.get(cle)!.cas.push(c)
}
const court = (s: string, n = 150) => s.replace(/\s+/g, ' ').trim().slice(0, n)

async function main() {
  const doc = await prisma.document.findFirst({
    where: { source: 'CODE_CIVIL_ANNOTE' },
    select: { id: true, titleFr: true, bodyOriginal: true, bodyClean: true, annotationsJson: true },
  })
  if (!doc) throw new Error('Code civil introuvable.')
  const corps = doc.bodyClean ?? doc.bodyOriginal
  const lignes = corps.split('\n')
  const ann = JSON.parse(doc.annotationsJson ?? '{}')

  console.log(`AUDIT — ${doc.titleFr} (${doc.id})`)
  console.log(`${lignes.length} lignes · ${corps.length} caractères · annotations ${(doc.annotationsJson ?? '').length} caractères\n`)

  // ── 1. Structure des lignes ────────────────────────────────────────────────
  const vus = new Map<string, number>()
  const ancres = new Set<string>()
  let courant: string | null = null
  let precedent = 0

  lignes.forEach((l, i) => {
    const n = i + 1
    const t = l.trim()
    const a = articleAnchorFromHeading(l)
    if (a) ancres.add(a)
    const m = ART_TETE.exec(t)

    if (m) {
      const num = m[1] + (m[2] ? `-${m[2].toLowerCase()}` : '')
      courant = num
      if (vus.has(num)) noter('doublon', 'Numéro d’article présent DEUX fois', { ligne: n, article: num, extrait: `déjà vu ligne ${vus.get(num)} — ${court(t, 90)}` })
      else vus.set(num, n)
      const val = Number(m[1].split('-')[0])
      if (!m[2] && !m[1].includes('-') && val < precedent) noter('ordre', 'Article hors séquence (numérotation qui recule)', { ligne: n, article: num, extrait: `après l’article ${precedent} — ${court(t, 90)}` })
      if (!m[2] && !m[1].includes('-')) precedent = Math.max(precedent, val)
      // texte de l'article vide ?
      if (t.replace(ART_TETE, '').trim().length < 3) noter('vide', 'En-tête d’article sans texte', { ligne: n, article: num, extrait: court(t, 90) })
    } else if (INTERTITRE.test(t)) {
      courant = null
    }

    // deux en-têtes sur la même ligne : un saut de ligne a été perdu
    const tetes = [...l.matchAll(/(?:^|[\s.;:])Art(?:icle)?\.?\s*(\d{1,4})\s+[A-ZÀ-Ý«(]/g)]
    if (tetes.length > 1) noter('tetes-collees', 'Plusieurs articles sur UNE ligne (saut de ligne perdu)', { ligne: n, article: courant ?? '?', extrait: court(l, 180) })

    // intertitre collé au texte
    if (!INTERTITRE.test(t) && /[a-zà-ÿ]\s+(CHAPITRE|SECTION|TITRE|LIVRE)\s+[IVXLC0-9]/.test(l))
      noter('intertitre-colle', 'Intertitre collé au texte d’un article', { ligne: n, article: courant ?? '?', extrait: court(l, 180) })

    // césure d'OCR non recousue : « détermi- née », « suc- reçoit »
    for (const c of l.matchAll(/[a-zà-ÿ]{2,}-\s+[a-zà-ÿ]{2,}/g)) {
      noter('cesure', 'Césure de fin de ligne non recousue', { ligne: n, article: courant ?? '?', extrait: court(l.slice(Math.max(0, c.index! - 60), c.index! + 70), 140) })
      break
    }

    // ligne démesurée : paragraphes fusionnés
    if (l.length > 2500) noter('ligne-longue', 'Ligne de plus de 2 500 caractères (paragraphes fusionnés ?)', { ligne: n, article: courant ?? '?', extrait: `${l.length} car. — ${court(l, 120)}` })

    // note de l'éditeur restée dans le texte officiel
    if (courant && ARRET.test(l)) {
      const j = ARRET.exec(l)!
      noter('arret-dans-texte', 'Référence d’arrêt DANS le texte officiel (note recollée)', { ligne: n, article: courant, extrait: court(l.slice(Math.max(0, j.index - 110), j.index + 40), 160) })
    }
  })

  // ── 2. Appareil : annotations, commentaires, anciennes rédactions ───────────
  const cles = Object.keys(ann.jurisprudence ?? {})
  const vues = new Map<string, string>()
  for (const cle of cles) {
    const anc = cle.split('|')[1]
    if (anc && !ancres.has(anc)) noter('ancre-morte', 'Annotation rattachée à un article INEXISTANT', { extrait: `${cle} → ${anc} absent du corps` })
    for (const c of ann.jurisprudence[cle] as Array<{ ref?: string; excerpt?: string }>) {
      const ex = (c.excerpt ?? '').trim()
      if (!ex && !(c.ref ?? '').trim()) { noter('note-vide', 'Note d’annotation vide', { extrait: cle }); continue }
      if (ART_TETE.test(ex)) noter('note-article', 'Annotation qui commence par un en-tête d’article (texte de loi mal classé ?)', { extrait: `${cle} — ${court(ex, 120)}` })
      const sig = ex.slice(0, 80)
      if (sig && vues.has(sig) && vues.get(sig) !== cle) noter('note-doublon', 'Même note rattachée à deux articles', { extrait: `${vues.get(sig)} / ${cle} — ${court(sig, 90)}` })
      else if (sig) vues.set(sig, cle)
    }
  }
  for (const [cle, txt] of Object.entries(ann.oldVersions ?? {})) {
    if (!ancres.has(String(cle)) && cle !== 'preambule') noter('ancre-morte-old', 'Ancienne rédaction rattachée à un article inexistant', { extrait: String(cle) })
    if (typeof txt === 'string' && txt.trim().length < 10) noter('old-vide', 'Ancienne rédaction quasi vide', { extrait: `${cle} — ${court(String(txt))}` })
  }

  // ── 3. Séquelles d'OCR ─────────────────────────────────────────────────────
  const OCR: Array<[RegExp, string]> = [
    [/©/g, 'Sigle de copyright « © » (lecture fautive d’un « C. »)'],
    [/\bc\.?\s*ctv\b/gi, '« c. ctv » pour « C. civ. »'],
    [/\bC\.\s*dv\b/gi, '« C. dv » pour « C. civ. »'],
    [/!'/g, '« !\' » pour « l\' » (l’Haïtien)'],
    [/\bl:|\bt:/g, '« l: » / « t: » pour « L\' » / « L\'e »'],
    [/[A-Za-zÀ-ÿ]\d[A-Za-zÀ-ÿ]/g, 'Chiffre au milieu d’un mot (Ha1\'tienne)'],
    [/\b[A-Za-zÀ-ÿ]{2,}\d{1,2}\b(?!\s*(?:er|e|bis|ter))/g, 'Mot terminé par un chiffre'],
    [/\S \s*[,.](?=\s)/g, 'Espace avant une virgule ou un point (le point-virgule et le deux-points en prennent une, légitimement)'],
    [/ {2,}/g, 'Espaces multiples'],
    [/[��]/g, 'Caractère de remplacement (perte d’encodage)'],
    [/\bjutn\b|\bjutllet\b|\bpr[eé]ct[ié]t[eé]\b|\bmat\b(?!\s)/gi, 'Mois ou mot mal océrisé (jutn, jutllet, précité)'],
  ]
  const appareil = doc.annotationsJson ?? ''
  for (const [re, titre] of OCR) {
    const dansAppareil = [...appareil.matchAll(new RegExp(re.source, re.flags))].length
    if (dansAppareil) noter(`ocrann:${titre}`, `${titre} — dans les ANNOTATIONS`, { extrait: `${dansAppareil} occurrence(s)` })
    const trouves = [...corps.matchAll(re)]
    for (const t of trouves.slice(0, MAX)) {
      const ligne = corps.slice(0, t.index).split('\n').length
      noter(`ocr:${titre}`, titre, { ligne, extrait: court(corps.slice(Math.max(0, t.index! - 60), t.index! + 60), 130) })
    }
    if (trouves.length) dossiers.get(`ocr:${titre}`)!.titre = `${titre} — ${trouves.length} occurrence(s)`
  }

  // ── Rapport ────────────────────────────────────────────────────────────────
  const ordre = [...dossiers.entries()].sort((a, b) => b[1].cas.length - a[1].cas.length)
  console.log('RÉCAPITULATIF')
  for (const [cle, d] of ordre) console.log(`  ${String(d.cas.length).padStart(5)} · ${cle.startsWith('ocr:') ? 'OCR' : 'STRUCT'} — ${d.titre}`)
  console.log()
  for (const [cle, d] of ordre) {
    console.log(`\n=== ${d.titre} (${d.cas.length}) ===`)
    for (const c of d.cas.slice(0, MAX)) {
      const loc = [c.ligne ? `l.${c.ligne}` : null, c.article ? `art. ${c.article}` : null].filter(Boolean).join(' · ')
      console.log(`  ${loc ? loc + ' : ' : ''}${c.extrait}`)
    }
    if (!DETAIL && d.cas.length > MAX) console.log(`  … et ${d.cas.length - MAX} autres (--detail pour tout voir)`)
  }
  console.log(`\nArticles distincts en base : ${vus.size} · ancres : ${ancres.size}`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('ÉCHEC :', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
