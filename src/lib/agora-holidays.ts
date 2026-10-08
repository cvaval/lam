/**
 * Fêtes légales du portail public — **LE CALENDRIER DE LA PLATEFORME, PAS UNE SECONDE LISTE.**
 *
 * ⚠️ La maquette du portail (8 oct. 2026) portait la liste d'une autre application (Equinox),
 * copiée en JSON. Elle contredisait le calendrier que le calculateur de délais applique :
 * « Jour de Dessalines » au 20 OCTOBRE (le décret du 11 décembre 2024 dit 20 septembre), le
 * 14 août absent, la Toussaint « sous réserve de décret » alors que ce décret l'institue, le
 * Lundi Gras en journée entière (c'est une demi-journée). Une plateforme juridique ne publie
 * pas deux calendriers qui se démentent : ce module ne fait que PRÉSENTER
 * `src/lib/delais/feries.ts`. Aucune date, aucun libellé n'y est saisi.
 *
 * Aucun `Date` ici non plus, pour la même raison que dans `feries.ts` : une fête est une date
 * CIVILE, et un fuseau n'a pas à la faire glisser d'un jour.
 */
import type { CivilDate } from '@/lib/delais/civil'
import { comparer, parseIso } from '@/lib/delais/civil'
import { dateEntree, libelle, noteJournee, type EntreeCalendrier, type Locale } from '@/lib/delais/feries'

/**
 * Les trois familles que l'écran distingue — et elles ne disent pas la même chose :
 *  - `nationale` : les cinq fêtes de la Constitution (art. 275.1) ;
 *  - `legale` : les fêtes légales du décret applicable ;
 *  - `arrete` : les jours « à surveiller » — chômés certaines années, PAR ARRÊTÉ. Ce ne sont
 *    pas des jours fériés : l'écran ne doit jamais les présenter comme tels.
 */
export type CategoriePublique = 'nationale' | 'legale' | 'arrete'

export type FetePublique = {
  cle: string
  categorie: CategoriePublique
  libelle: string
  date: CivilDate
  demiJournee: boolean
  /** Note de demi-journée, dans la langue demandée (repli français) ; vide sinon. */
  note: string
  source: string
}

/**
 * Première année proposée : le décret du 11 décembre 2024 est la liste en vigueur, et 2025
 * est la première année qu'il couvre entière. Avant, la liste change (décret de 1989) — le
 * calculateur sait la rejouer, ce portail ne la présente pas.
 */
export const PREMIERE_ANNEE_PUBLIQUE = 2025

export function categoriePublique(e: EntreeCalendrier): CategoriePublique {
  if (e.typeEntree === 'A_SURVEILLER') return 'arrete'
  return e.categorie === 'FETE_NATIONALE' ? 'nationale' : 'legale'
}

const RANG: Record<CategoriePublique, number> = { nationale: 0, legale: 1, arrete: 2 }

/** Les entrées d'une année, datées, triées — celles qui ne s'appliquaient pas encore en sont exclues. */
export function fetesDeLAnnee(
  entrees: readonly EntreeCalendrier[],
  annee: number,
  locale: Locale,
): FetePublique[] {
  const fetes: FetePublique[] = []
  for (const e of entrees) {
    const date = dateEntree(e, annee)
    const debut = parseIso(e.appliqueDepuis)
    if (debut && comparer(date, debut) < 0) continue
    const demiJournee = e.journee === 'DEMI_JOURNEE_APRES_MIDI'
    fetes.push({
      cle: e.cle,
      categorie: categoriePublique(e),
      libelle: libelle(e, locale),
      date,
      demiJournee,
      note: demiJournee ? noteJournee(e, locale) : '',
      source: e.source,
    })
  }
  return fetes.sort((a, b) => comparer(a.date, b.date) || RANG[a.categorie] - RANG[b.categorie])
}

/**
 * Prochaine fête nationale ou légale à partir d'aujourd'hui (inclus). Un jour « à surveiller »
 * n'en est jamais une : il n'est chômé que si un arrêté le dit, l'année venue.
 */
export function prochaineFete(
  entrees: readonly EntreeCalendrier[],
  aujourdhui: CivilDate,
  locale: Locale,
): FetePublique | null {
  for (const annee of [aujourdhui.y, aujourdhui.y + 1]) {
    const suivante = fetesDeLAnnee(entrees, annee, locale).find(
      (f) => f.categorie !== 'arrete' && comparer(f.date, aujourdhui) >= 0,
    )
    if (suivante) return suivante
  }
  return null
}

/** Aujourd'hui à Port-au-Prince, en date civile — jamais minuit UTC (leçon de `debutDeJourneeHaiti`). */
export function aujourdhuiHaiti(instant: Date = new Date()): CivilDate {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'America/Port-au-Prince',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)
  const champ = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return { y: champ('year'), m: champ('month'), d: champ('day') }
}
