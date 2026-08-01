import Link from 'next/link'
import { segmentCpcRefs, isCpcArticle } from '@/lib/doc/coderefs'

/**
 * Rend un texte en transformant les renvois « C. p. c. » en liens vers le Code de
 * procédure civile — l'abréviation vers le Code, chaque numéro vers son article.
 *
 * `cpcDocHref` est une CHAÎNE (« /fr/doc/cms7u… »), pas une fonction : ce composant
 * est utilisé aussi bien côté serveur que dans des composants clients (le pliable
 * d'annotations, l'ancienne rédaction), et une fonction ne franchit pas la frontière.
 *
 * Sans `cpcDocHref`, le texte est rendu tel quel : le comportement des autres
 * documents ne change pas.
 */

/** Lien sortant : souligné discret, pour le distinguer d'un renvoi INTERNE (#art-N). */
const CLS = 'font-medium text-soley-700 underline decoration-soley/30 underline-offset-2 hover:decoration-soley'

export function cpcArticleHref(base: string, article: number | null): string {
  return article == null ? base : `${base}#art-${article}`
}

export function CodeRefText({ text, cpcDocHref }: { text: string; cpcDocHref?: string }) {
  if (!cpcDocHref) return <>{text}</>
  const segs = segmentCpcRefs(text, isCpcArticle)
  if (!segs) return <>{text}</>
  return (
    <>
      {segs.map((s, i) =>
        s.kind === 'text' ? (
          <span key={i}>{s.text}</span>
        ) : (
          <Link
            key={i}
            href={cpcArticleHref(cpcDocHref, s.kind === 'article' ? s.article : null)}
            className={CLS}
            title={s.kind === 'article' ? `Code de procédure civile, article ${s.article}` : 'Code de procédure civile'}
          >
            {s.text}
          </Link>
        ),
      )}
    </>
  )
}

export { CLS as CPC_LINK_CLS }
