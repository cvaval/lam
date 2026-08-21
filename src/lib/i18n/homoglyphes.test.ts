/**
 * § 8.2 — **AUCUN HOMOGLYPHE DANS LES TROIS CATALOGUES DE LANGUE.**
 *
 * Le défaut trouvé le 20 août 2026 (le héros énumérait alors quatre recours) :
 * `delais.heroSubtitle` du créole valait « … opozisyon, referе — … », où le dernier caractère
 * du mot était **U+0435 CYRILLIC SMALL LETTER IE** et non un « e » latin.
 *
 * ⚠️ **L'ORTHOGRAPHE, ELLE, ÉTAIT BONNE** — corrigé par Me Vaval le 20 août : en créole le mot
 * s'écrit **« refere », SANS accent**. La première rédaction de ce test tenait « referè » pour
 * la forme correcte et interdisait « refere » : elle aurait fait rejeter l'orthographe juste.
 * La faute était donc unique, et invisible : un caractère cyrillique au milieu d'un mot latin,
 * qui échappe à toute recherche portant sur « refere ».
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
   * Le mot a QUITTÉ le catalogue avec l'énumération du héros : la surface publique ne nomme
   * plus appel, pourvoi, opposition ni référé, seulement la date de réception de l'acte et le
   * nombre de jours francs. Reste ce qui garde encore quelque chose : que les libellés créoles
   * des surfaces publiques ont bien été relus.
   *
   * ⚠️ **ON N'INTERDIT PAS « refere ».** C'est l'orthographe créole correcte (Me Vaval,
   * 20 août 2026). Seul le caractère cyrillique était fautif, et c'est le balayage
   * d'homoglyphes ci-dessus qui l'attrape — sur TOUS les mots, pas sur celui-là seulement.
   */
  it('les libellés créoles des surfaces publiques ont été relus', async () => {
    const { getDictionary } = await import('./dictionaries')
    const ht = getDictionary('ht')
    const valeurs = Object.values(ht.delais).filter((v): v is string => typeof v === 'string')
    expect(valeurs.length).toBeGreaterThan(50)
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
