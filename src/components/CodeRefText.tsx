import Link from 'next/link'
import { segmentCodeRefs, type CodeKey } from '@/lib/doc/coderefs'
import { segmentActeRefs } from '@/lib/doc/acterefs'

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

export function CodeRefText({ text, codeHrefs }: { text: string; codeHrefs?: CodeHrefs }) {
  const actes = segmentActeRefs(text, codeHrefs?.actes)
  if (actes)
    return (
      <>
        {actes.map((s, i) =>
          s.kind === 'text' ? (
            <CodesSeuls key={i} text={s.text} codeHrefs={codeHrefs} />
          ) : (
            <Link key={i} href={s.href} className={CLS} title={s.cle}>
              {s.text}
            </Link>
          ),
        )}
      </>
    )
  return <CodesSeuls text={text} codeHrefs={codeHrefs} />
}

function CodesSeuls({ text, codeHrefs }: { text: string; codeHrefs?: CodeHrefs }) {
  const actifs = codesActifs(codeHrefs)
  if (!actifs.length) return <>{text}</>
  const segs = segmentCodeRefs(text, actifs)
  if (!segs) return <>{text}</>
  return (
    <>
      {segs.map((s, i) =>
        s.kind === 'text' ? (
          <span key={i}>{s.text}</span>
        ) : (
          <Link
            key={i}
            href={codeArticleHref(codeHrefs![s.code]!, s.kind === 'article' ? s.article : null)}
            className={CLS}
            title={s.kind === 'article' ? `${NOM[s.code]}, article ${s.article}` : NOM[s.code]}
          >
            {s.text}
          </Link>
        ),
      )}
    </>
  )
}

export { CLS as CODE_LINK_CLS, NOM as CODE_NOM }
