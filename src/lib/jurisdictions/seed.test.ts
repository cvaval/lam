import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { seedSchema, validateSeed, type JudicialSeed } from './seed-schema'
import { buildImportPlan } from './import-plan'

const raw = JSON.parse(readFileSync(resolve(__dirname, '../../../data/judicial-map/seed-v1.json'), 'utf8'))

function freshSeed(): JudicialSeed {
  return seedSchema.parse(raw)
}

describe('référentiel d’amorçage (fichier réel du dépôt)', () => {
  it('valide au schéma Zod, zéro constat bloquant', () => {
    const seed = freshSeed()
    const anomalies = validateSeed(seed)
    expect(anomalies.filter((a) => a.level === 'BLOQUANT')).toHaveLength(0)
  })

  it('comptes de référence exacts', () => {
    const seed = freshSeed()
    expect(seed.departments).toHaveLength(10)
    expect(seed.communes).toHaveLength(149)
    expect(seed.postalCodes).toHaveLength(149)
    expect(seed.courts.firstInstance).toHaveLength(23)
    expect(seed.tpiJurisdictions).toHaveLength(149)
    expect(seed.courts.peace).toHaveLength(185)
    expect(seed.courts.appeal).toHaveLength(5)
    expect(seed.courts.cassation).toHaveLength(1)
  })

  it('un décompte falsifié est REFUSÉ', () => {
    const seed = freshSeed()
    seed.courts.peace.pop()
    const blocking = validateSeed(seed).filter((a) => a.level === 'BLOQUANT')
    expect(blocking.length).toBeGreaterThan(0)
    expect(blocking.some((a) => a.message.includes('peaceCourts'))).toBe(true)
  })

  it('une clé communale dupliquée est REFUSÉE', () => {
    const seed = freshSeed()
    seed.communes[1].key = seed.communes[0].key
    expect(validateSeed(seed).some((a) => a.level === 'BLOQUANT' && a.message.includes('dupliquée'))).toBe(true)
  })
})

describe('plan d’import', () => {
  const seed = freshSeed()
  const plan = buildImportPlan(seed, [])

  it('Port-au-Prince : TROIS tribunaux de paix distincts, jamais regroupés', () => {
    const pap = 'commune-ouest-port-au-prince'
    const paix = plan.jurisdictions.filter((j) => j.communeId === pap && j.relationship === 'PAIX_LOCAL')
    expect(paix).toHaveLength(3)
    const names = paix.map((j) => plan.courts.find((c) => c.id === j.courtId)?.name).sort()
    expect(names).toEqual(['Tribunal de paix — Section Est', 'Tribunal de paix — Section Nord', 'Tribunal de paix — Section Sud'])
    // aucune ligne générique du type « Tribunaux de paix de la ville »
    expect(names.some((n) => /tribunaux/i.test(n ?? ''))).toBe(false)
  })

  it('chaque commune a un TPI, une cour d’appel et le recours national', () => {
    for (const c of plan.communes) {
      const rel = plan.jurisdictions.filter((j) => j.communeId === c.id).map((j) => j.relationship)
      expect(rel).toContain('TPI_COMPETENT')
      expect(rel).toContain('APPEL_COMPETENT')
      expect(rel).toContain('CASSATION_NATIONALE')
    }
  })

  it('les sièges UNMAPPED existent comme juridictions mais SANS rattachement communal', () => {
    // Ils étaient dix. Huit ont été rattachés par déduction du code postal de leur
    // section (voir data/judicial-map/rapport-unmapped.md) ; CORRIDON et HATTE CHEVREAU
    // restent introuvables au répertoire, donc hors publication.
    const unmapped = plan.courts.filter((c) => c.verificationStatus === 'UNMAPPED')
    expect(unmapped.map((c) => c.name).sort()).toEqual([
      'Tribunal de paix — CORRIDON',
      'Tribunal de paix — HATTE CHEVREAU',
    ])
    const linked = new Set(plan.jurisdictions.map((j) => j.courtId))
    for (const c of unmapped) expect(linked.has(c.id)).toBe(false)
  })

  it('les 8 sièges résolus sont CORROBORATED, rattachés, et gardent leur ressort CSPJ', () => {
    // Le rattachement postal doit tomber dans le ressort que le CSPJ inscrivait déjà au
    // siège : c'est ce recoupement, et non le seul code, qui fonde la résolution.
    const attendu: Record<string, string> = {
      'Tribunal de paix — DAMASSIN': 'Les Côteaux',
      'Tribunal de paix — CAHOUANE': 'Tiburon',
      'Tribunal de paix — RENDEL': 'Chardonnières',
      'Tribunal de paix — GROSSE ROCHE': 'Vallières',
      'Tribunal de paix — BOIS DE LAURENCE': 'Mombin-Crochu',
      'Tribunal de paix — ACUL SAMEDI': 'Fort-Liberté',
      'Tribunal de paix — BANANE': 'Anse-à-Pitres',
      'Tribunal de paix — SAVANNE A ROCHE': 'Petite-Rivière-de-l’Artibonite',
    }
    const parId = new Map(plan.communes.map((c) => [c.id, c.name]))
    for (const [nom, commune] of Object.entries(attendu)) {
      const cour = plan.courts.find((c) => c.name === nom)
      expect(cour, nom).toBeDefined()
      expect(cour!.verificationStatus, nom).toBe('CORROBORATED')
      // Sans adresse vérifiée, la position ne peut être que le centroïde communal.
      expect(cour!.locationPrecision, nom).toBe('COMMUNE_CENTROID')
      const lien = plan.jurisdictions.find((j) => j.courtId === cour!.id && j.relationship === 'PAIX_LOCAL')
      expect(lien, nom).toBeDefined()
      expect(parId.get(lien!.communeId), nom).toBe(commune)
    }
  })

  it('la Cour de cassation est NATIONALE, adresse et Plus Code distincts', () => {
    const cass = plan.courts.find((c) => c.type === 'CASSATION')!
    expect(cass.scope).toBe('NATIONAL')
    expect(cass.address).toContain('Rue Mgr Guilloux')
    expect(cass.postalCode).toBe('HT6110')
    expect(cass.plusCode).toBe('GMV6+X9W')
    expect(cass.plusCode).not.toBe(cass.postalCode)
    expect(cass.latitude).toBeCloseTo(18.5449768, 5)
  })

  it('codes postaux : 149 principaux + compléments, PAP domine avec HT6110', () => {
    const primaries = plan.postalCodes.filter((p) => p.isPrimary)
    expect(primaries).toHaveLength(149)
    const pap = plan.postalCodes.filter((p) => p.communeId === 'commune-ouest-port-au-prince')
    expect(pap.find((p) => p.isPrimary)?.code).toBe('HT6110')
    expect(pap.filter((p) => !p.isPrimary).map((p) => p.code)).toEqual(
      ['HT6111', 'HT6112', 'HT6113', 'HT6114', 'HT6115', 'HT6116', 'HT6117', 'HT6118', 'HT6119'],
    )
  })

  it('aucune coordonnée inventée : seuls les points documentés en portent', () => {
    const withCoords = plan.courts.filter((c) => c.latitude != null)
    expect(withCoords).toHaveLength(1) // la Cour de cassation, seule vérifiée
    expect(withCoords[0].type).toBe('CASSATION')
  })

  it('centroïdes appliqués uniquement quand la correspondance cartographique les fournit', () => {
    const withGeo = buildImportPlan(seed, [
      { lamId: 'commune-sud-est-jacmel', adm2_pcode: 'HT0211', aliasKreyol: 'Jakmèl', centroidLat: 18.23, centroidLng: -72.53 },
    ])
    const jacmel = withGeo.communes.find((c) => c.id === 'commune-sud-est-jacmel')!
    expect(jacmel.centroidLat).toBeCloseTo(18.23)
    expect(jacmel.geometryKey).toBe('HT0211')
    expect(JSON.parse(jacmel.aliasesJson)).toContain('Jakmèl')
    const autres = withGeo.communes.filter((c) => c.id !== 'commune-sud-est-jacmel')
    for (const c of autres) expect(c.centroidLat).toBeNull()
  })
})
