/**
 * Corrige les séquelles d'OCR du Code civil, chacune confrontée au fac-similé
 * (édition Zémès 2011).
 *
 *  1. Sigle « € » lu à la place de « C. » dans cinq renvois (art. 338, 978, 1164,
 *     1193, 1785). Chacun a été relu sur l'IMAGE de la page, pas sur la couche texte
 *     du PDF — elle-même océrisée et fautive.
 *  2. « C. dv » pour « C. civ. » : 26 renvois. Le « civ » en italique du recueil a été
 *     lu « dv ». Tant qu'il reste ainsi, le renvoi n'est ni lisible ni cliquable.
 *  3. Césures de fin de ligne non recousues (« communi- cation »). Garde-fou : on ne
 *     recoud QUE si le mot obtenu existe ailleurs dans le corpus. Les faux candidats
 *     viennent des colonnes d'annotation lues en travers (« la jouis- ne lui est pas
 *     ouvert ») et donneraient des mots inventés — ils sont laissés tels quels.
 *  4. Espace parasite avant une virgule. Le point-virgule et le deux-points en
 *     prennent une, légitimement, en typographie française : ils ne sont pas touchés.
 *
 * Par défaut : SIMULATION.
 *
 *     npx tsx scripts/fix-code-civil-ocr.ts
 *     npx tsx scripts/fix-code-civil-ocr.ts --apply
 */
import { PrismaClient } from '@prisma/client'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')

/** Renvois où « € » remplace « C. » — relus un à un sur l'image de la page. */
const EURO = [
  { art: 338, page: 98, de: '€. p. c. 987.', vers: 'C. p. c. 987.' },
  { art: 978, page: 207, de: '€. 4, 897 925, 978.', vers: 'C. civ., 897, 925, 978.' },
  { art: 1164, page: 257, de: '€. , 454, 455,', vers: 'C. civ., 454, 455,' },
  { art: 1193, page: 265, de: '€. tv, 1222, 1253, 1255, 1278.', vers: 'C. civ., 1222, 1253, 1255, 1278.' },
  { art: 1785, page: 362, de: '€. æ, 1783, 1784, 1789, 1791-1793.', vers: 'C. civ., 1783, 1784, 1789, 1791-1793.' },
]

// insensible à la casse : le corpus porte « C. dv » et « c. dv »
const DV = /\bC\.?\s*dv\b/gi
const CESURE = /([a-zà-ÿ]{2,})-\s+([a-zà-ÿ]{2,})/g
const ESPACE_VIRGULE = /(\S) +,/g

async function main() {
  const doc = await prisma.document.findFirst({
    where: { source: 'CODE_CIVIL_ANNOTE' },
    select: { id: true, titleFr: true, bodyOriginal: true, bodyClean: true },
  })
  if (!doc) throw new Error('Code civil introuvable.')
  if (doc.bodyClean) throw new Error('bodyClean renseigné : ce script suppose que le texte affiché est bodyOriginal.')

  let corps = doc.bodyOriginal
  const journal: Record<string, unknown> = {}

  // ── 1. « € » ────────────────────────────────────────────────────────────────
  console.log('=== 1. Sigle « € » pour « C. » ===')
  for (const e of EURO) {
    const n = corps.split(e.de).length - 1
    if (n !== 1) throw new Error(`art. ${e.art} : ${n} occurrence(s) de ${JSON.stringify(e.de)} (1 attendue).`)
    corps = corps.replace(e.de, e.vers)
    console.log(`  art. ${String(e.art).padStart(4)} (p.${e.page}) : ${JSON.stringify(e.de)} → ${JSON.stringify(e.vers)}`)
  }
  journal.euro = EURO.length

  // ── 2. « C. dv » ────────────────────────────────────────────────────────────
  const dv = [...corps.matchAll(DV)].length
  corps = corps.replace(DV, 'C. civ.')
  console.log(`\n=== 2. « C. dv » → « C. civ. » : ${dv} renvois ===`)
  journal.cDv = dv

  // ── 3. Césures ──────────────────────────────────────────────────────────────
  // Le vocabulaire de référence est celui du corpus LUI-MÊME, pris AVANT recousure.
  const vocabulaire = new Set(corps.toLowerCase().match(/[a-zà-ÿ]{3,}/g) ?? [])
  const recousues: string[] = []
  const laissees: string[] = []
  corps = corps.replace(CESURE, (tout, g, d) => {
    const joint = `${g}${d}`
    if (vocabulaire.has(joint.toLowerCase())) {
      if (recousues.length < 40) recousues.push(`${g}- ${d} → ${joint}`)
      return joint
    }
    if (laissees.length < 40) laissees.push(`${g}- ${d}`)
    return tout
  })
  console.log(`\n=== 3. Césures : ${recousues.length} recousues, ${laissees.length} laissées ===`)
  recousues.slice(0, 10).forEach((s) => console.log(`  ✓ ${s}`))
  console.log('  — laissées (mot inventé si on recousait, souvent deux colonnes lues en travers) :')
  laissees.slice(0, 8).forEach((s) => console.log(`  · ${s}`))
  journal.cesures = { recousues: recousues.length, laissees: laissees.length }

  // ── 4. Espace avant une virgule ─────────────────────────────────────────────
  const esp = [...corps.matchAll(ESPACE_VIRGULE)].length
  corps = corps.replace(ESPACE_VIRGULE, '$1,')
  console.log(`\n=== 4. Espace avant une virgule : ${esp} ===`)
  journal.espaceVirgule = esp

  console.log(`\nCorps : ${doc.bodyOriginal.length} → ${corps.length} caractères (${corps.length - doc.bodyOriginal.length}).`)
  if (!APPLY) {
    console.log('\nSIMULATION — rien n’a été écrit. Relancer avec --apply.')
    await prisma.$disconnect()
    return
  }
  await prisma.$transaction(
    async (tx) => {
      await tx.document.update({ where: { id: doc.id }, data: { bodyOriginal: corps } })
      await audit(
        { action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: doc.id,
          meta: { source: 'CODE_CIVIL_ANNOTE', motif: 'séquelles d’OCR confrontées au fac-similé Zémès 2011', ...journal } },
        tx,
      )
    },
    { timeout: 120_000, maxWait: 30_000 },
  )
  console.log('\n✓ Écrit et journalisé.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('ÉCHEC :', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
