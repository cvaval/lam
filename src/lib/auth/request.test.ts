/**
 * Source de l'adresse IP — clé de sécurité.
 *
 * Elle commande le verrouillage par origine et tous les freins de débit. Si le client peut
 * l'écrire, les deux tombent ensemble : il suffit de changer d'en-tête à chaque requête.
 *
 * Sur Vercel, `x-forwarded-for` est sûr — la plateforme l'écrase pour empêcher l'usurpation.
 * Ces contrôles verrouillent la PRIORITÉ des en-têtes, afin qu'un jour où l'on placerait un
 * proxy devant Vercel, la garantie ne disparaisse pas en silence.
 */
import { describe, it, expect } from 'vitest'
import { getClientCtx } from './request'

const req = (h: Record<string, string>) =>
  ({ headers: new Headers(h) }) as unknown as Parameters<typeof getClientCtx>[0]

describe('adresse IP du client', () => {
  it('l’en-tête posé par Vercel prime sur celui que le client peut écrire', () => {
    const ctx = getClientCtx(req({ 'x-vercel-forwarded-for': '203.0.113.7', 'x-forwarded-for': '10.0.0.1' }))
    expect(ctx.ip).toBe('203.0.113.7')
  })

  it('x-real-ip vient avant x-forwarded-for', () => {
    expect(getClientCtx(req({ 'x-real-ip': '203.0.113.8', 'x-forwarded-for': '10.0.0.1' })).ip).toBe('203.0.113.8')
  })

  it('x-forwarded-for ne sert qu’en dernier recours', () => {
    expect(getClientCtx(req({ 'x-forwarded-for': '203.0.113.9' })).ip).toBe('203.0.113.9')
  })

  it('une liste rend le premier bond, sans espaces parasites', () => {
    expect(getClientCtx(req({ 'x-vercel-forwarded-for': ' 203.0.113.10 , 70.1.2.3 ' })).ip).toBe('203.0.113.10')
  })

  it('un en-tête vide ne masque pas la source suivante', () => {
    // Piège : une chaîne vide est falsy, mais « , » ne l'est pas — d'où le contrôle de longueur.
    expect(getClientCtx(req({ 'x-vercel-forwarded-for': '', 'x-real-ip': '203.0.113.11' })).ip).toBe('203.0.113.11')
    expect(getClientCtx(req({ 'x-vercel-forwarded-for': ' , ', 'x-real-ip': '203.0.113.12' })).ip).toBe('203.0.113.12')
  })

  it('sans aucun en-tête, l’adresse est nulle — jamais une chaîne vide', () => {
    // Une chaîne vide serait une CLÉ DE SEAU partagée par tous : le frein grouperait alors
    // des visiteurs sans rapport. `null` fait retomber les gardes sur leur repli explicite.
    expect(getClientCtx(req({})).ip).toBeNull()
  })
})
