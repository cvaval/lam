/**
 * § 5.1 — LE TEST DE FORME DE LA CONVERSION (défaut 14 b du cahier de recette).
 *
 * « Le seed s'arrêtant avant d'écrire, la conversion n'a jamais été exercée. » Ce test
 * l'exerce sur les 393 entrées, ET il LIT `prisma/schema.prisma` : une colonne ajoutée au
 * modèle sans être convertie, ou une clé convertie qui n'a pas de colonne, fait rougir ici
 * et pas le jour du `--apply`.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { COLONNES_NON_GRAINEES, versCreateInput, versRevisionPayload } from './graine'
import { REPERTOIRE, construireEntrees } from './repertoire'

const ENTREES = construireEntrees(REPERTOIRE)

/** Les champs SCALAIRES du modèle, lus dans le schéma — relations et attributs exclus. */
function colonnesDuModele(nom: string): string[] {
  const source = readFileSync('prisma/schema.prisma', 'utf8')
  const bloc = new RegExp(`^model ${nom} \\{$([\\s\\S]*?)^\\}$`, 'm').exec(source)
  if (!bloc) throw new Error(`model ${nom} introuvable dans prisma/schema.prisma`)
  return bloc[1]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('///') && !l.startsWith('//') && !l.startsWith('@@'))
    .map((l) => l.split(/\s+/))
    .filter(([, type]) => type && !/\[\]$/.test(type)) // une relation à liste n'est pas une colonne
    .map(([nomChamp]) => nomChamp)
}

describe('§ 5.1 — la conversion EntreeGrainee → DelaiEntry', () => {
  const colonnes = colonnesDuModele('DelaiEntry')
  const produit = versCreateInput(ENTREES[0])

  it('ne produit AUCUNE clé qui n’ait pas de colonne', () => {
    const orphelines = Object.keys(produit).filter((k) => !colonnes.includes(k))
    expect(orphelines).toEqual([])
  })

  it('couvre TOUTES les colonnes, sauf celles qu’elle laisse expressément', () => {
    const manquantes = colonnes.filter(
      (c) => !(c in produit) && !COLONNES_NON_GRAINEES.includes(c),
    )
    expect(manquantes).toEqual([])
  })

  it('les colonnes laissées de côté existent bien au modèle — la liste ne dérive pas', () => {
    for (const c of COLONNES_NON_GRAINEES) expect(colonnes, c).toContain(c)
  })

  it('`supplement` (objet) devient `supplementJson` (chaîne), et se relit à l’identique', () => {
    const avecSupplement = ENTREES.filter((e) => e.supplement)
    expect(avecSupplement).toHaveLength(6) // les six surcharges de l'art. 74 (§ 4.5)
    for (const e of avecSupplement) {
      const json = versCreateInput(e).supplementJson
      expect(typeof json).toBe('string')
      expect(JSON.parse(json!)).toEqual(e.supplement)
    }
    const sans = ENTREES.find((e) => !e.supplement)!
    expect(versCreateInput(sans).supplementJson).toBeNull()
  })

  it('AUCUN `undefined` sur les 393 lignes — Prisma le lirait « ne touche pas »', () => {
    for (const e of ENTREES) {
      const row = versCreateInput(e) as Record<string, unknown>
      const indefinis = Object.keys(row).filter((k) => row[k] === undefined)
      expect(indefinis, e.slug).toEqual([])
    }
  })

  it('les trois champs ajoutés au modèle sont bien portés (défauts 3, 9 et 14 b)', () => {
    const art356 = ENTREES.find((e) => e.code === 'CPC' && e.article === '356')!
    expect(versCreateInput(art356).dureeFondementFr).toContain('C. pr. civ., art. 354')

    const a5 = ENTREES.filter((e) => e.avisDistance === 'A5')
    expect(a5).toHaveLength(3)
    for (const e of a5) expect(versCreateInput(e).citationArticle).toMatch(/lieue/i)

    const surchargees = ENTREES.filter((e) => e.surchargeAppliquee)
    expect(surchargees).toHaveLength(6)
    for (const e of surchargees) expect(versCreateInput(e).surchargeAppliquee).toContain('art. 74')
  })

  it('`codeLibelle` porte le LIBELLÉ LONG, jamais l’abréviation (défaut 16 c)', () => {
    const attendu: Record<string, string> = {
      CPC: 'Code de procédure civile',
      TRAVAIL: 'Code du travail',
      CIVIL: 'Code civil',
    }
    for (const e of ENTREES) {
      expect(versCreateInput(e).codeLibelle, e.slug).toBe(attendu[e.code])
    }
  })

  it('la copie gelée de la révision 1 est le JSON de CE QUI SERA ÉCRIT', () => {
    for (const e of ENTREES.slice(0, 20)) {
      expect(JSON.parse(versRevisionPayload(e))).toEqual(versCreateInput(e))
    }
  })

  it('les 393 lignes se convertissent, et aucun statut ne sort de « visible »', () => {
    const toutes = ENTREES.map(versCreateInput)
    expect(toutes).toHaveLength(393)
    expect(new Set(toutes.map((r) => r.statut))).toEqual(new Set(['visible']))
    expect(new Set(toutes.map((r) => r.revision))).toEqual(new Set([1]))
    expect(new Set(toutes.map((r) => r.slug)).size).toBe(393)
  })
})
