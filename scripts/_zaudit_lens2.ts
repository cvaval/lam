/** AUDIT LECTURE SEULE — lentille 2. Jetable. */
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    }),
)
for (const k of ['DATABASE_URL', 'DIRECT_URL']) if (env[k]) process.env[k] = env[k]
if (env.DIRECT_URL) process.env.DATABASE_URL = env.DIRECT_URL

import { prisma } from '../src/lib/db'
import { parseAnnotations, segmentAnnotated } from '../src/lib/legislation/annotated'
import { parseRichBlocks, buildBodySegments, tableShortCaption, type RichTable } from '../src/lib/doc/richblocks'

const IDS = { '105-2': 'cms7lgd8l0000wtgzu7y3j8mt', '117-1': 'cms7lggvs0001wtgzvw937xyt' }

async function main() {
  for (const [name, id] of Object.entries(IDS)) {
    const doc = await prisma.document.findUnique({ where: { id } })
    if (!doc) { console.log(`!! ${name} INTROUVABLE`); continue }
    console.log(`\n================ ${name} (${doc.source}) ================`)
    const ann = parseAnnotations(doc.annotationsJson)
    console.log('annotations?', !!ann, 'pointAnchors:', ann?.pointAnchors?.length ?? 'ABSENT')
    console.log('toc entries:', ann?.toc.length, 'labels:', Object.keys(ann?.labels ?? {}).length)
    const body = doc.bodyClean ?? doc.bodyOriginal
    console.log('body len', body.length, 'bodyClean?', !!doc.bodyClean)
    const rich = parseRichBlocks(doc.richBlocksJson)
    console.log('richBlocks parsed:', rich.length, 'tables:', rich.filter((b) => b.type === 'table').length)
    // Vérif MAX_ROWS : rangées avant/après sanitisation
    const raw = doc.richBlocksJson ? JSON.parse(doc.richBlocksJson) : []
    const rawArr: any[] = Array.isArray(raw) ? raw : raw.blocks ?? []
    let rawRows = 0, sanRows = 0
    for (const b of rawArr) if (b?.type === 'table') rawRows += (b.rows?.length ?? 0)
    for (const b of rich) if (b.type === 'table') sanRows += b.rows.length
    console.log(`rangées brutes ${rawRows} -> sanitisées ${sanRows}`)
    const maxRow = Math.max(0, ...rawArr.filter((b) => b?.type === 'table').map((b: any) => b.rows?.length ?? 0))
    console.log('plus gros tableau (brut):', maxRow, 'rangées')

    // ── chemin RÉEL de la page annotée ──
    const blocks = segmentAnnotated(body, ann?.toc ?? [], ann?.pointAnchors)
    const bodyBlocks = blocks.filter((b) => b.kind === 'body')
    const anchored = bodyBlocks.filter((b) => (b as any).anchor)
    console.log(`blocs: ${blocks.length} (section ${blocks.length - bodyBlocks.length}, body ${bodyBlocks.length}, ancrés ${anchored.length})`)
    console.log('ancres:', anchored.map((b: any) => b.anchor).join(' '))

    // AnnotatedText: `rich` n'est passé QU'AU bloc non-article.
    const LEAD_ART = /^(?:art(?:icle)?s?\.?|section)\s+(?:premier|\d{1,4}(?:\s*(?:er|ère))?(?:\s*(?:bis|ter|quater))?(?:[.\-]\d+)*)\s*[.)\-–]*\s*/i
    const LEAD_POINT = /^(\d{1,2}(?:\.\d{1,2})*)\s*\.?\s*-?\s+/
    const pointMode = (ann?.pointAnchors ?? []).length > 0
    let tablesRendered = 0, rowsRendered = 0, blocksWithRich = 0, blocksArticle = 0
    const renderedCaptions: string[] = []
    for (const b of blocks) {
      if (b.kind !== 'body') continue
      const leadPoint = pointMode && b.anchor && !LEAD_ART.test(b.text) && LEAD_POINT.test(b.text)
      const isArticleCard = b.anchor && (LEAD_ART.test(b.text) || leadPoint)
      if (isArticleCard) { blocksArticle++; continue } // pas de `rich` transmis !
      blocksWithRich++
      const segs = buildBodySegments(b.text, rich)
      for (const s of segs) {
        if (s.kind === 'rich' && s.block.type === 'table') {
          tablesRendered++
          rowsRendered += s.block.rows.length
          renderedCaptions.push(`${(s as any).orphan ? '[ORPHELIN] ' : ''}${tableShortCaption(s.block as RichTable)}`)
        }
      }
    }
    console.log(`blocs-article (SANS rich): ${blocksArticle} | blocs texte (avec rich): ${blocksWithRich}`)
    console.log(`>>> tableaux RENDUS par le chemin AnnotatedText: ${tablesRendered} (attendu 20) — rangées ${rowsRendered}`)
    console.log('légendes:', renderedCaptions.map((c, i) => `${i + 1}. ${c}`).join('\n  '))

    // Comparaison : ce que la fiche (page.tsx) calcule pour le SOMMAIRE des tableaux
    const tableEntries = buildBodySegments(body, rich).filter((s) => s.kind === 'rich' && (s as any).block.type === 'table')
    console.log(`sommaire de la fiche (buildBodySegments sur corps ENTIER): ${tableEntries.length} tableaux`)
    console.log('  légendes fiche:', tableEntries.map((s: any, i) => `${i + 1}.${s.orphan ? '[ORPH]' : ''} ${tableShortCaption(s.block)}`).join(' | '))
  }
  await prisma.$disconnect()
}
main()
