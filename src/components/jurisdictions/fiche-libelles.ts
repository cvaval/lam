import type { Dictionary } from '@/lib/i18n/dictionaries'

/**
 * Les libellés de la fiche d'un notaire, extraits du dictionnaire CÔTÉ SERVEUR : la fenêtre modale
 * (client) ne reçoit que ceux-ci, jamais le dictionnaire entier.
 */
export function libellesFiche(t: Dictionary) {
  const j = t.judicial
  return {
    titre: j.notaryPageTitle,
    badge: j.notaryConfirmedBadge,
    infobulle: j.notaryConfirmedTooltip,
    confirmeesLe: j.ficheConfirmedLine,
    commission: j.annuaireCommission,
    communeImprimee: j.annuaireUnmatchedCommune,
    nomImprime: j.notaryPrintedName,
    crayon: j.notaryEditRequest,
    coordonnees: j.notaryContactsTitle,
    adresse: j.address,
    telephone: j.notaryPhone,
    courriel: j.notaryEmail,
    appeler: j.ficheCall,
    appelerLe: j.notaryCall,
    ecrire: j.ficheWrite,
    ecrireA: j.notaryWrite,
    aucune: j.notaryNoContacts,
    copier: j.ficheCopyAddress,
    copiee: j.ficheAddressCopied,
    copieRepli: j.ficheCopyFallback,
  }
}
export type LibellesFiche = ReturnType<typeof libellesFiche>

export function libellesModale(t: Dictionary) {
  const j = t.judicial
  return {
    ...libellesFiche(t),
    fermer: j.ficheClose,
    fermerFiche: j.ficheCloseLabel,
    chargement: j.ficheLoading,
    introuvableTitre: j.ficheNotFoundTitle,
    introuvableTexte: j.ficheNotFoundBody,
    erreurTitre: j.ficheErrorTitle,
    erreurTexte: j.ficheErrorBody,
    reessayer: j.annuaireRetry,
    carteCommune: j.notaryOnMap,
  }
}
export type LibellesModale = ReturnType<typeof libellesModale>
