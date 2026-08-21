/**
 * LA NORMALISATION DE LA REQUÊTE — le point de jonction entre un formulaire HTML et un
 * permalien canonique. C'est un endroit à défauts silencieux : rien ne casse, une valeur
 * disparaît simplement, et le calcul se fait sans elle.
 *
 * Deux cas réels, tous deux invisibles à l'œil :
 *  1. **les art. 517 et 586 mesurent DEUX distances.** Un formulaire sans JavaScript envoie
 *     `km=267&km=120` ; une lecture par `get('km')` n'en retient qu'une, et le délai est
 *     court d'un à trois jours ;
 *  2. **une adresse peut encore porter du JJ/MM/AAAA** tandis que le permalien est en
 *     AAAA-MM-JJ. Le champ de saisie est désormais un `<input type="date">` natif, dont la
 *     valeur est toujours ISO — mais un lien tapé à la main, ou copié d'ailleurs, ne l'est
 *     pas. Sans conversion, `d=04/06/2026` est rejeté par la validation et la visiteuse ne
 *     comprend pas pourquoi sa date « n'existe pas ».
 */
import { describe, expect, it } from 'vitest'
// ⚠️ Le noyau a QUITTÉ `DelaiCalculateur.tsx` le 20 août 2026 : ce fichier-là ne porte plus
// que le cadre à deux colonnes du PORTAIL, et il importe `DelaiResult` — donc l'appareil
// complet du raisonnement. Depuis que la surface publique « doit uniquement afficher la
// date » (Me Vaval), elle ne doit plus l'atteindre : la normalisation, le frein de débit et
// la lecture vivent dans `noyau-calculateur.tsx`, que les DEUX surfaces importent.
import { normaliserRecherche } from './noyau-calculateur'

describe('les deux kilométrages', () => {
  it('deux champs de même nom deviennent UN paramètre, dans l’ordre', () => {
    const sp = normaliserRecherche({ km: ['267', '120'] })
    expect(sp.get('km')).toBe('267,120')
  })

  it('un champ vide ne devient pas un zéro : il disparaît', () => {
    expect(normaliserRecherche({ km: ['267', ''] }).get('km')).toBe('267')
    expect(normaliserRecherche({ km: ['', ''] }).has('km')).toBe(false)
  })

  it('un seul kilométrage reste un seul kilométrage', () => {
    expect(normaliserRecherche({ km: '267' }).get('km')).toBe('267')
  })
})

describe('la date', () => {
  it('la saisie française devient de l’ISO', () => {
    expect(normaliserRecherche({ d: '04/06/2026' }).get('d')).toBe('2026-06-04')
  })

  it('l’ISO d’un permalien traverse sans être touché', () => {
    expect(normaliserRecherche({ d: '2026-06-04' }).get('d')).toBe('2026-06-04')
  })

  it('une date IMPOSSIBLE n’est pas rattrapée — elle reste telle quelle et sera refusée', () => {
    // 31/02 ne devient pas le 1er ou le 3 mars : c'est très exactement l'erreur d'un jour
    // que ce produit existe pour empêcher.
    expect(normaliserRecherche({ d: '31/02/2026' }).get('d')).toBe('31/02/2026')
    expect(normaliserRecherche({ d: '2026-02-31' }).get('d')).toBe('2026-02-31')
  })

  it('les séparateurs tolérés par la saisie sont ramenés à la forme unique', () => {
    expect(normaliserRecherche({ d: '4.6.2026' }).get('d')).toBe('2026-06-04')
    expect(normaliserRecherche({ d: '4-6-2026' }).get('d')).toBe('2026-06-04')
  })
})

describe('le reste de la requête', () => {
  it('un paramètre répété qui n’est pas `km` garde sa PREMIÈRE valeur', () => {
    // `e=x&e=y` ne doit pas devenir « x,y » : un slug composé n'existerait dans aucun
    // répertoire, et le refus serait incompréhensible.
    expect(normaliserRecherche({ e: ['cpc-354', 'cpc-417'] }).get('e')).toBe('cpc-354')
  })

  it('les paramètres inconnus sont transportés sans être interprétés', () => {
    const sp = normaliserRecherche({ e: 'autre', n: '15', f: 'oui', src: 'Avis DGI' })
    expect(sp.get('src')).toBe('Avis DGI')
    expect(sp.get('f')).toBe('oui')
  })
})
