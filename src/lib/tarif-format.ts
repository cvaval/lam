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
