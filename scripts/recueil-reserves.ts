/**
 * Éclatement du recueil « CirculaireAuxBanques.pdf » en ses textes constituants.
 *
 * Ce PDF n'est pas une circulaire unique mais un RECUEIL d'une vingtaine de textes
 * BRH sur les coefficients de réserves obligatoires (1996–2019), reliés dans un même
 * fichier sous le texte de tête (réf. BRH/DCC/CIRC # 01-19). Importé tel quel, il
 * était catalogué à tort comme « Circulaire n° 01-19 », son corps masquant ~22 autres
 * textes. On le scinde en autant d'entrées Document que de textes.
 *
 * Numérotation (relecture IA du 12 juin 2026) — deux familles distinctes :
 *  • Registre principal des circulaires (« Circulaire BRH n° N ») : N'EST PAS présent
 *    ici. Les textes du recueil portent une numérotation propre à la SÉRIE RÉSERVES
 *    (réf. « CIRC-RES # », « # 86-12-X », ou des n° réutilisés 87/89/90 sans rapport
 *    avec les n° 87 « classification des prêts » et 89-2 « contrôle interne » du
 *    registre principal). Leur `number` reçoit donc un qualificatif (« CIRC-RES n° »
 *    ou « (réserves obligatoires) ») : parseCirculaireRef le renvoie `null`, si bien
 *    que la détection de trous (src/lib/brh/gaps.ts) reste inchangée — comme pour les
 *    réfs numéro-année 01-19 / 002-18, volontairement hors séquence.
 *  • Réfs numéro-année (01-19, 002-18, LC 01-14) : forme canonique, déjà ignorées des
 *    trous (sous-numéro à 2 chiffres / année).
 *
 * La circulaire-cadre n° 111 (texte intégral + annexes) figure aussi dans le recueil
 * mais EXISTE DÉJÀ, en version plus complète, comme « Circulaire n° 111 » du corpus :
 * on n'en recrée pas de doublon (segment marqué skip).
 *
 * Dates = date de SIGNATURE (« Port-au-Prince, le … ») de chaque texte, conformément
 * à la convention du corpus. Codées en dur (relues), pas extraites.
 */

export const RECUEIL_SOURCE = 'CirculaireAuxBanques.pdf'

export interface RecueilSegment {
  /** ancre OCR tolérante repérant l'en-tête du texte dans le corps du recueil */
  anchor: RegExp
  /** référence canonique (Document.number) ; null-parsée par parseCirculaireRef sauf 01-19/002-18 */
  number: string
  kind: 'CIRCULAIRE' | 'LETTRE'
  /** titre éditorial (Document.titleFr) ; vide si segment non catalogué */
  title: string
  /** date de signature YYYY-MM-DD, ou null */
  date: string | null
  /** segment de découpe seulement (borne), non catalogué — ex. n° 111 déjà au corpus */
  skip?: boolean
}

// Ordre = ordre d'apparition dans le PDF (indispensable au découpage par bornes).
export const RECUEIL_SEGMENTS: RecueilSegment[] = [
  { anchor: /BRH\/DCC\/CIRC\s*#\s*01-19/i, kind: 'CIRCULAIRE', number: 'Circulaire n° 01-19', date: '2019-01-29',
    title: 'Circulaire BRH n° 01-19 — Coefficients de réserves obligatoires (à compter du 4 février 2019)' },
  { anchor: /BRH[I/]DCC\/CIRC\s*#\s*002-18/i, kind: 'CIRCULAIRE', number: 'Circulaire n° 002-18', date: '2018-12-04',
    title: 'Circulaire BRH n° 002-18 — Coefficients de réserves obligatoires (à compter du 10 décembre 2018)' },
  { anchor: /CIRC-RES\s*#\s*O?O?\s*1-18/i, kind: 'CIRCULAIRE', number: 'Circulaire CIRC-RES n° 001-18', date: '2018-07-23',
    title: 'Circulaire BRH CIRC-RES n° 001-18 — Constitution des réserves obligatoires sur les passifs en monnaies étrangères (à compter du 1er août 2018)' },
  { anchor: /C[lI1]+CULAIRE\s*N[O0]\.?\s*111/i, kind: 'CIRCULAIRE', number: 'Circulaire n° 111', date: '2017-09-25',
    title: '', skip: true }, // doublon — texte intégral déjà au corpus
  { anchor: /CIRC-RES\s*#\s*95/i, kind: 'CIRCULAIRE', number: 'Circulaire CIRC-RES n° 95', date: '2015-07-06',
    title: 'Circulaire BRH CIRC-RES n° 95 — Coefficients de réserves obligatoires (à compter du 16 juillet 2015)' },
  { anchor: /CIRC-RES\s*#\s*94/i, kind: 'CIRCULAIRE', number: 'Circulaire CIRC-RES n° 94', date: '2015-06-25',
    title: 'Circulaire BRH CIRC-RES n° 94 — Coefficients de réserves obligatoires (à compter du 1er juillet 2015)' },
  { anchor: /CIR\.?C-RES\s*#\s*93/i, kind: 'CIRCULAIRE', number: 'Circulaire CIRC-RES n° 93', date: '2015-05-26',
    title: 'Circulaire BRH CIRC-RES n° 93 — Coefficients de réserves obligatoires (à compter du 1er juin 2015)' },
  { anchor: /CIRC-RES\s*#\s*92/i, kind: 'CIRCULAIRE', number: 'Circulaire CIRC-RES n° 92', date: '2015-03-26',
    title: 'Circulaire BRH CIRC-RES n° 92 — Coefficients de réserves obligatoires (à compter du 1er avril 2015)' },
  { anchor: /CIRCULAIRE\s*#\s*90\b/i, kind: 'CIRCULAIRE', number: 'Circulaire n° 90 (réserves obligatoires)', date: '2014-07-10',
    title: 'Circulaire BRH n° 90 (réserves obligatoires) — Coefficients de réserves obligatoires (à compter du 16 juillet 2014)' },
  { anchor: /BRH\/DCC\/LC\s*#\s*01-14/i, kind: 'LETTRE', number: 'Lettre-Circulaire n° 01-14', date: '2014-03-21',
    title: 'Lettre-Circulaire BRH n° 01-14 — Réserves obligatoires et taux des Bons BRH (à compter du 1er avril 2014)' },
  { anchor: /BRH\/CIR\/\s*96\s*#\s*78/i, kind: 'CIRCULAIRE', number: 'Circulaire n° 78 (réserves obligatoires)', date: '1996-04-19',
    title: "Circulaire BRH n° 78 (réserves obligatoires) — Modification de l'article 7 : période de mesure et de constitution des réserves" },
  { anchor: /No\.?\s*86-5C/i, kind: 'CIRCULAIRE', number: 'Circulaire n° 86-5C', date: '1997-08-13',
    title: 'Circulaire BRH n° 86-5C — Constitution des réserves obligatoires sur les passifs en monnaies étrangères' },
  { anchor: /No\.?\s*72-3/i, kind: 'CIRCULAIRE', number: 'Circulaire n° 72-3 (réserves obligatoires)', date: '1998-09-01',
    title: "Circulaire BRH n° 72-3 (réserves obligatoires) — Modalités d'application des réserves obligatoires aux banques, BEL et filiales non bancaires" },
  { anchor: /No\.?\s*86-8/i, kind: 'CIRCULAIRE', number: 'Circulaire n° 86-8 (réserves obligatoires)', date: '1998-09-01',
    title: 'Circulaire BRH n° 86-8 (réserves obligatoires) — Coefficients de réserves obligatoires (à compter du 16 septembre 1998)' },
  { anchor: /CIRCULAIRE\s*#?\s*[l1k>]*-?12-C/i, kind: 'CIRCULAIRE', number: 'Circulaire n° 86-12-C', date: '2006-02-22',
    title: 'Circulaire BRH n° 86-12-C — Constitution des réserves obligatoires sur les passifs en monnaies étrangères (à compter du 1er mars 2006)' },
  { anchor: /CIRCULAIRE\s*#86-12-E/i, kind: 'CIRCULAIRE', number: 'Circulaire n° 86-12-E', date: '2006-04-25',
    title: 'Circulaire BRH n° 86-12-E — Constitution des réserves obligatoires sur les passifs en monnaies étrangères (à compter du 1er mai 2006)' },
  { anchor: /CIRCULAIRE\s*\.*-?12-G/i, kind: 'CIRCULAIRE', number: 'Circulaire n° 86-12-G', date: '2007-10-11',
    title: 'Circulaire BRH n° 86-12-G — Coefficients de réserves obligatoires (à compter du 16 octobre 2007)' },
  { anchor: /CIRCULAIRE\s*#\s*86-12-I/i, kind: 'CIRCULAIRE', number: 'Circulaire n° 86-12-I', date: '2008-06-10',
    title: 'Circulaire BRH n° 86-12-I — Constitution des réserves obligatoires sur les passifs en monnaies étrangères (à compter du 16 juin 2008)' },
  { anchor: /CIRCULAIRE\s*#\s*86-12-J/i, kind: 'CIRCULAIRE', number: 'Circulaire n° 86-12-J', date: '2008-07-25',
    title: 'Circulaire BRH n° 86-12-J — Constitution des réserves obligatoires sur les passifs en monnaies étrangères (à compter du 30 juillet 2008)' },
  { anchor: /CIRCULAIRE\s*#\s*87\b/i, kind: 'CIRCULAIRE', number: 'Circulaire n° 87 (réserves obligatoires)', date: '2009-03-09',
    title: 'Circulaire BRH n° 87 (réserves obligatoires) — Coefficients de réserves obligatoires (à compter du 16 mars 2009)' },
  { anchor: /CIRCULAIRE\s*#\s*86-12-K/i, kind: 'CIRCULAIRE', number: 'Circulaire n° 86-12-K', date: '2011-12-21',
    title: 'Circulaire BRH n° 86-12-K — Constitution des réserves obligatoires sur les passifs en monnaies étrangères (à compter du 1er janvier 2012)' },
  { anchor: /CIRCULAIRE\s*#\s*86-12-L/i, kind: 'CIRCULAIRE', number: 'Circulaire n° 86-12-L', date: '2012-03-27',
    title: 'Circulaire BRH n° 86-12-L — Constitution des réserves obligatoires sur les passifs en monnaies étrangères (à compter du 16 avril 2012)' },
  { anchor: /CIRCULAIRE\s*#\s*88-13-M/i, kind: 'CIRCULAIRE', number: 'Circulaire n° 88-13-M', date: '2013-01-29',
    title: 'Circulaire BRH n° 88-13-M — Coefficients de réserves obligatoires (à compter du 1er février 2013)' },
  { anchor: /CIRCULAIRE\s*#\s*89\b/i, kind: 'CIRCULAIRE', number: 'Circulaire n° 89 (réserves obligatoires)', date: '2013-05-21',
    title: 'Circulaire BRH n° 89 (réserves obligatoires) — Coefficients de réserves obligatoires (à compter du 16 juin 2013)' },
]

export interface SplitRow {
  number: string
  kind: 'CIRCULAIRE' | 'LETTRE'
  title: string
  date: Date | null
  body: string
}

/** Retire l'en-tête (« Banque de la République… / Le Gouverneur ») du texte suivant,
 *  happé en fin de segment par le découpage par bornes. Tolère l'OCR : on coupe à la
 *  dernière mention « Banque de la » si elle est en toute fin de segment (le mot
 *  « République » est souvent illisible — « Àépubliqul », « !Upublique »…). */
function trimTrailingLetterhead(seg: string): string {
  const s = seg.trimEnd()
  const i = s.lastIndexOf('Banque de la')
  if (i > 0 && i > s.length - 200) {
    const nl = s.lastIndexOf('\n', i)
    return s.slice(0, nl > 0 ? nl : i).trimEnd()
  }
  return s
}

/**
 * Scinde le corps OCR du recueil en ses textes constituants. Le corps est découpé
 * aux positions des ancres ; chaque tranche [ancre_i, ancre_{i+1}) devient un texte.
 * Les segments `skip` servent de bornes mais ne sont pas retournés.
 * Lève si une ancre attendue est introuvable (garde-fou contre un OCR différent).
 */
export function splitRecueil(body: string): SplitRow[] {
  const positions: { seg: RecueilSegment; idx: number }[] = []
  let from = 0
  for (const seg of RECUEIL_SEGMENTS) {
    const sub = body.slice(from)
    const m = sub.match(seg.anchor)
    if (!m || m.index === undefined) throw new Error(`Recueil : ancre introuvable pour « ${seg.number} » (${seg.anchor})`)
    const idx = from + m.index
    positions.push({ seg, idx })
    from = idx + 1
  }

  const rows: SplitRow[] = []
  for (let i = 0; i < positions.length; i++) {
    const { seg, idx } = positions[i]
    if (seg.skip) continue
    // 1er texte : depuis le tout début (préambule). Sinon : depuis son ancre.
    const start = i === 0 ? 0 : idx
    const end = i + 1 < positions.length ? positions[i + 1].idx : body.length
    const sliced = trimTrailingLetterhead(body.slice(start, end))
    rows.push({
      number: seg.number,
      kind: seg.kind,
      title: seg.title,
      date: seg.date ? new Date(`${seg.date}T00:00:00Z`) : null,
      body: sliced,
    })
  }
  return rows
}
