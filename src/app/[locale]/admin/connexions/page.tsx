import Link from 'next/link'
import { dictFor } from '@/lib/i18n/server'
import { requireAdmin } from '@/lib/auth/guard'
import { formatInstant } from '@/lib/i18n/format'
import { decrireAppareil } from '@/lib/auth/appareil'
import { END_REASONS } from '@/lib/auth/session-etat'
import {
  appareilDe, comptesPourFiltre, duree, journalConnexions, lireFiltre, motifDe, sessionsEnCours, tentativesEchouees,
  verificationDe, JOURS, LIBELLE_MOTIF, LIBELLE_VERIFICATION, PAR_PAGE,
} from '@/lib/admin/connexions'
import { FermerSessionBouton } from '@/components/FermerSessionBouton'

export const dynamic = 'force-dynamic'

/**
 * JOURNAL DES CONNEXIONS — master admin seulement (`requireAdmin` ici, `requireAdminApi` sur
 * chaque route appelée : une page et sa route bougent ensemble).
 *
 * Trois tableaux : les connexions EN COURS (une par compte au plus, par construction, depuis
 * la règle « une seule connexion »), le JOURNAL (une ligne par session, ouverte ou fermée,
 * la plus récente d'abord, filtrable, paginé et borné), et les TENTATIVES ÉCHOUÉES de la
 * période (elles n'ont jamais eu de session : elles vivent au journal d'audit).
 *
 * ⚠️ TOUTE HEURE EST EN HEURE DE PORT-AU-PRINCE, et l'en-tête le dit une fois. `formatDate`
 * (UTC, pour les dates juridiques) n'a rien à faire ici.
 * ⚠️ LE JOURNAL NE DIT QUE CE QU'IL SAIT : un appareil non reconnu montre l'UA brut en
 * info-bulle, une fin inconnue se dit « fin non enregistrée », une durée n'existe que si la
 * fin existe.
 * ⚠️ AUCUNE CLÉ I18N NOUVELLE (fichiers de locale d'une autre session) : libellés locaux.
 */
const L = {
  titre: { fr: 'Connexions', en: 'Sign-ins', ht: 'Koneksyon' },
  sousTitre: {
    fr: 'Qui s’est connecté, depuis quel appareil, à quel moment — et comment la session s’est terminée.',
    en: 'Who signed in, from which device, when — and how the session ended.',
    ht: 'Ki moun ki konekte, sou ki aparèy, ki lè — e kijan sesyon an fini.',
  },
  zone: { fr: 'Heures de Port-au-Prince', en: 'Port-au-Prince time', ht: 'Lè Pòtoprens' },
  enCours: { fr: 'Connexions en cours', en: 'Open sessions', ht: 'Koneksyon an kou' },
  enCoursSub: {
    fr: 'Sessions vérifiées, non expirées, actives depuis moins de 20 minutes. Une par compte au plus.',
    en: 'Verified, unexpired sessions active within the last 20 minutes. At most one per account.',
    ht: 'Sesyon verifye, ki poko ekspire, aktif depi mwens pase 20 minit. Yon sèl pou chak kont.',
  },
  aucuneEnCours: { fr: 'Aucune connexion en cours.', en: 'No open session.', ht: 'Pa gen koneksyon an kou.' },
  journal: { fr: 'Journal des connexions', en: 'Sign-in log', ht: 'Jounal koneksyon' },
  echecs: { fr: 'Tentatives échouées', en: 'Failed attempts', ht: 'Tantativ ki echwe' },
  echecsSub: {
    fr: 'Mots de passe et codes 2FA refusés, verrouillages — sur la période. C’est ici qu’une force brute se voit.',
    en: 'Rejected passwords and 2FA codes, lockouts — over the period. This is where brute force shows.',
    ht: 'Modpas ak kòd 2FA refize, blokaj — sou peryòd la. Se la fòs brit parèt.',
  },
  aucunEchec: { fr: 'Aucune tentative échouée sur la période.', en: 'No failed attempt over the period.', ht: 'Pa gen tantativ ki echwe sou peryòd la.' },
  compte: { fr: 'Compte', en: 'Account', ht: 'Kont' },
  tousComptes: { fr: 'Tous les comptes', en: 'All accounts', ht: 'Tout kont' },
  periode: { fr: 'Période', en: 'Period', ht: 'Peryòd' },
  jours: { fr: 'derniers jours', en: 'last days', ht: 'dènye jou' },
  motif: { fr: 'Motif de fin', en: 'End reason', ht: 'Rezon fen' },
  tousMotifs: { fr: 'Tous', en: 'All', ht: 'Tout' },
  filtrer: { fr: 'Filtrer', en: 'Filter', ht: 'Filtre' },
  exporter: { fr: 'Exporter (CSV)', en: 'Export (CSV)', ht: 'Ekspòte (CSV)' },
  debut: { fr: 'Début', en: 'Start', ht: 'Kòmansman' },
  fin: { fr: 'Fin', en: 'End', ht: 'Fen' },
  duree: { fr: 'Durée', en: 'Duration', ht: 'Dire' },
  appareil: { fr: 'Appareil', en: 'Device', ht: 'Aparèy' },
  ip: { fr: 'IP', en: 'IP', ht: 'IP' },
  verification: { fr: 'Vérification', en: 'Verification', ht: 'Verifikasyon' },
  depuis: { fr: 'Depuis', en: 'Since', ht: 'Depi' },
  derniereActivite: { fr: 'Dernière activité', en: 'Last activity', ht: 'Dènye aktivite' },
  remplaceePar: { fr: 'remplacée par', en: 'replaced by', ht: 'ranplase pa' },
  nonReconnu: { fr: 'Navigateur non reconnu', en: 'Unrecognised browser', ht: 'Navigatè nou pa rekonèt' },
  vide: { fr: 'Aucune connexion sur la période.', en: 'No sign-in over the period.', ht: 'Pa gen koneksyon sou peryòd la.' },
  page: { fr: 'page', en: 'page', ht: 'paj' },
  precedente: { fr: '← Précédente', en: '← Previous', ht: '← Anvan' },
  suivante: { fr: 'Suivante →', en: 'Next →', ht: 'Apre →' },
  lignes: { fr: 'sessions', en: 'sessions', ht: 'sesyon' },
  action: { fr: 'Action', en: 'Action', ht: 'Aksyon' },
  evenement: { fr: 'Événement', en: 'Event', ht: 'Evènman' },
  compteInconnu: { fr: 'compte inconnu', en: 'unknown account', ht: 'kont enkoni' },
  LOGIN_FAIL: { fr: 'mot de passe refusé', en: 'password rejected', ht: 'modpas refize' },
  '2FA_FAIL': { fr: 'code 2FA refusé', en: '2FA code rejected', ht: 'kòd 2FA refize' },
  LOCKOUT: { fr: 'verrouillage 15 min', en: '15-min lockout', ht: 'blokaj 15 min' },
} as const

const instant = (locale: 'fr' | 'en' | 'ht', d: Date) => formatInstant(locale, d, { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

export default async function AdminConnexionsPage({ params, searchParams }: { params: { locale: string }; searchParams?: Record<string, string | string[] | undefined> }) {
  const { locale } = dictFor(params.locale)
  await requireAdmin(locale)
  const lt = (o: { fr: string; en: string; ht: string }) => o[locale] ?? o.fr
  const filtre = lireFiltre(searchParams)
  const [enCours, journal, echecs, comptes] = await Promise.all([sessionsEnCours(), journalConnexions(filtre), tentativesEchouees(filtre), comptesPourFiltre()])
  const qs = (patch: Record<string, string | number | null | undefined>) => {
    const p = new URLSearchParams()
    const base: Record<string, string | number | null | undefined> = { compte: filtre.compte, jours: filtre.jours, motif: filtre.motif, page: filtre.page, ...patch }
    for (const [k, v] of Object.entries(base)) if (v !== null && v !== undefined && v !== '' && !(k === 'page' && v === 1) && !(k === 'jours' && v === 30)) p.set(k, String(v))
    const s = p.toString()
    return s ? `?${s}` : ''
  }
  const Appareil = ({ l }: { l: { deviceLabel: string | null; userAgent: string | null } }) => {
    const a = appareilDe(l)
    return a.reconnu ? <span>{a.libelle}</span> : <span className="text-ank/80" title={a.ua ?? ''}>{lt(L.nonReconnu)}{a.ua ? ` · ${a.ua.slice(0, 40)}${a.ua.length > 40 ? '…' : ''}` : ''}</span>
  }
  const th = 'px-3 py-2.5 font-semibold'
  const td = 'px-3 py-2 align-top'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-ank">{lt(L.titre)}</h1>
        <p className="mt-0.5 max-w-2xl text-sm text-ank/80">{lt(L.sousTitre)}</p>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-wide text-grafit">{lt(L.zone)}</p>
      </div>

      {/* ── Connexions en cours ── */}
      <section aria-labelledby="en-cours">
        <h2 id="en-cours" className="text-sm font-semibold text-ank">{lt(L.enCours)} <span className="ml-1 font-normal text-grafit">({enCours.length})</span></h2>
        <p className="mb-3 mt-0.5 text-xs text-ank/80">{lt(L.enCoursSub)}</p>
        <div className="overflow-x-auto rounded-2xl border border-chabon/10 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-chabon/10 bg-koton text-left text-[11px] uppercase tracking-wide text-ank/80">
                <th className={th}>{lt(L.compte)}</th><th className={th}>{lt(L.appareil)}</th><th className={th}>{lt(L.ip)}</th><th className={th}>{lt(L.depuis)}</th><th className={th}>{lt(L.derniereActivite)}</th><th className={th}>{lt(L.verification)}</th><th className={`${th} text-right`}>{lt(L.action)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chabon/5">
              {enCours.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-ank/80">{lt(L.aucuneEnCours)}</td></tr>}
              {enCours.map((s) => (
                <tr key={s.id} className="hover:bg-koton/50">
                  <td className={td}><p className="font-medium text-ank">{s.user.email}</p><p className="text-xs text-ank/80">{s.user.role}</p></td>
                  <td className={td}><Appareil l={s} /></td>
                  <td className={`${td} font-mono text-xs`}>{s.ip ?? '—'}</td>
                  <td className={`${td} font-mono text-xs`}>{instant(locale, s.createdAt)}</td>
                  <td className={`${td} font-mono text-xs`}>{s.lastSeenAt ? instant(locale, s.lastSeenAt) : '—'}</td>
                  <td className={`${td} text-xs`}>{lt(LIBELLE_VERIFICATION[verificationDe(s)])}</td>
                  <td className={`${td} text-right`}><FermerSessionBouton sessionId={s.id} locale={locale} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Journal ── */}
      <section aria-labelledby="journal">
        <h2 id="journal" className="text-sm font-semibold text-ank">{lt(L.journal)} <span className="ml-1 font-normal text-grafit">({journal.total.toLocaleString('fr')} {lt(L.lignes)})</span></h2>
        <form method="get" className="mb-3 mt-2 flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col gap-1 text-xs text-ank/80">{lt(L.compte)}
            <select name="compte" defaultValue={filtre.compte ?? ''} className="rounded-lg border border-chabon/15 bg-white px-2 py-1.5 text-sm text-ank">
              <option value="">{lt(L.tousComptes)}</option>
              {comptes.map((c) => <option key={c.id} value={c.id}>{c.email}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-ank/80">{lt(L.periode)}
            <select name="jours" defaultValue={String(filtre.jours)} className="rounded-lg border border-chabon/15 bg-white px-2 py-1.5 text-sm text-ank">
              {JOURS.map((j) => <option key={j} value={j}>{j} {lt(L.jours)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-ank/80">{lt(L.motif)}
            <select name="motif" defaultValue={filtre.motif ?? ''} className="rounded-lg border border-chabon/15 bg-white px-2 py-1.5 text-sm text-ank">
              <option value="">{lt(L.tousMotifs)}</option>
              <option value="EN_COURS">{lt(LIBELLE_MOTIF.EN_COURS)}</option>
              {END_REASONS.map((r) => <option key={r} value={r}>{lt(LIBELLE_MOTIF[r])}</option>)}
            </select>
          </label>
          <button type="submit" className="rounded-lg bg-chabon px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">{lt(L.filtrer)}</button>
          <a href={`/api/admin/connexions/export${qs({ page: null, locale })}`} className="rounded-lg border border-chabon/15 px-3 py-1.5 text-xs font-medium text-grafit hover:bg-koton">{lt(L.exporter)}</a>
        </form>
        <div className="overflow-x-auto rounded-2xl border border-chabon/10 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-chabon/10 bg-koton text-left text-[11px] uppercase tracking-wide text-ank/80">
                <th className={th}>{lt(L.compte)}</th><th className={th}>{lt(L.debut)}</th><th className={th}>{lt(L.fin)}</th><th className={th}>{lt(L.duree)}</th><th className={th}>{lt(L.appareil)}</th><th className={th}>{lt(L.ip)}</th><th className={th}>{lt(L.verification)}</th><th className={th}>{lt(L.motif)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chabon/5">
              {journal.lignes.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-ank/80">{lt(L.vide)}</td></tr>}
              {journal.lignes.map((l) => {
                const motif = motifDe(l)
                const r = l.evictedById ? journal.remplacants.get(l.evictedById) : null
                return (
                  <tr key={l.id} className="hover:bg-koton/50">
                    <td className={td}><p className="font-medium text-ank">{l.user.email}</p></td>
                    <td className={`${td} font-mono text-xs`}>{instant(locale, l.createdAt)}</td>
                    <td className={`${td} font-mono text-xs`}>{l.endedAt ? instant(locale, l.endedAt) : '—'}</td>
                    <td className={`${td} text-xs`}>{duree(l) ?? '—'}</td>
                    <td className={td}><Appareil l={l} /></td>
                    <td className={`${td} font-mono text-xs`}>{l.ip ?? '—'}</td>
                    <td className={`${td} text-xs`}>{lt(LIBELLE_VERIFICATION[verificationDe(l)])}</td>
                    <td className={`${td} text-xs ${motif === 'EVICTED' ? 'text-ank' : motif === 'INCONNU' ? 'text-ank/80' : ''}`}>
                      {lt(LIBELLE_MOTIF[motif])}
                      {motif === 'EVICTED' && r && (
                        <span className="block text-[11px] text-grafit">{lt(L.remplaceePar)} {r.deviceLabel ?? decrireAppareil(null).libelle} · {instant(locale, r.createdAt)}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {journal.pages > 1 && (
          <nav className="mt-2 flex items-center justify-between text-xs text-grafit" aria-label={lt(L.page)}>
            {filtre.page > 1 ? <Link href={qs({ page: filtre.page - 1 })} className="text-chabon hover:underline">{lt(L.precedente)}</Link> : <span />}
            <span>{lt(L.page)} {filtre.page} / {journal.pages} · {PAR_PAGE}</span>
            {filtre.page < journal.pages ? <Link href={qs({ page: filtre.page + 1 })} className="text-chabon hover:underline">{lt(L.suivante)}</Link> : <span />}
          </nav>
        )}
      </section>

      {/* ── Tentatives échouées ── */}
      <section aria-labelledby="echecs">
        <h2 id="echecs" className="text-sm font-semibold text-ank">{lt(L.echecs)} <span className="ml-1 font-normal text-grafit">({echecs.length})</span></h2>
        <p className="mb-3 mt-0.5 text-xs text-ank/80">{lt(L.echecsSub)}</p>
        <div className="overflow-x-auto rounded-2xl border border-chabon/10 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-chabon/10 bg-koton text-left text-[11px] uppercase tracking-wide text-ank/80">
                <th className={th}>{lt(L.debut)}</th><th className={th}>{lt(L.evenement)}</th><th className={th}>{lt(L.compte)}</th><th className={th}>{lt(L.appareil)}</th><th className={th}>{lt(L.ip)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chabon/5">
              {echecs.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-ank/80">{lt(L.aucunEchec)}</td></tr>}
              {echecs.map((e) => {
                let emailMeta: string | null = null
                try { emailMeta = e.metaJson ? (JSON.parse(e.metaJson).email ?? null) : null } catch { /* méta illisible : on ne devine rien */ }
                const action = e.action as 'LOGIN_FAIL' | '2FA_FAIL' | 'LOCKOUT'
                return (
                  <tr key={e.id} className="hover:bg-koton/50">
                    <td className={`${td} font-mono text-xs`}>{instant(locale, e.createdAt)}</td>
                    <td className={`${td} text-xs text-chabon`}>{lt(L[action])}</td>
                    <td className={`${td} text-xs`}>{e.actor?.email ?? emailMeta ?? lt(L.compteInconnu)}</td>
                    <td className={td}><Appareil l={{ deviceLabel: null, userAgent: e.userAgent }} /></td>
                    <td className={`${td} font-mono text-xs`}>{e.ip ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
