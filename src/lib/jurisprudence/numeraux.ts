/**
 * Nombres et dates écrits EN TOUTES LETTRES, tels que les rédigent les arrêts.
 *
 * Les recueils de la Cour de cassation ne datent pas leurs arrêts en chiffres. La date se lit
 * dans la formule de clôture : « Ainsi jugé et prononcé par Nous, …, Juges, en audience
 * publique du Dix-Sept Novembre Mil Neuf Cent Soixante-Cinq, en présence de … ». Sans lecture
 * de ces numéraux, 33 des 82 arrêts de l'exercice 1965-1966 arrivaient sans date — et une date
 * manquante n'est pas un détail : elle porte le tri, l'affichage et la citation.
 *
 * ⚠️ L'ANCRAGE COMPTE AUTANT QUE LA CONVERSION. Un arrêt cite plusieurs dates en lettres :
 * celle du jugement attaqué, celle de l'audience où le rapporteur a lu son rapport, celle du
 * pourvoi. Prendre « la première date en lettres du texte » donne une date fausse dans un cas
 * sur quatre — mesuré : l'arrêt n° 1 de la Première Section, rendu le 17 novembre 1965,
 * annonce d'abord « l'audience publique du dix-huit Octobre ». Seule la formule de CLÔTURE
 * fait foi, et c'est sur elle qu'on s'ancre.
 */

/** Unités et dizaines. « premier » vaut 1 : un quantième s'écrit ainsi le 1er du mois. */
const MOTS: Record<string, number> = {
  zero: 0, zéro: 0,
  un: 1, une: 1, premier: 1, première: 1, premiere: 1,
  deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9,
  dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16,
  vingt: 20, vingts: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60,
  cent: 100, cents: 100, mil: 1000, mille: 1000,
}

/** Jours de la semaine : ils précèdent parfois le quantième et ne comptent pas. */
const JOURS_SEMAINE = new Set(['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'])

/** Accents et casse retirés, traits d'union et apostrophes ramenés à des espaces. */
export function replier(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-–—'’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Quantième d'un mois écrit en lettres → 1 à 31, ou null.
 *
 * La somme suffit dans ce domaine : « dix sept » = 10 + 7, « vingt et un » = 20 + 1,
 * « trente et un » = 30 + 1. Le résultat est BORNÉ à 1-31 — c'est le garde-fou : une phrase
 * mal découpée produirait un nombre hors bornes plutôt qu'un faux quantième plausible.
 */
export function quantiemeEnLettres(phrase: string): number | null {
  const mots = replier(phrase).split(' ').filter((m) => m && m !== 'et' && !JOURS_SEMAINE.has(m))
  if (!mots.length) return null
  let total = 0
  for (const m of mots) {
    const v = MOTS[m]
    // Un mot inconnu invalide la lecture : mieux vaut aucune date qu'une date inventée.
    if (v === undefined || v >= 100) return null
    total += v
  }
  return total >= 1 && total <= 31 ? total : null
}

/**
 * Millésime écrit en lettres → l'année, ou null. « Mil Neuf Cent Soixante-Cinq » = 1965.
 *
 * Ici la somme ne suffit plus : « neuf cent » vaut 900, pas 109. On multiplie donc ce qui
 * précède « cent », et on additionne le reste.
 */
export function anneeEnLettres(phrase: string): number | null {
  const mots = replier(phrase).split(' ').filter((m) => m && m !== 'et')
  if (!mots.length) return null
  let total = 0
  let courant = 0
  for (const m of mots) {
    const v = MOTS[m]
    if (v === undefined) return null
    if (v === 1000) {
      total += (courant || 1) * 1000
      courant = 0
    } else if (v === 100) {
      total += (courant || 1) * 100
      courant = 0
    } else if (v === 20 && courant === 4) {
      // « quatre-vingt » : la seule multiplication du français en deçà de cent.
      courant = 80
    } else {
      courant += v
    }
  }
  total += courant
  // Bornes volontairement larges mais finies : un recueil du XIXᵉ reste lisible, une aberration
  // de découpage (« mil neuf cent » suivi d'un nom propre) est rejetée.
  return total >= 1800 && total <= 2100 ? total : null
}

const MOIS: Record<string, number> = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
}
const NOMS_MOIS = Object.keys(MOIS).join('|')

/**
 * Date de l'ARRÊT, lue dans sa formule de clôture. Rend « AAAA-MM-JJ », ou null.
 *
 * On exige les trois éléments — quantième, mois, millésime — et on refuse tout ce qui ne se
 * lit pas entièrement. Une date partielle serait pire qu'aucune : elle passerait les
 * contrôles en aval sans que personne ne sache qu'elle a été devinée.
 */
export function dateDeLArret(texte: string): string | null {
  const t = texte.replace(/\s+/g, ' ')
  // ⚠️ L'INVARIANT DE LA FORMULE DE CLÔTURE EST « PRONONCÉ PAR NOUS », PAS « AINSI JUGÉ ».
  // Un arrêt sur les 82 (2ᵉ Section, n° 9) ouvre sa formule par « Prononcé par Nous, Félix
  // DIAMBOIS, Vice-Président, … » sans « Ainsi jugé » : l'ancrage échouait, la lecture
  // retombait sur le texte entier et datait l'arrêt du 14 octobre — l'audience où le
  // rapporteur avait lu son rapport — au lieu du 23 décembre. Deux mois et demi d'écart,
  // sur un arrêt qui paraissait parfaitement lu.
  const ancres = [...t.matchAll(/(?:ainsi\s+(?:jug|d[ée]lib)[ée]r?[ée]e?\s+et\s+)?prononc[ée]e?\s+par\s+nous/gi)]
  // La DERNIÈRE : un arrêt peut citer la formule d'une décision antérieure avant de rendre
  // la sienne. La sienne clôt le texte.
  const depuis = ancres.length ? t.slice(ancres[ancres.length - 1].index) : t
  const m = new RegExp(
    // « en audience publique du … », « à l'audience publique et solennelle du … ».
    // ⚠️ Le quantième et le millésime s'écrivent tantôt en lettres, tantôt EN CHIFFRES, et
    // parfois les deux : « du 30 Mai 1966, (Trente Mai Mil Neuf Cent Soixante Six) ». Les deux
    // écritures sont donc acceptées, y compris mêlées — « du 20 Juin Mil Neuf Cent Soixante-Six ».
    String.raw`audience[^.;]{0,80}?\bdu\s+(\d{1,2}|[\p{L}\s'’-]{3,40}?)\s+(${NOMS_MOIS})\s+(\d{4}|(?:mil|mille)[\p{L}\s'’-]{4,60}?)(?=\s*[,;.(]|\s+en\s+pr[ée]sence|\s+avec\s|\s+et\s+assist)`,
    'iu',
  ).exec(replier(depuis))
  if (!m) return null
  const j = /^\d+$/.test(m[1]) ? Number(m[1]) : quantiemeEnLettres(m[1])
  const mo = MOIS[replier(m[2])]
  const a = /^\d+$/.test(m[3]) ? Number(m[3]) : anneeEnLettres(m[3])
  if (!j || !mo || !a || j < 1 || j > 31 || a < 1800 || a > 2100) return null
  // Le quantième doit exister dans ce mois-là : 31 septembre n'est pas une date.
  if (j > new Date(Date.UTC(a, mo, 0)).getUTCDate()) return null
  return `${a}-${String(mo).padStart(2, '0')}-${String(j).padStart(2, '0')}`
}
