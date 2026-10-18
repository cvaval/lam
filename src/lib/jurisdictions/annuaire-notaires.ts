/**
 * ANNUAIRE DES NOTAIRES (onglet « Notaires » de la carte judiciaire) — fonctions PURES, testées
 * dans annuaire-notaires.test.ts. Les données viennent de `getNotaryAnnuaire()` (data.ts), qui
 * part de `getNotaryDirectory()` : un seul classement par juridiction pour les deux annuaires.
 *
 * CLASSEMENT PAR DÉFAUT (appliqué à TOUTE la liste, avant la pagination) :
 *  1. par juridiction, dans l'ordre alphabétique de son nom affiché (il n'existe pas d'ordre
 *     éditorial des juridictions) ; « Juridiction non déterminée » en dernier ;
 *  2. dans chaque juridiction, les notaires dont l'ADRESSE EXACTE de l'étude est connue d'abord ;
 *  3. dans chacun de ces deux groupes : nom de famille, puis prénoms, puis identifiant (stable).
 *
 * NOM DE FAMILLE — la base n'a PAS de champ structuré (`Notary.fullName`, `displayName`). La liste
 * du MJSP suit une convention constante : prénoms en minuscules capitalisées, nom de famille en
 * MAJUSCULES à la fin (« Garry BRISSON CASSAGNOL », « Ronald E. PIERRE-LOUIS »). Règle : le nom de
 * famille est la suite FINALE des mots écrits entièrement en capitales (au moins deux lettres ;
 * accents, tirets, apostrophes admis ; une initiale « B. » l'interrompt). REPLI explicite, quand
 * aucun mot final n'est en capitales (« Jean Fitzner ») : on ne devine pas, la clé de tri est le
 * nom ENTIER. Le nom affiché n'est jamais modifié : seule la clé de tri en dérive.
 *
 * ADRESSE EXACTE — il n'existe pas de statut de qualité de l'adresse : `NotaryContact.address`
 * est une ligne libre. Règle conservatrice : fiche ACTIVE, adresse non vide, et qui porte un
 * élément de VOIE — un numéro (« 14 », « #52 ») ou un mot de voie (rue, avenue, route…). Une
 * commune, un quartier, un département seuls ne sont pas une adresse exacte. Une adresse, même
 * exacte, n'est PAS une position : Agora ne géolocalise aucune adresse, la carte situe la commune.
 */
import { normalizePlaceName } from './normalize-place'

export interface AnnuaireEntry {
  id: string
  /** Nom AFFICHÉ (décision de la cliente le cas échéant), jamais modifié. */
  name: string
  mention: string | null
  communeId: string | null
  communeName: string | null
  department: string | null
  /** Juridiction déduite de la commune (TPI compétent), affichée sans « TPI ». null = non déterminée. */
  jurisdictionId: string | null
  jurisdictionLabel: string | null
  /** Adresse de l'étude quand elle est EXACTE (voir `adresseExacte`), sinon null. */
  address: string | null
  hasContact: boolean
  addedByEditors: boolean
  /** Badge « Confirmé » autorisé (date de confirmation) — n'entre PAS dans le classement. */
  confirmedOn: string | null
}

/** Mot écrit en capitales : deux lettres au moins, aucune minuscule (accents, tirets, apostrophes admis). */
const MOT_CAPITALES = /^[A-ZÀ-ÖØ-ÞŒ][A-ZÀ-ÖØ-ÞŒ'’-]*[A-ZÀ-ÖØ-ÞŒ]$/u

/**
 * Nom de famille d'après la convention du MJSP (capitales finales). `marque: false` = aucun mot
 * final en capitales : `famille` vaut alors le nom entier et `prenoms` est vide (repli documenté).
 */
export function nomDeFamille(nom: string): { famille: string; prenoms: string; marque: boolean } {
  const mots = nom.trim().split(/\s+/).filter(Boolean)
  let i = mots.length
  while (i > 0 && MOT_CAPITALES.test(mots[i - 1])) i--
  if (i === mots.length) return { famille: nom.trim(), prenoms: '', marque: false }
  return { famille: mots.slice(i).join(' '), prenoms: mots.slice(0, i).join(' '), marque: true }
}

/** Clé de tri : casse, accents, tirets, apostrophes et espaces neutralisés (« Céant » ≡ « CEANT »). */
export const cleTri = (s: string) => normalizePlaceName(s)

const MOTS_DE_VOIE = new Set([
  'rue', 'ruelle', 'avenue', 'ave', 'av', 'route', 'rte', 'boulevard', 'bd', 'blvd', 'impasse', 'imp',
  'chemin', 'angle', 'corridor', 'allee', 'autoroute', 'place', 'carrefour', 'cite', 'lotissement', 'prolongee',
])

/**
 * L'adresse d'une étude est-elle EXACTE ? Non vide, différente du nom de la commune ou du
 * département, et porteuse d'un numéro ou d'un mot de voie. Ne dit rien de sa position.
 */
export function adresseExacte(address: string | null | undefined, lieux: Array<string | null | undefined> = []): boolean {
  const a = (address ?? '').trim()
  if (!a) return false
  const n = cleTri(a)
  if (!n || lieux.some((l) => l && cleTri(l) === n)) return false
  if (/\d/.test(a)) return true
  return n.split(' ').some((w) => MOTS_DE_VOIE.has(w))
}

interface Cles { juridiction: string; sansJuridiction: boolean; adresse: 0 | 1; famille: string; prenoms: string }

const cles = (e: AnnuaireEntry): Cles => {
  const { famille, prenoms } = nomDeFamille(e.name)
  return {
    juridiction: cleTri(e.jurisdictionLabel ?? ''),
    sansJuridiction: !e.jurisdictionId,
    adresse: e.address ? 0 : 1,
    famille: cleTri(famille),
    prenoms: cleTri(prenoms),
  }
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** Classement par défaut de TOUTE la liste (voir l'en-tête). Ne modifie pas le tableau reçu. */
export function classerAnnuaire(entries: readonly AnnuaireEntry[]): AnnuaireEntry[] {
  const k = new Map(entries.map((e) => [e.id, cles(e)]))
  return [...entries].sort((x, y) => {
    const a = k.get(x.id)!
    const b = k.get(y.id)!
    return (
      Number(a.sansJuridiction) - Number(b.sansJuridiction)
      || cmp(a.juridiction, b.juridiction)
      || cmp(x.jurisdictionId ?? '', y.jurisdictionId ?? '')
      || a.adresse - b.adresse
      || cmp(a.famille, b.famille)
      || cmp(a.prenoms, b.prenoms)
      || cmp(x.id, y.id)
    )
  })
}

// ── État de l'annuaire porté par l'URL (partageable, retour arrière naturel) ─────────────

export interface AnnuaireParams {
  q: string
  juridiction: string | null
  commune: string | null
  page: number
}

const ID_RE = /^[a-z0-9][a-z0-9-]{2,119}$/
const premier = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

/** Lecture TOLÉRANTE et bornée des paramètres : une valeur invalide est ignorée, jamais renvoyée. */
export function lireParamsAnnuaire(sp: Record<string, string | string[] | undefined>): AnnuaireParams {
  const q = (premier(sp.q) ?? '').trim().slice(0, 80)
  const juridiction = premier(sp.juridiction)
  const commune = premier(sp.commune)
  const page = Number.parseInt(premier(sp.page) ?? '1', 10)
  return {
    q,
    juridiction: juridiction && ID_RE.test(juridiction) ? juridiction : null,
    commune: commune && ID_RE.test(commune) ? commune : null,
    page: Number.isFinite(page) && page >= 1 && page <= 1000 ? page : 1,
  }
}

/**
 * Où vit l'annuaire : l'onglet « Notaires » de la carte (`/juridictions?vue=notaires`) ou la page
 * d'annuaire historique (`/juridictions/notaires`). MÊMES données, classement et filtres.
 */
export type Emplacement = 'onglet' | 'page'
export const cheminAnnuaire = (o: Emplacement) => (o === 'onglet' ? '/juridictions' : '/juridictions/notaires')

/** Chaîne de requête de l'annuaire (`vue=notaires` en tête dans l'onglet de la carte). */
export function qsAnnuaire(p: Partial<AnnuaireParams>, extra: Record<string, string | null | undefined> = {}, ou: Emplacement = 'onglet'): string {
  const s = new URLSearchParams(ou === 'onglet' ? { vue: 'notaires' } : {})
  if (p.q) s.set('q', p.q)
  if (p.juridiction) s.set('juridiction', p.juridiction)
  if (p.commune) s.set('commune', p.commune)
  for (const [k, v] of Object.entries(extra)) if (v) s.set(k, v)
  if (p.page && p.page > 1) s.set('page', String(p.page))
  return s.toString()
}

/** Valeur de `?retour=` d'un lien « Voir la fiche » : l'emplacement et l'état de l'annuaire. */
export const retourAnnuaire = (p: AnnuaireParams, ou: Emplacement, layers: string | null = null) =>
  `${ou}:${qsAnnuaire(p, ou === 'onglet' ? { layers } : {}, ou)}`

/**
 * `?retour=` de la page d'un notaire : l'annuaire d'où l'on vient, RELU paramètre par paramètre et
 * reconstruit — jamais recopié tel quel dans un lien (ni injection, ni redirection ouverte). Rend
 * le CHEMIN sans la langue (« /juridictions?vue=notaires&q=… », « /juridictions/notaires?… »), ou
 * null si absent, trop long ou étranger à l'annuaire.
 */
export function lireRetourAnnuaire(raw: string | string[] | undefined): string | null {
  const brut = Array.isArray(raw) ? raw[0] : raw
  if (!brut || brut.length > 400) return null
  const m = /^(onglet|page):(.*)$/s.exec(brut)
  const ou: Emplacement = m?.[1] === 'page' ? 'page' : 'onglet'
  const sp = Object.fromEntries(new URLSearchParams(m ? m[2] : brut))
  if (ou === 'onglet' && sp.vue !== 'notaires') return null
  const layers = ou === 'onglet' && sp.layers !== undefined && /^[a-z,]{0,80}$/.test(sp.layers) ? sp.layers : null
  const qs = qsAnnuaire(lireParamsAnnuaire(sp), { layers }, ou)
  return `${cheminAnnuaire(ou)}${qs ? `?${qs}` : ''}`
}

/** Nombre de filtres actifs (la page n'en est pas un). */
export const filtresActifs = (p: AnnuaireParams) => Number(Boolean(p.q)) + Number(Boolean(p.juridiction)) + Number(Boolean(p.commune))

/**
 * Filtre la liste CLASSÉE : recherche (identifiants trouvés par `searchNotaries`), juridiction,
 * commune. Les filtres se cumulent. L'ordre reçu est conservé.
 */
export function filtrerAnnuaire(
  classes: readonly AnnuaireEntry[],
  f: { ids?: Set<string> | null; juridiction?: string | null; commune?: string | null },
): AnnuaireEntry[] {
  return classes.filter((e) =>
    (!f.ids || f.ids.has(e.id))
    && (!f.juridiction || e.jurisdictionId === f.juridiction)
    && (!f.commune || e.communeId === f.commune),
  )
}

export const TAILLE_PAGE = 30

export interface PageAnnuaire {
  page: number
  pages: number
  total: number
  /** Rang (1-based) du premier et du dernier résultat de la page. */
  de: number
  a: number
  groupes: Array<{
    jurisdictionId: string | null
    label: string | null
    /** La juridiction a commencé sur une page précédente (« suite »). */
    suite: boolean
    entries: AnnuaireEntry[]
  }>
}

/** Découpe la liste classée et filtrée ; regroupe la page par juridiction. Page hors bornes → dernière. */
export function paginerAnnuaire(liste: readonly AnnuaireEntry[], pageDemandee: number, taille = TAILLE_PAGE): PageAnnuaire {
  const total = liste.length
  const pages = Math.max(1, Math.ceil(total / taille))
  const page = Math.min(Math.max(1, pageDemandee), pages)
  const debut = (page - 1) * taille
  const tranche = liste.slice(debut, debut + taille)
  const groupes: PageAnnuaire['groupes'] = []
  tranche.forEach((e, i) => {
    const g = groupes.at(-1)
    if (g && g.jurisdictionId === e.jurisdictionId) g.entries.push(e)
    else {
      const precedent = debut + i > 0 ? liste[debut + i - 1] : null
      groupes.push({
        jurisdictionId: e.jurisdictionId,
        label: e.jurisdictionLabel,
        suite: Boolean(precedent && precedent.jurisdictionId === e.jurisdictionId),
        entries: [e],
      })
    }
  })
  return { page, pages, total, de: total ? debut + 1 : 0, a: debut + tranche.length, groupes }
}
