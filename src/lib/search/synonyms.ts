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

  /**
   * ── LE MINISTRE S'APPELAIT SECRÉTAIRE D'ÉTAT ──
   *
   * ⚠️ SANS CETTE ENTRÉE, « ministre » NE REND PRESQUE RIEN AVANT 1984. Ce n'est pas un
   * défaut d'océrisation : le Moniteur n'employait pas le mot. Mesuré sur le fonds versé —
   * 1981 : 6 fascicules sur 81 portent « ministre », 71 portent « secrétaire » ; 1982 :
   * 2 sur 88 contre 88 ; 1983 : 43 % contre 92 %. À partir de 1984, « ministre » devient
   * universel (99 %). Le basculement se fait entre 1983 et 1984.
   *
   * L'avocat qui cherche un acte ministériel des années 1980 lisait « aucun résultat » sur
   * 1 695 fascicules, sans que rien lui dise d'essayer l'autre mot.
   *
   * ⚠️ TROIS GRAPHIES, ET ELLES SONT TOUTES NÉCESSAIRES — mesurées dans le corpus, non
   * supposées :
   *   « secrétaire d'État »   68/81 en 1981, 84/88 en 1982
   *   « secrétaire d État »   l'OCR perd l'apostrophe : 8 fascicules en 1981, 17 en 1982
   *   « Secrétairerie »       le DÉPARTEMENT lui-même (Secrétairerie d'État) : 53, 73, 77
   *
   * La réciproque est fournie : qui cherche « secrétaire d'État » doit aussi trouver les
   * textes postérieurs à 1984, qui disent « ministre ».
   *
   * ⚠️ « secrétaire » SEUL N'EST PAS UNE EXPANSION : secrétaire de séance, secrétaire
   * général, secrétaire du tribunal… il est partout, et l'ajouter noierait la requête.
   * C'est la LOCUTION qui désigne le membre du gouvernement.
   */
  ministre: ["secrétaire d'État", 'secretaire d etat', 'secrétairerie'],
  ministres: ["secrétaire d'État", 'secretaire d etat', 'secrétairerie'],
  "secrétaire d'état": ['ministre'],
  'secretaire d etat': ['ministre'],
  ministère: ['secrétairerie', "secrétairerie d'État"],
  secrétairerie: ['ministère', 'ministre'],
  minister: ['ministre', "secrétaire d'État"],

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
    // Déclenchement par TOKEN/bigramme exact (out), ou par phrase pour les clés
    // multi-mots (espace) — jamais par sous-chaîne d'un mot unique : « incorporation »
    // ne doit pas activer la clé « corporation » (→ surlignage parasite de « sa »).
    if (out.has(nkey) || (nkey.includes(' ') && raw.includes(nkey))) {
      for (const e of expansions) out.add(NORMALIZE(e))
    }
  }
  return [...out].filter((t) => t.length >= 2)
}
