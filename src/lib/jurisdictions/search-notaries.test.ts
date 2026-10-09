import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildNotaryIndex, searchNotaries } from './search-notaries'
import { buildNotaryPlan, communeRefsFromImportPlan, notarySeedSchema } from './notaires-plan'
import { seedSchema } from './seed-schema'
import { buildImportPlan, type GeoCorrespondence } from './import-plan'

/**
 * Recherche d'un notaire par son nom, sur les 423 entrées RÉELLES (telles que l'import les
 * écrit en base) : chaque ligne de la table de la spécification est vérifiée.
 */
const racine = resolve(__dirname, '../../..')
const lire = (p: string) => readFileSync(resolve(racine, p), 'utf8')
const carte = seedSchema.parse(JSON.parse(lire('data/judicial-map/seed-v1.json')))
const geo = (JSON.parse(lire('public/maps/hti/metadata.json')) as { communeCorrespondence: GeoCorrespondence[] }).communeCorrespondence
const communes = communeRefsFromImportPlan(buildImportPlan(carte, geo))
const nomCommune = new Map(communes.map((c) => [c.id, c.name]))
const rows = buildNotaryPlan(notarySeedSchema.parse(JSON.parse(lire('data/judicial-map/notaires-mjsp-v1.json'))), communes).rows
const index = buildNotaryIndex(rows.filter((r) => r.active).map((r) => ({
  id: r.id,
  name: r.displayName ?? r.fullName,
  printedName: r.displayName ? r.fullName : null,
  mention: r.mention,
  communeId: r.communeId,
  communeName: r.communeId ? nomCommune.get(r.communeId) ?? null : null,
  aliases: [],
  hasContact: false,
})))
const n = (ordinal: number) => `mjsp-2026-09-08-${ordinal}`
const ids = (q: string) => searchNotaries(index, q).map((h) => h.id)

describe('recherche par nom — la table de la spécification', () => {
  it('« Patrick Victor », « victor » ⇒ n° 11', () => {
    expect(ids('Patrick Victor')).toEqual([n(11)])
    expect(ids('victor')).toEqual([n(11)])
  })
  it('« Giordani » ⇒ n° 2 et n° 21, jamais n° 37 (retiré)', () => {
    expect(ids('Giordani').sort()).toEqual([n(2), n(21)].sort())
  })
  it('« Ceant », « céant », « CEANT » ⇒ n° 13 (accents et casse neutralisés)', () => {
    for (const q of ['Ceant', 'céant', 'CEANT']) expect(ids(q), q).toEqual([n(13)])
  })
  it('« Marilyn Charles » ⇒ n° 17 seul, parmi les CHARLES', () => {
    expect(ids('Marilyn Charles')).toEqual([n(17)])
    expect(ids('Charles').length).toBeGreaterThan(10)
    expect(ids('Charles')).toContain(n(17))
  })
  it('« Gemma », « Gamma », « Gemma Anglade » ⇒ n° 9, affiché « Gemma ANGLADE GILLES »', () => {
    for (const q of ['Gemma', 'Gamma', 'Gemma Anglade']) expect(ids(q)[0], q).toBe(n(9))
    expect(searchNotaries(index, 'Gemma')[0].name).toBe('Gemma ANGLADE GILLES')
  })
  it('« Anglade » ⇒ n° 9 et n° 113 (Anglade GABEAUD)', () => {
    expect(ids('Anglade').sort()).toEqual([n(9), n(113)].sort())
  })
  it('« Saint-Louis » ⇒ n° 385 (Saint-Louis CHARLES)', () => {
    expect(ids('Saint-Louis')).toContain(n(385))
  })
  it('« PDD » ⇒ aucun notaire : la mention n’est pas un nom', () => {
    expect(ids('PDD')).toEqual([])
  })
  it('saisie au fil de la frappe : le dernier mot peut n’être qu’un début', () => {
    expect(ids('Patrick Vic')).toEqual([n(11)])
  })
  it('requête vide ou d’une lettre ⇒ rien', () => {
    expect(ids('')).toEqual([])
    expect(ids('a')).toEqual([])
  })
  it('les suggestions ne portent aucune coordonnée', () => {
    const h = searchNotaries(index, 'Victor')[0]
    expect(Object.keys(h).sort()).toEqual(['aliases', 'communeId', 'communeName', 'hasContact', 'id', 'mention', 'name', 'printedName', 'score'])
  })
})
