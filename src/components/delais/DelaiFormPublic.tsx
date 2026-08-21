'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'
import { ChampErreur } from '../ChampErreur'
import { DelaiDateField } from './DelaiDateField'
import { messageErreur } from './messages'

/**
 * LA SAISIE PUBLIQUE — **DEUX CHAMPS, ET DEUX SEULEMENT.**
 *
 * La date de réception de l'acte, le nombre de jours francs qu'il indique. Pas de menu du
 * répertoire, pas de lien « voir tout le répertoire », pas de sélecteur de code, pas de
 * filtre, pas de kilométrage, pas de question de suite. Le répertoire des 393 délais — ses
 * entrées, leurs libellés, leurs durées, leurs fondements — reste ENTIER dans l'espace
 * connecté (`DelaiForm`), et la route qui le sert exige désormais une session.
 *
 * ⚠️ **Ce n'est pas une affaire d'écran.** Cacher le menu tout en laissant la page servir
 * `?e=<slug>` aurait rendu le répertoire une ligne à la fois, à qui itère les slugs :
 * `calculPublic()` refuse donc tout slug en accès public (`repertoireReserve`, 401).
 *
 * ⚠️ **Le formulaire n'émet ni `e`, ni `f`.** L'entrée est toujours le genre « Autre » du
 * § 4.12 et le régime est toujours FRANC — c'est ce que dit le libellé du champ. Les poser en
 * champs cachés les ferait apparaître dans l'adresse sans rien y ajouter ; le serveur les
 * connaît par l'accès, qui, lui, ne se falsifie pas depuis l'URL.
 *
 * ⚠️ **Conséquence de droit, écrite sur la page.** Publiquement on ne calcule que des délais
 * FRANCS, et le calcul y est **franc PUR** — départ + N + 1, sans prorogation, sans lecture
 * nommée, sans jour praticable (`franc-pur.ts`, décision de Me Vaval du 20 août 2026). La page
 * énonce donc la règle qu'elle applique, et rien de plus.
 *
 * C'est un `<form method="get">` : il navigue, il ne requête pas, et il fonctionne script
 * désactivé — la page rend le résultat côté serveur.
 */
export function DelaiFormPublic({
  locale,
  t,
  action,
  valeurs,
  erreur,
}: {
  locale: Locale
  t: Dictionary
  /** `/fr/delais` — l'URL de la surface, jamais une constante. */
  action: string
  valeurs: { d: string; n: string }
  erreur?: string | null
}) {
  const d = t.delais
  const [date, setDate] = useState(valeurs.d)
  const [jours, setJours] = useState(valeurs.n)

  /**
   * § 6.2, point 7 — ce qui manque, ÉCRIT. Un bouton grisé muet est un cul-de-sac.
   *
   * ⚠️ **UNE CONSIGNE, PAS UN INVENTAIRE** (Me Vaval, 20 août 2026). La ligne composait
   * « Il manque : Date de réception de l'acte · Nombre de jour(s) francs » — le préfixe, puis
   * les deux libellés recopiés, séparés d'un point médian. On nomme désormais le PREMIER champ
   * vide, à l'impératif : les deux champs vides, la ligne dit exactement la phrase demandée.
   * Le formulaire du PORTAIL, lui, garde `submitMissingPrefix` et sa liste — il peut y
   * énumérer un kilométrage manquant et une question de suite sans réponse.
   */
  const manque = !date.trim() ? d.missingDate : !jours.trim() ? d.missingDays : null

  return (
    <form method="get" action={action} className="flex flex-col gap-5">
      {erreur && (
        <ChampErreur prefixe={t.common.erreur} id="delai-erreur">
          {messageErreur(t, erreur)}
        </ChampErreur>
      )}

      <div className="rounded-xl border border-liy bg-white p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* 1 — LA DATE DE RÉCEPTION. Champ natif : l'icône du navigateur, rien de plus. */}
          <div>
            {/**
             * ⚠️ **UN RENVOI ARIA POINTE SUR UN ÉLÉMENT QUI EXISTE, ou il ne pointe pas.**
             * La condition était `erreur ? 'delai-erreur-champ' : undefined` — pour TOUTE
             * erreur —, alors que le `<p id="delai-erreur-champ">` ci-dessous n'est rendu que
             * sur `dateImpossible`. Sur `repertoireReserve` (le permalien `?e=<slug>` d'avant
             * la fermeture, c'est-à-dire le cas le plus courant), `francSeulement`,
             * `autreIncomplet`, `invalidFields` ou `rate`, le champ sortait avec
             * `aria-describedby="delai-depart-format delai-erreur-champ"` : une cible
             * introuvable, donc RIEN d'annoncé à la prise de focus. On renvoie alors au
             * bandeau `ChampErreur`, qui porte `id="delai-erreur"` dès qu'il y a une erreur.
             *
             * `aria-invalid`, lui, ne suit QUE `dateImpossible` : un refus qui porte sur `e`
             * ou sur `f` ne rend pas la date fautive.
             */}
            <DelaiDateField
              t={t}
              valeur={date}
              onChange={setDate}
              label={d.publicDateLabel}
              erreurId={erreur === 'dateImpossible' ? 'delai-erreur-champ' : erreur ? 'delai-erreur' : undefined}
              invalide={erreur === 'dateImpossible'}
            />
            {/* § 6.2 — le message une SECONDE fois, court, sous le champ concerné. */}
            {erreur === 'dateImpossible' && (
              <p id="delai-erreur-champ" className="mt-1 text-sm font-medium text-ank">
                {messageErreur(t, erreur)}
              </p>
            )}
          </div>

          {/* 2 — LE NOMBRE DE JOURS FRANCS, saisi à la main. */}
          <div>
            <label htmlFor="delai-n" className="block text-sm font-medium text-ank">
              {d.publicDaysLabel}
            </label>
            <input
              id="delai-n"
              name="n"
              type="number"
              inputMode="numeric"
              min={0}
              max={3650}
              step={1}
              value={jours}
              onChange={(e) => setJours(e.target.value)}
              aria-describedby="delai-n-aide"
              className="mt-1 min-h-[44px] w-full max-w-[10rem] rounded-lg border border-liy bg-white px-3 font-mono text-sm text-ank"
            />
            <p id="delai-n-aide" className="mt-1 text-xs text-grafit">
              {d.publicDaysHint}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <button
            type="submit"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-wouj px-6 text-[15px] font-semibold text-white transition hover:brightness-95"
          >
            {d.submit}
          </button>
          {manque && <p className="mt-2 text-sm text-ank">{manque}</p>}
        </div>
      </div>

      {/* 3 — LA RÈGLE DE DROIT, dans les mots de Me Vaval, et la MÊME clé que le héros.
             ⚠️ L'ancienne note ajoutait « Si le dernier jour tombe un dimanche ou une fête
             légale, il est prorogé d'un jour (art. 991) » : c'est FAUX depuis que cette page
             calcule franc pur (`franc-pur.ts`). Ne pas la réintroduire. */}
      <p className="text-xs leading-relaxed text-grafit">{d.francRule}</p>
    </form>
  )
}
