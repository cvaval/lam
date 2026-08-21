/**
 * LA LECTURE DE LA BASE — l'aller-retour `graine.ts` → `depuis-base.ts`.
 *
 * `graine.ts` convertit une entrée du répertoire EN LIGNE de base ; ce fichier-ci relit la
 * ligne. Le test exerce donc les 393 entrées réelles dans les deux sens : ce qui est écrit doit
 * se relire à l'identique, sinon un délai franc reviendrait ordinaire, et la date bougerait
 * d'un jour.
 */
import { describe, expect, it } from 'vitest'
import { CALENDRIER_V1 } from './feries'
import { versCreateInput } from './graine'
import { REPERTOIRE, construireEntrees } from './repertoire'
import {
  ligneDepuisPayload,
  lireSupplement,
  versCalendrier,
  versEntreeCalendrier,
  versEntreeDelai,
} from './depuis-base'
import type { LigneDelaiEntry, LigneDelaiFerie } from './depuis-base'

const ENTREES = construireEntrees(REPERTOIRE)
const LIGNES = ENTREES.map((e) => versCreateInput(e) as unknown as LigneDelaiEntry)

describe('DelaiEntry → EntreeDelai', () => {
  it('les 393 lignes se relisent toutes, sans exception', () => {
    const refus = LIGNES.map((l) => versEntreeDelai(l)).filter((c) => !c.ok)
    expect(refus).toEqual([])
  })

  it('ce que la graine écrit, la lecture le rend à l’identique', () => {
    for (const e of ENTREES) {
      const relue = versEntreeDelai(versCreateInput(e) as unknown as LigneDelaiEntry)
      expect(relue.ok, e.slug).toBe(true)
      if (!relue.ok) continue
      const v = relue.valeur
      expect(v.slug).toBe(e.slug)
      expect(v.code).toBe(e.code)
      expect(v.kind).toBe(e.kind)
      expect(v.jours).toBe(e.jours ?? null)
      expect(v.regime).toBe(e.regime)
      // Le drapeau qui décide si la tête d'affiche est franche ou ordinaire : un jour d'écart.
      expect(v.regimeIncertain).toBe(e.regimeIncertain)
      expect(v.regimeFondement).toBe(e.regimeFondement)
      expect(v.prorogation991).toBe(e.prorogation991)
      expect(v.supplement).toEqual(e.supplement ?? null)
    }
  })

  it('une colonne hors énumération est REFUSÉE, jamais transtypée en silence', () => {
    const base = LIGNES[0]
    expect(versEntreeDelai({ ...base, code: 'FISCAL' }).ok).toBe(false)
    expect(versEntreeDelai({ ...base, kind: 'SEMAINES' }).ok).toBe(false)
    expect(versEntreeDelai({ ...base, regime: 'FRANCHE' }).ok).toBe(false)
    expect(versEntreeDelai({ ...base, prorogation991: 'PEUT-ÊTRE' }).ok).toBe(false)
    expect(versEntreeDelai({ ...base, nbDistances: 3 }).ok).toBe(false)
  })

  it('un `supplementJson` illisible fait échouer la lecture — pas une entrée sans sa question', () => {
    expect(lireSupplement('{oups').ok).toBe(false)
    expect(lireSupplement(null)).toEqual({ ok: true, valeur: null })
    expect(lireSupplement('   ')).toEqual({ ok: true, valeur: null })
    expect(versEntreeDelai({ ...LIGNES[0], supplementJson: '[]' }).ok).toBe(false)
  })

  it('la copie gelée d’une révision se relit ; un payload amputé est refusé', () => {
    const gele = JSON.stringify(versCreateInput(ENTREES[0]))
    const relu = ligneDepuisPayload(gele)
    expect(relu.ok).toBe(true)
    if (relu.ok) expect(relu.valeur.slug).toBe(ENTREES[0].slug)

    expect(ligneDepuisPayload('{oups').ok).toBe(false)
    expect(ligneDepuisPayload(JSON.stringify({ slug: 'x' })).ok).toBe(false)
    expect(ligneDepuisPayload('null').ok).toBe(false)
  })
})

describe('DelaiFerie → EntreeCalendrier', () => {
  const LIGNES_FERIES = CALENDRIER_V1 as unknown as LigneDelaiFerie[]

  it('les 21 lignes du calendrier v1 se relisent, et le type d’entrée est conservé', () => {
    const conversion = versCalendrier(LIGNES_FERIES)
    expect(conversion.ok).toBe(true)
    if (!conversion.ok) return
    expect(conversion.valeur.length).toBe(CALENDRIER_V1.length)
    expect(conversion.valeur.filter((e) => e.typeEntree === 'PERMANENT').length).toBe(16)
    expect(conversion.valeur.filter((e) => e.typeEntree === 'A_SURVEILLER').length).toBe(5)
  })

  it('une source vide est refusée — c’est la règle qui empêche que la liste redevienne une opinion', () => {
    const c = versEntreeCalendrier({ ...LIGNES_FERIES[0], source: '   ' })
    expect(c.ok).toBe(false)
  })

  it('une fête mobile sans décalage admis, ou fixe sans date, est refusée : on ne la sait pas dater', () => {
    expect(versEntreeCalendrier({ ...LIGNES_FERIES[0], mobile: true, offsetPaques: null }).ok).toBe(false)
    expect(versEntreeCalendrier({ ...LIGNES_FERIES[0], mobile: true, offsetPaques: -45 }).ok).toBe(false)
    expect(versEntreeCalendrier({ ...LIGNES_FERIES[0], mobile: false, mois: null, jour: null }).ok).toBe(false)
    expect(versEntreeCalendrier({ ...LIGNES_FERIES[0], mobile: false, mois: 2, jour: 30 }).ok).toBe(false)
  })

  it('une date d’application qui n’est pas une date ISO est refusée', () => {
    expect(versEntreeCalendrier({ ...LIGNES_FERIES[0], appliqueDepuis: '22/06/1989' }).ok).toBe(false)
  })

  it('UNE seule ligne illisible fait échouer la version ENTIÈRE — un calendrier amputé donne des dates trop précoces', () => {
    const abimees = [...LIGNES_FERIES]
    abimees[3] = { ...abimees[3], source: '' }
    expect(versCalendrier(abimees).ok).toBe(false)
  })

  it('une traduction absente retombe sur le français, elle ne rend pas une chaîne vide', () => {
    const c = versEntreeCalendrier({ ...LIGNES_FERIES[0], libelleEn: '', libelleHt: '' })
    expect(c.ok).toBe(true)
    if (c.ok) {
      expect(c.valeur.libelleEn).toBe(LIGNES_FERIES[0].libelleFr)
      expect(c.valeur.libelleHt).toBe(LIGNES_FERIES[0].libelleFr)
    }
  })
})
