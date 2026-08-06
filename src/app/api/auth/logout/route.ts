import { NextResponse } from 'next/server'
import { clearSessionCookie, deleteSessionByToken, getCurrentUser } from '@/lib/auth/session'
import { audit } from '@/lib/auth/audit'

export const runtime = 'nodejs'

/**
 * Déconnexion — le cookie part TOUJOURS et EN PREMIER.
 *
 * Cette route lisait d'abord `getCurrentUser()`, qui interroge la base. Si Prisma jetait,
 * elle répondait 500 et la session n'était jamais détruite ; le client, qui ne regardait pas
 * la réponse, redirigeait quand même vers /login, où le garde « si une session existe, aller
 * au tableau de bord » renvoyait l'utilisateur dans le compte qu'il venait de quitter. C'est
 * le symptôme signalé par la cliente, et la redirection dure le rendrait systématique là où
 * la navigation douce passait à côté du garde.
 *
 * Le retrait du cookie ne dépend plus de rien. La suppression en base et la journalisation
 * sont du meilleur effort, et leur échec est rapporté au client sans remettre en cause la
 * déconnexion elle-même : du point de vue du navigateur, elle EST faite.
 */
export async function POST() {
  const token = clearSessionCookie()

  let baseOk = true
  try {
    const user = await getCurrentUser()
    if (token) await deleteSessionByToken(token)
    if (user) await audit({ action: 'LOGOUT', actorId: user.id })
  } catch (e) {
    baseOk = false
    console.warn('déconnexion : cookie retiré, base injoignable —', e)
  }
  return NextResponse.json({ ok: true, base: baseOk })
}
