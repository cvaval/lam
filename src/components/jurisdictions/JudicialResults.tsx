import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'
import type { CommuneRecord } from '@/lib/jurisdictions/data'
import { CourtCard } from './CourtCard'
import { PostalCodeCard } from './PostalCodeCard'

/**
 * Fiche d'une commune (rendu SERVEUR — lisible sans JavaScript).
 * Ordre imposé (§6) : commune, département, arrondissement, codes postaux,
 * tribunaux de paix (chacun sa carte, JAMAIS regroupés), TPI, cour d'appel,
 * bloc distinct « Recours national », notes, sources, dernière vérification.
 */
export function JudicialResults({ record, locale, t }: { record: CommuneRecord; locale: Locale; t: Dictionary }) {
  const j = t.judicial
  const { commune, postal, courts } = record
  return (
    <article className="flex flex-col gap-4" aria-live="polite">
      <header className="rounded-2xl border border-lank/10 bg-white p-5 shadow-card">
        <h2 className="font-serif text-2xl font-semibold text-lank">{commune.name}</h2>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-lank/50">{j.department}</dt>
          <dd className="font-medium text-lank">{commune.department}</dd>
          <dt className="text-lank/50">{j.arrondissement}</dt>
          <dd className="font-medium text-lank">{commune.arrondissement}</dd>
        </dl>
        {!commune.boundaryConfirmed && (
          <p className="mt-2 inline-block rounded-full bg-soley-50 px-2.5 py-1 text-[11px] font-medium text-soley-700">
            {j.boundaryUnconfirmed}
          </p>
        )}
        {commune.observation && <p className="mt-2 text-xs leading-relaxed text-lank/60">{commune.observation}</p>}
      </header>

      <PostalCodeCard postal={postal} t={t} />

      {courts.peace.length > 0 && (
        <section aria-label={j.peace}>
          <h3 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-lank/50">{j.peace}</h3>
          <ul className="flex flex-col gap-2">
            {/* Chaque tribunal = une entrée distincte — jamais une ligne générique. */}
            {courts.peace.map((c) => (
              <li key={c.id}><CourtCard court={c} kind="PAIX" locale={locale} t={t} /></li>
            ))}
          </ul>
        </section>
      )}

      {courts.firstInstance && (
        <section aria-label={j.firstInstance}>
          <h3 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-lank/50">{j.firstInstance}</h3>
          <CourtCard court={courts.firstInstance} kind="PREMIERE_INSTANCE" locale={locale} t={t} />
        </section>
      )}

      {courts.appeal && (
        <section aria-label={j.appeal}>
          <h3 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-lank/50">{j.appeal}</h3>
          <CourtCard court={courts.appeal} kind="APPEL" locale={locale} t={t} />
        </section>
      )}

      {courts.cassation && (
        // Bloc DISTINCT : la Cour de cassation n'est pas un tribunal local de la commune.
        <section aria-label={j.nationalRecourse} className="rounded-2xl border-2 border-[#7C6F9B]/40 bg-[#7C6F9B]/5 p-4">
          <h3 className="font-mono text-[11px] uppercase tracking-wider text-[#5d5377]">{j.nationalRecourse}</h3>
          <p className="mt-1 text-xs leading-relaxed text-lank/60">{j.nationalRecourseNote}</p>
          <div className="mt-3">
            <CourtCard court={courts.cassation} kind="CASSATION" locale={locale} t={t} />
          </div>
        </section>
      )}

      {(commune.sources.length > 0 || record.lastVerified) && (
        <footer className="rounded-2xl border border-lank/10 bg-white p-4 text-xs text-lank/60">
          {commune.sources.length > 0 && (
            <>
              <h3 className="font-mono text-[11px] uppercase tracking-wider text-lank/50">{j.sources}</h3>
              <ul className="mt-1.5 flex flex-col gap-1">
                {commune.sources.map((s, i) => (
                  <li key={i} className="truncate">
                    {s.type === 'url' ? (
                      <a href={s.value} target="_blank" rel="noopener noreferrer" className="text-fey underline underline-offset-2 hover:text-fey-700">
                        {s.value}
                      </a>
                    ) : (
                      <span className="font-mono">{s.value}</span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          {record.lastVerified && (
            <p className="mt-2">
              {j.lastVerified} : <time dateTime={record.lastVerified}>{record.lastVerified}</time>
            </p>
          )}
        </footer>
      )}
    </article>
  )
}
