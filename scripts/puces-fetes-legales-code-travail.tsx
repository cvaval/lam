/**
 * Code du travail annoté, art. 110 (« Modifié par le Décret du 23 mai 1989 ainsi qu'il suit ») : la liste des fêtes
 * légales passe en liste à puces (Me Vaval, 20 oct. 2026 : « mettre la liste des jours en bullet points »).
 *
 * Avant : chaque fête est une ligne courte sans ponctuation finale, que le lecteur prend pour un intertitre (gras).
 * Après : « • Le Mardi Gras »… — `parseOfficialText` (BULLET_RE) en fait une vraie liste. Seul le marqueur est ajouté :
 * les mots ne changent pas.
 *
 * Garde-fous (refus d'écrire si l'un échoue) : la liste doit être exactement celle attendue, à sa place ; même nombre
 * de lignes ; même segmentation (ancres, clés d'annotation) ; rendu : 7 puces de plus, mêmes liens ; la fiche n'a pas
 * changé depuis la lecture. Instantané écrit AVANT (hors dépôt) : `<dossier>/<id>.json`.
 *
 *     npx tsx --tsconfig <tsconfig jsx> scripts/puces-fetes-legales-code-travail.tsx <dossier instantané> [--commit]
 */
import { PrismaClient } from '@prisma/client'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { AnnotatedText } from '../src/components/AnnotatedText'
import { parseAnnotations, segmentAnnotated, type Annotations } from '../src/lib/legislation/annotated'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const DOSSIER = process.argv.slice(2).find((a) => !a.startsWith('--'))
const COMMIT = process.argv.includes('--commit')
const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

const AVANT = 'Article 110. Modifié par le Décret du 23 mai 1989 ainsi qu’il suit:'
const TETE = 'Article 1. Dès la publication du présent Décret, les Fêtes légales sont:'
const FETES = [
  'Le Mardi Gras',
  'Le Vendredi Saint',
  'La Fête Dieu',
  'L’Assomption',
  'Le 17 Octobre, mort de Dessalines',
  'Le 2 Novembre, Fêtes des Morts',
  'Le 25 Décembre, Jour de Noël.',
]
const PUCE = '• '

async function main() {
  if (!DOSSIER) throw new Error('usage : puces-fetes-legales-code-travail.tsx <dossier instantané> [--commit]')
  const d = await prisma.document.findFirstOrThrow({
    where: { source: 'CODE_TRAVAIL_ANNOTE' },
    select: { id: true, bodyOriginal: true, annotationsJson: true, updatedAt: true },
  })
  const L0 = d.bodyOriginal.split('\n')
  const t = L0.findIndex((l, i) => norm(l) === TETE && norm(L0[i - 1] ?? '') === AVANT)
  if (t < 0) throw new Error('tête « Article 1. Dès la publication… » introuvable après l’art. 110')
  const liste = L0.slice(t + 1, t + 1 + FETES.length).map(norm)
  if (liste.join('|') !== FETES.join('|')) throw new Error(`liste inattendue : ${JSON.stringify(liste)}`)
  if (!/^Article 2\./.test(L0[t + 1 + FETES.length] ?? '')) throw new Error('la liste n’est pas suivie de « Article 2. »')

  const L1 = L0.map((l, i) => (i > t && i <= t + FETES.length ? PUCE + l.trim() : l))
  const body1 = L1.join('\n')
  const a = parseAnnotations(d.annotationsJson)! as Annotations

  // ── Garde-fous ──
  const erreurs: string[] = []
  if (L1.length !== L0.length) erreurs.push('nombre de lignes')
  const sig = (b: string) => segmentAnnotated(b, a.toc, a.pointAnchors, a.repeatedHeads).map((x: any) => `${x.kind}:${x.anchor ?? ''}:${x.jurisKey ?? ''}:${x.noAnchors ?? ''}`).join('|')
  if (sig(d.bodyOriginal) !== sig(body1)) erreurs.push('segmentation (ancres, clés)')
  const rendu = (b: string) => renderToStaticMarkup(<AnnotatedText text={b} annotations={a} locale="fr" linkArtRefs hideInlineIndex />)
  const h0 = rendu(d.bodyOriginal), h1 = rendu(body1)
  const n = (h: string, re: RegExp) => (h.match(re) ?? []).length
  if (n(h1, /href="/g) !== n(h0, /href="/g)) erreurs.push(`liens ${n(h0, /href="/g)} → ${n(h1, /href="/g)}`)
  if (n(h1, /<li/g) - n(h0, /<li/g) !== FETES.length) erreurs.push(`puces ${n(h0, /<li/g)} → ${n(h1, /<li/g)}`)
  for (const f of FETES) if (!h1.includes(f)) erreurs.push(`« ${f} » absent du rendu`)
  const versions = await prisma.articleVersion.count({ where: { documentId: d.id, body: { contains: 'Mardi Gras' } } })

  console.log(`Ligne ${t + 2} à ${t + 1 + FETES.length} : ${FETES.length} fêtes ; puces ${n(h0, /<li/g)} → ${n(h1, /<li/g)} ; liens ${n(h0, /href="/g)} → ${n(h1, /href="/g)} ; versions d’article qui citent la liste : ${versions}`)
  for (const l of L1.slice(t, t + 2 + FETES.length)) console.log('  ' + l)
  if (erreurs.length) { console.log(`⛔ refus : ${erreurs.join(', ')}`); process.exitCode = 1; return }
  if (!COMMIT) { console.log('(à blanc — --commit pour écrire)'); return }

  mkdirSync(DOSSIER, { recursive: true })
  writeFileSync(join(DOSSIER, `${d.id}.json`), JSON.stringify({ id: d.id, updatedAt: d.updatedAt, bodyOriginal: d.bodyOriginal }))
  // La fiche ne doit pas avoir changé depuis la lecture (autre session, éditeur du CMS).
  const r = await prisma.document.updateMany({ where: { id: d.id, updatedAt: d.updatedAt }, data: { bodyOriginal: body1 } })
  if (r.count !== 1) throw new Error('la fiche a changé depuis la lecture : rien écrit')
  await reindexDocument(d.id)
  await audit({ action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: d.id, meta: { via: 'puces-fetes-legales-code-travail', article: 'art-110', lignes: FETES.length, decision: 'fêtes légales en liste à puces — Me Vaval, 20 oct. 2026' } })
  console.log('✓ écrit, réindexé, journalisé')
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
