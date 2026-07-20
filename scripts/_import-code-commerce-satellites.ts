/**
 * Import des 93 textes satellites de l'édition Vandal du Code de commerce
 * (parsés par scripts/data/code-commerce/parse_satellites.py) — thème
 * « Droit commercial », À PLAT au même niveau que le Code (décision cliente).
 *
 * Idempotent : source = CC_VANDAL_<id Vandal> (purge/recrée individuellement).
 * metaJson = { vandalId, partie, rubrique } → table id Vandal ↔ id plateforme (audit).
 *
 *   npx tsx scripts/_import-code-commerce-satellites.ts [--only I]   # partie seule
 */
import { readFileSync, readdirSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { buildSearchText } from '../src/lib/search/normalize'
import { reindexDocument } from '../src/lib/search/reindex'
import { ensureThemeCommercial } from './_import-code-commerce'

const DATA = 'scripts/data/code-commerce/parsed-satellites'
const MONTHS: Record<string, number> = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7,
  aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
}

/** Date « du 10 octobre 1979 » extraite d'un intitulé (repli quand pas de ligne Moniteur). */
function dateFromTitle(title: string): Date | null {
  const m = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .match(/\bdu\s+(1er|\d{1,2})\s+([a-z]+)\s+(\d{4})/i)
  if (!m) return null
  const day = m[1] === '1er' ? 1 : Number(m[1])
  const month = MONTHS[m[2].toLowerCase()]
  return month ? new Date(Date.UTC(Number(m[3]), month - 1, day)) : null
}

const PARTIES: Record<string, string> = {
  I: 'Réglementation du commerce',
  II: 'Institutions financières et de crédit',
  III: 'Propriété industrielle',
  IV: 'Sociétés commerciales',
  V: 'Réglementation du commerce maritime',
  VI: 'Réglementation du commerce aérien international',
  VII: 'Réglementation fiscale',
}

async function main() {
  const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null
  const files = readdirSync(DATA).filter((f) => f.endsWith('.json'))
  const theme = await ensureThemeCommercial()

  const byPart: Record<string, number> = {}
  const failures: string[] = []
  for (const f of files.sort()) {
    const d = JSON.parse(readFileSync(`${DATA}/${f}`, 'utf8'))
    if (only && d.partie !== only) continue
    const source = `CC_VANDAL_${d.id}`
    try {
      const old = await prisma.document.findFirst({ where: { source }, select: { id: true } })
      if (old) {
        await prisma.documentTheme.deleteMany({ where: { documentId: old.id } })
        await prisma.crossRef.deleteMany({ where: { fromId: old.id } }).catch(() => {})
        await prisma.document.delete({ where: { id: old.id } })
      }
      const pubDate = d.publicationDate ? new Date(`${d.publicationDate}T00:00:00Z`) : dateFromTitle(d.title)
      const doc = await prisma.document.create({
        data: {
          type: 'LEGISLATION',
          status: 'EN_VIGUEUR',
          titleFr: d.title,
          number: d.number ?? undefined,
          originalLang: 'fr',
          matiere: 'commercial',
          moniteurRef: d.moniteurRef ?? undefined,
          publicationDate: pubDate ?? undefined,
          bodyOriginal: d.body,
          annotationsJson: d.structure ? JSON.stringify(d.structure) : undefined,
          searchText: buildSearchText({ titleFr: d.title, number: d.number, moniteurRef: d.moniteurRef, matiere: 'commercial', bodyOriginal: d.body }),
          source,
          metaJson: JSON.stringify({ vandalId: d.id, partie: d.partie, rubrique: d.rubrique }),
          summaryFr:
            `Texte de l'édition Vandal du Code de commerce — partie ${d.partie} (${PARTIES[d.partie] ?? d.partie}). ` +
            `Publié dans le thème « Droit commercial » au même niveau que le Code de commerce et les autres textes de l'édition.`,
        },
      })
      await prisma.documentTheme.create({ data: { documentId: doc.id, themeId: theme.id, isPrimary: true, assignedBy: 'IMPORT' } })
      await reindexDocument(doc.id)
      byPart[d.partie] = (byPart[d.partie] ?? 0) + 1
      console.log(`  ✔ ${d.id.padEnd(11)} ${doc.id}  ${d.stats.articles} art.  ${d.title.slice(0, 60)}`)
    } catch (e) {
      failures.push(`${d.id}: ${(e as Error).message.slice(0, 120)}`)
      console.error(`  ✖ ${d.id}: ${(e as Error).message.slice(0, 160)}`)
    }
  }

  console.log('\nPoint d’étape par partie :', byPart)
  if (failures.length) {
    console.error(`\n⚠ ${failures.length} échec(s) :\n` + failures.join('\n'))
    process.exitCode = 1
  } else {
    console.log('✅ Tous les satellites importés.')
  }
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
