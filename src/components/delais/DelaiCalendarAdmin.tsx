'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { postJson, sendJson } from '@/lib/http'
import { addDays, calculer, dateEntree, dateEnToutesLettres } from '@/lib/delais'
import type { EntreeCalendrier, EntreeDelai, Resultat } from '@/lib/delais'
import { versCalendrier, versEntreeCalendrier } from '@/lib/delais/depuis-base'
import { validerFerie } from '@/lib/delais/validation-admin'
import type { LigneFerieAdmin } from './DelaiAdmin'

/**
 * § 7.4 — LE CALENDRIER DES FÊTES : **DEUX LISTES, jamais fondues en une seule.**
 *
 * « Un éditeur qui voit une seule liste finira par déplacer une ligne d'un bloc à l'autre sans
 * mesurer ce qu'il fait. » Or les deux blocs ne font pas la même chose :
 *  - **PERMANENT proroge** le délai quand la date limite y tombe ;
 *  - **A_SURVEILLER ne proroge rien** : il déclenche l'avertissement A6 (§ 4.13).
 *
 * Les trois verbes s'appliquent aux deux tableaux à l'identique — la liste des jours à
 * surveiller doit pouvoir grandir sans toucher au code.
 *
 * **Toute modification crée une NOUVELLE version du calendrier.** L'écran le dit avant
 * d'enregistrer : c'est ce qui protège les permaliens déjà émis.
 */

/** § 4.13 — l'année d'exemple de l'aperçu. 2027 est celle du gabarit A6 (Cendres, 10 février). */
const ANNEE_EXEMPLE = 2027

const BOUTON = 'min-h-[44px] rounded-full px-4 py-2 text-xs font-semibold transition'
const BOUTON_NEUTRE = `${BOUTON} border border-chabon/20 bg-white text-grafit hover:bg-koton`
const CHAMP = 'mt-1 w-full rounded-lg border border-chabon/20 bg-white px-3 py-2 text-sm font-normal text-ank'
const ETIQUETTE = 'block text-xs font-semibold text-ank'

/**
 * L'entrée SYNTHÉTIQUE qui sert l'aperçu : 30 jours francs de procédure civile, le cas le plus
 * courant du répertoire. Elle n'est jamais écrite en base — elle sert à MONTRER ce que la ligne
 * de calendrier ferait à un calcul réel.
 */
const ENTREE_TEMOIN: EntreeDelai = {
  slug: 'apercu-calendrier',
  code: 'CPC',
  codeLibelle: 'Code de procédure civile',
  article: '354',
  objetFr: 'Aperçu : appel, 30 jours francs',
  dureeTexte: '30 jours francs',
  kind: 'JOURS',
  jours: 30,
  nbDistances: 0,
  supplement: null,
  regime: 'FRANC',
  regimeIncertain: false,
  regimeFondement: 'C. pr. civ., art. 987 — « Tous les délais prévus au Code de procédure civile sont francs. »',
  prorogation991: 'OUI',
  prorogationFondement: 'C. pr. civ., art. 991 al. 3',
  pointDepartFr: 'Aperçu',
}

type Etat = Record<string, string | boolean>

function initial(l: LigneFerieAdmin | null): Etat {
  return {
    cle: l?.cle ?? '',
    typeEntree: l?.typeEntree ?? 'PERMANENT',
    libelleFr: l?.libelleFr ?? '',
    libelleEn: l?.libelleEn ?? '',
    libelleHt: l?.libelleHt ?? '',
    categorie: l?.categorie ?? 'FETE_LEGALE',
    autorite: l?.autorite ?? 'TEXTE',
    journee: l?.journee ?? 'JOURNEE_ENTIERE',
    noteJourneeFr: l?.noteJourneeFr ?? '',
    traductionRelue: l?.traductionRelue ?? false,
    mobile: l?.mobile ?? false,
    offsetPaques: l?.offsetPaques == null ? '' : String(l.offsetPaques),
    mois: l?.mois == null ? '' : String(l.mois),
    jour: l?.jour == null ? '' : String(l.jour),
    source: l?.source ?? '',
    sourceDocId: l?.sourceDocId ?? '',
    appliqueDepuis: l?.appliqueDepuis ?? '',
    observationsN: l?.observationsN == null ? '' : String(l.observationsN),
    observationsTexteFr: l?.observationsTexteFr ?? '',
    observationsBorneFr: l?.observationsBorneFr ?? '',
    rechercheCorpusQ: l?.rechercheCorpusQ ?? '',
  }
}

function versLigne(e: Etat) {
  const s = (k: string) => String(e[k] ?? '').trim()
  const nOuNull = (k: string) => (s(k) === '' ? null : Number(s(k)))
  return {
    cle: s('cle'),
    typeEntree: s('typeEntree'),
    libelleFr: s('libelleFr'),
    libelleEn: s('libelleEn'),
    libelleHt: s('libelleHt'),
    categorie: s('categorie'),
    autorite: s('autorite'),
    journee: s('journee'),
    noteJourneeFr: s('noteJourneeFr') || null,
    traductionRelue: Boolean(e.traductionRelue),
    mobile: Boolean(e.mobile),
    offsetPaques: nOuNull('offsetPaques'),
    mois: nOuNull('mois'),
    jour: nOuNull('jour'),
    source: s('source'),
    sourceDocId: s('sourceDocId') || null,
    appliqueDepuis: s('appliqueDepuis'),
    observationsN: nOuNull('observationsN'),
    observationsTexteFr: s('observationsTexteFr') || null,
    observationsBorneFr: s('observationsBorneFr') || null,
    rechercheCorpusQ: s('rechercheCorpusQ') || null,
  }
}

export function DelaiCalendarAdmin({
  t,
  estMaster,
  feries,
  version,
  schemaAbsent,
}: {
  t: Dictionary
  estMaster: boolean
  feries: LigneFerieAdmin[]
  version: number | null
  schemaAbsent: boolean
}) {
  const d = t.delaisAdmin
  const router = useRouter()
  const [form, setForm] = useState<{ mode: 'ajout' | 'edition'; ligne: LigneFerieAdmin | null } | null>(null)
  const [etat, setEtat] = useState<Etat>(() => initial(null))
  const [apercu, setApercu] = useState<Resultat | null>(null)
  const [apercuVu, setApercuVu] = useState(false)
  const [retrait, setRetrait] = useState<{ ligne: LigneFerieAdmin; verbe: 'masquer' | 'supprimer' } | null>(null)
  const [motif, setMotif] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const permanents = feries.filter((f) => f.typeEntree !== 'A_SURVEILLER')
  const aSurveiller = feries.filter((f) => f.typeEntree === 'A_SURVEILLER')

  const ligneSaisie = useMemo(() => versLigne(etat), [etat])
  const precedent = form?.ligne ?? null
  const verdict = useMemo(() => validerFerie(ligneSaisie, precedent), [ligneSaisie, precedent])

  const maj = (k: string, v: string | boolean) => {
    setEtat((e) => ({ ...e, [k]: v }))
    setApercu(null)
    setApercuVu(false)
  }

  const ouvrir = (mode: 'ajout' | 'edition', ligne: LigneFerieAdmin | null) => {
    setForm({ mode, ligne })
    setEtat(initial(ligne))
    setApercu(null)
    setApercuVu(false)
    setErreur(null)
  }

  /**
   * § 7.4 — L'APERÇU. On prend un délai témoin de 30 jours francs et on choisit le point de
   * départ de sorte que **l'échéance tombe exactement le jour édité**, dans l'année d'exemple :
   * départ = jour − 31 (franc : départ + 30 + 1). L'écran montre alors, sans que l'éditeur ait
   * rien à calculer, ce que la ligne fait vraiment — proroger (PERMANENT) ou avertir
   * (A_SURVEILLER).
   */
  function calculerApercu() {
    const conversion = versEntreeCalendrier(ligneSaisie)
    if (!conversion.ok) {
      setApercu(null)
      return
    }
    const autres = feries.filter((f) => f.cle !== ligneSaisie.cle)
    const converties = versCalendrier(autres)
    const entrees: EntreeCalendrier[] = [...(converties.ok ? converties.valeur : []), conversion.valeur]
    const cible = dateEntree(conversion.valeur, ANNEE_EXEMPLE)
    setApercu(
      calculer({
        depart: addDays(cible, -31),
        entree: ENTREE_TEMOIN,
        // Le calendrier PAS ENCORE ENREGISTRÉ : c'est l'usage prévu de ce paramètre (§ 7.4).
        entreesCalendrier: entrees,
        locale: 'fr',
      }),
    )
    setApercuVu(false)
  }

  async function enregistrer() {
    if (!form) return
    setBusy(true)
    setErreur(null)
    const res = await postJson('/api/admin/delais/calendrier', {
      op: form.mode === 'ajout' ? 'ajouter' : 'modifier',
      ligne: ligneSaisie,
    })
    setBusy(false)
    if (!res.ok) {
      setErreur(res.error ?? 'actionFailed')
      return
    }
    setForm(null)
    router.refresh()
  }

  async function envoyerRetrait() {
    if (!retrait) return
    setBusy(true)
    setErreur(null)
    const res =
      retrait.verbe === 'masquer'
        ? await sendJson('/api/admin/delais/calendrier', 'PATCH', { op: 'masquer', cle: retrait.ligne.cle, motif })
        : await sendJson('/api/admin/delais/calendrier', 'DELETE', { cle: retrait.ligne.cle, motif, confirmation })
    setBusy(false)
    if (!res.ok) {
      setErreur(res.error ?? 'actionFailed')
      return
    }
    setRetrait(null)
    setMotif('')
    setConfirmation('')
    router.refresh()
  }

  const tableau = (lignes: LigneFerieAdmin[], titre: string, entete: string, avecObservations: boolean) => (
    <section className="mt-6">
      <h3 className="font-serif text-lg font-semibold text-ank">
        {titre} <span className="font-mono text-sm font-normal text-grafit">({lignes.length})</span>
      </h3>
      <p className="mt-1 max-w-3xl text-sm text-grafit">{entete}</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-chabon/20 text-left text-[11px] uppercase tracking-wide text-grafit">
              <th className="px-2 py-2">{d.colCle}</th>
              <th className="px-2 py-2">{d.colLibelle}</th>
              <th className="px-2 py-2">{d.colCategorie}</th>
              <th className="px-2 py-2">{d.colAutorite}</th>
              <th className="px-2 py-2">{d.colJournee}</th>
              <th className="px-2 py-2">{d.colMobile}</th>
              <th className="px-2 py-2">{d.colSource}</th>
              <th className="px-2 py-2">{d.colAppliqueDepuis}</th>
              {avecObservations && <th className="px-2 py-2">{d.colObservationsN}</th>}
              <th className="px-2 py-2">{d.colActions}</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((f) => (
              <tr key={f.id} className="border-b border-chabon/10 align-top">
                <td className="px-2 py-2 font-mono text-[11px] text-ank">{f.cle}</td>
                <td className="px-2 py-2">
                  <div className="font-semibold text-ank">{f.libelleFr}</div>
                  <div className="text-[11px] text-grafit">
                    {f.libelleEn} · {f.libelleHt}
                  </div>
                  {f.noteJourneeFr && <div className="text-[11px] italic text-grafit">{f.noteJourneeFr}</div>}
                </td>
                <td className="px-2 py-2 text-grafit">{f.categorie}</td>
                <td className="px-2 py-2 text-grafit">
                  {f.autorite}
                  {/* § 7.4 — une entrée SANS TEXTE INSTITUANT reste hors de la tête d'affiche,
                      et l'écran doit le dire. ⚠️ Portait le nom de la réserve R6, retirée le
                      20 août 2026 : le décret du 11 décembre 2024 institue les onze fêtes
                      légales, et la version 2 du calendrier ne porte plus aucune entrée de
                      cette autorité. La ligne subsiste pour la version 1, et pour le jour où
                      un éditeur en créerait une. */}
                  {f.autorite === 'REDACTION' && f.typeEntree !== 'A_SURVEILLER' && (
                    <div className="max-w-[16rem] text-[11px] text-ank">{d.calendarNoTextNote}</div>
                  )}
                </td>
                <td className="px-2 py-2 text-grafit">
                  {f.journee === 'DEMI_JOURNEE_APRES_MIDI' ? d.journeeApresMidi : d.journeeEntiere}
                </td>
                <td className="px-2 py-2 text-grafit">
                  {f.mobile ? `${d.mobileOui} (${f.offsetPaques})` : `${d.mobileNon} ${f.jour}/${f.mois}`}
                </td>
                <td className="max-w-[18rem] px-2 py-2 text-[11px] text-grafit">{f.source}</td>
                <td className="px-2 py-2 font-mono text-[11px] text-grafit">{f.appliqueDepuis}</td>
                {avecObservations && (
                  <td className="px-2 py-2 text-grafit">
                    <div className="font-mono text-[11px] text-ank">{f.observationsN ?? '—'}</div>
                    <div className="max-w-[16rem] text-[11px]">{f.observationsTexteFr}</div>
                    <div className="max-w-[16rem] text-[11px] italic">{f.observationsBorneFr}</div>
                  </td>
                )}
                <td className="px-2 py-2">
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => ouvrir('edition', f)} className={BOUTON_NEUTRE}>
                      {d.edit}
                    </button>
                    <button type="button" onClick={() => setRetrait({ ligne: f, verbe: 'masquer' })} className={BOUTON_NEUTRE}>
                      {d.hide}
                    </button>
                    {estMaster && (
                      <button type="button" onClick={() => setRetrait({ ligne: f, verbe: 'supprimer' })} className={BOUTON_NEUTRE}>
                        {d.remove}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {lignes.length === 0 && (
              <tr>
                <td colSpan={avecObservations ? 10 : 9} className="px-2 py-6 text-center text-grafit">
                  {d.none}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )

  const champTexte = (cle: string, libelle: string, aide?: string) => (
    <label className={ETIQUETTE}>
      {libelle}
      <input value={String(etat[cle] ?? '')} onChange={(e) => maj(cle, e.target.value)} className={CHAMP} />
      {aide && <span className="mt-1 block text-[11px] font-normal text-grafit">{aide}</span>}
    </label>
  )

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-mono text-xs text-ank">
          {version == null ? '—' : d.calendarVersion.replace('{n}', String(version))}
        </p>
        <button
          type="button"
          disabled={schemaAbsent}
          onClick={() => ouvrir('ajout', null)}
          className={`${BOUTON} bg-wouj text-white hover:opacity-90 disabled:opacity-40`}
        >
          + {d.add}
        </button>
      </div>

      {/* Ce que le corpus ne permet PAS d'affirmer — les quatre mots sont indispensables. */}
      <div className="mt-3 max-w-3xl rounded-xl border border-chabon/20 bg-white p-4">
        <p className="text-sm font-semibold text-ank">{d.calendarCorpusNote}</p>
        <p className="mt-1 text-sm text-grafit">{d.calendarCorpusNoteDetail}</p>
        <p className="mt-2 text-xs text-grafit">{d.calendarNewVersionNote}</p>
      </div>

      {erreur && (
        <p role="alert" className="mt-3 max-w-3xl rounded-lg border-l-[3px] border-wouj bg-white px-3 py-2 text-sm text-ank">
          <b>{t.common.echec}</b> {(t.errors as Record<string, string>)[erreur] ?? erreur}
        </p>
      )}

      {tableau(permanents, d.tablePermanentTitle, d.tablePermanentHeader, false)}
      {tableau(aSurveiller, d.tableWatchTitle, d.tableWatchHeader, true)}

      {retrait && (
        <div className="mt-5 max-w-2xl rounded-xl border border-chabon/20 bg-white p-4">
          <h3 className="font-serif text-lg font-semibold text-ank">
            {retrait.verbe === 'masquer' ? d.hide : d.remove} — {retrait.ligne.libelleFr}
          </h3>
          <p className="mt-1 text-sm text-grafit">{d.calendarNewVersionNote}</p>
          <label className="mt-3 block text-xs font-semibold text-ank">
            {d.motifLabel}
            <textarea value={motif} onChange={(e) => setMotif(e.target.value)} rows={2} className={CHAMP} />
            <span className="mt-1 block text-[11px] font-normal text-grafit">{d.motifHint}</span>
          </label>
          {retrait.verbe === 'supprimer' && (
            <label className="mt-3 block text-xs font-semibold text-ank">
              {d.confirmDeleteKeyTyped.replace('{valeur}', retrait.ligne.cle)}
              <input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className={CHAMP} />
            </label>
          )}
          <div className="mt-4 flex gap-2">
            <button type="button" disabled={busy} onClick={envoyerRetrait} className={`${BOUTON} bg-wouj text-white hover:opacity-90 disabled:opacity-40`}>
              {retrait.verbe === 'masquer' ? d.hide : d.remove}
            </button>
            <button type="button" onClick={() => setRetrait(null)} className={BOUTON_NEUTRE}>
              {d.cancel}
            </button>
          </div>
        </div>
      )}

      {form && (
        <div className="mt-6 rounded-xl border border-chabon/20 bg-white p-5">
          <h3 className="font-serif text-lg font-semibold text-ank">
            {form.mode === 'ajout' ? d.add : `${d.edit} — ${form.ligne?.cle}`}
          </h3>

          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {champTexte('cle', d.colCle)}
            <label className={ETIQUETTE}>
              {d.colTypeEntree}
              <select value={String(etat.typeEntree)} onChange={(e) => maj('typeEntree', e.target.value)} className={CHAMP}>
                <option value="PERMANENT">PERMANENT — {d.tablePermanentHeader}</option>
                <option value="A_SURVEILLER">A_SURVEILLER — {d.tableWatchHeader}</option>
              </select>
            </label>
            {champTexte('libelleFr', `${d.colLibelle} (fr)`)}
            {champTexte('libelleEn', `${d.colLibelle} (en)`)}
            {champTexte('libelleHt', `${d.colLibelle} (ht)`)}
            <label className={ETIQUETTE}>
              {d.colCategorie}
              <select value={String(etat.categorie)} onChange={(e) => maj('categorie', e.target.value)} className={CHAMP}>
                {['FETE_LEGALE', 'FETE_NATIONALE', 'CHOMAGE_PAR_ARRETE'].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className={ETIQUETTE}>
              {d.colAutorite}
              <select value={String(etat.autorite)} onChange={(e) => maj('autorite', e.target.value)} className={CHAMP}>
                {['TEXTE', 'REDACTION', 'OBSERVATION'].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className={ETIQUETTE}>
              {d.colJournee}
              <select value={String(etat.journee)} onChange={(e) => maj('journee', e.target.value)} className={CHAMP}>
                <option value="JOURNEE_ENTIERE">{d.journeeEntiere}</option>
                <option value="DEMI_JOURNEE_APRES_MIDI">{d.journeeApresMidi}</option>
              </select>
            </label>
            {champTexte('noteJourneeFr', d.colJournee + ' — note')}
            {champTexte('offsetPaques', d.fieldOffsetPaques, '−48, −47, −46, −3, −2, +39, +60')}
            {champTexte('mois', d.fieldMois)}
            {champTexte('jour', d.fieldJour)}
            {champTexte('source', d.fieldSource)}
            {champTexte('sourceDocId', d.fieldSourceDocId)}
            {champTexte('appliqueDepuis', d.fieldAppliqueDepuis)}
            {champTexte('observationsN', d.fieldObservationsN, d.observationsCountHint)}
            {champTexte('observationsTexteFr', d.fieldObservationsTexte)}
            {champTexte('observationsBorneFr', d.fieldObservationsBorne)}
            {champTexte('rechercheCorpusQ', d.fieldRecherche)}
          </div>
          <div className="mt-4 flex flex-wrap gap-4">
            <label className="flex items-start gap-2 text-xs font-semibold text-ank">
              <input type="checkbox" checked={Boolean(etat.mobile)} onChange={(e) => maj('mobile', e.target.checked)} className="mt-0.5 h-4 w-4" />
              <span>{d.fieldMobile}</span>
            </label>
            <label className="flex items-start gap-2 text-xs font-semibold text-ank">
              <input type="checkbox" checked={Boolean(etat.traductionRelue)} onChange={(e) => maj('traductionRelue', e.target.checked)} className="mt-0.5 h-4 w-4" />
              <span>{d.fieldTraductionRelue}</span>
            </label>
          </div>

          {precedent?.typeEntree === 'A_SURVEILLER' && ligneSaisie.typeEntree === 'PERMANENT' && (
            <p className="mt-4 rounded-lg border-l-[3px] border-wouj bg-white px-3 py-2 text-sm text-ank">
              {d.switchToPermanentWarning}
            </p>
          )}

          {verdict.anomalies.length > 0 && (
            <div className="mt-4 rounded-xl border-l-[3px] border-wouj bg-white px-4 py-3">
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

          <section className="mt-6 rounded-xl border border-chabon/20 bg-koton p-4">
            <h4 className="font-serif text-base font-semibold text-ank">{d.previewTitle}</h4>
            <p className="mt-1 text-xs text-grafit">{d.previewHint}</p>
            <button type="button" onClick={calculerApercu} className={`${BOUTON} mt-3 border border-chabon bg-chabon text-koton`}>
              {d.previewCompute}
            </button>
            {!apercu && <p className="mt-3 text-sm text-grafit">{d.previewNone}</p>}
            {apercu?.statut === 'CALCUL' && (
              <div className="mt-3 bg-white p-3 text-sm text-ank">
                <p className="font-serif text-lg font-semibold">{dateEnToutesLettres(apercu.teteAffiche, 'fr')}</p>
                <p className="mt-1 text-grafit">{apercu.phraseSecurite}</p>
                {apercu.joursEcartes.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-grafit">
                    {apercu.joursEcartes.map((j) => (
                      <li key={`${j.date.y}-${j.date.m}-${j.date.d}`}>
                        {dateEnToutesLettres(j.date, 'fr')} — {j.motifs.map((m) => m.libelle).join(', ')}
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
            <button type="button" onClick={() => setForm(null)} className={BOUTON_NEUTRE}>
              {d.cancel}
            </button>
            {!apercuVu && <span className="text-xs text-grafit">{d.previewRequired}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
