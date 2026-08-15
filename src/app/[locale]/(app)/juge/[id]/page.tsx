import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { dictFor } from '@/lib/i18n/server'
import { requireUser } from '@/lib/auth/guard'
import { canReadService } from '@/lib/access'
import { DOC_TYPE_META } from '@/lib/brand'
import { formatDate } from '@/lib/i18n/format'
import { ROLES_PRESIDENCE } from '@/lib/search/decision'
import { BackLink } from '@/components/BackLink'

/**
 * Fiche d'un MAGISTRAT : toutes les décisions où son nom figure, VENTILÉES par ce qu'il y
 * a fait.
 *
 * ⚠️ PRÉSIDER ET SIÉGER NE SONT PAS LA MÊME CHOSE, ET LE MINISTÈRE PUBLIC N'EST NI L'UN NI
 * L'AUTRE. Une liste unique de « décisions de M. X » mêlerait les arrêts qu'il a présidés,
 * ceux où il n'était qu'un juge parmi cinq, et ceux où il requérait sans juger. Les trois
 * groupes sont donc disjoints et comptés séparément — c'est la demande de la rédaction,
 * et c'est aussi la seule lecture exacte.
 *
 * ⚠️ LES NOMS AFFICHÉS SONT CEUX DE CHAQUE ARRÊT (`nameAsWritten`). Le magistrat est un ;
 * ses graphies sont plusieurs, et le recueil fait foi pour chacune.
 */

const GROUPES = [
  { cle: 'PRESIDENCE', roles: [...ROLES_PRESIDENCE], libelle: 'judgePresided' },
  { cle: 'SIEGE', roles: ['JUGE'], libelle: 'judgeSat' },
  { cle: 'MINISTERE_PUBLIC', roles: ['MINISTERE_PUBLIC'], libelle: 'judgeMp' },
  { cle: 'GREFFE', roles: ['GREFFE'], libelle: 'judgeGreffe' },
] as const

/** Bornage : au-delà, la fiche renvoie vers la recherche, qui pagine. */
const MAX_PAR_GROUPE = 200

export default async function JugePage({ params }: { params: { locale: string; id: string } }) {
  const { locale, t } = dictFor(params.locale)
  const user = await requireUser(locale)
  // Accès par service (§03) : la jurisprudence n'est pas accordée à tout le monde. Sans
  // cette garde, la fiche d'un magistrat listerait des décisions autrement invisibles.
  if (!canReadService(user, 'JURISPRUDENCE')) redirect(`/${locale}/search?type=index`)

  const juge = await prisma.judge.findUnique({
    where: { id: params.id },
    include: {
      decisions: {
        include: {
          document: {
            select: { id: true, titleFr: true, number: true, chambre: true, publicationDate: true, matiere: true },
          },
        },
      },
    },
  })
  if (!juge) notFound()

  const graphies = [...new Set(juge.decisions.map((d) => d.nameAsWritten))].sort()
  const groupes = GROUPES.map((g) => ({
    ...g,
    lignes: juge.decisions
      .filter((d) => g.roles.includes(d.role as never))
      .sort(
        (a, b) =>
          (b.document.publicationDate?.getTime() ?? 0) - (a.document.publicationDate?.getTime() ?? 0) ||
          a.document.id.localeCompare(b.document.id),
      ),
  })).filter((g) => g.lignes.length > 0)

  const total = groupes.reduce((n, g) => n + g.lignes.length, 0)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink fallback={`/${locale}/search?type=jurisprudence`} label={DOC_TYPE_META.JURISPRUDENCE.label[locale]} />

      <header className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-wider text-grafit">{t.search.judgeLabel}</p>
        <h1 className="font-serif text-3xl font-semibold leading-tight text-ank">{juge.displayName}</h1>
        {graphies.length > 1 && (
          // Le magistrat est un, ses graphies sont plusieurs : les taire donnerait à croire
          // que le recueil est homogène, et rendrait incompréhensibles les noms des fiches.
          <p className="text-sm text-grafit">
            {t.search.judgeSpellings} : {graphies.join(' · ')}
          </p>
        )}
      </header>

      {total === 0 ? (
        <p className="rounded-2xl border border-chabon/10 bg-white p-5 text-sm text-ank">{t.search.judgeNone}</p>
      ) : (
        groupes.map((g) => (
          <section key={g.cle} className="rounded-2xl border border-chabon/10 bg-white p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-chabon/10 pb-3">
              <h2 className="text-sm font-semibold text-ank">{t.search[g.libelle]}</h2>
              <span className="rounded-full bg-pil px-2 py-0.5 text-[11px] font-medium text-ank">{g.lignes.length}</span>
              <Link
                href={`/${locale}/search?type=jurisprudence&judgeId=${juge.id}&judgeRole=${g.cle}`}
                className="ml-auto text-xs text-chabon hover:underline"
              >
                {t.search.judgeAllOf} →
              </Link>
            </div>
            <ul className="space-y-2">
              {g.lignes.slice(0, MAX_PAR_GROUPE).map((d) => (
                <li key={d.id} className="text-sm">
                  <Link href={`/${locale}/doc/${d.document.id}`} className="font-medium text-ank hover:underline">
                    {d.document.titleFr}
                  </Link>
                  <span className="block text-xs text-grafit">
                    {[
                      d.document.chambre,
                      d.document.number ? `n° ${d.document.number}` : null,
                      d.document.publicationDate ? formatDate(locale, d.document.publicationDate) : null,
                      // La graphie de CET arrêt, quand elle diffère du nom retenu.
                      d.nameAsWritten !== juge.displayName ? `« ${d.nameAsWritten} »` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
            {g.lignes.length > MAX_PAR_GROUPE && (
              <p className="mt-3 text-xs text-grafit">
                {g.lignes.length - MAX_PAR_GROUPE} + —{' '}
                <Link
                  href={`/${locale}/search?type=jurisprudence&judgeId=${juge.id}&judgeRole=${g.cle}`}
                  className="text-chabon hover:underline"
                >
                  {t.search.judgeAllOf}
                </Link>
              </p>
            )}
          </section>
        ))
      )}
    </div>
  )
}
