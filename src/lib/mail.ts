import { BRAND } from './brand'
/**
 * E-mail transactionnel. Sans SMTP_URL (dev), les messages sont journalisés dans la
 * console — suffisant pour la démonstration. En production, brancher Nodemailer/SES.
 *
 * L'e-mail de bienvenue est bilingue (FR/EN) — déclenché par l'activation (§08).
 */
export async function sendMail(opts: { to: string; subject: string; text: string }) {
  if (!process.env.SMTP_URL) {
    // eslint-disable-next-line no-console
    console.log(`\n📧  [MAIL → ${opts.to}] ${opts.subject}\n${opts.text}\n`)
    return
  }
  // Production : intégrer le transport SMTP ici.
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
