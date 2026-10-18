'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'
import type { Locale } from '@/lib/types'
import { lienCarteFiche, lireIdFiche, PARAM_FICHE, urlAvecFiche, urlSansFiche, type ContexteFiche } from '@/lib/jurisdictions/fiche-notaire'
import { chargeurApi, creerControleurFiche, indexFocusSuivant, SELECTEUR_FOCUSABLE, type EtatFiche } from '@/lib/jurisdictions/fiche-controleur'
import type { LibellesModale } from './fiche-libelles'
import { FicheNotaire } from './FicheNotaire'

/**
 * La fiche d'un notaire en FENÊTRE MODALE, au-dessus de l'annuaire ou de la carte judiciaire.
 *
 * L'URL EST LA SOURCE DE VÉRITÉ : `?notaire=<id>` ajouté à l'adresse courante.
 *  - un clic sur une entrée (`a[data-fiche-notaire]`) ajoute une entrée d'historique SANS navigation
 *    (`history.pushState`, intégré au routeur Next ≥ 14.1) : la page n'est ni rechargée ni refaite —
 *    recherche, filtres, page, défilement et carte restent exactement tels quels ;
 *  - « Précédent » referme la fiche ; « Suivant » la rouvre ;
 *  - un lien direct (courriel) arrive avec la fiche DÉJÀ rendue par le serveur (`initial`) ; la
 *    fermer remplace l'adresse par celle de l'annuaire, sans quitter le site ;
 *  - sans JavaScript, chaque entrée mène à la page de repli et la fiche rendue par le serveur se
 *    ferme par de simples liens.
 * Une réponse obsolète n'est jamais affichée (`fiche-controleur.ts`).
 *
 * Dialogue accessible : nom = titre « Notaire », focus à l'ouverture, Tab piégé, arrière-plan
 * `inert`, Échap, focus rendu au déclencheur, défilement de l'arrière-plan bloqué sans perte de
 * position. Aucune animation (préférence de réduction des animations respectée d'office).
 */
export function FicheNotaireModale({
  locale, l, demandes, contexte, initial, titres,
}: {
  locale: Locale
  l: LibellesModale
  demandes: boolean
  contexte: ContexteFiche
  /** Fiche demandée par l'URL au chargement, déjà lue par le serveur (lien direct). */
  initial: EtatFiche
  /** Titre du document : celui de la page, et celui d'une fiche (`{name}`). */
  titres: { page: string; fiche: string }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const idUrl = lireIdFiche(searchParams.get(PARAM_FICHE))
  const [etat, setEtat] = useState<EtatFiche>(initial)
  const controleur = useMemo(() => creerControleurFiche(chargeurApi(), setEtat, initial), []) // eslint-disable-line react-hooks/exhaustive-deps
  const dialogue = useRef<HTMLDivElement>(null)
  const racine = useRef<HTMLDivElement>(null)
  const declencheur = useRef<HTMLElement | null>(null)
  const ouverte = etat.statut !== 'fermee'

  // L'adresse courante, telle que le serveur l'a aussi vue (liens de fermeture sans JavaScript).
  const qs = searchParams.toString()
  const ici = `${pathname}${qs ? `?${qs}` : ''}`
  const lienFermer = urlSansFiche(ici)

  // 1. L'URL commande : une fiche demandée s'ouvre, son absence ferme.
  useEffect(() => {
    if (idUrl) controleur.ouvrir(idUrl)
    else controleur.fermer()
  }, [idUrl, controleur])

  // 2. Un clic sur une entrée ouvre la fiche SANS naviguer (sauf clic modifié : nouvel onglet).
  useEffect(() => {
    const surClic = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const lien = (e.target as Element | null)?.closest?.('a[data-fiche-notaire]') as HTMLAnchorElement | null
      if (!lien || (lien.target && lien.target !== '_self')) return
      const id = lireIdFiche(lien.dataset.ficheNotaire)
      if (!id) return
      e.preventDefault()
      e.stopPropagation()
      declencheur.current = lien
      window.history.pushState({ ficheNotaire: id }, '', urlAvecFiche(window.location.href, id))
    }
    document.addEventListener('click', surClic, true)
    return () => document.removeEventListener('click', surClic, true)
  }, [])

  const fermer = useCallback(() => {
    const st = window.history.state as { ficheNotaire?: string } | null
    // Ouverte par un clic ici : on revient à l'entrée précédente (exactement l'état d'avant).
    if (idUrl && st?.ficheNotaire === idUrl) window.history.back()
    // Lien direct, rechargement : l'annuaire, sans quitter le site.
    else window.history.replaceState(null, '', urlSansFiche(window.location.href))
  }, [idUrl])

  // 3. Ouverture : arrière-plan inerte, défilement bloqué (position conservée), focus dans la fiche.
  useEffect(() => {
    if (!ouverte) return
    const html = document.documentElement
    const barre = window.innerWidth - html.clientWidth
    const avant = { overflow: html.style.overflow, padding: document.body.style.paddingRight }
    html.style.overflow = 'hidden'
    if (barre > 0) document.body.style.paddingRight = `${barre}px`
    const inertes: Element[] = []
    let n: Element | null = racine.current
    while (n && n.parentElement && n !== document.body) {
      for (const s of Array.from(n.parentElement.children)) {
        if (s !== n && !s.hasAttribute('inert') && s.tagName !== 'SCRIPT') { s.setAttribute('inert', ''); inertes.push(s) }
      }
      n = n.parentElement
    }
    if (!dialogue.current?.contains(document.activeElement)) dialogue.current?.focus()
    const retour = declencheur.current
    return () => {
      html.style.overflow = avant.overflow
      document.body.style.paddingRight = avant.padding
      for (const s of inertes) s.removeAttribute('inert')
      // Focus rendu au déclencheur ; à défaut (lien direct), au titre de l'annuaire.
      const cible = retour && document.contains(retour) ? retour : (document.getElementById('ag-annuaire-titre') as HTMLElement | null)
      cible?.focus({ preventScroll: true })
      declencheur.current = null
    }
  }, [ouverte])

  // 4. Titre du document : la fiche ouverte le porte ; fermée, celui de la page revient (y compris
  //    après un lien direct, dont le serveur avait titré la page au nom du notaire).
  const nomFiche = etat.statut === 'ok' ? etat.fiche.name : null
  useEffect(() => {
    document.title = nomFiche ? titres.fiche.replace('{name}', nomFiche) : titres.page
  }, [nomFiche, ouverte, titres.fiche, titres.page])

  const surTouche = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); fermer(); return }
    if (e.key !== 'Tab' || !dialogue.current) return
    const elements = Array.from(dialogue.current.querySelectorAll<HTMLElement>(SELECTEUR_FOCUSABLE)).filter((x) => x.offsetParent !== null || x === document.activeElement)
    const i = indexFocusSuivant(elements.length, elements.indexOf(document.activeElement as HTMLElement), e.shiftKey)
    if (elements.length === 0) { e.preventDefault(); return }
    if (i >= 0) { e.preventDefault(); elements[i].focus() }
  }

  if (!ouverte) return <div ref={racine} hidden />

  const carte = etat.statut === 'ok' ? lienCarteFiche(contexte, ici, locale, etat.fiche) : null
  const clicFermer = (e: React.MouseEvent) => { e.preventDefault(); fermer() }

  return (
    <div ref={racine} className="fixed inset-0 z-[100] flex items-stretch justify-center p-2 sm:items-center sm:p-6">
      {/* Fond assombri : le contexte reste reconnaissable ; un clic dessus ferme la fiche. */}
      <div aria-hidden="true" onClick={fermer} className="absolute inset-0 bg-[#152E38]/45" />
      <div
        ref={dialogue}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ag-fiche-titre"
        aria-busy={etat.statut === 'chargement'}
        tabIndex={-1}
        onKeyDown={surTouche}
        className="relative flex w-full max-w-[660px] flex-col rounded-xl bg-white text-[#152E38] shadow-[0_18px_48px_rgba(21,46,56,0.22)] outline-none max-sm:h-full sm:max-h-[calc(100dvh-48px)]"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 px-5 pt-5 sm:px-8 sm:pt-7">
          <h2 id="ag-fiche-titre" className="font-serif text-[30px] font-semibold leading-tight text-[#152E38] sm:text-[34px]">{l.titre}</h2>
          <a
            href={lienFermer}
            onClick={clicFermer}
            aria-label={l.fermerFiche}
            title={l.fermerFiche}
            className="-mr-2 -mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#52656B] transition hover:bg-[#E9EDE7] hover:text-[#152E38]"
          >
            <X aria-hidden="true" className="h-6 w-6" />
          </a>
        </div>
        <div className="mx-5 mt-4 shrink-0 border-t border-[#D7DCD7] sm:mx-8" />

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6">
          {etat.statut === 'chargement' && (
            <p role="status" className="py-6 text-[15px] text-[#52656B]">
              <span aria-hidden="true" className="mr-2 inline-block h-2 w-2 rounded-full bg-[#9B422C] align-middle motion-safe:animate-pulse" />
              {l.chargement}
            </p>
          )}
          {etat.statut === 'introuvable' && (
            <div role="status" className="py-4">
              <p className="font-serif text-[21px] font-semibold">{l.introuvableTitre}</p>
              <p className="mt-1 text-[15px] text-[#52656B]">{l.introuvableTexte}</p>
            </div>
          )}
          {etat.statut === 'erreur' && (
            <div role="alert" className="py-4">
              <p className="font-serif text-[21px] font-semibold">{l.erreurTitre}</p>
              <p className="mt-1 text-[15px] text-[#52656B]">{l.erreurTexte}</p>
              <button
                type="button"
                onClick={() => controleur.reessayer()}
                className="mt-4 inline-flex min-h-[44px] items-center rounded-lg bg-[#152E38] px-4 text-sm font-medium text-white transition hover:bg-[#152E38]/90"
              >
                {l.reessayer}
              </button>
            </div>
          )}
          {etat.statut === 'ok' && <FicheNotaire fiche={etat.fiche} locale={locale} l={l} demandes={demandes} niveau={3} prefixe="ag-fiche" />}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 pb-5 pt-2 sm:px-8 sm:pb-7">
          {carte ? (
            <a
              href={carte}
              onClick={(e) => {
                e.preventDefault()
                // Ordinateur : la carte est à côté, toujours visible — on ne fait pas défiler. Téléphone :
                // la carte s'ouvre (`carte=1`) et l'on y descend (ancre de la carte mobile).
                const large = window.matchMedia('(min-width: 1024px)').matches
                router.push(large ? carte.replace(/#.*$/, '') : carte, { scroll: !large })
              }}
              className="inline-flex min-h-[44px] items-center gap-2 text-[15px] font-medium text-[#9B422C] hover:text-[#152E38]"
            >
              {l.carteCommune} <span aria-hidden="true">→</span>
            </a>
          ) : <span />}
          <a
            href={lienFermer}
            onClick={clicFermer}
            className="ml-auto inline-flex min-h-[44px] items-center rounded-lg border-2 border-[#152E38] bg-white px-6 text-[15px] font-semibold text-[#152E38] transition hover:bg-[#E9EDE7]"
          >
            {l.fermer}
          </a>
        </div>
      </div>
    </div>
  )
}
