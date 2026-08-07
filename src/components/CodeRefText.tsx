import Link from 'next/link'
import { segmentCodeRefs, type CodeKey } from '@/lib/doc/coderefs'

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
 */

export type CodeHrefs = Partial<Record<CodeKey, string>>

/** Lien sortant : souligné discret, pour le distinguer d'un renvoi INTERNE (#art-N). */
const CLS = 'font-medium text-soley-700 underline decoration-soley/30 underline-offset-2 hover:decoration-soley'

const NOM: Record<CodeKey, string> = {
  cpc: 'Code de procédure civile',
  cp: 'Code pénal',
  cic: 'Code d’instruction criminelle',
}

export function codeArticleHref(base: string, article: number | null): string {
  return article == null ? base : `${base}#art-${article}`
}

export function CodeRefText({ text, codeHrefs }: { text: string; codeHrefs?: CodeHrefs }) {
  const actifs = (Object.keys(codeHrefs ?? {}) as CodeKey[]).filter((k) => codeHrefs?.[k])
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
