'use client'

import { useMemo } from 'react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { formatIso, isValidCivil, parseFrSaisie } from '@/lib/delais'

/**
 * § 8.3 — LE POINT DE DÉPART. **Un `<input type="date">` NATIF, et rien autour.**
 *
 * ⚠️ **Ce qui a été retiré, et pourquoi.** Le champ était un `<input type="text">` masqué
 * JJ/MM/AAAA flanqué d'un bouton « Ouvrir le calendrier » de 44 px, qui déployait une grille
 * de mois complète (piège de focus, tabindex glissant, feuille plein écran sous 640 px). La
 * cliente a jugé l'ensemble trop encombrant : « le lien doit être plus discret ». L'icône que
 * le navigateur pose lui-même dans un champ de date natif fait le même travail, sans occuper
 * la moitié de la ligne — et elle ouvre le calendrier du système, que l'utilisatrice connaît
 * déjà.
 *
 * ⚠️ **L'ancienne objection au champ natif tenait au FORMAT AFFICHÉ, pas à la valeur.** Un
 * champ natif affiche la date dans la locale du navigateur — un poste en anglais américain
 * montre `mm/dd/yyyy` — mais sa **valeur est toujours `AAAA-MM-JJ`**, quelle que soit la
 * locale, et c'est elle que le formulaire `GET` envoie. L'ambiguïté JJ/MM contre MM/JJ n'a
 * donc jamais lieu dans ce qui traverse le réseau : elle n'existait que dans un champ texte,
 * c'est-à-dire dans la forme qu'on abandonne ici. L'indication de format reste sous le champ,
 * mais elle **ne nomme plus les trois composantes** : le champ natif les montre déjà, et les
 * nommer revenait à les ordonner — ce que cette phrase disait justement ne pas faire.
 * `startFormatHint` vaut « Indiquer la date ; l'ordre affiché est celui de votre navigateur. »
 *
 * ⚠️ Cet en-tête avait SURVÉCU à la réécriture : il décrivait encore l'énumération
 * jour/mois/année que la cliente avait fait couper, et contredisait le commentaire de
 * `fr.ts` sur la même ligne de texte. C'est exactement ce que `surfaces-delais.test.ts`
 * (§ 8.3) existe pour empêcher — une sonde y balaie désormais cette phrase-ci aussi.
 *
 * ⚠️ **Le champ s'appelle `d` et il fonctionne sans JavaScript.** Le `GET` part avec
 * `d=2026-06-04` ; la page relit encore les deux formes (ISO et française) parce qu'un
 * permalien d'une autre origine, ou une adresse tapée à la main, peut porter du JJ/MM/AAAA.
 *
 * ⚠️ **Aucun `min` ni `max`.** La borne du 22 juin 1989 et l'horizon de dix ans sont des
 * refus MOTIVÉS et un avertissement écrit ; les confier à la validation native du navigateur
 * les remplacerait par une bulle générique, et l'utilisatrice ne saurait pas pourquoi.
 *
 * ⚠️ **Le focus est celui de la maison.** `globals.css` pose `*:focus-visible { outline: 2px
 * solid #414042; outline-offset: 2px }` : ce champ portait en plus la grappe
 * `focus-visible:outline-none focus-visible:ring-2`, dont la spécificité (0,2,0) l'emportait
 * sur `*` (0,1,0). Le liseré décalé devenait un anneau collé à la bordure, et le marqueur de
 * focus changeait d'allure au milieu de la page (AV-04, art. 2, correction 6).
 */

/**
 * ⚠️ **CE QU'UN CHAMP DE DATE NATIF PEUT RÉELLEMENT CONTENIR.** Le segment « année » accepte
 * jusqu'à SIX chiffres : taper les huit chiffres « 20260604 » d'affilée sur un poste dont le
 * gabarit est `aaaa-mm-jj` met 202606 dans l'année, 04 dans le mois, puis 01 dans le jour —
 * la valeur du DOM devient `202606-04-01`, que la spécification HTML tient pour une date
 * valide (« quatre chiffres OU PLUS »).
 *
 * `parseIso` n'en lit strictement que quatre : elle rendait `null`, le repli poussait `''`
 * dans l'attribut `value`, et React ÉCRASAIT la saisie — jour, mois et année disparaissaient
 * d'un seul coup, sans un mot, dans le seul champ que ce produit existe pour protéger. On
 * garde donc toute chaîne que le navigateur lui-même conserverait, et le refus reste MOTIVÉ,
 * prononcé par le serveur — comme pour la borne du 22 juin 1989.
 */
const FORME_NATIVE = /^(\d{4,6})-(\d{2})-(\d{2})$/

export function DelaiDateField({
  t,
  valeur,
  onChange,
  label,
  erreurId,
  invalide,
  id = 'delai-depart',
}: {
  t: Dictionary
  /** CONTRÔLÉ par le formulaire : lui seul sait si la saisie est complète (§ 6.2, point 7). */
  valeur: string
  onChange: (v: string) => void
  /** Libellé DYNAMIQUE : le `pointDepartFr` de l'entrée choisie (§ 6.2, 1). */
  label: string
  erreurId?: string
  invalide?: boolean
  /** Deux champs date ne peuvent pas partager un `id` : le héros a le sien. */
  id?: string
}) {
  const d = t.delais

  /**
   * On ne pousse dans `value` que ce qu'un champ natif CONSERVE — sinon React et le DOM
   * divergent, et la divergence se solde par un effacement silencieux. On convertit au
   * passage ce que l'URL peut porter (le JJ/MM/AAAA d'un lien tapé à la main).
   *
   * ⚠️ Une date IMPOSSIBLE (« 31/02/2026 ») laisse le champ vide : c'est voulu, et c'est
   * aussi ce que ferait le navigateur, qui refuse un 31 février. Le refus `dateImpossible`
   * s'affiche juste en dessous, et proposer une date voisine — le 1er ou le 3 mars — serait
   * très exactement l'erreur d'un jour que ce produit existe pour empêcher.
   */
  const iso = useMemo(() => {
    const brut = (valeur ?? '').trim()
    const m = FORME_NATIVE.exec(brut)
    // L'an zéro n'est pas une date pour un champ natif (« un nombre supérieur à 0 ») : il
    // serait effacé par le navigateur, donc il ne doit pas non plus sortir d'ici.
    if (m && Number(m[1]) >= 1) {
      const date = { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) }
      if (isValidCivil(date)) return brut
    }
    const fr = parseFrSaisie(valeur)
    return fr ? formatIso(fr) : ''
  }, [valeur])

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ank">
        {label}
      </label>
      <input
        id={id}
        name="d"
        type="date"
        autoComplete="off"
        value={iso}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={[`${id}-format`, erreurId].filter(Boolean).join(' ')}
        aria-invalid={invalide || undefined}
        className="mt-1 min-h-[44px] w-full max-w-[15rem] rounded-lg border border-liy bg-white px-3 font-mono text-sm text-ank"
      />
      <p id={`${id}-format`} className="mt-1 text-xs text-grafit">
        {d.startFormatHint}
      </p>
    </div>
  )
}
