import { BRAND } from './brand'
/**
 * E-mail transactionnel via Resend (API HTTP — aucune dépendance SMTP).
 *  - RESEND_API_KEY défini  → envoi réel (expéditeur = MAIL_FROM).
 *  - sinon (dev)            → journalisé en console.
 * Best-effort : un échec d'envoi est journalisé mais ne fait JAMAIS échouer le flux
 * appelant (activation de compte, verrouillage…). L'e-mail de bienvenue est bilingue.
 */
const MAIL_FROM = process.env.MAIL_FROM || `${BRAND.name} <no-reply@${BRAND.domain}>`

export async function sendMail(opts: { to: string; subject: string; text: string }) {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    // eslint-disable-next-line no-console
    console.log(`\n📧  [MAIL → ${opts.to}] ${opts.subject}\n${opts.text}\n`)
    return
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: MAIL_FROM, to: opts.to, subject: opts.subject, text: opts.text }),
    })
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(`[mail] Resend ${res.status} pour ${opts.to} : ${(await res.text()).slice(0, 200)}`)
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`[mail] échec d'envoi à ${opts.to} :`, (e as Error).message)
  }
}

export function welcomeEmail(email: string, role: string) {
  return {
    to: email,
    subject: 'Bienvenue sur Lam · Welcome to Lam',
    text: [
      `Bonjou,`,
      ``,
      `Votre accès Lam (${role}) a été activé. À votre première connexion, vous`,
      `configurerez l'authentification à deux facteurs (2FA) obligatoire.`,
      ``,
      `Your Lam access (${role}) has been activated. On your first sign-in, you`,
      `will set up mandatory two-factor authentication (2FA).`,
      ``,
      `— ${BRAND.name} · ${BRAND.baseline.fr} · ${BRAND.domain}`,
    ].join('\n'),
  }
}

export function lockoutEmail(email: string, minutes: number) {
  return {
    to: email,
    subject: 'Alerte de sécurité Lam · Security alert',
    text:
      `Plusieurs tentatives de connexion ont échoué sur votre compte. Il est verrouillé ${minutes} minutes.\n` +
      `Several sign-in attempts failed on your account. It is locked for ${minutes} minutes.`,
  }
}
