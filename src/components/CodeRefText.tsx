import Link from 'next/link'
import { segmentCodeRefs, type CodeKey } from '@/lib/doc/coderefs'
import { segmentActeRefs } from '@/lib/doc/acterefs'
import { motifTermes, surligner } from './surligner'

/**
 * Rend un texte en transformant les renvois à un AUTRE code en liens : l'abréviation
 * vers le code, chaque numéro vers son article.
 *
 * Le Code civil cite deux codes : le Code de procédure civile (« C. p. c. 956 ») et le
 * Code pénal (« C. pén., 300 »).
 *
 * `codeHrefs` porte des CHAÎNES (« /fr/doc/cms7u… »), pas des fonctions : ce composant
 * sert aussi bien côté serveur que dans des composants clients (le pliable d'annotations,
 * l'ancienne rédaction), et une fonction ne franchit pas cette frontière.
 *
 * Sans `codeHrefs`, le texte est rendu tel quel : le rendu des autres documents ne
 * change pas.
 *
 * `terms` : les termes d'une recherche, SURLIGNÉS (annotations, jurisprudence, ancienne rédaction —
 * 24 oct. 2026) comme dans le texte de l'article.
 *
 * `actes` (désignation → href) lie les ACTES nommés — « Décret du 8 octobre 1982 » — quand leur
 * texte ou leur Moniteur est en base (src/lib/doc/acterefs.ts). Il voyage dans le même objet que
 * les codes : tous les composants qui reçoivent déjà `codeHrefs` le relaient sans changement.
 */

export type CodeHrefs = Partial<Record<CodeKey, string>> & { actes?: Record<string, string> }

/** Les codes cités qui ont une cible — la clé `actes` n'est pas un code. */
export function codesActifs(codeHrefs?: CodeHrefs): CodeKey[] {
  return (Object.keys(codeHrefs ?? {}) as (CodeKey | 'actes')[]).filter((k): k is CodeKey => k !== 'actes' && Boolean(codeHrefs?.[k]))
}

/** Lien sortant : souligné discret, pour le distinguer d'un renvoi INTERNE (#art-N). */
const CLS = 'font-medium text-chabon underline decoration-chabon/30 underline-offset-2 hover:decoration-chabon'

const NOM: Record<CodeKey, string> = {
  cpc: 'Code de procédure civile',
  cp: 'Code pénal',
  cic: 'Code d’instruction criminelle',
}

export function codeArticleHref(base: string, article: number | null): string {
  return article == null ? base : `${base}#art-${article}`
}

export function CodeRefText({ text, codeHrefs, terms }: { text: string; codeHrefs?: CodeHrefs; terms?: string[] }) {
  const re = motifTermes(terms)
  const actes = segmentActeRefs(text, codeHrefs?.actes)
  if (actes)
    return (
      <>
        {actes.map((s, i) =>
          s.kind === 'text' ? (
            <CodesSeuls key={i} text={s.text} codeHrefs={codeHrefs} re={re} />
          ) : (
            <Link key={i} href={s.href} className={CLS} title={s.cle}>
              {surligner(s.text, re)}
            </Link>
          ),
        )}
      </>
    )
  return <CodesSeuls text={text} codeHrefs={codeHrefs} re={re} />
}

function CodesSeuls({ text, codeHrefs, re }: { text: string; codeHrefs?: CodeHrefs; re: RegExp | null }) {
  const actifs = codesActifs(codeHrefs)
  if (!actifs.length) return <>{surligner(text, re)}</>
  const segs = segmentCodeRefs(text, actifs)
  if (!segs) return <>{surligner(text, re)}</>
  return (
    <>
      {segs.map((s, i) =>
        s.kind === 'text' ? (
          <span key={i}>{surligner(s.text, re)}</span>
        ) : (
          <Link
            key={i}
            href={codeArticleHref(codeHrefs![s.code]!, s.kind === 'article' ? s.article : null)}
            className={CLS}
            title={s.kind === 'article' ? `${NOM[s.code]}, article ${s.article}` : NOM[s.code]}
          >
            {surligner(s.text, re)}
          </Link>
        ),
      )}
    </>
  )
}

export { CLS as CODE_LINK_CLS, NOM as CODE_NOM }
