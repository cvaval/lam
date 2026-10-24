import type { Locale } from '@/lib/types'
import type { JurisCase } from '@/lib/legislation/annotated'
import { classes } from '@/lib/legislation/situations'
import { CodeRefText, type CodeHrefs } from './CodeRefText'
import { Repli } from './Repli'
import { contientTerme } from './surligner'

const LBL = {
  comments: { fr: 'Commentaires', en: 'Commentary', ht: 'Kòmantè' },
  jurisSub: { fr: 'Jurisprudence', en: 'Case law', ht: 'Jurisprudans' },
} as const

/**
 * Bloc d'annotations rattaché à un article — repli fermé par défaut (« on l'ouvre au besoin »), au
 * gabarit commun (`Repli`). Deux situations, deux gammes (registre des situations, 17 oct. 2026) :
 *  - « Jurisprudence » (Code du travail, Code pénal de 1835, Code d'instruction criminelle) : arrêts ;
 *  - « Annotations » (Code civil, Code de commerce, Code de procédure civile, textes consolidés) :
 *    commentaires de l'auteur, et la jurisprudence qu'il cite, en deux sous-parties.
 *
 * ⚠️ LE DÉGRADÉ SOMBRE EST RETIRÉ. Le passage à la charte Klinik v3 (`b627df4`, 11 août 2026) avait
 * fait de `from-lagon-50/70` (teinte très claire) `from-chabon/70` (encre à 70 %) : le titre en encre
 * se lisait sur un fond sombre, à 2,6:1 — 25 fiches, 2 021 articles.
 */
export function Jurisprudence({
  cases,
  comments,
  variant = 'juris',
  locale,
  codeHrefs,
  terms,
}: {
  cases: JurisCase[]
  comments?: string[]
  variant?: 'juris' | 'annotations'
  locale: Locale
  /** Code civil : les notes citent « C. p. c. 949 » — lien vers le Code de procédure civile. */
  codeHrefs?: CodeHrefs
  /** Termes d'une recherche : surlignés, et le repli s'OUVRE d'office s'il en contient un. */
  terms?: string[]
}) {
  const lt = (o: Record<Locale, string>) => o[locale] ?? o.fr
  const count = cases.length + (comments?.length ?? 0)
  if (!count) return null
  const juris = classes('jurisprudence')
  const annot = classes('annotations')
  return (
    <Repli
      situation={variant === 'annotations' ? 'annotations' : 'jurisprudence'}
      locale={locale}
      compteur={count}
      defautOuvert={contientTerme([...(comments ?? []), ...cases.flatMap((c) => [c.ref, c.excerpt])], terms)}
    >
      {comments && comments.length > 0 && (
        <div className="mb-3">
          {cases.length > 0 && <p className={`mb-1.5 text-[10px] font-bold uppercase tracking-wide ${annot.texte}`}>{lt(LBL.comments)}</p>}
          <ul className="space-y-2">
            {comments.map((c, i) => (
              <li key={i} className="relative pl-6 text-[13px] italic leading-relaxed text-grafit">
                <span aria-hidden className={`absolute left-0 top-0 ${annot.texte}`}>
                  ✍
                </span>
                <CodeRefText text={c} codeHrefs={codeHrefs} terms={terms} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {cases.length > 0 && (
        <>
          {comments && comments.length > 0 && <p className={`mb-1.5 text-[10px] font-bold uppercase tracking-wide ${juris.texte}`}>{lt(LBL.jurisSub)}</p>}
          <ol className="space-y-3">
            {cases.map((c, i) => (
              <li key={i} className="relative pl-8">
                <span
                  aria-hidden
                  className={`absolute left-0 top-0.5 flex h-5 w-5 items-center justify-center rounded-full border ${juris.filet} ${juris.fond} text-[10px] font-bold tabular-nums text-ank`}
                >
                  {i + 1}
                </span>
                {c.ref ? (
                  <>
                    <p className="text-sm font-semibold leading-snug text-ank">
                      <CodeRefText text={c.ref} codeHrefs={codeHrefs} terms={terms} />
                    </p>
                    {c.excerpt && (
                      <p className="mt-1 text-[13px] leading-relaxed text-grafit">
                        <CodeRefText text={c.excerpt} codeHrefs={codeHrefs} terms={terms} />
                      </p>
                    )}
                  </>
                ) : (
                  // Note sans intitulé distinct (Code civil) : l'extrait EST la note.
                  <p className="text-[13px] leading-relaxed text-ank/80">
                    <CodeRefText text={c.excerpt ?? ''} codeHrefs={codeHrefs} terms={terms} />
                  </p>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </Repli>
  )
}
