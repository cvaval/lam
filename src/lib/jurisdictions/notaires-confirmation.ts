/**
 * Badge « Confirmé » des notaires — fonctions PURES (testées dans notaires-confirmation.test.ts)
 * et une écriture transactionnelle (`invaliderSiModifie`).
 *
 * UNE CONFIRMATION EST LIÉE À UNE VERSION. Le master admin valide la confirmation du notaire sur
 * un INSTANTANÉ des informations publiées de l'inscription (nom affiché, commune de commission,
 * adresse de l'étude, téléphones, courriels) ; son empreinte (`snapshotHash`) est la version
 * confirmée. Le badge ne s'affiche que si l'empreinte des informations ACTUELLES est la même : une
 * modification substantielle l'efface aussitôt, à la lecture — et chaque chemin d'écriture connu
 * marque en plus la confirmation INVALIDÉE (`invaliderSiModifie`), pour l'historique.
 *
 * Ce que le badge n'est pas : ni une certification professionnelle, ni une reconnaissance du MJSP,
 * ni une garantie des prestations. Son absence ne dit rien de la fiabilité d'un notaire.
 */
import { createHash } from 'node:crypto'
import { readEmails } from './coordonnees'

export const STATUTS_CONFIRMATION = ['ACTIVE', 'RETIREE', 'INVALIDEE', 'REMPLACEE'] as const
export type StatutConfirmation = (typeof STATUTS_CONFIRMATION)[number]

/** Méthodes de vérification de la PROVENANCE admises (la liste n'inclut ni connexion ni case cochée). */
export const METHODES_VERIFICATION = [
  'APPEL_NUMERO_INDEPENDANT', // rappel au numéro de l'étude connu d'une source indépendante de la demande
  'COURRIEL_ADRESSE_CONNUE', // réponse depuis l'adresse professionnelle déjà publiée ou attestée
  'RENCONTRE', // rencontre ou visite à l'étude
  'DOCUMENT_SIGNE', // écrit signé du notaire (cachet de l'étude)
  'AUTRE', // autre méthode, décrite dans la note
] as const
export type MethodeVerification = (typeof METHODES_VERIFICATION)[number]
export const LIBELLE_METHODE: Record<MethodeVerification, string> = {
  APPEL_NUMERO_INDEPENDANT: 'Rappel au numéro de l’étude connu d’une source indépendante',
  COURRIEL_ADRESSE_CONNUE: 'Réponse depuis l’adresse professionnelle déjà connue',
  RENCONTRE: 'Rencontre ou visite à l’étude',
  DOCUMENT_SIGNE: 'Écrit signé du notaire',
  AUTRE: 'Autre (décrite dans la note)',
}

/** Informations publiées d'une inscription — ce que le notaire confirme. */
export interface Instantane {
  nom: string
  communeId: string | null
  adresse: string | null
  telephones: string[]
  courriels: string[]
}

const propre = (s: string | null | undefined) => {
  const v = (s ?? '').replace(/\s+/g, ' ').trim()
  return v ? v : null
}

const lireTelephones = (json: string | null | undefined): string[] => {
  try {
    const v = JSON.parse(json ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch { return [] }
}

/**
 * Instantané des informations PUBLIÉES : une fiche de coordonnées inactive ne publie rien. Les
 * espaces sont normalisés (un espace en trop n'est pas une modification substantielle) ; la casse et
 * l'ordre des téléphones, eux, comptent — ils changent ce que lit le public.
 */
export function instantane(
  n: { fullName: string; displayName: string | null; communeId: string | null },
  c: { address: string | null; phonesJson: string; email: string | null; emailsJson: string; active: boolean } | null,
): Instantane {
  const fiche = c?.active ? c : null
  return {
    nom: propre(n.displayName ?? n.fullName) ?? '',
    communeId: n.communeId,
    adresse: propre(fiche?.address),
    telephones: fiche ? lireTelephones(fiche.phonesJson) : [],
    courriels: fiche ? readEmails(fiche.emailsJson, fiche.email).map((x) => propre(x)).filter((x): x is string => Boolean(x)) : [],
  }
}

/** Empreinte de l'instantané (SHA-256 d'un JSON à clés ordonnées) — la VERSION confirmée. */
export function empreinte(i: Instantane): string {
  const canon = JSON.stringify([i.nom, i.communeId, i.adresse, i.telephones, i.courriels])
  return createHash('sha256').update(canon).digest('hex')
}

/** Le badge s'affiche-t-il ? Confirmation ACTIVE ET informations inchangées depuis la validation. */
export function badgeAffichable(conf: { status: string; snapshotHash: string } | null | undefined, actuelle: string): boolean {
  return Boolean(conf && conf.status === 'ACTIVE' && conf.snapshotHash === actuelle)
}

/** Ce que le PUBLIC en voit : la date de confirmation par le notaire, rien d'autre. */
export function confirmationPublique(
  conf: { status: string; snapshotHash: string; confirmedOn: Date } | null | undefined,
  actuelle: string,
): { on: string } | null {
  return conf && badgeAffichable(conf, actuelle) ? { on: conf.confirmedOn.toISOString().slice(0, 10) } : null
}

/** Champs qui diffèrent entre deux instantanés (pour l'historique et la comparaison de l'administration). */
export function champsModifies(a: Instantane, b: Instantane): Array<keyof Instantane> {
  const k: Array<keyof Instantane> = ['nom', 'communeId', 'adresse', 'telephones', 'courriels']
  return k.filter((x) => JSON.stringify(a[x]) !== JSON.stringify(b[x]))
}

/** Le minimum d'un client Prisma (ou d'une transaction) dont `invaliderSiModifie` a besoin. */
interface TxConfirmation {
  notary: {
    findUnique(args: {
      where: { id: string }
      select: { fullName: true; displayName: true; communeId: true; contact: { select: { address: true; phonesJson: true; email: true; emailsJson: true; active: true } } }
    }): Promise<{ fullName: string; displayName: string | null; communeId: string | null; contact: { address: string | null; phonesJson: string; email: string | null; emailsJson: string; active: boolean } | null } | null>
  }
  notaryConfirmation: {
    findMany(args: { where: { notaryId: string; status: 'ACTIVE' }; select: { id: true; snapshotHash: true } }): Promise<Array<{ id: string; snapshotHash: string }>>
    update(args: { where: { id: string }; data: { status: 'INVALIDEE'; endedAt: Date; endedById: string | null; endReason: string } }): Promise<unknown>
  }
}

/**
 * Après TOUTE écriture des informations d'une inscription : si la version publiée n'est plus celle
 * qui a été confirmée, la confirmation passe INVALIDÉE (le badge disparaît jusqu'à une nouvelle
 * confirmation validée). À appeler DANS la transaction de l'écriture. Rend les confirmations
 * invalidées (pour l'audit).
 */
export async function invaliderSiModifie(tx: TxConfirmation, notaryId: string, auteurId: string | null, motif: string): Promise<string[]> {
  const n = await tx.notary.findUnique({
    where: { id: notaryId },
    select: { fullName: true, displayName: true, communeId: true, contact: { select: { address: true, phonesJson: true, email: true, emailsJson: true, active: true } } },
  })
  if (!n) return []
  const actuelle = empreinte(instantane(n, n.contact))
  const actives = await tx.notaryConfirmation.findMany({ where: { notaryId, status: 'ACTIVE' }, select: { id: true, snapshotHash: true } })
  const perimees = actives.filter((c) => c.snapshotHash !== actuelle)
  for (const c of perimees) {
    await tx.notaryConfirmation.update({
      where: { id: c.id },
      data: { status: 'INVALIDEE', endedAt: new Date(), endedById: auteurId, endReason: motif },
    })
  }
  return perimees.map((c) => c.id)
}
