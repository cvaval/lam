/**
 * LA SAISIE PUBLIQUE — **DEUX CHAMPS, ET DEUX SEULEMENT.**
 *
 * Ce fichier surveille un périmètre, pas une mise en page. Le formulaire public ne doit
 * jamais reprendre, par une édition distraite, l'un des contrôles du répertoire : menu des
 * entrées, sélecteur de code, filtre, kilométrage, question de suite, question « ce délai
 * est-il franc ? ». Chacun d'eux, seul, rouvrirait une partie de ce qui a été fermé — et le
 * dernier changerait le régime de calcul sous un libellé qui annonce du franc.
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { DelaiFormPublic } from './DelaiFormPublic'

const t = getDictionary('fr')

function rendu(valeurs = { d: '', n: '' }, erreur: string | null = null): string {
  return renderToStaticMarkup(
    <DelaiFormPublic locale="fr" t={t} action="/fr/delais" valeurs={valeurs} erreur={erreur} />,
  )
}

describe('le formulaire est un GET, et il marche sans JavaScript', () => {
  const html = rendu()

  it('méthode GET vers la page publique', () => {
    expect(html).toContain('method="get"')
    expect(html).toContain('action="/fr/delais"')
  })

  it('DEUX champs soumis, et deux seulement : `d` et `n`', () => {
    const noms = [...new Set([...html.matchAll(/name="([^"]+)"/g)].map((m) => m[1]))].sort()
    expect(noms).toEqual(['d', 'n'])
  })

  /**
   * ⚠️ Ni `e`, ni `f` en champ caché : le serveur les connaît par l'ACCÈS, qui ne se falsifie
   * pas depuis l'URL. Les poser ici les ferait apparaître dans l'adresse sans rien y ajouter.
   */
  it('aucun champ caché, aucune version, aucun `e`, aucun `f`', () => {
    expect(html).not.toContain('type="hidden"')
    expect(html).not.toMatch(/name="[rcwef]"/)
  })
})

describe('pas un contrôle du répertoire', () => {
  const html = rendu()

  it('aucun `<select>`, aucune `<option>`, aucun bouton radio', () => {
    expect(html).not.toContain('<select')
    expect(html).not.toContain('<option')
    expect(html).not.toContain('type="radio"')
  })

  it('ni code, ni filtre, ni kilométrage, ni question de suite', () => {
    for (const absent of [
      'Entrée du répertoire',
      'Filtrer la liste',
      'Kilométrage',
      'Question de suite',
      'Ce délai est-il franc ?',
      'Autre — saisir le nombre de jours',
    ]) {
      expect(html, absent).not.toContain(absent)
    }
  })
})

describe('les deux champs, et ce qui les accompagne', () => {
  const html = rendu()

  it('la date de RÉCEPTION, en champ natif, avec son indication de format', () => {
    expect(html).toContain('Date de réception de l’acte')
    expect(html).toContain('type="date"')
    // Me Vaval, 20 août 2026 : « Indiquer la date ; l’ordre affiché est celui de votre
    // navigateur. » — l’énumération des trois composantes a été coupée.
    expect(html).toContain('Indiquer la date ; l’ordre affiché est celui de votre navigateur.')
    expect(html).not.toContain('demande le jour, le mois et l’année')
    expect(html).not.toContain('Ouvrir le calendrier')
  })

  it('le nombre de jours FRANCS, numérique, borné', () => {
    expect(html).toContain('Nombre de jour(s) francs')
    expect(html).toContain('name="n"')
    expect(html).toContain('type="number"')
    // `renderToStaticMarkup` rend l'attribut tel qu'écrit ; HTML est insensible à la casse.
    expect(html.toLowerCase()).toContain('inputmode="numeric"')
    expect(html).toContain('max="3650"')
  })

  /**
   * ⚠️ **UNE CONSIGNE, PAS UN INVENTAIRE** (Me Vaval, 20 août 2026). « Il manque : Date de
   * réception de l'acte · Nombre de jour(s) francs » recopiait les deux libellés sous le
   * bouton, séparés d'un point médian. On nomme le PREMIER champ vide, à l'impératif.
   */
  it('le bouton Calculer est en Wouj à texte Blan, et il DIT quoi faire', () => {
    expect(html).toContain('bg-wouj')
    expect(html).toContain('text-white')
    expect(html).toContain('Indiquer la date de réception de l’acte')
    expect(html).not.toContain('Il manque :')
  })

  it('la date remplie, la consigne passe au second champ', () => {
    const html = rendu({ d: '2026-06-04', n: '' })
    expect(html).toContain('Indiquer le nombre de jour(s) francs')
    expect(html).not.toContain('Indiquer la date de réception')
  })

  it('ne dit plus rien quand les deux champs sont remplis', () => {
    const html = rendu({ d: '2026-06-04', n: '15' })
    expect(html).not.toContain('Il manque :')
    expect(html).not.toContain('Indiquer la date de réception')
    expect(html).not.toContain('Indiquer le nombre')
  })
})

describe('ce que la page dit d’elle-même', () => {
  const html = rendu()

  /**
   * ⚠️ **LA SECONDE PHRASE DE L'ANCIENNE NOTE EST DEVENUE FAUSSE.** `publicFrancOnlyNote`
   * ajoutait « Si le dernier jour tombe un dimanche ou une fête légale, il est prorogé d'un
   * jour (art. 991) » : depuis que cette page calcule FRANC PUR (`franc-pur.ts`), elle ne
   * proroge plus rien. La page porte la règle qu'elle applique, et pas une de plus.
   */
  it('la règle de droit, dans les mots de Me Vaval, et rien sur la prorogation', () => {
    expect(html).toContain(
      'Conformément au Code de procédure civile haïtien et au Code du travail, le délai franc ne compte ni le jour de la réception, ni le jour de l’échéance.',
    )
    expect(html).not.toContain('ordinaire')
    expect(html).not.toContain('prorogé')
    expect(html).not.toContain('991')
  })

  // ⚠️ RETIRÉ SUR DEMANDE DE ME VAVAL (20 août 2026). La phrase « Le répertoire des délais des
  // trois codes est réservé aux titulaires d'un compte. Se connecter. » remplaçait le lien
  // « Voir tout le répertoire ». Elle a été jugée inutile sur une surface publique : le
  // calculateur de jours francs se suffit à lui-même, il n'a pas à annoncer ce qu'il ne montre
  // pas. Ce test garde la porte fermée dans les deux sens — ni le lien d'origine, ni son
  // remplacement.
  it('aucune invitation à se connecter — le formulaire se suffit', () => {
    expect(html).not.toContain('réservé aux titulaires')
    expect(html).not.toContain('href="/fr/login"')
    expect(html).not.toContain('Se connecter')
  })
})

describe('les erreurs', () => {
  it('une erreur est rendue par le bloc du dépôt, ouverte par le MOT « Erreur — »', () => {
    const html = rendu({ d: '31/02/2026', n: '15' }, 'dateImpossible')
    expect(html).toContain('Erreur —')
    expect(html).toContain('Cette date n’existe pas')
    expect(html).toContain('aria-invalid="true"')
    // Une seconde fois sous le champ fautif : un résumé en tête ne dit pas OÙ corriger.
    expect(html).toContain('id="delai-erreur-champ"')
    expect((html.match(/Cette date n’existe pas/g) ?? []).length).toBe(2)
  })

  it('le refus du répertoire s’affiche en toutes lettres', () => {
    const html = rendu({ d: '2026-06-04', n: '' }, 'repertoireReserve')
    expect(html).toContain('Le répertoire des délais est réservé aux titulaires d’un compte')
  })

  it('un code d’erreur inconnu ne s’affiche jamais tel quel', () => {
    const html = rendu({ d: '', n: '' }, 'P2021')
    expect(html).not.toContain('P2021')
    expect(html).toContain('Cette demande n’est pas lisible')
  })
})

/**
 * ⚠️ **UN RENVOI ARIA QUI POINTE DANS LE VIDE NE DIT RIEN — ET RIEN NE LE SIGNALE.**
 *
 * Le champ de date posait `erreurId="delai-erreur-champ"` pour TOUTE erreur, alors que le
 * `<p id="delai-erreur-champ">` n'est rendu que sur `dateImpossible`. Sur `repertoireReserve`
 * — c'est-à-dire l'écran qu'une visiteuse voit en ouvrant un permalien `?e=<slug>` d'avant la
 * fermeture, le cas le plus courant —, sur `francSeulement`, `autreIncomplet`, `invalidFields`
 * et `rate`, il sortait avec `aria-describedby="delai-depart-format delai-erreur-champ"` :
 * une cible introuvable. Le message existait bien dans le bandeau au-dessus du formulaire ;
 * la liaison au champ, elle, était cassée, et rien n'était annoncé à la prise de focus.
 *
 * Le contrôle est GÉNÉRAL : pour chaque code d'erreur, tout identifiant listé dans un
 * `aria-describedby` doit exister dans le HTML rendu.
 */
describe('les renvois ARIA pointent sur des éléments qui EXISTENT', () => {
  const CODES = [
    'dateImpossible',
    'repertoireReserve',
    'francSeulement',
    'autreIncomplet',
    'invalidFields',
    'rate',
    'P2021',
    null,
  ]

  function identifiants(html: string): Set<string> {
    return new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]))
  }

  for (const code of CODES) {
    it(`« ${code ?? 'aucune erreur'} » : aucune cible manquante`, () => {
      const html = rendu({ d: '2026-06-04', n: '15' }, code)
      const presents = identifiants(html)
      const cibles = [...html.matchAll(/aria-describedby="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/))
      expect(cibles.length).toBeGreaterThan(0)
      for (const cible of cibles) {
        expect(presents.has(cible), `${code} → #${cible} introuvable`).toBe(true)
      }
    })
  }

  it('sur un refus qui n’est PAS celui de la date, le champ renvoie au bandeau', () => {
    const html = rendu({ d: '2026-06-04', n: '' }, 'repertoireReserve')
    expect(html).toContain('aria-describedby="delai-depart-format delai-erreur"')
    expect(html).toContain('id="delai-erreur"')
    // Et il ne se déclare pas fautif : le refus porte sur `e`, pas sur la date.
    expect(html).not.toContain('aria-invalid="true"')
  })

  it('sur `dateImpossible`, il renvoie au message SOUS le champ, et se déclare fautif', () => {
    const html = rendu({ d: '31/02/2026', n: '15' }, 'dateImpossible')
    expect(html).toContain('aria-describedby="delai-depart-format delai-erreur-champ"')
    expect(html).toContain('aria-invalid="true"')
  })
})
