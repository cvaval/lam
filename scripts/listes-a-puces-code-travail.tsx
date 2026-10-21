/**
 * Code du travail annoté : énumérations rendues en liste à puces, à la demande de Me Vaval.
 *   - art. 110 (« Modifié par le Décret du 23 mai 1989 ») : les fêtes légales (20 oct. 2026 : « mettre la liste des
 *     jours en bullet points ») — chaque fête, ligne courte sans ponctuation finale, s'affichait en intertitre gras ;
 *   - art. 45 (barème du préavis) : 20 oct. 2026, « corriger les bullet points de l'article 45 », texte fourni par
 *     elle — les lignes commençant en minuscule (« de 3 mois… ») étaient recousues en un seul paragraphe ; « et » passe
 *     à la fin du 4ᵉ point, comme elle l'écrit.
 *
 * « • » en tête de ligne : `parseOfficialText` (BULLET_RE) en fait une vraie liste. Les mots ne changent pas (vérifié).
 * Rejouable : une opération déjà appliquée est sautée.
 *
 * Garde-fous (refus d'écrire si l'un échoue) : chaque liste est exactement celle attendue, à sa place, une seule fois ;
 * mêmes mots ; même segmentation (ancres, clés d'annotation : la jurisprudence reste attachée) ; rendu : autant de
 * puces de plus que de points ajoutés, mêmes liens ; la fiche n'a pas changé depuis la lecture.
 * Instantané écrit AVANT (hors dépôt) : `<dossier>/<id>-<horodatage>.json`.
 *
 *     npx tsx --tsconfig <tsconfig jsx> scripts/listes-a-puces-code-travail.tsx <dossier instantanés> [--commit]
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
const PUCE = '• '

type Op = { article: string; tete: string; avant: string[]; apres: string[] }
const FETES = [
  'Le Mardi Gras',
  'Le Vendredi Saint',
  'La Fête Dieu',
  'L’Assomption',
  'Le 17 Octobre, mort de Dessalines',
  'Le 2 Novembre, Fêtes des Morts',
  'Le 25 Décembre, Jour de Noël.',
]
const OPS: Op[] = [
  {
    article: 'art-110',
    tete: 'Article 1. Dès la publication du présent Décret, les Fêtes légales sont:',
    avant: FETES,
    apres: FETES.map((f) => PUCE + f),
  },
  {
    article: 'art-45',
    tete: 'Article 45. Ce préavis sera calculé de la manière suivante:',
    avant: [
      'de 3 mois à 12 mois de service . . . 15 jours',
      'de 1 an à 3 ans de service . . . 1 mois',
      'de 3 ans à 6 ans de service . . . 2 mois',
      'de 6 ans à 10 ans de service . . . 3 mois',
      'et à partir de 10 ans de service . . . 4 mois',
    ],
    apres: [
      PUCE + 'de 3 mois à 12 mois de service . . . 15 jours',
      PUCE + 'de 1 an à 3 ans de service . . . 1 mois',
      PUCE + 'de 3 ans à 6 ans de service . . . 2 mois',
      PUCE + 'de 6 ans à 10 ans de service . . . 3 mois et',
      PUCE + 'à partir de 10 ans de service . . . 4 mois',
    ],
  },
]

async function main() {
  if (!DOSSIER) throw new Error('usage : listes-a-puces-code-travail.tsx <dossier instantanés> [--commit]')
  const d = await prisma.document.findFirstOrThrow({
    where: { source: 'CODE_TRAVAIL_ANNOTE' },
    select: { id: true, bodyOriginal: true, annotationsJson: true, updatedAt: true },
  })
  const a = parseAnnotations(d.annotationsJson)! as Annotations
  let L = d.bodyOriginal.split('\n')
  const faites: string[] = []
  let ajoutees = 0
  for (const op of OPS) {
    const ts = L.flatMap((l, i) => (norm(l) === op.tete ? [i] : []))
    if (ts.length !== 1) throw new Error(`${op.article} : tête « ${op.tete} » trouvée ${ts.length} fois`)
    const t = ts[0]
    const suite = (n: number) => L.slice(t + 1, t + 1 + n).map(norm)
    if (suite(op.apres.length).join('|') === op.apres.join('|')) { console.log(`= ${op.article} : déjà en liste à puces`); continue }
    if (suite(op.avant.length).join('|') !== op.avant.join('|')) throw new Error(`${op.article} : liste inattendue ${JSON.stringify(suite(op.avant.length))}`)
    const sansPuce = (s: string) => (s.startsWith(PUCE) ? s.slice(PUCE.length) : s)
    if (norm(op.avant.join(' ')) !== norm(op.apres.map(sansPuce).join(' '))) throw new Error(`${op.article} : les mots changeraient`)
    L = [...L.slice(0, t + 1), ...op.apres, ...L.slice(t + 1 + op.avant.length)]
    faites.push(op.article)
    ajoutees += op.apres.filter((l) => l.startsWith(PUCE)).length - op.avant.filter((l) => l.startsWith(PUCE)).length
    console.log(`→ ${op.article}`); for (const l of L.slice(t, t + 1 + op.apres.length)) console.log('    ' + l)
  }
  if (!faites.length) { console.log('Rien à écrire.'); return }
  const body1 = L.join('\n')

  // ── Garde-fous ──
  const erreurs: string[] = []
  const sig = (b: string) => segmentAnnotated(b, a.toc, a.pointAnchors, a.repeatedHeads).map((x: any) => `${x.kind}:${x.anchor ?? ''}:${x.jurisKey ?? ''}:${x.noAnchors ?? ''}`).join('|')
  if (sig(d.bodyOriginal) !== sig(body1)) erreurs.push('segmentation (ancres, clés)')
  const rendu = (b: string) => renderToStaticMarkup(<AnnotatedText text={b} annotations={a} locale="fr" linkArtRefs hideInlineIndex />)
  const h0 = rendu(d.bodyOriginal), h1 = rendu(body1)
  const n = (h: string, re: RegExp) => (h.match(re) ?? []).length
  if (n(h1, /href="/g) !== n(h0, /href="/g)) erreurs.push(`liens ${n(h0, /href="/g)} → ${n(h1, /href="/g)}`)
  if (n(h1, /<li/g) - n(h0, /<li/g) !== ajoutees) erreurs.push(`puces ${n(h0, /<li/g)} → ${n(h1, /<li/g)} (attendu +${ajoutees})`)
  for (const op of OPS.filter((o) => faites.includes(o.article))) {
    for (const l of op.apres) if (!h1.includes(`<span>${l.slice(PUCE.length)}</span>`)) erreurs.push(`${op.article} : « ${l} » n'est pas une puce au rendu`)
  }
  console.log(`puces ${n(h0, /<li/g)} → ${n(h1, /<li/g)} ; liens ${n(h0, /href="/g)} → ${n(h1, /href="/g)}`)
  if (erreurs.length) { console.log(`⛔ refus : ${erreurs.join(', ')}`); process.exitCode = 1; return }
  if (!COMMIT) { console.log('(à blanc — --commit pour écrire)'); return }

  mkdirSync(DOSSIER, { recursive: true })
  writeFileSync(join(DOSSIER, `${d.id}-${Date.now()}.json`), JSON.stringify({ id: d.id, updatedAt: d.updatedAt, bodyOriginal: d.bodyOriginal }))
  // La fiche ne doit pas avoir changé depuis la lecture (autre session, éditeur du CMS).
  const r = await prisma.document.updateMany({ where: { id: d.id, updatedAt: d.updatedAt }, data: { bodyOriginal: body1 } })
  if (r.count !== 1) throw new Error('la fiche a changé depuis la lecture : rien écrit')
  await reindexDocument(d.id)
  await audit({ action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: d.id, meta: { via: 'listes-a-puces-code-travail', articles: faites, puces: ajoutees, decision: 'listes à puces — Me Vaval, 20 oct. 2026' } })
  console.log(`✓ écrit (${faites.join(', ')}), réindexé, journalisé`)
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
