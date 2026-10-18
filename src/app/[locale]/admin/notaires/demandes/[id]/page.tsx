import Link from 'next/link'
import { notFound } from 'next/navigation'
import { dictFor } from '@/lib/i18n/server'
import { requireAdmin } from '@/lib/auth/guard'
import { prisma } from '@/lib/db'
import { estSchemaAbsent } from '@/lib/delais/service-base'
import { formatPhone } from '@/lib/jurisdictions/coordonnees'
import { LIBELLE_METHODE, empreinte, instantane, type Instantane } from '@/lib/jurisdictions/notaires-confirmation'
import { getCommuneDirectory, getNotaryIndex } from '@/lib/jurisdictions/data'
import { searchNotaries } from '@/lib/jurisdictions/search-notaries'
import { LIBELLE_KIND, LIBELLE_ROLE, LIBELLE_STATUT } from '@/lib/jurisdictions/notaires-demandes'
import { NotaryRequestActions } from '@/components/jurisdictions/NotaryRequestActions'

export const dynamic = 'force-dynamic'

interface Payload {
  notaryName?: string | null; communeId?: string | null; address?: string | null; phones?: string[]
  email?: string | null; message?: string | null; requesterRoleOther?: string | null
  /** CONFIRMATION : version et contenu confirmés. */
  version?: string; snapshot?: Instantane
  /** IMPORT : provenance, rapprochement, propositions, anomalies (scripts/import-notaires-docx.ts). */
  source?: { fichier: string; sha256: string; rang: number }
  emails?: string[]
  rapprochement?: { niveau: string; candidats: Array<{ id: string; nom: string; commune: string | null; niveau: string; motif: string }> }
  propositions?: Array<{ champ: string; existant: string | null; propose: string; motif: string }>
  anomalies?: Array<{ type: string; brut: string; note: string }>
}

const affTel = (xs: string[] | undefined) => (xs?.length ? xs.map(formatPhone).join(' · ') : null)

/** Publié / proposé, champ par champ ; « ≠ » marque une différence (jamais tranchée d'office). */
function Comparaison({ publie, propose }: { publie: { adresse: string | null; tels: string | null; courriel: string | null }; propose: { adresse: string | null; tels: string | null; courriel: string | null } }) {
  const ligne = (label: string, a: string | null, b: string | null) => {
    const diff = (a ?? '') !== (b ?? '') && b !== null
    return (
      <tr key={label} className="border-t border-chabon/10 align-top">
        <th scope="row" className="py-2 pr-3 text-left font-normal text-ank/80">{label}</th>
        <td className="py-2 pr-3 text-ank">{a ?? <span className="text-grafit">—</span>}</td>
        <td className={`py-2 text-ank ${diff ? 'font-semibold' : ''}`}>{b ?? <span className="text-grafit">—</span>}{diff && <span className="ml-1.5 rounded bg-woujPal px-1 text-[11px] text-ank">≠</span>}</td>
      </tr>
    )
  }
  return (
    <table className="mt-3 w-full text-sm">
      <thead><tr className="text-left text-xs text-grafit"><th className="pb-1 font-medium" /><th className="pb-1 font-medium">Publié</th><th className="pb-1 font-medium">Proposé</th></tr></thead>
      <tbody>
        {ligne('Adresse', publie.adresse, propose.adresse)}
        {ligne('Téléphones', publie.tels, propose.tels)}
        {ligne('Courriel', publie.courriel, propose.courriel)}
      </tbody>
    </table>
  )
}

/**
 * Une demande de tiers (chantier D), MASTER ADMIN. Le courriel du demandeur s'affiche ici pour
 * qu'on puisse lui répondre À LA MAIN : le site ne lui écrit jamais.
 */
export default async function DemandeNotairePage({ params }: { params: { locale: string; id: string } }) {
  const { locale } = dictFor(params.locale)
  await requireAdmin(locale)
  if (!/^[a-z0-9]{10,40}$/.test(params.id)) notFound()

  let d
  try {
    d = await prisma.notaryRequest.findUnique({ where: { id: params.id } })
  } catch (e) {
    if (estSchemaAbsent(e)) notFound()
    throw e
  }
  if (!d) notFound()

  const p = ((): Payload => { try { return JSON.parse(d.payloadJson) as Payload } catch { return {} } })()
  const [communes, notaire, decideur, historique] = await Promise.all([
    getCommuneDirectory(),
    d.notaryId
      ? prisma.notary.findUnique({
          where: { id: d.notaryId },
          select: { id: true, fullName: true, displayName: true, active: true, communeId: true, contact: { select: { address: true, phonesJson: true, email: true, active: true } } },
        })
      : Promise.resolve(null),
    d.decidedById ? prisma.user.findUnique({ where: { id: d.decidedById }, select: { email: true } }) : Promise.resolve(null),
    prisma.auditLog.findMany({
      where: { targetType: 'NotaryRequest', targetId: d.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, action: true, createdAt: true, metaJson: true, actor: { select: { email: true } } },
    }),
  ])
  const commune = p.communeId ? communes.find((c) => c.id === p.communeId) : null
  const ouverte = d.status === 'NOUVELLE' || d.status === 'EN_COURS'
  // Coordonnées sans entrée choisie : on propose les notaires de la liste qui portent ce nom.
  const candidats = d.kind === 'CONTACT' && !d.notaryId && p.notaryName
    ? searchNotaries(await getNotaryIndex(), p.notaryName).slice(0, 8)
    : d.kind === 'IMPORT' && !d.notaryId ? (p.rapprochement?.candidats ?? []).map((c) => ({ id: c.id, name: `${c.nom} — ${c.niveau.toLowerCase()} : ${c.motif}`, communeName: c.commune })) : []
  // Ce qui est PUBLIÉ aujourd'hui pour l'inscription visée (fiche active seulement).
  const publie = notaire ? instantane(notaire, notaire.contact) : null
  const versionAJour = Boolean(publie && p.version && empreinte(publie) === p.version)

  const ligne = (label: string, valeur: React.ReactNode) => (
    <>
      <dt className="text-ank/80">{label}</dt>
      <dd className="text-ank">{valeur || <span className="text-grafit">—</span>}</dd>
    </>
  )

  return (
    <div className="p-6">
      <p className="text-xs"><Link href={`/${locale}/admin/notaires/demandes`} className="text-grafit underline underline-offset-2">← Demandes de tiers</Link></p>
      <h1 className="mt-2 font-serif text-2xl font-semibold text-ank">
        Demande n° {d.id.slice(-8)} — {LIBELLE_KIND[d.kind] ?? d.kind}
      </h1>
      <p className="mt-1 text-sm text-grafit">
        {LIBELLE_STATUT[d.status] ?? d.status} · reçue le {d.createdAt.toISOString().slice(0, 16).replace('T', ' ')} UTC · langue {d.locale}
        {' · '}courriel à la rédaction : {d.notifiedAt ? 'envoyé' : 'non envoyé'}
      </p>

      <dl className="mt-4 grid max-w-2xl grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl border border-chabon/10 bg-white p-4 text-sm">
        {ligne('Notaire visé', notaire
          ? <Link href={`/${locale}/admin/notaires/${notaire.id}`} className="underline underline-offset-2">{notaire.displayName ?? notaire.fullName}</Link>
          : p.notaryName ? `« ${p.notaryName} » (nom saisi)` : null)}
        {ligne('Commune déclarée', commune ? `${commune.name} (${commune.department})` : null)}
        {ligne('Adresse', p.address)}
        {ligne('Téléphones', p.phones?.length ? <span className="font-mono">{p.phones.map(formatPhone).join(' · ')}</span> : null)}
        {ligne('Courriel de l’étude', p.email)}
        {ligne('Précisions', p.message ? <span className="whitespace-pre-line">{p.message}</span> : null)}
        {ligne('Demandeur', `${d.requesterName} — ${d.requesterRole === 'AUTRE' ? `autre : ${p.requesterRoleOther ?? '?'}` : LIBELLE_ROLE[d.requesterRole] ?? d.requesterRole}`)}
        {ligne('Courriel du demandeur', <a href={`mailto:${d.requesterEmail}`} className="underline underline-offset-2">{d.requesterEmail}</a>)}
        {ligne('Vérification humaine', d.humanVerifiedAt
          ? `réussie le ${d.humanVerifiedAt.toISOString().slice(0, 16).replace('T', ' ')} UTC`
          : 'non vérifiée (demande antérieure à la vérification)')}
        {d.decidedAt && ligne('Décision', `${LIBELLE_STATUT[d.status]} le ${d.decidedAt.toISOString().slice(0, 10)} par ${decideur?.email ?? '?'}${d.decisionNote ? ` — ${d.decisionNote}` : ''}`)}
      </dl>

      {(d.kind === 'CONTACT' || d.kind === 'IMPORT') && publie && (
        <section className="mt-6 max-w-2xl rounded-xl border border-chabon/10 bg-white p-4">
          <h2 className="font-serif text-lg font-semibold text-ank">Données publiées et proposées</h2>
          <Comparaison
            publie={{ adresse: publie.adresse, tels: affTel(publie.telephones), courriel: publie.courriel }}
            propose={{ adresse: p.address ?? null, tels: affTel(p.phones), courriel: p.email ?? (p.emails?.length ? p.emails.join(' ; ') : null) }}
          />
          <p className="mt-2 text-xs text-grafit">Accepter une correction ne donne aucun badge ; si une confirmation est active, elle sera invalidée par toute modification substantielle.</p>
        </section>
      )}

      {d.kind === 'CONFIRMATION' && (
        <section className="mt-6 max-w-2xl rounded-xl border border-chabon/10 bg-white p-4">
          <h2 className="font-serif text-lg font-semibold text-ank">Version confirmée par le demandeur</h2>
          <p className="mt-1 text-xs text-grafit">
            {versionAJour ? 'Identique aux informations publiées aujourd’hui.' : 'DIFFÉRENTE des informations publiées aujourd’hui : la validation sera refusée.'}
          </p>
          {p.snapshot && publie && (
            <Comparaison
              publie={{ adresse: publie.adresse, tels: affTel(publie.telephones), courriel: publie.courriel }}
              propose={{ adresse: p.snapshot.adresse, tels: affTel(p.snapshot.telephones), courriel: p.snapshot.courriel }}
            />
          )}
          <p className="mt-3 text-xs text-grafit">
            Vérifier l’IDENTITÉ et la QUALITÉ du demandeur avant de valider : le badge exige que la confirmation vienne du notaire
            (méthodes admises : {Object.values(LIBELLE_METHODE).join(' ; ')}).
          </p>
        </section>
      )}

      {d.kind === 'IMPORT' && (
        <section className="mt-6 max-w-2xl rounded-xl border border-chabon/10 bg-white p-4">
          <h2 className="font-serif text-lg font-semibold text-ank">Proposition d’import</h2>
          <p className="mt-1 text-xs text-grafit">
            {p.source ? `Document « ${p.source.fichier} » (sha-256 ${p.source.sha256.slice(0, 16)}…), entrée n° ${p.source.rang}.` : 'Document importé.'}
            {' '}Rapprochement : <strong>{p.rapprochement?.niveau ?? '—'}</strong>. Rien n’a été publié ni créé ; aucun badge n’est attribué par un import.
          </p>
          {(p.propositions?.length ?? 0) > 0 && (
            <ul className="mt-3 flex flex-col gap-1 text-sm">
              {p.propositions!.map((x, i) => (
                <li key={i} className="rounded-lg border border-chabon/10 px-3 py-2">
                  <span className="font-semibold">{x.champ}</span> : « {x.propose} »{x.existant ? <> — en base : {x.existant}</> : null} <span className="text-grafit">({x.motif})</span>
                </li>
              ))}
            </ul>
          )}
          {(p.anomalies?.length ?? 0) > 0 && (
            <>
              <h3 className="mt-3 text-sm font-semibold text-ank">Valeurs écartées ou à examiner (données brutes)</h3>
              <ul className="mt-1 flex flex-col gap-1 text-xs text-grafit">
                {p.anomalies!.map((a, i) => <li key={i}><span className="font-mono">{a.type}</span> — « {a.brut} » : {a.note}</li>)}
              </ul>
            </>
          )}
        </section>
      )}

      {ouverte && (d.kind === 'CONTACT' || d.kind === 'IMPORT') && (
        <section className="mt-6 max-w-2xl rounded-xl border border-chabon/10 bg-white p-4">
          <h2 className="font-serif text-lg font-semibold text-ank">Accepter les coordonnées</h2>
          <p className="mt-1 text-xs text-grafit">Ouvrez la fiche du notaire : elle est pré-remplie avec la demande ; relisez, corrigez au besoin, enregistrez.</p>
          {d.notaryId ? (
            <p className="mt-3">
              <Link href={`/${locale}/admin/notaires/${d.notaryId}?demande=${d.id}`} className="inline-flex rounded-full bg-chabon px-4 py-2 text-xs font-semibold text-koton">
                Ouvrir la fiche pré-remplie
              </Link>
            </p>
          ) : candidats.length ? (
            <ul className="mt-3 flex flex-col gap-1 text-sm">
              {candidats.map((c) => (
                <li key={c.id}>
                  <Link href={`/${locale}/admin/notaires/${c.id}?demande=${d.id}`} className="underline underline-offset-2">
                    {c.name}{c.communeName ? ` — ${c.communeName}` : ''}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-grafit">
              Aucun notaire de la liste ne porte ce nom. Cherchez-le depuis <Link href={`/${locale}/admin/notaires`} className="underline underline-offset-2">l’écran des coordonnées</Link>,
              puis ajoutez <code className="font-mono text-xs">?demande={d.id}</code> à l’adresse de sa fiche — ou refusez la demande.
            </p>
          )}
        </section>
      )}

      <NotaryRequestActions
        locale={locale}
        requestId={d.id}
        kind={d.kind}
        status={d.status}
        prefill={{ fullName: p.notaryName ?? '', communeId: p.communeId ?? '' }}
        communes={communes.map((c) => ({ id: c.id, name: c.name, department: c.department }))}
        methodes={Object.entries(LIBELLE_METHODE)}
        versionAJour={versionAJour}
      />

      <section className="mt-8 max-w-2xl">
        <h2 className="font-serif text-lg font-semibold text-ank">Historique</h2>
        <ul className="mt-2 flex flex-col gap-1 text-xs text-grafit">
          {historique.map((h) => (
            <li key={h.id} className="rounded-lg border border-chabon/10 bg-white px-3 py-2">
              <span className="font-mono text-[10px] text-ank/80">{h.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</span>{' '}
              <span className="font-semibold">{h.action}</span>
              {h.metaJson ? ` · ${h.metaJson}` : ''} · {h.actor?.email ?? 'formulaire public'}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
