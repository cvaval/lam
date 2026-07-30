/** @jsxImportSource react */
/** AUDIT LECTURE SEULE — preuve de non-régression sur les 4 grands codes. Jetable. */
import { readFileSync } from 'node:fs'
const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#')).map((l) => {
    const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
  }),
)
for (const k of ['DATABASE_URL', 'DIRECT_URL']) if (env[k]) process.env[k] = env[k]
if (env.DIRECT_URL) process.env.DATABASE_URL = env.DIRECT_URL
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { prisma } from '../src/lib/db'
import { parseAnnotations } from '../src/lib/legislation/annotated'
import { parseRichBlocks } from '../src/lib/doc/richblocks'
import { AnnotatedText } from '../src/components/AnnotatedText'
import { createHash } from 'node:crypto'

const SRC = ['CODE_CIVIL_ANNOTE', 'CODE_PENAL_ANNOTE', 'CODE_COMMERCE_ANNOTE', 'CONSTITUTION_1987', 'CODE_TRAVAIL_ANNOTE', 'CODE_DOUANES_ANNOTE']
async function main() {
  for (const source of SRC) {
    const d = await prisma.document.findFirst({ where: { source } })
    if (!d) { console.log(source, 'ABSENT'); continue }
    const ann = parseAnnotations(d.annotationsJson)!
    const rich = parseRichBlocks(d.richBlocksJson)
    const body = d.bodyClean ?? d.bodyOriginal
    const common = {
      text: body, annotations: ann, locale: 'fr' as const, hideInlineIndex: true,
      linkCivRefs: source === 'CODE_CIVIL_ANNOTE', linkArtRefs: true,
      annotationsVariant: (source === 'CODE_CIVIL_ANNOTE' || source === 'CODE_COMMERCE_ANNOTE' ? 'annotations' : 'juris') as any,
    }
    // APRÈS : props ajoutées par 87d09ed ; AVANT : sans rich ni hrefFor.
    const after = renderToStaticMarkup(React.createElement(AnnotatedText as any, { ...common, rich, hrefFor: undefined }))
    const before = renderToStaticMarkup(React.createElement(AnnotatedText as any, common))
    const h = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 12)
    console.log(`${source.padEnd(24)} richBlocks=${rich.length} pointAnchors=${ann.pointAnchors?.length ?? 0} | avant ${h(before)} / après ${h(after)} | ${before === after ? 'IDENTIQUE' : '*** DIFFÉRENT ***'} (${(after.length / 1024).toFixed(0)} Ko, <table> ${(after.match(/<table/g) ?? []).length})`)
  }
  await prisma.$disconnect()
}
main()
