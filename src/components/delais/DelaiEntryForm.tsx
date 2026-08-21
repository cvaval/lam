'use client'

import { useMemo, useState } from 'react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { calculer, dateEnChiffres, dateEnToutesLettres } from '@/lib/delais'
import type { CivilDate, Resultat } from '@/lib/delais'
import { versCalendrier, versEntreeDelai } from '@/lib/delais/depuis-base'
import { validerEntree } from '@/lib/delais/validation-admin'
import type { LigneAdmin, LigneFerieAdmin } from './DelaiAdmin'

/**
 * § 7.1 — LE FORMULAIRE D'UNE ENTRÉE, ET SON **APERÇU OBLIGATOIRE**.
 *
 * « On ne publie pas une règle de calcul sans avoir vu ce qu'elle rend. » L'aperçu calcule ce
 * que l'entrée produirait sur la date d'exemple du **lundi 2 mars 2026**, avec son raisonnement
 * complet, ses réserves et ses avertissements — et le bouton d'enregistrement reste fermé tant
 * que l'éditeur ne l'a pas lu.
 *
 * L'aperçu appelle **le même moteur** que la page publique, avec **le calendrier lu en base**
 * (`entreesCalendrier`) : c'est l'un des deux usages légitimes de ce paramètre (§ 4, ParamsCalcul).
 * Les validations, elles, sont celles de `validerEntree` — **la même fonction que la route**.
 * Deux copies de la règle finiraient par diverger, et c'est l'écran qui aurait tort en silence.
 */

/** § 7.1 — la date d'exemple. Un lundi, hors de toute fête : le calcul y est lisible. */
const DATE_EXEMPLE: CivilDate = { y: 2026, m: 3, d: 2 }

const KINDS = [
  'JOURS',
  'JOURS_PLUS_DISTANCE_KM',
  'JOURS_DISTANCE_NON_CHIFFREE',
  'HEURES',
  'MOIS',
  'ANNEES',
  'INDETERMINE',
] as const

const BOUTON = 'min-h-[44px] rounded-full px-4 py-2 text-xs font-semibold transition'
const CHAMP = 'mt-1 w-full rounded-lg border border-chabon/20 bg-white px-3 py-2 text-sm font-normal text-ank'
const ETIQUETTE = 'block text-xs font-semibold text-ank'

type Etat = Record<string, string | boolean>

function initial(l: LigneAdmin | null): Etat {
  return {
    code: l?.code ?? 'CPC',
    article: l?.article ?? '',
    articleContexte: l?.articleContexte ?? '',
    articleOccurrence: String(l?.articleOccurrence ?? 1),
    tableau: String(l?.tableau ?? 1),
    tableauTitreFr: l?.tableauTitreFr ?? '',
    ordre: String(l?.ordre ?? 0),
    objetFr: l?.objetFr ?? '',
    objetEn: l?.objetEn ?? '',
    objetHt: l?.objetHt ?? '',
    traductionRelue: l?.traductionRelue ?? false,
    dureeTexte: l?.dureeTexte ?? '',
    dureeFondementFr: l?.dureeFondementFr ?? '',
    kind: l?.kind ?? 'JOURS',
    jours: l?.jours == null ? '' : String(l.jours),
    nbDistances: String(l?.nbDistances ?? 0),
    distanceAideFr: l?.distanceAideFr ?? '',
    distanceDoubleFr: l?.distanceDoubleFr ?? '',
    supplementJson: l?.supplementJson ?? '',
    avisDistance: l?.avisDistance ?? '',
    citationArticle: l?.citationArticle ?? '',
    regime: l?.regime ?? 'FRANC',
    regimeIncertain: l?.regimeIncertain ?? false,
    regimeFondement: l?.regimeFondement ?? '',
    prorogation991: l?.prorogation991 ?? 'OUI',
    prorogationFondement: l?.prorogationFondement ?? '',
    motifRefusFr: l?.motifRefusFr ?? '',
    motifRefusEn: l?.motifRefusEn ?? '',
    motifRefusHt: l?.motifRefusHt ?? '',
    pointDepartFr: l?.pointDepartFr ?? '',
    pointDepartEn: l?.pointDepartEn ?? '',
    pointDepartHt: l?.pointDepartHt ?? '',
    sanctionFr: l?.sanctionFr ?? '',
    sanctionEn: l?.sanctionEn ?? '',
    sanctionHt: l?.sanctionHt ?? '',
  }
}

/** L'état du formulaire devient le corps de la requête — et l'objet que l'on valide. */
function versChamps(e: Etat) {
  const s = (k: string) => String(e[k] ?? '').trim()
  const nOuNull = (k: string) => (s(k) === '' ? null : Number(s(k)))
  return {
    code: s('code'),
    article: s('article'),
    articleContexte: s('articleContexte') || null,
    articleOccurrence: Number(s('articleOccurrence') || '1'),
    tableau: Number(s('tableau') || '1'),
    tableauTitreFr: s('tableauTitreFr') || null,
    ordre: Number(s('ordre') || '0'),
    objetFr: s('objetFr'),
    objetEn: s('objetEn'),
    objetHt: s('objetHt'),
    traductionRelue: Boolean(e.traductionRelue),
    dureeTexte: s('dureeTexte'),
    dureeFondementFr: s('dureeFondementFr') || null,
    kind: s('kind'),
    jours: nOuNull('jours'),
    nbDistances: Number(s('nbDistances') || '0'),
    distanceAideFr: s('distanceAideFr') || null,
    distanceDoubleFr: s('distanceDoubleFr') || null,
    supplementJson: s('supplementJson') || null,
    avisDistance: s('avisDistance') || null,
    citationArticle: s('citationArticle') || null,
    regime: s('regime'),
    regimeIncertain: Boolean(e.regimeIncertain),
    regimeFondement: s('regimeFondement'),
    prorogation991: s('prorogation991'),
    prorogationFondement: s('prorogationFondement'),
    motifRefusFr: s('motifRefusFr') || null,
    motifRefusEn: s('motifRefusEn') || null,
    motifRefusHt: s('motifRefusHt') || null,
    pointDepartFr: s('pointDepartFr'),
    pointDepartEn: s('pointDepartEn'),
    pointDepartHt: s('pointDepartHt'),
    sanctionFr: s('sanctionFr') || null,
    sanctionEn: s('sanctionEn') || null,
    sanctionHt: s('sanctionHt') || null,
  }
}

/**
 * § 7.1 — **CE QUE L'APERÇU CALCULE, ET CE QU'IL REFUSE DE CALCULER.** Extrait du composant
 * pour être testable sans navigateur : c'est une décision de droit déguisée en détail
 * d'affichage, et elle mérite un test.
 *
 * ⚠️ **AUCUN REPLI SUR LE CALENDRIER DU CODE** (correctif du 20 août 2026, soir). L'appel
 * portait `entreesCalendrier: calendrier.ok ? calendrier.valeur : undefined`, sous le
 * commentaire « l'aperçu montre ce que rendrait le calendrier TEL QU'IL EST EN BASE ». Or
 * `undefined` fait retomber `calculer()` sur `calendrier(VERSION_CALENDRIER_COURANTE)`
 * (`calcul.ts`) — le calendrier du CODE. Tant que la constante valait 1, le repli coïncidait
 * avec la base et le commentaire était vrai ; depuis qu'elle vaut 2 et que la base est restée
 * en 1, il montrerait à l'éditeur une date calculée sous un calendrier qui n'est PAS en
 * vigueur — et rien à l'écran ne le dirait, l'aperçu n'affichant pas le numéro de version.
 * L'écart se refermera à `--apply`, mais il est ouvert dès maintenant et pour toute la durée
 * d'attente. Un aperçu qu'on ne peut pas calculer sur les données réelles ne doit pas être
 * calculé sur d'autres : on refuse, et on dit pourquoi.
 */
export function apercuDeLEntree(
  champs: ReturnType<typeof versChamps>,
  feries: readonly LigneFerieAdmin[],
  identite: { slug: string; codeLibelle: string; revision: number },
): { ok: true; resultat: Resultat } | { ok: false; motif: string } {
  const conversion = versEntreeDelai({ ...champs, ...identite })
  if (!conversion.ok) return { ok: false, motif: conversion.motif }
  const calendrier = versCalendrier(feries)
  if (!calendrier.ok) return { ok: false, motif: calendrier.motif }
  return {
    ok: true,
    resultat: calculer({
      depart: DATE_EXEMPLE,
      entree: conversion.valeur,
      // L'aperçu montre ce que rendrait le calendrier TEL QU'IL EST EN BASE — celui-là, et
      // aucun autre. Jamais `undefined` : voir ci-dessus.
      entreesCalendrier: calendrier.valeur,
      locale: 'fr',
    }),
  }
}

export function DelaiEntryForm({
  t,
  ligne,
  feries,
  onAnnuler,
  onEnregistrer,
}: {
  t: Dictionary
  ligne: LigneAdmin | null
  feries: LigneFerieAdmin[]
  onAnnuler: () => void
  onEnregistrer: (champs: Record<string, unknown>) => Promise<boolean>
}) {
  const d = t.delaisAdmin
  const [etat, setEtat] = useState<Etat>(() => initial(ligne))
  const [apercu, setApercu] = useState<Resultat | null>(null)
  /**
   * Pourquoi l'aperçu N'A PAS PU être calculé — jamais un repli silencieux. Les deux
   * conversions qui peuvent échouer (l'entrée, le calendrier lu en base) rendent un `motif` ;
   * il s'affiche, et le bouton d'enregistrement reste fermé faute d'aperçu lu.
   */
  const [erreurApercu, setErreurApercu] = useState<string | null>(null)
  const [apercuVu, setApercuVu] = useState(false)
  const [busy, setBusy] = useState(false)

  const maj = (k: string, v: string | boolean) => {
    setEtat((e) => ({ ...e, [k]: v }))
    // Toute modification PÉRIME l'aperçu : sinon on enregistrerait une règle en ayant lu ce
    // que rendait une autre.
    setApercu(null)
    setApercuVu(false)
    setErreurApercu(null)
  }

  const champs = useMemo(() => versChamps(etat), [etat])
  const verdict = useMemo(() => validerEntree(champs), [champs])

  function calculerApercu() {
    const r = apercuDeLEntree(champs, feries, {
      slug: ligne?.slug ?? 'apercu',
      codeLibelle: ligne?.codeLibelle ?? champs.code,
      revision: ligne?.revision ?? 1,
    })
    setApercu(r.ok ? r.resultat : null)
    setErreurApercu(r.ok ? null : r.motif)
    setApercuVu(false)
  }

  async function enregistrer() {
    setBusy(true)
    await onEnregistrer(champs)
    setBusy(false)
  }

  const champTexte = (cle: string, libelle: string, options?: { lignes?: number; aide?: string }) => (
    <label className={ETIQUETTE}>
      {libelle}
      {options?.lignes ? (
        <textarea value={String(etat[cle] ?? '')} onChange={(e) => maj(cle, e.target.value)} rows={options.lignes} className={CHAMP} />
      ) : (
        <input value={String(etat[cle] ?? '')} onChange={(e) => maj(cle, e.target.value)} className={CHAMP} />
      )}
      {options?.aide && <span className="mt-1 block text-[11px] font-normal text-grafit">{options.aide}</span>}
    </label>
  )

  const champSelect = (cle: string, libelle: string, valeurs: readonly string[], libelles?: Record<string, string>) => (
    <label className={ETIQUETTE}>
      {libelle}
      <select value={String(etat[cle] ?? '')} onChange={(e) => maj(cle, e.target.value)} className={CHAMP}>
        {valeurs.map((v) => (
          <option key={v} value={v}>
            {libelles?.[v] ?? v}
          </option>
        ))}
      </select>
    </label>
  )

  const champCase = (cle: string, libelle: string) => (
    <label className="flex items-start gap-2 text-xs font-semibold text-ank">
      <input type="checkbox" checked={Boolean(etat[cle])} onChange={(e) => maj(cle, e.target.checked)} className="mt-0.5 h-4 w-4" />
      <span>{libelle}</span>
    </label>
  )

  return (
    <div className="mt-6 rounded-xl border border-chabon/20 bg-white p-5">
      <h3 className="font-serif text-lg font-semibold text-ank">{ligne ? `${d.edit} — ${ligne.slug}` : d.add}</h3>
      <p className="mt-1 text-xs text-grafit">{d.slugDerived}</p>

      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {champSelect('code', d.fieldCode, ['CPC', 'TRAVAIL', 'CIVIL'], {
          CPC: t.delais.codeCPC,
          TRAVAIL: t.delais.codeTRAVAIL,
          CIVIL: t.delais.codeCIVIL,
        })}
        {champTexte('article', d.fieldArticle)}
        {champTexte('articleContexte', d.fieldArticleContexte)}
        {champTexte('tableau', d.fieldTableau)}
        {champTexte('tableauTitreFr', d.fieldTableauTitre)}
        {champTexte('ordre', d.fieldOrdre)}
        {champTexte('objetFr', d.fieldObjetFr, { lignes: 2 })}
        {champTexte('objetEn', d.fieldObjetEn, { lignes: 2 })}
        {champTexte('objetHt', d.fieldObjetHt, { lignes: 2 })}
        {champTexte('dureeTexte', d.fieldDureeTexte)}
        {champTexte('dureeFondementFr', d.fieldDureeFondement)}
        {champSelect('kind', d.fieldKind, KINDS)}
        {champTexte('jours', d.fieldJours)}
        {champSelect('nbDistances', d.fieldNbDistances, ['0', '1', '2'])}
        {champTexte('distanceAideFr', d.fieldDistanceAide)}
        {champTexte('distanceDoubleFr', d.fieldDistanceDouble)}
        {champTexte('supplementJson', d.fieldSupplement, { lignes: 3 })}
        {champSelect('avisDistance', d.fieldAvisDistance, ['', 'A5', 'A5_BIS'])}
        {champTexte('citationArticle', d.fieldCitationArticle, { lignes: 2 })}
        {champSelect('regime', d.fieldRegime, ['FRANC', 'ORDINAIRE', 'A_VERIFIER'])}
        {champTexte('regimeFondement', d.fieldRegimeFondement, { lignes: 3 })}
        {champSelect('prorogation991', d.fieldProrogation, ['OUI', 'NON', 'INCERTAIN'])}
        {champTexte('prorogationFondement', d.fieldProrogationFondement, { lignes: 3 })}
        {champTexte('pointDepartFr', d.fieldPointDepartFr)}
        {champTexte('pointDepartEn', d.fieldPointDepartEn)}
        {champTexte('pointDepartHt', d.fieldPointDepartHt)}
        {champTexte('motifRefusFr', d.fieldMotifRefusFr, { lignes: 2 })}
        {champTexte('motifRefusEn', d.fieldMotifRefusEn, { lignes: 2 })}
        {champTexte('motifRefusHt', d.fieldMotifRefusHt, { lignes: 2 })}
        {champTexte('sanctionFr', d.fieldSanctionFr)}
        {champTexte('sanctionEn', d.fieldSanctionEn)}
        {champTexte('sanctionHt', d.fieldSanctionHt)}
      </div>
      <div className="mt-4 flex flex-wrap gap-4">
        {champCase('regimeIncertain', d.fieldRegimeIncertain)}
        {champCase('traductionRelue', d.fieldTraductionRelue)}
      </div>

      {verdict.anomalies.length > 0 && (
        <div className="mt-5 rounded-xl border-l-[3px] border-wouj bg-white px-4 py-3">
          <p className="text-sm font-semibold text-ank">{d.blockingTitle}</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-grafit">
            {verdict.anomalies.map((a) => (
              <li key={`${a.champ}-${a.cle}`}>
                <span className="font-mono text-[11px] text-ank/80">{a.champ}</span> — {a.messageFr}
              </li>
            ))}
          </ul>
        </div>
      )}
      {verdict.avertissements.length > 0 && (
        <div className="mt-3 rounded-xl border border-chabon/20 bg-koton px-4 py-3">
          <p className="text-sm font-semibold text-ank">{d.warningsTitle}</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-grafit">
            {verdict.avertissements.map((a) => (
              <li key={`${a.champ}-${a.cle}`}>{a.messageFr}</li>
            ))}
          </ul>
        </div>
      )}

      {/* L'APERÇU OBLIGATOIRE. */}
      <section className="mt-6 rounded-xl border border-chabon/20 bg-koton p-4">
        <h4 className="font-serif text-base font-semibold text-ank">{d.previewTitle}</h4>
        <p className="mt-1 text-xs text-grafit">{d.previewHint}</p>
        <button type="button" onClick={calculerApercu} className={`${BOUTON} mt-3 border border-chabon bg-chabon text-koton`}>
          {d.previewCompute}
        </button>

        {!apercu && !erreurApercu && <p className="mt-3 text-sm text-grafit">{d.previewNone}</p>}

        {/* ⚠️ Un aperçu qu'on ne peut pas calculer sur les données réelles se DIT. */}
        {erreurApercu && (
          <div className="mt-3 border-l-2 border-wouj bg-white p-3 text-sm text-ank">
            <p className="font-semibold">{d.previewImpossible}</p>
            <p className="mt-1 text-grafit">{erreurApercu}</p>
          </div>
        )}

        {apercu?.statut === 'REFUS' && (
          <div className="mt-3 bg-white p-3 text-sm text-ank">
            <p className="font-semibold">{d.previewRefusal}</p>
            <p className="mt-1 text-grafit">{apercu.motif}</p>
          </div>
        )}
        {apercu?.statut === 'INCOMPLET' && (
          <div className="mt-3 bg-white p-3 text-sm text-ank">
            <p className="font-semibold">{d.previewIncomplete}</p>
            <ul className="mt-1 list-disc pl-5 text-grafit">
              {apercu.manque.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}
        {apercu?.statut === 'CALCUL' && (
          <div className="mt-3 bg-white p-3 text-sm text-ank">
            <p className="font-serif text-xl font-semibold">
              {dateEnToutesLettres(apercu.teteAffiche, 'fr')} — {dateEnChiffres(apercu.teteAffiche)}
            </p>
            <p className="mt-1 text-grafit">{apercu.phraseSecurite}</p>
            <ol className="mt-2 list-decimal pl-5 text-grafit">
              {apercu.etapes.map((e) => (
                <li key={e.cle}>{e.texte}</li>
              ))}
            </ol>
            {apercu.lectures.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-grafit">
                {apercu.lectures.map((l) => (
                  <li key={l.cle}>
                    <b>{l.libelle}</b> — {dateEnToutesLettres(l.date, 'fr')}
                  </li>
                ))}
              </ul>
            )}
            {apercu.avertissements.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-grafit">
                {apercu.avertissements.map((a) => (
                  <li key={a.cle}>
                    <span className="font-mono text-[11px]">{a.cle}</span> — {a.texte}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {apercu && (
          <label className="mt-3 flex items-start gap-2 text-xs font-semibold text-ank">
            <input type="checkbox" checked={apercuVu} onChange={(e) => setApercuVu(e.target.checked)} className="mt-0.5 h-4 w-4" />
            <span>{d.previewSeen}</span>
          </label>
        )}
      </section>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || verdict.anomalies.length > 0 || !apercuVu}
          onClick={enregistrer}
          className={`${BOUTON} bg-wouj text-white hover:opacity-90 disabled:opacity-40`}
        >
          {d.save}
        </button>
        <button type="button" onClick={onAnnuler} className={`${BOUTON} border border-chabon/20 bg-white text-grafit hover:bg-koton`}>
          {d.cancel}
        </button>
        {/* Jamais un bouton grisé muet : ce qui manque est écrit à côté. */}
        {!apercuVu && <span className="text-xs text-grafit">{d.previewRequired}</span>}
      </div>
    </div>
  )
}
