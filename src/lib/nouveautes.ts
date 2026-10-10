/**
 * NOUVEAUTÉ — une seule définition pour toute la plateforme (Me Vaval, 9 oct. 2026 : « la
 * pastille Nouveau reste uniquement quand le poste est nouveau »).
 *
 * Un document est NOUVEAU s'il a été AJOUTÉ à la plateforme (`Document.createdAt`) depuis
 * moins de `JOURS_NOUVEAUTE` jours. Jamais sa dernière MODIFICATION (`updatedAt`) : une
 * correction, une pastille d'état, un reclassement ou un recalcul d'index la déplacent, et la
 * pastille des rubriques se rallumait ainsi sur des textes anciens — 7 thèmes « Nouveau » en
 * production le 9 oct. 2026 pour 6 circulaires BRH retouchées, aucune ajoutée.
 *
 * Utilisée par le tableau de bord (encadré « Nouveauté », étiquettes des tuiles) et par les
 * rubriques à thèmes (pastille « Nouveau » de ThemeBrowser) : même fenêtre partout.
 */
export const JOURS_NOUVEAUTE = 15

/** Date à partir de laquelle un document ajouté est une nouveauté. */
export function debutNouveautes(maintenant: number = Date.now()): Date {
  return new Date(maintenant - JOURS_NOUVEAUTE * 86400_000)
}

/** Le document a-t-il été ajouté pendant la fenêtre de nouveauté ? */
export function estNouveau(doc: { createdAt: Date }, maintenant: number = Date.now()): boolean {
  return doc.createdAt >= debutNouveautes(maintenant)
}
