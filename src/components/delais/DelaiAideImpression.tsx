'use client'

import { useEffect, useRef } from 'react'

/**
 * À L'IMPRESSION, LES EXPLICATIONS SONT DÉPLIÉES — même si l'avocate les avait laissées
 * repliées : un `<details>` fermé n'imprime que son résumé, et la feuille sortirait sans la
 * règle de lecture de la date ni l'article 987.
 *
 * Avant l'impression, on ouvre les blocs FERMÉS de la colonne d'aide ; après, on referme ceux-là
 * seulement — l'écran revient tel qu'elle l'avait laissé. Sans script, `calculateur.css` prend
 * le relais (`::details-content`, navigateurs récents).
 */
export function DelaiAideImpression() {
  const repere = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const aide = repere.current?.closest('aside')
    if (!aide) return
    // Cumulé, jamais remplacé : un second `beforeprint` sans `afterprint` entre les deux (cela
    // arrive — l'export PDF du navigateur en émet un lui-même) trouverait tout ouvert et ferait
    // oublier ce qu'il faudra refermer.
    let rouverts: HTMLDetailsElement[] = []
    const avant = () => {
      const fermes = Array.from(aide.querySelectorAll('details')).filter((d) => !d.open)
      for (const d of fermes) d.open = true
      rouverts = [...rouverts, ...fermes]
    }
    const apres = () => {
      for (const d of rouverts) d.open = false
      rouverts = []
    }
    window.addEventListener('beforeprint', avant)
    window.addEventListener('afterprint', apres)
    return () => {
      window.removeEventListener('beforeprint', avant)
      window.removeEventListener('afterprint', apres)
    }
  }, [])

  return <span ref={repere} hidden />
}
