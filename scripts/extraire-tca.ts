/**
 * Extrait les pièces de la TCA vers `scripts/data/tca-2002/`.
 *
 *   npx tsx scripts/extraire-tca.ts
 *
 * ⚠️ LE FICHIER DE 1995 EST UN FASCICULE, PAS UNE LOI. Il enchaîne TROIS lois sans
 * séparateur : l'Impôt sur le Revenu (titre et visas seulement), la TCA (complète), et
 * l'acompte de 2 % (tronquée en pleine phrase). Prendre « tout le document » ferait entrer
 * les deux fragments DANS le corps de la loi TCA, où ils se liraient comme sa suite.
 * Décision de la cliente : SEULE la loi TCA se verse.
 *
 * ⚠️ ET VINGT ET UNE LIGNES D'EN-TÊTE DE PAGE traversent le texte — « LE MONITEUR »,
 * « No 19 Lundi 6 mars 1995 », et les numéros de page nus. Elles coupent l'article 1er en
 * trois morceaux.
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const DL = '/Users/cvaval/Downloads'
const OUT = 'scripts/data/tca-2002'

function paragraphes(f: string): string[] {
  const xml = execFileSync('unzip', ['-p', f, 'word/document.xml'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return xml
    .replace(/<\/w:p>/g, '\n').replace(/<w:tab\/>/g, '\t').replace(/<[^>]+>/g, '')
    .replace(/&#39;/g, '’').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .split('\n').map((l) => l.trim()).filter(Boolean)
}

/** En-tête de page courant du fascicule de 1995 — jamais du texte de loi. */
const COURANT = /^(«?\s*LE MONITEUR\s*»?|No\s*19\s+Lundi\s+6\s+mars\s+1995|\d{3})$/i
/**
 * Tête d'article.
 *
 * ⚠️ LE DRAPEAU `i` N'EST PAS UN CONFORT, C'EST LA MOITIÉ DE LA LOI DE 1995. Elle écrit ses
 * deux premières têtes « Article 1er: », « Article 2: », et les deux dernières EN CAPITALES —
 * « ARTICLE 3: », « ARTICLE 4: ». Sans `i`, l'extraction n'en voyait que deux sur quatre, et
 * les articles 3 et 4 seraient entrés dans le corps de l'article 2 comme s'ils en étaient la
 * suite. C'est la sentinelle des « exactement 4 articles » qui l'a arrêtée.
 *
 * ⚠️ ET LA PONCTUATION DE TÊTE EST UN DEUX-POINTS, pas le « .- » du reste du corpus.
 */
const TETE = /^Article\s+(\d+(?:er)?)\s*(\([^)]{0,70}\))?\s*[:.\-–—]\s*/i
const CHAP = /^Chapitre\s+([IVX]+)\s*:/

function main() {
  // ── 1. La loi de 2002 ────────────────────────────────────────────────────────────────
  const L2002 = paragraphes(`${DL}/TCA.docx`)
  const arts = L2002.map((l) => TETE.exec(l)).filter(Boolean).map((m) => m![1])
  const chaps = L2002.filter((l) => CHAP.test(l))
  // ⚠️ « Article 6 (?) » — LE POINT D'INTERROGATION EST DU TRANSCRIPTEUR, pas du Journal
  // officiel. Il ne se publie pas ; il se signale. Les trois autres parenthèses de tête
  // nomment le Décret du 23 novembre 2005 et RESTENT : elles sont l'appareil de la version
  // consolidée fournie par la cliente.
  const doutes: string[] = []
  const corps2002 = L2002.map((l) => {
    const m = TETE.exec(l)
    if (m && m[2] === '(?)') { doutes.push(`art. ${m[1]}`); return l.replace(/\s*\(\?\)\s*:/, ' :') }
    return l
  })

  // ── 2. La loi TCA de 1995, bornée dans le fascicule ──────────────────────────────────
  const F = paragraphes(`${DL}/Moniteur No 19 - 6 mars 1995 - Loi TCA.docx`)
  const bornes = F.map((l, i) => (l === 'LOI' ? i : -1)).filter((i) => i >= 0)
  const d = bornes.find((i) => /TAXE SUR LE CHIFFRE/i.test(F[i + 2] ?? ''))
  if (d === undefined) { console.error('⛔ ARRÊT — la loi TCA est introuvable dans le fascicule.'); process.exit(1) }
  const f = bornes.find((i) => i > d) ?? F.length
  const corps1995 = F.slice(d, f).filter((l) => !COURANT.test(l))
  const a95 = corps1995.map((l) => TETE.exec(l)).filter(Boolean).map((m) => m![1])

  // ⚠️ SENTINELLES — deux conditions, et l'une sans l'autre ne prouve rien.
  const texte95 = corps1995.join(' ').toUpperCase()
  const pollue = ['ACCOMPTE', 'IMPOT SUR LE REVENU'].filter((m) => texte95.includes(m))
  if (pollue.length) { console.error(`⛔ ARRÊT — le corps de 1995 contient « ${pollue.join(' », « ')} » : une autre loi y est entrée.`); process.exit(1) }
  if (a95.length !== 4) { console.error(`⛔ ARRÊT — ${a95.length} articles au lieu de 4 dans la loi de 1995.`); process.exit(1) }

  writeFileSync(`${OUT}/corps-loi-2002.txt`, corps2002.join('\n'))
  writeFileSync(`${OUT}/corps-loi-1995.txt`, corps1995.join('\n'))
  writeFileSync(`${OUT}/sommaire-client.txt`, paragraphes(`${DL}/Sommaire - Loi du 13 decembre 2002 (TCA).docx`).join('\n'))
  writeFileSync(`${OUT}/index-client.txt`, paragraphes(`${DL}/Index des mots cles - Loi du 13 decembre 2002 (TCA).docx`).join('\n'))

  console.log('EXTRACTION — TAXE SUR LE CHIFFRE D’AFFAIRES\n')
  console.log(`   LOI DU 13 DÉCEMBRE 2002`)
  console.log(`      ${arts.length} articles (${arts[0]} → ${arts[arts.length - 1]}) · uniques ${new Set(arts).size} · ${chaps.length} chapitres`)
  console.log(`      trous : ${Array.from({ length: 45 }, (_, i) => String(i + 1)).filter((n) => !arts.includes(n)).join(', ') || 'aucun ✔'}`)
  console.log(`      têtes nommant le Décret du 23 novembre 2005 : ${L2002.filter((l) => /\(modifié comme suit/.test(l)).length}`)
  console.log(`      ⚠ point d’interrogation du transcripteur retiré : ${doutes.join(', ') || 'aucun'}`)
  console.log(`\n   LOI DU 17 JANVIER 1995 — bornée aux lignes ${d} → ${f} du fascicule`)
  console.log(`      ${a95.length} articles (${a95.join(', ')}) · ${corps1995.length} ¶ après retrait des en-têtes`)
  console.log(`      en-têtes de page retirés : ${F.slice(d, f).length - corps1995.length}`)
  console.log(`      sentinelles : ni « ACCOMPTE » ni « IMPOT SUR LE REVENU » ✔ · 4 articles ✔`)
}

main()
