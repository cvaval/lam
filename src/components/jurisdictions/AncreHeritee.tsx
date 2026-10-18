'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

/**
 * Liens ANCIENS de « Notaires par juridiction » : `#court-tpi-…` (une juridiction) et
 * `#commune-…` (une commune), posés par la carte et les fiches avant l'annuaire classé (17 oct.
 * 2026). La page étant désormais paginée, l'ancre devient le FILTRE correspondant — le lien
 * garde son sens au lieu de tomber sur une section absente.
 */
export function AncreHeritee() {
  const router = useRouter()
  const chemin = usePathname()
  useEffect(() => {
    if (window.location.search) return
    const h = decodeURIComponent(window.location.hash.slice(1))
    if (!/^[a-z0-9][a-z0-9-]{2,119}$/.test(h)) return
    const cle = h.startsWith('court-') ? 'juridiction' : h.startsWith('commune-') ? 'commune' : null
    if (cle) router.replace(`${chemin}?${cle}=${h}#ag-annuaire-resultats`, { scroll: false })
  }, [router, chemin])
  return null
}
