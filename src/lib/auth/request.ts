import type { NextRequest } from 'next/server'

/** Contexte client extrait des en-têtes (IP, UA, langue) — consommé par service.ts. */
export interface ClientCtx {
  ip: string | null
  userAgent: string | null
  acceptLang: string | null
}

/**
 * ⚠️ L'ADRESSE IP EST UNE CLÉ DE SÉCURITÉ : elle commande le verrouillage de compte par
 * origine et tous les freins de débit. Elle doit venir d'une source que le client ne peut
 * pas écrire.
 *
 * Sur Vercel, `x-forwarded-for` est SÛR : la plateforme l'écrase et ne relaie pas les IP
 * externes, « pour empêcher l'usurpation » (docs Vercel, Request headers). Un en-tête envoyé
 * par le client est donc jeté. Mais cette garantie tombe le jour où l'on place quoi que ce
 * soit devant Vercel — un Cloudflare, un proxy d'entreprise — ou si l'on héberge ailleurs :
 * `x-forwarded-for` redevient alors une valeur que l'appelant choisit, et avec elle le verrou
 * et les freins deviennent contournables en changeant d'en-tête à chaque requête.
 *
 * On lit donc d'abord les en-têtes que VERCEL pose lui-même et qu'un proxy amont ne peut pas
 * surcharger — `x-vercel-forwarded-for`, puis `x-real-ip` —, et `x-forwarded-for` seulement
 * en dernier recours. La hiérarchie ne change rien au comportement actuel ; elle empêche une
 * évolution d'infrastructure de rouvrir silencieusement la porte.
 */
function premiereAdresse(v: string | null): string | null {
  const a = v?.split(',')[0]?.trim()
  return a && a.length > 0 ? a : null
}

export function getClientCtx(req: NextRequest): ClientCtx {
  const ip =
    premiereAdresse(req.headers.get('x-vercel-forwarded-for')) ??
    premiereAdresse(req.headers.get('x-real-ip')) ??
    premiereAdresse(req.headers.get('x-forwarded-for'))
  return {
    ip,
    userAgent: req.headers.get('user-agent'),
    acceptLang: req.headers.get('accept-language'),
  }
}
