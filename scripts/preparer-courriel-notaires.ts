/**
 * PRÉPARATION du courriel aux notaires (`Agora/emails/invitation-notaires.html`) — AUCUN ENVOI.
 *
 *   npx tsx scripts/preparer-courriel-notaires.ts --modele <html> --destinataires <csv privé> --sortie <dossier privé>
 *   npx tsx scripts/preparer-courriel-notaires.ts --modele <html> --depuis-base --sortie <dossier privé>
 *
 *  - `--destinataires` : CSV `courriel;nom;notaryId` (l'identifiant est facultatif ; le nom doit alors
 *    désigner UNE inscription, rapprochement EXACT) ;
 *  - `--depuis-base` : les courriels PUBLIÉS des études (une ligne par courriel, identifiant connu) ;
 *  - lecture seule ; base = `DATABASE_URL` de l'environnement (le script ne lit PAS `.env`) ;
 *  - le modèle est vérifié (`{{lien_fiche_notaire}}`, `{{nom}}`, bouton « Consulter mes informations ») ;
 *  - UNE ligne bloquée (rapprochement ambigu ou incertain, lien manquant…) ⇒ AUCUN fichier d'envoi :
 *    seul le rapport est écrit, et le script sort en erreur ;
 *  - tout est écrit HORS du dépôt (public) : la liste porte des courriels.
 * Le fichier `envoi-pret-*.csv` (courriel, nom, notaryId, lien_fiche_notaire) alimente l'outil
 * d'envoi ; `{{nom}}` y est en clair : l'outil doit l'échapper en HTML.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { readEmails } from '../src/lib/jurisdictions/coordonnees'
import type { NotaireRef } from './lib/import-notaires-docx'
import { lireCsvDestinataires, preparerEnvoi, verifierModele, type Destinataire } from './lib/preparer-courriel-notaires'

const prisma = new PrismaClient()
const DEPOT = resolve(__dirname, '..')

function args() {
  const a = process.argv.slice(2)
  const val = (k: string) => (a.includes(k) ? a[a.indexOf(k) + 1] : undefined)
  const modele = val('--modele')
  const sortie = val('--sortie')
  const destinataires = val('--destinataires')
  const depuisBase = a.includes('--depuis-base')
  if (!modele || !sortie || (!destinataires && !depuisBase)) throw new Error('--modele, --sortie et (--destinataires | --depuis-base) sont requis')
  const dossier = resolve(sortie)
  if (!relative(DEPOT, dossier).startsWith('..') || /(^|\/)public(\/|$)/.test(dossier)) throw new Error(`sortie refusée : « ${dossier} » est dans le dépôt (public) ou un dossier public`)
  return { modele: resolve(modele), dossier, destinataires: destinataires ? resolve(destinataires) : null, depuisBase, origine: val('--origine'), locale: val('--locale') }
}

const csv = (v: string) => (/[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

async function main() {
  const o = args()
  const manques = verifierModele(readFileSync(o.modele, 'utf8'))
  if (manques.length) {
    for (const m of manques) console.error(`✗ modèle : ${m}`)
    process.exit(1)
  }
  const notaires = await prisma.notary.findMany({ select: { id: true, fullName: true, displayName: true, active: true, commune: { select: { name: true } } } })
  const refs: NotaireRef[] = notaires.map((n) => ({ id: n.id, fullName: n.fullName, displayName: n.displayName, active: n.active, communeName: n.commune?.name ?? null }))
  let liste: Destinataire[]
  if (o.destinataires) liste = lireCsvDestinataires(readFileSync(o.destinataires, 'utf8'))
  else {
    const fiches = await prisma.notaryContact.findMany({ where: { active: true, notary: { active: true } }, select: { notaryId: true, email: true, emailsJson: true } })
    liste = fiches.flatMap((f) => readEmails(f.emailsJson, f.email).map((courriel) => ({ courriel, nom: '', notaryId: f.notaryId })))
      .map((d, i) => ({ ...d, ligne: i + 1 }))
  }
  const { prets, bloques } = preparerEnvoi(liste, refs, { origine: o.origine, locale: o.locale })

  mkdirSync(o.dossier, { recursive: true })
  const horodatage = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const r: string[] = [`# Préparation du courriel aux notaires — ${bloques.length ? 'BLOQUÉE' : 'prête'} (aucun envoi)`, '']
  r.push(`- modèle : ${o.modele}`, `- source : ${o.destinataires ?? 'courriels publiés en base'}`, `- destinataires : ${liste.length} · prêts : ${prets.length} · bloqués : ${bloques.length}`, '')
  if (bloques.length) {
    r.push('## Lignes bloquées (à corriger avant toute préparation)', '', '| ligne | courriel | nom | motif |', '|---|---|---|---|')
    for (const b of bloques) r.push(`| ${b.ligne} | ${b.courriel} | ${b.nom} | ${b.motif} |`)
    r.push('')
  }
  r.push('## Liens personnalisés', '', '| courriel | nom | fiche |', '|---|---|---|')
  for (const p of prets) r.push(`| ${p.courriel} | ${p.nom} | ${p.lien_fiche_notaire} |`)
  const rapport = join(o.dossier, `courriel-notaires-preparation-${horodatage}.md`)
  writeFileSync(rapport, `${r.join('\n')}\n`)
  console.log(`  rapport : ${rapport}`)
  if (bloques.length || !prets.length) {
    console.error(`✗ préparation BLOQUÉE : ${bloques.length} ligne(s) à trancher${prets.length ? '' : ', aucun destinataire prêt'} — aucun fichier d'envoi produit.`)
    await prisma.$disconnect()
    process.exit(1)
  }
  const fichier = join(o.dossier, `envoi-pret-${horodatage}.csv`)
  writeFileSync(fichier, ['courriel;nom;notaryId;lien_fiche_notaire', ...prets.map((p) => [p.courriel, p.nom, p.notaryId, p.lien_fiche_notaire].map(csv).join(';'))].join('\n') + '\n')
  console.log(`✓ ${prets.length} destinataire(s) prêt(s) : ${fichier} — AUCUN courriel envoyé.`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
