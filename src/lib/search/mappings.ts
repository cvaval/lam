import { SYNONYMS } from './synonyms'
import { DOC_TYPE_META } from '../brand'
import type { DocType } from '../types'

/**
 * Réglages d'index OpenSearch/Elasticsearch (§09) :
 *   - index par type (1–6) + index transversal sociétés
 *   - analyseur FR (élision, minuscules, asciifolding, stemming léger)
 *   - synonymie EN→FR via synonym_graph (dérivée de synonyms.ts)
 *   - surlignage Sitwon des termes assuré par highlight côté requête
 */
export const INDEX_PREFIX = 'lam'

export function indexNameForType(type: DocType): string {
  return `${INDEX_PREFIX}_${DOC_TYPE_META[type].slug}`
}
export const COMPANIES_INDEX = `${INDEX_PREFIX}_companies`

/** Lignes de synonymes au format Solr explicite « en => fr1, fr2 » (direction EN→FR). */
export function synonymLines(): string[] {
  return Object.entries(SYNONYMS).map(([en, fr]) => `${en} => ${[en, ...fr].join(', ')}`)
}

export function analysisSettings() {
  return {
    analysis: {
      filter: {
        fr_elision: {
          type: 'elision',
          articles_case: true,
          articles: ['l', 'm', 't', 'qu', 'n', 's', 'j', 'd', 'c', 'jusqu', 'quoiqu', 'lorsqu', 'puisqu'],
        },
        fr_stop: { type: 'stop', stopwords: '_french_' },
        fr_stemmer: { type: 'stemmer', language: 'light_french' },
        en_fr_synonyms: { type: 'synonym_graph', synonyms: synonymLines() },
      },
      analyzer: {
        // indexation : FR + repli accentué
        lv_fr: {
          tokenizer: 'standard',
          filter: ['fr_elision', 'lowercase', 'fr_stop', 'asciifolding', 'fr_stemmer'],
        },
        // requête : ajoute la synonymie EN→FR (synonym_graph en search_analyzer)
        lv_fr_search: {
          tokenizer: 'standard',
          filter: ['fr_elision', 'lowercase', 'en_fr_synonyms', 'fr_stop', 'asciifolding', 'fr_stemmer'],
        },
      },
    },
  }
}

export function documentMapping() {
  const txt = { type: 'text', analyzer: 'lv_fr', search_analyzer: 'lv_fr_search' as const }
  return {
    properties: {
      type: { type: 'keyword' },
      status: { type: 'keyword' },
      category: { type: 'keyword' },
      titleFr: { ...txt, fields: { raw: { type: 'keyword' } } },
      titleEn: txt,
      titleHt: txt,
      bodyOriginal: txt,
      summaryFr: txt,
      summaryEn: txt,
      summaryHt: txt,
      // Les encadrés pédagogiques means* ne sont PAS cherchables (affichage seul,
      // page document) — volontairement absents de l'index et de SEARCH_FIELD_WEIGHTS.
      number: { type: 'keyword' },
      bhdaNumber: { type: 'keyword' },
      holder: { ...txt, fields: { raw: { type: 'keyword' } } },
      author: txt,
      revue: { type: 'keyword' },
      keywords: txt, // mots-clés thématiques « kw1; kw2 » — cherchables, analyseur FR
      matiere: { type: 'keyword' },
      juridiction: { type: 'keyword' },
      niceClasses: { type: 'keyword' },
      fiscalYear: { type: 'integer' },
      moniteurRef: { type: 'text', analyzer: 'lv_fr' },
      publicationDate: { type: 'date' },
    },
  }
}

export function companyMapping() {
  const txt = { type: 'text', analyzer: 'lv_fr', search_analyzer: 'lv_fr_search' as const }
  return {
    properties: {
      name: { ...txt, fields: { raw: { type: 'keyword' } } },
      nif: { type: 'keyword' },
      rcNumber: { type: 'keyword' },
      capital: { type: 'keyword' },
      address: txt,
      refCount: { type: 'integer' }, // nb de publications au Moniteur (affiché par ResultCard)
    },
  }
}

export function indexSettings() {
  return { settings: { number_of_shards: 1, number_of_replicas: 0, ...analysisSettings() } }
}
