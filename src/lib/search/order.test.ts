import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * ⚠️ CE TEST PROTÈGE UNE PERTE DE DOCUMENTS, PAS UN DÉTAIL D'ORDRE.
 *
 * En mode NAVIGATION (sans requête texte), la page est découpée par `skip`/`take`. Si le
 * tri ne porte que sur une date, toutes les lignes qui partagent cette date — ou qui l'ont
 * nulle — sont ex æquo, et PostgreSQL est libre de les rendre dans un ordre différent d'une
 * page à l'autre. Mesuré sur les circulaires BRH (88 des 141 sans date d'entrée en
 * vigueur) : 7 n'apparaissaient JAMAIS et 7 autres apparaissaient deux fois.
 *
 * Le départage par `id` est donc obligatoire partout où l'on pagine.
 */
const src = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

describe('stabilité de la pagination', () => {
  it('le tri du mode navigation départage par id', () => {
    const s = src('src/lib/search/fts.ts')
    const bloc = s.slice(s.indexOf('const orderBy: Prisma.DocumentOrderByWithRelationInput'), s.indexOf('const [total, docs]'))
    expect(bloc).toContain("{ effectiveDate: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }")
    expect(bloc).toContain("{ publicationDate: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }")
  })

  it('aucun findMany paginé ne trie sur la seule date', () => {
    const s = src('src/lib/search/fts.ts')
    const nus = [...s.matchAll(/orderBy: \{ (?:publicationDate|effectiveDate)[^}]*\}\s*,/g)]
      .filter((m) => !m[0].includes('id'))
    expect(nus.map((m) => m[0])).toEqual([])
  })

  it('la requête SQL de la recherche texte porte le même départage', () => {
    // Elle l'a toujours porté ; ce test empêche de le retirer « par symétrie ».
    const s = src('src/lib/search/ftsql.ts')
    expect(s).toContain('d."publicationDate" DESC NULLS LAST, d.id')
    expect(s).toContain('d."effectiveDate" DESC NULLS LAST, d.id')
  })
})
