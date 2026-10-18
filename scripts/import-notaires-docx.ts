/**
 * Import des coordonnées de notaires depuis un document Word (« Notaires.docx »).
 *
 *   npx tsx scripts/import-notaires-docx.ts --file <docx> --rapport <dossier privé>            # SIMULATION
 *   npx tsx scripts/import-notaires-docx.ts --file <docx> --rapport <dossier privé> --apply    # base LOCALE seulement
 *   … --decisions <fichier privé .json>   # décisions de la cliente sur les entrées (voir decisionsSchema)
 *   … --apply --cible <hôte:port/base> --autorisation "<qui, quand, quoi>"   # base NON locale : sur autorisation écrite seulement
 *
 * ⚠️ BASE VISÉE = `DATABASE_URL` DE L'ENVIRONNEMENT, rien d'autre (le script ne lit PAS `.env`,
 * qui pointe sur la PRODUCTION). Elle est affichée en tête de rapport. `--apply` est REFUSÉ hors
 * d'une base locale clairement identifiée (hôte localhost, base `lam_banc` ou celle que nomme
 * `IMPORT_NOTAIRES_BASE_LOCALE`). Sur la production : simulation, puis — SUR AUTORISATION ÉCRITE de
 * la cliente — `--cible` (la base visée, recopiée : elle doit être celle qu'affiche la simulation)
 * et `--autorisation` (citée dans le journal d'audit). Sans les deux, rien n'est écrit.
 *
 * ⚠️ RAPPORT PRIVÉ : le dépôt est public ; le dossier du rapport doit être HORS du dépôt (refusé
 * sinon). Le rapport contient les numéros et courriels du document, y compris ceux qui ne sont
 * pas publiés (personnels, attribués à un tiers).
 *
 * Garanties : règles dans scripts/lib/import-notaires-docx.ts (rapprochement, priorité de
 * l'existant, normalisation) ; idempotent (complétions conditionnelles, propositions par
 * `sourceKey`) ; ÉCRITURE CONDITIONNELLE — un champ rempli entre la simulation et l'écriture n'est
 * pas écrasé (l'écart devient une proposition) ; aucune inscription créée ; aucun badge
 * « Confirmé » ; audit JUDICIAL_IMPORT recompté après coup.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'
import mammoth from 'mammoth'
import { PrismaClient } from '@prisma/client'
import { audit } from '../src/lib/auth/audit'
import { formatPhone, readEmails, readPhones } from '../src/lib/jurisdictions/coordonnees'
import { lireDecisions, lireEntrees, planifier, texteDepuisHtml, type Decision, type Existant, type NotaireRef, type PlanEntree } from './lib/import-notaires-docx'
import { appliquer, type Resultat } from './lib/import-notaires-docx-ecriture'

const prisma = new PrismaClient()
const DEPOT = resolve(__dirname, '..')

function args() {
  const a = process.argv.slice(2)
  const val = (k: string) => (a.includes(k) ? a[a.indexOf(k) + 1] : undefined)
  const file = val('--file')
  const rapport = val('--rapport')
  if (!file || !rapport) throw new Error('--file <docx> et --rapport <dossier privé> sont requis')
  const dossier = resolve(rapport)
  const rel = relative(DEPOT, dossier)
  if (!rel.startsWith('..') || /(^|\/)public(\/|$)/.test(dossier)) throw new Error(`rapport refusé : « ${dossier} » est dans le dépôt (public) ou un dossier public`)
  // Les décisions portent des coordonnées (adresses rectifiées) : hors du dépôt, comme le rapport.
  const decisions = val('--decisions') ? resolve(val('--decisions')!) : null
  if (decisions && !relative(DEPOT, decisions).startsWith('..')) throw new Error(`décisions refusées : « ${decisions} » est dans le dépôt (public)`)
  return { file: resolve(file), dossier, apply: a.includes('--apply'), dateDocument: val('--date-document'), decisions, cible: val('--cible') ?? null, autorisation: val('--autorisation')?.trim() || null }
}

function base(): { libelle: string; locale: boolean } {
  try {
    const u = new URL(process.env.DATABASE_URL ?? '')
    const nom = u.pathname.replace(/^\//, '')
    const autorisee = process.env.IMPORT_NOTAIRES_BASE_LOCALE || 'lam_banc'
    const locale = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(u.hostname) && nom === autorisee
    return { libelle: `${u.hostname}${u.port ? `:${u.port}` : ''}/${nom}`, locale }
  } catch { return { libelle: '(DATABASE_URL illisible)', locale: false } }
}

const aff = (v: string | string[] | null | undefined) => (Array.isArray(v) ? (v.length ? v.map((x) => (x.startsWith('+509') ? formatPhone(x) : x)).join(' ; ') : '—') : v || '—')

function rapportMarkdown(plans: PlanEntree[], meta: Record<string, string>, resultats: Resultat[] | null): string {
  const l: string[] = []
  l.push(`# Import « ${meta.fichier} » — ${meta.mode}`, '')
  for (const [k, v] of Object.entries(meta)) l.push(`- **${k}** : ${v}`)
  l.push('', '| # | Nom (document) | Rapprochement | Notaire en base | Action envisagée | Propositions | Anomalies |', '|---|---|---|---|---|---|---|')
  for (const p of plans) {
    const c = p.rapprochement.candidats[0]
    l.push(`| ${p.rang} | ${p.nom} | ${p.rapprochement.niveau} | ${c ? `${c.nom} (${c.commune ?? '?'}) \`${c.id}\`` : '—'} | ${p.action} | ${p.propositions.length} | ${p.anomalies.length} |`)
  }
  for (const p of plans) {
    const r = resultats?.find((x) => x.rang === p.rang)
    l.push('', `## ${p.rang}. ${p.nom} — ${p.rapprochement.niveau}`)
    for (const c of p.rapprochement.candidats) l.push(`- candidat **${c.nom}** (${c.commune ?? '?'}, \`${c.id}\`) — ${c.niveau} : ${c.motif}`)
    if (!p.rapprochement.candidats.length) l.push('- aucun candidat dans la liste')
    l.push(`- **existant** : adresse ${aff(p.existant?.address)} · téléphones ${aff(p.existant?.phones)} · courriels ${aff(p.existant?.emails)}${p.existant && !p.existant.active ? ' · fiche RETIRÉE' : ''}`)
    l.push(`- **proposé (document)** : adresse ${aff(p.propose.address)} · téléphones ${aff(p.propose.phones)} · courriels ${aff(p.propose.emails)}`)
    if (p.decision) l.push(`- **décision** (${p.decision.par}, ${p.decision.decidedOn}) : « ${p.decision.texte} »`)
    l.push(`- **action** : ${p.action}${p.completions.length ? ` — ${p.completions.map((c) => `${c.champ} = ${aff(c.valeur)}`).join(' · ')}` : ''}`)
    for (const m of p.modifications) l.push(`- modification (${m.champ}) : ${aff(m.avant)} → **${aff(m.apres)}**`)
    for (const x of p.propositions) l.push(`- proposition (${x.champ}) : « ${aff(x.propose)} » ; en base : ${aff(x.existant)} — ${x.motif}`)
    for (const a of p.anomalies) l.push(`- anomalie ${a.type} : « ${a.brut} » — ${a.note}`)
    if (r) l.push(`- **résultat** : écrit ${r.ecrit.join(', ') || '—'} · modifié ${r.modifie.join(', ') || '—'} · non écrit (concurrence) ${r.concurrence.join(', ') || '—'} · proposition ${r.proposition ?? '—'}${r.invalidees.length ? ` · confirmations invalidées ${r.invalidees.join(', ')}` : ''}`)
  }
  return l.join('\n') + '\n'
}

async function main() {
  const { file, dossier, apply, dateDocument, decisions: fichierDecisions, cible, autorisation } = args()
  const b = base()
  const buf = readFileSync(file)
  const sha = createHash('sha256').update(buf).digest('hex')
  const fichier = basename(file)
  const jour = dateDocument && /^\d{4}-\d{2}-\d{2}$/.test(dateDocument) ? dateDocument : statSync(file).mtime.toISOString().slice(0, 10)
  console.log(`Import « ${fichier} » — ${apply ? 'APPLICATION' : 'SIMULATION'}`)
  console.log(`  base     : ${b.libelle} ${b.locale ? '(locale, identifiée)' : '(NON locale : simulation seulement)'}`)
  console.log(`  sha-256  : ${sha}`)
  if (apply && !b.locale) {
    if (!cible || cible !== b.libelle || !autorisation || autorisation.length < 10) {
      console.error('✗ --apply refusé : la base n’est pas une base locale clairement identifiée. Fournir la simulation et la procédure —')
      console.error('  ou, sur autorisation écrite de la cliente : --cible <la base affichée ci-dessus> --autorisation "<qui, quand, quoi>".')
      process.exit(1)
    }
    console.log(`  ⚠ ÉCRITURE EN BASE NON LOCALE, autorisée : « ${autorisation} »`)
  }

  // HTML et non texte brut : `extractRawText` perd les sauts de ligne (voir `texteDepuisHtml`).
  const texte = texteDepuisHtml((await mammoth.convertToHtml({ buffer: buf })).value)
  const { entrees, orphelins } = lireEntrees(texte)
  const [notaires, fiches] = await Promise.all([
    prisma.notary.findMany({ select: { id: true, fullName: true, displayName: true, active: true, commune: { select: { name: true } } } }),
    prisma.notaryContact.findMany({ select: { notaryId: true, address: true, phonesJson: true, email: true, emailsJson: true, active: true } }),
  ])
  const refs: NotaireRef[] = notaires.map((n) => ({ id: n.id, fullName: n.fullName, displayName: n.displayName, active: n.active, communeName: n.commune?.name ?? null }))
  const parId = new Map(fiches.map((f) => [f.notaryId, f]))
  const existant = (id: string): Existant | null => {
    const f = parId.get(id)
    return f ? { address: f.address, phones: readPhones(f.phonesJson), emails: readEmails(f.emailsJson, f.email), active: f.active } : null
  }
  const decisions: Map<number, Decision> = fichierDecisions
    ? lireDecisions(JSON.parse(readFileSync(fichierDecisions, 'utf8')), sha, entrees.map((e) => e.rang))
    : new Map()
  if (fichierDecisions) console.log(`  décisions : ${decisions.size} (${basename(fichierDecisions)})`)
  const plans = entrees.map((e) => planifier(e, refs, existant, decisions.get(e.rang) ?? null))

  let resultats: Resultat[] | null = null
  if (apply) {
    const rls: Array<{ tablename: string; rowsecurity: boolean }> = await prisma.$queryRawUnsafe(
      `select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename in ('NotaryContact','NotaryRequest','NotaryConfirmation')`,
    )
    if (rls.length < 3 || rls.some((t) => !t.rowsecurity)) {
      console.error('✗ --apply refusé : tables absentes ou sans sécurité par ligne (`prisma db push` puis `npm run db:rls`).')
      process.exit(1)
    }
    const avant = await prisma.auditLog.count({ where: { action: 'JUDICIAL_IMPORT', targetType: 'NotaryContactDocx' } })
    resultats = []
    for (const p of plans) resultats.push(await appliquer(prisma, p, { sha, fichier, jour }))
    await audit({
      action: 'JUDICIAL_IMPORT', targetType: 'NotaryContactDocx', targetId: `${fichier}:${sha.slice(0, 16)}`,
      meta: {
        fichier, sha256: sha, entrees: plans.length, base: b.libelle, ...(autorisation && !b.locale ? { autorisation } : {}),
        champsEcrits: resultats.reduce((s, r) => s + r.ecrit.length, 0),
        champsModifiesSurDecision: resultats.reduce((s, r) => s + r.modifie.length, 0),
        decisions: decisions.size,
        propositionsCloses: resultats.filter((r) => r.proposition === 'close').length,
        propositionsCreees: resultats.filter((r) => r.proposition === 'creee').length,
        propositionsMisesAJour: resultats.filter((r) => r.proposition === 'mise-a-jour').length,
        concurrence: resultats.reduce((s, r) => s + r.concurrence.length, 0),
      },
    })
    const apres = await prisma.auditLog.count({ where: { action: 'JUDICIAL_IMPORT', targetType: 'NotaryContactDocx' } })
    console.log(`  audit ${apres > avant ? 'tracé' : 'NON TRACÉ (à vérifier)'}`)
  }

  mkdirSync(dossier, { recursive: true })
  const horodatage = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const meta = {
    fichier, mode: apply ? (b.locale ? 'APPLICATION (base locale)' : `APPLICATION (base NON locale — autorisation : « ${autorisation} »)`) : 'SIMULATION (aucune écriture)', base: b.libelle, 'sha-256': sha,
    'date du document': jour, entrées: String(entrees.length), 'paragraphes orphelins': String(orphelins.length),
  }
  const nom = `import-notaires-docx-${apply ? 'application' : 'simulation'}-${horodatage}`
  writeFileSync(join(dossier, `${nom}.md`), rapportMarkdown(plans, meta, resultats))
  writeFileSync(join(dossier, `${nom}.json`), JSON.stringify({ meta, plans, resultats }, null, 2))
  for (const p of plans) console.log(`  ${String(p.rang).padStart(2)}. ${p.nom.padEnd(32)} ${p.rapprochement.niveau.padEnd(9)} ${p.action}`)
  console.log(`\n  rapport : ${join(dossier, `${nom}.md`)}`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
