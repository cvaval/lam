import { cle, dateFrVersISO } from './parse'

/**
 * ANALYSEUR DES TEXTES INTÉGRAUX D'UN RECUEIL.
 *
 * Le sommaire analytique et les textes intégraux sont DEUX documents distincts : le premier
 * donne les fiches (résumé, dispositif, domaines), le second le texte des arrêts. Cet
 * analyseur ne lit que le second et ne touche à rien d'autre — il apporte `bodyOriginal`.
 *
 * ⚠️ LE TEXTE N'EST NI RÉÉCRIT NI NETTOYÉ. C'est le texte de la décision : on le découpe,
 * on ne le corrige pas. Les seules transformations sont la jonction des paragraphes et le
 * retrait de l'en-tête d'archive qui précède chaque arrêt (exercice, section, date
 * manuscrite) — laquelle appartient au SUIVANT, pas au précédent.
 */

export interface TexteIntegral {
  numero: string
  /** Date lue dans l'en-tête d'archive — sert à RECOUPER, jamais à écraser la date en base. */
  dateTexte: string | null
  dateISO: string | null
  texte: string
}

export interface RecueilIntegral {
  textes: TexteIntegral[]
  /** Notes de transcription rattachées à un arrêt, par numéro. */
  notesParArret: Record<string, string>
  /** Notes de transcription qui ne visent aucun arrêt en particulier. */
  notesGenerales: string[]
  avertissements: string[]
}

/**
 * En-tête d'arrêt, seul sur sa ligne. Le recueil de référence écrit « No. 2).- » quatorze
 * fois et « No. 13 » une fois : l'ancrage sur la ligne ENTIÈRE est ce qui évite de prendre
 * pour un en-tête le « No. 6006-AA » d'un numéro d'identification cité dans une phrase.
 */
const P_ENTETE = /^n[o°]s?\.?\s*(\d{1,4})\s*\)?\s*\.?\s*-?\s*$/i

/** Lignes d'archive qui introduisent l'arrêt SUIVANT (elles précèdent son en-tête). */
function estPreambule(ligne: string): boolean {
  const c = cle(ligne)
  return (
    c.startsWith('[date manuscrite') ||
    /^exercice\b/.test(c) ||
    /^ex\s*:/.test(c) ||
    /^(premiere|deuxieme|troisieme)\s+section$/.test(c)
  )
}

const P_NOTES = /^notes? de transcription$/i
const P_NOTE_ARRET = /^\d+\.\s*(?:arr[eê]ts?)\s*n[o°]s?\.?\s*(\d{1,4})\s*[—–-]\s*(.+)$/i
const P_NOTE_GENERALE = /^\d+\.\s*(?:g[ée]n[ée]ral|divers)\s*[—–-]\s*(.+)$/i

function dateDuPreambule(lignes: string[]): string | null {
  for (const l of lignes) {
    if (cle(l).startsWith('[date manuscrite')) {
      const m = l.match(/:\s*([^—\]]+)/)
      if (m) return m[1].trim()
    }
  }
  return null
}

export function analyserTextesIntegraux(paragraphes: string[]): RecueilIntegral {
  const avertissements: string[] = []
  const lignes = paragraphes.map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean)

  // Les notes de transcription closent le document : elles ne font partie d'aucun arrêt.
  const iNotes = lignes.findIndex((l) => P_NOTES.test(l))
  const corps = iNotes >= 0 ? lignes.slice(0, iNotes) : lignes
  const notesParArret: Record<string, string> = {}
  const notesGenerales: string[] = []
  if (iNotes >= 0) {
    for (const l of lignes.slice(iNotes + 1)) {
      const mA = l.match(P_NOTE_ARRET)
      if (mA) {
        // ⚠️ On ne DEVINE pas le rattachement : la note nomme elle-même son arrêt.
        notesParArret[mA[1]] = notesParArret[mA[1]] ? `${notesParArret[mA[1]]}\n${mA[2].trim()}` : mA[2].trim()
        continue
      }
      const mG = l.match(P_NOTE_GENERALE)
      if (mG) { notesGenerales.push(mG[1].trim()); continue }
      if (/^\d+\./.test(l)) notesGenerales.push(l.replace(/^\d+\.\s*/, ''))
    }
  }

  const entetes: number[] = []
  corps.forEach((l, i) => { if (P_ENTETE.test(l)) entetes.push(i) })
  if (!entetes.length) {
    return {
      textes: [], notesParArret, notesGenerales,
      avertissements: ["Aucun en-tête « No. n » seul sur sa ligne — le document n'a pas le format attendu."],
    }
  }

  const textes: TexteIntegral[] = []
  for (let k = 0; k < entetes.length; k++) {
    const debut = entetes[k]
    let fin = k + 1 < entetes.length ? entetes[k + 1] : corps.length
    // L'en-tête d'archive de l'arrêt suivant (exercice / section / date manuscrite) précède
    // son numéro : le laisser ici collerait la fin d'un arrêt au début du suivant.
    const preambuleSuivant: string[] = []
    while (fin - 1 > debut && estPreambule(corps[fin - 1])) preambuleSuivant.unshift(corps[--fin])

    const numero = corps[debut].match(P_ENTETE)![1]
    const texte = corps.slice(debut + 1, fin).join('\n').trim()
    if (!texte) avertissements.push(`Arrêt ${numero} : aucun texte entre cet en-tête et le suivant.`)

    // Le préambule de CET arrêt est celui qui précède son propre en-tête.
    const debutPreambule = k === 0 ? 0 : entetes[k - 1]
    const avant: string[] = []
    for (let i = debut - 1; i > debutPreambule && estPreambule(corps[i]); i--) avant.unshift(corps[i])
    const dateTexte = dateDuPreambule(avant)

    textes.push({ numero, dateTexte, dateISO: dateTexte ? dateFrVersISO(dateTexte) : null, texte })
  }

  const doublons = textes.map((t) => t.numero).filter((n, i, a) => a.indexOf(n) !== i)
  if (doublons.length) avertissements.push(`Numéro(s) en double dans le fichier : ${[...new Set(doublons)].join(', ')}.`)

  return { textes, notesParArret, notesGenerales, avertissements }
}
