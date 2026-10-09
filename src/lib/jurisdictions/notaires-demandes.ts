/**
 * Coordonnées des notaires : SAISIE par la rédaction (chantier C) et DEMANDES des tiers
 * (chantier D) — fonctions PURES, testées dans notaires-demandes.test.ts. Les routes ne font que
 * lire la base, appeler ces fonctions et écrire.
 *
 * ⚠️ UNE DEMANDE N'EST QU'UNE DÉCLARATION. Rien de publié ne change avant la décision du master
 * admin ; une inscription hors de la liste du MJSP exige une vérification CONSIGNÉE.
 *
 * ⚠️ AUCUN COURRIEL AU DEMANDEUR. Un accusé de réception automatique ferait du site un relais
 * pour écrire à n'importe quelle adresse saisie dans le formulaire. Seule l'adresse FIXE de la
 * rédaction (legal@agora.ht, ou `NOTARY_REQUEST_ALERT_TO`) est prévenue.
 *
 * ⚠️ LE FORMULAIRE EST FERMÉ PAR DÉFAUT (`NOTARY_REQUESTS_ENABLED`, et les clés Turnstile). Il collecte des données
 * personnelles : la cliente valide d'abord l'addition à la politique de confidentialité
 * (docs/confidentialite-demandes-notaires.md).
 */
import { z } from 'zod'
import { EMAIL_RE, normalizePhone } from './coordonnees'
import { clesTurnstile } from '../security/turnstile'

export const DEMANDE_KINDS = ['CONTACT', 'LISTING'] as const
export type DemandeKind = (typeof DEMANDE_KINDS)[number]
export const DEMANDEUR_ROLES = ['NOTAIRE', 'ETUDE', 'AUTRE'] as const
export type DemandeurRole = (typeof DEMANDEUR_ROLES)[number]
export const DEMANDE_STATUTS = ['NOUVELLE', 'EN_COURS', 'ACCEPTEE', 'REFUSEE'] as const
export type DemandeStatut = (typeof DEMANDE_STATUTS)[number]
/** Libellés de l'administration (français seulement, comme le reste de la console). */
export const LIBELLE_STATUT: Record<string, string> = { NOUVELLE: 'Nouvelle', EN_COURS: 'En cours', ACCEPTEE: 'Acceptée', REFUSEE: 'Refusée' }
export const LIBELLE_KIND: Record<string, string> = { CONTACT: 'Coordonnées', LISTING: 'Inscription' }
export const LIBELLE_ROLE: Record<string, string> = { NOTAIRE: 'le notaire', ETUDE: 'son étude', AUTRE: 'autre' }

/** Frein persistant par adresse IP (compté sur l'audit NOTARY_REQUEST_CREATED). */
export const DEMANDES_PAR_IP = { limit: 3, windowMs: 3_600_000 } as const
/** Au-delà, les demandes sont toujours ENREGISTRÉES, mais un seul courriel signale le volume. */
export const PLAFOND_COURRIELS_JOUR = 30
/** Un formulaire rempli en moins de 3 s n'a pas été rempli par une personne. */
export const DELAI_MINIMAL_MS = 3_000
/** Conservation d'une demande traitée (acceptée ou refusée), à compter de la décision. */
export const CONSERVATION_MOIS = 12

const ID_RE = /^[a-z0-9][a-z0-9-]{2,119}$/
function isoDateSchema() {
  return z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v))
}

/**
 * Le formulaire public est-il ouvert ? Il faut DEUX conditions : la variable dit exactement
 * `true`, ET les clés de la vérification humaine (Turnstile) sont là. Mieux vaut un formulaire
 * fermé qu'un formulaire ouvert sans protection (docs/prompt-verification-humaine-turnstile.md).
 */
export function demandesOuvertes(env: Record<string, string | undefined> = process.env): boolean {
  return env.NOTARY_REQUESTS_ENABLED === 'true' && clesTurnstile(env) !== null
}

/** Destinataires de la notification : JAMAIS une adresse saisie par le public. */
export function destinatairesAlerte(env: Record<string, string | undefined> = process.env): string[] {
  const brut = env.NOTARY_REQUEST_ALERT_TO?.trim() || 'legal@agora.ht'
  return brut.split(',').map((x) => x.trim()).filter((x) => EMAIL_RE.test(x))
}

/** Texte d'une ligne : caractères de contrôle et retours à la ligne neutralisés, bornes. */
const ligne = (v: string | undefined, max: number): string | null => {
  const s = (v ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()
  return s ? s.slice(0, max) : null
}
const texte = (v: string | undefined, max: number): string | null => {
  const s = (v ?? '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, ' ').trim()
  return s ? s.slice(0, max) : null
}

/** « +509 2942-3848 ; 2998 4747 » → E.164 ; `null` si UN des numéros est illisible. */
export function lireTelephones(brut: string | null): string[] | null {
  if (!brut) return []
  const morceaux = brut.split(/[;,/\n]+/).map((x) => x.trim()).filter(Boolean)
  const sortie: string[] = []
  for (const m of morceaux) {
    const n = normalizePhone(m)
    if (!n) return null
    if (!sortie.includes(n)) sortie.push(n)
  }
  return sortie.slice(0, 4)
}

// ── Chantier D : le formulaire public ─────────────────────────────────────────

export type ChampDemande =
  | 'type' | 'notaire' | 'nomNotaire' | 'commune' | 'nom' | 'qualite' | 'qualiteAutre'
  | 'adresse' | 'telephones' | 'courriel' | 'coordonnees' | 'message' | 'courrielContact' | 'consentement'

export interface DemandeValide {
  kind: DemandeKind
  notaryId: string | null
  /** Nom du notaire saisi (inscription, ou coordonnées sans entrée choisie). */
  notaryName: string | null
  communeId: string | null
  requesterName: string
  requesterRole: DemandeurRole
  requesterRoleOther: string | null
  address: string | null
  phones: string[]
  email: string | null
  message: string | null
  requesterEmail: string
}

export type LectureDemande =
  | { kind: 'piege' }
  | { kind: 'invalide'; erreurs: ChampDemande[] }
  | { kind: 'valide'; valeur: DemandeValide }

/**
 * Lit les champs du formulaire (FormData aplati). `piege` : champ caché rempli ou formulaire
 * envoyé trop vite — la route répond comme si tout allait bien et n'enregistre RIEN.
 */
export function lireDemande(
  champs: Record<string, string | undefined>,
  opts: { maintenant: number; communesValides: ReadonlySet<string> },
): LectureDemande {
  if ((champs.site ?? '').trim() !== '') return { kind: 'piege' }
  const t = Number(champs.t)
  if (!Number.isFinite(t) || opts.maintenant - t < DELAI_MINIMAL_MS || t > opts.maintenant + 60_000) return { kind: 'piege' }

  const erreurs: ChampDemande[] = []
  const kind: DemandeKind | null = champs.type === 'coordonnees' ? 'CONTACT' : champs.type === 'inscription' ? 'LISTING' : null
  if (!kind) erreurs.push('type')

  const notaryId = ligne(champs.notaire, 120)
  if (notaryId && !ID_RE.test(notaryId)) erreurs.push('notaire')
  const notaryName = ligne(champs.nomNotaire, 120)
  const communeId = ligne(champs.commune, 120)
  if (kind === 'LISTING') {
    if (!notaryName) erreurs.push('nomNotaire')
    if (!communeId || !opts.communesValides.has(communeId)) erreurs.push('commune')
  } else if (kind === 'CONTACT' && !notaryId && !notaryName) {
    erreurs.push('nomNotaire')
  }
  if (communeId && kind === 'CONTACT' && !opts.communesValides.has(communeId)) erreurs.push('commune')

  const requesterName = ligne(champs.nom, 120)
  if (!requesterName) erreurs.push('nom')
  const role = (DEMANDEUR_ROLES as readonly string[]).includes(champs.qualite ?? '') ? (champs.qualite as DemandeurRole) : null
  if (!role) erreurs.push('qualite')
  const roleOther = ligne(champs.qualiteAutre, 120)
  if (role === 'AUTRE' && !roleOther) erreurs.push('qualiteAutre')

  const address = ligne(champs.adresse, 200)
  const phones = lireTelephones(ligne(champs.telephones, 120))
  if (phones === null) erreurs.push('telephones')
  const email = ligne(champs.courriel, 120)
  if (email && !EMAIL_RE.test(email)) erreurs.push('courriel')
  // Un numéro illisible se signale pour lui-même : pas de second message « aucune coordonnée ».
  if (kind === 'CONTACT' && phones !== null && !address && !phones.length && !email) erreurs.push('coordonnees')

  const message = texte(champs.message, 1000)
  const requesterEmail = ligne(champs.courrielContact, 120)
  if (!requesterEmail || !EMAIL_RE.test(requesterEmail)) erreurs.push('courrielContact')
  if (champs.consentement !== 'oui') erreurs.push('consentement')

  if (erreurs.length || !kind || !requesterName || !role || !requesterEmail || phones === null) {
    return { kind: 'invalide', erreurs: [...new Set(erreurs)] }
  }
  return {
    kind: 'valide',
    valeur: {
      kind, notaryId, notaryName, communeId: communeId && opts.communesValides.has(communeId) ? communeId : null,
      requesterName, requesterRole: role, requesterRoleOther: role === 'AUTRE' ? roleOther : null,
      address, phones, email, message, requesterEmail,
    },
  }
}

/** Identifiant d'une entrée ajoutée HORS de la liste du MJSP : `tiers-AAAAMMJJ-n`. */
export function idTiers(jour: Date, rang: number): string {
  const d = jour.toISOString().slice(0, 10).replace(/-/g, '')
  return `tiers-${d}-${rang}`
}
export const EDITION_TIERS = 'tiers'

/** Premier identifiant `tiers-AAAAMMJJ-n` libre du jour, d'après les identifiants existants. */
export function prochainIdTiers(jour: Date, existants: readonly string[]): string {
  const prefixe = idTiers(jour, 0).slice(0, -1)
  const rangs = existants.filter((x) => x.startsWith(prefixe)).map((x) => Number(x.slice(prefixe.length))).filter(Number.isInteger)
  return idTiers(jour, rangs.length ? Math.max(...rangs) + 1 : 1)
}

// ── Décision du master admin ─────────────────────────────────────────────────

/**
 * Trois décisions, et une seule qui publie quelque chose sans passer par l'écran des
 * coordonnées : INSCRIRE un notaire absent de la liste. Elle exige une VÉRIFICATION CONSIGNÉE
 * (comment, et quand) — elle s'affiche ensuite sur la page du notaire.
 * Les coordonnées d'un notaire déjà listé s'acceptent depuis sa fiche (chantier C).
 */
export const decisionDemandeSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('EN_COURS') }),
  z.object({ action: z.literal('REFUSER'), note: z.string().trim().min(3).max(1000) }),
  z.object({
    action: z.literal('INSCRIRE'),
    fullName: z.string().trim().min(3).max(120),
    communeId: z.string().regex(ID_RE),
    verifiedOn: isoDateSchema(),
    note: z.string().trim().min(10).max(1000),
  }),
])
export type DecisionDemande = z.infer<typeof decisionDemandeSchema>

/** Une demande décidée (acceptée ou refusée) ne se rouvre pas ; INSCRIRE ne vaut que pour une inscription. */
export function decisionPermise(statut: string, kind: string, action: DecisionDemande['action']): boolean {
  if (statut !== 'NOUVELLE' && statut !== 'EN_COURS') return false
  if (action === 'EN_COURS') return statut === 'NOUVELLE'
  if (action === 'INSCRIRE') return kind === 'LISTING'
  return true
}

/** Date au-delà de laquelle une demande décidée est purgée. */
export function seuilPurgeDemandes(maintenant: Date): Date {
  const d = new Date(maintenant)
  d.setUTCMonth(d.getUTCMonth() - CONSERVATION_MOIS)
  return d
}

// ── Chantier C : la saisie par la rédaction ───────────────────────────────────


export const saisieContactSchema = z.object({
  address: z.string().max(200).nullable(),
  phones: z.array(z.string().max(40)).max(4),
  email: z.string().max(120).nullable(),
  searchAliases: z.array(z.string().max(80)).max(5),
  observation: z.string().max(1000).nullable(),
  upToDateOn: isoDateSchema(),
  providedBy: z.string().min(1).max(120),
  channel: z.string().min(1).max(120),
  active: z.boolean(),
  /** Demande d'un tiers à l'origine de la fiche (acceptée en l'enregistrant). */
  requestId: z.string().max(40).nullable().optional(),
})
export type SaisieContact = z.infer<typeof saisieContactSchema>

export interface ContactNormalise {
  address: string | null
  phonesJson: string
  email: string | null
  searchAliasesJson: string
  observation: string | null
  sourceJson: string
  upToDateOn: Date
  active: boolean
}

/** Mêmes règles que l'import (coordonnees.ts) : rien d'inventé, tout numéro lisible ou refusé. */
export function normaliserSaisieContact(s: SaisieContact): { ok: true; valeur: ContactNormalise } | { ok: false; erreurs: string[] } {
  const erreurs: string[] = []
  const address = ligne(s.address ?? undefined, 200)
  const phones: string[] = []
  for (const p of s.phones.map((x) => x.trim()).filter(Boolean)) {
    const n = normalizePhone(p)
    if (!n) erreurs.push(`telephone:${p}`)
    else if (!phones.includes(n)) phones.push(n)
  }
  const email = ligne(s.email ?? undefined, 120)
  if (email && !EMAIL_RE.test(email)) erreurs.push('courriel')
  if (!address && !phones.length && !email) erreurs.push('coordonnees')
  const aliases = [...new Set(s.searchAliases.map((a) => ligne(a, 80)).filter((a): a is string => Boolean(a)))]
  if (erreurs.length) return { ok: false, erreurs }
  return {
    ok: true,
    valeur: {
      address,
      phonesJson: JSON.stringify(phones),
      email,
      searchAliasesJson: JSON.stringify(aliases),
      observation: texte(s.observation ?? undefined, 1000),
      sourceJson: JSON.stringify({
        providedBy: ligne(s.providedBy, 120), providedOn: s.upToDateOn, channel: ligne(s.channel, 120),
        evidence: null, ...(s.requestId ? { requestId: s.requestId } : {}),
      }),
      upToDateOn: new Date(`${s.upToDateOn}T00:00:00.000Z`),
      active: s.active,
    },
  }
}
