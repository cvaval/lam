'use client'

import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import Link from 'next/link'
import type { Locale } from '@/lib/types'
import { ChampErreur } from '../ChampErreur'
import type { LibellesDemande } from './notary-request-labels'
import { VerificationHumaine, type VerificationHumaineHandle } from '../security/VerificationHumaine'
import { CHAMP_JETON } from '@/lib/security/turnstile'

export const NOTARY_REQUEST_ACTION = '/api/public/jurisdictions/notaires/demandes'

// Champs assez grands pour le toucher (48 px), texte à 16 px (pas de zoom forcé sur iOS),
// bordure assez contrastée pour être vue (Grafit ; le filet Liy est réservé aux cartes).
const champ = 'mt-1.5 block min-h-[48px] w-full rounded-md border border-grafit/60 bg-white px-3.5 py-3 text-body text-ank aria-[invalid=true]:border-wouj'
const champTexte = 'mt-1.5 block min-h-[104px] w-full resize-y rounded-md border border-grafit/60 bg-white px-3.5 py-3 text-body text-ank'
const etiquette = 'block text-body-sm font-medium text-ank'
const aide = 'mt-1.5 block text-meta text-grafit'
const choix = 'flex min-h-[48px] cursor-pointer items-center gap-3 rounded-md border border-liy bg-white px-4 py-2 text-body-sm text-ank has-[:checked]:border-ank has-[:checked]:bg-pil'

/** Bloc numéroté : carte blanche, numéro en terre cuite, titre en Source Serif 4. */
function Bloc({ n, id, titre, note, children }: { n: number; id: string; titre: string; note?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-lg border border-liy bg-white p-5 sm:p-7">
      <h2 id={id} className="flex items-center gap-3 text-xl text-ank">
        <span aria-hidden="true" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-liy font-serif text-body-sm italic text-wouj">{n}</span>
        {titre}
      </h2>
      {note && <p id={`${id}-note`} className="mt-2 text-body-sm text-grafit">{note}</p>}
      <div className="mt-5 grid gap-5">{children}</div>
    </section>
  )
}

/**
 * Formulaire de demande d'un TIERS (chantier D) — trois blocs numérotés : objet, coordonnées
 * PUBLIQUES de l'étude, coordonnées PRIVÉES du demandeur. AMÉLIORATION PROGRESSIVE :
 *  - SANS JavaScript : `POST` classique, la route répond par une redirection 303 (confirmation,
 *    ou retour avec `?erreur=`) ;
 *  - AVEC JavaScript : même route, en JSON ; la saisie est GARDÉE et chaque erreur s'affiche
 *    sous son champ (et dans le résumé en tête, qui reçoit le focus).
 *
 * Notaire choisi (lien « Vous êtes ce notaire ? ») : son nom s'affiche UNE fois, sa commune est
 * PRÉREMPLIE (corrigeable), et l'objet de la demande — devenu évident — passe en champ caché.
 *
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
  notary: { id: string; name: string; communeId?: string | null } | null
  communes: Array<{ id: string; name: string; department: string }>
  erreurs: string[]
  type: 'coordonnees' | 'inscription'
}) {
  const connues = (codes: string[]) => [...new Set(codes)].filter((e) => Object.prototype.hasOwnProperty.call(l.erreurs, e))
  const [erreurs, setErreurs] = useState<string[]>(() => connues(initiales))
  const [envoi, setEnvoi] = useState(false)
  // « Précisez votre qualité » n'apparaît que pour « Autre » (ou s'il faut le corriger).
  const [qualite, setQualite] = useState<string>(() => (initiales.includes('qualiteAutre') ? 'AUTRE' : ''))
  const resume = useRef<HTMLDivElement>(null)
  const humain = useRef<VerificationHumaineHandle>(null)
  const a = (code: string) => erreurs.includes(code)
  // Message sous le champ ; l'identifiant sert à `aria-describedby`.
  const Err = ({ code }: { code: string }): ReactNode =>
    a(code) ? <span id={`err-${code}`} className="mt-1.5 block text-body-sm font-medium text-wouj">{l.erreurs[code]}</span> : null
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
    <form method="post" action={NOTARY_REQUEST_ACTION} onSubmit={envoyer} className="mt-8 grid gap-5">
      {/* Résumé des erreurs : absent de la mise en page tant qu'il est vide (pas d'écart vide). */}
      <div ref={resume} tabIndex={-1} className={erreurs.length ? 'outline-none' : 'hidden'}>
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
      {/* Notaire choisi : l'objet est connu, il voyage en champ caché. */}
      {notary && <input type="hidden" name="type" value="coordonnees" />}
      {notary && <input type="hidden" name="notaire" value={notary.id} />}

      <Bloc n={1} id="bloc-objet" titre={l.type}>
        {notary ? (
          <div>
            <p className={etiquette}>{l.notary}</p>
            <p className="mt-1 font-serif text-2xl font-semibold text-ank">{notary.name}</p>
            <Err code="notaire" />
          </div>
        ) : (
          <>
            <div>
              <div role="radiogroup" aria-labelledby="bloc-objet" className="grid gap-2" {...decrit('type')}>
                <label className={choix}>
                  <input type="radio" name="type" value="coordonnees" defaultChecked={type === 'coordonnees'} required className="h-4 w-4 shrink-0 accent-wouj" />
                  {l.typeContact}
                </label>
                <label className={choix}>
                  <input type="radio" name="type" value="inscription" defaultChecked={type === 'inscription'} className="h-4 w-4 shrink-0 accent-wouj" />
                  {l.typeListing}
                </label>
              </div>
              <Err code="type" />
            </div>
            <label className={etiquette}>
              {l.notaryName}
              <span id="aide-nom-notaire" className={aide}>{l.notaryNameHint}</span>
              <input name="nomNotaire" maxLength={120} autoComplete="off" className={champ} {...decrit('nomNotaire', 'aide-nom-notaire')} />
              <Err code="nomNotaire" />
            </label>
          </>
        )}
        <label className={etiquette}>
          {l.commune}
          <select name="commune" defaultValue={notary?.communeId ?? ''} className={champ} {...decrit('commune')}>
            <option value="">{l.chooseCommune}</option>
            {communes.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.department})</option>)}
          </select>
          <Err code="commune" />
        </label>
      </Bloc>

      <Bloc n={2} id="bloc-etude" titre={l.contactSection} note={l.contactHint}>
        <Err code="coordonnees" />
        <label className={etiquette}>
          {l.address}
          <input name="adresse" maxLength={200} autoComplete="street-address" className={champ} {...decrit('coordonnees')} />
        </label>
        {/* Téléphone et courriel côte à côte sur ordinateur ; l'aide passe SOUS le champ pour
            que les deux champs restent alignés. */}
        <div className="grid gap-5 sm:grid-cols-2">
          <label className={etiquette}>
            {l.phone}
            <input name="telephones" type="text" inputMode="tel" maxLength={120} className={champ} {...decrit('telephones', 'aide-telephones')} />
            <span id="aide-telephones" className={aide}>{l.phonesHint}</span>
            <Err code="telephones" />
          </label>
          <label className={etiquette}>
            {l.officeEmail}
            <input name="courriel" type="email" maxLength={120} className={champ} {...decrit('courriel')} />
            <Err code="courriel" />
          </label>
        </div>
        <label className={etiquette}>
          {l.message}
          <textarea name="message" rows={3} maxLength={1000} className={champTexte} />
        </label>
      </Bloc>

      <Bloc n={3} id="bloc-vous" titre={l.you} note={l.youHint}>
        <label className={etiquette}>
          {l.name}
          <input name="nom" required maxLength={120} autoComplete="name" className={champ} {...decrit('nom')} />
          <Err code="nom" />
        </label>
        <div>
          <p id="libelle-qualite" className={etiquette}>{l.role}</p>
          <div role="radiogroup" aria-labelledby="libelle-qualite" className="mt-1.5 grid gap-2 sm:grid-cols-3" {...decrit('qualite')}>
            {([['NOTAIRE', l.roleNotary], ['ETUDE', l.roleOffice], ['AUTRE', l.roleOther]] as const).map(([v, txt]) => (
              <label key={v} className={choix}>
                <input type="radio" name="qualite" value={v} required onChange={() => setQualite(v)} className="h-4 w-4 shrink-0 accent-wouj" /> {txt}
              </label>
            ))}
          </div>
          <Err code="qualite" />
          {qualite === 'AUTRE' && (
            <label className={`${etiquette} mt-4`}>
              {l.roleOtherLabel}
              <input name="qualiteAutre" required maxLength={120} className={champ} {...decrit('qualiteAutre')} />
              <Err code="qualiteAutre" />
            </label>
          )}
        </div>
        <label className={etiquette}>
          {l.replyEmail}
          <input name="courrielContact" type="email" required maxLength={120} autoComplete="email" className={champ} {...decrit('courrielContact', 'bloc-vous-note')} />
          <Err code="courrielContact" />
        </label>
        <div>
          <label className="flex items-start gap-3 text-body-sm text-ank">
            <input type="checkbox" name="consentement" value="oui" required className="mt-1 h-4 w-4 shrink-0 accent-wouj" {...decrit('consentement')} />
            <span>
              {l.consent}{' '}
              <Link href={`/${locale}/confidentialite`} className="font-medium !underline underline-offset-2 hover:text-chabon">{l.privacy}</Link>
            </span>
          </label>
          <Err code="consentement" />
        </div>
        <div className="border-t border-liy pt-5">
          <VerificationHumaine
            ref={humain}
            siteKey={verification.siteKey}
            action={verification.action}
            langue={verification.langue}
            nonce={verification.nonce}
            libelles={l.humain}
            erreur={a('humain') ? l.erreurs.humain : a('verification') ? l.erreurs.verification : undefined}
          />
        </div>
      </Bloc>

      <button type="submit" disabled={envoi} className="min-h-[52px] w-full rounded-md bg-wouj px-6 text-body font-semibold text-white transition hover:opacity-90 disabled:opacity-60">
        {envoi ? l.sending : l.submit}
      </button>
    </form>
  )
}
