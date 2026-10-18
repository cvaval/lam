/**
 * REGISTRE UNIQUE DES SITUATIONS de la Législation annotée — libellé, pictogramme, gamme.
 *
 * Décision de Me Vaval (17 oct. 2026) : « les codes couleurs doivent être identiques pour le même type
 * de situation : amendement, nouveau texte, radier, jurisprudence, etc. » ; vocabulaire : « Nouveau pour
 * un texte nouveau et Abrogé pour une section éliminée. Amendé pour un texte modifié. »
 * Spécification : docs/prompt-harmonisation-replis-legislation-annotee.md.
 *
 * Une situation a UN libellé, UN pictogramme et UNE gamme, partout où elle se montre : pastille
 * d'article, statut de fiche, listes, historique, bloc « Citations », bandeaux, replis, version Word.
 * Aucun composant ne choisit plus sa couleur ni son mot : il demande au registre.
 *
 * ⚠️ Les classes Tailwind sont écrites EN ENTIER ici (le compilateur JIT ne lit que des chaînes
 * littérales) : ne jamais les reconstruire par concaténation.
 * ⚠️ La couleur ne porte jamais seule l'information : le libellé est toujours rendu, le pictogramme
 * est décoratif (`aria-hidden`).
 */
import type { Locale } from '@/lib/types'

export type Gamme =
  | 'amendement'
  | 'nouveau'
  | 'radie'
  | 'derogation'
  | 'jurisprudence'
  | 'annotations'
  | 'connexe'
  | 'note'
  | 'avenir'
  | 'neutre'

/** Classes d'une gamme : fond pâle, filet (bordure), barre gauche de 3 px, texte du filet. */
export interface ClassesGamme {
  fond: string
  filet: string
  barre: string
  texte: string
}

export const GAMMES: Record<Gamme, ClassesGamme> = {
  amendement: { fond: 'bg-etat-amendement-fond', filet: 'border-etat-amendement-filet', barre: 'border-l-etat-amendement-filet', texte: 'text-etat-amendement-filet' },
  nouveau: { fond: 'bg-etat-nouveau-fond', filet: 'border-etat-nouveau-filet', barre: 'border-l-etat-nouveau-filet', texte: 'text-etat-nouveau-filet' },
  radie: { fond: 'bg-etat-radie-fond', filet: 'border-etat-radie-filet', barre: 'border-l-etat-radie-filet', texte: 'text-etat-radie-filet' },
  derogation: { fond: 'bg-etat-derogation-fond', filet: 'border-etat-derogation-filet', barre: 'border-l-etat-derogation-filet', texte: 'text-etat-derogation-filet' },
  jurisprudence: { fond: 'bg-etat-jurisprudence-fond', filet: 'border-etat-jurisprudence-filet', barre: 'border-l-etat-jurisprudence-filet', texte: 'text-etat-jurisprudence-filet' },
  annotations: { fond: 'bg-etat-annotations-fond', filet: 'border-etat-annotations-filet', barre: 'border-l-etat-annotations-filet', texte: 'text-etat-annotations-filet' },
  connexe: { fond: 'bg-etat-connexe-fond', filet: 'border-etat-connexe-filet', barre: 'border-l-etat-connexe-filet', texte: 'text-etat-connexe-filet' },
  note: { fond: 'bg-etat-note-fond', filet: 'border-etat-note-filet', barre: 'border-l-etat-note-filet', texte: 'text-etat-note-filet' },
  avenir: { fond: 'bg-etat-avenir-fond', filet: 'border-etat-avenir-filet', barre: 'border-l-etat-avenir-filet', texte: 'text-etat-avenir-filet' },
  neutre: { fond: 'bg-pil', filet: 'border-liy-fonse', barre: 'border-l-liy-fonse', texte: 'text-chabon' },
}

export type Situation =
  // État d'un article ou d'une fiche
  | 'amende'
  | 'nouveau'
  | 'abroge'
  | 'partiellement_abroge'
  | 'errata'
  | 'derogation'
  | 'a_venir'
  | 'en_vigueur'
  // Replis
  | 'ancienne_redaction'
  | 'texte_abroge'
  | 'acte_modificatif'
  | 'acte_abrogatif'
  | 'texte_a_jour'
  | 'connexe'
  | 'jurisprudence'
  | 'annotations'
  | 'navigation'
  // Notes de l'éditeur (bandeaux et blocs)
  | 'sic'
  | 'consolidation'
  | 'provenance'
  | 'annexe'
  | 'rectification'
  | 'reserve'
  // Neutres
  | 'renvoi'
  | 'concordance'

export interface DefSituation {
  label: Record<Locale, string>
  /** Glyphe décoratif (aria-hidden) — jamais seul porteur du sens. */
  picto: string
  gamme: Gamme
}

/**
 * ⚠️ CRÉOLE : la graphie que Me Vaval écrit fait foi ; les formes nouvelles de ce registre (« Amande »,
 * « Derogasyon »…) lui sont soumises (docs/livraison-harmonisation-replis.md).
 */
export const SITUATIONS: Record<Situation, DefSituation> = {
  amende: { label: { fr: 'Amendé', en: 'Amended', ht: 'Amande' }, picto: '✎', gamme: 'amendement' },
  nouveau: { label: { fr: 'Nouveau', en: 'New', ht: 'Nouvo' }, picto: '+', gamme: 'nouveau' },
  abroge: { label: { fr: 'Abrogé', en: 'Repealed', ht: 'Abwoje' }, picto: '⊘', gamme: 'radie' },
  partiellement_abroge: { label: { fr: 'Partiellement abrogé', en: 'Partly repealed', ht: 'Abwoje an pati' }, picto: '⊘', gamme: 'radie' },
  errata: { label: { fr: 'Errata', en: 'Errata', ht: 'Errata' }, picto: '✎', gamme: 'amendement' },
  derogation: { label: { fr: 'Dérogation', en: 'Derogation', ht: 'Derogasyon' }, picto: '⤳', gamme: 'derogation' },
  a_venir: { label: { fr: 'Pas encore en vigueur', en: 'Not yet in force', ht: 'Poko an vigè' }, picto: '◷', gamme: 'avenir' },
  en_vigueur: { label: { fr: 'En vigueur', en: 'In force', ht: 'An vigè' }, picto: '', gamme: 'neutre' },
  ancienne_redaction: { label: { fr: 'Ancienne rédaction', en: 'Previous wording', ht: 'Ansyen vèsyon' }, picto: '↺', gamme: 'amendement' },
  texte_abroge: { label: { fr: 'Texte abrogé', en: 'Repealed text', ht: 'Tèks abwoje' }, picto: '⊘', gamme: 'radie' },
  acte_modificatif: { label: { fr: 'Amendé par', en: 'Amended by', ht: 'Amande pa' }, picto: '✎', gamme: 'amendement' },
  acte_abrogatif: { label: { fr: 'Abrogé par', en: 'Repealed by', ht: 'Abwoje pa' }, picto: '⊘', gamme: 'radie' },
  texte_a_jour: { label: { fr: 'Texte modifié, à jour', en: 'Amended text, up to date', ht: 'Tèks amande a ajou' }, picto: '⇄', gamme: 'connexe' },
  connexe: { label: { fr: 'Législation connexe', en: 'Related legislation', ht: 'Lejislasyon ki gen rapò' }, picto: '⇄', gamme: 'connexe' },
  jurisprudence: { label: { fr: 'Jurisprudence', en: 'Case law', ht: 'Jurisprudans' }, picto: '⚖', gamme: 'jurisprudence' },
  annotations: { label: { fr: 'Annotations', en: 'Annotations', ht: 'Anotasyon' }, picto: '✍', gamme: 'annotations' },
  navigation: { label: { fr: 'Navigation', en: 'Navigation', ht: 'Navigasyon' }, picto: '', gamme: 'neutre' },
  sic: { label: { fr: 'Texte du Journal officiel (sic)', en: 'Official Journal text (sic)', ht: 'Tèks Jounal ofisyèl la (sic)' }, picto: '⚑', gamme: 'note' },
  consolidation: { label: { fr: 'Texte consolidé', en: 'Consolidated text', ht: 'Tèks konsolide' }, picto: '⚑', gamme: 'note' },
  provenance: { label: { fr: 'Provenance', en: 'Source', ht: 'Orijin' }, picto: '⚑', gamme: 'note' },
  annexe: { label: { fr: 'Annexes éditoriales', en: 'Editorial annexes', ht: 'Anèks editoryal' }, picto: '⚑', gamme: 'note' },
  rectification: { label: { fr: 'Rectification', en: 'Correction', ht: 'Koreksyon' }, picto: '⚑', gamme: 'note' },
  reserve: { label: { fr: 'Transcription partielle', en: 'Partial transcript', ht: 'Transkripsyon pasyèl' }, picto: '⚑', gamme: 'note' },
  renvoi: { label: { fr: 'Renvoi', en: 'See', ht: 'Gade' }, picto: '↪', gamme: 'neutre' },
  concordance: { label: { fr: 'Concordance', en: 'Concordance', ht: 'Konkòdans' }, picto: '', gamme: 'neutre' },
}

export const libelle = (s: Situation, locale: Locale): string => SITUATIONS[s].label[locale] ?? SITUATIONS[s].label.fr
export const classes = (s: Situation): ClassesGamme => GAMMES[SITUATIONS[s].gamme]

/** Afficher / masquer, compteur : vocabulaire commun des replis. */
export const LIBELLES_REPLI = {
  afficher: { fr: 'afficher', en: 'show', ht: 'montre' },
  masquer: { fr: 'masquer', en: 'hide', ht: 'kache' },
  indisponible: {
    fr: 'Ancienne rédaction non disponible au corpus',
    en: 'Previous wording not available in the corpus',
    ht: 'Ansyen vèsyon an pa disponib nan kòpis la',
  },
} as const

// ════════════════════════════════════════════════════════════════════════════════════════════
// Correspondances : données → situation
// ════════════════════════════════════════════════════════════════════════════════════════════

/** `annotations.status` (valeurs historiques en minuscules accentuées). */
export function situationDuStatutArticle(v: string | null | undefined): Situation | null {
  switch (v) {
    case 'modifié':
      return 'amende'
    case 'nouveau':
      return 'nouveau'
    case 'abrogé':
      return 'abroge'
    case 'partiellement abrogé':
      return 'partiellement_abroge'
    case 'errata':
      return 'errata'
    default:
      return null
  }
}

/** Pastille d'`ArticleVersion` (`OfficialText.articleMarks`). */
export function situationDeMarque(kind: 'modifie' | 'abroge' | 'ajout'): Situation {
  return kind === 'modifie' ? 'amende' : kind === 'abroge' ? 'abroge' : 'nouveau'
}

/**
 * Statut de FICHE (`Document.status`). `PUBLIE` avec une entrée en vigueur FUTURE est « Pas encore en
 * vigueur » (codes pénaux révisés de 2025, en vigueur au 1er janvier 2027).
 */
export function situationDuStatutFiche(status: string, effectiveDate?: Date | string | null, maintenant = new Date()): Situation | null {
  if (status === 'ABROGE') return 'abroge'
  if (status === 'MODIFIE') return 'amende'
  if (status === 'EN_VIGUEUR') return 'en_vigueur'
  if (status === 'PUBLIE' && effectiveDate && new Date(effectiveDate).getTime() > maintenant.getTime()) return 'a_venir'
  return null
}

/** Libellés du bloc « Citations », orientés (le texte courant amende… / est amendé par…). */
const KINDS_CITATION: Record<string, { sortant: Record<Locale, string>; entrant: Record<Locale, string>; situation: Situation }> = {
  MODIFIE: { sortant: { fr: 'Amende', en: 'Amends', ht: 'Amande' }, entrant: { fr: 'Amendé par', en: 'Amended by', ht: 'Amande pa' }, situation: 'amende' },
  ABROGE: { sortant: { fr: 'Abroge', en: 'Repeals', ht: 'Abwoje' }, entrant: { fr: 'Abrogé par', en: 'Repealed by', ht: 'Abwoje pa' }, situation: 'abroge' },
  CITE: { sortant: { fr: 'Cite', en: 'Cites', ht: 'Site' }, entrant: { fr: 'Cité par', en: 'Cited by', ht: 'Site pa' }, situation: 'renvoi' },
  VOIR: { sortant: { fr: 'Voir', en: 'See', ht: 'Gade' }, entrant: { fr: 'Voir aussi', en: 'See also', ht: 'Gade tou' }, situation: 'renvoi' },
  APPLIQUE: { sortant: { fr: 'Applique', en: 'Implements', ht: 'Aplike' }, entrant: { fr: 'Appliqué par', en: 'Implemented by', ht: 'Aplike pa' }, situation: 'renvoi' },
  COMMENTE: { sortant: { fr: 'Commente', en: 'Comments on', ht: 'Kòmante' }, entrant: { fr: 'Commenté par', en: 'Commented on by', ht: 'Kòmante pa' }, situation: 'renvoi' },
}

export function kindCitation(kind: string, sens: 'sortant' | 'entrant', locale: Locale): { label: string; situation: Situation } {
  const k = KINDS_CITATION[kind]
  if (!k) return { label: kind, situation: 'renvoi' }
  return { label: k[sens][locale] ?? k[sens].fr, situation: k.situation }
}
export const KINDS_CITATION_CONNUS = Object.keys(KINDS_CITATION)

// ── Bandeaux de section (`annotations.crossRefs`) ────────────────────────────────────────────

export type NatureBandeau = 'renvoi' | 'sic' | 'consolidation' | 'provenance' | 'annexe' | 'rectification' | 'modification'
export const NATURES_BANDEAU: NatureBandeau[] = ['renvoi', 'sic', 'consolidation', 'provenance', 'annexe', 'rectification', 'modification']

export function situationDuBandeau(n: NatureBandeau): Situation {
  return n === 'modification' ? 'acte_modificatif' : n === 'renvoi' ? 'renvoi' : n
}

/**
 * Classement d'un bandeau SANS `kind` (données antérieures au 17 oct. 2026). Le script
 * `scripts/classer-replis-legislation-annotee.ts` pose `kind` en base ; ceci n'est que le repli.
 * Ordre : du plus spécifique au plus général.
 */
export function natureDuBandeau(e: { kind?: string; note?: string; articles?: unknown[]; docs?: unknown[]; insertedArticles?: unknown[] }): NatureBandeau {
  if (e.kind && (NATURES_BANDEAU as string[]).includes(e.kind)) return e.kind as NatureBandeau
  const n = e.note ?? ''
  if (/RECTIFICATION|ajouté le .* d.après la transcription/i.test(n)) return 'rectification'
  if (/Journal officiel (?:imprime|passe|porte|ne comporte)|\(sic\b|reproduit tel que le porte|reproduit tel quel/i.test(n)) return 'sic'
  if (/^Texte CONSOLIDÉ|refondu|^Décret du \d.* Première partie/i.test(n)) return 'consolidation'
  if (/annexes? éditoriales?|Sommaire (?:et|analytique)|Index alphabétique/i.test(n)) return 'annexe'
  if (/nouvelle rédaction|modifiés?|abrogés?|réformé|pose, sous la présente/i.test(n) && ((e.docs?.length ?? 0) > 0 || (e.insertedArticles?.length ?? 0) > 0)) return 'modification'
  if (/votée? par|Donné au Palais|publiée? au (?:Journal|Moniteur)|promulgu/i.test(n)) return 'provenance'
  return 'renvoi'
}

// ── Blocs de législation connexe (`annotations.connexe`) ──────────────────────────────────────

export type NatureConnexe = 'modificatif' | 'abrogatif' | 'derogation' | 'texte_a_jour' | 'ancienne_redaction' | 'source' | 'sic'
export const NATURES_CONNEXE: NatureConnexe[] = ['modificatif', 'abrogatif', 'derogation', 'texte_a_jour', 'ancienne_redaction', 'source', 'sic']

export function situationDuConnexe(n: NatureConnexe): Situation {
  switch (n) {
    case 'modificatif':
      return 'acte_modificatif'
    case 'abrogatif':
      return 'acte_abrogatif'
    case 'derogation':
      return 'derogation'
    case 'texte_a_jour':
      return 'texte_a_jour'
    case 'ancienne_redaction':
      return 'ancienne_redaction'
    case 'sic':
      return 'sic'
    default:
      return 'connexe'
  }
}

/**
 * Classement d'un bloc connexe SANS `kind`, sur son intitulé (et, sans intitulé, sur le début de son
 * texte). Table de motifs FERMÉE : ce qui n'y correspond pas est une source/texte rattaché. Le script
 * de classement pose `kind` en base et recense les blocs qui tombent dans ce défaut.
 */
export function natureDuConnexe(b: { kind?: string; label?: string; text?: string }): NatureConnexe {
  if (b.kind && (NATURES_CONNEXE as string[]).includes(b.kind)) return b.kind as NatureConnexe
  const l = (b.label ?? '').trim()
  const t = (b.text ?? '').trim()
  if (/^Anomalie du texte imprimé|^Lacune de la source|^Note sur la source/i.test(l)) return 'sic'
  if (/^Bail à usage professionnel/i.test(l)) return 'derogation'
  if (/\(texte à jour\)/i.test(l)) return 'texte_a_jour'
  if (/rédaction antérieure/i.test(l)) return 'ancienne_redaction'
  // ⚠️ Pas de `\b` après « é » : en JavaScript, il ne mord pas après une lettre accentuée — les
  // 37 « Article modifié — … » du Code de procédure civile et de ses appendices tombaient au défaut.
  if (/^Article abrogé(?![\p{L}])/iu.test(l)) return 'abrogatif'
  if (/^Article modifié(?![\p{L}])|^Modifié(?![\p{L}])|modifiant|portant réforme|réformant|^Loi sur la Paternité|^Loi portant Réforme|^Décret du 9 avril 2020 sur le Bail/iu.test(l)) return 'modificatif'
  // Code civil : « Historique des amendements — article 1101 » accompagne l'acte qui a réécrit l'article
  // (« Article réécrit par l'article 1 de la loi du 14 février 2017… »), comme « Ainsi modifié par … ».
  if (/^Historique des amendements/i.test(l) || /^Article réécrit par|^Ainsi modifié par/i.test(t)) return 'modificatif'
  if (!l && /^(?:Décret|Loi|D\.|L\.|Arrêté)[^.]{0,80}\b(?:modifi|abrog|remplac|aboli)/i.test(t)) return 'modificatif'
  return 'source'
}

// ── Marqueurs écrits dans le corps, en tête d'article ────────────────────────────────────────

/**
 * « (D. du 14 novembre 1988, art. 1) », « (L. du 3 avril 2018) », « (Abrogé par le Décret du … ) »,
 * « (modifié comme suit par le Décret du … ) » — en TÊTE d'article seulement (298 des 310 du corpus,
 * mesuré le 17 oct. 2026) : au milieu d'une phrase, une parenthèse « (Loi du … ) » est une citation.
 * Le texte n'est jamais modifié : le rendu l'enveloppe d'un style, rien de plus.
 */
export const MARQUEUR_TETE =
  /^\((?:L\.|D\.(?:\s*-?\s*L\.)?|D-L\.?|Décret(?:-[Ll]oi)?|Loi|Arrêté|Abrog[ée]|abrog[ée]|Abr\.?|Modifi[ée]|modifi[ée])[^()]{0,160}\)/

export function situationDuMarqueur(m: string): Situation {
  return /abrog|\bAbr\b/i.test(m) ? 'abroge' : 'amende'
}
