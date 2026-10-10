'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, type ReactNode } from 'react'
import Script from 'next/script'
import { TURNSTILE_SCRIPT_URL } from '@/lib/security/turnstile'

/** API explicite de Turnstile (sous-ensemble utilisé). */
interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string | undefined
  reset: (id?: string) => void
  remove: (id?: string) => void
}
declare global {
  interface Window { turnstile?: TurnstileApi }
}

export interface VerificationHumaineHandle {
  /** Nouveau défi : un jeton ne sert qu'une fois. */
  reinitialiser: () => void
}

/**
 * Vérification humaine — Cloudflare Turnstile, rendu EXPLICITE (docs/prompt-verification-humaine-turnstile.md).
 *
 * Générique : ne connaît aucune profession, reçoit l'`action` (`notary-request`,
 * `lawyer-request`…). Placé DANS un `<form>`, le widget y ajoute le champ caché
 * `cf-turnstile-response`, envoyé avec les autres champs. Le script est chargé avec le nonce de
 * la requête, depuis l'adresse EXACTE de Cloudflare ; la CSP de la page l'autorise (middleware).
 *
 * Sans JavaScript, Turnstile ne peut pas fonctionner : le `<noscript>` le dit et renvoie au
 * courriel de la rédaction.
 */
export const VerificationHumaine = forwardRef<VerificationHumaineHandle, {
  siteKey: string
  action: string
  langue: 'fr' | 'en'
  nonce?: string
  libelles: { titre: string; aide: string; mention: string; sansJs: string; politique: string }
  /** Lien vers la politique de confidentialité ; à omettre si le formulaire le donne déjà. */
  lienPolitique?: string
  /** Message d'erreur affiché sous le widget (et relié à lui). */
  erreur?: ReactNode
}>(function VerificationHumaine({ siteKey, action, langue, nonce, libelles, lienPolitique, erreur }, ref) {
  const conteneur = useRef<HTMLDivElement>(null)
  const widget = useRef<string | undefined>(undefined)

  const rendre = useCallback(() => {
    const ts = window.turnstile
    if (!ts || !conteneur.current || widget.current !== undefined) return
    widget.current = ts.render(conteneur.current, {
      sitekey: siteKey,
      action,
      language: langue,
      theme: 'light',
      size: 'flexible',
      appearance: 'always',
      'refresh-expired': 'auto',
    })
  }, [siteKey, action, langue])

  useEffect(() => {
    // Script déjà chargé (navigation côté client) : rendre tout de suite.
    rendre()
    return () => {
      if (widget.current !== undefined) window.turnstile?.remove(widget.current)
      widget.current = undefined
    }
  }, [rendre])

  useImperativeHandle(ref, () => ({
    reinitialiser: () => { if (widget.current !== undefined) window.turnstile?.reset(widget.current) },
  }), [])

  return (
    <div>
      <Script src={TURNSTILE_SCRIPT_URL} nonce={nonce} strategy="afterInteractive" onReady={rendre} />
      <p className="text-body-sm font-medium text-ank">{libelles.titre}</p>
      <p id="aide-verification" className="mt-1 text-meta text-grafit">{libelles.aide}</p>
      <div
        ref={conteneur}
        className="mt-2 min-h-[65px]"
        aria-describedby={['aide-verification', erreur ? 'err-humain' : ''].filter(Boolean).join(' ')}
      />
      {erreur ? <span id="err-humain" className="mt-1.5 block text-body-sm font-medium text-wouj">{erreur}</span> : null}
      <noscript>
        <p className="mt-2 text-sm text-ank">{libelles.sansJs}</p>
      </noscript>
      <p className="mt-2 text-meta text-grafit">
        {libelles.mention}
        {lienPolitique && (
          <>{' '}<a href={lienPolitique} className="!underline underline-offset-2 hover:text-chabon">{libelles.politique}</a></>
        )}
      </p>
    </div>
  )
})
