/**
 * Code d'instruction criminelle d'Haïti — téléversement en « Droit pénal → Procédure pénale ».
 *
 * 462 articles, numérotés de 1 à 472 : les dix absents (109-111, 202-208) sont supprimés par
 * la loi du 12 juillet 1920, ce que le corps déclare lui-même et que l'index confirme en n'en
 * citant aucun. 67 divisions, 8 LOIS.
 *
 * ⚠ DEUX LOIS SONT INTERCALÉES AU MILIEU DU CORPS, avec une numérotation qui repart : la loi
 * du 20 juillet 1929 (son seul article 2) et celle du 26 juillet 1979 sur l'appel pénal
 * (articles 1 à 24). On NE LES MARQUE PAS `kind: 'connexe'` : le drapeau `inAnnexe` de
 * `segmentAnnotated` est un verrou à sens unique — il passe à `true` et n'est jamais remis à
 * `false` —, si bien que les marquer ferait perdre son ancre à 159 articles du Code, du 314
 * au 472. Le déduplicateur d'ancres déjà présent règle seul la collision : les numéros 1-24
 * et 2 ayant déjà été vus plus haut, les têtes des lois annexées restent muettes.
 * Attendu : 462 ancres, 25 blocs muets, zéro doublon.
 *
 * ⚠ `toc.label` est LA LIGNE DU CORPS, jamais le libellé de la table : 45 des 67 libellés
 * joignent deux ou trois lignes par un tiret et aucun ne s'apparierait. Les libellés composés
 * vont au menu latéral, où ils se lisent mieux.
 *
 * Données construites par `scripts/data/code-instruction-criminelle/build_cic.py`.
 *
 *     npx tsx scripts/import-code-instruction-criminelle.ts
 *     npx tsx scripts/import-code-instruction-criminelle.ts --voir=1,313,315
 *     npx tsx scripts/import-code-instruction-criminelle.ts --apply
 */
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'node:fs'
import { segmentAnnotated, type IndexEntry, type NavGroup, type TocEntry } from '../src/lib/legislation/annotated'
import { buildSearchText } from '../src/lib/search/normalize'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')
const VOIR = (process.argv.find((a) => a.startsWith('--voir='))?.slice(7) ?? '')
  .split(',').map(Number).filter(Boolean)

const SOURCE = 'CODE_INSTRUCTION_CRIMINELLE'
const TITRE = 'Code d’instruction criminelle d’Haïti'
const THEME = 'procedure-penale'
const DERNIER = 472
const ABSENTS = new Set([109, 110, 111, 202, 203, 204, 205, 206, 207, 208])

type Source = {
  corps: string[]
  toc: Array<TocEntry & { libelle: string }>
  navToc: NavGroup[]
  index: IndexEntry[]
  annexes: Array<{ debut: number; fin: number; nom: string }>
}

function ancresDuMenu(ns: NavGroup[], vues = new Set<string>()): Set<string> {
  for (const n of ns) {
    if (n.anchor) vues.add(n.anchor)
    if (n.children?.length) ancresDuMenu(n.children as unknown as NavGroup[], vues)
  }
  return vues
}

async function main() {
  const src: Source = JSON.parse(readFileSync('scripts/data/code-instruction-criminelle/source.json', 'utf8'))
  const corps = src.corps.join('\n')
  const toc: TocEntry[] = src.toc.map(({ level, label, anchor, kind }) => ({ level, label, anchor, kind }))

  const existant = await prisma.document.findFirst({ where: { source: SOURCE }, select: { id: true } })
  if (existant) throw new Error(`déjà téléversé (${existant.id}) — rien à faire`)

  // ── segmentation : c'est ici que se joue la collision d'ancres ───────────────
  const blocs = segmentAnnotated(corps, toc)
  const sections = blocs.filter((b) => b.kind === 'section')
  // ⚠ `segmentAnnotated` ne retire pas l'ancre d'une répétition : il pose `noAnchors`.
  // C'est ce drapeau qui décide de l'émission de l'id, donc c'est lui qu'il faut compter —
  // sans quoi les 25 articles des lois intercalées passent pour des doublons.
  const articles = blocs.filter((b) => b.kind === 'body' && b.anchor && !b.noAnchors)
  const ancres = articles.map((b) => b.anchor!)
  const muets = blocs.filter((b) => b.kind === 'body' && b.noAnchors && b.anchor).length
  const doublons = ancres.filter((a, i) => ancres.indexOf(a) !== i)
  const numeros = ancres.map((a) => Number(/^art-(\d+)$/.exec(a)?.[1] ?? 0))

  if (sections.length !== toc.length) throw new Error(`table : ${sections.length}/${toc.length} entrées appariées au corps`)
  if (doublons.length) throw new Error(`ancres en double : ${[...new Set(doublons)].slice(0, 8).join(', ')}`)
  const attendus = Array.from({ length: DERNIER }, (_, i) => i + 1).filter((n) => !ABSENTS.has(n))
  const manquants = attendus.filter((n) => !numeros.includes(n))
  const surnumeraires = numeros.filter((n) => n < 1 || n > DERNIER || ABSENTS.has(n))
  if (manquants.length) throw new Error(`${manquants.length} article(s) sans ancre : ${manquants.slice(0, 10).join(', ')}`)
  if (surnumeraires.length) throw new Error(`ancre(s) hors épine dorsale : ${surnumeraires.slice(0, 10).join(', ')}`)

  // ── menu : aucune ancre sans cible ──────────────────────────────────────────
  const cibles = new Set([...sections.map((b) => b.anchor), ...ancres])
  const menuMort = [...ancresDuMenu(src.navToc)].filter((a) => !cibles.has(a))
  if (menuMort.length) throw new Error(`menu : ancre(s) sans cible ${menuMort.join(', ')}`)

  // ── index : aucun renvoi vers un article inexistant ─────────────────────────
  const refs = src.index.flatMap((e) => e.ctRefs.map(Number))
  const morts = [...new Set(refs.filter((r) => !numeros.includes(r)))]
  if (morts.length) throw new Error(`index : ${morts.length} renvoi(s) morts — ${morts.slice(0, 12).join(', ')}`)

  // ── rien ne se perd ─────────────────────────────────────────────────────────
  const rendues = blocs.reduce((n, b) => n + b.text.split('\n').filter((l) => l.trim()).length, 0)
  if (rendues !== src.corps.length) throw new Error(`segmentation : ${rendues} lignes rendues pour ${src.corps.length}`)

  const annotations = {
    title: TITRE,
    annotationAuthor: '',
    navToc: src.navToc,
    toc,
    connexes: [],
    jurisprudence: {},
    indexEntries: src.index,
    connexe: {},
    commentaires: {},
  }
  const annotationsJson = JSON.stringify(annotations)

  console.log(`« ${TITRE} »`)
  console.log(`  corps : ${src.corps.length} lignes · ${corps.length} caractères`)
  console.log(`  divisions : ${sections.length}/${toc.length} appariées · menu ${src.navToc.length} racines, 0 ancre morte`)
  console.log(`  articles ancrés : ${ancres.length} (attendu ${attendus.length}) · blocs muets : ${muets} (les lois intercalées)`)
  console.log(`  articles absents, déclarés supprimés par la loi du 12 juillet 1920 : ${[...ABSENTS].join(', ')}`)
  console.log(`  index : ${src.index.length} entrées · ${refs.length} renvois · 0 mort`)
  src.annexes.forEach((a) => console.log(`  loi intercalée : ${a.nom} (¶${a.debut}-${a.fin})`))

  for (const n of VOIR) {
    const b = articles.find((x) => x.anchor === `art-${n}`)
    console.log(`\n╔══ ARTICLE ${n} ══`)
    ;(b?.text ?? '(introuvable)').split('\n').filter(Boolean).forEach((l) => console.log('║ ' + l.slice(0, 150)))
  }

  if (!APPLY) {
    console.log('\nSIMULATION — rien n’a été écrit. Relancer avec --apply.')
    await prisma.$disconnect()
    return
  }
  const theme = await prisma.theme.findFirst({ where: { slug: THEME }, select: { id: true, labelFr: true, labelEn: true, labelHt: true } })
  if (!theme) throw new Error(`thème ${THEME} introuvable`)
  const labels = [theme.labelFr, theme.labelEn, theme.labelHt].filter(Boolean).join(' ')

  const doc = await prisma.$transaction(
    async (tx) => {
      const d = await tx.document.create({
        data: {
          type: 'LEGISLATION',
          status: 'EN_VIGUEUR',
          titleFr: TITRE,
          bodyOriginal: corps,
          number: TITRE,
          source: SOURCE,
          annotationsJson,
          themeLabels: labels,
        },
      })
      await tx.documentTheme.create({ data: { documentId: d.id, themeId: theme.id, isPrimary: true } })
      await tx.document.update({
        where: { id: d.id },
        data: { searchText: buildSearchText({ ...d, themeLabels: labels } as never) },
      })
      await audit(
        { action: 'DOC_PUBLISHED', targetType: 'Document', targetId: d.id,
          meta: { source: SOURCE, motif: 'Code d’instruction criminelle', articles: ancres.length,
                  divisions: toc.length, index: src.index.length } },
        tx,
      )
      return d
    },
    { timeout: 120_000, maxWait: 30_000 },
  )
  console.log(`\n✓ Téléversé : ${doc.id} — thème ${THEME}, index de recherche calculé, journalisé.`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('ÉCHEC :', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
