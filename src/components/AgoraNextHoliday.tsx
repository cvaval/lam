import Link from 'next/link'
import { CalendarDays, ChevronRight } from 'lucide-react'
import type { Locale } from '@/lib/types'
import { HOLIDAYS_MAIN, HOLIDAYS_DECREE, getHolidayDate } from '@/lib/agora-holidays'

export function AgoraNextHoliday({ locale }: { locale: Locale }) {
  const tr = (fr: string, en: string, ht: string) => locale === 'en' ? en : locale === 'ht' ? ht : fr
  const parts = new Intl.DateTimeFormat('en', {timeZone:'America/Port-au-Prince',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date())
  const get = (type:string) => Number(parts.find(p=>p.type===type)?.value)
  const year=get('year'), today=year*10000+get('month')*100+get('day')
  const entries=[year,year+1].flatMap(y=>[...HOLIDAYS_MAIN.map(h=>({...h,decree:false})),...HOLIDAYS_DECREE.map(h=>({...h,decree:true}))].map(h=>({...h,date:getHolidayDate(h,y)}))).map(h=>({...h,ordinal:h.date.getFullYear()*10000+(h.date.getMonth()+1)*100+h.date.getDate()})).filter(h=>h.ordinal>=today).sort((a,b)=>a.ordinal-b.ordinal)
  const next=entries[0]
  if(!next)return null
  return <aside className="ag-next-holiday ag-container"><CalendarDays size={27} aria-hidden="true"/><div><p className="ag-eyebrow">{tr('Prochain repère du calendrier','Next calendar date','Pwochen dat kalandriye a')}</p><h2>{locale==='en'?next.en:next.fr}</h2><p>{next.date.toLocaleDateString(locale==='en'?'en-US':'fr-FR',{day:'numeric',month:'long',year:'numeric'})}{next.decree&&<span className="ag-decree-note"> · {tr('Sous réserve de décret présidentiel','Subject to presidential decree','Sou rezèv dekrè prezidansyèl')}</span>}</p></div><Link className="ag-text-link" href={`/${locale}/fetes-legales`}>{tr('Voir le calendrier','View calendar','Gade kalandriye a')}<ChevronRight size={17} aria-hidden="true"/></Link></aside>
}
