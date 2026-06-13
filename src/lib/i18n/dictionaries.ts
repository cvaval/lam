import { fr } from './locales/fr'
import { en } from './locales/en'
import { ht } from './locales/ht'
import type { Locale } from '../types'

/**
 * Catalogue i18n complet (§02), scindé par langue dans ./locales/ (constat
 * d'audit #53 — un fichier de 950 lignes rendait toute édition pénible).
 *
 *  - locales/fr.ts : forme CANONIQUE — c'est elle qui définit le type Dictionary ;
 *  - locales/en.ts, locales/ht.ts : typés `Dictionary` → une clé manquante ou en
 *    trop est une erreur de compilation ;
 *  - l'interface (« chrome ») est traduite FR/EN/HT ; le texte officiel n'est
 *    JAMAIS traduit (cf. Document.bodyOriginal).
 *
 * API inchangée : getDictionary(locale) et le type Dictionary.
 */
export type Dictionary = typeof fr

const DICTS: Record<Locale, Dictionary> = { fr, en, ht }

export function getDictionary(locale: Locale): Dictionary {
  return DICTS[locale] ?? DICTS.fr
}
