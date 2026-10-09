'use client'

import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import Link from 'next/link'
import type { Locale } from '@/lib/types'
import { ChampErreur } from '../ChampErreur'
import type { LibellesDemande } from './notary-request-labels'
import { VerificationHumaine, type VerificationHumaineHandle } from '../security/VerificationHumaine'
import { CHAMP_JETON } from '@/lib/security/turnstile'

export const NOTARY_REQUEST_ACTION = '/api/public/jurisdictions/notaires/demandes'

const champ = 'mt-1 w-full rounded-xl border border-chabon/20 bg-white px-3 py-2.5 text-base text-ank aria-[invalid=true]:border-wouj'
const etiquette = 'block text-sm font-medium text-ank'
const aide = 'mt-1 block text-xs font-normal text-ank/80'

/**
 * Formulaire de demande d'un TIERS (chantier D) — AMÉLIORATION PROGRESSIVE :
 *  - SANS JavaScript : `POST` classique, la route répond par une redirection 303 (confirmation,
 *    ou retour avec `?erreur=`) ;
 *  - AVEC JavaScript : même route, en JSON ; la saisie est GARDÉE et chaque erreur s'affiche
 *    sous son champ (et dans le résumé en tête, qui reçoit le focus).
 * Deux protections invisibles pour une personne : le champ piège `site` (masqué, hors
 * tabulation) et l'heure d'affichage `t` (un envoi en moins de 3 s n'est pas humain). Et une
 * visible : la VÉRIFICATION HUMAINE (Turnstile), sans laquelle rien n'est envoyé ; le widget se
 * réinitialise quand la route dit que le jeton a été présenté à Cloudflare.
 * Le courriel du demandeur n'est jamais publié et ne reçoit aucun envoi automatique.
 */
export function NotaryRequestForm({
  locale, l, renderedAt, notary, communes, erreurs: initiales, type, verification,
}: {
  locale: Locale
  l: LibellesDemande
  /** Clé de site, action, langue du widget, nonce de la requête (CSP). */
  verification: { siteKey: string; action: string; langue: 'fr' | 'en'; nonce?: string }
  renderedAt: number
  /** Notaire visé (lien « Vous êtes ce notaire ? ») ; sinon le nom se saisit. */
  notary: { id: string; name: string; communeName: string | null } | null
  communes: Array<{ id: string; name: string; department: string }>
  erreurs: string[]
  type: 'coordonnees' | 'inscription'
}) {
  const connues = (codes: string[]) => [...new Set(codes)].filter((e) => Object.prototype.hasOwnProperty.call(l.erreurs, e))
  const [erreurs, setErreurs] = useState<string[]>(() => connues(initiales))
  const [envoi, setEnvoi] = useState(false)
  const resume = useRef<HTMLDivElement>(null)
  const humain = useRef<VerificationHumaineHandle>(null)
  const a = (code: string) => erreurs.includes(code)
  // Message sous le champ ; l'identifiant sert à `aria-describedby`.
  const Err = ({ code }: { code: string }): ReactNode =>
    a(code) ? <span id={`err-${code}`} className="mt-1 block text-sm font-normal text-ank">— {l.erreurs[code]}</span> : null
  const decrit = (code: string, extra?: string) => ({
    'aria-invalid': a(code) || undefined,
    'aria-describedby': [a(code) ? `err-${code}` : '', extra ?? ''].filter(Boolean).join(' ') || undefined,
  })

  const envoyer = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const donnees = new FormData(form)
    // Pas de jeton : rien ne part. L'erreur s'affiche sous la vérification, avec le résumé.
    if (!String(donnees.get(CHAMP_JETON) ?? '').trim()) {
      setErreurs(['humain'])
      requestAnimationFrame(() => resume.current?.focus())
      return
    }
    setEnvoi(true)
    try {
      const res = await fetch(NOTARY_REQUEST_ACTION, { method: 'POST', body: donnees, headers: { Accept: 'application/json' } })
      const data = (await res.json().catch(() => null)) as { ok?: boolean; erreurs?: string[]; jetonConsomme?: boolean } | null
      if (res.ok && data?.ok) {
        window.location.assign(`/${locale}/juridictions/notaires/demande?envoyee=1`)
        return
      }
      // Un jeton ne sert qu'une fois : nouveau défi s'il a été présenté à Cloudflare.
      if (data?.jetonConsomme !== false) humain.current?.reinitialiser()
      setErreurs(connues(data?.erreurs?.length ? data.erreurs : ['indisponible']))
      setEnvoi(false)
      requestAnimationFrame(() => resume.current?.focus())
    } catch {
      // `fetch` a échoué (réseau) : on laisse le navigateur envoyer le formulaire.
      form.submit()
    }
  }

  return (
    <form method="post" action={NOTARY_REQUEST_ACTION} onSubmit={envoyer} className="mt-6 grid gap-6">
      <div ref={resume} tabIndex={-1} className="outline-none">
        {erreurs.length > 0 && (
          <ChampErreur prefixe="Erreur —" surface="bg-koton">
            {l.errorIntro}
            <ul className="mt-1 list-disc pl-5">
              {erreurs.map((e) => <li key={e}>{l.erreurs[e]}</li>)}
            </ul>
          </ChampErreur>
        )}
      </div>

      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="t" value={String(renderedAt)} />
      {/* Champ piège : invisible, hors tabulation, ignoré des lecteurs d'écran. */}
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label>Site web<input type="text" name="site" tabIndex={-1} autoComplete="off" defaultValue="" /></label>
      </div>

      <fieldset className="rounded-2xl border border-chabon/10 bg-white p-5" {...decrit('type')}>
        <legend className="px-1 font-mono text-[11px] uppercase tracking-wider text-ank/80">{l.type}</legend>
        <div className="grid gap-2">
          <label className="flex min-h-[44px] items-center gap-3 text-sm text-ank">
            <input type="radio" name="type" value="coordonnees" defaultChecked={type === 'coordonnees'} required className="h-4 w-4" />
            {l.typeContact}
          </label>
          <label className="flex min-h-[44px] items-center gap-3 text-sm text-ank">
            <input type="radio" name="type" value="inscription" defaultChecked={type === 'inscription'} className="h-4 w-4" />
            {l.typeListing}
          </label>
        </div>
        <Err code="type" />

        <div className="mt-4 grid gap-4">
          {notary ? (
            <div>
              <p className={etiquette}>{l.notary}</p>
              <p className="mt-1 text-base text-ank">
                <span aria-hidden="true" className="mr-1">👤</span>{notary.name}
                {notary.communeName && <span className="text-sm text-ank/80"> — {notary.communeName}</span>}
              </p>
              <input type="hidden" name="notaire" value={notary.id} />
              <Err code="notaire" />
            </div>
          ) : (
            <label className={etiquette}>
              {l.notaryName}
              <span id="aide-nom-notaire" className={aide}>{l.notaryNameHint}</span>
              <input name="nomNotaire" maxLength={120} autoComplete="off" className={champ} {...decrit('nomNotaire', 'aide-nom-notaire')} />
              <Err code="nomNotaire" />
            </label>
          )}
          <label className={etiquette}>
            {l.commune}
            <select name="commune" defaultValue="" className={champ} {...decrit('commune')}>
              <option value="">{l.chooseCommune}</option>
              {communes.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.department})</option>)}
            </select>
            <Err code="commune" />
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-chabon/10 bg-white p-5" {...decrit('coordonnees')}>
        <legend className="px-1 font-mono text-[11px] uppercase tracking-wider text-ank/80">{l.contactSection}</legend>
        <Err code="coordonnees" />
        <div className="grid gap-4">
          <label className={etiquette}>
            {l.address}
            <input name="adresse" maxLength={200} autoComplete="street-address" className={champ} />
          </label>
          <label className={etiquette}>
            {l.phone}
            <span id="aide-telephones" className={aide}>{l.phonesHint}</span>
            <input name="telephones" type="text" inputMode="tel" maxLength={120} className={champ} {...decrit('telephones', 'aide-telephones')} />
            <Err code="telephones" />
          </label>
          <label className={etiquette}>
            {l.email}
            <input name="courriel" type="email" maxLength={120} className={champ} {...decrit('courriel')} />
            <Err code="courriel" />
          </label>
          <label className={etiquette}>
            {l.message}
            <textarea name="message" rows={3} maxLength={1000} className={champ} />
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-chabon/10 bg-white p-5">
        <legend className="px-1 font-mono text-[11px] uppercase tracking-wider text-ank/80">{l.you}</legend>
        <div className="grid gap-4">
          <label className={etiquette}>
            {l.name}
            <input name="nom" required maxLength={120} autoComplete="name" className={champ} {...decrit('nom')} />
            <Err code="nom" />
          </label>
          <div>
            <p className={etiquette}>{l.role}</p>
            <div className="mt-1 flex flex-wrap gap-x-5" role="radiogroup" aria-label={l.role} {...decrit('qualite')}>
              {([['NOTAIRE', l.roleNotary], ['ETUDE', l.roleOffice], ['AUTRE', l.roleOther]] as const).map(([v, txt]) => (
                <label key={v} className="flex min-h-[44px] items-center gap-2 text-sm text-ank">
                  <input type="radio" name="qualite" value={v} required className="h-4 w-4" /> {txt}
                </label>
              ))}
            </div>
            <Err code="qualite" />
            <label className={`${etiquette} mt-2`}>
              {l.roleOtherLabel}
              <input name="qualiteAutre" maxLength={120} className={champ} {...decrit('qualiteAutre')} />
              <Err code="qualiteAutre" />
            </label>
          </div>
          <label className={etiquette}>
            {l.replyEmail}
            <input name="courrielContact" type="email" required maxLength={120} autoComplete="email" className={champ} {...decrit('courrielContact')} />
            <Err code="courrielContact" />
          </label>
          <div>
            <label className="flex items-start gap-3 text-sm text-ank">
              <input type="checkbox" name="consentement" value="oui" required className="mt-1 h-4 w-4 shrink-0" {...decrit('consentement')} />
              <span>
                {l.consent}{' '}
                <Link href={`/${locale}/confidentialite`} className="underline underline-offset-2 hover:text-chabon">{l.privacy}</Link>
              </span>
            </label>
            <Err code="consentement" />
          </div>
        </div>
      </fieldset>

      <div className="rounded-2xl border border-chabon/10 bg-white p-5" aria-invalid={a('humain') || a('verification') || undefined}>
        <VerificationHumaine
          ref={humain}
          siteKey={verification.siteKey}
          action={verification.action}
          langue={verification.langue}
          nonce={verification.nonce}
          libelles={l.humain}
          lienPolitique={`/${locale}/confidentialite`}
          erreur={a('humain') ? l.erreurs.humain : a('verification') ? l.erreurs.verification : undefined}
        />
      </div>

      <div>
        <button type="submit" disabled={envoi} className="inline-flex min-h-[44px] items-center rounded-full bg-sitwon px-6 text-sm font-semibold text-chabon transition hover:brightness-95 disabled:opacity-60">
          {envoi ? l.sending : l.submit}
        </button>
      </div>
    </form>
  )
}
