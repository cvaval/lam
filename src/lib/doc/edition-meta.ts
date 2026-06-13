/**
 * En-tête d'un fascicule du Moniteur stocké dans Document.metaJson sous la clé
 * « edition » (méthodologie Le Moniteur — table « numero »). Lecture tolérante :
 * metaJson sert aussi à l'Index ({category,reference,year}) — on ne renvoie que
 * la sous-clé edition si elle existe.
 */
export interface EditionHeader {
  anneeParution: number | null
  directeurGeneral: string | null
  issn: string | null
  ville: string | null
}

export function parseEditionHeader(metaJson: string | null | undefined): EditionHeader | null {
  if (!metaJson) return null
  try {
    const parsed = JSON.parse(metaJson)
    const e = parsed?.edition
    if (!e || typeof e !== 'object') return null
    const header: EditionHeader = {
      anneeParution: typeof e.anneeParution === 'number' ? e.anneeParution : null,
      directeurGeneral: typeof e.directeurGeneral === 'string' ? e.directeurGeneral : null,
      issn: typeof e.issn === 'string' ? e.issn : null,
      ville: typeof e.ville === 'string' ? e.ville : null,
    }
    return Object.values(header).some((v) => v != null) ? header : null
  } catch {
    return null
  }
}
