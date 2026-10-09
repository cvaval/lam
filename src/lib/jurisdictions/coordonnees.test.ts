import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildContactPlan, contactSeedSchema, diffContacts, formatPhone, normalizePhone, readPhones,
  type ContactSeed, type NotaryRef,
} from './coordonnees'
import { buildNotaryPlan, communeRefsFromImportPlan, notarySeedSchema } from './notaires-plan'
import { seedSchema } from './seed-schema'
import { buildImportPlan, type GeoCorrespondence } from './import-plan'

/**
 * Les coordonnées des cinq premières études (communiquées par Me Vaval le 9 oct. 2026), sur
 * les FICHIERS RÉELS : l'amorçage des coordonnées et les entrées telles que l'import du MJSP
 * les écrit en base.
 */
const racine = resolve(__dirname, '../../..')
const lire = (p: string) => readFileSync(resolve(racine, p), 'utf8')
const brut = JSON.parse(lire('data/judicial-map/notaires-coordonnees-v1.json'))
const fraisSeed = (): ContactSeed => contactSeedSchema.parse(structuredClone(brut))
const carte = seedSchema.parse(JSON.parse(lire('data/judicial-map/seed-v1.json')))
const geo = (JSON.parse(lire('public/maps/hti/metadata.json')) as { communeCorrespondence: GeoCorrespondence[] }).communeCorrespondence
const notaires = buildNotaryPlan(
  notarySeedSchema.parse(JSON.parse(lire('data/judicial-map/notaires-mjsp-v1.json'))),
  communeRefsFromImportPlan(buildImportPlan(carte, geo)),
).rows
const refs: NotaryRef[] = notaires.map((n) => ({ id: n.id, fullName: n.fullName, active: n.active }))
const plan = buildContactPlan(fraisSeed(), refs)
const bloquants = (p = plan) => p.anomalies.filter((a) => a.level === 'BLOQUANT').map((a) => a.message)
const fiche = (ordinal: number) => plan.rows.find((r) => r.notaryId === `mjsp-2026-09-08-${ordinal}`)!

describe('téléphones', () => {
  it('normalisés en E.164, quel que soit le découpage reçu', () => {
    expect(normalizePhone('+509 2998-47-47')).toBe('+50929984747')
    expect(normalizePhone('+509 4643-05-03')).toBe('+50946430503')
    expect(normalizePhone('+509 2942-3848')).toBe('+50929423848')
    expect(normalizePhone('(509) 2813 1299')).toBe('+50928131299')
    expect(normalizePhone('2940-4134')).toBe('+50929404134')
  })
  it('un seul format affiché : « +509 XXXX-XXXX »', () => {
    expect(formatPhone('+50929984747')).toBe('+509 2998-4747')
  })
  it('jamais deviné : 7 ou 9 chiffres, un autre indicatif, du texte ⇒ refusé', () => {
    expect(normalizePhone('+509 2942-384')).toBeNull()
    expect(normalizePhone('+509 2942-38481')).toBeNull()
    expect(normalizePhone('+1 305 555 0101')).toBeNull()
    expect(normalizePhone('non communiqué')).toBeNull()
  })
  it('lecture tolérante de phonesJson', () => {
    expect(readPhones('["+50929423848","n’importe quoi"]')).toEqual(['+50929423848'])
    expect(readPhones('pas du JSON')).toEqual([])
  })
})

describe('les cinq fiches du 9 octobre', () => {
  it('aucun constat bloquant', () => {
    expect(bloquants()).toEqual([])
    expect(plan.rows.map((r) => r.notaryId)).toEqual([
      'mjsp-2026-09-08-9', 'mjsp-2026-09-08-11', 'mjsp-2026-09-08-13', 'mjsp-2026-09-08-17', 'mjsp-2026-09-08-21',
    ])
  })
  it('n° 9 (Gemma ANGLADE GILLES) : deux numéros, normalisés', () => {
    expect(JSON.parse(fiche(9).phonesJson)).toEqual(['+50929984747', '+50946430503'])
    expect(fiche(9).email).toBe('etudeanglade@gmail.com')
  })
  it('n° 21 : sur l’entrée de Port-au-Prince, pas de téléphone, « Théodule », courriel tel quel', () => {
    expect(fiche(21).address).toBe('#3, rue Théodule, Bourdon, Port-au-Prince')
    expect(JSON.parse(fiche(21).phonesJson)).toEqual([])
    expect(fiche(21).email).toBe('Contact@etudegilbertgiordani.net')
    expect(plan.rows.some((r) => r.notaryId === 'mjsp-2026-09-08-37')).toBe(false)
  })
  it('n° 13 : adresse reproduite telle quelle, sans commune ajoutée', () => {
    expect(fiche(13).address).toBe('390, ave John Brown, Bourdon')
  })
  it('provenance enregistrée, date « à jour au »', () => {
    expect(JSON.parse(fiche(21).sourceJson)).toMatchObject({ providedBy: 'Me Christelle Vaval', providedOn: '2026-10-09' })
    expect(fiche(11).upToDateOn.toISOString().slice(0, 10)).toBe('2026-10-09')
  })
})

describe('garde-fous', () => {
  it('un nom attendu qui ne correspond plus à l’entrée BLOQUE (décalage de numéros)', () => {
    const s = fraisSeed()
    s.entries[1] = { ...s.entries[1], notaryId: 'mjsp-2026-09-08-12' }
    expect(bloquants(buildContactPlan(s, refs)).some((m) => m.includes('la fiche attend « Patrick VICTOR »'))).toBe(true)
  })
  it('l’entrée retirée n° 37 BLOQUE', () => {
    const s = fraisSeed()
    s.entries[4] = { ...s.entries[4], notaryId: 'mjsp-2026-09-08-37' }
    expect(bloquants(buildContactPlan(s, refs)).some((m) => m.includes('RETIRÉE'))).toBe(true)
  })
  it('un numéro illisible BLOQUE', () => {
    const s = fraisSeed()
    s.entries[1] = { ...s.entries[1], phones: ['2942-384'] }
    expect(bloquants(buildContactPlan(s, refs)).some((m) => m.includes('illisible'))).toBe(true)
  })
  it('un courriel mal formé BLOQUE', () => {
    const s = fraisSeed()
    s.entries[1] = { ...s.entries[1], email: 'patrickvictor@' }
    expect(bloquants(buildContactPlan(s, refs)).some((m) => m.includes('mal formé'))).toBe(true)
  })
  it('une fiche sans aucune coordonnée BLOQUE', () => {
    const s = fraisSeed()
    s.entries[1] = { ...s.entries[1], address: null, phones: [], email: null }
    expect(bloquants(buildContactPlan(s, refs)).some((m) => m.includes('aucune coordonnée'))).toBe(true)
  })
  it('deux fiches pour la même entrée BLOQUENT', () => {
    const s = fraisSeed()
    s.entries.push(s.entries[0])
    expect(bloquants(buildContactPlan(s, refs)).some((m) => m.includes('deux fiches'))).toBe(true)
  })
})

describe('plan d’import : idempotence, aucune suppression', () => {
  it('base vide ⇒ 5 créations ; second passage ⇒ 5 inchangées', () => {
    expect(diffContacts(plan.rows, []).create).toHaveLength(5)
    const base = plan.rows.map((r) => ({ ...r, upToDateOn: new Date(r.upToDateOn), createdAt: new Date() }))
    const d = diffContacts(buildContactPlan(fraisSeed(), refs).rows, base)
    expect([d.create.length, d.update.length, d.unchanged]).toEqual([0, 0, 5])
  })
  it('une fiche en base absente du fichier est SIGNALÉE, jamais retirée', () => {
    const d = diffContacts(plan.rows, [...plan.rows, { ...plan.rows[0], id: 'contact-mjsp-2026-09-08-999' }])
    expect(d.orphans).toEqual(['contact-mjsp-2026-09-08-999'])
  })
})
