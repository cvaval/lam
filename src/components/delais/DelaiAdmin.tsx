'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { postJson, sendJson } from '@/lib/http'
import { articleAffiche } from '@/lib/delais/calcul'
import { ChampErreur } from '../ChampErreur'
import { DelaiEntryForm } from './DelaiEntryForm'
import { DelaiCalendarAdmin } from './DelaiCalendarAdmin'
import { DelaiFenetresAdmin } from './DelaiFenetresAdmin'
import type { Anomalie } from '@/lib/delais/validation-admin'

/**
 * § 7 — L'ÉCRAN D'ADMINISTRATION DU CALCULATEUR. Trois onglets, trois objets : le répertoire,
 * le calendrier des fêtes, les fenêtres de signification.
 *
 * Ce que l'écran refuse de faire, et pourquoi :
 *  - **il n'affiche jamais un état par la seule couleur** : « Masquée », « Supprimée », « Ne
 *    calcule pas » sont écrits en toutes lettres (charte Klinik, règle 5 — Wouj et Vèt sont à
 *    1,05:1 de luminance, indiscernables en daltonisme rouge-vert) ;
 *  - **il ne cache pas les entrées supprimées** : une suppression qui fait disparaître sa
 *    trace de l'écran d'administration serait indiscernable d'un effacement ;
 *  - **il ne propose « Supprimer » qu'au master admin**, et la route le revérifie. Le menu
 *    n'est pas une sécurité.
 */

export type LigneAdmin = {
  id: string
  slug: string
  code: string
  codeLibelle: string
  article: string
  articleOccurrence: number
  articleContexte: string | null
  ordre: number
  tableau: number
  tableauTitreFr: string | null
  objetFr: string
  objetEn: string
  objetHt: string
  traductionRelue: boolean
  dureeTexte: string
  dureeFondementFr: string | null
  kind: string
  jours: number | null
  nbDistances: number
  distanceDoubleFr: string | null
  distanceAideFr: string | null
  supplementJson: string | null
  avisDistance: string | null
  citationArticle: string | null
  surchargeAppliquee: string | null
  regime: string
  regimeIncertain: boolean
  regimeFondement: string
  prorogation991: string
  prorogationFondement: string
  motifRefusFr: string | null
  motifRefusEn: string | null
  motifRefusHt: string | null
  pointDepartFr: string
  pointDepartEn: string
  pointDepartHt: string
  sanctionFr: string | null
  sanctionEn: string | null
  sanctionHt: string | null
  statut: string
  masqueMotif: string | null
  revision: number
}

export type LigneFerieAdmin = {
  id: string
  versionCalendrier: number
  cle: string
  typeEntree: string
  libelleFr: string
  libelleEn: string
  libelleHt: string
  categorie: string
  autorite: string
  journee: string
  noteJourneeFr: string | null
  noteJourneeEn: string | null
  noteJourneeHt: string | null
  traductionRelue: boolean
  mobile: boolean
  offsetPaques: number | null
  mois: number | null
  jour: number | null
  source: string
  sourceDocId: string | null
  appliqueDepuis: string
  observationsN: number | null
  observationsTexteFr: string | null
  observationsBorneFr: string | null
  rechercheCorpusQ: string | null
}

export type LigneFenetreAdmin = {
  id: string
  versionFenetres: number
  matiere: string
  heureDebut: number
  heureFin: number
  source: string
  sourceDocId: string | null
  nullite: boolean
  nulliteTexteFr: string | null
}

export type LigneJournal = {
  id: string
  action: string
  targetId: string | null
  quand: string
  acteur: string
  meta: string | null
}

const BOUTON = 'min-h-[44px] rounded-full px-4 py-2 text-xs font-semibold transition'
const BOUTON_NEUTRE = `${BOUTON} border border-chabon/20 bg-white text-grafit hover:bg-koton`

export function DelaiAdmin({
  t,
  estMaster,
  entrees,
  feries,
  fenetres,
  versionCalendrier,
  versionFenetres,
  journal,
  schemaAbsent,
}: {
  t: Dictionary
  estMaster: boolean
  entrees: LigneAdmin[]
  feries: LigneFerieAdmin[]
  fenetres: LigneFenetreAdmin[]
  versionCalendrier: number | null
  versionFenetres: number | null
  journal: LigneJournal[]
  schemaAbsent: boolean
}) {
  const d = t.delaisAdmin
  const router = useRouter()
  const [onglet, setOnglet] = useState<'repertoire' | 'calendrier' | 'fenetres'>('repertoire')
  const [code, setCode] = useState<'tous' | 'CPC' | 'TRAVAIL' | 'CIVIL'>('tous')
  const [statut, setStatut] = useState<'tous' | 'visible' | 'masque' | 'supprime'>('tous')
  const [q, setQ] = useState('')
  const [formOuvert, setFormOuvert] = useState<{ mode: 'ajout' } | { mode: 'edition'; ligne: LigneAdmin } | null>(null)
  const [retrait, setRetrait] = useState<{
    ligne: LigneAdmin
    verbe: 'masquer' | 'supprimer' | 'restaurer'
  } | null>(null)
  const [motif, setMotif] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [anomalies, setAnomalies] = useState<Anomalie[]>([])

  const lignes = useMemo(() => {
    let r = entrees
    if (code !== 'tous') r = r.filter((l) => l.code === code)
    if (statut !== 'tous') r = r.filter((l) => l.statut === statut)
    const aiguille = q.trim().toLowerCase()
    if (aiguille) {
      r = r.filter((l) => `${l.article} ${l.objetFr} ${l.slug}`.toLowerCase().includes(aiguille))
    }
    return r.slice(0, 400)
  }, [entrees, code, statut, q])

  /**
   * § 8.2 — « une liste des entrées non relues affichée en tête du back-office ». Sans elle,
   * un éditeur qui traduit les 393 entrées ne voit son travail nulle part et ne sait pas ce
   * qui reste : `traductionRelue` n'existait que dans deux déclarations de type.
   */
  const aRelire = useMemo(
    () => entrees.filter((l) => !l.traductionRelue && l.statut !== 'supprime'),
    [entrees],
  )

  const libelleStatut = (s: string) =>
    s === 'visible' ? d.statutVisible : s === 'masque' ? d.statutMasque : d.statutSupprime

  const fermer = () => {
    setRetrait(null)
    setMotif('')
    setConfirmation('')
    setErreur(null)
    setAnomalies([])
  }

  async function envoyerRetrait() {
    if (!retrait) return
    setBusy(true)
    setErreur(null)
    setAnomalies([])
    const res =
      retrait.verbe === 'masquer'
        ? await sendJson('/api/admin/delais', 'PATCH', { op: 'masquer', id: retrait.ligne.id, motif })
        : retrait.verbe === 'restaurer'
          ? // § 7.3 — défaire une suppression coûte le même prix que la suppression : master
            // admin, motif, confirmation typée. Ce n'est PAS « réafficher ».
            await sendJson('/api/admin/delais', 'PATCH', {
              op: 'restaurer-suppression',
              id: retrait.ligne.id,
              motif,
              confirmation,
            })
          : await sendJson('/api/admin/delais', 'DELETE', { id: retrait.ligne.id, motif, confirmation })
    setBusy(false)
    if (!res.ok) {
      setErreur(res.error ?? 'actionFailed')
      setAnomalies((res.data as { anomalies?: Anomalie[] } | null)?.anomalies ?? [])
      return
    }
    fermer()
    router.refresh()
  }

  /**
   * ⚠️ **« Réafficher » ne s'applique QU'À une entrée masquée.** Une entrée supprimée se
   * rétablit par le verbe `restaurer-suppression`, réservé au master admin : le menu n'est
   * pas la sécurité, mais il ne doit pas proposer ce que la route doit refuser (§ 7.3).
   */
  async function reafficher(ligne: LigneAdmin) {
    setBusy(true)
    setErreur(null)
    const res = await sendJson('/api/admin/delais', 'PATCH', { op: 'reafficher', id: ligne.id })
    setBusy(false)
    if (!res.ok) {
      setErreur(res.error ?? 'actionFailed')
      return
    }
    router.refresh()
  }

  async function enregistrerEntree(champs: Record<string, unknown>, edition: LigneAdmin | null) {
    setErreur(null)
    setAnomalies([])
    const res = edition
      ? await sendJson('/api/admin/delais', 'PATCH', { op: 'modifier', id: edition.id, champs })
      : await postJson('/api/admin/delais', champs)
    if (!res.ok) {
      setErreur(res.error ?? 'actionFailed')
      setAnomalies((res.data as { anomalies?: Anomalie[] } | null)?.anomalies ?? [])
      return false
    }
    setFormOuvert(null)
    router.refresh()
    return true
  }

  return (
    <section className="mt-6">
      <div role="tablist" aria-label={d.title} className="flex flex-wrap gap-2 border-b border-chabon/10 pb-3">
        {(
          [
            ['repertoire', d.tabRepertoire, entrees.length],
            ['calendrier', d.tabCalendrier, feries.length],
            ['fenetres', d.tabFenetres, fenetres.length],
          ] as const
        ).map(([cle, libelle, n]) => (
          <button
            key={cle}
            type="button"
            role="tab"
            aria-selected={onglet === cle}
            onClick={() => setOnglet(cle)}
            className={`${BOUTON} ${onglet === cle ? 'border border-chabon bg-chabon text-koton' : 'border border-chabon/20 bg-white text-grafit hover:bg-koton'}`}
          >
            {libelle} <span className="font-mono text-[11px]">({n})</span>
          </button>
        ))}
      </div>

      {erreur && (
        <div className="mt-4 max-w-3xl">
          <ChampErreur prefixe={t.common.echec}>
            {(t.errors as Record<string, string>)[erreur] ?? erreur}
          </ChampErreur>
        </div>
      )}
      {anomalies.length > 0 && (
        <div className="mt-3 max-w-3xl rounded-xl border-l-[3px] border-wouj bg-white px-4 py-3">
          <p className="text-sm font-semibold text-ank">{d.blockingTitle}</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-grafit">
            {anomalies.map((a) => (
              <li key={`${a.champ}-${a.cle}`}>
                <span className="font-mono text-[11px] text-ank/80">{a.champ}</span> — {a.messageFr}
              </li>
            ))}
          </ul>
        </div>
      )}

      {onglet === 'repertoire' && (
        <div className="mt-5">
          {/* § 8.2 — l'état des traductions, en tête, avant les filtres : c'est une consigne
              de travail, pas une statistique à aller chercher. */}
          <div className="max-w-3xl rounded-xl border border-chabon/20 bg-white px-4 py-3">
            <p className="text-sm font-semibold text-ank">{d.translationsPendingTitle}</p>
            {aRelire.length === 0 ? (
              <p className="mt-1 text-sm text-grafit">{d.translationsPendingNone}</p>
            ) : (
              <>
                <p className="mt-1 text-sm text-grafit">
                  {d.translationsPendingBody.replace('{n}', String(aRelire.length))}
                </p>
                <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-grafit">
                  {aRelire.slice(0, 40).map((l) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => setFormOuvert({ mode: 'edition', ligne: l })}
                        className="font-mono underline underline-offset-2 hover:text-ank"
                      >
                        {l.code} {articleAffiche(l.article)}
                      </button>
                    </li>
                  ))}
                  {aRelire.length > 40 && <li>… +{aRelire.length - 40}</li>}
                </ul>
              </>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-xs font-semibold text-ank">
              {d.filterCode}
              <select
                value={code}
                onChange={(e) => setCode(e.target.value as typeof code)}
                className="ml-2 min-h-[44px] rounded-lg border border-chabon/20 bg-white px-2 text-sm font-normal text-ank"
              >
                <option value="tous">{d.filterAll}</option>
                <option value="CPC">{t.delais.codeCPC}</option>
                <option value="TRAVAIL">{t.delais.codeTRAVAIL}</option>
                <option value="CIVIL">{t.delais.codeCIVIL}</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-ank">
              {d.filterStatut}
              <select
                value={statut}
                onChange={(e) => setStatut(e.target.value as typeof statut)}
                className="ml-2 min-h-[44px] rounded-lg border border-chabon/20 bg-white px-2 text-sm font-normal text-ank"
              >
                <option value="tous">{d.filterAll}</option>
                <option value="visible">{d.statutVisible}</option>
                <option value="masque">{d.statutMasque}</option>
                <option value="supprime">{d.statutSupprime}</option>
              </select>
            </label>
            <label className="flex-1 text-xs font-semibold text-ank">
              <span className="sr-only">{d.searchPlaceholder}</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={d.searchPlaceholder}
                className="min-h-[44px] w-full rounded-lg border border-chabon/20 bg-white px-3 text-sm font-normal text-ank"
              />
            </label>
            <button
              type="button"
              disabled={schemaAbsent}
              onClick={() => setFormOuvert({ mode: 'ajout' })}
              className={`${BOUTON} bg-wouj text-white hover:opacity-90 disabled:opacity-40`}
            >
              + {d.add}
            </button>
          </div>

          <p className="mt-3 max-w-3xl text-xs text-grafit">{d.repertoireHint}</p>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-chabon/20 text-left text-[11px] uppercase tracking-wide text-grafit">
                  <th className="px-2 py-2">{d.colArticle}</th>
                  <th className="px-2 py-2">{d.colObjet}</th>
                  <th className="px-2 py-2">{d.colDuree}</th>
                  <th className="px-2 py-2">{d.colRegime}</th>
                  <th className="px-2 py-2">{d.colStatut}</th>
                  <th className="px-2 py-2">{d.colRevision}</th>
                  <th className="px-2 py-2">{d.colActions}</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => (
                  <tr key={l.id} className="border-b border-chabon/10 align-top">
                    <td className="px-2 py-2">
                      <div className="font-semibold text-ank">
                        {l.codeLibelle} — {l.article}
                      </div>
                      {l.articleContexte && <div className="text-[11px] italic text-grafit">{l.articleContexte}</div>}
                      <div className="font-mono text-[10px] text-ank/70">{l.slug}</div>
                    </td>
                    <td className="max-w-[22rem] px-2 py-2 text-grafit">{l.objetFr}</td>
                    <td className="px-2 py-2 text-grafit">
                      {l.dureeTexte}
                      {/* L'état « ne calcule pas » est ÉCRIT : jamais une nuance de gris. */}
                      {!['JOURS', 'JOURS_PLUS_DISTANCE_KM', 'JOURS_DISTANCE_NON_CHIFFREE'].includes(l.kind) && (
                        <div className="text-[11px] font-semibold text-ank">{d.notCalculable}</div>
                      )}
                    </td>
                    <td className="px-2 py-2 text-grafit">
                      {l.regime}
                      {l.regimeIncertain && <div className="text-[11px] text-ank">{t.delais.regimeIncertain}</div>}
                    </td>
                    <td className="px-2 py-2">
                      <span className="font-semibold text-ank">{libelleStatut(l.statut)}</span>
                      {l.masqueMotif && l.statut !== 'visible' && (
                        <div className="max-w-[14rem] text-[11px] text-grafit">{l.masqueMotif}</div>
                      )}
                    </td>
                    <td className="px-2 py-2 font-mono text-[11px] text-ank/80">{l.revision}</td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        <button type="button" onClick={() => setFormOuvert({ mode: 'edition', ligne: l })} className={BOUTON_NEUTRE}>
                          {d.edit}
                        </button>
                        {l.statut === 'visible' && (
                          <button type="button" onClick={() => { fermer(); setRetrait({ ligne: l, verbe: 'masquer' }) }} className={BOUTON_NEUTRE}>
                            {d.hide}
                          </button>
                        )}
                        {l.statut === 'masque' && (
                          <button type="button" disabled={busy} onClick={() => reafficher(l)} className={BOUTON_NEUTRE}>
                            {d.restore}
                          </button>
                        )}
                        {/* Une entrée SUPPRIMÉE ne se « réaffiche » pas : la remettre au menu
                            défait une décision de gouvernance, et cela n'est proposé qu'au
                            master admin — que la route revérifie de toute façon. */}
                        {l.statut === 'supprime' && (estMaster ? (
                          <button type="button" onClick={() => { fermer(); setRetrait({ ligne: l, verbe: 'restaurer' }) }} className={BOUTON_NEUTRE}>
                            {d.undelete}
                          </button>
                        ) : (
                          <span className="self-center text-[10px] text-grafit">{d.undeleteMasterOnly}</span>
                        ))}
                        {l.statut !== 'supprime' && (estMaster ? (
                          <button type="button" onClick={() => { fermer(); setRetrait({ ligne: l, verbe: 'supprimer' }) }} className={BOUTON_NEUTRE}>
                            {d.remove}
                          </button>
                        ) : (
                          <span className="self-center text-[10px] text-grafit">{d.removeMasterOnly}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {lignes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-2 py-6 text-center text-grafit">
                      {d.none}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Retrait — masquer ou supprimer. Le motif est obligatoire dans les deux cas ; la
              confirmation typée ne l'est que pour la suppression (§ 7.3). */}
          {retrait && (
            <div className="mt-4 max-w-2xl rounded-xl border border-chabon/20 bg-white p-4">
              <h3 className="font-serif text-lg font-semibold text-ank">
                {retrait.verbe === 'masquer'
                  ? d.hide
                  : retrait.verbe === 'restaurer'
                    ? d.confirmUndeleteTitle
                    : d.confirmDeleteTitle}{' '}
                — {retrait.ligne.codeLibelle} {articleAffiche(retrait.ligne.article)}
              </h3>
              {retrait.verbe === 'supprimer' && <p className="mt-1 text-sm text-grafit">{d.confirmDeleteNote}</p>}
              {retrait.verbe === 'restaurer' && <p className="mt-1 text-sm text-grafit">{d.confirmUndeleteNote}</p>}
              <label className="mt-3 block text-xs font-semibold text-ank">
                {d.motifLabel}
                <textarea
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-chabon/20 bg-white px-3 py-2 text-sm font-normal text-ank"
                />
                <span className="mt-1 block text-[11px] font-normal text-grafit">{d.motifHint}</span>
              </label>
              {retrait.verbe !== 'masquer' && (
                <label className="mt-3 block text-xs font-semibold text-ank">
                  {d.confirmDeleteTyped.replace('{valeur}', retrait.ligne.article)}
                  <input
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-chabon/20 bg-white px-3 py-2 text-sm font-normal text-ank"
                  />
                </label>
              )}
              <div className="mt-4 flex gap-2">
                <button type="button" disabled={busy} onClick={envoyerRetrait} className={`${BOUTON} bg-wouj text-white hover:opacity-90 disabled:opacity-40`}>
                  {retrait.verbe === 'masquer' ? d.hide : retrait.verbe === 'restaurer' ? d.undelete : d.remove}
                </button>
                <button type="button" onClick={fermer} className={BOUTON_NEUTRE}>
                  {d.cancel}
                </button>
              </div>
            </div>
          )}

          {formOuvert && (
            <DelaiEntryForm
              t={t}
              feries={feries}
              ligne={formOuvert.mode === 'edition' ? formOuvert.ligne : null}
              onAnnuler={() => setFormOuvert(null)}
              onEnregistrer={(champs) => enregistrerEntree(champs, formOuvert.mode === 'edition' ? formOuvert.ligne : null)}
            />
          )}
        </div>
      )}

      {onglet === 'calendrier' && (
        <DelaiCalendarAdmin
          t={t}
          estMaster={estMaster}
          feries={feries}
          version={versionCalendrier}
          schemaAbsent={schemaAbsent}
        />
      )}

      {onglet === 'fenetres' && (
        <DelaiFenetresAdmin t={t} fenetres={fenetres} version={versionFenetres} schemaAbsent={schemaAbsent} />
      )}

      <section className="mt-10">
        <h2 className="font-serif text-lg font-semibold text-ank">{d.historyTitle}</h2>
        <ul className="mt-2 flex flex-col gap-1 text-xs text-grafit">
          {journal.map((h) => (
            <li key={h.id} className="rounded-lg border border-chabon/10 bg-white px-3 py-2">
              <span className="font-mono text-[10px] text-ank/80">{h.quand}</span>{' '}
              <span className="font-semibold">{h.action}</span> · {h.targetId ?? '—'} · {h.acteur}
            </li>
          ))}
          {journal.length === 0 && <li className="text-ank/80">{d.historyEmpty}</li>}
        </ul>
      </section>
    </section>
  )
}
