'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'
import { articleAffiche } from '@/lib/delais/calcul'
import { champEntree } from '@/lib/delais/feries'
import type { CodeMenu, EntreeMenu } from '@/lib/delais/lecture-publique'
import { POSITIONS_DECOMPTE, SLUG_AUTRE } from '@/lib/delais/permalien'
import { ChampErreur } from '../ChampErreur'
import { DelaiDateField } from './DelaiDateField'
import { messageErreur } from './messages'

/**
 * § 6.2 — LA COLONNE DE SAISIE.
 *
 * ⚠️ **C'est un `<form method="get">`, et il fonctionne sans JavaScript.** Il ne fait pas de
 * requête : il NAVIGUE vers la même page avec ses paramètres, et la page rend le résultat
 * côté serveur. Trois conséquences voulues :
 *   1. le résultat existe script désactivé, imprimable et partageable ;
 *   2. l'adresse de la barre EST le permalien — pas une URL décorative posée à côté d'un
 *      résultat obtenu autrement ;
 *   3. il n'y a **aucun second chemin de calcul** dans le navigateur, donc aucune divergence
 *      possible avec les 217 tests du moteur.
 *
 * ⚠️ **Le formulaire n'émet ni `r`, ni `c`, ni `w`.** Ces trois versions sont ce que la
 * plateforme a RETENU au moment du calcul : c'est le résultat qui les fixe et le permalien
 * qui les porte. Les émettre depuis un champ caché, c'est laisser un formulaire périmé
 * demander une révision qui n'existe plus.
 *
 * ⚠️ **Les entrées non calculables restent au menu**, distinguées par un libellé ÉCRIT
 * (« Ne produit pas de date ») et jamais par une couleur : c'est le refus motivé qui informe,
 * et les cacher ferait croire que l'article n'existe pas.
 */

type Props = {
  locale: Locale
  t: Dictionary
  /** L'action du formulaire : `/fr/delais` en public, `/fr/outils/delais` connecté. */
  action: string
  codes: CodeMenu[]
  /** Ce que porte l'URL — pour que le formulaire se rouvre sur la saisie précédente. */
  valeurs: {
    d: string
    e: string
    km: string[]
    sup: string
    n: string
    f: string
    src: string
  }
  /** Code d'erreur rendu par la lecture des paramètres, s'il y en a un. */
  erreur?: string | null
}

const remplacer = (modele: string, valeurs: Record<string, string | number>): string =>
  Object.entries(valeurs).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v)), modele)

/**
 * § 8.2 — LE RÉGIME, DANS LA LANGUE DE L'ÉCRAN. `LIBELLE_REGIME` est en français seulement :
 * « Délai franc » et « Délai ordinaire » sortaient tels quels dans les options anglaises et
 * créoles, à côté d'un « Does not produce a date » traduit — un libellé à moitié dans chaque
 * langue. Les quatre clés existent déjà dans les trois locales.
 */
export function libelleRegime(e: { regime: string; regimeIncertain: boolean }, t: Dictionary): string {
  if (e.regime === 'A_VERIFIER') return t.delais.regimeAVerifier
  if (e.regimeIncertain) return t.delais.regimeIncertain
  return e.regime === 'FRANC' ? t.delais.regimeFranc : t.delais.regimeOrdinaire
}

/**
 * § 4.5 bis — l'`articleContexte` des 8 homonymes est un empilement de titres collés sans
 * ponctuation (« Chapitre III — Des conflits collectifs de travail Règlements amiables
 * Conciliation ») : dans un `<select>` mobile, l'option dépassait 170 caractères. On garde le
 * DERNIER niveau, celui qui distingue réellement les deux homonymes, et on borne.
 */
export function contexteCourt(contexte: string): string {
  const morceaux = contexte.split('—').map((m) => m.trim()).filter(Boolean)
  const dernier = morceaux.at(-1) ?? contexte
  if (dernier.length <= 80) return dernier
  // On coupe sur une frontière de MOT : « Co… » ne distingue rien.
  const coupe = dernier.slice(0, 80)
  return `${coupe.slice(0, coupe.lastIndexOf(' '))}…`
}

/** L'intitulé d'une option : « art. N — section — objet — durée — régime [— refus] ». */
function libelleOption(e: EntreeMenu, t: Dictionary, locale: Locale): string {
  // ⚠️ `articleAffiche`, jamais `\`Art. ${e.article}\`` : 135 des 393 lignes portent DÉJÀ leur
  // préfixe (« Art. 164 », « Arts. 30–34 »), d'où « Art. Art. 164 » dans le menu (défaut 13).
  const morceaux = [articleAffiche(e.article)]
  // § 4.5 bis — deux options « art. 172 » nues, à cinq lignes d'écart, sont un piège de
  // saisie. La section fait partie du libellé, pas d'une infobulle.
  if (e.articleContexte) morceaux.push(contexteCourt(e.articleContexte))
  // § 8.2 — l'objet est traduit dès que la rédaction a coché `traductionRelue` ; sinon repli
  // sur le français. `dureeTexte`, lui, ne l'est JAMAIS : c'est le mot à mot du répertoire.
  morceaux.push(champEntree(e, e.objetFr, e.objetEn, e.objetHt, locale))
  morceaux.push(e.dureeTexte)
  // § 6.2 point 2 et § 4.7 — le régime est AJOUTÉ, jamais remplacé : les quatre lignes
  // `A_VERIFIER` sont toutes non calculables, et n'affichaient donc que « Ne produit pas de
  // date » là où l'avocate compare.
  morceaux.push(libelleRegime(e, t))
  if (!e.calculable) morceaux.push(t.delais.entryNotCalculable)
  return morceaux.join(' — ')
}

export function DelaiForm({ locale, t, action, codes, valeurs, erreur }: Props) {
  const d = t.delais
  const toutes = useMemo(
    () => codes.flatMap((c) => c.tableaux.flatMap((tab) => tab.entrees.map((e) => ({ e, code: c.code })))),
    [codes],
  )
  const choisieInitiale = toutes.find((x) => x.e.slug === valeurs.e)

  /**
   * § 6.2 — LE SCRIPT TOURNE-T-IL ? Le rendu serveur doit être celui du chemin SANS
   * JavaScript (tous les codes dans le menu) ; l'hydratation active ensuite les commodités.
   * Un `useState(false)` levé au montage est le seul moyen de rendre les deux honnêtement.
   */
  const [script, setScript] = useState(false)
  useEffect(() => setScript(true), [])

  const [dateTexte, setDateTexte] = useState(valeurs.d)
  const [code, setCode] = useState<string>(choisieInitiale?.code ?? codes[0]?.code ?? 'CPC')
  /**
   * § 3 (Me Vaval, 20 août 2026) — **LA SAISIE MANUELLE EST LA PREMIÈRE OPTION DU MENU, ET
   * SON ÉTAT INITIAL.** L'option vide « Choisissez un article… » a disparu : elle occupait le
   * premier rang, reléguait « Autre » au second et ne produisait qu'un champ de plus à
   * réclamer dans « Il manque : ». Le serveur dit déjà la même chose de son côté —
   * `PARAMS_CALCUL.e` vaut `SLUG_AUTRE` par défaut quand `e` est absent.
   *
   * ⚠️ Le repli est OBLIGATOIRE : un `<select>` contrôlé dont la valeur ne correspond à aucune
   * option affiche la première tout en soumettant autre chose.
   */
  const [slug, setSlug] = useState<string>(valeurs.e || SLUG_AUTRE)
  const [filtre, setFiltre] = useState('')
  const [km, setKm] = useState<string[]>([valeurs.km[0] ?? '', valeurs.km[1] ?? ''])
  const [sup, setSup] = useState(valeurs.sup)
  const [nJours, setNJours] = useState(valeurs.n)
  const [franc, setFranc] = useState(valeurs.f)
  const [source, setSource] = useState(valeurs.src)

  const entree = toutes.find((x) => x.e.slug === slug)?.e ?? null
  const estAutre = slug === SLUG_AUTRE
  const codeCourant = codes.find((c) => c.code === code) ?? codes[0]

  /**
   * ⚠️ **LES TROIS CODES SONT DANS LE MÊME `<select>`.**
   *
   * Le sélecteur de code était un `<input type="radio">` sans `name` et sans `value` : il ne
   * se soumet pas, il ne pilote qu'un `useState`. Or la liste n'était peuplée que des entrées
   * de `codeCourant` — script désactivé, 161 des 393 entrées (Travail et Civil) étaient
   * INATTEIGNABLES, et le champ « Filtrer la liste » inopérant, pendant que le docblock
   * affirmait trois fois le contraire.
   *
   * Le `<select>` porte donc TOUTES les entrées, groupées par code puis par tableau. Le
   * sélecteur de code et le filtre ne sont plus que des commodités CLIENT : ils réduisent la
   * liste quand le script tourne, et leur absence ne retire rien.
   */
  const filtreNormalise = filtre.trim().toLowerCase()
  const groupes = codes.flatMap((c) =>
    c.tableaux
      .map((tab) => ({
        cle: `${c.code}-${tab.numero}`,
        // Sans script, `code` vaut le premier code : on n'a alors AUCUN filtre, et tout est là.
        masque: script && c.code !== code,
        libelle: [c.abrege, tab.titreFr ?? remplacer(d.entryGroupTableau, { n: tab.numero })]
          .filter(Boolean)
          .join(' — '),
        entrees: filtreNormalise
          ? tab.entrees.filter((e) =>
              `${e.article} ${e.articleContexte ?? ''} ${e.objetFr} ${e.dureeTexte}`
                .toLowerCase()
                .includes(filtreNormalise),
            )
          : tab.entrees,
      }))
      .filter((g) => g.entrees.length > 0),
  )
  const visibles = groupes.filter((g) => !g.masque)
  const nbFiltrees = visibles.reduce((n, g) => n + g.entrees.length, 0)

  // § 6.2, point 7 — ce qui manque, ÉCRIT. Un bouton grisé muet est un cul-de-sac ; la liste
  // est calculée ici pour l'affichage, et le serveur la recalcule de son côté (il est seul à
  // décider) : sans JavaScript, c'est la sienne qu'on lit.
  const manque: string[] = []
  if (!dateTexte.trim()) manque.push(d.startLabelDefault)
  // ⚠️ Plus de contrôle « aucune entrée choisie » : le menu n'a plus d'option vide, et son
  // état initial est la saisie manuelle (`SLUG_AUTRE`). `slug` ne peut donc plus être vide.
  if (estAutre) {
    if (!nJours.trim()) manque.push(d.otherDaysLabel)
    if (!source.trim()) manque.push(d.otherSourceLabel)
    // Aucune position n'est cochée d'avance : le commutateur figure dans « Il manque : »
    // tant que l'utilisatrice n'a pas dit COMMENT elle veut qu'on compte.
    if (!franc) manque.push(d.countingLegend)
  }
  if (entree?.supplement?.obligatoire && !sup) manque.push(d.supplementLegend)
  if (entree && entree.nbDistances > 0) {
    for (let i = 0; i < entree.nbDistances; i++) {
      if (km[i].trim() === '') manque.push(entree.nbDistances === 2 ? (i === 0 ? d.kmLabelFirst : d.kmLabelSecond) : d.kmLabel)
    }
  }

  /**
   * § 6.2 — LE FOCUS VA AU PREMIER CHAMP FAUTIF. Le résumé en tête portait bien `role="alert"`
   * et le champ son `aria-describedby`, mais rien ne déplaçait le focus, et sur un formulaire
   * long la faute et le champ n'étaient pas au même endroit.
   */
  const champDate = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!erreur) return
    champDate.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [erreur])

  const libelleDepart = entree
    ? champEntree(entree, entree.pointDepartFr, entree.pointDepartEn, entree.pointDepartHt, locale)
    : d.startLabelDefault
  // La note de l'art. 996 ne s'affiche que quand le point de départ EST une signification :
  // la coller partout la banaliserait, et elle serait fausse sur un délai qui court d'un
  // dépôt ou d'une notification.
  const departEstSignification = /significat/i.test(libelleDepart)

  return (
    <form method="get" action={action} className="flex flex-col gap-5">
      {erreur && (
        <ChampErreur prefixe={t.common.erreur} id="delai-erreur">
          {messageErreur(t, erreur)}
        </ChampErreur>
      )}

      {/* 1 — LE POINT DE DÉPART, avec le libellé de l'entrée choisie. */}
      <div ref={champDate}>
        <DelaiDateField
          t={t}
          valeur={dateTexte}
          onChange={setDateTexte}
          label={libelleDepart}
          erreurId={erreur ? 'delai-erreur-champ' : undefined}
          invalide={erreur === 'dateImpossible'}
        />
        {/* § 6.2 — le message une SECONDE fois, court, sous le champ concerné : sur un
            formulaire long, un résumé en tête ne dit pas OÙ corriger. */}
        {erreur === 'dateImpossible' && (
          <p id="delai-erreur-champ" className="mt-1 text-sm font-medium text-ank">
            {messageErreur(t, erreur)}
          </p>
        )}
        {departEstSignification && (
          <details className="mt-2 rounded-lg border border-liy bg-white px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-ank">C. pr. civ., art. 996</summary>
            <p className="mt-1.5 text-xs leading-relaxed text-grafit">{d.significationNote}</p>
          </details>
        )}
      </div>

      {/* 2 — LE CODE, puis L'ENTRÉE. Le code n'est PAS soumis : il ne fait que réduire la
             liste (aucun `name`).

             ⚠️ **LE TITRE EST DANS LA BOÎTE, PAS DANS SON BORD** (21 août 2026). Un `<legend>`
             n'est pas posé par la feuille de style mais par le NAVIGATEUR, dans une encoche du
             bord supérieur — et l'encoche n'est pas la même partout : Chrome interrompt le
             trait autour du mot, d'autres moteurs posent le titre AU-DESSUS d'un cadre qui
             reste fermé, et le titre paraît alors sortir de son encadré. Aucune propriété CSS
             ne rend ce placement déterministe : `float: left; width: 100%` — le contournement
             habituel — se fait doubler ici par les conteneurs `flex`, qui n'entourent pas un
             flottant mais se serrent à côté (essayé, mesuré, abandonné).
             On renonce donc à `<fieldset>` : un `<div role="group" aria-labelledby>` porte le
             MÊME nom accessible, et son titre est un bloc ordinaire que la feuille de style
             place où elle veut. Le groupe reste un groupe pour les lecteurs d'écran ; le
             `disabled` en cascade du `<fieldset>` n'était pas utilisé.

             ⚠️ Et `min-w-0` sur le cadre : un `<fieldset>` porte d'origine
             `min-inline-size: min-content`, ce qui l'autorise à déborder de sa colonne quand
             son contenu ne peut pas rétrécir. Mesuré ici : 155 px et 258 px de min-content pour
             une colonne de 272 px au plus étroit — ça passe aujourd'hui, ça ne passerait plus
             au premier libellé un peu long. */}
      <div role="group" aria-labelledby="delai-grp-code" className="min-w-0 rounded-xl border border-liy bg-white p-4">
        <p id="delai-grp-code" className="mb-3 text-sm font-medium text-ank">{d.codeLabel}</p>
        {/* ⚠️ **Des BOUTONS, pas des radios.** Trois `<input type="radio">` sans `name` ne
            forment aucun groupe : les flèches ne les parcourent pas et chacun est tabulable
            séparément. Ce filtre ne se soumet pas — il ne fait que réduire la liste —, donc
            ce sont des commandes, et une commande est un bouton. Le groupe porte son nom. */}
        <div role="group" aria-label={d.codeLabel} className="flex flex-wrap gap-2">
          {codes.map((c) => (
            <button
              key={c.code}
              type="button"
              aria-pressed={script && c.code === code}
              onClick={() => setCode(c.code)}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg border px-3 text-sm transition ${
                script && c.code === code ? 'border-chabon bg-pil font-semibold text-ank' : 'border-liy text-grafit hover:bg-pil'
              }`}
            >
              {c.code === 'CPC' ? d.codeCPC : c.code === 'TRAVAIL' ? d.codeTRAVAIL : d.codeCIVIL}
              <span className="font-mono text-[11px] text-grafit">{c.nbCalculables}/{c.nbEntrees}</span>
            </button>
          ))}
        </div>

        <div className="mt-4">
          <label htmlFor="delai-filtre" className="block text-sm font-medium text-ank">
            {d.entryFilterLabel}
          </label>
          <input
            id="delai-filtre"
            type="search"
            value={filtre}
            onChange={(e) => setFiltre(e.target.value)}
            placeholder={d.entryFilterPlaceholder}
            className="mt-1 min-h-[44px] w-full rounded-lg border border-liy bg-white px-3 text-sm text-ank"
          />
          <p aria-live="polite" className="mt-1 text-xs text-grafit">
            {remplacer(d.entryResultsCount, { n: nbFiltrees })}
          </p>
        </div>

        <div className="mt-3">
          <label htmlFor="delai-entree" className="block text-sm font-medium text-ank">
            {d.entryLabel}
          </label>
          <select
            id="delai-entree"
            name="e"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="mt-1 min-h-[44px] w-full rounded-lg border border-liy bg-white px-2 text-sm text-ank"
          >
            {/* § 3 — LA SAISIE MANUELLE EN TÊTE, avant tout groupe de code, et hors
                `optgroup` : elle n'appartient à aucun code. C'est aussi l'option retenue
                quand rien n'a été choisi — il n'y a plus d'option vide au-dessus d'elle. */}
            <option value={SLUG_AUTRE}>{d.entryOther}</option>
            {visibles.map((g) => (
              // Les 10 tableaux du C. pr. civ. n'ont pas de titre d'origine : on écrit
              // « Tableau n » depuis les clés i18n, on n'en INVENTE pas.
              <optgroup key={g.cle} label={g.libelle}>
                {g.entrees.map((e) => (
                  <option key={e.slug} value={e.slug}>
                    {libelleOption(e, t, locale)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {nbFiltrees === 0 && <p className="mt-1 text-xs text-ank">{d.entryFilterNone}</p>}
        </div>

        {/* 3 — LE RÉGIME, affiché DÈS LA SÉLECTION, avant tout calcul, avec son fondement :
               un régime sans son texte est une affirmation sans source. */}
        {entree && (
          <div className="mt-4 rounded-lg border border-liy bg-koton px-3 py-2.5">
            <p className="text-sm font-medium text-ank">
              {d.regimeLabel} : {entree.regimeLibelle}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-grafit">{entree.regimeFondement}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-grafit">
              <span className="font-medium text-ank">{d.prorogationLabel} :</span> {entree.prorogationFondement}
            </p>
            {/* § 2 — LE COMMUTATEUR N'A PAS COURS ICI, ET ON L'ÉCRIT. Le champ `f` n'est pas
                rendu sur une entrée du répertoire (rien à soumettre) et `calculPublic()`
                refuse un `f` fabriqué à la main : « rends-le impossible, pas seulement
                caché ». La phrase dit pourquoi il n'y a rien à choisir, plutôt que de
                laisser croire à un réglage oublié. */}
            <p className="mt-1.5 text-xs leading-relaxed text-grafit">{d.countingFixedByText}</p>
            {!entree.calculable && (
              <p className="mt-1.5 text-xs font-medium text-ank">{d.entryNotCalculable}</p>
            )}
          </div>
        )}
      </div>

      {/* 4 — LE(S) KILOMÉTRAGE(S). Deux champs pour les art. 517 et 586. */}
      {entree && entree.nbDistances > 0 && (
        <div role="group" aria-labelledby="delai-grp-km" className="min-w-0 rounded-xl border border-liy bg-white p-4">
          <p id="delai-grp-km" className="mb-3 text-sm font-medium text-ank">{d.kmLabel}</p>
          {entree.distanceAideFr && <p className="text-xs leading-relaxed text-grafit">{entree.distanceAideFr}</p>}
          {entree.nbDistances === 2 && entree.distanceDoubleFr && (
            <p className="mt-1 text-xs leading-relaxed text-grafit">{entree.distanceDoubleFr}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-3">
            {Array.from({ length: entree.nbDistances }, (_, i) => (
              <div key={i}>
                <label htmlFor={`delai-km-${i}`} className="block text-xs font-medium text-ank">
                  {entree.nbDistances === 2 ? (i === 0 ? d.kmLabelFirst : d.kmLabelSecond) : d.kmLabel}
                </label>
                {/* DEUX champs portent le MÊME nom `km` : la page les relit avec `getAll` et
                    les joint par une virgule, dans l'ordre. Un `km2` aurait été un paramètre
                    de plus, absent du permalien canonique du § 6.3. */}
                <input
                  id={`delai-km-${i}`}
                  name="km"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={20000}
                  step={1}
                  value={km[i]}
                  onChange={(e) => setKm((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                  aria-describedby="delai-km-aide"
                  className="mt-1 min-h-[44px] w-32 rounded-lg border border-liy bg-white px-3 font-mono text-sm text-ank"
                />
              </div>
            ))}
          </div>
          <p id="delai-km-aide" className="mt-2 text-xs text-grafit">
            {d.kmHint} {d.kmYouEnter}
          </p>
        </div>
      )}

      {/* 5 — LA QUESTION DE SUITE (art. 74, § 4.5). */}
      {entree?.supplement && (
        <div role="group" aria-labelledby="delai-grp-sup" className="min-w-0 rounded-xl border border-liy bg-white p-4">
          <p id="delai-grp-sup" className="mb-3 text-sm font-medium text-ank">{d.supplementLegend}</p>
          <p className="text-sm text-ank">{entree.supplement.questionFr}</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {entree.supplement.options.map((o) => (
              <label key={o.cle} className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-ank">
                <input
                  type="radio"
                  name="sup"
                  value={o.cle}
                  checked={sup === o.cle}
                  onChange={() => setSup(o.cle)}
                  className="h-4 w-4 accent-chabon"
                />
                <span>
                  {o.libelleFr}
                  {o.fondement && <span className="ml-1 text-xs text-grafit">— {o.fondement}</span>}
                  {o.noteFr && <span className="ml-1 text-xs text-grafit">{o.noteFr}</span>}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* 6 — « AUTRE » (§ 4.12) : le nombre de jours, la nature du délai, et LE MODE DE
             DÉCOMPTE — trois réponses, pas une.

             ⚠️ **Ce bloc n'est rendu QUE sur la saisie manuelle**, et c'est ce qui rend le
             commutateur inapplicable à une entrée du répertoire : sans lui, aucun `f` n'est
             soumis. Ce n'est pas la garde qui compte — `calculPublic()` refuse un `f`
             fabriqué à la main —, mais c'en est la moitié visible. */}
      {estAutre && (
        <div role="group" aria-labelledby="delai-grp-autre" className="min-w-0 rounded-xl border border-liy bg-white p-4">
          <p id="delai-grp-autre" className="mb-3 text-sm font-medium text-ank">{d.otherLegend}</p>
          <div className="flex flex-wrap gap-4">
            <div>
              <label htmlFor="delai-n" className="block text-xs font-medium text-ank">{d.otherDaysLabel}</label>
              <input
                id="delai-n"
                name="n"
                type="number"
                inputMode="numeric"
                min={0}
                max={3650}
                step={1}
                value={nJours}
                onChange={(e) => setNJours(e.target.value)}
                className="mt-1 min-h-[44px] w-28 rounded-lg border border-liy bg-white px-3 font-mono text-sm text-ank"
              />
            </div>
            {/* ⚠️ `basis-56` et non `min-w-[14rem]` : une largeur PLANCHER ne cède jamais, et sous
                344 px de colonne le champ sortait du cadre de 10 px (mesuré). Une largeur de
                BASE demande les mêmes 14 rem et les rend quand la place manque. */}
            <div className="min-w-0 flex-1 basis-56">
              <label htmlFor="delai-src" className="block text-xs font-medium text-ank">{d.otherSourceLabel}</label>
              <input
                id="delai-src"
                name="src"
                type="text"
                maxLength={200}
                value={source}
                onChange={(e) => setSource(e.target.value)}
                aria-describedby="delai-src-aide"
                className="mt-1 min-h-[44px] w-full rounded-lg border border-liy bg-white px-3 text-sm text-ank"
              />
              <p id="delai-src-aide" className="mt-1 text-xs text-grafit">{d.otherSourceHint}</p>
            </div>
          </div>
          {/* LE COMMUTATEUR — deux positions, et rien qui suppose la troisième. */}
          <p id="delai-decompte" className="mt-4 text-sm font-medium text-ank">
            {d.countingLegend}
          </p>
          <div role="group" aria-labelledby="delai-decompte" className="mt-1.5 grid gap-2 sm:grid-cols-2">
            {/* ⚠️ Les positions viennent de `POSITIONS_DECOMPTE`, pas d'un littéral recopié :
                c'est le vocabulaire du permalien, et `ne-sais-pas` en est absent — il reste
                RELISIBLE (§ 6.3, les liens d'avant le commutateur) sans être proposé. */}
            {POSITIONS_DECOMPTE.map((v) => ({
              v,
              l: v === 'oui' ? d.countingClear : d.countingCalendar,
              r: v === 'oui' ? d.countingClearRule : d.countingCalendarRule,
            })).map((o) => (
              <label
                key={o.v}
                className={`flex min-h-[44px] cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition ${
                  franc === o.v ? 'border-chabon bg-pil' : 'border-liy bg-white hover:bg-pil'
                }`}
              >
                {/* ⚠️ **Le bouton radio reste VISIBLE.** C'est lui qui porte l'état — pas le
                    fond ni la bordure : Wouj et Vèt sont à 1,05:1, et un segment « allumé »
                    par la seule couleur ne dit rien à qui ne la distingue pas (§ 8.1). Deux
                    `<input type="radio">` de même `name` forment en outre un vrai groupe :
                    les flèches les parcourent, et le formulaire se soumet sans JavaScript. */}
                <input
                  type="radio"
                  name="f"
                  value={o.v}
                  checked={franc === o.v}
                  onChange={() => setFranc(o.v)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-chabon"
                />
                <span>
                  <span className={`block text-sm text-ank ${franc === o.v ? 'font-semibold' : 'font-medium'}`}>
                    {o.l}
                  </span>
                  {/* Chaque position porte SA RÈGLE, pas seulement son nom : « francs » et
                      « calendaires » diffèrent d'un jour, et un jour d'écart forclôt. */}
                  <span className="mt-0.5 block text-xs leading-relaxed text-grafit">{o.r}</span>
                </span>
              </label>
            ))}
          </div>
          {/* Un permalien d'avant le commutateur porte `f=ne-sais-pas` : il se rejoue à
              l'identique (§ 6.3), mais aucune des deux positions n'est la sienne. On l'écrit. */}
          {franc === 'ne-sais-pas' && (
            <p className="mt-2 text-xs leading-relaxed text-ank">{d.countingLegacyUnknown}</p>
          )}
        </div>
      )}

      {/* 7 — CALCULER. Le bouton dit ce qui manque ; il ne se contente pas de griser. */}
      <div>
        <button
          type="submit"
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-wouj px-6 text-[15px] font-semibold text-white transition hover:brightness-95"
        >
          {d.submit}
        </button>
        {manque.length > 0 && (
          <p className="mt-2 text-sm text-ank">
            <span className="font-semibold">{d.submitMissingPrefix}</span> {manque.join(' · ')}
          </p>
        )}
      </div>
    </form>
  )
}
