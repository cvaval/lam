import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import JSZip from 'jszip'
import { buildLegislationDocx } from './word'
import { parseAnnotations } from './annotated'
import { parseRichBlocks } from '@/lib/doc/richblocks'

/**
 * La version Word se génère du TEXTE OFFICIEL de la fiche (le Code fiscal 2026 tel que versé),
 * pas du .docx transmis : on y retrouve donc les formes du Journal officiel que la collation a
 * rétablies (« Article129.- », « Article 296. » sans tiret, « (1/2%) »), et non celles de la
 * transcription.
 */
const DIR = join(__dirname, '../../../scripts/data/code-fiscal-2026')
const annotations = parseAnnotations(readFileSync(join(DIR, 'annotations.json'), 'utf8'))!
const rich = parseRichBlocks(readFileSync(join(DIR, 'rich.json'), 'utf8'))
const body = readFileSync(join(DIR, 'bodyOriginal.txt'), 'utf8')

describe('Version Word de la Législation annotée', () => {
  it('le .docx porte le texte du J.O., ses 9 tableaux, la mention légale et les notes', async () => {
    const buf = await buildLegislationDocx({
      titleFr: 'Décret remplaçant le Décret du 19 décembre 2022 portant Code Fiscal',
      number: 'Décret du 30 septembre 2026 remplaçant le Décret du 19 décembre 2022 portant Code Fiscal',
      moniteurRef: 'Le Moniteur, 181ᵉ Année – Spécial N° 48-A, mercredi 30 septembre 2026',
      body,
      annotations,
      rich,
      downloaderEmail: 'test@example.org',
      locale: 'fr',
    })
    const zip = await JSZip.loadAsync(buf)
    const xml = await zip.file('word/document.xml')!.async('string')
    const texte = xml.replace(/<[^>]+>/g, '')
    expect((xml.match(/<w:tbl>/g) ?? []).length).toBe(9)
    expect(texte).toContain('Article129.-')
    expect(texte).toContain('Article 296.')
    expect(texte).not.toContain('Article 296.-')
    expect(texte).toContain('(1/2%)')
    expect(texte).toContain('De 21 à moins 31 ans révolus')
    expect(texte).toContain('Pr. Vijonet DEMERO')
    expect(texte).toContain('aucun article 294 n’y est imprimé')
    expect(texte).not.toContain(' | ') // aucune rangée aplatie
    const pied = Object.keys(zip.files).filter((f) => f.startsWith('word/footer'))
    expect(pied.length).toBeGreaterThan(0)
    expect(await zip.file(pied[0])!.async('string')).toContain('test@example.org')
  })
})
