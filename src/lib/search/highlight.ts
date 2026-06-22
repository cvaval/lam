// Surlignage des termes (rendu en jaune Sitwon via la classe .hl — globals.css).

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Variantes accentuées par lettre de base : les termes reçus de fts.ts sont
// accent-folés (sortie de fold/expandQuery), mais le texte du document ne l'est
// pas — « societe » doit localiser ET surligner « Société ».
const ACCENT_VARIANTS: Record<string, string> = {
  a: 'aàâäáã',
  c: 'cç',
  e: 'eéèêë',
  i: 'iîïí',
  o: 'oôöóõ',
  u: 'uùûüú',
  y: 'yÿ',
  n: 'nñ',
}

/** Motif regex tolérant aux accents pour un terme folé. */
function foldPattern(term: string): string {
  let out = ''
  for (const ch of term) {
    const variants = ACCENT_VARIANTS[ch]
    out += variants ? `[${variants}]` : escapeRegExp(ch)
  }
  return out
}

/**
 * Regex globale, insensible aux accents, pour surligner des termes folés dans du texte
 * brut rendu en React (split sur le groupe capturé → segments alternés texte/marque).
 * null si aucun terme exploitable.
 */
export function highlightRegex(terms: string[]): RegExp | null {
  const usable = terms.filter((t) => t && t.length >= 2)
  if (!usable.length) return null
  const pattern = usable.map(foldPattern).sort((a, b) => b.length - a.length).join('|')
  try {
    return new RegExp(`(${pattern})`, 'gi')
  } catch {
    return null
  }
}

/**
 * Construit un extrait centré sur la première occurrence d'un terme, échappe le HTML,
 * puis entoure les termes de <mark class="hl">…</mark>. La localisation comme le
 * surlignage replient les accents (un terme folé matche le texte accentué).
 */
export function makeSnippet(text: string, terms: string[], maxLen = 240): string {
  if (!text) return ''
  const usable = terms.filter((t) => t.length >= 2)

  let re: RegExp | null = null
  if (usable.length) {
    const pattern = usable.map(foldPattern).sort((a, b) => b.length - a.length).join('|')
    try {
      re = new RegExp(`(${pattern})`, 'gi')
    } catch {
      re = null // motif invalide : extrait non surligné
    }
  }

  const pos = re ? text.search(re) : -1

  let start = 0
  if (pos > 80) start = pos - 60
  const slice = text.slice(start, start + maxLen)
  const prefix = start > 0 ? '… ' : ''
  const suffix = start + maxLen < text.length ? ' …' : ''

  let html = escapeHtml(slice)
  if (re) html = html.replace(re, '<mark class="hl">$1</mark>')
  return prefix + html + suffix
}
