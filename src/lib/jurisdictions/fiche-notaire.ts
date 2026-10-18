/**
 * La fiche d'un notaire, partagée par la FENÊTRE MODALE (annuaire, carte judiciaire) et la PAGE DE
 * REPLI `/{locale}/juridictions/notaires/{id}` (lisible sans JavaScript) — fonctions PURES, sans
 * dépendance serveur : ce module est chargé dans le navigateur.
 *
 *  - `versFichePublique` : la LISTE BLANCHE de ce qui sort vers le public (API, modale). Seules les
 *    informations professionnelles publiables et le statut PUBLIC de confirmation (sa date) : ni la
 *    version (empreinte), ni la provenance détaillée, ni rien de l'administration.
 *  - l'URL porte la fiche ouverte : `?notaire=<id>` ajouté à l'adresse de l'annuaire (ou de la carte).
 *    Partageable ; un lien direct ouvre l'annuaire avec la fiche déjà affichée ; « Précédent » la
 *    ferme ; sans JavaScript, le lien de chaque entrée mène à la page de repli.
 */
import type { NotaryProfile } from './data'

/** Ce que le public voit d'une fiche — rien de plus (testé : clés exactes). */
export interface FicheNotairePublique {
  id: string
  /** Nom affiché (décision de la cliente le cas échéant). */
  name: string
  /** Nom tel qu'imprimé sur la liste du MJSP, s'il diffère. */
  printedName: string | null
  mention: string | null
  /** Commune de COMMISSION (décret-loi de 1969) — jamais l'adresse de l'étude. */
  commune: { id: string; name: string; department: string } | null
  /** Colonne imprimée par le MJSP, utile quand la commune n'a pas été reconnue. */
  sourceCommune: string
  /** Juridiction de rattachement (TPI de la commune), affichée sans « TPI ». */
  jurisdiction: { id: string; label: string } | null
  /** Coordonnées PROFESSIONNELLES publiées de l'étude ; null = aucune. */
  contact: { address: string | null; phones: string[]; emails: string[]; upToDateOn: string | null } | null
  /** Date de confirmation par le notaire, seulement si une confirmation VALIDE vise la version publiée. */
  confirmedOn: string | null
}

export function versFichePublique(p: NotaryProfile): FicheNotairePublique {
  const c = p.contact
  return {
    id: p.id,
    name: p.name,
    printedName: p.printedName,
    mention: p.mention,
    commune: p.commune ? { id: p.commune.id, name: p.commune.name, department: p.commune.department } : null,
    sourceCommune: p.sourceCommune,
    jurisdiction: p.jurisdiction ? { id: p.jurisdiction.id, label: p.jurisdiction.label } : null,
    contact: c && (c.address || c.phones.length || c.emails.length)
      ? { address: c.address, phones: [...c.phones], emails: [...c.emails], upToDateOn: c.upToDateOn }
      : null,
    confirmedOn: p.confirmedOn,
  }
}

// ── L'URL de la fiche ouverte ────────────────────────────────────────────────

/** Paramètre d'URL de la fiche ouverte en fenêtre modale. */
export const PARAM_FICHE = 'notaire'
/** Identifiant stable d'une inscription (`mjsp-<édition>-<n>`, `tiers-…`). */
export const ID_NOTAIRE_RE = /^[a-z0-9][a-z0-9-]{2,119}$/

/** Identifiant de fiche lu d'une valeur d'URL ; null si absent ou mal formé (jamais deviné). */
export function lireIdFiche(v: string | string[] | null | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v
  return s && ID_NOTAIRE_RE.test(s) ? s : null
}

const relative = (u: URL) => `${u.pathname}${u.search}${u.hash}`

/** L'adresse COURANTE avec la fiche `id` ouverte — recherche, filtres, page et couches conservés. */
export function urlAvecFiche(href: string, id: string): string {
  const u = new URL(href, 'https://agora.ht')
  u.searchParams.set(PARAM_FICHE, id)
  return relative(u)
}

/** L'adresse COURANTE sans fiche ouverte (la fermeture d'un lien direct ramène à l'annuaire). */
export function urlSansFiche(href: string): string {
  const u = new URL(href, 'https://agora.ht')
  u.searchParams.delete(PARAM_FICHE)
  return relative(u)
}

/**
 * Lien PERSONNALISÉ d'un courriel (`{{lien_fiche_notaire}}`) : l'annuaire de la carte judiciaire,
 * la fiche du destinataire déjà ouverte. Construit À PARTIR DE L'IDENTIFIANT EN BASE, jamais d'un nom ;
 * aucune donnée privée, aucun droit de modification (la fiche est publique).
 */
export function lienFicheNotaire(id: string, opts: { origine?: string; locale?: string } = {}): string {
  if (!ID_NOTAIRE_RE.test(id)) throw new Error(`identifiant de notaire invalide : « ${id} »`)
  const origine = (opts.origine ?? 'https://agora.ht').replace(/\/+$/, '')
  if (!/^https:\/\//.test(origine)) throw new Error('le lien d’un courriel doit être en HTTPS')
  return `${origine}/${opts.locale ?? 'fr'}/juridictions?vue=notaires&${PARAM_FICHE}=${id}`
}

/** Formulaire des tiers (« Demander une modification ou une confirmation »), notaire désigné. */
export function lienDemande(locale: string, params: { notaire?: string; type?: 'inscription' }): string {
  const qs = params.notaire ? `?notaire=${params.notaire}` : params.type ? `?type=${params.type}` : ''
  return `/${locale}/juridictions/notaires/demande${qs}`
}

// ── L'action cartographique de la fiche ──────────────────────────────────────

/** Où la fiche est ouverte : onglet « Notaires », page d'annuaire, ou onglet « Juridictions ». */
export type ContexteFiche = 'onglet' | 'page' | 'juridictions'

/**
 * « Voir la commune sur la carte → » : la carte RÉELLE de la plateforme, la commune de commission
 * sélectionnée — jamais présentée comme l'emplacement de l'étude (aucune étude n'est géolocalisée).
 * La fiche se ferme (l'adresse n'a plus `notaire`), les autres filtres pertinents restent : la
 * recherche, les couches, et la juridiction si c'est celle du notaire. null sans commune reconnue.
 */
export function lienCarteFiche(contexte: ContexteFiche, href: string, locale: string, fiche: Pick<FicheNotairePublique, 'commune' | 'jurisdiction'>): string | null {
  if (!fiche.commune) return null
  const u = new URL(href, 'https://agora.ht')
  const garde = new URLSearchParams()
  const layers = u.searchParams.get('layers')
  if (contexte === 'juridictions') {
    garde.set('commune', fiche.commune.id)
    if (layers !== null) garde.set('layers', layers)
    return `/${locale}/juridictions?${garde.toString()}#ag-judicial-map`
  }
  garde.set('vue', 'notaires')
  const q = u.searchParams.get('q')
  if (q) garde.set('q', q)
  const jur = u.searchParams.get('juridiction')
  if (jur && jur === fiche.jurisdiction?.id) garde.set('juridiction', jur)
  garde.set('commune', fiche.commune.id)
  // Les couches choisies dans l'onglet ; la page d'annuaire n'en a pas.
  if (contexte === 'onglet' && layers !== null) garde.set('layers', layers)
  // Téléphone : la carte s'ouvre d'office.
  garde.set('carte', '1')
  return `/${locale}/juridictions?${garde.toString()}#ag-carte-notaires-mobile`
}
