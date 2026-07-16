import { BRAND } from './brand'
import { resolveLocale } from './i18n/config'
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

/** Une alerte et ses nouveaux documents, pour l'e-mail de veille quotidien. */
export interface AlertDigestItem {
  label: string
  docs: { id: string; title: string; ref: string | null }[]
  /** correspondances au-delà des docs listés (bornées par l'e-mail, pas perdues) */
  more: number
}

/**
 * E-mail de veille (§ alertes) : un envoi par utilisateur, toutes ses alertes
 * regroupées, dans la langue de son compte. Liens profonds vers les fiches.
 */
export function alertDigestEmail(to: string, locale: string, items: AlertDigestItem[]) {
  const lang = resolveLocale(locale)
  const L = (
    {
      fr: {
        subject: 'Veille Lam — nouveaux documents',
        intro: 'De nouveaux documents correspondent à vos alertes de veille :',
        alert: 'Alerte',
        more: (n: number) => `  … et ${n} autre${n > 1 ? 's' : ''} — voyez la recherche`,
        manage: 'Gérer vos alertes : ',
      },
      en: {
        subject: 'Lam watch — new documents',
        intro: 'New documents match your watch alerts:',
        alert: 'Alert',
        more: (n: number) => `  … and ${n} more — see search`,
        manage: 'Manage your alerts: ',
      },
      ht: {
        subject: 'Veyè Lam — nouvo dokiman',
        intro: 'Nouvo dokiman koresponn ak alèt veyè ou yo:',
        alert: 'Alèt',
        more: (n: number) => `  … ak ${n} lòt ankò — gade rechèch la`,
        manage: 'Jere alèt ou yo: ',
      },
    } as const
  )[lang]

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? `https://${BRAND.domain}`).replace(/\/$/, '')
  const lines: string[] = [`Bonjou,`, ``, L.intro, ``]
  for (const item of items) {
    lines.push(`${L.alert} « ${item.label} » :`)
    for (const d of item.docs) {
      lines.push(`  · ${d.title}${d.ref ? ` — ${d.ref}` : ''}`)
      lines.push(`    ${base}/${lang}/doc/${d.id}`)
    }
    if (item.more > 0) lines.push(L.more(item.more))
    lines.push(``)
  }
  lines.push(`${L.manage}${base}/${lang}/account`, ``, `— ${BRAND.name} · ${BRAND.domain}`)
  return { to, subject: L.subject, text: lines.join('\n') }
}

export function resetPasswordEmail(email: string, link: string, minutes: number) {
  return {
    to: email,
    subject: 'Réinitialisation de votre mot de passe Lam · Password reset',
    text: [
      `Bonjou,`,
      ``,
      `Vous avez demandé à réinitialiser votre mot de passe Lam. Ouvrez ce lien`,
      `(valable ${minutes} minutes) pour choisir un nouveau mot de passe :`,
      link,
      ``,
      `Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre`,
      `mot de passe reste inchangé.`,
      ``,
      `— — —`,
      ``,
      `You requested a password reset for your Lam account. Open this link`,
      `(valid for ${minutes} minutes) to choose a new password:`,
      link,
      ``,
      `If you didn't request this, ignore this email — your password stays unchanged.`,
      ``,
      `— ${BRAND.name} · ${BRAND.domain}`,
    ].join('\n'),
  }
}
