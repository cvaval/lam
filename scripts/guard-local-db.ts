/**
 * Garde-fou anti-catastrophe (audit 2 juil. 2026) : refuse de continuer si la base n'est pas
 * locale. Placé AVANT `prisma db push --force-reset` dans `db:reset` pour empêcher la
 * réinitialisation accidentelle de la production. Contournement explicite : --allow-remote.
 */
import { readFileSync } from 'node:fs'

function urlFromEnvOrDotenv(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try {
    const line = readFileSync('.env', 'utf8').split('\n').find((l) => l.trim().startsWith('DATABASE_URL='))
    return line ? line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') : ''
  } catch {
    return ''
  }
}

const url = urlFromEnvOrDotenv()
const local = url.includes('localhost') || /@(127\.0\.0\.1|::1)[:/]/.test(url)
if (!local && !process.argv.includes('--allow-remote')) {
  console.error('⛔ db:reset refusé : la base ne semble pas locale (' + (url.split('@')[1] ?? url).slice(0, 40) + '…).')
  console.error('   Cette commande EFFACE toute la base (--force-reset). Pour forcer : ajouter --allow-remote.')
  process.exit(1)
}
console.log('✓ base locale confirmée — db:reset autorisé.')
