/**
 * Import d'un recueil de décisions — MÊME analyseur que l'écran de versement.
 *
 *   npx tsx scripts/import-jurisprudence.ts <fichier.docx> --source CASSATION_1964_1965 [--apply]
 *
 * ⚠️ SIMULATION PAR DÉFAUT. La base est celle de PRODUCTION : rien n'est écrit sans
 * `--apply`. Le script existe pour le versement initial ; le circuit normal passe par
 * /admin/jurisprudence, avec son écran de contrôle.
 */
import { readFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#'))
  .map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
for (const k of ['DATABASE_URL','DIRECT_URL']) if (env[k]) process.env[k]=env[k]

import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { paragraphesDuDocx } from '../src/lib/jurisprudence/docx'
import { analyserRecueil } from '../src/lib/jurisprudence/parse'

async function main() {
  const argv = process.argv.slice(2)
  const fichier = argv.find((a) => a.endsWith('.docx'))
  const source = argv[argv.indexOf('--source') + 1]
  const recueilRef = argv.includes('--recueil') ? argv[argv.indexOf('--recueil') + 1] : null
  const exD = argv.includes('--exercice') ? Number(argv[argv.indexOf('--exercice') + 1]) : null
  const exF = argv.includes('--exercice') ? Number(argv[argv.indexOf('--exercice') + 2]) : null
  const apply = argv.includes('--apply')
  if (!fichier || !source) throw new Error('usage : <fichier.docx> --source CLÉ [--recueil "…"] [--exercice 1964 1965] [--apply]')

  const r = analyserRecueil(await paragraphesDuDocx(readFileSync(fichier)))
  console.log(`Analyse — ${r.decisions.length} décision(s)`)
  for (const a of r.avertissements) console.log(`  ⚠ ${a}`)
  const ko = r.decisions.filter((d) => !d.numero || !d.intitule || !d.dateISO)
  if (ko.length) throw new Error(`${ko.length} décision(s) sans numéro, intitulé ou date — refus.`)

  console.log(`\n${apply ? 'APPLICATION' : 'SIMULATION'} · source=${source}`)
  let crees = 0, modifies = 0
  for (const d of r.decisions) {
    const date = new Date(`${d.dateISO}T00:00:00Z`)
    const ref = [d.juridiction ?? 'JUR', `n° ${d.numero}`, date.getUTCFullYear()].join(' · ')
    const corps = [d.resume, d.dispositif && `Dispositif : ${d.dispositif}`].filter(Boolean).join('\n\n')
    if (!corps.trim()) throw new Error(`arrêt ${d.numero} : corps vide — refus`)
    const donnees = {
      type: 'JURISPRUDENCE', status: 'PUBLIE', originalLang: 'fr', source,
      titleFr: d.intitule!, bodyOriginal: corps, summaryFr: d.resume,
      number: d.numero, juridiction: d.juridiction, matiere: d.domaines,
      publicationDate: date, decisionAttaquee: d.decisionAttaquee,
      dispositif: d.dispositif, solution: d.solution, moniteurRef: ref,
      recueilRef, exerciceDebut: exD, exerciceFin: exF,
    }
    const existant = await prisma.document.findFirst({
      where: { type: 'JURISPRUDENCE', source, number: d.numero! }, select: { id: true },
    })
    if (apply) {
      if (existant) { await prisma.document.update({ where: { id: existant.id }, data: donnees }); await reindexDocument(existant.id); modifies++ }
      else { const doc = await prisma.document.create({ data: donnees }); await reindexDocument(doc.id); crees++ }
    } else { existant ? modifies++ : crees++ }
    console.log(`  ${existant ? '~' : '+'} n° ${String(d.numero).padStart(3)}  ${d.dateISO}  ${d.solution ?? '—'}  ${d.intitule!.slice(0, 46)}`)
  }
  console.log(`\n${crees} création(s) · ${modifies} mise(s) à jour${apply ? '' : '  (simulation — rien écrit)'}`)
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error('✗', e.message); await prisma.$disconnect(); process.exit(1) })
