'use client'

import { useEffect, useState } from 'react'
import { ActionButton } from './ActionButton'

/**
 * Actions de citation (§07) :
 *  - « Citer » copie une citation juridique prête à coller (désignation + référence +
 *    date + lien profond, ancre comprise). Préfixe construit côté serveur.
 *  - Quand l'URL pointe un article (#art-N, y compris les numérotations étendues
 *    « 95-bis », « 12-1 »…) : « Citer l'article N » précise l'article dans la
 *    citation, et « Copier l'article » copie le texte de l'article lui-même —
 *    blocs éditoriaux exclus (annotations, jurisprudence, renvois : `data-nocopy`).
 * L'ancre est suivie au fil de la navigation (hashchange ; la recherche du Code
 * émet l'événement elle-même après replaceState — voir CodeSidebar.goToHit).
 */

/** N° d'article courant depuis l'ancre de l'URL (#art-…), suivi en continu.
 *  Accepte les numérotations étendues (anchors.ts) : art-240, art-95-bis, art-12-1. */
function useArticleFromHash(): string | null {
  const [art, setArt] = useState<string | null>(null)
  useEffect(() => {
    const read = () => {
      const m = /^#art-([a-z0-9-]{1,30})$/i.exec(window.location.hash)
      setArt(m ? m[1] : null)
    }
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])
  return art
}

/** Frontière d'article dans le texte officiel : élément (ou descendant) ancré art-/sec-. */
function isBoundary(node: Element, selfId: string): boolean {
  if (node.id && /^(art|sec)-/.test(node.id) && node.id !== selfId) return true
  const inner = node.querySelector?.('[id^="art-"], [id^="sec-"]')
  return Boolean(inner && inner.id !== selfId)
}

/** Bloc éditorial exclu de la copie (annotations, jurisprudence, renvois, repliables). */
function isNoCopy(node: Element): boolean {
  return node.tagName === 'DETAILS' || node.hasAttribute('data-nocopy')
}

/**
 * Texte de l'article N : depuis l'élément ancré jusqu'à la prochaine frontière.
 * Quand l'ancre porte sur un `<li>` (« 12.- … » d'une liste numérotée), les
 * alinéas suivants sont des `<p>` FRÈRES du `<ol>` : à l'épuisement des `<li>`,
 * la marche remonte d'un cran et continue après la liste.
 */
function articleText(n: string): string | null {
  const start = document.getElementById(`art-${n}`)
  if (!start) return null
  const parts = [start.textContent ?? '']
  let cur: Element = start
  for (;;) {
    let next = cur.nextElementSibling
    if (!next) {
      const parent = cur.parentElement
      if (!parent || (parent.tagName !== 'OL' && parent.tagName !== 'UL')) break
      next = parent.nextElementSibling
    }
    if (!next || isBoundary(next, `art-${n}`)) break
    if (!isNoCopy(next)) parts.push(next.textContent ?? '')
    cur = next
  }
  const text = parts.map((p) => p.trim()).filter(Boolean).join('\n')
  return text || null
}

export function CiteButton({
  citation,
  label,
  copiedLabel,
  citeArticleLabel,
  copyArticleLabel,
}: {
  citation: string
  label: string
  copiedLabel: string
  citeArticleLabel: string
  copyArticleLabel: string
}) {
  const art = useArticleFromHash()
  const [copied, setCopied] = useState<'doc' | 'artCite' | 'artText' | null>(null)

  async function copy(kind: 'doc' | 'artCite' | 'artText', text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(kind)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      /* presse-papiers indisponible : on n'affiche pas d'erreur bloquante */
    }
  }

  const url = () => (typeof window !== 'undefined' ? window.location.href : '')
  const withCheck = (kind: 'doc' | 'artCite' | 'artText', content: React.ReactNode) =>
    copied === kind ? `✓ ${copiedLabel}` : content

  return (
    <>
      <ActionButton ariaLive="polite" onClick={() => copy('doc', url() ? `${citation}. ${url()}` : citation)}>
        {withCheck('doc', <>❝ {label}</>)}
      </ActionButton>
      {art && (
        <>
          <ActionButton ariaLive="polite" onClick={() => copy('artCite', `Art. ${art} — ${citation}. ${url()}`)}>
            {withCheck('artCite', <>❝ {citeArticleLabel} {art}</>)}
          </ActionButton>
          <ActionButton
            ariaLive="polite"
            onClick={() => {
              const text = articleText(art)
              if (text) void copy('artText', `${text}\n\n— Art. ${art}, ${citation}. ${url()}`)
            }}
          >
            {withCheck('artText', <>⎘ {copyArticleLabel} {art}</>)}
          </ActionButton>
        </>
      )}
    </>
  )
}
