/**
 * Nettoyage d'AFFICHAGE d'une désignation du Système Harmonisé. Les données gardent
 * les tirets de hiérarchie (« -- Coqs et poules »), mais l'interface affiche un nom
 * épuré : tirets de tête retirés (le niveau sert à l'indentation) et tirets / traits
 * de soulignement parasites de fin retirés. Pur, sans import → utilisable client.
 */
export function tariffLabel(designation: string): { level: number; label: string } {
  const d = designation ?? ''
  const m = d.match(/^([-–—]+)/)
  const level = m ? m[1].length : 0
  const label = d.replace(/^[-–—\s]+/, '').replace(/[\s_–—-]+$/, '').trim()
  return { level, label }
}

/** Analyse un taux « 10 % » / « 3,5 % » → fraction (0.10) ; 0 si absent. */
export function parsePct(s: string | null): number {
  if (!s) return 0
  const m = s.replace(',', '.').match(/(\d+(?:\.\d+)?)\s*%/)
  return m ? Number(m[1]) / 100 : 0
}

/**
 * Saisie d'un montant tolérante aux conventions FR **et** EN, bornée à ≥ 0. La virgule est
 * toujours décimale ; le point est décimal s'il est unique et suivi de 1–2 chiffres
 * (« 1500.50 » → 1500,5), sinon séparateur de milliers (« 1.500 », « 12.345.678 »).
 */
export function parseAmount(s: string): number {
  let t = (s ?? '').trim().replace(/\s/g, '')
  if (!t) return 0
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  else {
    const dots = (t.match(/\./g) || []).length
    if (dots > 1) t = t.replace(/\./g, '')
    else if (dots === 1 && (t.split('.')[1] ?? '').length === 3) t = t.replace('.', '')
  }
  const n = Number(t)
  return Number.isFinite(n) ? Math.max(0, n) : 0
}
