/**
 * Renvois à un ACTE nommé — « Décret du 8 octobre 1982 », « Décret du 6 juillet 2005 » — dans
 * le corps et les annotations d'un texte annoté.
 *
 * Le Code civil abrège les actes qui l'ont abrogé ou amendé (« V. l'art. 2 du D. du 8 octobre
 * 1982. ») : développées en « Décret du … » (Me Vaval, 18 oct. 2026), ces désignations
 * deviennent des liens QUAND LE TEXTE OU SON MONITEUR EST EN BASE. La table désignation → cible
 * vit dans les annotations du document (`actesLies`) : ce module ne devine rien, il ne lie que
 * ce qu'on lui nomme.
 *
 * ⚠️ UNE DÉSIGNATION PAR LA SEULE DATE PEUT ÊTRE AMBIGUË. Deux décrets du 9 avril 2020 touchent
 * le Code civil (régimes matrimoniaux, sûretés) : la table les nomme avec leur OBJET, et la plus
 * longue désignation l'emporte — « Décret du 9 avril 2020 portant réforme des régimes
 * matrimoniaux » ne se lit jamais comme un simple « Décret du 9 avril 2020 ».
 *
 * Pur et déterministe : la résolution désignation → href se fait dans la page (DB). Le texte
 * officiel n'est jamais modifié (§02) — seul le RENDU porte les liens.
 */

export type ActeSegment = { kind: 'text'; text: string } | { kind: 'acte'; text: string; href: string; cle: string }

const cache = new Map<string, { re: RegExp; parCle: Map<string, string> } | null>()

/** Clé de comparaison : casse, apostrophes et espaces ramenés. */
const pli = (s: string) => s.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim()

function compiler(actes: Record<string, string>) {
  const cles = Object.keys(actes).filter((k) => k.trim() && actes[k])
  const empreinte = cles.sort().join('\u0000')
  if (cache.has(empreinte)) return cache.get(empreinte)!
  if (!cles.length) {
    cache.set(empreinte, null)
    return null
  }
  const parCle = new Map(cles.map((k) => [pli(k), k]))
  const motif = [...cles]
    .sort((a, b) => b.length - a.length) // la plus longue désignation d'abord
    .map((k) =>
      k
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/['’‘]/g, "['’‘]")
        .replace(/\s+/g, '\\s+'),
    )
    .join('|')
  // Ni lettre avant, ni lettre ou chiffre après : « Décret du 8 octobre 19821 » n'est pas l'acte.
  const re = new RegExp(`(?<![\\p{L}])(?:${motif})(?![\\p{L}\\d])`, 'giu')
  const v = { re, parCle }
  cache.set(empreinte, v)
  return v
}

/**
 * Découpe `value` en segments texte / acte. `actes` : désignation → href. Renvoie `null` quand
 * aucune désignation n'apparaît (l'appelant rend alors le texte par son chemin habituel).
 */
export function segmentActeRefs(value: string, actes: Record<string, string> | undefined): ActeSegment[] | null {
  if (!actes || !value) return null
  const c = compiler(actes)
  if (!c) return null
  const out: ActeSegment[] = []
  let pos = 0
  c.re.lastIndex = 0
  for (const m of value.matchAll(c.re)) {
    const cle = c.parCle.get(pli(m[0]))
    if (!cle) continue
    const debut = m.index ?? 0
    if (debut > pos) out.push({ kind: 'text', text: value.slice(pos, debut) })
    out.push({ kind: 'acte', text: m[0], href: actes[cle], cle })
    pos = debut + m[0].length
  }
  if (!out.length) return null
  if (pos < value.length) out.push({ kind: 'text', text: value.slice(pos) })
  return out
}
