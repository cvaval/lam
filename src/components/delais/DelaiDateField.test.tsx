/**
 * § 8.3 — LE CHAMP DE DATE, NATIF ET DISCRET.
 *
 * Ce qui a changé, et ce que ces tests protègent. Le champ était un `<input type="text">`
 * masqué JJ/MM/AAAA flanqué d'un bouton « Ouvrir le calendrier » qui déployait une grille de
 * mois complète. La cliente l'a jugé trop encombrant : « le lien doit être plus discret ».
 * C'est désormais un `<input type="date">` natif — l'icône du navigateur suffit.
 *
 * Les deux pièges de ce remplacement, tous deux invisibles à l'œil sur un poste français :
 *  1. **la VALEUR d'un champ natif est toujours `AAAA-MM-JJ`**, quelle que soit la locale du
 *     navigateur — c'est le format AFFICHÉ qui varie (`mm/dd/yyyy` sur un poste en anglais
 *     américain). Pousser autre chose dans `value` fait diverger React et le DOM ;
 *  2. **l'URL, elle, peut encore porter du JJ/MM/AAAA** (un lien tapé à la main, un permalien
 *     d'une autre origine) : le champ doit le convertir, et laisser vide ce qui n'est pas une
 *     date plutôt que de proposer une date voisine.
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { LOCALES } from '@/lib/types'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { DelaiDateField } from './DelaiDateField'

const t = getDictionary('fr')

function rendu(valeur: string, autres: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(
    <DelaiDateField t={t} valeur={valeur} onChange={() => {}} label="Date de réception de l’acte" {...autres} />,
  )
}

describe('le champ est NATIF, et le gros bouton a disparu', () => {
  const html = rendu('2026-06-04')

  it('c’est un `<input type="date" name="d">`', () => {
    expect(html).toContain('type="date"')
    expect(html).toContain('name="d"')
  })

  it('plus aucun bouton, plus aucun dialogue de calendrier', () => {
    expect(html).not.toContain('<button')
    expect(html).not.toContain('role="dialog"')
    expect(html).not.toContain('role="grid"')
    expect(html).not.toContain('aria-haspopup')
  })

  it('la cible tactile reste à 44 px, et rien ne passe sous le plancher', () => {
    expect(html).toContain('min-h-[44px]')
    expect(html).not.toContain('min-h-[40px]')
  })
})

describe('la valeur est TOUJOURS de l’ISO — le format affiché ne concerne que le navigateur', () => {
  it('l’ISO d’un permalien traverse tel quel', () => {
    expect(rendu('2026-06-04')).toContain('value="2026-06-04"')
  })

  it('le JJ/MM/AAAA d’une adresse tapée à la main est CONVERTI, jamais poussé tel quel', () => {
    const html = rendu('04/06/2026')
    expect(html).toContain('value="2026-06-04"')
    expect(html).not.toContain('04/06/2026')
  })

  it('une date IMPOSSIBLE laisse le champ vide, sans proposer le 1er ou le 3 mars', () => {
    const html = rendu('31/02/2026')
    expect(html).toContain('value=""')
    expect(html).not.toContain('2026-03-01')
    expect(html).not.toContain('2026-03-03')
  })
})

/**
 * ⚠️ **LE DÉFAUT QUE CE BLOC SURVEILLE : UNE PERTE DE SAISIE SILENCIEUSE.**
 *
 * Le segment « année » d'un champ de date natif accepte jusqu'à SIX chiffres. Sur un poste
 * dont le gabarit est `aaaa-mm-jj`, taper les huit chiffres « 20260604 » d'affilée met 202606
 * dans l'année, 04 dans le mois, et au premier chiffre du jour la valeur du DOM devient
 * `202606-04-01` — que la spécification HTML tient pour une date valide (« quatre chiffres OU
 * PLUS »). `parseIso` n'en lisait strictement que quatre : le repli poussait `''` dans
 * `value`, et REACT ÉCRASAIT LE DOM. Jour, mois et année disparaissaient d'un seul coup, sans
 * un mot ; la valeur ne partait jamais au serveur, donc aucun refus n'était prononcé, et la
 * visiteuse ne lisait que « Il manque : Date de réception de l'acte ».
 *
 * La règle, désormais : **on ne pousse dans `value` que ce que le navigateur CONSERVERAIT**,
 * et le refus reste motivé, prononcé par le serveur.
 */
describe('§ 8.3 — le champ ne s’efface JAMAIS tout seul', () => {
  it('une année à six chiffres — les huit chiffres tapés d’affilée — traverse telle quelle', () => {
    expect(rendu('202606-04-01')).toContain('value="202606-04-01"')
  })

  it('toute valeur qu’un champ natif conserve sort INTACTE de React', () => {
    // Année à 4, 5 et 6 chiffres : les trois formes qu'un segment natif peut porter.
    for (const v of ['2026-06-04', '20260-06-04', '202606-04-01', '9999-12-31', '1989-06-22']) {
      expect(rendu(v), v).toContain(`value="${v}"`)
    }
  })

  it('… mais ce qu’un champ natif REFUSERAIT n’est pas poussé non plus', () => {
    // Le 31 février n'est pas une date : le navigateur le viderait, et React et le DOM
    // divergeraient dans l'autre sens. L'an zéro non plus (« un nombre supérieur à 0 »).
    for (const v of ['2026-02-31', '0000-06-04', '2026-13-01', 'demain']) {
      expect(rendu(v), v).toContain('value=""')
    }
  })
})

describe('ce qui accompagne le champ', () => {
  it('l’indication de format est SOUS le champ, et elle dit que l’ordre suit le navigateur', () => {
    const html = rendu('')
    expect(html).toContain('id="delai-depart-format"')
    expect(html).toContain('aria-describedby="delai-depart-format"')
    expect(html).toContain('l’ordre affiché est celui de votre navigateur')
    // Le vieux masque affirmait un JJ/MM/AAAA qu'un poste en anglais américain ne montre pas.
    expect(html).not.toContain('JJ/MM/AAAA')
  })

  /**
   * ⚠️ **LA PHRASE NE DOIT PAS ÉNONCER UN ORDRE AVANT DE DIRE QU'ELLE N'EN ÉNONCE PAS.**
   * « Jour, mois, année — l'ordre affiché suit votre navigateur. » ouvrait sur une
   * énumération que l'œil lit comme une consigne : sur un poste dont le champ natif rend
   * `aaaa-mm-jj`, elle nommait l'ordre INVERSE ; sur un poste en anglais américain
   * (`mm/dd/yyyy`), un troisième encore. La phrase est fausse dans les deux cas les plus
   * courants. Ce contrôle porte sur les TROIS catalogues : ils se reprennent ensemble.
   */
  it('l’indication ne s’OUVRE pas sur une énumération, dans aucune des trois langues', () => {
    for (const l of LOCALES) {
      const phrase = getDictionary(l).delais.startFormatHint
      // Aucun gabarit de date affirmé…
      expect(phrase, l).not.toMatch(/JJ|AAAA|yyyy|mm\/dd|dd\/mm/i)
      // … et aucune ouverture en « Jour, mois, année » / « Day, month, year » / « Jou, mwa… ».
      expect(phrase, l).not.toMatch(/^\s*(Jour|Day|Jou)\s*,/i)
      // La phrase nomme quand même le navigateur : sans lui, elle ne dit plus rien.
      expect(phrase.toLowerCase(), l).toMatch(/navigateur|browser|navigatè/)
    }
  })

  it('le libellé est bien celui qu’on lui passe — il varie selon la surface', () => {
    expect(rendu('')).toContain('Date de réception de l’acte')
    expect(rendu('', { label: 'Point de départ du délai' })).toContain('Point de départ du délai')
  })

  it('en erreur, le champ porte `aria-invalid` et pointe le message', () => {
    const html = rendu('31/02/2026', { invalide: true, erreurId: 'delai-erreur-champ' })
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('aria-describedby="delai-depart-format delai-erreur-champ"')
  })

  it('deux champs date sur une même page ne partagent pas leur `id`', () => {
    expect(rendu('', { id: 'hero-delai-depart' })).toContain('id="hero-delai-depart"')
  })

  /**
   * ⚠️ **Aucune borne native.** La borne du 22 juin 1989 et l'horizon de dix ans sont un refus
   * MOTIVÉ et un avertissement écrit ; un `min`/`max` les remplacerait par une bulle générique
   * du navigateur, et l'utilisatrice ne saurait pas pourquoi sa date est refusée.
   */
  it('ni `min`, ni `max`, ni `required` : les bornes sont des phrases, pas des bulles', () => {
    const html = rendu('')
    expect(html).not.toMatch(/\bmin="/)
    expect(html).not.toMatch(/\bmax="/)
    expect(html).not.toContain('required')
  })
})
