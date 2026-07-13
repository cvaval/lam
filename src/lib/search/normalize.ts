import { SEARCH_FIELD_NAMES } from './fields'

// Repli accentué + minuscules — base du préfiltrage SQL et du scoring en mémoire.
export function fold(s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export interface SearchableDoc {
  titleFr: string
  titleEn?: string | null
  titleHt?: string | null
  number?: string | null
  bhdaNumber?: string | null
  holder?: string | null
  author?: string | null
  revue?: string | null
  keywords?: string | null
  themeLabels?: string | null
  matiere?: string | null
  juridiction?: string | null
  moniteurRef?: string | null
  summaryFr?: string | null
  summaryEn?: string | null
  summaryHt?: string | null
  bodyOriginal?: string | null
  /** Texte annoté (jurisprudence, commentaires, index, législation connexe, anciennes versions)
   *  — cherchable pour que les mots des ARRÊTS et ANNOTATIONS des codes (travail, civil…)
   *  ressortent aussi, pas seulement le corps officiel. */
  annotationsJson?: string | null
}

/**
 * Extrait le TEXTE cherchable d'un annotationsJson (sans les clés/ancres de structure) :
 * extraits de jurisprudence, commentaires, blocs de législation connexe, anciennes versions
 * et sujets d'index. Ces contenus vivent hors de bodyOriginal → sinon introuvables.
 */
export function extractAnnotationsText(json: string | null | undefined): string {
  if (!json) return ''
  try {
    const a = JSON.parse(json) as Record<string, unknown>
    const parts: string[] = []
    const juris = (a.jurisprudence ?? {}) as Record<string, { ref?: string; excerpt?: string }[]>
    for (const arr of Object.values(juris)) for (const c of arr ?? []) { if (c.ref) parts.push(c.ref); if (c.excerpt) parts.push(c.excerpt) }
    const comm = (a.commentaires ?? {}) as Record<string, string[]>
    for (const arr of Object.values(comm)) parts.push(...(arr ?? []))
    const connexe = (a.connexe ?? {}) as Record<string, { label?: string; text?: string }[]>
    for (const arr of Object.values(connexe)) for (const b of arr ?? []) { if (b.label) parts.push(b.label); if (b.text) parts.push(b.text) }
    parts.push(...(Object.values((a.oldVersions ?? {}) as Record<string, string>)))
    for (const e of ((a.indexEntries ?? []) as { subject?: string }[])) if (e.subject) parts.push(e.subject)
    return parts.join(' ')
  } catch {
    return ''
  }
}

/**
 * Concatène les champs cherchables en un texte folé (stocké dans Document.searchText).
 * La liste des champs vient de SEARCH_FIELD_NAMES — source unique (search/fields.ts) — plus le
 * texte des annotations (jurisprudence/commentaires/index/connexe) pour les textes annotés.
 */
export function buildSearchText(d: SearchableDoc): string {
  const fields = SEARCH_FIELD_NAMES.map((f) => d[f]).filter(Boolean).join(' ')
  return fold([fields, extractAnnotationsText(d.annotationsJson)].filter(Boolean).join(' '))
}
