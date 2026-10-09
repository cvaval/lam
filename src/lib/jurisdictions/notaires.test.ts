import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mentionAsPrinted, parseMjspText, splitCommuneOverflow, splitMention } from './notaires-source'
import {
  buildNotaryPlan, communeRefsFromImportPlan, diffNotaries, notarySeedSchema, type CommuneRef, type NotarySeed,
} from './notaires-plan'
import { seedSchema } from './seed-schema'
import { buildImportPlan, type GeoCorrespondence } from './import-plan'

/**
 * La liste des notaires du MJSP, de bout en bout, sur les FICHIERS RÉELS du dépôt : le texte
 * `pdftotext -layout` de l'export du 9 oct. 2026, l'amorçage qui en est tiré, et le
 * référentiel de la carte (seed-v1.json + metadata.json). Chaque chiffre de la spécification
 * est refait ici ; un écart arrête l'import, il doit aussi arrêter les tests.
 */
const racine = resolve(__dirname, '../../..')
const lire = (p: string) => readFileSync(resolve(racine, p), 'utf8')
const texte = lire('scripts/data/notaires-mjsp/liste-mjsp-2026-10-09.txt')
const brut = JSON.parse(lire('data/judicial-map/notaires-mjsp-v1.json'))
const fraisSeed = (): NotarySeed => notarySeedSchema.parse(structuredClone(brut))
const carte = seedSchema.parse(JSON.parse(lire('data/judicial-map/seed-v1.json')))
const geo = (JSON.parse(lire('public/maps/hti/metadata.json')) as { communeCorrespondence: GeoCorrespondence[] }).communeCorrespondence
const communes = (): CommuneRef[] => communeRefsFromImportPlan(buildImportPlan(carte, geo))
const plan = buildNotaryPlan(fraisSeed(), communes())
const bloquants = (p = plan) => p.anomalies.filter((a) => a.level === 'BLOQUANT').map((a) => a.message)
const row = (n: number) => plan.rows.find((r) => r.ordinal === n)!
const nomCommune = new Map(communes().map((c) => [c.id, c.name]))

describe('lecture du texte du MJSP', () => {
  const p = parseMjspText(texte)

  it('423 entrées numérotées de 1 à 423, sans trou ni doublon ; 423 annoncées', () => {
    expect(p.announced).toBe(423)
    expect(p.entries).toHaveLength(423)
    expect(p.entries.map((e) => e.ordinal)).toEqual(Array.from({ length: 423 }, (_, i) => i + 1))
    expect(p.rejected).toEqual([])
  })

  it('colonne « Département » telle qu’imprimée (et FAUSSE en géographie)', () => {
    const n: Record<string, number> = {}
    for (const e of p.entries) n[e.department] = (n[e.department] ?? 0) + 1
    expect(n).toEqual({
      Ouest: 113, Nord: 69, Sud: 45, Nippes: 44, 'Sud-Est': 36, Centre: 36,
      "Grand'Anse": 22, 'Nord-Est': 22, 'Nord-Ouest': 19, Artibonite: 17,
    })
  })

  it('126 communes distinctes ; les plus fournies', () => {
    const n = new Map<string, number>()
    for (const e of p.entries) n.set(e.commune, (n.get(e.commune) ?? 0) + 1)
    expect(n.size).toBe(126)
    expect([n.get('PORT-AU-PRINCE'), n.get('GONAIVES'), n.get('CAP-HAITIEN'), n.get('CAYES'), n.get('JACMEL')]).toEqual([21, 14, 13, 13, 12])
  })

  it('ordre des alternatives : « Nord-Ouest » n’est jamais lu « Nord »', () => {
    const e = parseMjspText(' 1     Jean TEST                 Nord-Ouest    PORT-DE-PAIX').entries[0]
    expect(e.department).toBe('Nord-Ouest')
    expect(e.commune).toBe('PORT-DE-PAIX')
  })

  it('les quatre « (PDD) » de la colonne Commune sont LUS — un motif mal échappé les perdait', () => {
    const debord = p.entries.filter((e) => splitCommuneOverflow(e.commune).overflow)
    expect(debord.map((e) => e.ordinal)).toEqual([167, 168, 169, 170])
    expect(splitCommuneOverflow('GRANDE RIVIERE DU NORD (PDD)')).toEqual({ commune: 'GRANDE RIVIERE DU NORD', overflow: 'PDD' })
  })

  it('le marqueur se détache du nom sans interprétation', () => {
    expect(splitMention('Mme Rolès DONATIEN (PDD)')).toEqual({ fullName: 'Mme Rolès DONATIEN', mention: 'PDD' })
    expect(splitMention('Jacques VINCENT PD/CMM')).toEqual({ fullName: 'Jacques VINCENT', mention: 'PD/CMM' })
    expect(splitMention('Guy Mario GAY')).toEqual({ fullName: 'Guy Mario GAY', mention: null })
    expect(mentionAsPrinted('PDD')).toBe('(PDD)')
    expect(mentionAsPrinted('PD/CMM')).toBe('PD/CMM')
  })

  it('« (PDD) » suit 107 noms, plus les 4 débordements ; « PD/CMM » un seul (n° 338)', () => {
    expect(plan.report.mentions.PDD).toBe(107)
    expect(plan.report.mentions.columnOverflow).toHaveLength(4)
    expect(plan.report.mentions['PD/CMM']).toBe(1)
    expect(row(338)).toMatchObject({ fullName: 'Jacques VINCENT', mention: 'PD/CMM' })
    // Les quatre débordements portent AUSSI « (PDD) » dans la colonne du nom : ils sont parmi
    // les 107. Le marqueur de colonne est la 108e à 111e occurrence imprimée, pas un 108e notaire.
    expect(plan.rows.filter((r) => r.mention === 'PDD')).toHaveLength(107)
    for (const n of [167, 168, 169, 170]) expect(row(n).fullName).not.toContain('PDD')
  })

  it('l’amorçage du dépôt est bien tiré de ce texte (aucune entrée retouchée à la main)', () => {
    expect(fraisSeed().entries).toEqual(p.entries)
  })
})

describe('appariement des communes : liste fermée', () => {
  it('aucun constat bloquant sur les fichiers réels', () => {
    expect(bloquants()).toEqual([])
  })

  it('110 communes se reconnaissent d’elles-mêmes, 15 par alias déclaré, 1 non reconnue', () => {
    expect(plan.report.sourceCommunes).toBe(126)
    expect(plan.report.direct).toBe(110)
    expect(plan.report.aliasesUsed).toHaveLength(15)
    expect(plan.report.aliasesUsed.every((a) => a.entries > 0)).toBe(true)
    expect(plan.report.unresolved).toEqual([{ source: 'PETIT-BOURG DE PORT MARGOT', ordinals: [154] }])
    expect(plan.report.matchedCommunes).toBe(125)
  })

  it('Petit-Bourg-de-Port-Margot (n° 154) reste SANS commune, signalé', () => {
    expect(row(154).communeId).toBeNull()
    expect(row(154).observation).toMatch(/non reconnue/)
    expect(plan.report.placedEntries).toBe(422)
  })

  it('les « (PDD) » de colonne s’apparient à Grande-Rivière-du-Nord, la mention conservée', () => {
    for (const n of [167, 168, 169, 170]) {
      expect(nomCommune.get(row(n).communeId!)).toBe('Grande-Rivière-du-Nord')
      expect(row(n).mention).toBe('PDD')
      expect(row(n).sourceCommune).toBe('GRANDE RIVIERE DU NORD (PDD)')
      expect(row(n).observation).toMatch(/débordement de colonne/)
    }
  })

  it('un alias INUTILE bloque l’import (erreur de saisie)', () => {
    const s = fraisSeed()
    s.communeAliases.push({ source: 'PORT-AU-PRINCE', communeId: 'commune-ouest-port-au-prince', communeName: 'Port-au-Prince' })
    expect(bloquants(buildNotaryPlan(s, communes())).some((m) => /inutile/.test(m))).toBe(true)
  })

  it('un alias jamais consommé bloque l’import', () => {
    const s = fraisSeed()
    s.communeAliases.push({ source: 'VILLE FANTOME', communeId: 'commune-ouest-port-au-prince', communeName: 'Port-au-Prince' })
    expect(bloquants(buildNotaryPlan(s, communes())).some((m) => /jamais consommé/.test(m))).toBe(true)
  })

  it('un alias dont le nom ne correspond pas à la commune visée bloque l’import', () => {
    const s = fraisSeed()
    s.communeAliases[0] = { ...s.communeAliases[0], communeName: 'Autre nom' }
    expect(bloquants(buildNotaryPlan(s, communes())).some((m) => /s’appelle/.test(m))).toBe(true)
  })

  it('une commune nouvelle, ni reconnue ni déclarée, bloque l’import (jamais de flou silencieux)', () => {
    const s = fraisSeed()
    s.entries[0] = { ...s.entries[0], commune: 'PORT AU PRINS' }
    expect(bloquants(buildNotaryPlan(s, communes())).some((m) => /introuvable/.test(m))).toBe(true)
  })
})

describe('deux autorités : le référentiel place, la liste est consignée', () => {
  it('33 désaccords de département, exactement ceux de la spécification', () => {
    const groupe = new Map<string, number>()
    for (const d of plan.report.disagreements) {
      const k = `${d.printed}→${d.actual}`
      groupe.set(k, (groupe.get(k) ?? 0) + 1)
    }
    expect(plan.report.disagreements).toHaveLength(33)
    expect(Object.fromEntries(groupe)).toEqual({ 'Nippes→Artibonite': 23, 'Sud-Est→Sud': 8, "Grand'Anse→Artibonite": 1, 'Sud→Artibonite': 1 })
    const parCommune = (printed: string) => {
      const m: Record<string, number> = {}
      for (const d of plan.report.disagreements.filter((x) => x.printed === printed)) m[d.commune] = (m[d.commune] ?? 0) + 1
      return m
    }
    expect(parCommune('Nippes')).toEqual({ 'Les Gonaïves': 14, 'Saint-Michel-de-l’Attalaye': 3, 'Gros-Morne': 3, Marmelade: 2, Ennery: 1 })
    expect(parCommune('Sud-Est')).toEqual({ Tiburon: 2, 'Roche-à-Bateau': 2, 'Les Anglais': 1, 'Port-à-Piment': 1, Chardonnières: 1, 'Les Côteaux': 1 })
  })

  it('la colonne imprimée reste telle quelle ; le désaccord est consigné', () => {
    const gonaives = plan.rows.filter((r) => r.sourceCommune === 'GONAIVES')
    expect(gonaives).toHaveLength(14)
    for (const r of gonaives) {
      expect(r.sourceDepartment).toBe('Nippes')
      expect(r.communeId).toBe('commune-artibonite-les-gonaives')
      expect(r.observation).toMatch(/département imprimé « Nippes »/)
    }
  })

  it('aucun notaire apparié sans centroïde', () => {
    const sans = new Set(communes().filter((c) => !c.hasCentroid).map((c) => c.id))
    expect(plan.rows.filter((r) => r.communeId && sans.has(r.communeId))).toEqual([])
  })
})

describe('reproduire tel quel, et signaler', () => {
  it('six noms en double et la paire abrégée DURANDISSE : rien n’est fusionné', () => {
    const paires = plan.report.duplicates.map((d) => `${d.ordinals.join('/')}:${d.kind}`)
    expect(paires).toEqual([
      '21/37:exact', '45/91:exact', '48/81:exact', '102/111:exact', '103/107:abrégée', '140/164:exact', '142/338:exact',
    ])
    expect(plan.rows).toHaveLength(423)
    expect(row(140).fullName).toBe('Armand ZEPHIRIN')
    expect(row(164).fullName).toBe('Armand ZÉPHIRIN')
  })

  it('n° 37 (Cité Soleil) reste dans l’amorçage, INACTIF, avec la décision de la cliente', () => {
    expect(plan.report.inactive).toEqual([37])
    expect(row(37).active).toBe(false)
    expect(row(37).observation).toMatch(/retirée sur décision de la cliente — n’exerce qu’à Port-au-Prince \(n° 21\)/)
    const citeSoleil = plan.rows.filter((r) => r.communeId === row(37).communeId && r.active)
    expect(citeSoleil).toHaveLength(3)
  })

  it('civilités et coquilles reproduites, signalées, jamais corrigées', () => {
    expect(row(6).fullName).toBe('Alliette N . S . BALTHAZAR')
    expect(row(10).fullName.startsWith('Mrie ')).toBe(true)
    expect(row(266).fullName).toBe('Mme Rolès DONATIEN')
    expect(row(64).fullName).toBe('Jean Fitzner')
    for (const n of [6, 10, 24, 28, 64, 266, 271]) expect(row(n).observation, String(n)).toBeTruthy()
  })

  it('identifiant stable mjsp-<édition>-<n>', () => {
    expect(row(1).id).toBe('mjsp-2026-09-08-1')
    expect(new Set(plan.rows.map((r) => r.id)).size).toBe(423)
  })

  it('sourceJson porte l’URL, les DEUX téléchargements et leurs empreintes', () => {
    const s = JSON.parse(row(1).sourceJson)
    expect(s.url).toBe('https://www.mjsp.gouv.ht/page/notaires')
    expect(s.consultations.map((c: { date: string }) => c.date)).toEqual(['2026-09-08', '2026-10-09'])
    expect(s.consultations[1].sha256).toBe('cf0b0f15d2b78d30fab3ca28ae629167ffaaaedab5a0035885bdd444e9dc226e')
    expect(s.textIdenticalAcrossConsultations).toBe(true)
    expect(s.printed).toEqual({ ordinal: 1, name: 'Guy Mario GAY', department: 'Ouest', commune: 'PORT-AU-PRINCE' })
  })
})

describe('rattachement par juridiction — déduit, jamais stocké', () => {
  it('421 actifs placés, les 23 TPI pourvus, totaux de la spécification', () => {
    expect(plan.report.placedActive).toBe(421)
    expect(plan.report.tpiTotals).toHaveLength(23)
    expect(plan.report.tpiTotals.reduce((s, t) => s + t.notaries, 0)).toBe(421)
    const pap = plan.report.tpiTotals.find((t) => t.tpiId === 'court-tpi-tpi-de-port-au-prince')!
    expect([pap.notaries, pap.communes]).toEqual([57, 9])
  })

  it('par cour d’appel : 140 / 94 / 90 / 61 / 36', () => {
    expect(plan.report.appealTotals.map((a) => a.notaries)).toEqual([140, 94, 90, 61, 36])
  })

  it('24 communes sans notaire', () => {
    expect(plan.report.communesWithoutNotary).toHaveLength(24)
  })

  it('trois tailles de marqueur : 59 / 53 / 13 communes', () => {
    const t = plan.report.sizeClasses
    expect([t.small, t.medium, t.large]).toEqual([59, 53, 13])
    expect(t.largeCommunes.slice(0, 5)).toEqual([
      { name: 'Port-au-Prince', count: 21 }, { name: 'Les Gonaïves', count: 14 },
      { name: 'Cap-Haïtien', count: 13 }, { name: 'Les Cayes', count: 13 }, { name: 'Jacmel', count: 12 },
    ])
  })

  it('si les rattachements divergent de l’amorçage, l’import S’ARRÊTE', () => {
    // Delmas passe (fictivement) au TPI de la Croix-des-Bouquets : deux totaux bougent.
    const c = communes().map((x) => x.id === 'commune-ouest-delmas'
      ? { ...x, tpi: { id: 'court-tpi-tpi-de-la-croix-des-bouquets', name: 'TPI de la Croix-des-Bouquets' } }
      : x)
    const b = bloquants(buildNotaryPlan(fraisSeed(), c))
    expect(b.some((m) => m.startsWith('TPI court-tpi-tpi-de-port-au-prince : 50'))).toBe(true)
    expect(b.some((m) => m.startsWith('TPI court-tpi-tpi-de-la-croix-des-bouquets : 42'))).toBe(true)
  })

  it('un compte attendu faussé bloque l’import', () => {
    const s = fraisSeed()
    s.expected.departmentDisagreements = 32
    expect(bloquants(buildNotaryPlan(s, communes())).some((m) => /33 désaccords/.test(m))).toBe(true)
  })
})

describe('plan d’import : idempotence, aucune suppression', () => {
  it('base vide ⇒ 423 créations', () => {
    const d = diffNotaries(plan.rows, [])
    expect([d.create.length, d.update.length, d.unchanged, d.orphans.length]).toEqual([423, 0, 0, 0])
  })

  it('second passage ⇒ 0 création, 0 modification, 423 inchangées', () => {
    const base = plan.rows.map((r) => ({ ...r, createdAt: new Date(), updatedAt: new Date() }))
    const d = diffNotaries(buildNotaryPlan(fraisSeed(), communes()).rows, base)
    expect([d.create.length, d.update.length, d.unchanged]).toEqual([0, 0, 423])
  })

  it('une ligne en base absente du fichier est SIGNALÉE, jamais retirée', () => {
    const base = [...plan.rows, { ...plan.rows[0], id: 'mjsp-2026-09-08-999' }]
    const d = diffNotaries(plan.rows, base)
    expect(d.orphans).toEqual(['mjsp-2026-09-08-999'])
    expect(d).not.toHaveProperty('delete')
  })

  it('une modification de la source se voit comme une modification', () => {
    const base = plan.rows.map((r) => (r.ordinal === 5 ? { ...r, fullName: 'autre' } : r))
    expect(diffNotaries(plan.rows, base).update.map((r) => r.ordinal)).toEqual([5])
  })
})
