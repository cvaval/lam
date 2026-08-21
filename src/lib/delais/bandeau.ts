/**
 * § 7.3 — LES BANDEAUX D'UN PERMALIEN ROUVERT, en type PUR.
 *
 * Ce type vivait dans `lecture-publique.ts`, qui touche Prisma. Or le presse-papiers doit le
 * porter (`texteRaisonnement`), et `affichage.ts` est un fichier sans E/S, testé sans base :
 * le type descend donc ici, et `lecture-publique.ts` le réexporte pour ses appelants.
 *
 * Trois situations, deux bandeaux, et un seul interdit commun : **aucune action
 * d'administration ne modifie, ne recalcule ni n'efface un résultat déjà rendu.**
 */
export type Bandeau =
  | null
  | {
      type: 'REGLE_CHANGEE'
      revisionDemandee: number
      revisionCourante: number
      changeeLe: string | null
      hrefActuelle: string
    }
  | { type: 'ENTREE_RETIREE'; statutEntree: string; motif: string | null; retireeLe: string | null }
