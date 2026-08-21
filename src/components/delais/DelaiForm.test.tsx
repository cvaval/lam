/**
 * LA COLONNE DE SAISIE, RENDUE. Les trois pièges que ce fichier surveille sont des pièges de
 * SAISIE — aucun ne fait échouer un calcul, tous font choisir la mauvaise ligne :
 *
 *  1. **deux « Art. 172 » nus, à cinq lignes d'écart** (§ 4.5 bis) : les 8 homonymes du Code
 *     du travail doivent porter leur section DANS l'option, pas dans une infobulle ;
 *  2. **une entrée non calculable rendue comme les autres** : elle reste au menu — c'est le
 *     refus motivé qui informe — mais elle porte « Ne produit pas de date » en toutes lettres,
 *     jamais une couleur (Wouj et Vèt sont à 1,05:1) ;
 *  3. **un `r`, `c` ou `w` caché dans le formulaire** : un formulaire périmé demanderait une
 *     révision qui n'existe plus, et le calcul serait refusé sans que rien ne l'explique.
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { REPERTOIRE, construireEntrees } from '@/lib/delais/repertoire'
import { kindCalcule } from '@/lib/delais'
import type { CodeMenu, EntreeMenu } from '@/lib/delais/lecture-publique'
import type { KindDelai } from '@/lib/delais'
import { DelaiForm, contexteCourt, libelleRegime } from './DelaiForm'

const t = getDictionary('fr')
const ENTREES = construireEntrees(REPERTOIRE)

/** Le même contenu que rend `chargerRepertoirePublic`, monté depuis la graine. */
function menu(code: string, filtre: (e: (typeof ENTREES)[number]) => boolean): CodeMenu {
  const dedans = ENTREES.filter((e) => e.code === code && filtre(e))
  const entrees: EntreeMenu[] = dedans.map((e, i) => ({
    slug: e.slug,
    article: e.article,
    articleContexte: e.articleContexte ?? null,
    articleOccurrence: 1,
    tableau: 1,
    ordre: i,
    objetFr: e.objetFr,
    objetEn: e.objetFr,
    objetHt: e.objetFr,
    traductionRelue: false,
    dureeTexte: e.dureeTexte,
    dureeFondementFr: e.dureeFondementFr ?? null,
    kind: e.kind,
    calculable: kindCalcule(e.kind as KindDelai),
    jours: e.jours,
    nbDistances: e.nbDistances ?? 0,
    distanceAideFr: null,
    distanceDoubleFr: null,
    supplement: e.supplement ?? null,
    supplementIllisible: null,
    avisDistance: e.avisDistance ?? null,
    citationArticle: e.citationArticle ?? null,
    regime: e.regime,
    regimeIncertain: e.regimeIncertain,
    regimeFondement: e.regimeFondement,
    regimeLibelle: e.regimeIncertain
      ? 'Régime incertain — voir la lecture nommée'
      : libelleRegime(e, t),
    prorogation991: e.prorogation991,
    prorogationFondement: e.prorogationFondement,
    motifRefusFr: e.motifRefusFr ?? null,
    motifRefusEn: null,
    motifRefusHt: null,
    pointDepartFr: e.pointDepartFr,
    pointDepartEn: e.pointDepartFr,
    pointDepartHt: e.pointDepartFr,
    sanctionFr: null,
    sanctionEn: null,
    sanctionHt: null,
    revision: 1,
  }))
  return {
    code,
    codeLibelle: dedans[0]?.codeLibelle ?? '',
    abrege: '',
    fondementRegime: '',
    fondementProrogation: '',
    nbEntrees: entrees.length,
    nbCalculables: entrees.filter((e) => e.calculable).length,
    tableaux: [{ numero: 1, titreFr: null, entrees }],
  }
}

const VIDE = { d: '', e: '', km: [] as string[], sup: '', n: '', f: '', src: '' }

/** Les trois codes, comme la page les charge : c'est ce jeu-là qui doit être atteignable. */
const TROIS_CODES: CodeMenu[] = [
  { ...menu('CPC', (e) => ['354', '417', '295'].includes(e.article)), abrege: 'C. pr. civ.' },
  { ...menu('TRAVAIL', (e) => e.article === '164' || e.article === 'Art. 164'), abrege: 'C. trav.' },
  { ...menu('CIVIL', (e) => e.kind === 'JOURS'), abrege: 'C. civ.' },
]

function rendu(codes: CodeMenu[], valeurs = VIDE, erreur: string | null = null): string {
  return renderToStaticMarkup(
    <DelaiForm locale="fr" t={t} action="/fr/delais" codes={codes} valeurs={valeurs} erreur={erreur} />,
  )
}

describe('le formulaire est un GET, et il marche sans JavaScript', () => {
  const html = rendu([menu('CPC', (e) => e.article === '354')])

  it('méthode GET vers la page, aucun champ caché de version', () => {
    expect(html).toContain('method="get"')
    expect(html).toContain('action="/fr/delais"')
    expect(html).not.toContain('type="hidden"')
    expect(html).not.toMatch(/name="[rcw]"/)
  })

  it('les champs qui comptent portent leur `name` : d, e', () => {
    expect(html).toContain('name="d"')
    expect(html).toContain('name="e"')
  })

  it('le code n’est PAS soumis : il ne fait que réduire la liste', () => {
    expect(html).not.toContain('name="code"')
  })
})

describe('§ 4.5 bis — les homonymes du Code du travail', () => {
  it('deux articles de même numéro portent leur SECTION dans l’option', () => {
    const homonymes = ENTREES.filter(
      (e) => e.code === 'TRAVAIL' && ENTREES.filter((x) => x.code === 'TRAVAIL' && x.article === e.article).length > 1,
    )
    expect(homonymes.length).toBeGreaterThan(0)
    const html = rendu([menu('TRAVAIL', (e) => homonymes.some((h) => h.slug === e.slug))])
    for (const h of homonymes) {
      // Le contexte est OBLIGATOIRE sur un homonyme : sans lui, deux options identiques.
      // L'option n'en porte que le DERNIER niveau de titre — celui qui distingue réellement
      // les deux, sans coller trois niveaux et dépasser 170 caractères dans un `<select>`
      // mobile (§ 6.2). C'est cette distinction-là qu'on vérifie, pas la chaîne entière.
      expect(h.articleContexte).toBeTruthy()
      expect(html).toContain(contexteCourt(h.articleContexte as string))
    }
  })
})

describe('les entrées non calculables', () => {
  it('restent au menu, et le disent EN TOUTES LETTRES', () => {
    const refusees = ENTREES.filter((e) => e.code === 'CPC' && e.kind === 'MOIS').slice(0, 3)
    expect(refusees.length).toBeGreaterThan(0)
    const html = rendu([menu('CPC', (e) => refusees.some((r) => r.slug === e.slug))])
    for (const r of refusees) expect(html).toContain(`value="${r.slug}"`)
    expect(html).toContain('Ne produit pas de date')
  })

  it('l’option affiche le régime des entrées qui, elles, calculent', () => {
    const html = rendu([menu('CPC', (e) => e.article === '354')])
    expect(html).toContain('Délai franc')
  })
})

describe('« Autre » et les erreurs', () => {
  it('« Autre — saisir le nombre de jours » est toujours proposé, hors des tableaux', () => {
    const html = rendu([menu('CPC', (e) => e.article === '354')])
    expect(html).toContain('value="autre"')
    expect(html).toContain('Autre — saisir le nombre de jours')
  })

  /**
   * § 3 (Me Vaval, 20 août 2026) — « Le nombre de jour franc à indiquer à la main doit être la
   * première option du menu déroulant. » Deux exigences, et la seconde est la vraie : elle est
   * PREMIÈRE dans l'ordre du menu, et c'est elle que le menu porte quand rien n'a été choisi.
   */
  it('§ 3 — la saisie manuelle est la PREMIÈRE option, et l’état initial du menu', () => {
    const html = rendu([menu('CPC', (e) => e.article === '354')])
    const menuHtml = html.slice(html.indexOf('name="e"'), html.indexOf('</select>'))
    // Première : aucune balise `<option>` ni `<optgroup>` ne la précède.
    expect(menuHtml.indexOf('value="autre"')).toBeLessThan(menuHtml.indexOf('<optgroup'))
    expect(menuHtml).not.toContain('<option value=""')
    // Et sélectionnée : le rendu SERVEUR est le chemin sans JavaScript.
    expect(menuHtml).toContain('<option value="autre" selected=""')
  })

  it('sur « autre », les TROIS champs du § 4.12 apparaissent', () => {
    const html = rendu([menu('CPC', (e) => e.article === '354')], { ...VIDE, e: 'autre' })
    expect(html).toContain('name="n"')
    expect(html).toContain('name="src"')
    expect(html).toContain('name="f"')
    expect(html).toContain('Comment compter les jours ?')
  })

  /**
   * § 2 — LE COMMUTATEUR. Deux positions, **chacune portant son libellé ET sa règle**. La
   * question « Ce délai est-il franc ? » et ses trois réponses ont disparu : on ne demande plus
   * à l'utilisatrice de qualifier son délai, on lui demande comment elle veut qu'on compte.
   */
  it('§ 2 — deux positions, chacune avec son libellé ET sa règle écrite', () => {
    const html = rendu([menu('CPC', (e) => e.article === '354')], { ...VIDE, e: 'autre' })
    expect(html).toContain('Jours francs')
    expect(html).toContain('départ + nombre de jours + 1')
    expect(html).toContain('Jours calendaires')
    expect(html).toContain('le jour de l’échéance compte : départ + nombre de jours')
    // Exactement deux positions, et « Je ne sais pas » n'est plus proposé.
    expect(html.match(/name="f"/g)?.length).toBe(2)
    expect(html).not.toContain('value="ne-sais-pas"')
    expect(html).not.toContain('Je ne sais pas')
  })

  /**
   * ⚠️ **L'ÉTAT NE SE LIT PAS DANS LA COULEUR** (§ 8.1 : Wouj et Vèt sont à 1,05:1). Le bouton
   * radio natif reste dans le segment et porte `checked` ; la position retenue passe en outre
   * en gras. Retirez tout le fond et toute la bordure : le commutateur dit la même chose.
   */
  it('§ 8.1 — la position retenue est marquée autrement que par la couleur', () => {
    const html = rendu([menu('CPC', (e) => e.article === '354')], { ...VIDE, e: 'autre', f: 'non' })
    expect(html).toMatch(/<input[^>]*type="radio"[^>]*checked[^>]*value="non"/)
    expect(html).toContain('font-semibold">Jours calendaires')
    expect(html).toContain('font-medium">Jours francs')
  })

  /**
   * ⚠️ « Rends-le impossible, pas seulement caché. » Côté écran, l'impossibilité est qu'il n'y
   * a **rien à soumettre** : sur une entrée du répertoire, aucun `name="f"` n'est rendu. Et le
   * silence n'est pas une explication — la phrase dit d'où vient le régime.
   */
  it('§ 2 — sur une entrée du répertoire, aucun `f` à soumettre, et la raison est ÉCRITE', () => {
    const cpc = menu('CPC', (e) => e.article === '354')
    const html = rendu([cpc], { ...VIDE, e: cpc.tableaux[0].entrees[0].slug })
    expect(html).not.toContain('name="f"')
    expect(html).not.toContain('Comment compter les jours ?')
    expect(html).toContain('le décompte n’est pas un choix : il vient du texte')
  })

  /**
   * § 6.3 — UN PERMALIEN SE REJOUE À L'IDENTIQUE, DIX ANS PLUS TARD. Ceux émis avant le
   * commutateur portent `f=ne-sais-pas` : aucune des deux positions n'est la leur, et c'est
   * ÉCRIT plutôt que tranché rétroactivement.
   */
  it('§ 6.3 — un permalien `f=ne-sais-pas` ne coche rien, et le DIT', () => {
    const html = rendu([menu('CPC', (e) => e.article === '354')], {
      ...VIDE,
      e: 'autre',
      f: 'ne-sais-pas',
    })
    expect(html).not.toMatch(/<input[^>]*type="radio"[^>]*checked/)
    expect(html).toContain('l’ancienne réponse « Je ne sais pas »')
  })

  it('une erreur est rendue par le bloc du dépôt, ouverte par le MOT « Erreur — »', () => {
    const html = rendu([menu('CPC', (e) => e.article === '354')], VIDE, 'dateImpossible')
    expect(html).toContain('Erreur —')
    expect(html).toContain('Cette date n’existe pas')
    expect(html).toContain('aria-invalid="true"')
  })

  it('un code d’erreur inconnu ne s’affiche jamais tel quel', () => {
    const html = rendu([menu('CPC', (e) => e.article === '354')], VIDE, 'P2021')
    expect(html).not.toContain('P2021')
    expect(html).toContain('Cette demande n’est pas lisible')
  })
})

describe('le bouton Calculer', () => {
  it('est en Wouj à texte Blan, et il DIT ce qui manque', () => {
    const html = rendu([menu('CPC', (e) => e.article === '354')])
    const bouton = html.slice(html.indexOf('type="submit"'), html.indexOf('type="submit"') + 320)
    expect(bouton).toContain('bg-wouj')
    expect(bouton).toContain('text-white')
    expect(html).toContain('Il manque :')
    // L'espace connecté garde « Point de départ » : le départ y varie avec l'entrée
    // (signification, prononcé, dépôt…), et « réception » y serait faux.
    expect(html).toContain('Point de départ du délai')
  })

  it('ne dit plus rien quand tout est rempli', () => {
    const cpc = menu('CPC', (e) => e.article === '354')
    const html = rendu([cpc], { ...VIDE, d: '04/06/2026', e: cpc.tableaux[0].entrees[0].slug })
    expect(html).not.toContain('Il manque :')
  })
})

// ===========================================================================
// § 6.2 — LE FORMULAIRE FONCTIONNE SANS JAVASCRIPT
// ===========================================================================

/**
 * ⚠️ Le docblock l'affirmait trois fois ; le rendu le démentait. Le sélecteur de code était
 * un `<input type="radio">` **sans `name` et sans `value`** : il ne se soumet pas, il ne fait
 * que piloter un `useState`. Or le `<select name="e">` n'était peuplé que des entrées de
 * `codeCourant` — script désactivé, **161 des 393 entrées** (Travail et Civil) étaient
 * inatteignables, et « Filtrer la liste » inopérant.
 *
 * Le rendu serveur ci-dessous EST le chemin sans script : c'est exactement ce que reçoit un
 * navigateur avant hydratation.
 */
describe('§ 6.2 — sans JavaScript, les 393 entrées sont atteignables', () => {
  const html = renderToStaticMarkup(
    <DelaiForm
      locale="fr"
      t={t}
      action="/fr/delais"
      codes={TROIS_CODES}
      valeurs={VIDE}
    />,
  )

  it('les TROIS codes sont dans le même `<select>`, pas seulement le premier', () => {
    const total = TROIS_CODES.reduce((n, c) => n + c.tableaux.reduce((m, tab) => m + tab.entrees.length, 0), 0)
    const options = html.match(/<option value="[^"]+"/g) ?? []
    // +1 : « Autre ». ⚠️ Il n'y a PLUS d'option vide au-dessus d'elle (§ 3, 20 août 2026) :
    // la saisie manuelle est la première du menu, et l'ancien `<option value="">` la
    // reléguait au second rang.
    expect(options.length).toBe(total + 1)
    expect(html).not.toContain('<option value=""')
    for (const c of TROIS_CODES) {
      const une = c.tableaux[0].entrees[0]
      expect(html, c.code).toContain(`value="${une.slug}"`)
    }
  })

  it('le sélecteur de code est un GROUPE de commandes, jamais des radios orphelines', () => {
    // Trois radios sans `name` ne forment aucun groupe ARIA : les flèches ne les parcourent
    // pas et chacune est tabulable séparément.
    expect(html).toContain('role="group"')
    expect(html).not.toContain('type="radio" checked')
    // Et il ne se soumet pas : il n'a pas de `name`, donc il ne pollue pas le permalien.
    expect(html).not.toMatch(/<input[^>]*type="radio"[^>]*name="code"/)
  })

  it('l’optgroup nomme son code : deux « Tableau 1 » sans code seraient indiscernables', () => {
    expect(html).toContain('C. pr. civ. —')
  })
})

// ===========================================================================
// § 6.2 — LE MESSAGE D'ERREUR EST SOUS LE CHAMP FAUTIF
// ===========================================================================

describe('§ 6.2 — la faute et le champ au même endroit', () => {
  const html = renderToStaticMarkup(
    <DelaiForm
      locale="fr"
      t={t}
      action="/fr/delais"
      codes={TROIS_CODES}
      valeurs={{ ...VIDE, d: '31/02/2026' }}
      erreur="dateImpossible"
    />,
  )

  it('le résumé en tête porte `role="alert"`, comme avant', () => {
    expect(html).toContain('role="alert"')
    expect(html).toContain('Cette date n’existe pas')
  })

  it('… et le message est RENDU UNE SECONDE FOIS sous le champ concerné', () => {
    expect(html).toContain('id="delai-erreur-champ"')
    expect(html).toContain('aria-invalid="true"')
    // `aria-describedby` pointe le message DU CHAMP, pas seulement le résumé lointain.
    expect(html).toContain('delai-erreur-champ"')
    expect((html.match(/Cette date n’existe pas/g) ?? []).length).toBe(2)
  })
})

// ===========================================================================
// § 6.2 point 2 / § 4.7 — LE RÉGIME RESTE DANS L'OPTION, ET IL EST TRADUIT
// ===========================================================================

describe('§ 4.7 — le régime est AJOUTÉ à l’option, jamais remplacé', () => {
  it('une entrée non calculable porte SON RÉGIME **et** « Ne produit pas de date »', () => {
    const nonCalculables = TROIS_CODES.flatMap((c) =>
      c.tableaux.flatMap((tab) => tab.entrees.filter((e) => !e.calculable)),
    )
    expect(nonCalculables.length).toBeGreaterThan(0)
    const html = renderToStaticMarkup(
      <DelaiForm
        locale="fr"
        t={t}
        action="/fr/delais"
        codes={TROIS_CODES}
        valeurs={VIDE}
      />,
    )
    for (const e of nonCalculables.slice(0, 5)) {
      const option = new RegExp(`value="${e.slug}">([^<]*)<`).exec(html)?.[1] ?? ''
      expect(option, e.slug).toContain('Ne produit pas de date')
      expect(option, e.slug).toContain(libelleRegime(e, t))
    }
  })

  it('§ 8.2 — le libellé du régime suit la langue de l’écran', () => {
    const franc = { regime: 'FRANC', regimeIncertain: false }
    expect(libelleRegime(franc, getDictionary('fr'))).toBe('Délai franc')
    expect(libelleRegime(franc, getDictionary('en'))).toBe('Clear days')
    expect(libelleRegime(franc, getDictionary('ht'))).toBe('Delè fran')
  })
})
