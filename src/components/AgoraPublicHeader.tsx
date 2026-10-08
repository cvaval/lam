import Link from 'next/link'
import { LocaleSwitcher } from './LocaleSwitcher'
import type { Locale } from '@/lib/types'
export function AgoraPublicHeader({locale}:{locale:Locale}) {
 const tr=(fr:string,en:string,ht:string)=>locale==='en'?en:locale==='ht'?ht:fr
 return <header className="ag-header"><div className="ag-container ag-header-inner"><Link href={`/${locale}`} className="ag-brand" aria-label="Agora"><img src="/brand/agora/logo.png" alt="agora.ht" width="190" height="63"/></Link><nav className="ag-nav" aria-label={tr('Navigation principale','Main navigation','Navigasyon prensipal')}><Link href={`/${locale}/juridictions`} aria-current="page">{tr('Carte judiciaire','Judicial map','Kat jidisyè')}</Link><Link href={`/${locale}#jours-francs`}>{tr('Jours francs','Clear days','Jou fran')}</Link><Link href={`/${locale}/fetes-legales`}>{tr('Fêtes légales','Public holidays','Jou ferye')}</Link></nav><div className="ag-header-actions"><div className="ag-language"><LocaleSwitcher current={locale}/></div><Link className="ag-button ag-login" href={`/${locale}/login`}>{tr('Accès sécurisé','Secure access','Aksè sekirize')}</Link></div></div></header>
}
