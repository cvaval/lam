/**
 * Garde-fous de la doctrine chromatique — avenant AV-04 (LAM-BRAND-2026-08-V3-AV04),
 * qui applique l'inversion des accents posée par l'AV-02 du 11 août 2026.
 *
 *   « Le rouge est la couleur de l'USAGE ; le jaune Sitwon est le trait du CERTIFICATEUR. »
 *
 * Ces contrôles existent parce que les « contrôles finaux » de la charte v3.0 déclaraient
 * « Wouj en fond : 0 » alors qu'il y en avait 32, et « 15 CTA en Sitwon » alors qu'il y en
 * avait 5. Un chiffre de conformité qu'aucun test ne rejoue est un chiffre qu'on croit.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function sources(dir = 'src', acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) sources(p, acc)
    else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e)) acc.push(p)
  }
  return acc
}
const FICHIERS = sources().map((p) => ({ p, s: readFileSync(p, 'utf8') }))

/** Feuilles de style et configuration — le balayage du 16 août ne regardait que les classes
 *  Tailwind des .tsx et avait laissé `mark.hl` en Sitwon dans globals.css : chaque terme
 *  trouvé d'une page de résultats était surligné en jaune, contre un quota d'un par écran. */
const STYLES = ['src/app/globals.css', 'tailwind.config.ts'].map((p) => ({ p, s: readFileSync(p, 'utf8') }))

/** Occurrences d'un motif, avec leur fichier et leur ligne — pour que l'échec soit lisible. */
function releve(rx: RegExp): string[] {
  const out: string[] = []
  for (const { p, s } of FICHIERS) {
    s.split('\n').forEach((l, i) => {
      if (new RegExp(rx.source, rx.flags.replace('g', '')).test(l)) out.push(`${p}:${i + 1}`)
    })
  }
  return out
}

describe('AV-04 — rationnement des accents', () => {
  it('Sitwon n’est jamais une couleur de texte (1,46:1 sur Blan — illisible)', () => {
    expect(releve(/\btext-sitwon\b/)).toEqual([])
  })

  it('le focus est Chabon : aucun anneau coloré par un accent', () => {
    expect(releve(/\bring-(wouj|sitwon)\b/)).toEqual([])
  })

  /**
   * ⚠️ **LE FOCUS EST CELUI DE LA MAISON — sa TEINTE comme sa FORME.** `globals.css` pose
   * `*:focus-visible { outline: 2px solid #414042; outline-offset: 2px }`, et l'AV-04 (art. 2,
   * correction 6) a retiré 55 anneaux `ring-wouj` avec toute leur grappe. Le contrôle
   * précédent n'interdit que les anneaux COLORÉS : les onze champs du calculateur portaient
   * `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chabon`, dont la
   * spécificité (0,2,0) l'emporte sur `*:focus-visible` (0,1,0). La teinte restait conforme,
   * la forme non : le liseré décalé de 2 px devenait un anneau collé à la bordure, et le
   * marqueur de focus changeait d'allure au milieu de la page — en tabulant du fil d'Ariane
   * vers le formulaire. Un indicateur de focus qui change de forme est un indicateur qu'on
   * cesse de suivre.
   */
  it('personne n’éteint le liseré de focus de globals.css', () => {
    const fautifs = releve(/focus-visible:outline-none/).filter((ref) => {
      const [f, n] = ref.split(':')
      const ligne = readFileSync(f, 'utf8').split('\n')[Number(n) - 1].trim()
      // Un commentaire qui ÉNONCE la règle n'éteint rien.
      return !/^(\*|\/\/|\/\*)/.test(ligne)
    })
    expect(fautifs).toEqual([])
  })

  it('aucun accent en survol décoratif — un survol n’est ni un usage ni une certification', () => {
    expect(releve(/\bhover:(text|border)-(wouj|sitwon)\b/)).toEqual([])
  })

  it('tout fond Wouj PORTANT DU TEXTE le met en Blan (5,43:1)', () => {
    // Exemption : un filet ou une puce décorative n'a pas de texte à colorer. Ils se
    // reconnaissent à leur aria-hidden — cinq cas, tous des barres de titre h-1 w-16.
    const fautifs = releve(/\bbg-wouj\b(?![-/])/).filter((ref) => {
      const [p, n] = ref.split(':')
      const ligne = readFileSync(p, 'utf8').split('\n')[Number(n) - 1]
      if (/aria-hidden/.test(ligne)) return false
      return !/\btext-(white|inverse)\b/.test(ligne)
    })
    expect(fautifs).toEqual([])
  })

  it('tout fond Sitwon porte du texte Chabon (7,08:1)', () => {
    const fautifs = releve(/\bbg-sitwon\b(?![-/])/).filter((ref) => {
      const [p, n] = ref.split(':')
      const ligne = readFileSync(p, 'utf8').split('\n')[Number(n) - 1]
      return !/\btext-chabon\b/.test(ligne)
    })
    expect(fautifs).toEqual([])
  })

  it('Sitwon Pal a bien cédé la place à Wouj Pal (AV-02, art. 2)', () => {
    expect(releve(/sitwonPal|sitwon-pal/)).toEqual([])
  })

  it('le noir pur reste interdit (hors commentaire énonçant la règle)', () => {
    const fautifs = releve(/#000000\b|#000\b/).filter((ref) => {
      const [f, n] = ref.split(':')
      const ligne = readFileSync(f, 'utf8').split('\n')[Number(n) - 1].trim()
      return !/^(\*|\/\/|\/\*)/.test(ligne)
    })
    expect(fautifs).toEqual([])
  })
})

describe('AV-02 — le statut « Abrogé » appartient au certificateur', () => {
  /**
   * Garde-fou né d'un défaut réel : la correction du 16 août n'avait été portée que dans
   * AnnotatedText.tsx. Quatre autres rendus du même statut — StatusChip, le bloc « Abrogé
   * par » de la fiche, AmendmentHistory, ResultCard — étaient restés en Wouj, et aucun des
   * sept contrôles précédents ne les voyait : ils vérifiaient des motifs, pas un SENS.
   */
  it('aucune ligne qui rend une abrogation ne porte Wouj', () => {
    const fautifs: string[] = []
    for (const { p, s } of FICHIERS) {
      s.split('\n').forEach((l, i) => {
        // Un bouton d'action « Abroger » n'est pas un statut : il est Chabon, et il est
        // reconnaissable à son <button. On ne teste que ce qui AFFICHE l'état.
        if (/<button/.test(l)) return
        if (/\bABROGE\b|abrog/i.test(l) && /\b(text|border|bg)-wouj\b/.test(l)) {
          fautifs.push(`${p}:${i + 1}`)
        }
      })
    }
    expect(fautifs).toEqual([])
  })
})

describe('AV-02 — les feuilles de style suivent la doctrine, pas seulement les composants', () => {
  it('le jeton retiré Sitwon Pal #FFF3C6 ne peint plus rien', () => {
    // Les blocs de commentaire sont neutralisés en préservant les sauts de ligne, pour que
    // les numéros restent justes : une ligne de continuation d'un /* */ ne commence pas
    // forcément par une étoile, et la citation d'un jeton retiré dans une note n'est pas
    // une peinture.
    const sansCommentaires = (t: string) =>
      t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/\/\/[^\n]*/g, '')
    const fautifs = STYLES.flatMap(({ p, s }) =>
      sansCommentaires(s)
        .split('\n')
        .map((l, i) => ({ l, n: i + 1 }))
        .filter(({ l }) => /#FFF3C6/i.test(l))
        .map(({ n }) => `${p}:${n}`),
    )
    expect(fautifs).toEqual([])
  })

  it('le surlignage du terme exact est en Wouj, pas en Sitwon (AV-02, art. 1)', () => {
    const css = STYLES.find((f) => f.p.endsWith('globals.css'))!.s
    const bloc = /mark\.hl\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(bloc).toMatch(/#D21034/i)
    expect(bloc).not.toMatch(/#FDD228/i)
  })
})
