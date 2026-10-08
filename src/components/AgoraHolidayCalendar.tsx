'use client'

import { useState } from 'react'
import { CalendarDays, Download } from 'lucide-react'
import type { Locale } from '@/lib/types'
import { HOLIDAYS_MAIN, HOLIDAYS_DECREE, getHolidayDate, type Holiday } from '@/lib/agora-holidays'

/** Adapted from Equinox's FetesPage: same source data and movable-date calculations. */
export function AgoraHolidayCalendar({ locale, initialYear }: { locale: Locale; initialYear: number }) {
  const [year, setYear] = useState(initialYear)
  const [selected, setSelected] = useState<string | null>(null)
  const tr = (fr: string, en: string, ht: string) => locale === 'en' ? en : locale === 'ht' ? ht : fr
  const loc = locale === 'en' ? 'en-US' : 'fr-FR'
  const name = (h: Holiday) => locale === 'en' ? h.en : h.fr
  const entries = [...HOLIDAYS_MAIN.map(h => ({...h, source: 'main'})), ...HOLIDAYS_DECREE.map(h => ({...h, source: 'decree'}))].map(h => ({...h, date: getHolidayDate(h, year)})).sort((a,b) => a.date.getTime()-b.date.getTime())
  const key = (date: Date) => `${date.getMonth()}-${date.getDate()}`
  const category = (h: typeof entries[number]) => h.source === 'decree' ? 'decree' : h.type === 'national' ? 'national' : 'legal'
  const labels = { national: tr('Fête nationale','National holiday','Fèt nasyonal'), legal: tr('Fête légale','Legal holiday','Fèt legal'), decree: tr('Sous réserve de décret','Subject to decree','Sou rezèv dekrè') }
  const exportCalendar = () => {
    const dateValue = (d: Date) => `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
    const escape = (s: string) => s.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;')
    const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Agora//Haiti Holidays//FR','CALSCALE:GREGORIAN',`X-WR-CALNAME:Agora - Haiti ${year}`]
    for (const h of entries) {
      const end = new Date(h.date); end.setDate(end.getDate()+1)
      lines.push('BEGIN:VEVENT',`UID:${year}-${h.d}@agora.ht`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,`DTSTART;VALUE=DATE:${dateValue(h.date)}`,`DTEND;VALUE=DATE:${dateValue(end)}`,`SUMMARY:${escape(name(h))}`,`DESCRIPTION:${escape(labels[category(h)])}`,'END:VEVENT')
    }
    lines.push('END:VCALENDAR')
    const url = URL.createObjectURL(new Blob([lines.join('\r\n')+'\r\n'], {type:'text/calendar;charset=utf-8'}))
    const anchor = document.createElement('a'); anchor.href=url; anchor.download=`agora-fetes-haiti-${year}.ics`; anchor.click(); URL.revokeObjectURL(url)
  }
  return <section id="fetes-legales" className="ag-holidays"><div className="ag-container">
    <div className="ag-section-heading"><div><p className="ag-eyebrow">{tr('Les repères du calendrier','Calendar references','Referans kalandriye a')}</p><h2>{tr('Fêtes légales haïtiennes','Haitian public holidays','Jou ferye ayisyen yo')}</h2></div><button className="ag-button ag-calendar-export" onClick={exportCalendar}><Download size={17} aria-hidden="true" />{tr('Télécharger le calendrier','Download calendar','Telechaje kalandriye a')} (.ics)</button></div>
    <div className="ag-calendar-toolbar"><CalendarDays size={23} aria-hidden="true" /><label htmlFor="ag-calendar-year">{tr('Année','Year','Ane')}</label><select id="ag-calendar-year" value={year} onChange={e=>{setYear(Number(e.target.value));setSelected(null)}}>{Array.from({length:21},(_,i)=>initialYear-5+i).map(y=><option key={y} value={y}>{y}</option>)}</select><span>{tr('Sélectionnez une date colorée pour voir la fête.','Select a highlighted date to view the holiday.','Chwazi yon dat ki gen koulè pou wè fèt la.')}</span></div>
    <div className="ag-calendar-layout"><aside className="ag-holiday-list"><h3>{tr('Les dates à retenir','Dates to remember','Dat pou sonje')} · {year}</h3>{locale==='ht'&&<p className="ag-small-note">Non fèt yo prezante an franse.</p>}{entries.map(h=><button key={h.d} onClick={()=>setSelected(key(h.date))} aria-pressed={selected===key(h.date)} className="ag-holiday-entry"><time>{h.date.toLocaleDateString(loc,{day:'numeric',month:'long'})}</time><strong>{name(h)}</strong><span className={`ag-holiday-badge ${category(h)}`}>{labels[category(h)]}</span>{h.religious&&<small>{tr('Fête religieuse','Religious holiday','Fèt relijye')}</small>}</button>)}</aside>
    <div><div className="ag-calendar-legend">{Object.entries(labels).map(([k,v])=><span key={k}><i className={k}/>{v}</span>)}</div><div className="ag-calendar-months">{Array.from({length:12},(_,month)=>{
      const offset=(new Date(year,month,1).getDay()+6)%7
      const count=new Date(year,month+1,0).getDate()
      return <div className="ag-calendar-month" key={month}><h3>{new Date(year,month,1).toLocaleDateString(loc,{month:'long'})}</h3><div className="ag-calendar-days weekdays">{(locale==='en'?['M','T','W','T','F','S','S']:['L','M','M','J','V','S','D']).map((d,i)=><span key={i} aria-hidden="true">{d}</span>)}</div><div className="ag-calendar-days">{Array.from({length:offset},(_,i)=><span key={`empty-${i}`}/>)}{Array.from({length:count},(_,i)=>{
        const day=i+1; const matches=entries.filter(h=>h.date.getMonth()===month&&h.date.getDate()===day); const id=`${month}-${day}`
        return matches.length?<button key={day} className={`ag-calendar-day ${category(matches[0])}`} aria-pressed={selected===id} aria-label={`${day} ${new Date(year,month,1).toLocaleDateString(loc,{month:'long'})} ${year} : ${matches.map(name).join(', ')}`} title={matches.map(name).join(', ')} onClick={()=>setSelected(id)}>{day}</button>:<span key={day}>{day}</span>
      })}</div></div>
    })}</div><div className="ag-calendar-detail" aria-live="polite">{selected&&entries.filter(h=>key(h.date)===selected).map(h=><p key={h.d}><strong>{name(h)}</strong> · {h.date.toLocaleDateString(loc,{day:'numeric',month:'long',year:'numeric'})}<br/>{labels[category(h)]}</p>)}</div><p className="ag-calendar-note">{tr('Les fêtes nationales sont chômées dans l’administration publique, le commerce et les écoles. Les dates signalées « Sous réserve de décret » peuvent être déclarées fériées par décret présidentiel : leur application doit être confirmée par les annonces officielles.','National holidays are observed by public administration, commerce and schools. Dates marked “Subject to decree” may be declared public holidays by presidential decree: confirm their application through official announcements.','Administrasyon piblik, komès ak lekòl yo chome pou fèt nasyonal yo. Dat ki make « Sou rezèv dekrè » ka deklare jou ferye pa dekrè prezidansyèl : verifye aplikasyon yo nan anons ofisyèl yo.')}</p></div></div>
  </div></section>
}
