import type { RoleSiege } from '@/lib/jurisprudence/composition'

/**
 * La COMPOSITION DE LA FORMATION — qui a rendu la décision.
 *
 * ⚠️ LE MINISTÈRE PUBLIC ET LE GREFFE NE SIÈGENT PAS. Ils tiennent leur propre ligne :
 * les aligner avec les juges donnerait à lire une formation fausse, où le substitut du
 * commissaire du gouvernement aurait jugé.
 *
 * ⚠️ LES NOMS SONT CEUX DE CET ARRÊT-LÀ (`nameAsWritten`), pas ceux retenus par la
 * rédaction. « Louis B. VILGRAIN » ici, « Louis VILGRAIN » ailleurs : substituer la fiche
 * du magistrat à la graphie de la décision, c'est réécrire une pièce de procédure.
 *
 * ⚠️ RIEN N'EST DÉDUIT, ET RIEN NE DISPARAÎT. Un rôle absent ne devient pas « juge » par
 * défaut — le magistrat paraît sans qualité. Le taire au motif qu'on ignore sa fonction
 * ferait lire une formation amputée, ce qui est pire qu'une formation incomplètement
 * qualifiée. Une composition entièrement vide, elle, ne rend aucun bloc.
 */

const LIB = {
  siege: { fr: 'Composition', en: 'Bench', ht: 'Konpozisyon' },
  mp: { fr: 'Ministère public', en: 'Public prosecutor', ht: 'Ministè piblik' },
  greffe: { fr: 'Greffe', en: 'Clerk', ht: 'Grèf' },
  mention: { fr: 'Mention du recueil', en: 'Reporter’s note', ht: 'Mansyon rekèy la' },
} as const

/** Qualité affichée sous le nom. Les graphies du recueil, abrégées pour la lecture. */
const ROLES: Record<string, { fr: string; en: string; ht: string }> = {
  PRESIDENT: { fr: 'président', en: 'presiding', ht: 'prezidan' },
  VICE_PRESIDENT: { fr: 'vice-président', en: 'vice-president', ht: 'vis-prezidan' },
  PRESIDENT_FF: { fr: 'faisant fonction de président', en: 'acting president', ht: 'k’ap fè fonksyon prezidan' },
}

type Libelle = { fr: string; en: string; ht: string }

export interface MembreAffiche {
  id: string
  nameAsWritten: string
  role: string | null
  qualite: string | null
}

const SIEGE: RoleSiege[] = ['PRESIDENT', 'VICE_PRESIDENT', 'PRESIDENT_FF', 'JUGE']

export function JurisprudenceComposition({
  membres,
  note,
  locale,
}: {
  membres: MembreAffiche[]
  note: string | null
  locale: string
}) {
  const lt = (o: Libelle) => (locale === 'en' ? o.en : locale === 'ht' ? o.ht : o.fr)
  // Le rôle nul reste au siège, sans qualité : un magistrat non qualifié doit se lire,
  // pas s'effacer.
  const siege = membres.filter((m) => !m.role || SIEGE.includes(m.role as RoleSiege))
  const mp = membres.filter((m) => m.role === 'MINISTERE_PUBLIC')
  const greffe = membres.filter((m) => m.role === 'GREFFE')
  if (!siege.length && !mp.length && !greffe.length) return null

  const etiquette = 'font-mono text-[11px] uppercase leading-5 tracking-wider text-grafit'

  return (
    <section className="rounded-2xl border border-chabon/10 bg-white p-5 font-sans" aria-label={lt(LIB.siege)}>
      <dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
        {siege.length > 0 && (
          <div className="contents">
            <dt className={etiquette}>{lt(LIB.siege)}</dt>
            <dd className="min-w-0 text-ank">
              {siege.map((m, i) => (
                <span key={m.id}>
                  {i > 0 && <span className="text-grafit"> · </span>}
                  <span className="font-medium">{m.nameAsWritten}</span>
                  {m.role && ROLES[m.role] && (
                    <span className="text-grafit"> ({lt(ROLES[m.role])})</span>
                  )}
                </span>
              ))}
            </dd>
          </div>
        )}
        {[
          [mp, LIB.mp] as const,
          [greffe, LIB.greffe] as const,
        ].map(([liste, lib]) =>
          liste.length === 0 ? null : (
            <div key={lib.fr} className="contents">
              <dt className={etiquette}>{lt(lib)}</dt>
              <dd className="min-w-0 text-ank">
                {liste.map((m, i) => (
                  <span key={m.id}>
                    {i > 0 && <span className="text-grafit"> · </span>}
                    {m.nameAsWritten}
                    {m.qualite && <span className="text-grafit">, {m.qualite.toLowerCase()}</span>}
                  </span>
                ))}
              </dd>
            </div>
          ),
        )}
        {note && (
          <div className="contents">
            <dt className={etiquette}>{lt(LIB.mention)}</dt>
            {/* Cette prose nomme parfois des magistrats qui n'ont PAS siégé — celui qui a
                lu les conclusions, par exemple. Elle se lit donc à part de la formation,
                telle que le recueil l'écrit. */}
            <dd className="min-w-0 break-words leading-relaxed text-grafit">{note}</dd>
          </div>
        )}
      </dl>
    </section>
  )
}
