'use client'

import { useId, useRef, useState } from 'react'

/**
 * Un champ de la recherche avancée — saisie ou menu — avec sa croix d'effacement.
 *
 * ⚠️ UN CRITÈRE QU'ON NE SAIT PAS RETIRER EST UN CRITÈRE QUI RESTE. Sans croix, vider une
 * case demandait de la sélectionner et d'appuyer sur Suppr, geste que rien n'annonce ; et
 * sur un menu, il fallait retrouver l'option « Tous » au milieu de quarante. Les recherches
 * revenaient donc filtrées sans que le lecteur l'ait voulu.
 *
 * ⚠️ LA CROIX NE PARAÎT QUE S'IL Y A QUELQUE CHOSE À EFFACER. Une croix permanente sur une
 * case vide promet une action sans effet.
 *
 * La croix est un `<button type="button">` : dans un formulaire GET, un bouton sans type
 * vaut `submit` et effacer une case lancerait la recherche.
 *
 * ⚠️ LES SUGGESTIONS PROPOSENT, ELLES N'IMPOSENT PAS. Un `<datalist>` natif : la liste
 * s'ouvre et se filtre à la frappe, au clavier comme à la souris, sans que nous ayons à
 * réécrire la navigation d'une liste déroulante — et une saisie LIBRE reste acceptée. Un
 * magistrat absent de la liste (recueil non encore versé, graphie inédite) doit rester
 * cherchable : une liste fermée le rendrait introuvable sans rien expliquer.
 */
export function ChampRecherche({
  name,
  label,
  defaultValue = '',
  placeholder,
  maxLength,
  inputMode,
  pattern,
  options,
  suggestions,
  clearLabel,
  className = '',
}: {
  name: string
  label: string
  defaultValue?: string
  placeholder?: string
  maxLength?: number
  inputMode?: 'numeric'
  pattern?: string
  /** Présent ⇒ le champ est un menu ; la première entrée vaut « aucun choix ». */
  options?: { value: string; label: string }[]
  /** Noms proposés à la frappe (saisie libre toujours acceptée). `hint` = repère affiché. */
  suggestions?: { value: string; hint?: string }[]
  clearLabel: string
  className?: string
}) {
  const id = useId()
  const [valeur, setValeur] = useState(defaultValue)
  const champ = useRef<HTMLInputElement | HTMLSelectElement>(null)

  // ⚠️ LE CHAMP DOIT SUIVRE L'URL, ET LA NAVIGATION DOUCE NE LE REMONTE PAS. En cliquant
  // « Réinitialiser », l'adresse redevenait `?adv=1` et les résultats se dépliaient, mais
  // les cases continuaient d'afficher « Rousseau » et « HASCO » : le panneau annonçait des
  // critères qui n'agissaient plus. Next reconcilie le composant sans le remonter, donc
  // l'état initial n'est pas réappliqué — on le réaligne ici, à chaque fois que la valeur
  // venue du serveur change.
  const [ancre, setAncre] = useState(defaultValue)
  if (ancre !== defaultValue) {
    setAncre(defaultValue)
    setValeur(defaultValue)
  }

  const effacer = () => {
    setValeur('')
    // Le foyer revient sur le champ : l'effacement laisse la main là où l'on travaillait.
    champ.current?.focus()
  }

  const base =
    'w-full rounded-lg border border-chabon/15 bg-white py-2 pl-3 text-sm outline-none focus:border-liy'

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-wide text-ank/80">
        {label}
      </label>
      <div className="relative">
        {options ? (
          <select
            id={id}
            name={name}
            ref={champ as React.RefObject<HTMLSelectElement>}
            value={valeur}
            onChange={(e) => setValeur(e.target.value)}
            // Place pour la croix ET pour le chevron natif du menu, qui ne bouge pas.
            className={`${base} ${valeur ? 'pr-16' : 'pr-8'}`}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={id}
            name={name}
            ref={champ as React.RefObject<HTMLInputElement>}
            value={valeur}
            onChange={(e) => setValeur(e.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            inputMode={inputMode}
            pattern={pattern}
            list={suggestions?.length ? `${id}-suggestions` : undefined}
            // La liste native s'ouvre à la frappe ; `autoComplete=off` empêche seulement
            // l'historique du navigateur de la recouvrir.
            autoComplete="off"
            className={`${base} ${valeur ? 'pr-9' : 'pr-3'}`}
          />
        )}
        {!options && suggestions && suggestions.length > 0 && (
          <datalist id={`${id}-suggestions`}>
            {suggestions.map((s) => (
              <option key={s.value} value={s.value} label={s.hint} />
            ))}
          </datalist>
        )}
        {valeur && (
          <button
            type="button"
            onClick={effacer}
            // Cible de 44 px (charte) obtenue par la zone tactile, sans grossir le glyphe.
            aria-label={`${clearLabel} — ${label}`}
            title={`${clearLabel} — ${label}`}
            className={`absolute inset-y-0 flex w-11 items-center justify-center text-grafit hover:text-ank ${
              options ? 'right-5' : 'right-0'
            }`}
          >
            {/* Le glyphe est décoratif : le libellé accessible est porté par le bouton. */}
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
