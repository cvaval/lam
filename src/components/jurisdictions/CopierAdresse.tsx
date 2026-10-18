'use client'

import { useEffect, useState } from 'react'
import { Copy } from 'lucide-react'

/**
 * Copie de l'adresse de l'étude, avec retour ACCESSIBLE (« Adresse copiée », région annoncée).
 * Presse-papiers indisponible (navigateur ancien, contexte non sécurisé, refus) : copie par
 * `execCommand`, puis, à défaut, l'adresse est SÉLECTIONNÉE à l'écran et le message le dit.
 */
export function CopierAdresse({ adresse, cibleId, l }: { adresse: string; cibleId: string; l: { copier: string; copiee: string; repli: string } }) {
  const [etat, setEtat] = useState<'repos' | 'copiee' | 'repli'>('repos')
  useEffect(() => {
    if (etat !== 'copiee') return
    const t = window.setTimeout(() => setEtat('repos'), 2500)
    return () => window.clearTimeout(t)
  }, [etat])

  const copier = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(adresse)
        setEtat('copiee')
        return
      }
    } catch { /* refus ou contexte non sécurisé : repli */ }
    try {
      const zone = document.createElement('textarea')
      zone.value = adresse
      zone.setAttribute('readonly', '')
      zone.style.position = 'fixed'
      zone.style.opacity = '0'
      document.body.appendChild(zone)
      zone.select()
      const ok = document.execCommand('copy')
      zone.remove()
      if (ok) { setEtat('copiee'); return }
    } catch { /* repli suivant */ }
    const el = document.getElementById(cibleId)
    if (el) {
      const plage = document.createRange()
      plage.selectNodeContents(el)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(plage)
    }
    setEtat('repli')
  }

  return (
    <div className="flex shrink-0 flex-col items-end">
      <button
        type="button"
        onClick={copier}
        aria-label={l.copier}
        title={l.copier}
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[#52656B] transition hover:bg-[#E9EDE7] hover:text-[#152E38]"
      >
        <Copy aria-hidden="true" className="h-[18px] w-[18px]" />
      </button>
      <p role="status" aria-live="polite" className={etat === 'repos' ? 'sr-only' : 'max-w-[12rem] text-right text-[12px] leading-snug text-[#52656B]'}>
        {etat === 'copiee' ? l.copiee : etat === 'repli' ? l.repli : ''}
      </p>
    </div>
  )
}
