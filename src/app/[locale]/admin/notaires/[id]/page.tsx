import Link from 'next/link'
import { notFound } from 'next/navigation'
import { dictFor } from '@/lib/i18n/server'
import { requireCapability } from '@/lib/auth/guard'
import { prisma } from '@/lib/db'
import { formatPhone, readPhones } from '@/lib/jurisdictions/coordonnees'
import { lectureNotairesImpossible } from '@/lib/jurisdictions/data'
import { LIBELLE_ROLE } from '@/lib/jurisdictions/notaires-demandes'
import { NotaryContactEditor, type NotaryContactInitial } from '@/components/jurisdictions/NotaryContactEditor'

export const dynamic = 'force-dynamic'

const ID_RE = /^[a-z0-9][a-z0-9-]{2,119}$/

const lireJson = <T,>(s: string | null | undefined, repli: T): T => {
  try { return s ? (JSON.parse(s) as T) : repli } catch { return repli }
}

/**
 * Fiche de coordonnées d'un notaire (chantier C). `?demande=<id>` (master admin) pré-remplit le
 * formulaire avec la déclaration d'un tiers : la rédaction la relit, la corrige au besoin, et
 * l'enregistrement ACCEPTE la demande. Rien n'est publié tant qu'on n'a pas enregistré.
 */
export default async function AdminNotairePage({
  params, searchParams,
}: { params: { locale: string; id: string }; searchParams: { demande?: string | string[] } }) {
  const { locale } = dictFor(params.locale)
  const user = await requireCapability(locale, 'corpus.manage')
  if (!ID_RE.test(params.id)) notFound()
  const estMaster = user.role === 'MASTER_ADMIN'

  let n
  try {
    n = await prisma.notary.findUnique({
      where: { id: params.id },
      select: {
        id: true, ordinal: true, edition: true, fullName: true, displayName: true, mention: true, active: true,
        sourceCommune: true, sourceDepartment: true,
        commune: { select: { name: true } },
        contact: true,
      },
    })
  } catch (e) {
    if (lectureNotairesImpossible(e)) notFound()
    throw e
  }
  if (!n) notFound()

  const demandeId = Array.isArray(searchParams.demande) ? searchParams.demande[0] : searchParams.demande
  const demande = estMaster && demandeId && /^[a-z0-9]{10,40}$/.test(demandeId)
    ? await prisma.notaryRequest.findUnique({ where: { id: demandeId } }).catch(() => null)
    : null
  // Pré-remplissage : une demande « coordonnées » qui vise ce notaire, ou qui n'en vise aucun
  // (nom saisi — elle s'y rattachera à l'enregistrement). Une demande déjà ACCEPTÉE qui l'a
  // créé (inscription) pré-remplit encore la fiche, sans rien accepter de plus.
  const ouverte = (s: string) => s === 'NOUVELLE' || s === 'EN_COURS'
  const demandeOuverte = demande && demande.kind === 'CONTACT' && ouverte(demande.status) && (!demande.notaryId || demande.notaryId === n.id) ? demande : null
  const demandeSource = demandeOuverte ?? (demande && demande.status === 'ACCEPTEE' && demande.notaryId === n.id && !n.contact ? demande : null)

  const c = n.contact
  const source = lireJson<{ providedBy?: string; channel?: string }>(c?.sourceJson, {})
  const aujourdHui = new Date().toISOString().slice(0, 10)
  let initial: NotaryContactInitial = {
    address: c?.address ?? '',
    phones: readPhones(c?.phonesJson).map(formatPhone),
    email: c?.email ?? '',
    searchAliases: lireJson<string[]>(c?.searchAliasesJson, []),
    observation: c?.observation ?? '',
    upToDateOn: c?.upToDateOn?.toISOString().slice(0, 10) ?? aujourdHui,
    providedBy: source.providedBy ?? '',
    channel: source.channel ?? '',
    active: c?.active ?? true,
  }
  if (demandeSource) {
    const p = lireJson<{ address?: string | null; phones?: string[]; email?: string | null }>(demandeSource.payloadJson, {})
    initial = {
      ...initial,
      address: p.address ?? initial.address,
      phones: p.phones?.length ? p.phones.map(formatPhone) : initial.phones,
      email: p.email ?? initial.email,
      upToDateOn: demandeSource.createdAt.toISOString().slice(0, 10),
      providedBy: `${demandeSource.requesterName} (${LIBELLE_ROLE[demandeSource.requesterRole] ?? demandeSource.requesterRole})`,
      channel: `Formulaire du site, demande n° ${demandeSource.id.slice(-8)}`,
      active: true,
    }
  }

  const nom = n.displayName ?? n.fullName
  return (
    <div className="p-6">
      <p className="text-xs"><Link href={`/${locale}/admin/notaires`} className="text-grafit underline underline-offset-2">← Notaires — coordonnées</Link></p>
      <h1 className="mt-2 font-serif text-2xl font-semibold text-ank">{nom}</h1>
      <p className="mt-1 text-sm text-grafit">
        {n.edition === 'tiers' ? 'Ajouté après vérification par la rédaction' : `N° ${n.ordinal} de la liste du MJSP`}
        {n.mention ? ` · ${n.mention}` : ''} · {n.commune?.name ?? `${n.sourceCommune} (commune non reconnue)`}
        {n.displayName && n.displayName !== n.fullName ? ` · imprimé « ${n.fullName} »` : ''}
      </p>
      <p className="font-mono text-[10px] text-ank/80">{n.id}</p>
      {n.active && (
        <p className="mt-2 text-xs">
          <Link href={`/${locale}/juridictions/notaires/${n.id}`} className="text-grafit underline underline-offset-2">Voir la page publique</Link>
        </p>
      )}

      {!n.active ? (
        <p className="mt-4 max-w-2xl rounded-xl border border-chabon/10 bg-white p-4 text-sm text-grafit">
          Cette entrée est retirée de la liste publiée : elle n’a pas de page et ne reçoit pas de coordonnées.
        </p>
      ) : (
        <>
          {demandeSource && (
            <div className="mt-4 max-w-2xl rounded-xl border-l-2 border-sitwon bg-white p-4 text-sm text-grafit">
              <p className="font-semibold text-ank">Pré-rempli avec la demande n° {demandeSource.id.slice(-8)}</p>
              <p className="mt-1">
                Déclaration de {demandeSource.requesterName} ({LIBELLE_ROLE[demandeSource.requesterRole] ?? demandeSource.requesterRole}).
                {demandeOuverte
                  ? ' Vérifiez avant d’enregistrer : l’enregistrement publie les coordonnées et accepte la demande.'
                  : ' Vérifiez avant d’enregistrer : l’enregistrement publie les coordonnées.'}
              </p>
              <p className="mt-1"><Link href={`/${locale}/admin/notaires/demandes/${demandeSource.id}`} className="underline underline-offset-2">Revoir la demande</Link></p>
            </div>
          )}
          <NotaryContactEditor
            notaryId={n.id}
            initial={initial}
            existe={Boolean(c)}
            requestId={demandeOuverte?.id ?? null}
            peutSupprimer={estMaster}
          />
        </>
      )}
    </div>
  )
}
