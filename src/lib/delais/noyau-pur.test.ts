/**
 * Bloc 6 du § 9 — PAS DE `Date` DANS LE NOYAU.
 *
 * « Ce test paraît puéril ; il est le seul qui attrape la régression que quelqu'un
 * introduira dans six mois. » Vercel tourne en UTC, Haïti en UTC−5/−4 : un seul `new Date()`
 * dans ces fichiers suffit à décaler une date limite d'un jour, c'est-à-dire à forclore.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Le § 4.1 en nomme quatre. On en surveille sept : `lectures.ts`, `regimes.ts` et `format.ts`
 * font partie du chemin de calcul et du chemin d'affichage des dates, et rien n'y justifierait
 * un `Date` non plus.
 */
const NOYAU = [
  'civil.ts',
  'paques.ts',
  'feries.ts',
  'lectures.ts',
  'regimes.ts',
  'calcul.ts',
  'format.ts',
]

const INTERDITS = /new Date\(|Date\.now|Date\.UTC|getTimezoneOffset|toLocaleDateString|Intl\./

/**
 * On scanne le CODE, pas les commentaires : ces fichiers NOMMENT les interdits pour expliquer
 * pourquoi ils les proscrivent, et un test qui interdirait d'en parler interdirait de les
 * documenter. Les commentaires sont donc retirés — en gardant les lignes, pour que le numéro
 * de ligne d'un échec reste juste.
 */
function codeSeul(source: string): string[] {
  const sansBlocs = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  return sansBlocs.split('\n').map((l) => l.replace(/\/\/.*$/, ''))
}

describe('Bloc 6 — le noyau n’emploie ni Date ni Intl', () => {
  for (const fichier of NOYAU) {
    it(`${fichier} est pur`, () => {
      const source = readFileSync(join('src/lib/delais', fichier), 'utf8')
      const lignes = codeSeul(source)
      const fautives = lignes
        .map((l, i) => ({ n: i + 1, l }))
        .filter(({ l }) => INTERDITS.test(l))
        .map(({ n, l }) => `${fichier}:${n} → ${l.trim()}`)
      expect(fautives).toEqual([])
    })
  }

  it('aucun de ces fichiers n’importe une bibliothèque de dates', () => {
    // Le dépôt n'en a aucune (`package.json` vérifié), et aucune ne connaît le délai franc
    // haïtien. Ce test empêche qu'on en ajoute une « juste pour formater ».
    for (const fichier of NOYAU) {
      const source = codeSeul(readFileSync(join('src/lib/delais', fichier), 'utf8')).join('\n')
      expect(source, fichier).not.toMatch(/from '(date-fns|dayjs|luxon|moment)/)
    }
  })

  it('aucun saut de week-end, nulle part dans le noyau', () => {
    // § 2.9 : le samedi est un jour plein. Un `addBusinessDays` donnerait une date plus
    // tardive que la loi ne le permet — c'est-à-dire une forclusion.
    for (const fichier of NOYAU) {
      const source = codeSeul(readFileSync(join('src/lib/delais', fichier), 'utf8')).join('\n')
      expect(source, fichier).not.toMatch(/addBusinessDays|isWeekend|jourOuvre|joursOuvres/i)
    }
  })

  it('la distance n’est JAMAIS arrondie', () => {
    // § 2.12, interdit n° 4. `Math.round(267/40)` et `Math.ceil(267/40)` donnent 7 : un jour
    // de trop, contredit par l'arrêt Germeil.
    const corps = codeSeul(readFileSync(join('src/lib/delais', 'calcul.ts'), 'utf8')).join('\n')
    expect(corps).not.toMatch(/Math\.(round|ceil)\s*\(/)
  })
})
