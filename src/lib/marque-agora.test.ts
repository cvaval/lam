import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * SENTINELLE DU REBRANDING (prompt « Lam devient Agora », § 5 lot 1 et § 6).
 *
 * Aucun « Lam » ni « lam.ht » VISIBLE ne subsiste dans `src/`. Les commentaires ne partent pas
 * au navigateur : ils sont retirés avant la recherche (ils racontent l'histoire du produit, et
 * c'est leur rôle). Les tests aussi sont exclus — leurs gabarits sont des données.
 *
 * ⚠️ LA LISTE D'EXCEPTIONS EST FERMÉE. Plus AUCUNE mention de transition (« Agora, anciennement
 * Lam ») : Me Vaval l'a fait retirer le 8 oct. 2026. Seule exception, une phrase qui DOIT nommer Lam :
 *  - les avertissements 2FA qui nomment une entrée d'authentificateur créée avant la bascule.
 * Les noms INTERNES (`lv_*`, préfixe d'index `lam`, stockage `lam-pdfs`) ne sont pas des
 * « Lam » visibles et ne sont pas attrapés par le motif, qui est sensible à la casse.
 */
const SRC = join(__dirname, '..')
const MOTIF = /\bLam\b|lam\.ht/

const EXCEPTIONS: { fichier?: string; ligne: RegExp; pourquoi: string }[] = [
  { ligne: /« Lam » (ou|oswa) « Agora »|“Lam” or “Agora”/, pourquoi: 'entrée 2FA créée avant la bascule' },
]

function fichiers(dir: string): string[] {
  return readdirSync(dir).flatMap((nom) => {
    const chemin = join(dir, nom)
    if (statSync(chemin).isDirectory()) return fichiers(chemin)
    return /\.(ts|tsx|css)$/.test(nom) && !/\.test\.tsx?$/.test(nom) ? [chemin] : []
  })
}

/** Retire les commentaires sans toucher aux URL (`https://`) des chaînes. */
function sansCommentaires(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, ' '))
    .replace(/(^|\s)\/\/[^\n]*/g, '$1')
}

describe('marque Agora — aucun « Lam » visible hors exceptions', () => {
  it('la sentinelle tient : elle voit bien le motif dans du code', () => {
    expect(MOTIF.test(sansCommentaires("const x = 'Bienvenue sur Lam'"))).toBe(true)
    expect(MOTIF.test(sansCommentaires('// Lam, en commentaire'))).toBe(false)
    expect(MOTIF.test(sansCommentaires("const u = 'https://agora.ht' // lam.ht"))).toBe(false)
  })

  it('src/ ne contient plus aucun « Lam » visible', () => {
    const fautes: string[] = []
    for (const f of fichiers(SRC)) {
      const rel = relative(SRC, f)
      sansCommentaires(readFileSync(f, 'utf8'))
        .split('\n')
        .forEach((ligne, i) => {
          if (!MOTIF.test(ligne)) return
          const admise = EXCEPTIONS.some((e) => (!e.fichier || e.fichier === rel) && e.ligne.test(ligne))
          if (!admise) fautes.push(`${rel}:${i + 1}  ${ligne.trim().slice(0, 120)}`)
        })
    }
    expect(fautes).toEqual([])
  })
})
