/**
 * Extraction du SOMMAIRE (table des matières) d'une édition du Moniteur depuis son
 * texte. Le fascicule commence par une ligne « SOMMAIRE » suivie de la liste des
 * éléments (avis, extraits de marques, lois…), puis le texte détaillé reprend les
 * mêmes en-têtes de section. On renvoie le bloc du sommaire (verbatim), coupé au
 * début du texte détaillé : reprise de l'en-tête de section, OU premier paragraphe
 * long (prose), OU plafond de lignes. Renvoie null si l'édition n'a pas de sommaire.
 */
export function extractSommaire(body: string): string | null {
  if (!body) return null
  const m = body.match(/^[ \t]*SOMMAIRE[ \t]*$/im)
  if (!m || m.index === undefined) return null
  const lines = body.slice(m.index).split('\n')
  // Premier en-tête de section : première ligne non vide, hors « AVIS ».
  let h = -1
  for (let j = 1; j < lines.length; j++) {
    const t = lines[j].trim()
    if (!t || /^AVIS$/i.test(t)) continue
    h = j
    break
  }
  if (h < 0) return null
  const header = lines[h].trim()
  let end = lines.length
  for (let j = h + 1; j < lines.length; j++) {
    const t = lines[j].trim()
    if (t === header) { end = j; break } // l'en-tête de section reparaît → début du corps
    if (t.length > 180) { end = j; break } // paragraphe long → prose détaillée
  }
  end = Math.min(end, h + 60) // garde-fou
  const toc = lines.slice(1, end).join('\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return toc.length >= 10 ? toc : null
}
