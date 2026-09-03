/**
 * Reproduit la panne de production puis prouve le correctif.
 *
 * On rend `@napi-rs/canvas` INTROUVABLE (c'est l'état de la fonction serverless sur Vercel :
 * le paquet n'est pas embarqué dans le bundle) et on regarde ce que fait pdfjs.
 *
 *     npx tsx scripts/verif-couche-texte-pdf.ts            # lance les trois cas
 */
import { execFileSync } from 'node:child_process'
import * as nodeModule from 'node:module'
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

/** Copie de l'ancienne rédaction : `pdf-parse` importé statiquement, AVANT la session. */
const ANCIENNE = `import { NextRequest } from 'next/server'
import { PDFParse } from 'pdf-parse'
import { getCurrentUser } from '@/lib/auth/session'
export const POST = async (_req: NextRequest) => { void PDFParse; void getCurrentUser; return null }
`

const PDF = join(process.cwd(), 'scripts/data/energie-2016/facsimiles/energie.pdf')

/** Cache le paquet natif — la fonction serverless ne l'a pas. */
function cacherCanvas() {
  const Module = (nodeModule as any).Module
  const load = Module._load
  Module._load = function (id: string, ...rest: unknown[]) {
    if (id === '@napi-rs/canvas') throw new Error("Cannot find module '@napi-rs/canvas'")
    return load.call(this, id, ...rest)
  }
}

const mode = process.argv[2]

async function main() {
if (mode === 'sans-polyfill') {
  cacherCanvas()
  try {
    await import('pdf-parse')
    console.log('CHARGÉ') // si on lit ça, la panne ne se reproduit pas
  } catch (e) {
    console.log('ÉCHEC:' + String((e as Error).message).split('\n')[0])
  }
} else if (mode === 'avec-polyfill') {
  cacherCanvas()
  const { pdfTextLayer } = await import('../src/lib/pdf/text-layer')
  const r = await pdfTextLayer(new Uint8Array(readFileSync(PDF)))
  const propre = (globalThis as any).DOMMatrix?.name ?? '(aucun)'
  console.log(`OK:${r.full.length}:${r.firstPage.length}:${r.dommatrix}:${propre}`)
} else if (mode === 'corrompu') {
  cacherCanvas()
  const { pdfTextLayer } = await import('../src/lib/pdf/text-layer')
  const r = await pdfTextLayer(new TextEncoder().encode('ceci n’est pas un PDF'))
  console.log(`OK:${r.full.length}:${r.firstPage.length}:${r.dommatrix}`)
} else if (mode === 'route' || mode === 'route-ancienne') {
  // La preuve au niveau de la ROUTE : c'est son CHARGEMENT DE MODULE qui répondait 500.
  // ⚠️ Une route Next ne se charge pas entièrement hors de son moteur (`react.cache` manque).
  // On ne mesure donc pas « la route démarre » — on mesure LEQUEL des deux obstacles vient en
  // premier. Ordre des imports : `pdf-parse` précède `@/lib/auth/session` dans l'ancienne
  // rédaction, donc l'ancienne bute sur DOMMatrix et la nouvelle va plus loin.
  cacherCanvas()
  const cible = mode === 'route' ? '../src/app/api/admin/upload/extract/route' : './_tmp-route-ancienne'
  try {
    const mod = await import(cible)
    console.log(`OK:${typeof (mod as { POST?: unknown }).POST}`)
  } catch (e) {
    console.log('ÉCHEC:' + String((e as Error).message).split('\n')[0])
  }
} else {
  const lancer = (m: string) =>
    execFileSync('npx', ['tsx', 'scripts/verif-couche-texte-pdf.ts', m], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
      .trim().split('\n').filter((l) => l.startsWith('OK:') || l.startsWith('ÉCHEC:') || l === 'CHARGÉ').join(' ')

  console.log('─── @napi-rs/canvas rendu introuvable (état de la fonction Vercel) ───\n')

  const a = lancer('sans-polyfill')
  const reproduit = a.includes('DOMMatrix is not defined')
  console.log(`  ${reproduit ? '✓' : '✗'} SANS le correctif : import de pdf-parse → ${a}`)
  console.log(`      ${reproduit ? 'la panne de production est reproduite à l’identique' : '⚠️ la panne NE se reproduit PAS — le diagnostic est à revoir'}`)

  const b = lancer('avec-polyfill')
  const [, plein, page1, prov, classe] = b.split(':')
  const okB = b.startsWith('OK:') && Number(plein) > 500 && Number(page1) > 100
  console.log(`\n  ${okB ? '✓' : '✗'} AVEC le correctif : ${plein} caractères au total, ${page1} en page 1`)
  console.log(`      DOMMatrix = ${prov} · classe en place : ${classe}`)
  console.log(`      ${classe === 'DOMMatrixMinimal' ? '✓' : '✗'} c’est bien le substitut qui a servi, pas le canvas natif`)

  // Sabotage : on rétablit l'import statique dans une copie, pour vérifier que ce test
  // DISCRIMINE — sans quoi « pas d'erreur DOMMatrix » ne prouverait rien.
  writeFileSync(join(process.cwd(), 'scripts/_tmp-route-ancienne.ts'), ANCIENNE)
  let d0 = '', d = ''
  try {
    d0 = lancer('route-ancienne')
    d = lancer('route')
  } finally {
    rmSync(join(process.cwd(), 'scripts/_tmp-route-ancienne.ts'), { force: true })
  }
  const okD0 = d0.includes('DOMMatrix is not defined')
  const okD = d.startsWith('ÉCHEC:') ? !d.includes('DOMMatrix') : d === 'OK:function'
  console.log(`\n  ${okD0 ? '✓' : '✗'} import statique rétabli : ${d0}`)
  console.log(`      le test discrimine : l’ancienne rédaction bute bien sur DOMMatrix`)
  console.log(`  ${okD ? '✓' : '✗'} route actuelle : ${d}`)
  console.log(`      elle PASSE l’obstacle DOMMatrix (le reste ne manque qu’au moteur Next)`)

  const c = lancer('corrompu')
  const okC = c === 'OK:0:0:substitut'
  console.log(`\n  ${okC ? '✓' : '✗'} PDF illisible : ${c} — couche vide rendue, aucune exception`)

  const tout = reproduit && okB && classe === 'DOMMatrixMinimal' && okD0 && okD && okC
  console.log(`\n${tout ? '✓ Panne reproduite, correctif prouvé.' : '⚠️ UN CAS NE PASSE PAS.'}`)
  process.exitCode = tout ? 0 : 1
}
}

main()
