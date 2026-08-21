/**
 * § 8.2 — **AUCUN HOMOGLYPHE DANS LES TROIS CATALOGUES DE LANGUE.**
 *
 * Le défaut trouvé le 20 août 2026 (le héros énumérait alors quatre recours) :
 * `delais.heroSubtitle` du créole valait
 * « … opozisyon, referе — … », où le caractère avant l'espace était **U+0435 CYRILLIC SMALL
 * LETTER IE**, et non « è ». Le mot était donc à la fois mal orthographié (« refere » au lieu
 * de « referè ») et **invisible à toute recherche ou correction portant sur « referè »**.
 *
 * Un homoglyphe ne se voit pas à la relecture : c'est exactement le genre de faute qu'un test
 * attrape et qu'un œil ne rattrape jamais. Le § 8.2 rappelle que les noms créoles doivent être
 * relus avant d'être figés ; celui-ci ne l'avait manifestement pas été.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const LOCALES = ['fr', 'en', 'ht'] as const

/**
 * Les caractères cyrilliques et grecs qui se confondent visuellement avec du latin. On ne
 * teste PAS « tout ce qui n'est pas latin » : les trois catalogues portent légitimement des
 * guillemets français, des tirets cadratins, des apostrophes typographiques et des « ò », « è »,
 * « ç » — tous latins.
 */
const HOMOGLYPHES = new Map<number, string>([
  [0x0430, 'а (cyrillique) au lieu de « a »'],
  [0x0435, 'е (cyrillique) au lieu de « e »'],
  [0x043e, 'о (cyrillique) au lieu de « o »'],
  [0x0440, 'р (cyrillique) au lieu de « p »'],
  [0x0441, 'с (cyrillique) au lieu de « c »'],
  [0x0443, 'у (cyrillique) au lieu de « y »'],
  [0x0445, 'х (cyrillique) au lieu de « x »'],
  [0x0456, 'і (cyrillique) au lieu de « i »'],
  [0x0410, 'А (cyrillique) au lieu de « A »'],
  [0x0415, 'Е (cyrillique) au lieu de « E »'],
  [0x041e, 'О (cyrillique) au lieu de « O »'],
  [0x0420, 'Р (cyrillique) au lieu de « P »'],
  [0x0421, 'С (cyrillique) au lieu de « C »'],
  [0x03bf, 'ο (grec) au lieu de « o »'],
  [0x0391, 'Α (grec) au lieu de « A »'],
  [0x0392, 'Β (grec) au lieu de « B »'],
])

describe('§ 8.2 — les catalogues de langue ne portent aucun homoglyphe', () => {
  for (const locale of LOCALES) {
    it(`${locale}.ts est en latin pur`, () => {
      const source = readFileSync(join('src/lib/i18n/locales', `${locale}.ts`), 'utf8')
      const lignes = source.split('\n')
      const fautifs: string[] = []
      lignes.forEach((ligne, i) => {
        for (const c of ligne) {
          const nom = HOMOGLYPHES.get(c.codePointAt(0) ?? 0)
          if (nom) fautifs.push(`${locale}.ts:${i + 1} → ${nom} dans « ${ligne.trim().slice(0, 70)} »`)
        }
      })
      expect(fautifs).toEqual([])
    })
  }

  /**
   * ⚠️ **Le mot « referè » a QUITTÉ le catalogue avec l'énumération du héros.** Celui-ci ne
   * nomme plus appel, pourvoi, opposition ni référé : la surface publique n'offre plus le
   * répertoire, seulement la date de réception de l'acte et le nombre de jours francs. Le
   * test qui surveillait ce mot précis n'a donc plus d'objet — mais la FAUTE qu'il attrapait,
   * elle, en a un : on vérifie qu'aucune valeur créole du calculateur ne porte la forme sans
   * accent, et que les libellés neufs des surfaces publiques ont bien été relus.
   */
  it('le créole ne réintroduit ni « refere » sans accent, ni un libellé non relu', async () => {
    const { getDictionary } = await import('./dictionaries')
    const ht = getDictionary('ht')
    const valeurs = Object.values(ht.delais).filter((v): v is string => typeof v === 'string')
    expect(valeurs.length).toBeGreaterThan(50)
    for (const v of valeurs) expect(v, v).not.toMatch(/\brefere\b/)
    expect(ht.delais.publicDateLabel).toBe('Dat ou resevwa zak la')
    expect(ht.delais.publicDaysLabel).toBe('Kantite jou fran')
    // ⚠️ `heroSubtitle` a été retiré le 20 août 2026 (Me Vaval) ; la phrase sert désormais la
    // tuile du tableau de bord connecté, sous `toolsSubtitle`.
    expect(ht.delais.toolsSubtitle).toContain('jou fran')
    // Les libellés NEUFS des surfaces publiques passent la même relecture.
    expect(ht.delais.francRule).toContain('delè fran')
    expect(ht.delais.missingDate).toBe('Endike dat ou resevwa zak la')
    expect(ht.delais.missingDays).toBe('Endike kantite jou fran')
  })
})
