import { dictFor } from '@/lib/i18n/server'
import { requireCapability } from '@/lib/auth/guard'
import { prisma } from '@/lib/db'
import { estSchemaAbsent } from '@/lib/delais/service-base'
import { DelaiAdmin } from '@/components/delais/DelaiAdmin'
import type { LigneAdmin, LigneFerieAdmin, LigneFenetreAdmin, LigneJournal } from '@/components/delais/DelaiAdmin'

export const dynamic = 'force-dynamic'

/**
 * § 7 — BACK-OFFICE DU CALCULATEUR DE DÉLAIS.
 *
 * **Double garde, sans exception.** Cette page exige `corpus.manage` ; les routes qu'elle
 * appelle l'exigent aussi, et la suppression y exige en plus le master admin. Une page et sa
 * route bougent ensemble : ouvrir l'écran sans ouvrir la route donnerait un formulaire qui
 * s'affiche, accepte la saisie, puis échoue — ce qui se lit comme du travail perdu et non
 * comme un refus de droits.
 *
 * ⚠️ **La garde de PAGE de la gouvernance, c'est la prop `estMaster`.** Le tableau du § 7
 * exige `requireAdmin(locale)` en plus de `requireAdminApi()` pour les opérations réservées
 * au master admin ; l'écran étant UNIQUE (répertoire, calendrier et fenêtres partagent la
 * même page, et un éditeur doit pouvoir l'ouvrir), la garde de page ne peut pas être une
 * redirection : c'est `estMaster` qui la porte, en conditionnant les affordances.
 *
 * D'où la règle, à vérifier à chaque ajout : **TOUTE affordance dont la route exige
 * `requireAdminApi()` est conditionnée par `estMaster`.** Elles sont trois aujourd'hui —
 * « Supprimer » (répertoire), « Supprimer » (calendrier) et « Rétablir la suppression ». La
 * dernière manquait : « Réafficher » s'affichait sur une ligne supprimée pour tout porteur
 * de `corpus.manage`, et la route la laissait passer (défaut bloquant du 20 août 2026).
 *
 * ⚠️ **Les tables `Delai*` ne sont pas migrées.** Plutôt qu'une page en erreur 500, on rend
 * l'écran avec un bandeau qui DIT pourquoi il est vide. La migration est une décision humaine
 * (§ 5.1) : l'écran ne la prend pas, et il ne la maquille pas non plus.
 */
export default async function AdminDelaisPage({ params }: { params: { locale: string } }) {
  const { locale, t } = dictFor(params.locale)
  const user = await requireCapability(locale, 'corpus.manage')

  let entrees: LigneAdmin[] = []
  let feries: LigneFerieAdmin[] = []
  let fenetres: LigneFenetreAdmin[] = []
  let journal: LigneJournal[] = []
  let versionCalendrier: number | null = null
  let versionFenetres: number | null = null
  let schemaAbsent = false

  try {
    const [lignes, derniereVersion, derniereVersionF] = await Promise.all([
      prisma.delaiEntry.findMany({
        orderBy: [{ code: 'asc' }, { tableau: 'asc' }, { ordre: 'asc' }],
        // La liste d'administration montre TOUS les statuts, y compris `supprime` : une
        // entrée retirée doit rester visible de la rédaction, sinon « supprimer » deviendrait
        // indiscernable d'« effacer » — ce qu'il n'est justement pas (§ 7.3).
        take: 1000,
      }),
      prisma.delaiFerie.findFirst({ orderBy: { versionCalendrier: 'desc' }, select: { versionCalendrier: true } }),
      prisma.delaiFenetreSignification.findFirst({
        orderBy: { versionFenetres: 'desc' },
        select: { versionFenetres: true },
      }),
    ])
    entrees = lignes as unknown as LigneAdmin[]
    versionCalendrier = derniereVersion?.versionCalendrier ?? null
    versionFenetres = derniereVersionF?.versionFenetres ?? null

    if (versionCalendrier != null) {
      feries = (await prisma.delaiFerie.findMany({
        where: { versionCalendrier },
        orderBy: [{ typeEntree: 'asc' }, { mobile: 'asc' }, { mois: 'asc' }, { jour: 'asc' }, { cle: 'asc' }],
      })) as unknown as LigneFerieAdmin[]
    }
    if (versionFenetres != null) {
      fenetres = (await prisma.delaiFenetreSignification.findMany({
        where: { versionFenetres },
        orderBy: { matiere: 'asc' },
      })) as unknown as LigneFenetreAdmin[]
    }

    journal = (
      await prisma.auditLog.findMany({
        where: { action: { startsWith: 'DELAI_' } },
        orderBy: { createdAt: 'desc' },
        take: 25,
        select: {
          id: true,
          action: true,
          targetId: true,
          createdAt: true,
          metaJson: true,
          actor: { select: { email: true } },
        },
      })
    ).map((h) => ({
      id: h.id,
      action: h.action,
      targetId: h.targetId ?? null,
      quand: h.createdAt.toISOString().slice(0, 16).replace('T', ' '),
      acteur: h.actor?.email ?? 'script',
      meta: h.metaJson,
    }))
  } catch (e) {
    if (!estSchemaAbsent(e)) throw e
    schemaAbsent = true
  }

  return (
    <div className="p-6">
      <h1 className="font-serif text-2xl font-semibold text-ank">{t.delaisAdmin.title}</h1>
      <p className="mt-1 max-w-3xl text-sm text-grafit">{t.delaisAdmin.subtitle}</p>

      {schemaAbsent && (
        <div className="mt-4 max-w-3xl rounded-xl border-l-[3px] border-wouj bg-white px-4 py-3">
          <p className="text-sm font-semibold text-ank">{t.delaisAdmin.schemaMissingTitle}</p>
          <p className="mt-1 text-sm text-grafit">{t.delaisAdmin.schemaMissingBody}</p>
          <p className="mt-1 font-mono text-[11px] text-ank/80">{t.delaisAdmin.neverWritten}</p>
        </div>
      )}

      <DelaiAdmin
        t={t}
        estMaster={user.role === 'MASTER_ADMIN'}
        entrees={entrees}
        feries={feries}
        fenetres={fenetres}
        versionCalendrier={versionCalendrier}
        versionFenetres={versionFenetres}
        journal={journal}
        schemaAbsent={schemaAbsent}
      />
    </div>
  )
}
