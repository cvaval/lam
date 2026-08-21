'use client'

import { useState } from 'react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { ChampErreur } from '../ChampErreur'
import { DelaiDateField } from '../delais/DelaiDateField'
import { messageErreur } from '../delais/messages'

/**
 * LES DEUX CHAMPS DU HÉROS — et ce qu'ils DISENT, qui doit être ce que dit la page publique.
 *
 * ⚠️ **Les deux surfaces publiques portent les mêmes champs : elles doivent en dire la même
 * chose.** Le héros demandait un « Nombre de jour(s) francs » sans jamais énoncer ce que cela
 * emporte, et sans dire ce qui manquait : son bouton « Calculer » partait avec deux champs
 * vides, sans un mot. C'est le point d'entrée le plus vu du site. Il reprend donc, mot pour
 * mot, la consigne de saisie de `DelaiFormPublic`. Les clés existent dans les trois langues.
 *
 * ⚠️ **LES CHAMPS SE RELISENT APRÈS LA SOUMISSION.** Depuis que le héros calcule sur place, le
 * `GET` revient sur l'accueil avec `?d=…&n=…` : les rendre vides sous une date fraîchement
 * affichée donnerait une date sans sa saisie, et un second calcul serait à retaper en entier.
 * `valeurs` vient donc du serveur, et l'état local part de là.
 *
 * ⚠️ **LA RÈGLE DE DROIT N'EST PAS ICI** : `DelaisHeroSlide` la porte une seule fois, sur sa
 * ligne à pastille. La redire sous le bouton l'écrirait deux fois dans le même héros, à
 * quarante centimètres d'écart et en deux formulations.
 *
 * ⚠️ **« Il manque : … » a été remplacé par une CONSIGNE.** Me Vaval a jugé la liste pédante :
 * publiquement il n'y a que deux champs, on nomme donc le premier qui manque, à l'impératif.
 * Le formulaire du PORTAIL garde `submitMissingPrefix` et sa liste — il peut y énumérer un
 * kilométrage et une question de suite.
 *
 * ⚠️ **Sans JavaScript, les deux `<input>` sont rendus quand même** — avec leurs valeurs, que
 * le serveur pose — et le `GET` du héros part avec elles ; seule la ligne « Indiquer… », qui
 * suit la frappe, disparaît.
 *
 * ⚠️ **Le libellé de la date est celui des SURFACES PUBLIQUES** — « Date de réception de
 * l'acte ». Le héros disait « Date de départ » : sur une page qui ne calcule plus que sur un
 * acte reçu, c'était plus vague que la réalité. Dans l'espace connecté, où le point de départ
 * varie avec l'entrée du répertoire (signification, prononcé, dépôt…), le libellé reste
 * « Point de départ » : y écrire « réception » serait faux.
 */
export function DelaisHeroChamps({
  t,
  valeurs = { d: '', n: '' },
  erreur = null,
}: {
  t: Dictionary
  /** Ce que le serveur a relu de l'adresse — vide avant la première soumission. */
  valeurs?: { d: string; n: string }
  /** Un refus de la lecture publique (date impossible, `f` fabriqué, slug demandé…). */
  erreur?: string | null
}) {
  const d = t.delais
  const [date, setDate] = useState(valeurs.d)
  const [jours, setJours] = useState(valeurs.n)

  // § 6.2, point 7 — ce qui manque, ÉCRIT. Le MÊME calcul que `DelaiFormPublic` : un bouton
  // qui part muet sur deux champs vides est un cul-de-sac.
  const manque = !date.trim() ? d.missingDate : !jours.trim() ? d.missingDays : null

  return (
    <>
      {/* Un refus se lit LÀ OÙ LA SAISIE EST, jamais à la place de la date : sur l'accueil,
          l'aire du résultat reste vide et c'est le formulaire qui parle. */}
      {erreur && (
        <div className="mb-4">
          <ChampErreur prefixe={t.common.erreur} id="hero-delai-erreur">
            {messageErreur(t, erreur)}
          </ChampErreur>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <DelaiDateField
          id="hero-delai-depart"
          t={t}
          valeur={date}
          onChange={setDate}
          label={d.publicDateLabel}
          erreurId={erreur ? 'hero-delai-erreur' : undefined}
          invalide={erreur === 'dateImpossible'}
        />

        <div>
          <label htmlFor="hero-delai-n" className="block text-sm font-medium text-ank">
            {d.publicDaysLabel}
          </label>
          <input
            id="hero-delai-n"
            name="n"
            type="number"
            inputMode="numeric"
            min={0}
            max={3650}
            step={1}
            value={jours}
            onChange={(e) => setJours(e.target.value)}
            aria-describedby="hero-delai-n-aide"
            className="mt-1 min-h-[44px] w-full max-w-[10rem] rounded-lg border border-liy bg-white px-3 font-mono text-sm text-ank"
          />
          <p id="hero-delai-n-aide" className="mt-1 text-xs text-grafit">
            {d.publicDaysHint}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <button
          type="submit"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-wouj px-7 text-[15px] font-semibold text-white transition hover:brightness-95"
        >
          {d.heroSubmit}
          <span aria-hidden="true">→</span>
        </button>
        {manque && <p className="mt-2 text-sm text-ank">{manque}</p>}
      </div>
    </>
  )
}
