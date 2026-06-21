import { fold } from './normalize'

/**
 * Synonymie translingue EN→FR (§02). Une requête EN retrouve les documents FR.
 * Format aligné sur le fichier de synonymes OpenSearch (mappings.ts) afin que les
 * deux moteurs se comportent de façon identique.
 *
 * Chaque entrée : terme(s) → expansions. Le moteur FTS ajoute les expansions aux
 * termes recherchés ; OpenSearch utilise le même jeu via un synonym_graph filter.
 */
export const SYNONYMS: Record<string, string[]> = {
  // Marques (type 6)
  trademark: ['marque', 'marque de commerce', 'marque de fabrique'],
  trademarks: ['marque', 'marque de commerce'],
  mark: ['marque'],
  brand: ['marque'],
  'prior art': ['antériorité', 'anteriorite'],
  // Législation (type 1)
  law: ['loi', 'législation', 'legislation'],
  legislation: ['législation', 'loi'],
  decree: ['décret', 'decret', 'arrêté', 'arrete'],
  act: ['loi', 'arrêté'],
  'in force': ['en vigueur'],
  repealed: ['abrogé', 'abroge'],
  // BRH (type 2)
  circular: ['circulaire'],
  bank: ['banque'],
  'central bank': ['banque centrale', 'brh', 'banque de la république'],
  // Jurisprudence (type 3)
  'case law': ['jurisprudence'],
  caselaw: ['jurisprudence'],
  court: ['tribunal', 'cour', 'juridiction'],
  'supreme court': ['cassation', 'cour de cassation'],
  appeal: ['appel', "cour d'appel"],
  ruling: ['arrêt', 'arret', 'jugement'],
  judgment: ['jugement', 'arrêt'],
  // Doctrine (type 4)
  doctrine: ['doctrine'],
  author: ['auteur'],
  journal: ['revue'],
  // Finances (type 5)
  budget: ['budget', 'loi de finances'],
  'finance act': ['loi de finances'],
  tax: ['impôt', 'impot', 'fiscal', 'taxe'],
  'fiscal year': ['exercice fiscal', 'exercice'],
  // Sociétés (index transversal)
  company: ['société', 'societe'],
  corporation: ['société anonyme', 'sa'],
  capital: ['capital'],
  bylaws: ['statuts'],
  incorporation: ['constitution', 'statuts'],

  // ── Matières bancaires / BRH (FR + EN) ──
  blanchiment: ['lbc', 'lbc/ft', 'lutte contre le blanchiment', 'financement du terrorisme', 'aml'],
  'money laundering': ['blanchiment', 'lbc', 'lutte contre le blanchiment'],
  aml: ['blanchiment', 'lbc/ft'],
  'reserve requirements': ['réserves obligatoires', 'reserves obligatoires'],
  'réserves obligatoires': ['reserve', 'coefficient de réserves'],
  'exchange rate': ['taux de change', 'change', 'devises'],
  change: ['taux de change', 'devises', 'foreign exchange'],
  microfinance: ['imf', 'institution de microfinance', 'microcrédit', 'microcredit'],
  imf: ['microfinance', 'institution de microfinance'],
  cooperative: ['coopérative', 'cooperative', 'cec', 'caisse populaire'],
  coopérative: ['cec', 'caisse populaire', "coopérative d'épargne et de crédit"],
  cec: ['coopérative', 'caisse populaire', "coopérative d'épargne et de crédit"],
  'consumer protection': ['protection du consommateur', 'protection de la clientèle'],
  'secret bancaire': ['banking secrecy', 'confidentialité bancaire'],
  'banking secrecy': ['secret bancaire'],
  insurance: ['assurance'],
  ucref: ['unité centrale de renseignements financiers'],
  ulcc: ['unité de lutte contre la corruption'],

  // ── Créole haïtien → français (§02 : le corpus est en français) ──
  lwa: ['loi', 'législation'],
  sikilè: ['circulaire'],
  sirkilè: ['circulaire'],
  tribinal: ['tribunal', 'cour', 'juridiction'],
  jijman: ['jugement', 'arrêt'],
  jeneral: ['arrêté'],
  sosyete: ['société', 'societe'],
  bankè: ['banque', 'bancaire'],
  rezèv: ['réserve', 'réserves obligatoires'],
  enpo: ['impôt', 'taxe', 'fiscal'],
  taks: ['taxe', 'impôt'],
  asirans: ['assurance'],
}

const NORMALIZE = (s: string) => fold(s).trim()

/**
 * Étend une requête : tokens d'origine + expansions FR des termes EN reconnus
 * (uni- et bigrammes). Retourne une liste normalisée et dédupliquée.
 */
export function expandQuery(q: string): string[] {
  const raw = NORMALIZE(q)
  const tokens = raw.split(/\s+/).filter(Boolean)
  const out = new Set<string>(tokens)

  // bigrammes (ex. « case law »)
  for (let i = 0; i < tokens.length - 1; i++) {
    const bg = `${tokens[i]} ${tokens[i + 1]}`
    out.add(bg)
  }

  for (const [key, expansions] of Object.entries(SYNONYMS)) {
    const nkey = NORMALIZE(key)
    if (out.has(nkey) || raw.includes(nkey)) {
      for (const e of expansions) out.add(NORMALIZE(e))
    }
  }
  return [...out].filter((t) => t.length >= 2)
}
