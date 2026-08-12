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
      <header className="rounded-2xl border border-chabon/10 bg-white p-5">
        <h2 className="font-serif text-2xl font-semibold text-ank">{commune.name}</h2>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-ank/80">{j.department}</dt>
          <dd className="font-medium text-ank">{commune.department}</dd>
          <dt className="text-ank/80">{j.arrondissement}</dt>
          <dd className="font-medium text-ank">{commune.arrondissement}</dd>
        </dl>
        {!commune.boundaryConfirmed && (
          <p className="mt-2 inline-block rounded-full bg-pil px-2.5 py-1 text-[11px] font-medium text-chabon">
            {j.boundaryUnconfirmed}
          </p>
        )}
        {commune.observation && <p className="mt-2 text-xs leading-relaxed text-grafit">{commune.observation}</p>}
      </header>

      <PostalCodeCard postal={postal} t={t} />

      {courts.peace.length > 0 && (
        <section aria-label={j.peace}>
          <h3 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ank/80">{j.peace}</h3>
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
          <h3 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ank/80">{j.firstInstance}</h3>
          <CourtCard court={courts.firstInstance} kind="PREMIERE_INSTANCE" locale={locale} t={t} />
        </section>
      )}

      {courts.appeal && (
        <section aria-label={j.appeal}>
          <h3 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ank/80">{j.appeal}</h3>
          <CourtCard court={courts.appeal} kind="APPEL" locale={locale} t={t} />
        </section>
      )}

      {courts.cassation && (
        // Bloc DISTINCT : la Cour de cassation n'est pas un tribunal local de la commune.
        // Encadré teinté Ble comme le losange de la Cassation en légende (AV-02) — la
        // couleur RAPPELLE le marqueur, elle ne porte aucune information à elle seule.
        <section aria-label={j.nationalRecourse} className="rounded-2xl border-2 border-ble/30 bg-ble/[0.04] p-4">
          <h3 className="font-mono text-[11px] uppercase tracking-wider text-grafit">{j.nationalRecourse}</h3>
          <p className="mt-1 text-xs leading-relaxed text-grafit">{j.nationalRecourseNote}</p>
          <div className="mt-3">
            <CourtCard court={courts.cassation} kind="CASSATION" locale={locale} t={t} />
          </div>
        </section>
      )}

      {(commune.sources.length > 0 || record.lastVerified) && (
        <footer className="rounded-2xl border border-chabon/10 bg-white p-4 text-xs text-grafit">
          {commune.sources.length > 0 && (
            <>
              <h3 className="font-mono text-[11px] uppercase tracking-wider text-ank/80">{j.sources}</h3>
              <ul className="mt-1.5 flex flex-col gap-1">
                {commune.sources.map((s, i) => (
                  <li key={i} className="truncate">
                    {s.type === 'url' ? (
                      <a href={s.value} target="_blank" rel="noopener noreferrer" className="text-chabon underline underline-offset-2 hover:text-chabon">
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
