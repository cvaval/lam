/**
 * Garde-fous de la doctrine chromatique — avenant AV-04 (LAM-BRAND-2026-08-V3-AV04),
 * qui applique l'inversion des accents posée par l'AV-02 du 11 août 2026.
 *
 *   « Le rouge est la couleur de l'USAGE ; le jaune Sitwon est le trait du CERTIFICATEUR. »
 *
 * Ces contrôles existent parce que les « contrôles finaux » de la charte v3.0 déclaraient
 * « Wouj en fond : 0 » alors qu'il y en avait 32, et « 15 CTA en Sitwon » alors qu'il y en
 * avait 5. Un chiffre de conformité qu'aucun test ne rejoue est un chiffre qu'on croit.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function sources(dir = 'src', acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) sources(p, acc)
    else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e)) acc.push(p)
  }
  return acc
}
const FICHIERS = sources().map((p) => ({ p, s: readFileSync(p, 'utf8') }))

/** Occurrences d'un motif, avec leur fichier et leur ligne — pour que l'échec soit lisible. */
function releve(rx: RegExp): string[] {
  const out: string[] = []
  for (const { p, s } of FICHIERS) {
    s.split('\n').forEach((l, i) => {
      if (new RegExp(rx.source, rx.flags.replace('g', '')).test(l)) out.push(`${p}:${i + 1}`)
    })
  }
  return out
}

describe('AV-04 — rationnement des accents', () => {
  it('Sitwon n’est jamais une couleur de texte (1,46:1 sur Blan — illisible)', () => {
    expect(releve(/\btext-sitwon\b/)).toEqual([])
  })

  it('le focus est Chabon : aucun anneau coloré par un accent', () => {
    expect(releve(/\bring-(wouj|sitwon)\b/)).toEqual([])
  })

  it('aucun accent en survol décoratif — un survol n’est ni un usage ni une certification', () => {
    expect(releve(/\bhover:(text|border)-(wouj|sitwon)\b/)).toEqual([])
  })

  it('tout fond Wouj PORTANT DU TEXTE le met en Blan (5,43:1)', () => {
    // Exemption : un filet ou une puce décorative n'a pas de texte à colorer. Ils se
    // reconnaissent à leur aria-hidden — cinq cas, tous des barres de titre h-1 w-16.
    const fautifs = releve(/\bbg-wouj\b(?![-/])/).filter((ref) => {
      const [p, n] = ref.split(':')
      const ligne = readFileSync(p, 'utf8').split('\n')[Number(n) - 1]
      if (/aria-hidden/.test(ligne)) return false
      return !/\btext-(white|inverse)\b/.test(ligne)
    })
    expect(fautifs).toEqual([])
  })

  it('tout fond Sitwon porte du texte Chabon (7,08:1)', () => {
    const fautifs = releve(/\bbg-sitwon\b(?![-/])/).filter((ref) => {
      const [p, n] = ref.split(':')
      const ligne = readFileSync(p, 'utf8').split('\n')[Number(n) - 1]
      return !/\btext-chabon\b/.test(ligne)
    })
    expect(fautifs).toEqual([])
  })

  it('Sitwon Pal a bien cédé la place à Wouj Pal (AV-02, art. 2)', () => {
    expect(releve(/sitwonPal|sitwon-pal/)).toEqual([])
  })

  it('le noir pur reste interdit (hors commentaire énonçant la règle)', () => {
    const fautifs = releve(/#000000\b|#000\b/).filter((ref) => {
      const [f, n] = ref.split(':')
      const ligne = readFileSync(f, 'utf8').split('\n')[Number(n) - 1].trim()
      return !/^(\*|\/\/|\/\*)/.test(ligne)
    })
    expect(fautifs).toEqual([])
  })
})
