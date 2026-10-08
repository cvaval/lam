'use client'

import { useState } from 'react'
import { CalendarDays, Download } from 'lucide-react'
import type { Locale } from '@/lib/types'
import type { EntreeCalendrier } from '@/lib/delais/feries'
import { dayOfWeek, joursDansLeMois, formatIso } from '@/lib/delais/civil'
import { dateEnToutesLettres, nomMois } from '@/lib/delais/format'
import { fetesDeLAnnee, PREMIERE_ANNEE_PUBLIQUE, type CategoriePublique, type FetePublique } from '@/lib/agora-holidays'

/**
 * Calendrier public des fêtes. Les entrées viennent de la page (base, avec repli sur le
 * calendrier du code) : c'est le calendrier du calculateur de délais, présenté — voir
 * `src/lib/agora-holidays.ts` pour la raison.
 */
export function AgoraHolidayCalendar({
  locale,
  initialYear,
  entrees,
}: {
  locale: Locale
  initialYear: number
  entrees: readonly EntreeCalendrier[]
}) {
  const [year, setYear] = useState(initialYear)
  const [selected, setSelected] = useState<string | null>(null)
  const tr = (fr: string, en: string, ht: string) => (locale === 'en' ? en : locale === 'ht' ? ht : fr)
  const fetes = fetesDeLAnnee(entrees, year, locale)
  const labels: Record<CategoriePublique, string> = {
    nationale: tr('Fête nationale', 'National holiday', 'Fèt nasyonal'),
    legale: tr('Fête légale', 'Legal holiday', 'Fèt legal'),
    arrete: tr('Chômé certaines années, par arrêté', 'Some years only, by order', 'Kèk ane sèlman, pa arete'),
  }
  // Les libellés n'ont pas de traduction relue : ils s'affichent en français (repli de `libelle`).
  const libellesEnFrancais = locale !== 'fr' && !entrees.some((e) => e.traductionRelue)
  const annees = Array.from({ length: 11 }, (_, i) => Math.max(PREMIERE_ANNEE_PUBLIQUE, initialYear - 1) + i)
  // « 1er janvier » en français et en créole, comme `dateEnToutesLettres`.
  const jourCourt = (f: FetePublique) => `${f.date.d === 1 && locale !== 'en' ? '1er' : f.date.d} ${nomMois(f.date.m, locale)}`

  const exportCalendar = () => {
    const ics = (iso: string) => iso.replace(/-/g, '')
    const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Agora//Fetes legales//FR', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:Agora - Haïti ${year}`]
    for (const f of fetes) {
      if (f.categorie === 'arrete') continue // pas un jour férié : rien à inscrire à l'agenda
      const fin = new Date(Date.UTC(f.date.y, f.date.m - 1, f.date.d + 1)).toISOString().slice(0, 10)
      lines.push('BEGIN:VEVENT', `UID:${year}-${f.cle}@agora.ht`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${ics(formatIso(f.date))}`, `DTEND;VALUE=DATE:${ics(fin)}`, `SUMMARY:${escape(f.libelle)}`, `DESCRIPTION:${escape(`${labels[f.categorie]} — ${f.source}`)}`, 'END:VEVENT')
    }
    lines.push('END:VCALENDAR')
    const url = URL.createObjectURL(new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `agora-fetes-haiti-${year}.ics`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section id="fetes-legales" className="ag-holidays">
      <div className="ag-container">
        <div className="ag-section-heading">
          <div>
            <p className="ag-eyebrow">{tr('Les repères du calendrier', 'Calendar references', 'Referans kalandriye a')}</p>
            <h2>{tr('Fêtes légales haïtiennes', 'Haitian public holidays', 'Jou ferye ayisyen yo')}</h2>
          </div>
          <button className="ag-button ag-calendar-export" onClick={exportCalendar}>
            <Download size={17} aria-hidden="true" />
            {tr('Télécharger le calendrier', 'Download calendar', 'Telechaje kalandriye a')} (.ics)
          </button>
        </div>

        <div className="ag-calendar-toolbar">
          <CalendarDays size={23} aria-hidden="true" />
          <label htmlFor="ag-calendar-year">{tr('Année', 'Year', 'Ane')}</label>
          <select id="ag-calendar-year" value={year} onChange={(e) => { setYear(Number(e.target.value)); setSelected(null) }}>
            {annees.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <span>{tr('Sélectionnez une date marquée pour voir la fête et sa source.', 'Select a marked date to see the holiday and its source.', 'Chwazi yon dat ki make pou wè fèt la ak sous li.')}</span>
        </div>

        <div className="ag-calendar-layout">
          <aside className="ag-holiday-list">
            <h3>{tr('Les dates à retenir', 'Dates to remember', 'Dat pou sonje')} · {year}</h3>
            {libellesEnFrancais && (
              <p className="ag-small-note">
                {locale === 'en' ? 'Holiday names are given in French, as in the texts.' : 'Non fèt yo bay an franse, jan tèks yo ekri yo.'}
              </p>
            )}
            {fetes.map((f) => (
              <button key={f.cle} onClick={() => setSelected(formatIso(f.date))} aria-pressed={selected === formatIso(f.date)} className="ag-holiday-entry">
                <time dateTime={formatIso(f.date)}>{jourCourt(f)}</time>
                <strong>{f.libelle}</strong>
                <span className={`ag-holiday-badge ${f.categorie}`}>{labels[f.categorie]}</span>
                {f.demiJournee && <small>{tr('Demi-journée', 'Half day', 'Mwatye jounen')}</small>}
              </button>
            ))}
          </aside>

          <div>
            <div className="ag-calendar-legend">
              {(Object.keys(labels) as CategoriePublique[]).map((k) => <span key={k}><i className={k} />{labels[k]}</span>)}
            </div>
            <div className="ag-calendar-months">
              {Array.from({ length: 12 }, (_, i) => {
                const mois = i + 1
                const decalage = (dayOfWeek({ y: year, m: mois, d: 1 }) + 6) % 7 // semaine du lundi
                return (
                  <div className="ag-calendar-month" key={mois}>
                    <h3>{nomMois(mois, locale)}</h3>
                    <div className="ag-calendar-days weekdays">
                      {(locale === 'en' ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : locale === 'ht' ? ['L', 'M', 'M', 'J', 'V', 'S', 'D'] : ['L', 'M', 'M', 'J', 'V', 'S', 'D']).map((d, j) => <span key={j} aria-hidden="true">{d}</span>)}
                    </div>
                    <div className="ag-calendar-days">
                      {Array.from({ length: decalage }, (_, j) => <span key={`vide-${j}`} />)}
                      {Array.from({ length: joursDansLeMois(year, mois) }, (_, j) => {
                        const jour = j + 1
                        const iso = formatIso({ y: year, m: mois, d: jour })
                        const ce = fetes.filter((f) => formatIso(f.date) === iso)
                        if (!ce.length) return <span key={jour}>{jour}</span>
                        const noms = ce.map((f) => `${f.libelle} (${labels[f.categorie]})`).join(', ')
                        return (
                          <button key={jour} className={`ag-calendar-day ${ce[0].categorie}`} aria-pressed={selected === iso} aria-label={`${dateEnToutesLettres(ce[0].date, locale)} : ${noms}`} title={noms} onClick={() => setSelected(iso)}>
                            {jour}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="ag-calendar-detail" aria-live="polite">
              {selected && fetes.filter((f) => formatIso(f.date) === selected).map((f) => (
                <p key={f.cle}>
                  <strong>{f.libelle}</strong> · {dateEnToutesLettres(f.date, locale)}
                  <br />
                  {labels[f.categorie]}
                  {f.note && <><br />{f.note}</>}
                  <br />
                  <small>{tr('Source', 'Source', 'Sous')} : {f.source}</small>
                </p>
              ))}
            </div>

            <p className="ag-calendar-note">
              {tr(
                'Les fêtes nationales sont celles de la Constitution (art. 275.1) ; les fêtes légales, celles du décret du 11 décembre 2024. Les jours « chômés certaines années » ne sont pas fériés : ils ne le deviennent que si un arrêté le décide, l’année venue. C’est le calendrier qu’applique le calculateur de délais de la plateforme.',
                'National holidays are those of the Constitution (art. 275.1); legal holidays, those of the decree of 11 December 2024. Days marked “some years only” are not public holidays: they become so only if an order so decides, in a given year. This is the calendar the platform’s deadline calculator applies.',
                'Fèt nasyonal yo se sa Konstitisyon an bay (atik 275.1) ; fèt legal yo, sa dekrè 11 desanm 2024 la bay. Jou ki make « kèk ane sèlman » yo pa jou ferye : yo vin ferye sèlman si yon arete deside sa, ane a rive. Se kalandriye sa a kalkilatè delè platfòm nan aplike.',
              )}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
