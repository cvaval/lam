/**
 * Périmètre de la section « Législation annotée ».
 *
 * Défaut signalé par la rédaction le 17 août 2026 : des ARRÊTS s'affichaient dans la
 * navigation par thèmes de la Législation annotée. Le filtre ne portait que sur l'ACCÈS de
 * l'utilisateur — or l'accès dit ce qu'on a le DROIT de lire, jamais ce qu'une section DOIT
 * montrer. Un membre du personnel, qui a droit à tout, voyait donc tout.
 */
import { describe, it, expect } from 'vitest'
import { typesDeLaSection, TYPES_LEGISLATION_ANNOTEE } from './themes'

const staff = { role: 'MASTER_ADMIN', services: [] } as never
const avocat = { role: 'PRO', services: ['LEGISLATION', 'JURISPRUDENCE'] } as never

describe('périmètre de la Législation annotée', () => {
  it('la jurisprudence n’y figure pas — elle a sa propre rubrique', () => {
    expect(TYPES_LEGISLATION_ANNOTEE).not.toContain('JURISPRUDENCE')
    expect(typesDeLaSection(staff)).not.toContain('JURISPRUDENCE')
  })

  it('le personnel, qui a droit à TOUT, ne voit ici que le corpus de la section', () => {
    // C'est le cœur du défaut : avoir le droit de tout lire ne fait pas tout apparaître ici.
    expect(typesDeLaSection(staff).sort()).toEqual(['CIRCULAIRE_BRH', 'DOCTRINE', 'LEGISLATION'])
  })

  it('un abonné ne voit que l’intersection de son accès et du périmètre', () => {
    // Il a droit à la jurisprudence, mais pas ICI ; et pas aux circulaires, donc pas ici non plus.
    expect(typesDeLaSection(avocat)).toEqual(['LEGISLATION'])
  })

  it('la législation et la doctrine sont le cœur de la section', () => {
    expect(TYPES_LEGISLATION_ANNOTEE).toContain('LEGISLATION')
    expect(TYPES_LEGISLATION_ANNOTEE).toContain('DOCTRINE')
  })
})
