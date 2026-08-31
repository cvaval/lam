/**
 * Extrait les trois pièces du Décret régissant l'insolvabilité vers `scripts/data/insolvabilite-2020/`.
 *
 *   npx tsx scripts/extraire-insolvabilite.ts
 *
 * ⚠️ L'OCR DU FASCICULE ABÎME DES TÊTES, ET LE SILENCE COÛTE DES ARTICLES. Deux têtes portent
 * une espace DANS le numéro et une ponctuation cassée — « Article 3212- 7.• », « Article
 * 3351- 11. :·· ». Lues strictement, elles disparaissaient et leurs séries montraient un trou :
 * 295 articles au lieu de 297. Une troisième division est collée — « Sous-sectionS La
 * survenance d'une seconde procédure collective » (le 5 lu S, les deux lignes fondues).
 *
 * ⚠️ ET LE PLAN N'EST PAS LE DISPOSITIF. L'article 1er a) énonce le plan du Livre III en casse
 * normale (« Titre I.- Des Syndics ») ; le dispositif le répète en capitales sur deux lignes
 * (« TITRE I » / « DES SYNDICS »). Le sommaire se bâtit sur le DISPOSITIF. Les deux se
 * recomptent l'un l'autre : 71 divisions au plan, 72 au dispositif (dont « LIVRE III »).
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { unzipSync } from 'node:zlib'

const DL = '/Users/cvaval/Downloads'
const OUT = 'scripts/data/insolvabilite-2020'

/** Paragraphes d'un .docx — le `<w:tab/>` est un TAQUET, pas un caractère. */
function paragraphes(fichier: string): string[] {
  const xml = execFileSync('unzip', ['-p', fichier, 'word/document.xml'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const t = xml
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&#39;/g, '’').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  return t.split('\n').map((l) => l.trim())
}

/** Tête d'article, TOLÉRANTE à l'OCR : espace dans le numéro, ponctuation cassée. */
const TETE = /^Article\s+(\d{3,5})\s*-\s*(\d+)\s*[.,]?\s*[-–—•:·]+\s*/
/** Tête de division du dispositif — capitales, ou « Section N » / « Sous-section N » en casse normale. */
const DIV = /^(LIVRE\s+[IVX]+|TITRE\s+(?:PRÉLIMINAIRE|[IVX]+)|CHAPITRE\s+[IVX]+|Section\s+\d+|Sous-section\s+\d+)\s*$/
/** La division collée par l'OCR : « Sous-sectionS <intitulé> ». */
const DIV_COLLEE = /^Sous-section\s*S\s+(.+)$/

function main() {
  const L = paragraphes(`${DL}/Decret_Insolvabilite_Moniteur_Special_No24.docx`).filter(Boolean)
  const i0 = L.findIndex((l) => l === 'LIVRE III')
  if (i0 < 0) { console.error('⛔ ARRÊT — « LIVRE III » introuvable : le dispositif ne commence nulle part.'); process.exit(1) }

  // ── Corps : on répare les deux têtes abîmées et la division collée, RIEN D'AUTRE ─────────
  const corps: string[] = []
  let reparees = 0, collees = 0, jointures = 0
  for (let i = 0; i < L.length; i++) {
    const l = L[i]
    const c = DIV_COLLEE.exec(l)
    if (i >= i0 && c) { corps.push(`Sous-section 5 — ${c[1]}`); collees++; continue }
    const m = TETE.exec(l)
    if (i >= i0 && m) {
      const propre = `Article ${m[1]}-${m[2]}.- ${l.slice(m[0].length)}`
      if (propre !== l) reparees++
      corps.push(propre)
      continue
    }
    // Jointure des divisions du dispositif : « TITRE I » + « DES SYNDICS » → « TITRE I — DES SYNDICS ».
    if (i >= i0 && DIV.test(l)) {
      const suiv = L[i + 1] ?? ''
      if (suiv && !DIV.test(suiv) && !TETE.test(suiv) && suiv.length < 160) {
        corps.push(`${l} — ${suiv}`); i++; jointures++; continue
      }
    }
    corps.push(l)
  }

  const dispositif = corps.slice(corps.findIndex((l) => l.startsWith('LIVRE III')))
  const arts = dispositif.map((l) => /^Article\s+(\d{3,5}-\d+)\.-/.exec(l)?.[1]).filter(Boolean) as string[]
  const divs = dispositif.filter((l) => / — /.test(l) && /^(LIVRE|TITRE|CHAPITRE|Section|Sous-section)\b/.test(l))
  const doublons = arts.filter((a, i) => arts.indexOf(a) !== i)

  writeFileSync(`${OUT}/corps-decret.txt`, corps.join('\n'))
  writeFileSync(`${OUT}/divisions.json`, JSON.stringify(divs, null, 1))
  writeFileSync(`${OUT}/articles.json`, JSON.stringify(arts, null, 1))
  writeFileSync(`${OUT}/sommaire-client.txt`, paragraphes(`${DL}/Decret_Insolvabilite_SOMMAIRE.docx`).filter(Boolean).join('\n'))
  writeFileSync(`${OUT}/index-client.txt`, paragraphes(`${DL}/Decret_Insolvabilite_INDEX.docx`).filter(Boolean).join('\n'))

  console.log('EXTRACTION — DÉCRET RÉGISSANT L’INSOLVABILITÉ\n')
  console.log(`   ${L.length} paragraphes · dispositif à partir de la ligne ${i0}`)
  console.log(`   têtes d’article réparées de l’OCR : ${reparees}`)
  console.log(`   divisions collées réparées        : ${collees}`)
  console.log(`   divisions jointes par « — »       : ${jointures}`)
  console.log(`\n   articles : ${arts.length} · uniques ${new Set(arts).size} · doublons ${doublons.length ? doublons.join(', ') : 'aucun ✔'}`)
  console.log(`   de ${arts[0]} à ${arts[arts.length - 1]} · art-33410-1 présent : ${arts.includes('33410-1') ? '✔' : '⛔'}`)
  console.log(`   divisions du dispositif : ${divs.length}`)
  const nues = dispositif.filter((l) => DIV.test(l))
  console.log(`   têtes de division restées NUES : ${nues.length ? '⛔ ' + nues.join(', ') : 'aucune ✔'}`)
}

main()
