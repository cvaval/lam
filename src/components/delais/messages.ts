import type { Dictionary } from '@/lib/i18n/dictionaries'

/**
 * Les codes d'erreur de la lecture publique → la phrase que l'écran affiche.
 *
 * Ce fichier n'est PAS marqué `'use client'` à dessein : la page serveur (qui rend l'erreur
 * dans le HTML initial) et le formulaire client s'en servent tous les deux, et une table
 * recopiée des deux côtés finirait par diverger — un code y perdrait sa phrase et le visiteur
 * lirait un identifiant technique.
 *
 * Un code inconnu ne rend jamais son propre nom : `errInvalid` est une phrase, « P2021 » n'en
 * est pas une.
 */
export function messageErreur(t: Dictionary, code: string): string {
  const d = t.delais
  const table: Record<string, string> = {
    dateImpossible: d.errDateImpossible,
    kilometrageInvalide: d.errKilometrage,
    autreIncomplet: d.errOtherIncomplete,
    entreeInconnue: d.errUnknownEntry,
    revisionInconnue: d.errUnknownRevision,
    versionCalendrierInconnue: d.errUnknownCalendar,
    versionFenetresInconnue: d.errUnknownWindows,
    // § 4.6 — la version des règles de lecture, refusée au même titre que celle du calendrier.
    versionReglesInconnue: d.errUnknownRules,
    entreeRetiree: d.errWithdrawn,
    rate: d.errRate,
    delaisSchemaAbsent: d.errNotReady,
    delaisNonInitialises: d.errNotReady,
    calendrierIllisible: d.errUnreadable,
    entreeIllisible: d.errUnreadable,
    borneHistorique: d.errBeforeBound,
    invalidFields: d.errInvalid,
    // Les deux refus des SURFACES PUBLIQUES : deux champs, et deux seulement. Une entrée du
    // répertoire demandée sans session est refusée, pas servie ; et publiquement on ne
    // calcule que du franc.
    repertoireReserve: d.errRepertoireReserve,
    francSeulement: d.errFrancSeulement,
    // § 2 — le mode de décompte est un choix de la SAISIE MANUELLE. Sur une entrée du
    // répertoire il vient du texte : le paramètre est refusé, jamais ignoré.
    regimeImpose: d.errRegimeImpose,
  }
  return table[code] ?? d.errInvalid
}
