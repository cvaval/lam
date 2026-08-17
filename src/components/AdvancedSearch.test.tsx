import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AdvancedSearch } from './AdvancedSearch'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { DOC_TYPES, type DocType, type Locale } from '@/lib/types'

/**
 * LE PANNEAU DOIT PERMETTRE D'ÉCRIRE CE QU'ON CHERCHE.
 *
 * Il s'annonce comme un formulaire complet — il porte son propre bouton « Rechercher » — et
 * n'offrait que la section, la période et le numéro. La requête, elle, voyageait en
 * `input hidden` au nom de la règle « une seule barre par page ». Sur l'Index du Moniteur,
 * dont les 27 234 entrées se cherchent d'abord par leur intitulé ou par une raison sociale,
 * on pouvait donc remplir tout le formulaire sans jamais dire ce qu'on cherchait.
 */
const t = getDictionary('fr')

const rendre = (
  values: Partial<Parameters<typeof AdvancedSearch>[0]['values']> = {},
  locale: Locale = 'fr',
) =>
  renderToStaticMarkup(
    <AdvancedSearch
      locale={locale}
      t={getDictionary(locale)}
      allowed={[...DOC_TYPES] as DocType[]}
      values={{ q: '', ...values }}
      open
    />,
  )

describe('le champ de saisie de la requête', () => {
  it('existe, et n’est plus caché', () => {
    const html = rendre()
    expect(html).toMatch(/<input[^>]*name="q"/)
    // C'est le MÊME paramètre, rendu visible — pas une seconde requête à côté de l'autre.
    expect(html).not.toMatch(/<input type="hidden" name="q"/)
    expect((html.match(/name="q"/g) ?? []).length).toBe(1)
  })

  it('sur l’Index, il demande un NOM — c’est ainsi qu’on y cherche', () => {
    const html = rendre({ type: 'moniteur' })
    expect(html).toContain('Nom ou intitulé')
    expect(html).toContain('SOGEBANK')
  })

  it('ailleurs, il demande des mots', () => {
    const html = rendre({ type: 'legislationannotee' })
    expect(html).toContain('Mots recherchés')
    expect(html).not.toContain('Nom ou intitulé')
  })

  it('il affiche la requête en cours, il ne la perd pas', () => {
    // Le panneau s'ouvre par-dessus une recherche déjà faite : la case doit la montrer,
    // sans quoi soumettre le formulaire effacerait silencieusement la requête.
    expect(rendre({ q: 'expropriation Delmas' })).toContain('value="expropriation Delmas"')
  })

  it('le libellé de l’Index existe dans les trois langues, et diffère du générique', () => {
    for (const l of ['fr', 'en', 'ht'] as Locale[]) {
      const d = getDictionary(l)
      expect(d.search.queryLabelIndex.length).toBeGreaterThan(2)
      expect(d.search.queryLabelIndex).not.toBe(d.search.queryLabel)
      expect(rendre({ type: 'moniteur' }, l)).toContain(d.search.queryLabelIndex)
    }
  })
})

describe('les critères restent ce qu’ils étaient', () => {
  it('la section, la période et le numéro sont toujours là', () => {
    const html = rendre()
    for (const nom of ['type', 'yearFrom', 'yearTo', 'num']) {
      expect(html).toMatch(new RegExp(`name="${nom}"`))
    }
    expect(html).toContain(t.search.numberPh)
  })

  it('« Réinitialiser » vide le formulaire ENTIER, requête comprise', () => {
    // Depuis que la requête est un champ visible, la laisser derrière afficherait une case
    // encore remplie juste après avoir cliqué « Réinitialiser ».
    const html = rendre({ q: 'expropriation' })
    expect(html).toContain('href="/fr/search?adv=1"')
    expect(html).not.toContain('search?adv=1&amp;q=')
  })

  it('les critères de décision ne paraissent pas sur l’Index', () => {
    // Proposés partout, ils ne rendraient que des pages vides.
    const html = rendre({ type: 'moniteur' })
    expect(html).not.toMatch(/name="judge"/)
    expect(html).not.toMatch(/name="parties"/)
  })
})
