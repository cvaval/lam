/**
 * Chargement de la fiche ouverte en fenêtre modale — logique PURE (testée sans navigateur).
 *
 * UNE SEULE fiche à la fois, et toujours LA BONNE : chaque ouverture reçoit un jeton ; une réponse
 * arrivée pour un jeton dépassé (clic sur un autre notaire, fermeture, nouvel essai) est IGNORÉE et
 * la requête précédente est annulée. Une réponse qui ne porte pas l'identifiant demandé est traitée
 * comme un incident, jamais affichée. « Introuvable » (l'inscription n'existe pas ou plus) et
 * « erreur » (incident de chargement) restent DISTINCTS : une panne n'est pas une absence.
 */
import type { FicheNotairePublique } from './fiche-notaire'

export type EtatFiche =
  | { statut: 'fermee' }
  | { statut: 'chargement'; id: string }
  | { statut: 'ok'; id: string; fiche: FicheNotairePublique }
  | { statut: 'introuvable'; id: string }
  | { statut: 'erreur'; id: string }

export type ReponseFiche = { kind: 'ok'; fiche: FicheNotairePublique } | { kind: 'introuvable' }
/** Rejette (ou lève) en cas d'incident ; `signal` annule une requête devenue inutile. */
export type ChargeurFiche = (id: string, signal: AbortSignal) => Promise<ReponseFiche>

export const FERMEE: EtatFiche = { statut: 'fermee' }

export function creerControleurFiche(charger: ChargeurFiche, notifier: (e: EtatFiche) => void, initial: EtatFiche = FERMEE) {
  let jeton = 0
  let enCours: AbortController | null = null
  let etat = initial
  const poser = (e: EtatFiche) => { etat = e; notifier(e) }

  return {
    etat: () => etat,
    /** Ouvre (ou rouvre) la fiche `id`. Sans effet si elle est déjà affichée ou en chargement. */
    ouvrir(id: string) {
      if (etat.statut !== 'fermee' && etat.id === id && etat.statut !== 'erreur') return
      const mien = ++jeton
      enCours?.abort()
      const ctrl = new AbortController()
      enCours = ctrl
      poser({ statut: 'chargement', id })
      charger(id, ctrl.signal).then(
        (r) => {
          if (mien !== jeton) return
          enCours = null
          if (r.kind === 'introuvable') poser({ statut: 'introuvable', id })
          else if (r.fiche?.id === id) poser({ statut: 'ok', id, fiche: r.fiche })
          else poser({ statut: 'erreur', id })
        },
        () => {
          if (mien !== jeton) return
          enCours = null
          poser({ statut: 'erreur', id })
        },
      )
    },
    /** Nouvel essai après un incident (même fiche). */
    reessayer() {
      if (etat.statut === 'erreur') {
        const id = etat.id
        poser({ statut: 'fermee' })
        this.ouvrir(id)
      }
    },
    fermer() {
      jeton++
      enCours?.abort()
      enCours = null
      if (etat.statut !== 'fermee') poser(FERMEE)
    },
  }
}
export type ControleurFiche = ReturnType<typeof creerControleurFiche>

/** Le chargeur réel : l'API publique de la fiche (aucune donnée privée n'y figure). */
export function chargeurApi(): ChargeurFiche {
  return async (id, signal) => {
    const res = await fetch(`/api/public/jurisdictions/notaires/${encodeURIComponent(id)}`, {
      signal, headers: { Accept: 'application/json' }, cache: 'no-store',
    })
    if (res.status === 404) return { kind: 'introuvable' }
    if (!res.ok) throw new Error(`fiche ${id} : HTTP ${res.status}`)
    const data = (await res.json()) as { fiche?: FicheNotairePublique }
    if (!data.fiche) throw new Error(`fiche ${id} : réponse vide`)
    return { kind: 'ok', fiche: data.fiche }
  }
}

/** Éléments qui peuvent recevoir le focus dans la fenêtre modale (piège du clavier). */
export const SELECTEUR_FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Tabulation PIÉGÉE : après le dernier élément, le premier ; avant le premier, le dernier ; depuis
 * le conteneur lui-même (focus initial), le premier ou le dernier. Rend l'index visé, ou -1.
 */
export function indexFocusSuivant(nombre: number, actuel: number, arriere: boolean): number {
  if (nombre === 0) return -1
  if (actuel < 0) return arriere ? nombre - 1 : 0
  if (arriere) return actuel === 0 ? nombre - 1 : -1
  return actuel === nombre - 1 ? 0 : -1
}
