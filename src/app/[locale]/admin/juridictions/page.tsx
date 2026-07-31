import { dictFor } from '@/lib/i18n/server'
import { requireAdmin } from '@/lib/auth/guard'
import { prisma } from '@/lib/db'
import { JudicialAdminTable } from '@/components/jurisdictions/JudicialAdminTable'

export const dynamic = 'force-dynamic'

/**
 * Administration de la carte judiciaire (MASTER_ADMIN) — version MINIMALE voulue :
 * consulter, filtrer les données à vérifier, corriger adresse/coordonnées/précision,
 * ajouter une source, marquer vérifié, désactiver SANS supprimer, historique.
 * L'import d'une nouvelle version se fait par la CLI documentée
 * (scripts/import-judicial-map.ts --dry-run) — pas d'éditeur cartographique.
 */
export default async function AdminJuridictionsPage({ params }: { params: { locale: string } }) {
  const { locale, t } = dictFor(params.locale)
  await requireAdmin(locale)

  const [courts, communesSansGeo, history] = await Promise.all([
    prisma.court.findMany({
      orderBy: [{ verificationStatus: 'desc' }, { type: 'asc' }, { department: 'asc' }, { name: 'asc' }],
      select: {
        id: true, type: true, name: true, department: true, city: true, commune: true, address: true,
        latitude: true, longitude: true, locationPrecision: true, verificationStatus: true,
        operationalStatus: true, active: true, verifiedAt: true,
      },
    }),
    prisma.judicialCommune.count({ where: { geometryKey: null } }),
    prisma.auditLog.findMany({
      where: { action: { in: ['JUDICIAL_IMPORT', 'JUDICIAL_UPDATED'] } },
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: { id: true, action: true, targetId: true, createdAt: true, actor: { select: { email: true } }, metaJson: true },
    }),
  ])

  const kpis = {
    total: courts.length,
    unmapped: courts.filter((c) => c.verificationStatus === 'UNMAPPED').length,
    toVerify: courts.filter((c) => c.verificationStatus === 'TO_VERIFY').length,
    sansCoordonnees: courts.filter((c) => c.latitude == null && c.active).length,
    inactifs: courts.filter((c) => !c.active).length,
    communesSansGeo,
  }

  return (
    <div className="p-6">
      <h1 className="font-serif text-2xl font-semibold text-lank">{t.admin.juridictionsNav}</h1>
      <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ['Juridictions', kpis.total], ['UNMAPPED', kpis.unmapped], ['À vérifier', kpis.toVerify],
          ['Sans coordonnées', kpis.sansCoordonnees], ['Désactivées', kpis.inactifs], ['Communes sans limite', kpis.communesSansGeo],
        ].map(([label, n]) => (
          <div key={String(label)} className="rounded-xl border border-lank/10 bg-white p-3 text-center shadow-card">
            <div className="font-serif text-2xl font-bold text-lank">{n}</div>
            <div className="text-[11px] text-lank/55">{label}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-3 text-sm">
        <a href="/api/admin/jurisdictions?export=anomalies" className="rounded-full bg-lank px-4 py-2 text-xs font-semibold text-cream hover:bg-lank/90">
          ↓ Rapport d’anomalies (JSON)
        </a>
        <span className="self-center font-mono text-[11px] text-lank/45">
          Import / simulation : `npx tsx scripts/import-judicial-map.ts --file data/judicial-map/seed-v1.json --dry-run`
        </span>
      </div>

      <JudicialAdminTable courts={courts.map((c) => ({ ...c, verifiedAt: c.verifiedAt?.toISOString().slice(0, 10) ?? null }))} />

      <section className="mt-8">
        <h2 className="font-serif text-lg font-semibold text-lank">Historique des modifications</h2>
        <ul className="mt-2 flex flex-col gap-1 text-xs text-lank/70">
          {history.map((h) => (
            <li key={h.id} className="rounded-lg border border-lank/10 bg-white px-3 py-2">
              <span className="font-mono text-[10px] text-lank/45">{h.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</span>{' '}
              <span className="font-semibold">{h.action}</span> · {h.targetId} · {h.actor?.email ?? 'script'}
            </li>
          ))}
          {history.length === 0 && <li className="text-lank/45">Aucune entrée.</li>}
        </ul>
      </section>
    </div>
  )
}
