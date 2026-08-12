/**
 * Applique l'ÉCHELLE D'ENCRE conforme, aux seuls endroits signalés par
 * `scripts/audit-contraste.ts`. Correctif ciblé, jamais un remplacement en masse :
 * les mêmes classes passent ailleurs (grands corps, fonds différents) et n'ont
 * aucune raison de bouger.
 *
 *   npx tsx scripts/audit-contraste.ts --liste > /tmp/echecs.txt
 *   npx tsx scripts/corriger-contraste.ts /tmp/echecs.txt [--appliquer]
 *
 * ─── CE QUE LA MESURE IMPOSE ────────────────────────────────────────────────────
 * La plateforme graduait son texte secondaire par la PÂLEUR : neuf paliers, de
 * `text-ank/30` à `/75`. Sur les fonds clairs réellement employés, aucun de ces
 * paliers n'atteint 4,5:1 — la nuance était donc décorative, et illisible.
 *
 *   sur Blan (#FFFFFF)   ank/75 = 4,97 ✓   ank/70 = 4,34 ✗
 *   sur Koton (#EAE9E5)  ank/80 = 5,04 ✓   ank/75 = 4,39 ✗
 *
 * Un composant se déplaçant d'une carte blanche à un fond Koton, le plancher retenu
 * est celui de KOTON : `ank/80`. Reste alors DEUX degrés utilisables, pas neuf —
 * et la charte en offre justement un troisième, plus sombre, prévu pour cela :
 *
 *   ank      #3F4043   10,4:1 sur Blan   texte principal
 *   grafit   #55565A    7,3:1 sur Blan   « Texte d'interface » (charte)  ← secondaire
 *   ank/80             5,7:1 sur Blan   tertiaire, le plus pâle qui passe
 *
 * La hiérarchie repose désormais sur la TAILLE et la GRAISSE, comme il se doit :
 * la pâleur ne peut pas porter trois niveaux sans en rendre un illisible.
 */
import { readFileSync, writeFileSync } from 'node:fs'

/** Classe fautive → classe conforme, à taille égale. */
function remplacement(classe: string): string | null {
  const m = classe.match(/^ank\/(\d{1,3})$/)
  if (!m) return null
  const n = Number(m[1])
  if (n >= 80) return null // déjà conforme
  // Le palier le plus foncé passe au gris d'interface, les autres au plancher :
  // l'ORDRE relatif est conservé (grafit reste plus sombre que ank/80).
  return n >= 60 ? 'grafit' : 'ank/80'
}

/** Corrections des fonds SOMBRES et des teintes de marque — arbitrées une à une. */
const CAS_PARTICULIERS: Record<string, string> = {
  // Chabon sur Chabon : 1,00:1, purement invisible.
  chabon: 'koton/70',
  // Sur Chabon, /70 est le premier palier conforme (5,10:1) ; /60 plafonne à 4,21.
  'koton/45': 'koton/70',
  'koton/55': 'koton/70',
  'white/55': 'white/70',
}

function main() {
  const [fichierListe, ...reste] = process.argv.slice(2)
  const appliquer = reste.includes('--appliquer')
  const lignes = readFileSync(fichierListe, 'utf8').trim().split('\n').filter(Boolean)

  const parFichier = new Map<string, { ligne: number; de: string; vers: string }[]>()
  const laisses: string[] = []

  for (const l of lignes) {
    const [fichier, ligne, classe, fond, ratio] = l.split('|')
    const vers = remplacement(classe) ?? CAS_PARTICULIERS[classe] ?? null
    if (!vers) { laisses.push(`${fichier}:${ligne}  text-${classe} sur ${fond} — ${ratio}:1`); continue }
    if (!parFichier.has(fichier)) parFichier.set(fichier, [])
    parFichier.get(fichier)!.push({ ligne: Number(ligne), de: classe, vers })
  }

  let n = 0
  for (const [fichier, corrections] of parFichier) {
    const src = readFileSync(fichier, 'utf8').split('\n')
    // Une ligne peut porter plusieurs occurrences fautives : on dédoublonne par (ligne, de).
    const vues = new Set<string>()
    for (const { ligne, de, vers } of corrections) {
      const cle = `${ligne}|${de}`
      if (vues.has(cle)) continue
      vues.add(cle)
      // Frontière de mot à droite : `text-ank/4` ne doit pas mordre sur `text-ank/45`.
      const rx = new RegExp(`text-${de.replace('/', '\\/')}(?![\\w/])`, 'g')
      // L'auditeur situe la ligne du CHEVRON ouvrant ; sur une balise écrite en plusieurs
      // lignes, l'attribut `className` tombe plus bas. On balaie la fenêtre de la balise.
      let pose = false
      for (let i = ligne - 1; i < Math.min(ligne + 14, src.length); i++) {
        if (!rx.test(src[i])) { rx.lastIndex = 0; continue }
        rx.lastIndex = 0
        src[i] = src[i].replaceAll(rx, `text-${vers}`)
        pose = true
        break
      }
      if (!pose) { laisses.push(`${fichier}:${ligne}  text-${de} introuvable`); continue }
      n++
    }
    if (appliquer) writeFileSync(fichier, src.join('\n'))
  }

  console.log(`${n} correction(s) dans ${parFichier.size} fichier(s)${appliquer ? ' — ÉCRITES' : ' (simulation)'}`)
  if (laisses.length) {
    console.log(`\n${laisses.length} cas NON traités automatiquement — à arbitrer à la main :`)
    for (const l of laisses) console.log(`  ${l}`)
  }
}

main()
