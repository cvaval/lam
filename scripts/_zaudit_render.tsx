/** @jsxImportSource react */
/** AUDIT LECTURE SEULE — rend AnnotatedText avec les DONNÉES DE PRODUCTION. Jetable. */
import { readFileSync, writeFileSync } from 'node:fs'
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
import { parseCirculaireRef } from '../src/lib/brh/gaps'
import type { CircRef } from '../src/lib/doc/crossref'

const OUT = '/private/tmp/claude-501/-Users-cvaval-Library-CloudStorage-Dropbox-Lam-Veritab/b86c8ab9-626b-4ed6-9e9c-f6e8779c5980/scratchpad'

async function main() {
  const refDocs = await prisma.document.findMany({ where: { type: 'CIRCULAIRE_BRH' }, select: { id: true, number: true } })
  const refIndex: Record<string, string> = {}
  for (const r of refDocs) { const p = parseCirculaireRef(r.number); if (p) refIndex[`${p.serie}|${p.base}|${p.rev ?? 0}`] = r.id }

  for (const [name, id] of Object.entries({ '105-2': 'cms7lgd8l0000wtgzu7y3j8mt', '117-1': 'cms7lggvs0001wtgzvw937xyt' })) {
    const doc = (await prisma.document.findUnique({ where: { id } }))!
    const ann = parseAnnotations(doc.annotationsJson)!
    const rich = parseRichBlocks(doc.richBlocksJson)
    const body = doc.bodyClean ?? doc.bodyOriginal
    const hrefFor = (ref: CircRef) => {
      const t = ref.present ? doc.id : refIndex[`${ref.serie}|${ref.base}|${ref.rev ?? 0}`]
      return t ? `/fr/doc/${t}${ref.article ? `#art-${ref.article}` : ''}` : null
    }
    const html = renderToStaticMarkup(
      React.createElement(AnnotatedText as any, {
        text: body, annotations: ann, rich, hrefFor, locale: 'fr',
        hideInlineIndex: true, linkArtRefs: true, annotationsVariant: 'juris',
      }),
    )
    writeFileSync(`${OUT}/${name}.html`, html)
    const tables = (html.match(/<table/g) ?? []).length
    const trs = (html.match(/<tr/g) ?? []).length
    const tds = (html.match(/<t[dh][ >]/g) ?? []).length
    const orph = (html.match(/emplacement approximatif/g) ?? []).length
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1])
    const dup = ids.filter((v, i, a) => a.indexOf(v) !== i)
    console.log(`\n### ${name} — rendu réel AnnotatedText`)
    console.log(`  poids HTML ${(html.length / 1024).toFixed(0)} Ko | <table> ${tables} | <tr> ${trs} | cellules ${tds} | « emplacement approximatif » ${orph}`)
    console.log(`  ids ${ids.length} | ids DUPLIQUÉS ${dup.length} (distincts ${new Set(dup).size}) : ${[...new Set(dup)].slice(0, 12).join(', ')}`)
    console.log(`  légende « Tableau 1 » apparaît ${(html.match(/Tableau 1 —/g) ?? []).length} fois`)
    // Texte aplati encore présent ?
    for (const probe of ['1000 | Agriculture', 'HA1 | Ouest', '150 | Comptable']) {
      console.log(`  texte aplati « ${probe} » encore dans le flux : ${html.includes(probe)}`)
    }
    console.log(`  liens vers d'autres circulaires : ${(html.match(/href="\/fr\/doc\//g) ?? []).length}`)
  }
  await prisma.$disconnect()
}
main()
