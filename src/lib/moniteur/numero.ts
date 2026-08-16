/**
 * Lecture du numéro d'un fascicule du Moniteur, pour l'ORDRE d'affichage.
 *
 * « LM2025-1 » → {num:1} · « LM2025-SP70B » → {special, num:70, suffix:'B'} ·
 * « LM1991-1-A » → {num:1, suffix:'A'} · « LM1991-78+79 » → {num:78} ·
 * « LM2000-SP2-SUP » → {special, num:2, suffix:'SUP'}.
 *
 * ⚠️ ON RETIRE LE PRÉFIXE, ON N'ANCRE PLUS SUR LA FIN. Deux nomenclatures coexistent dans
 * le corpus : le suffixe COLLÉ des éditions spéciales (« SP70B ») et le suffixe DÉTACHÉ du
 * fonds ancien et d'une partie de 2026 (« 1-A », « 24-D »). L'expression ancrée sur `$`
 * exigeait des chiffres immédiatement suivis de lettres : « 1-A » ne correspondait à RIEN,
 * le numéro retombait à 0, et 256 fascicules — 9 % du Moniteur — remontaient en tête de
 * leur mois. Le n° 1-A s'affichait AVANT le n° 1, et les suffixés entre eux dans l'ordre
 * d'arrivée en base : 1-A, 8-A, 2-A, 9-A.
 *
 * Le fascicule double « 78+79 » se range sous son premier numéro, à sa place chronologique.
 */
export function parseNumeroMoniteur(number: string): { special: boolean; num: number; suffix: string } {
  const special = /-SP/i.test(number)
  const reste = number.replace(/^LM\d{4}-/i, '').replace(/^SP/i, '')
  const m = reste.match(/^(\d+)\s*-?\s*([A-Za-z]*)/)
  return { special, num: m ? Number(m[1]) : 0, suffix: m && m[2] ? m[2].toUpperCase() : '' }
}

/** Ordre d'un mois : les régulières d'abord, puis par numéro, le suffixé après son nu. */
export function comparerNumerosMoniteur(
  a: { special: boolean; num: number; suffix: string },
  b: { special: boolean; num: number; suffix: string },
): number {
  return Number(a.special) - Number(b.special) || a.num - b.num || a.suffix.localeCompare(b.suffix)
}
