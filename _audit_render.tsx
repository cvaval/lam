/** @jsxImportSource react */
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'fs'
import { OfficialText } from '@/components/OfficialText'
import { parseRichBlocks } from '@/lib/doc/richblocks'

const rich = parseRichBlocks(readFileSync('scripts/data/circ-brh-105-2/_rich.json', 'utf8'))
const clean = readFileSync('scripts/data/circ-brh-105-2/_clean.txt', 'utf8')
const html = renderToStaticMarkup(React.createElement(OfficialText, { text: clean, rich, locale: 'fr' } as any))
// Table 2 : trouver la rangée « Segment : ENTREPRISE »
const i = html.indexOf('Segment : ENTREPRISE')
console.log('--- extrait autour du bandeau ---')
console.log(html.slice(i - 400, i + 300).replace(/></g, '>\n<'))
console.log('--- colSpan présents dans tout le rendu :', (html.match(/colspan=/gi) || []).length)
