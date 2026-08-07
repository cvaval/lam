import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Les renvois cités DANS un pliable doivent être cliquables comme au corps.
 *
 * Le contenu des blocs de `RelatedLaw` était rendu BRUT, alors que l'ancienne version juste
 * au-dessus et tout le pliable des annotations (`Jurisprudence`) passaient déjà par
 * `CodeRefText` : le même « C. p. c., 809 » était un lien dans le texte de l'article et du
 * texte mort trois lignes plus bas, dans le pliable.
 *
 * Le contrôle porte sur le SOURCE et non sur un rendu : le pliable est replié par défaut
 * (`useState(false)`), si bien qu'un rendu statique ne montre rien de son contenu — un test
 * de rendu passerait sans rien prouver. Il n'y a pas d'environnement DOM dans cette suite
 * pour l'ouvrir.
 */
const lire = (n: string) => readFileSync(join(__dirname, `${n}.tsx`), 'utf8')

describe('pliables — renvois cliquables', () => {
  it('RelatedLaw fait passer intitulé, contenu et ancienne version par CodeRefText', () => {
    const s = lire('RelatedLaw')
    for (const champ of ['b.label', 'b.text', 'old'])
      expect(s, `${champ} doit être relié`).toMatch(
        new RegExp(`<CodeRefText\\s+text=\\{${champ.replace('.', '\\.')}\\}`),
      )
    // Et plus aucun de ces champs rendu nu dans une balise.
    expect(s).not.toMatch(/>\{b\.text\}</)
    expect(s).not.toMatch(/>\{b\.label\}</)
  })

  it('Jurisprudence relie ses extraits et ses références', () => {
    const s = lire('Jurisprudence')
    expect(s).toMatch(/<CodeRefText\s+text=\{c\.excerpt/)
    expect(s).toMatch(/<CodeRefText\s+text=\{c\.ref\}/)
  })
})
