/**
 * Chargement de l'« Annuaire des notaires » — UN SEUL pour l'onglet « Notaires » de la carte et la
 * page d'annuaire : mêmes données (`getNotaryAnnuaire`), même recherche (nom OU commune), mêmes
 * filtres. Une panne est rendue comme une PANNE (`erreur`), jamais comme une liste vide.
 */
import type { EtatAnnuaire } from '@/components/jurisdictions/NotaryAnnuaireView'
import { getNotaryAnnuaire, getNotaryIndex } from './data'
import { searchNotaries } from './search-notaries'
import type { AnnuaireParams } from './annuaire-notaires'

export async function chargerAnnuaire(p: AnnuaireParams): Promise<{ etat: EtatAnnuaire; params: AnnuaireParams; communeInconnue: boolean }> {
  let etat: EtatAnnuaire
  try {
    const a = await getNotaryAnnuaire()
    if (!a) etat = { kind: 'indisponible' }
    else {
      const trouves = p.q ? new Set(searchNotaries(await getNotaryIndex(), p.q, { avecCommune: true }).map((h) => h.id)) : null
      etat = { kind: 'ok', annuaire: a, trouves }
    }
  } catch (e) {
    console.error('[annuaire des notaires]', e)
    etat = { kind: 'erreur' }
  }
  // Commune inconnue (identifiant bien formé, absent du référentiel) : le filtre est ignoré, et dit.
  const communeInconnue = Boolean(p.commune && etat.kind === 'ok' && !etat.annuaire.communes.some((c) => c.id === p.commune))
  return { etat, params: communeInconnue ? { ...p, commune: null } : p, communeInconnue }
}
