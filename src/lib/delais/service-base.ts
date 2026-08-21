/**
 * LE SEUL FICHIER DU DOSSIER QUI TOUCHE PRISMA. Tout le reste de `src/lib/delais/` est pur
 * (cf. `noyau-pur.test.ts`) : la lecture de la base est isolée ici pour que le moteur reste
 * testable sans base — et les tables `Delai*` n'existent pas encore en production.
 *
 * ⚠️ **LES TABLES NE SONT PAS MIGRÉES.** Le client Prisma les connaît (il est généré depuis
 * `schema.prisma`), mais toute requête échoue à l'exécution tant que la migration n'a pas été
 * passée — décision humaine, § 5.1. `estSchemaAbsent()` reconnaît cette erreur-là pour que les
 * routes rendent un **503 explicite** plutôt qu'un 500 muet : « la table n'existe pas encore »
 * est une information, « Internal Server Error » n'en est pas une.
 *
 * ⚠️ **AUCUN REPLI SUR LE FICHIER DE GRAINE.** Il serait tentant, tant que la base est vide,
 * de servir `REPERTOIRE`/`CALENDRIER_V1` depuis le code. Ce serait poser une seconde source de
 * vérité : le jour où la rédaction masquerait une entrée en base, le repli continuerait de la
 * servir. La base est la source unique (§ 5.2) ; sans elle, on le dit.
 */
import { prisma } from '../db'
import type { EntreeCalendrier } from './feries'
import type { EntreeDelai } from './calcul'
import type { LigneDelaiEntry, LigneDelaiFerie, StatutEntree } from './depuis-base'
import { ligneDepuisPayload, versCalendrier, versEntreeDelai } from './depuis-base'

/**
 * P2021 = « The table does not exist in the current database » ; 42P01 est le SQLSTATE
 * PostgreSQL correspondant, qui remonte par les requêtes brutes. On teste les deux plutôt que
 * le message, qui est traduit et versionné.
 *
 * ⚠️ TROISIÈME FORME, constatée le 20 août sur le serveur de développement : quand le client
 * Prisma en mémoire est ANTÉRIEUR à l'ajout des modèles `Delai*`, `prisma.delaiEntry` vaut
 * `undefined` et l'appel casse en `TypeError` — jamais en P2021. Les deux routes publiques
 * rendaient alors un 500 muet, et la page un écran d'erreur : exactement ce que le 503
 * explicite existe pour éviter. Le motif est volontairement ÉTROIT — il ne reconnaît que
 * l'accès à une méthode de délégué Prisma sur `undefined` — pour ne pas avaler un vrai
 * défaut de programmation.
 */
const DELEGUE_ABSENT =
  /Cannot read propert(?:y|ies) of undefined \(reading '(?:find|create|update|delete|upsert|count|aggregate|groupBy)/

/**
 * § 7.4 / § 7.5 — LA COURSE SUR LA NUMÉROTATION DE VERSION. `versionCourante()` lit le
 * maximum puis la publication écrit `base + 1`, sans verrou : deux éditions concurrentes
 * calculent la même version `N+1`. Les contraintes `@@unique([versionCalendrier, cle])` et
 * `@@unique([versionFenetres, matiere])` empêchent la corruption — mais la seconde
 * transaction lève un `P2002` qui, non reconnu, remontait une **500 brute** : l'éditeur ne
 * savait pas que sa version avait été doublée par une autre. On répond 409, et on invite à
 * recharger l'écran.
 */
export function estVersionConcurrente(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'P2002'
}

/**
 * Le client Prisma est-il ANTÉRIEUR aux modèles `Delai*` ? Ce n'est pas la même panne qu'une
 * table absente, et le remède n'est pas le même : ici `npx prisma generate`, là la migration.
 * Les confondre envoyait la rédaction lancer un script d'écriture pour un problème de client.
 */
export function estDelegueAbsent(e: unknown): boolean {
  const o = e as { message?: unknown } | null
  if (!o || typeof o !== 'object') return false
  return typeof o.message === 'string' && DELEGUE_ABSENT.test(o.message)
}

export function estSchemaAbsent(e: unknown): boolean {
  const o = e as { code?: unknown; meta?: { code?: unknown }; message?: unknown } | null
  if (!o || typeof o !== 'object') return false
  if (o.code === 'P2021' || o.code === '42P01' || o.meta?.code === '42P01') return true
  return typeof o.message === 'string' && DELEGUE_ABSENT.test(o.message)
}

export type ChargementEntree =
  | { statut: 'OK'; contexte: ContexteEntree }
  | { statut: 'INTROUVABLE' }
  | { statut: 'REVISION_INTROUVABLE' }
  | { statut: 'LIGNE_ILLISIBLE'; motif: string }

export type ContexteEntree = {
  /** L'entrée telle que le moteur la consomme, à la révision demandée. */
  entree: EntreeDelai
  /** La ligne complète — l'écran y prend les libellés traduits, la sanction, le tableau. */
  ligne: LigneDelaiEntry
  id: string
  /** `visible` | `masque` | `supprime` (§ 7.2, § 7.3). */
  statutEntree: StatutEntree
  masqueMotif: string | null
  /** AAAA-MM-JJ, ou null. Date d'affichage, jamais une date de calcul. */
  masqueLe: string | null
  revisionDemandee: number
  revisionCourante: number
  /** Date de création de la révision courante — « la règle a changé le … » (§ 7.3). */
  revisionCouranteLe: string | null
}

const jour = (d: Date | null | undefined): string | null =>
  d ? d.toISOString().slice(0, 10) : null

/**
 * Lit une entrée par son `slug`, éventuellement À UNE RÉVISION ANTÉRIEURE.
 *
 * La révision demandée qui n'existe pas est un REFUS, jamais un repli silencieux sur la
 * révision courante : un repli afficherait une date sous une règle que l'utilisatrice n'a pas
 * choisie (§ 7.3).
 */
export async function chargerEntree(slug: string, revision?: number): Promise<ChargementEntree> {
  const courante = await prisma.delaiEntry.findUnique({ where: { slug } })
  if (!courante) return { statut: 'INTROUVABLE' }

  let ligne: LigneDelaiEntry = courante as unknown as LigneDelaiEntry
  const revisionDemandee = revision ?? courante.revision

  if (revision != null && revision !== courante.revision) {
    const gelee = await prisma.delaiEntryRevision.findUnique({
      where: { entryId_revision: { entryId: courante.id, revision } },
      select: { payloadJson: true },
    })
    if (!gelee) return { statut: 'REVISION_INTROUVABLE' }
    const relue = ligneDepuisPayload(gelee.payloadJson)
    if (!relue.ok) return { statut: 'LIGNE_ILLISIBLE', motif: relue.motif }
    ligne = relue.valeur
  }

  const conversion = versEntreeDelai({ ...ligne, revision: revisionDemandee })
  if (!conversion.ok) return { statut: 'LIGNE_ILLISIBLE', motif: conversion.motif }

  // La date du changement de règle est celle de la copie gelée de la révision COURANTE :
  // c'est le moment où la version d'avant a cessé d'être la règle en vigueur.
  const marqueur = await prisma.delaiEntryRevision.findUnique({
    where: { entryId_revision: { entryId: courante.id, revision: courante.revision } },
    select: { createdAt: true },
  })

  return {
    statut: 'OK',
    contexte: {
      entree: conversion.valeur,
      ligne,
      id: courante.id,
      statutEntree: (courante.statut as StatutEntree) ?? 'visible',
      masqueMotif: courante.masqueMotif ?? null,
      masqueLe: jour(courante.masqueAt),
      revisionDemandee,
      revisionCourante: courante.revision,
      revisionCouranteLe: jour(marqueur?.createdAt ?? courante.updatedAt),
    },
  }
}

/**
 * Le jeu complet d'une version du calendrier. `null` quand la version n'existe pas — un
 * permalien qui nomme une version inconnue est un 404 franc (§ 7.3), jamais un calcul rendu
 * sous le calendrier courant.
 */
export async function chargerCalendrier(
  version: number,
): Promise<{ ok: true; entrees: readonly EntreeCalendrier[] } | { ok: false; motif: string } | null> {
  const lignes = await prisma.delaiFerie.findMany({
    where: { versionCalendrier: version },
    orderBy: [{ typeEntree: 'asc' }, { cle: 'asc' }],
  })
  if (lignes.length === 0) return null
  const conversion = versCalendrier(lignes as unknown as LigneDelaiFerie[])
  return conversion.ok ? { ok: true, entrees: conversion.valeur } : { ok: false, motif: conversion.motif }
}

export type FenetreLue = {
  matiere: string
  heureDebut: number
  heureFin: number
  source: string
  sourceDocId: string | null
  nullite: boolean
  nulliteTexteFr: string | null
}

/** Les fenêtres de signification d'une version (§ 7.5). `null` = version inconnue → 404. */
export async function chargerFenetres(version: number): Promise<FenetreLue[] | null> {
  const lignes = await prisma.delaiFenetreSignification.findMany({
    where: { versionFenetres: version },
    orderBy: { matiere: 'asc' },
    select: {
      matiere: true,
      heureDebut: true,
      heureFin: true,
      source: true,
      sourceDocId: true,
      nullite: true,
      nulliteTexteFr: true,
    },
  })
  return lignes.length === 0 ? null : lignes
}

/** La version la plus haute présente en base — le « courant », qui n'est pas une constante. */
export async function versionCalendrierCourante(): Promise<number | null> {
  const derniere = await prisma.delaiFerie.findFirst({
    orderBy: { versionCalendrier: 'desc' },
    select: { versionCalendrier: true },
  })
  return derniere?.versionCalendrier ?? null
}

export async function versionFenetresCourante(): Promise<number | null> {
  const derniere = await prisma.delaiFenetreSignification.findFirst({
    orderBy: { versionFenetres: 'desc' },
    select: { versionFenetres: true },
  })
  return derniere?.versionFenetres ?? null
}
