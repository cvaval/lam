/**
 * Fiche demandée par l'URL (`?notaire=<id>`) au CHARGEMENT de la page — lue par le serveur, pour
 * qu'un lien direct (un courriel) arrive sur l'annuaire avec la fiche déjà affichée, même sans
 * JavaScript. Une panne de lecture est rendue comme une PANNE (« Réessayer »), jamais comme une
 * fiche introuvable.
 */
import { getNotaryProfile } from './data'
import { lireIdFiche, versFichePublique } from './fiche-notaire'
import { FERMEE, type EtatFiche } from './fiche-controleur'

export async function ficheInitiale(v: string | string[] | undefined): Promise<EtatFiche> {
  const id = lireIdFiche(v)
  if (!id) return FERMEE
  try {
    const p = await getNotaryProfile(id)
    return p ? { statut: 'ok', id, fiche: versFichePublique(p) } : { statut: 'introuvable', id }
  } catch (e) {
    console.error('[fiche notaire]', e)
    return { statut: 'erreur', id }
  }
}

/**
 * Métadonnées d'une adresse portant `?notaire=<id>` : le titre est celui de la fiche, et l'adresse
 * CANONIQUE est la page de repli du notaire (une seule adresse indexée par notaire).
 */
export async function metadonneesFiche(
  v: string | string[] | undefined,
  locale: string,
  t: { judicial: { notaryMetaTitle: string } },
): Promise<import('next').Metadata | null> {
  const id = lireIdFiche(v)
  if (!id) return null
  const p = await getNotaryProfile(id).catch(() => null)
  if (!p) return null
  return {
    title: t.judicial.notaryMetaTitle.replace('{name}', p.name),
    alternates: { canonical: `/${locale}/juridictions/notaires/${id}` },
  }
}
