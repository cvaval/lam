import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ETAT_COLORS, BRAND_COLORS } from '@/lib/brand-colors'
import {
  GAMMES,
  SITUATIONS,
  KINDS_CITATION_CONNUS,
  NATURES_BANDEAU,
  NATURES_CONNEXE,
  MARQUEUR_TETE,
  classes,
  kindCitation,
  libelle,
  natureDuBandeau,
  natureDuConnexe,
  situationDeMarque,
  situationDuBandeau,
  situationDuConnexe,
  situationDuMarqueur,
  situationDuStatutArticle,
  situationDuStatutFiche,
  type Situation,
} from './situations'

/**
 * LE REGISTRE DES SITUATIONS (17 oct. 2026) — consigne de Me Vaval : « les codes couleurs doivent être
 * identiques pour le même type de situation : amendement, nouveau texte, radier, jurisprudence, etc. »
 * Contrôles du § 7.2-7.3 de docs/prompt-harmonisation-replis-legislation-annotee.md.
 */

// ── Colorimétrie ─────────────────────────────────────────────────────────────────────────────

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const luminance = (h: string) => {
  const [r, g, b] = rgb(h).map(lin)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
/** Rapport de contraste WCAG 2.x. */
const contraste = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}
/** ΔE CIE76 (L*a*b*, D65) — la mesure du § 4 du prompt (bordeaux/terre cuite : 18,9). */
const lab = (h: string) => {
  const [r, g, b] = rgb(h).map(lin)
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const X = f((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047)
  const Y = f(r * 0.2126 + g * 0.7152 + b * 0.0722)
  const Z = f((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883)
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)]
}
const deltaE = (a: string, b: string) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]))

const ENCRE = BRAND_COLORS.ank
const BLANC = '#FFFFFF'
const SURLIGNEUR = '#FFF4DB' // mark.hl, globals.css
const SELECTION = '#F1E2DA' // ::selection, globals.css
const RESERVEES = { action: '#9B422C', succes: '#23665D', carte: '#00209F' }
const GAMMES_ETAT = Object.entries(ETAT_COLORS)

describe('la palette des états', () => {
  it('mesure ce que dit le prompt (étalon : bordeaux / terre cuite = 18,9)', () => {
    expect(deltaE(ETAT_COLORS.radie.filet, RESERVEES.action)).toBeCloseTo(18.9, 1)
  })

  for (const [g, { fond, filet }] of GAMMES_ETAT) {
    it(`${g} : encre sur fond ≥ 4,5:1, filet lisible comme texte sur blanc et sur fond`, () => {
      expect(contraste(ENCRE, fond)).toBeGreaterThanOrEqual(4.5)
      // Le filet sert aussi de couleur de TEXTE (pictogramme, statut d'acte) : seuil texte, pas 3:1.
      expect(contraste(filet, BLANC)).toBeGreaterThanOrEqual(4.5)
      expect(contraste(filet, fond)).toBeGreaterThanOrEqual(4.5)
    })

    /** ⚠️ La première version du prompt reprenait le surligneur et la sélection : à ne pas refaire. */
    it(`${g} : le fond ne se confond ni avec le surligneur de recherche ni avec la sélection`, () => {
      expect(deltaE(fond, SURLIGNEUR)).toBeGreaterThanOrEqual(5)
      expect(deltaE(fond, SELECTION)).toBeGreaterThanOrEqual(5)
    })

    it(`${g} : le filet se distingue des couleurs réservées (action, succès, carte)`, () => {
      for (const c of Object.values(RESERVEES)) expect(deltaE(filet, c)).toBeGreaterThanOrEqual(10)
    })
  }

  it('les filets se distinguent deux à deux (ΔE ≥ 15)', () => {
    for (let i = 0; i < GAMMES_ETAT.length; i++)
      for (let j = i + 1; j < GAMMES_ETAT.length; j++) {
        const d = deltaE(GAMMES_ETAT[i][1].filet, GAMMES_ETAT[j][1].filet)
        expect(d, `${GAMMES_ETAT[i][0]} / ${GAMMES_ETAT[j][0]}`).toBeGreaterThanOrEqual(15)
      }
  })

  /** ⚠️ Sitwon et wouj appartiennent au certificateur (charte v3, AV-02) : jamais une couleur d'état. */
  it('aucune gamme d’état ne reprend un accent de marque', () => {
    for (const [, { fond, filet }] of GAMMES_ETAT)
      for (const c of [BRAND_COLORS.wouj, BRAND_COLORS.sitwon]) {
        expect(fond.toUpperCase()).not.toBe(c.toUpperCase())
        expect(filet.toUpperCase()).not.toBe(c.toUpperCase())
      }
  })

  /** Les classes du registre sont des chaînes LITTÉRALES (Tailwind ne voit que celles-là). */
  it('chaque gamme a ses quatre classes, et elles existent dans la config', () => {
    const cfg = readFileSync('tailwind.config.ts', 'utf8')
    expect(cfg).toContain('ETAT_COLORS')
    for (const [g, c] of Object.entries(GAMMES)) {
      if (g === 'neutre') continue
      expect(c.fond).toBe(`bg-etat-${g}-fond`)
      expect(c.filet).toBe(`border-etat-${g}-filet`)
      expect(c.barre).toBe(`border-l-etat-${g}-filet`)
      expect(c.texte).toBe(`text-etat-${g}-filet`)
      expect(ETAT_COLORS).toHaveProperty(g)
    }
  })
})

// ── Couverture du registre ───────────────────────────────────────────────────────────────────

describe('le registre couvre toutes les situations du corpus', () => {
  const toutes = Object.keys(SITUATIONS) as Situation[]

  it('chaque situation a un libellé en français, en anglais et en créole', () => {
    for (const s of toutes) for (const l of ['fr', 'en', 'ht'] as const) expect(libelle(s, l).trim(), `${s}/${l}`).not.toBe('')
  })

  /** ⚠️ /en et /ht affichaient « Modifié », « Abrogé », « Commentaires »… en français. */
  it('aucun libellé anglais n’est resté en français', () => {
    const accentsFr = /[éèêàùç]/
    for (const s of toutes) expect(libelle(s, 'en'), s).not.toMatch(accentsFr)
  })

  it('le vocabulaire de Me Vaval : Amendé, Nouveau, Abrogé', () => {
    expect(libelle('amende', 'fr')).toBe('Amendé')
    expect(libelle('nouveau', 'fr')).toBe('Nouveau')
    expect(libelle('abroge', 'fr')).toBe('Abrogé')
  })

  it('même situation, même gamme ; situations distinctes, gammes distinctes', () => {
    expect(classes('amende')).not.toEqual(classes('nouveau'))
    expect(classes('amende')).not.toEqual(classes('abroge'))
    expect(classes('nouveau')).not.toEqual(classes('abroge'))
    expect(classes('jurisprudence')).not.toEqual(classes('annotations'))
    expect(classes('acte_abrogatif')).toEqual(classes('abroge'))
    expect(classes('acte_modificatif')).toEqual(classes('amende'))
    expect(classes('texte_abroge')).toEqual(classes('abroge'))
  })

  it('chaque statut d’article d’appareil a sa situation', () => {
    expect(situationDuStatutArticle('modifié')).toBe('amende')
    expect(situationDuStatutArticle('nouveau')).toBe('nouveau')
    expect(situationDuStatutArticle('abrogé')).toBe('abroge')
    expect(situationDuStatutArticle('partiellement abrogé')).toBe('partiellement_abroge')
    expect(situationDuStatutArticle('errata')).toBe('errata')
  })

  it('chaque marque d’ArticleVersion a sa situation', () => {
    expect(situationDeMarque('modifie')).toBe('amende')
    expect(situationDeMarque('abroge')).toBe('abroge')
    expect(situationDeMarque('ajout')).toBe('nouveau')
  })

  it('statuts de fiche : abrogé, amendé, et « pas encore en vigueur »', () => {
    const now = new Date('2026-10-17')
    expect(situationDuStatutFiche('ABROGE', null, now)).toBe('abroge')
    expect(situationDuStatutFiche('MODIFIE', null, now)).toBe('amende')
    expect(situationDuStatutFiche('PUBLIE', '2027-01-01', now)).toBe('a_venir')
    expect(situationDuStatutFiche('PUBLIE', '2020-01-01', now)).toBeNull()
    expect(situationDuStatutFiche('EN_VIGUEUR', null, now)).toBe('en_vigueur')
    expect(classes('en_vigueur')).toEqual(GAMMES.neutre)
  })

  /** Les six types de `CrossRef.kind` (schema.prisma) — un code brut s'affichait dans « Citations ». */
  it('chaque type de renvoi est traduit et orienté', () => {
    expect(KINDS_CITATION_CONNUS.sort()).toEqual(['ABROGE', 'APPLIQUE', 'CITE', 'COMMENTE', 'MODIFIE', 'VOIR'])
    for (const k of KINDS_CITATION_CONNUS)
      for (const l of ['fr', 'en', 'ht'] as const) {
        expect(kindCitation(k, 'sortant', l).label).not.toBe(k)
        expect(kindCitation(k, 'entrant', l).label).not.toBe(kindCitation(k, 'sortant', l).label)
      }
    expect(kindCitation('MODIFIE', 'entrant', 'fr')).toEqual({ label: 'Amendé par', situation: 'amende' })
    expect(kindCitation('ABROGE', 'sortant', 'fr').situation).toBe('abroge')
  })

  it('chaque nature de bandeau et de bloc connexe a sa situation', () => {
    for (const n of NATURES_BANDEAU) expect(SITUATIONS[situationDuBandeau(n)]).toBeDefined()
    for (const n of NATURES_CONNEXE) expect(SITUATIONS[situationDuConnexe(n)]).toBeDefined()
    expect(situationDuConnexe('derogation')).toBe('derogation')
    expect(situationDuConnexe('abrogatif')).toBe('acte_abrogatif')
  })

  it('le `kind` posé en base prévaut sur la classification par motifs', () => {
    expect(natureDuBandeau({ kind: 'sic', note: 'Texte CONSOLIDÉ' })).toBe('sic')
    expect(natureDuConnexe({ kind: 'derogation', label: 'Article modifié — Décret' })).toBe('derogation')
    // Un `kind` inconnu est ignoré, pas propagé.
    expect(natureDuBandeau({ kind: 'n-importe', note: 'Le Journal officiel imprime « 1er »' })).toBe('sic')
  })

  it('marqueurs de tête : seuls ceux d’en tête, et l’abrogation se reconnaît', () => {
    expect(MARQUEUR_TETE.exec('(D. du 14 novembre 1988, art. 1) Les déclarations')?.[0]).toBe('(D. du 14 novembre 1988, art. 1)')
    expect(MARQUEUR_TETE.test('Les déclarations (Loi du 3 avril 2018)')).toBe(false)
    expect(situationDuMarqueur('(Abrogé par le Décret du 6 janvier 2016)')).toBe('abroge')
    expect(situationDuMarqueur('(L. du 3 avril 2018)')).toBe('amende')
  })
})

/**
 * ⚠️ AUCUN CHAMP D'ANNOTATIONS SANS DÉCISION. `parseAnnotations` est une liste blanche : un champ
 * ajouté au lecteur doit l'être ici, avec sa situation (ou la mention qu'il n'en produit pas).
 */
describe('chaque champ d’annotations est déclaré', () => {
  const DECLARES: Record<string, Situation | 'aucune'> = {
    title: 'aucune',
    annotationAuthor: 'aucune',
    navToc: 'navigation',
    toc: 'navigation',
    connexes: 'connexe',
    jurisprudence: 'jurisprudence',
    indexEntries: 'navigation',
    crossRefs: 'renvoi',
    reserve: 'reserve',
    oldVersions: 'ancienne_redaction',
    oldVersionsLabel: 'ancienne_redaction',
    status: 'amende',
    labels: 'aucune',
    concordance: 'concordance',
    statusActe: 'acte_modificatif',
    connexe: 'connexe',
    commentaires: 'annotations',
    pointAnchors: 'aucune',
    repeatedHeads: 'aucune',
    refDisplay: 'aucune',
  }
  it('la liste blanche de parseAnnotations ne contient aucun champ inconnu du registre', () => {
    const src = readFileSync('src/lib/legislation/annotated.ts', 'utf8')
    const corps = src.slice(src.indexOf('export function parseAnnotations'), src.indexOf('export type AnnBlock'))
    const champs = [...corps.matchAll(/^\s{6}(\w+):/gm)].map((m) => m[1])
    expect(champs.length).toBeGreaterThan(15)
    for (const c of champs) expect(DECLARES, `champ « ${c} » non déclaré`).toHaveProperty(c)
  })
})

/** ⚠️ `\b` ne mord pas après une lettre accentuée en JavaScript (« Article modifié\b » ne valait rien). */
describe('classement des blocs connexes par intitulé', () => {
  it('« Article modifié — … » et « Article abrogé — … » sont reconnus', () => {
    expect(natureDuConnexe({ label: 'Article modifié — L. 13 sept 1951' })).toBe('modificatif')
    expect(natureDuConnexe({ label: 'Article abrogé — D-L 30 juin 1960' })).toBe('abrogatif')
    expect(natureDuConnexe({ label: 'Modifié (définition annulée et remplacée) par le Décret du 2 octobre 2020' })).toBe('modificatif')
    expect(natureDuConnexe({ label: 'Article modifiée par erreur' })).not.toBe('abrogatif')
  })
})
