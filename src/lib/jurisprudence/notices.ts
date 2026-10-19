/**
 * Notices à DIX rubriques — le gabarit des sommaires analytiques livrés par la rédaction
 * depuis octobre 2026 (1re Section 1965-1966, n° 1-15 en premier). Distinct de `parse.ts`
 * (gabarit du recueil 1964-1965 : « ARRÊT NO. N » puis étiquettes courtes) : ici chaque
 * notice ouvre sur « No N — X c. Y », et chaque rubrique tient en UN paragraphe
 * « Libellé : texte », continué sur les paragraphes suivants tant qu'aucun libellé ne les
 * ouvre.
 *
 * ⚠️ LA LISTE DES RUBRIQUES EST FERMÉE. Un paragraphe qui ne commence par aucun libellé
 * connu est une CONTINUATION, jamais une rubrique nouvelle : un libellé inconnu
 * (« Observations », « Portée »…) se fondrait donc dans la rubrique précédente et serait
 * signalé par l'avertissement « libellé inconnu » — c'est voulu, on n'invente pas de champ.
 *
 * ⚠️ LE DISPOSITIF N'A PAS DE RUBRIQUE PROPRE dans ce gabarit : la rédaction l'inscrit en
 * fin de « Solution et motifs », sous la sous-mention « Dispositif : … », parfois suivie de
 * « Anomalies de source conservées : … ». `separerDispositif` les détache pour que la fiche
 * les affiche à leur place (le composant rend le dispositif à part, en gras) ; le texte de
 * la rédaction n'est pas réécrit, seulement découpé aux sous-mentions qu'elle a posées.
 */

export const RUBRIQUES = [
  'Date du prononcé',
  "Date portée sur l'extrait",
  'Juridiction',
  'Décision attaquée / objet de la saisine',
  'Composition',
  'Domaines du droit',
  'Analyse',
  'Règle de droit (Rule of Law)',
  'Question de droit (Issue)',
  'Solution et motifs (Holding and Reasoning)',
] as const
export type Rubrique = (typeof RUBRIQUES)[number]

export interface Notice {
  numero: string
  parties: string
  rubriques: Partial<Record<Rubrique, string>>
  /** Rubriques du gabarit absentes de la notice (le lot 1-15 en a zéro). */
  manquantes: Rubrique[]
}

/** Repli de comparaison : accents, casse, apostrophes typographiques, espaces. */
export function cleNotice(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

const CLES = new Map<string, Rubrique>(RUBRIQUES.map((r) => [cleNotice(r), r]))

/** « No 1 — Maison Luciani-Berhmann c. Laurent Benoit » (tiret cadratin, demi-cadratin ou simple). */
const RE_TETE = /^(?:No|N°|Nº|No\.)\s*(\d{1,4})\s*[—–-]\s+(.+)$/u

/** « Libellé : texte » — le libellé est la partie gauche du PREMIER « : ». */
function rubriqueDe(p: string): { rubrique: Rubrique; texte: string } | null {
  const i = p.indexOf(':')
  if (i < 0 || i > 60) return null
  const r = CLES.get(cleNotice(p.slice(0, i)))
  if (!r) return null
  return { rubrique: r, texte: p.slice(i + 1).trim() }
}

/** Un « Libellé : » non reconnu en tête de paragraphe court — signalé, pas absorbé en silence. */
const RE_LIBELLE_INCONNU = /^([A-ZÀ-Ý][^:]{2,45})\s*:\s/u

export function analyserNotices(paragraphes: string[]): { notices: Notice[]; avertissements: string[] } {
  const notices: Notice[] = []
  const avertissements: string[] = []
  let courante: Notice | null = null
  let rubrique: Rubrique | null = null

  for (const p of paragraphes) {
    const tete = p.length < 300 ? p.match(RE_TETE) : null
    if (tete) {
      courante = { numero: tete[1], parties: tete[2].trim(), rubriques: {}, manquantes: [] }
      notices.push(courante)
      rubrique = null
      continue
    }
    if (!courante) continue // préambule (page de titre, introduction)

    const r = rubriqueDe(p)
    if (r) {
      if (courante.rubriques[r.rubrique] !== undefined)
        avertissements.push(`n° ${courante.numero} : rubrique « ${r.rubrique} » en double — la seconde est ajoutée à la première`)
      courante.rubriques[r.rubrique] = [courante.rubriques[r.rubrique], r.texte].filter(Boolean).join('\n')
      rubrique = r.rubrique
      continue
    }
    if (rubrique) {
      const m = p.match(RE_LIBELLE_INCONNU)
      if (m && !/^(?:Dispositif|Anomalies?|Siège|Ministère|Greffe|Avocats?)\b/u.test(m[1]))
        avertissements.push(`n° ${courante.numero} : libellé inconnu « ${m[1].trim()} » — fondu dans « ${rubrique} »`)
      courante.rubriques[rubrique] = `${courante.rubriques[rubrique]}\n${p}`
    } else {
      avertissements.push(`n° ${courante.numero} : paragraphe hors rubrique ignoré — « ${p.slice(0, 60)}… »`)
    }
  }

  for (const n of notices) n.manquantes = RUBRIQUES.filter((r) => !n.rubriques[r])
  return { notices, avertissements }
}

/* ────────────────────────────── Sous-mentions de « Solution et motifs » ────────────────────────────── */

// Les sous-mentions ouvrent une phrase : précédées du début du texte ou d'une ponctuation
// forte suivie d'un blanc. « le dispositif intermédiaire » en milieu de phrase ne mord pas.
// Deux graphies de la sous-mention : « Dispositif : sur conclusions conformes…, rejet » et
// « Dispositif, sur conclusions conformes du Ministère Public : rejet » (n° 12, 14, 15). Dans la
// seconde, tout ce qui suit « Dispositif, » est gardé tel quel, deux-points compris.
const RE_DISPOSITIF = /(?:^|(?<=[.;!?»)\]]\s))Dispositif(?:\s*:\s*|,\s*)/gu
const RE_ANOMALIES = /(?:^|(?<=[.;!?»)\]]\s))(Anomalies?\s+de\s+source(?:\s+conserv[ée]es?)?)\s*:\s*/u

export interface SolutionDecoupee {
  /** La réponse aux questions de droit — sans la sous-mention « Dispositif ». */
  motifs: string
  /** Le libellé du dispositif tel que la rédaction l'a résumé, ou null si la notice n'en porte pas. */
  dispositif: string | null
  /** « Anomalies de source conservées : … », ou null. */
  anomalies: string | null
  /** Libellé exact de la sous-mention d'anomalies (sa casse, son pluriel). */
  libelleAnomalies: string | null
  /** Non null quand le texte est ambigu (deux « Dispositif : ») — on ne tranche pas pour la rédaction. */
  defaut: string | null
}

export function separerDispositif(texte: string): SolutionDecoupee {
  const t = texte.trim()
  const occ = [...t.matchAll(RE_DISPOSITIF)]
  if (occ.length > 1) return { motifs: t, dispositif: null, anomalies: null, libelleAnomalies: null, defaut: `${occ.length} sous-mentions « Dispositif : »` }

  const detacherAnomalies = (s: string): { reste: string; anomalies: string | null; libelle: string | null } => {
    const m = s.match(RE_ANOMALIES)
    if (!m || m.index === undefined) return { reste: s.trim(), anomalies: null, libelle: null }
    return { reste: s.slice(0, m.index).trim(), anomalies: s.slice(m.index + m[0].length).trim() || null, libelle: m[1] }
  }

  if (occ.length === 0) {
    const a = detacherAnomalies(t)
    return { motifs: a.reste, dispositif: null, anomalies: a.anomalies, libelleAnomalies: a.libelle, defaut: null }
  }
  const o = occ[0]
  const avant = t.slice(0, o.index).trim()
  const a = detacherAnomalies(t.slice((o.index ?? 0) + o[0].length))
  return { motifs: avant, dispositif: a.reste || null, anomalies: a.anomalies, libelleAnomalies: a.libelle, defaut: null }
}

/** « 17 novembre 1965 (jour de semaine non indiqué) : « … » » → 1965-11-17. Première date du texte. */
const MOIS: Record<string, number> = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8,
  septembre: 9, octobre: 10, novembre: 11, decembre: 12,
}
export function dateDeLaNotice(texte: string): string | null {
  const m = cleNotice(texte).match(/\b(\d{1,2})(?:er)?\s+([a-z]+)\s+(\d{4})\b/)
  if (!m) return null
  const mois = MOIS[m[2]]
  const j = Number(m[1])
  if (!mois || j < 1 || j > 31) return null
  return `${m[3]}-${String(mois).padStart(2, '0')}-${String(j).padStart(2, '0')}`
}

/** « mention marginale de matière : « Civ. » » → « Civ. ». */
export function mentionMarginale(texte: string): string | null {
  const m = texte.match(/mention\s+marginale[^«]{0,40}«\s*([^»]+?)\s*»/u)
  return m ? m[1] : null
}

/**
 * La « Mention du recueil » de la fiche (champ compositionNote) : ce que la notice dit de la
 * composition AU-DELÀ du siège — le siège est déjà porté, membre par membre, par la
 * formation (DecisionJudge). On garde donc à partir de « Ministère Public : » (réquisitoire,
 * audiences, greffe, avocats), comme les mentions du lot 1964-1965.
 */
export function mentionHorsSiege(composition: string): string {
  const m = composition.match(/(?:^|[.;]\s*)(Minist[èe]re\s+Public\s*:.*)$/su)
  return (m ? m[1] : composition).trim()
}
