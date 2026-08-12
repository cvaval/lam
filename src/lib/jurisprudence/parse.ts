import { deduireSolution, type Solution } from './constants'

/**
 * ANALYSEUR DE RECUEIL DE DÉCISIONS.
 *
 * ⚠️ IL NE DOIT PAS ÊTRE CÂBLÉ SUR UN DOCUMENT PARTICULIER. Le recueil suivant n'aura pas
 * la même mise en forme — un préfixe sans espace, un intertitre renommé, une section
 * absente. Un analyseur qui suppose un gabarit échoue au premier volume différent, et
 * pire, échoue EN SILENCE en produisant des champs vides que personne ne remarque.
 *
 * ⚠️ RIEN N'EST DEVINÉ. Ce qui n'est pas reconnu reste vide et remonte en avertissement.
 * Sur un corpus juridique, un champ inventé est pire qu'un champ absent : le second se
 * voit à l'écran de contrôle, le premier se propage.
 */

export interface DecisionAnalysee {
  numero: string | null
  intitule: string | null
  juridiction: string | null
  dateTexte: string | null
  dateISO: string | null
  decisionAttaquee: string | null
  dispositif: string | null
  solution: Solution | null
  resume: string | null
  domaines: string | null
  /** Champs que l'analyseur n'a pas su lire — l'opérateur les complétera à l'écran. */
  manquants: string[]
}

export interface RecueilAnalyse {
  decisions: DecisionAnalysee[]
  synthese: string | null
  avertissements: string[]
}

/**
 * Normalise pour COMPARER : minuscules, sans accents, apostrophes et guillemets unifiés,
 * espaces réduits.
 *
 * ⚠️ L'APOSTROPHE TYPOGRAPHIQUE EST LE PIÈGE. Word écrit « Date de l’arrêt » avec U+2019,
 * quand un développeur tape U+0027 dans son motif : les quinze dates du recueil de
 * référence sont restées nulles pour cette seule raison. Même remarque pour les
 * guillemets et les espaces insécables, que Word insère avant les deux-points.
 */
export function cle(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    // ⚠️ L'apostrophe devient un ESPACE, non une apostrophe droite : « Date de l'arrêt »
    // et « DATE DE L ARRET » (graphie fréquente après OCR) se ramènent alors à la même
    // clé. Normaliser vers l'apostrophe droite laissait la seconde forme inconnue.
    .replace(/['\u2018\u2019\u02BC\u2032]/g, ' ')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u00A0\u202F\u2009]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Reconnaît « Préfixe : valeur » quelle que soit la casse, l'accentuation, l'espace avant
 * les deux-points ou leur variante insécable. `Décision attaquée :`, `DECISION ATTAQUEE:`
 * et `Décision attaquée :` doivent tous répondre.
 */
function valeurApres(ligne: string, etiquettes: string[]): string | null {
  const i = ligne.search(/[:\uFF1A]/)
  if (i < 0) return null
  // ⚠️ ON COMPARE L'ÉTIQUETTE SEULE, sans le deux-points ni ce qui l'entoure. Inclure
  // « : » dans le motif faisait échouer « SOLUTION: » face à « solution : » — l'espace
  // avant le deux-points n'est pas garanti, et Word y glisse parfois une insécable.
  const gauche = cle(ligne.slice(0, i))
  if (!etiquettes.some((e) => gauche === cle(e))) return null
  const reste = ligne.slice(i + 1).trim()
  // Une étiquette reconnue mais suivie de rien n'est PAS une valeur vide silencieuse :
  // on rend null, et l'appelant la comptera comme manquante.
  return reste.length ? reste : null
}

/** `28 octobre 1964` → `1964-10-28`. Rend null si le mois n'est pas reconnu. */
const MOIS: Record<string, number> = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
}
export function dateFrVersISO(texte: string): string | null {
  const m = cle(texte).match(/(\d{1,2})(?:er)?\s+([a-z]+)\s+(\d{4})/)
  if (!m) return null
  const mois = MOIS[m[2]]
  if (!mois) return null
  const j = Number(m[1])
  if (j < 1 || j > 31) return null
  return `${m[3]}-${String(mois).padStart(2, '0')}-${String(j).padStart(2, '0')}`
}

const P_ARRET = /^(?:arret|arrêt|decision|décision)\s*n[o°.]?\s*\.?\s*(\d{1,4})/i
// Étiquettes SANS deux-points : `valeurApres` coupe la ligne au premier « : » et
// compare la partie gauche. Ajouter une variante ici suffit à la reconnaître partout.
const P_JURIDICTION = ['juridiction']
const P_DATE = ["date de l'arrêt", 'date', 'date de la décision', 'date de la decision']
const P_ATTAQUEE = ['décision attaquée', 'jugement attaqué', 'decision attaquee']
const P_SOLUTION = ['solution', 'dispositif']
const T_RESUME = ['resume de la decision', 'résumé de la décision', 'resume', 'résumé']
const T_DOMAINES = ['domaine(s) du droit', 'domaines du droit', 'domaine du droit', 'domaine(s)']
const T_SYNTHESE = ['synthese par domaine du droit', 'synthèse par domaine du droit', 'synthese']

/**
 * @param paragraphes texte de chaque paragraphe du .docx, tabulations déjà converties.
 *
 * ⚠️ LE TABLEAU RÉCAPITULATIF EST IGNORÉ. Le recueil de référence s'ouvre sur un tableau
 * qui répète les mêmes décisions en six colonnes ; le lire aussi importerait chaque arrêt
 * DEUX fois, la seconde sous une forme tronquée. On ne commence à lire qu'au premier
 * « ARRÊT NO. n », qui marque le début de la partie détaillée.
 */
export function analyserRecueil(paragraphes: string[]): RecueilAnalyse {
  const avertissements: string[] = []
  const lignes = paragraphes.map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean)

  const debut = lignes.findIndex((l) => P_ARRET.test(l))
  if (debut < 0) {
    return {
      decisions: [],
      synthese: null,
      avertissements: ["Aucun en-tête « ARRÊT NO. n » trouvé — le document n'a pas le format attendu."],
    }
  }
  if (debut > 0) {
    avertissements.push(`${debut} paragraphe(s) avant le premier arrêt ignorés (en-tête et tableau récapitulatif).`)
  }

  const decisions: DecisionAnalysee[] = []
  let synthese: string | null = null
  let cur: DecisionAnalysee | null = null
  let section: 'resume' | 'domaines' | 'synthese' | null = null
  const tampon: string[] = []

  const viderTampon = () => {
    const t = tampon.join(' ').trim()
    tampon.length = 0
    if (!t) return
    if (section === 'resume' && cur) cur.resume = t
    else if (section === 'domaines' && cur) cur.domaines = t
    else if (section === 'synthese') synthese = synthese ? `${synthese}\n\n${t}` : t
  }

  const clore = () => {
    viderTampon()
    if (!cur) return
    for (const [champ, v] of [
      ['numéro', cur.numero], ['intitulé', cur.intitule], ['date', cur.dateISO],
      ['décision attaquée', cur.decisionAttaquee], ['dispositif', cur.dispositif],
      ['résumé', cur.resume], ['domaines', cur.domaines],
    ] as const) {
      if (!v) cur.manquants.push(champ)
    }
    decisions.push(cur)
    cur = null
  }

  for (const ligne of lignes.slice(debut)) {
    const mArret = ligne.match(P_ARRET)
    if (mArret) {
      clore()
      section = null
      cur = {
        numero: mArret[1], intitule: null, juridiction: null, dateTexte: null, dateISO: null,
        decisionAttaquee: null, dispositif: null, solution: null, resume: null, domaines: null,
        manquants: [],
      }
      continue
    }
    if (T_SYNTHESE.some((t) => cle(ligne) === t || cle(ligne).startsWith(t))) {
      clore()
      section = 'synthese'
      continue
    }
    if (!cur && section !== 'synthese') continue

    if (cur) {
      const jur = valeurApres(ligne, P_JURIDICTION)
      if (jur !== null) { viderTampon(); section = null; cur.juridiction = jur; continue }

      const dte = valeurApres(ligne, P_DATE)
      if (dte !== null) {
        viderTampon(); section = null
        cur.dateTexte = dte
        cur.dateISO = dateFrVersISO(dte)
        if (!cur.dateISO) avertissements.push(`Arrêt ${cur.numero} : date « ${dte} » non comprise.`)
        continue
      }

      const att = valeurApres(ligne, P_ATTAQUEE)
      if (att !== null) { viderTampon(); section = null; cur.decisionAttaquee = att; continue }

      const sol = valeurApres(ligne, P_SOLUTION)
      if (sol !== null) {
        viderTampon(); section = null
        cur.dispositif = sol
        cur.solution = deduireSolution(sol)
        if (!cur.solution) avertissements.push(`Arrêt ${cur.numero} : issue non déduite de « ${sol} ».`)
        continue
      }

      if (T_RESUME.some((t) => cle(ligne) === t)) { viderTampon(); section = 'resume'; continue }
      if (T_DOMAINES.some((t) => cle(ligne) === t)) { viderTampon(); section = 'domaines'; continue }

      // Première ligne libre après l'en-tête « ARRÊT NO. n » : c'est l'intitulé.
      if (!cur.intitule && section === null) { cur.intitule = ligne; continue }
    }
    if (section) tampon.push(ligne)
  }
  clore()

  const incomplets = decisions.filter((d) => d.manquants.length)
  if (incomplets.length) {
    avertissements.push(`${incomplets.length} décision(s) incomplète(s) — à compléter à l'écran avant enregistrement.`)
  }
  return { decisions, synthese, avertissements }
}
