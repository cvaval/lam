'use client'

import { useEffect } from 'react'

/**
 * § 6.5 et § 8.3 — **LE FOCUS VA AU RÉSULTAT, ET SUR TÉLÉPHONE LA VUE AVEC LUI.**
 *
 * Le formulaire navigue en `GET` sans fragment : le navigateur repart en haut du document.
 * Sous 1024 px, la disposition met la saisie en `order-1` et le résultat en `order-2` — après
 * « Calculer », l'avocate atterrit donc en haut d'une colonne de saisie qui fait plus d'un
 * écran, sans aucun indice qu'un résultat existe en dessous. Les trois titres portaient bien
 * `id="delai-resultat-titre" tabIndex={-1}`, et la section `aria-live="polite"` — mais rien
 * ne les focalisait.
 *
 * Pourquoi un composant client plutôt qu'un fragment dans l'`action` du formulaire : **un
 * `GET` de formulaire SUPPRIME le fragment de l'URL d'action.** Il faudrait un champ caché ou
 * une redirection ; ce composant, monté avec le résultat, est plus simple et ne change pas le
 * permalien — l'URL reste exactement ce que le § 6.3 en dit.
 *
 * ⚠️ `prefers-reduced-motion` est respecté : le défilement devient instantané. Et le focus
 * est posé AVANT le défilement, pour que le lecteur d'écran annonce le titre.
 */
export function DelaiFocusResultat() {
  useEffect(() => {
    const titre = document.getElementById('delai-resultat-titre')
    if (!titre) return
    // `preventScroll` : c'est `scrollIntoView` qui décide du mouvement, pas le focus, sinon
    // le saut est brutal et ignore `prefers-reduced-motion`.
    titre.focus({ preventScroll: true })
    const doux = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    titre.scrollIntoView({ behavior: doux ? 'smooth' : 'auto', block: 'start' })
  }, [])
  return null
}
