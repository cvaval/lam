import type { Prisma } from '@prisma/client'
import { fold } from './search/normalize'

/** Taille de page commune (résultats de recherche + lot « charger plus »). */
export const TARIFS_PAGE_SIZE = 100

/** Chiffres seuls d'un code (« 0101.21 00 » → « 01012100 ») pour la recherche/indexation. */
export function digitsOnly(code: string): string {
  return (code ?? '').replace(/\D/g, '')
}

/**
 * VOCABULAIRE ORDINAIRE → NOMENCLATURE DOUANIÈRE.
 *
 * ⚠️ LA TABLE DES TARIFS NE PARLE PAS LA LANGUE DE CELUI QUI LA CONSULTE. Le Système
 * harmonisé dit « machines automatiques de traitement de l'information », jamais
 * « ordinateur » ; « machines qui assurent au moins deux des fonctions suivantes :
 * impression, copie ou transmission de télécopie », jamais « imprimante ». Mesuré sur les
 * 5 918 positions en base, la recherche par sous-chaîne rendait :
 *
 *     ordinateur → 0 · informatique → 0 · imprimante → 0 · laptop → 0
 *     logiciel → 0 · serveur → 0 · disque dur → 0
 *
 * Sept mots qu'un juriste tape naturellement, sept écrans vides — alors que les positions
 * existent et portent leurs taux. C'est ce trou-là que cette table comble.
 *
 * ⚠️ ELLE VISE DES CODES, PAS DES MOTS. Un synonyme rendu en `designation contains` serait
 * fragile deux fois : la casse s'attrape (`mode: 'insensitive'`), mais PAS les accents —
 * PostgreSQL n'a pas `unaccent` ici, et « ecran » ne trouverait jamais « écran ». Les cibles
 * sont donc des PRÉFIXES DE CODE SH, que rien n'accentue et que la nomenclature ne réécrit
 * pas. `mots` reste disponible pour les cas où le libellé est stable et sans accent.
 *
 * ⚠️ « PORTABLE » EST AMBIGU en français — ordinateur portable (84.71.30) ET téléphone
 * portable (85.17.13/14). Les deux familles sont visées : mieux vaut deux réponses justes
 * qu'une seule arbitraire.
 *
 * Le repère se compare EN FORME REPLIÉE (minuscules, sans accent) : « ÉCRAN », « ecran » et
 * « écran » ouvrent la même porte.
 */
export const TARIF_SYNONYMES: readonly { repères: readonly string[]; codes: readonly string[]; mots?: readonly string[] }[] = [
  // — Informatique —
  { repères: ['ordinateur', 'ordinateurs', 'informatique', 'informatiques', 'laptop', 'pc', 'micro-ordinateur'], codes: ['8471', '847330'] },
  { repères: ['serveur', 'serveurs', 'unite centrale', 'processeur'], codes: ['847141', '847149', '847150'] },
  { repères: ['disque dur', 'disque', 'ssd', 'memoire', 'stockage', 'cle usb', 'usb'], codes: ['847170', '8523'] },
  { repères: ['clavier', 'souris', 'scanner', 'peripherique', 'peripheriques'], codes: ['847160'] },
  { repères: ['imprimante', 'imprimantes', 'photocopieuse', 'multifonction'], codes: ['844331', '844332', '844339'] },
  { repères: ['ecran', 'ecrans', 'moniteur', 'moniteurs'], codes: ['852842', '852852', '852862'] },
  { repères: ['logiciel', 'logiciels', 'support enregistre'], codes: ['852349', '852380'] },
  { repères: ['routeur', 'reseau', 'wifi', 'modem'], codes: ['851762', '851769'] },
  { repères: ['telephone', 'telephones', 'smartphone', 'cellulaire', 'portable'], codes: ['851713', '851714', '847130'] },
  { repères: ['tablette', 'tablettes'], codes: ['847130'] },
  { repères: ['onduleur', 'batterie'], codes: ['8507', '850440'] },
]

/**
 * Positions visées par le vocabulaire ordinaire contenu dans la requête.
 * Une requête peut activer plusieurs entrées (« ordinateur portable » → 84.71 + 85.17).
 */
export function tariffSynonymTargets(q: string): { codes: string[]; mots: string[] } {
  const f = fold(q).trim()
  if (f.length < 2) return { codes: [], mots: [] }
  const codes = new Set<string>()
  const mots = new Set<string>()
  for (const e of TARIF_SYNONYMES) {
    // Le repère doit paraître comme MOT, pas comme fragment : « pc » ne doit pas s'allumer
    // sur « pcs » d'une autre désignation, ni « usb » à l'intérieur d'un mot plus long.
    if (!e.repères.some((r) => new RegExp(`(^|[^a-z0-9])${r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(f))) continue
    for (const c of e.codes) codes.add(c)
    for (const m of e.mots ?? []) mots.add(m)
  }
  return { codes: [...codes], mots: [...mots] }
}

/**
 * Filtre d'une position tarifaire : par texte (code pointé OU chiffres seuls via
 * searchCode, OU désignation, OU vocabulaire ordinaire) et/ou par chapitre SH. Partagé par
 * /tarifs, l'API de recherche et /admin/tarifs.
 */
export function tariffWhere(q: string, chapter?: string | null): Prisma.CustomsTariffWhereInput {
  const s = (q ?? '').trim()
  const and: Prisma.CustomsTariffWhereInput[] = []
  if (chapter) and.push({ chapter })
  if (s) {
    const or: Prisma.CustomsTariffWhereInput[] = [
      { code: { contains: s, mode: 'insensitive' } },
      { designation: { contains: s, mode: 'insensitive' } },
    ]
    const digits = digitsOnly(s)
    if (digits.length >= 2) or.push({ searchCode: { contains: digits } })
    // Vocabulaire ordinaire : « ordinateur » ouvre la position 84.71, que la nomenclature
    // ne nomme jamais ainsi. S'AJOUTE à la recherche littérale, ne la remplace pas.
    const { codes, mots } = tariffSynonymTargets(s)
    for (const c of codes) or.push({ searchCode: { startsWith: c } })
    for (const m of mots) or.push({ designation: { contains: m, mode: 'insensitive' } })
    and.push({ OR: or })
  }
  return and.length ? { AND: and } : {}
}
