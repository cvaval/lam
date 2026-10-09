/**
 * Mise en forme publique de la liste des notaires — fonctions PURES (testées).
 *
 * La provenance se dit EN CLAIR : l'éditeur et les dates de consultation, jamais d'URL brute,
 * de nom de fichier ni d'empreinte sur une page publique (demande de la cliente du
 * 9 oct. 2026) — ceux-là restent dans `sourceJson` et la note de livraison.
 */
import type { Locale } from '../types'
import { nomMois } from '../delais/format'

const civil = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d }
}

/**
 * « le 8 septembre et le 9 octobre 2026 » · « on 8 September and 9 October 2026 » ·
 * « 8 septanm ak 9 oktòb 2026 ». L'année n'est répétée que si elle change.
 */
export function formatConsultations(dates: string[], locale: Locale): string {
  const ds = [...new Set(dates)].sort().map(civil)
  if (!ds.length) return ''
  const memeAnnee = ds.every((x) => x.y === ds[0].y)
  const un = (x: { y: number; m: number; d: number }, i: number) => {
    const jour = locale === 'fr' && x.d === 1 ? '1er' : String(x.d)
    const annee = !memeAnnee || i === ds.length - 1 ? ` ${x.y}` : ''
    const base = `${jour} ${nomMois(x.m, locale)}${annee}`
    return locale === 'fr' ? `le ${base}` : base
  }
  const parts = ds.map(un)
  const et = locale === 'fr' ? ' et ' : locale === 'en' ? ' and ' : ' ak '
  const liste = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')}${et}${parts.at(-1)}`
  return locale === 'en' ? `on ${liste}` : liste
}

/** Singulier / pluriel : en français, 0 et 1 sont au singulier ; en anglais et en créole, 1 seul. */
export function compte(n: number, locale: Locale, un: string, plusieurs: string): string {
  const singulier = locale === 'fr' ? n < 2 : n === 1
  return (singulier ? un : plusieurs).replace('{n}', String(n))
}

/**
 * Nom de la JURIDICTION à partir du nom du tribunal, sans « TPI » : les notaires ne dépendent
 * pas des tribunaux de première instance (Me Vaval, 9 oct. 2026). La liste reste regroupée par
 * ressort ; seul le libellé change.
 *
 * ⚠️ Pas le siège : le ressort « de La Gonâve » siège à Anse-à-Galets. On retire « TPI » et la
 * préposition ; l'article contracté « des » redevient « Les » (« des Cayes » → « Les Cayes »,
 * comme le nom de la commune) ; un article en capitale fait partie du nom (« La Gonâve »).
 */
export function nomJuridiction(nomTribunal: string): string {
  const s = nomTribunal.replace(/^TPI\s+/, '')
  if (s.startsWith('des ')) return `Les ${s.slice(4)}`
  const m = /^(?:du |de la |de l[’']|d[’']|de )/.exec(s)
  return m ? s.slice(m[0].length) : s
}
