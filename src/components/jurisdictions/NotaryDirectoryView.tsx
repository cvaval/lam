import Link from 'next/link'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'
import type { NotaryDirectory } from '@/lib/jurisdictions/data'
import { compte } from '@/lib/jurisdictions/notaires-format'
import { NotaryName, lienDemande, notarySourceLine } from './NotariesSection'

/**
 * Corps de la liste « notaires par juridiction » : par juridiction (sans « TPI » : les notaires
 * ne dépendent pas des tribunaux de première instance), puis par commune, puis par numéro.
 * Toutes les communes du ressort y figurent, même sans notaire ; les entrées dont la commune
 * imprimée n'est pas reconnue ont leur section. Rendu serveur, sans JavaScript, imprimable.
 */
export function NotaryDirectoryView({
  dir: complet, locale, t, filter = null, demandes = false,
}: { dir: NotaryDirectory | null; locale: Locale; t: Dictionary; filter?: { q: string; ids: Set<string> } | null; demandes?: boolean }) {
  const j = t.judicial
  const nb = (n: number) => compte(n, locale, j.notaryCountOne, j.notaryCountMany)
  const dir = complet && filter ? filtrer(complet, filter.ids) : complet
  const trouves = dir && filter ? dir.tpis.reduce((s, x) => s + x.total, 0) + dir.unmatched.length : 0
  return (
    <>
      {complet && (
        <form method="get" role="search" action={`/${locale}/juridictions/notaires`} className="mt-4 flex flex-wrap items-end gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium text-grafit">
            {j.notarySearchLabel}
            <input
              type="search"
              name="q"
              defaultValue={filter?.q ?? ''}
              maxLength={80}
              autoComplete="off"
              placeholder="Ex. Victor, Céant, Gemma…"
              className="min-h-[44px] w-full rounded-xl border border-chabon/15 bg-white px-4 py-2 text-sm text-ank"
            />
          </label>
          <button type="submit" className="min-h-[44px] rounded-full bg-chabon px-5 text-sm font-medium text-koton">{j.notarySearchSubmit}</button>
          {filter && (
            <a href={`/${locale}/juridictions/notaires`} className="inline-flex min-h-[44px] items-center text-sm text-ank underline underline-offset-2">{j.notarySearchClear}</a>
          )}
        </form>
      )}
      {filter && dir && (
        <p role="status" className="mt-3 text-sm font-medium text-ank">
          {trouves === 0
            ? j.notarySearchNone.replace('{q}', filter.q)
            : compte(trouves, locale, j.notarySearchResultsOne, j.notarySearchResultsMany).replace('{q}', filter.q)}
        </p>
      )}
      {!dir ? (
        <p role="status" className="mt-6 rounded-xl border border-chabon/10 bg-white px-4 py-3 text-sm text-grafit">{j.notariesUnavailable}</p>
      ) : (
        <>
          <div className="mt-4 rounded-xl border border-chabon/10 bg-white px-4 py-3 text-sm text-grafit">
            <p className="font-medium text-ank">
              {j.notariesCount.replace('{active}', String(dir.activeEntries)).replace('{total}', String(dir.totalEntries))}
            </p>
            {dir.activeEntries < dir.totalEntries && <p className="mt-1">{j.notariesCountNote}</p>}
            {dir.addedEntries > 0 && <p className="mt-1">{compte(dir.addedEntries, locale, j.notariesAddedOne, j.notariesAddedMany)}</p>}
            <p className="mt-1 text-[12px] text-ank/80">{notarySourceLine(dir.provenance, locale, t)}</p>
          </div>

          <nav aria-labelledby="ag-notaires-sommaire" className="mt-6">
            <h2 id="ag-notaires-sommaire" className="font-mono text-[11px] uppercase tracking-wider text-ank/80">{j.notariesTocLabel}</h2>
            <ul className="mt-2 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
              {dir.tpis.map((tpi) => (
                <li key={tpi.id}>
                  <a href={`#${tpi.id}`} className="flex min-h-[44px] items-center justify-between gap-2 rounded-lg px-2 text-sm text-ank/80 transition hover:bg-pil">
                    <span>{tpi.label}</span>
                    <span className="font-mono text-xs">{tpi.total}</span>
                  </a>
                </li>
              ))}
              {dir.unmatched.length > 0 && (
                <li>
                  <a href="#commune-non-reconnue" className="flex min-h-[44px] items-center justify-between gap-2 rounded-lg px-2 text-sm text-ank/80 transition hover:bg-pil">
                    <span>{j.notariesUnmatchedTitle}</span>
                    <span className="font-mono text-xs">{dir.unmatched.length}</span>
                  </a>
                </li>
              )}
            </ul>
          </nav>

          <div className="mt-8 flex flex-col gap-6">
            {dir.tpis.map((tpi) => (
              <section key={tpi.id} id={tpi.id} aria-labelledby={`${tpi.id}-titre`} className="scroll-mt-24 rounded-2xl border border-chabon/10 bg-white p-5">
                <h2 id={`${tpi.id}-titre`} className="font-serif text-xl font-semibold text-ank">
                  {tpi.label} <span className="font-sans text-sm font-normal text-grafit">— {nb(tpi.total)}</span>
                </h2>
                <div className="mt-3 grid gap-x-8 gap-y-4 md:grid-cols-2">
                  {tpi.communes.map((c) => (
                    <div key={c.id}>
                      <h3 className="text-sm font-semibold text-ank">
                        <Link href={`/${locale}/juridictions?commune=${c.id}`} className="underline-offset-2 hover:text-chabon hover:underline">{c.name}</Link>
                        <span className="ml-1.5 text-xs font-normal text-ank/80">{c.department} · {nb(c.notaires.length)}</span>
                      </h3>
                      {c.notaires.length === 0 ? (
                        <p className="mt-1 text-xs text-ank/80">{j.notariesNoneHere}</p>
                      ) : (
                        <ol className="mt-1 flex flex-col gap-0.5 text-sm text-grafit">
                          {c.notaires.map((n) => (
                            <li key={n.id}>
                              <NotaryName n={n} locale={locale} t={t} />
                              {/* Désaccord de département de la source : signalé discrètement. */}
                              {n.printedDepartment && (
                                <span className="ml-1.5 text-[11px] text-ank/70">({j.notariesPrintedDepartment} : {n.printedDepartment})</span>
                              )}
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {dir.unmatched.length > 0 && (
              <section id="commune-non-reconnue" aria-labelledby="commune-non-reconnue-titre" className="scroll-mt-24 rounded-2xl border border-chabon/10 bg-white p-5">
                <h2 id="commune-non-reconnue-titre" className="font-serif text-xl font-semibold text-ank">
                  {j.notariesUnmatchedTitle} <span className="font-sans text-sm font-normal text-grafit">— {nb(dir.unmatched.length)}</span>
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-ank/80">{j.notariesUnmatchedNote}</p>
                <ol className="mt-2 flex flex-col gap-0.5 text-sm text-grafit">
                  {dir.unmatched.map((n) => (
                    <li key={n.id}>
                      <NotaryName n={n} locale={locale} t={t} />
                      <span className="ml-1.5 text-[11px] text-ank/70">
                        ({j.notariesPrintedCommune} : {n.sourceCommune} · {j.notariesPrintedDepartment} : {n.sourceDepartment})
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>
          {demandes && (
            <p className="mt-6 text-[12px] text-ank/80">
              <Link href={lienDemande(locale, { type: 'inscription' })} className="inline-flex min-h-[44px] items-center underline underline-offset-2 transition hover:text-chabon">
                {j.notaryRequestLinkListing}
              </Link>
            </p>
          )}
        </>
      )}
    </>
  )
}

/** Ne garde que les notaires trouvés, et les juridictions et communes qui en ont. */
function filtrer(dir: NotaryDirectory, ids: Set<string>): NotaryDirectory {
  const tpis = dir.tpis
    .map((x) => {
      const communes = x.communes
        .map((c) => ({ ...c, notaires: c.notaires.filter((n) => ids.has(n.id)) }))
        .filter((c) => c.notaires.length > 0)
      return { ...x, communes, total: communes.reduce((s, c) => s + c.notaires.length, 0) }
    })
    .filter((x) => x.total > 0)
  return { ...dir, tpis, unmatched: dir.unmatched.filter((n) => ids.has(n.id)) }
}
