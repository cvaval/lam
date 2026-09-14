/**
 * REGISTRE DES CIBLES DU RÉPERTOIRE ALPHABÉTIQUE (Salès) — clé canonique → texte du corpus.
 *
 * Le recueil désigne ses renvois par sigle (« CTA », « C.P.C. ») ou par nom daté (« Loi
 * organique … du 28 août 1967 »). La clé `cible` de `JurisExtraitRef` est stable et lisible ;
 * ce registre dit comment la RÉSOUDRE vers un `Document`. Il est consulté par le résolveur
 * (`scripts/resoudre-renvois-raejh.ts`) ET par le lecteur d'article, qui doit savoir sous
 * quelles clés le document qu'il affiche est cité.
 *
 * ⚠️ DEUX NUMÉROTATIONS POUR UN MÊME CODE. « C.T. » (numérotation d'origine, elle-même en
 * millésimes 1961 / 1984) et « CTA » (édition annotée — celle qui est en base) visent le
 * Code du travail, mais PAS les mêmes numéros : « article 249 C.T. [article 507 CTA] ». Seule
 * `CTA` résout directement à `#art-507`. `CT`, `CT-1961`, `CT-1984` restent en désignation
 * tant qu'une concordance n'est pas établie — visibles, non liés. Idem `CPC-1836` / `CPC-1963`
 * face au Code de procédure civile en vigueur.
 *
 * ⚠️ LES LOIS ET DÉCRETS SE RÉSOLVENT PAR DATE, et 3 916 textes de législation sur 3 993 n'ont
 * PAS d'`adoptionDate` : la date fiable est celle du TITRE — la PREMIÈRE, ancrée à la nature
 * en tête (« Loi du 13 décembre 2002 modifiant la Loi du 19 septembre 1982 » ne résout PAS
 * la loi de 1982). Voir `resoudreDate()`.
 */

/** Sigles → `Document.source` — résolution directe, article par ancre `art-N`. */
export const CIBLES_DIRECTES: Record<string, { source: string; libelle: string; articles: boolean }> = {
  CTA: { source: 'CODE_TRAVAIL_ANNOTE', libelle: 'Code du travail annoté', articles: true },
  CPC: { source: 'CODE_PROCEDURE_CIVILE', libelle: 'Code de procédure civile', articles: true },
  CC: { source: 'CODE_CIVIL_ANNOTE', libelle: 'Code civil', articles: true },
  CIC: { source: 'CODE_INSTRUCTION_CRIMINELLE', libelle: "Code d'instruction criminelle", articles: true },
  CP: { source: 'CODE_PENAL_ANNOTE', libelle: 'Code pénal', articles: true },
  CCOM: { source: 'CODE_COMMERCE_ANNOTE', libelle: 'Code de commerce', articles: true },
  'CONST-1987': { source: 'CONSTITUTION_1987', libelle: 'Constitution de 1987', articles: true },
}

/**
 * Sigles à numérotation DIFFÉRENTE du texte en base : le texte se lie, l'article NON, tant
 * qu'aucune concordance n'existe. Le renvoi reste lisible et honnête — « article 249 C.T. »
 * s'affiche, sans prétendre que c'est l'article 249 de l'édition annotée.
 */
export const CIBLES_SANS_CONCORDANCE: Record<string, { source: string; libelle: string }> = {
  CT: { source: 'CODE_TRAVAIL_ANNOTE', libelle: 'Code du travail (numérotation d’origine)' },
  'CT-1961': { source: 'CODE_TRAVAIL_ANNOTE', libelle: 'Code du travail de 1961' },
  'CT-1984': { source: 'CODE_TRAVAIL_ANNOTE', libelle: 'Code du travail de 1984' },
  'CPC-1836': { source: 'CODE_PROCEDURE_CIVILE', libelle: 'Code de procédure civile de 1836' },
  'CPC-1963': { source: 'CODE_PROCEDURE_CIVILE', libelle: 'Code de procédure civile de 1963' },
}

/** Clés que porte un document donné — pour que la page d'un article demande ses extraits. */
export function clesPourSource(source: string | null | undefined): string[] {
  if (!source) return []
  return Object.entries(CIBLES_DIRECTES)
    .filter(([, v]) => v.source === source)
    .map(([k]) => k)
}

const MOIS: Record<string, number> = { janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12 }
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * Première date d'un titre, ANCRÉE à la nature en tête : « Loi du 4 septembre 1918 sur
 * l'appel » → { nature: 'LOI', iso: '1918-09-04' }. Un titre qui ne commence pas par une
 * nature datée ne résout rien — c'est voulu.
 */
export function dateEnTeteDuTitre(titre: string): { nature: 'LOI' | 'DECRET' | 'ARRETE'; iso: string } | null {
  const m = /^\s*(loi|d[ée]cret(?:-loi)?|arr[êe]t[ée])\s+(?:organique\s+|[a-zéèêàç' ]{0,60}?\s+)?du\s+(\d{1,2})(?:er)?\s+([a-zéû]+)\s+(\d{4})/i.exec(titre)
  if (!m) return null
  const mois = MOIS[fold(m[3])]
  if (!mois) return null
  const nature = /^loi/i.test(m[1]) ? 'LOI' : /^arr/i.test(m[1]) ? 'ARRETE' : 'DECRET'
  return { nature, iso: `${m[4]}-${String(mois).padStart(2, '0')}-${m[2].padStart(2, '0')}` }
}

/** Décompose une clé datée : « LOI-1967-08-28 » → { nature, iso }. */
export function cleDatee(cible: string): { nature: 'LOI' | 'DECRET'; iso: string } | null {
  const m = /^(LOI|DECRET)-(\d{4}-\d{2}-\d{2})$/.exec(cible)
  return m ? { nature: m[1] as 'LOI' | 'DECRET', iso: m[2] } : null
}
