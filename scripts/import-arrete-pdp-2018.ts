/**
 * Arrêté du 30 avril 2018 fixant les règles relatives à la protection des données à
 * caractère personnel (Le Moniteur, 173ᵉ année, n° 87, mardi 15 mai 2018) — Droit privé.
 *
 * Un arrêté présidentiel de cinq articles, transitoire : son article 1er dit lui-même qu'il
 * vaut « en attendant l'adoption de la loi y afférente ». L'article 3 énumère neuf exigences
 * applicables aux données enregistrées.
 *
 * DEUX DÉCISIONS DE LA CLIENTE, appliquées dès l'extraction (voir parse_pdp.py) :
 *   · le contenu de l'ARRÊTÉ prime sur le sommaire. Le texte porte DIX-HUIT ministres
 *     signataires, le sommaire en annonce dix-neuf : on retient dix-huit. On ne complète pas
 *     un arrêté d'après la description qu'un sommaire en donne, et le Moniteur de 2018 n'est
 *     pas au corpus pour nommer le manquant ;
 *   · le « pr » qui précédait deux signataires est retiré ;
 *   · le doublon de l'index est supprimé (36 entrées au lieu de 37) — établi par la mesure :
 *     le corps de l'entrée « Restriction - … » est identique caractère pour caractère à la
 *     queue de « Accès (restriction d'—) », à la parenthèse fermante près.
 *
 * NE FAIT PAS DOUBLON avec la fiche d'Index du Moniteur `ffe67f8e-…` (type INDEX, corps de
 * 85 caractères : le titre seul). Les deux coexistent et portent le même `number`, si bien
 * qu'une recherche « LM2018-87 » les ramène ensemble.
 *
 * Invariants vérifiés AVANT toute écriture :
 *   · le document n'existe pas déjà en LEGISLATION (idempotence) ;
 *   · les cinq articles reçoivent leur ancre, et la segmentation ne perd aucune ligne ;
 *   · les ancres du menu latéral existent toutes dans la page — le contrôle qui manquait au
 *     Code civil et y avait laissé un lien mort ;
 *   · aucun renvoi sortant ne vise une ancre absente du document cible ;
 *   · aucun `ctRefs` de l'index ne vise un article inexistant ;
 *   · searchText est calculé à l'écriture (il n'est reconstruit que par les routes d'admin).
 *
 *     npx tsx scripts/import-arrete-pdp-2018.ts
 *     npx tsx scripts/import-arrete-pdp-2018.ts --apply
 */
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'node:fs'
import { parseAnnotations, segmentAnnotated, type IndexEntry, type NavGroup, type TocEntry, type ConnexeBlock } from '../src/lib/legislation/annotated'
import { articleAnchorFromHeading } from '../src/lib/doc/anchors'
import { buildSearchText } from '../src/lib/search/normalize'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')
/** `--liens` : re-résout les renvois sortants d'un document DÉJÀ téléversé et les corrige. */
const LIENS = process.argv.includes('--liens')

const SOURCE = 'ARRETE_PDP_2018'
const TITRE = 'Arrêté du 30 avril 2018 fixant les règles relatives à la protection des données à caractère personnel'
const NUMERO = 'LM2018-87'
const MONITEUR = 'Le Moniteur · LM2018-87 · Mardi 15 mai 2018'
const THEME = 'droit-prive'

/** Textes visés par l'arrêté et présents sur la plateforme — rendus cliquables sous l'art. 1er. */
const VISAS_LIES = [
  { label: 'Constitution de 1987, articles 10, 11, 11-1, 12, 16, 16-2, 17 et 18', source: 'CONSTITUTION_1987', anchor: 'art-10' },
  { label: 'Code civil d’Haïti', source: 'CODE_CIVIL_ANNOTE' },
  { label: 'Code pénal d’Haïti', source: 'CODE_PENAL_ANNOTE' },
  { label: 'Loi du 14 février 2017 sur la signature électronique', source: 'LOI_SIGNATURE_ELECTRONIQUE_2017' },
]
// ⚠ Résoudre par `source`, JAMAIS par le titre : « signature électronique » ramène CINQ
// documents, dont deux fiches d'Index du Moniteur qui ne portent que le titre. Un findFirst
// sur le titre avait lié l'arrêté à l'une d'elles au lieu du texte intégral.

/**
 * « art. 3, 8) » → 3 ; « art. 1er » → 1.
 *
 * L'arrêté n'a que CINQ articles : un « art. N » au-delà désigne forcément un autre texte.
 * C'est le cas de l'entrée « Constitution — art. 10, 11, 11-1… (visa) », dont les renvois
 * visent la Constitution et non l'arrêté. On ne peut pas écarter en bloc les entrées
 * marquées « (visa) » ou « (considérants) » : celle des « Droits et libertés fondamentaux »
 * l'est, et porte pourtant de vrais renvois aux articles 2 et 4 de l'arrêté.
 */
function refsDe(sujet: string): { refs: number[]; ecartes: number[] } {
  const tous = [...new Set([...sujet.matchAll(/art\.\s*(\d{1,2})(?:er)?/gi)].map((x) => Number(x[1])))]
  return { refs: tous.filter((n) => n >= 1 && n <= 5), ecartes: tous.filter((n) => n < 1 || n > 5) }
}

async function main() {
  const src = JSON.parse(readFileSync('scripts/data/arrete-pdp-2018/source.json', 'utf8')) as {
    texte: string[]
    index: string[]
    sommaire: string[]
  }
  const corps = src.texte.join('\n')

  // ── idempotence ──────────────────────────────────────────────────────────────
  const existant = await prisma.document.findFirst({ where: { source: SOURCE }, select: { id: true } })
  if (existant && !LIENS) throw new Error(`déjà téléversé (${existant.id}) — relancer avec --liens pour recorriger les renvois`)
  if (!existant && LIENS) throw new Error('rien à corriger : le document n’est pas téléversé')

  // ── contrôles sur le texte ──────────────────────────────────────────────────
  const ancres = src.texte.map(articleAnchorFromHeading).filter(Boolean) as string[]
  if (ancres.join(',') !== 'art-1,art-2,art-3,art-4,art-5')
    throw new Error(`articles reconnus : ${ancres.join(', ') || 'aucun'} — attendu art-1..art-5`)
  const ministres = src.texte.filter((l) => /^(Le|La) Ministre/.test(l)).length
  if (src.texte.some((l) => /\bpr [A-ZÉ]/.test(l))) throw new Error('le « pr » subsiste dans le corps')

  // ── sommaire et menu ────────────────────────────────────────────────────────
  // Une seule entrée de table : « ARRÊTE », la ligne qui ouvre le dispositif. Les rubriques
  // du sommaire fourni (Visas, Considérants, Signatures) ne sont PAS des lignes du corps —
  // les inscrire fabriquerait des en-têtes que l'arrêté ne porte pas.
  const LIGNE_DISPOSITIF = 'ARRÊTE'
  if (!src.texte.includes(LIGNE_DISPOSITIF)) throw new Error('la ligne « ARRÊTE » est introuvable dans le corps')
  const toc: TocEntry[] = [{ level: 1, label: LIGNE_DISPOSITIF, anchor: 'sec-1', kind: 'code' }]
  const navToc: NavGroup[] = [
    {
      label: 'Dispositif',
      anchor: 'sec-1',
      children: [1, 2, 3, 4, 5].map((n) => ({ label: n === 1 ? 'Article 1er' : `Article ${n}`, anchor: `art-${n}` })),
    },
  ]

  // ── index ───────────────────────────────────────────────────────────────────
  const entrees = src.index.slice(4) // les quatre premières lignes sont le titre de l'index
  const indexEntries: IndexEntry[] = []
  const ecartees: string[] = []
  for (const sujet of entrees) {
    const { refs, ecartes } = refsDe(sujet)
    if (ecartes.length) ecartees.push(`« ${sujet.slice(0, 46)}… » → ${ecartes.join(', ')}`)
    indexEntries.push({ subject: sujet, ctRefs: refs })
  }
  // Garde auditable : le seul renvoi hors bornes attendu est celui de la Constitution.
  // Si l'index change et qu'un autre apparaît, on veut le savoir plutôt que l'ignorer.
  if (ecartees.length > 1 || (ecartees.length === 1 && !ecartees[0].startsWith('« Constitution')))
    throw new Error(`index : renvoi(s) hors bornes inattendu(s) —\n  ${ecartees.join('\n  ')}`)

  // ── renvois sortants ────────────────────────────────────────────────────────
  const connexe: Record<string, ConnexeBlock[]> = {}
  const blocs: ConnexeBlock[] = []
  for (const v of VISAS_LIES) {
    const cible = await prisma.document.findFirst({
      where: { source: v.source, type: 'LEGISLATION' },
      select: { id: true, type: true, titleFr: true, bodyOriginal: true, annotationsJson: true },
    })
    if (!cible) {
      console.log(`  ⚠ « ${v.label.slice(0, 50)} » : document absent — laissé en texte`)
      continue
    }
    let anchor: string | undefined
    if (v.anchor) {
      const a = parseAnnotations(cible.annotationsJson)
      const existe = segmentAnnotated(cible.bodyOriginal, a?.toc ?? []).some(
        (b) => b.kind === 'body' && b.anchor === v.anchor,
      )
      if (!existe) throw new Error(`${v.label} : l'ancre ${v.anchor} n'existe pas dans le document cible`)
      anchor = v.anchor
    }
    blocs.push({ label: v.label, text: '', docId: cible.id, ...(anchor ? { anchor } : {}) })
  }
  if (blocs.length) connexe['art-1'] = blocs

  const annotations = {
    title: TITRE,
    annotationAuthor: '',
    navToc,
    toc,
    connexes: [],
    jurisprudence: {},
    indexEntries,
    connexe,
    commentaires: {},
  }
  const annotationsJson = JSON.stringify(annotations)

  // ── INVARIANTS de rendu ─────────────────────────────────────────────────────
  const blocsSeg = segmentAnnotated(corps, toc)
  const ancresRendues = new Set(
    blocsSeg.flatMap((b) => (b.kind === 'section' ? [b.anchor] : b.anchor ? [b.anchor] : [])),
  )
  const menuMort = navToc.flatMap((g) => [g.anchor, ...g.children.map((c) => c.anchor)]).filter((a) => !ancresRendues.has(a))
  if (menuMort.length) throw new Error(`menu latéral : ancre(s) sans cible ${menuMort.join(', ')}`)
  const lignesRendues = blocsSeg.reduce((n, b) => n + b.text.split('\n').filter(Boolean).length, 0)
  if (lignesRendues !== src.texte.length)
    throw new Error(`segmentation : ${lignesRendues} lignes rendues pour ${src.texte.length} — du texte se perd`)

  // ── rapport ─────────────────────────────────────────────────────────────────
  console.log(`« ${TITRE.slice(0, 72)}… »`)
  console.log(`  corps : ${src.texte.length} lignes · ${corps.length} caractères`)
  console.log(`  articles : ${ancres.length} (${ancres.join(', ')})`)
  console.log(`  signataires : le Président, le Premier ministre et ${ministres} ministres`)
  console.log(`    (le sommaire en annonce dix-neuf — le texte prime, écart signalé)`)
  console.log(`  index : ${indexEntries.length} entrées · ${indexEntries.filter((e) => e.ctRefs.length).length} avec renvoi interne`)
  ecartees.forEach((l) => console.log(`    renvoi écarté (vise un autre texte) : ${l}`))
  console.log(`  table : ${toc.length} entrée · menu : ${navToc[0].children.length} articles · 0 ancre morte`)
  console.log(`  renvois sortants : ${blocs.length}`)
  blocs.forEach((b) => console.log(`    → ${b.label.slice(0, 62)}${b.anchor ? ` #${b.anchor}` : ''}`))

  if (LIENS) {
    const doc = await prisma.document.findUniqueOrThrow({ where: { id: existant!.id } })
    const av = JSON.parse(doc.annotationsJson!) as { connexe: Record<string, ConnexeBlock[]> }
    const avant = (av.connexe['art-1'] ?? []).map((b) => `${b.label} → ${b.docId}`)
    const apres = blocs.map((b) => `${b.label} → ${b.docId}`)
    const changes = apres.filter((x, i) => x !== avant[i])
    console.log(`\nrenvois : ${changes.length ? `${changes.length} à corriger` : 'déjà justes'}`)
    changes.forEach((x) => console.log(`  ${x}`))
    if (!changes.length || !APPLY) {
      console.log(APPLY ? '' : '\nSIMULATION — relancer avec --apply.')
      await prisma.$disconnect()
      return
    }
    const neuf = JSON.stringify({ ...av, connexe: { ...av.connexe, 'art-1': blocs } })
    await prisma.$transaction(async (tx) => {
      await tx.document.update({
        where: { id: doc.id },
        data: { annotationsJson: neuf, searchText: buildSearchText({ ...doc, annotationsJson: neuf } as never) },
      })
      await audit({ action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: doc.id,
        meta: { source: SOURCE, motif: 'renvois sortants re-résolus par source (une fiche d’Index du Moniteur avait été liée)' } }, tx)
    })
    console.log('\n✓ Renvois corrigés.')
    await prisma.$disconnect()
    return
  }

  if (!APPLY) {
    console.log('\nSIMULATION — rien n’a été écrit. Relancer avec --apply.')
    await prisma.$disconnect()
    return
  }

  const theme = await prisma.theme.findFirst({ where: { slug: THEME }, select: { id: true, labelFr: true, labelEn: true, labelHt: true } })
  if (!theme) throw new Error(`thème ${THEME} introuvable`)

  const doc = await prisma.$transaction(
    async (tx) => {
      const d = await tx.document.create({
        data: {
          type: 'LEGISLATION',
          status: 'PUBLIE',
          titleFr: TITRE,
          bodyOriginal: corps,
          number: NUMERO,
          moniteurRef: MONITEUR,
          publicationDate: new Date('2018-05-15T00:00:00Z'),
          effectiveDate: new Date('2018-04-30T00:00:00Z'),
          source: SOURCE,
          annotationsJson,
          themeLabels: [theme.labelFr, theme.labelEn, theme.labelHt].filter(Boolean).join(' '),
        },
      })
      await tx.documentTheme.create({ data: { documentId: d.id, themeId: theme.id, isPrimary: true } })
      const searchText = buildSearchText({ ...d, themeLabels: [theme.labelFr, theme.labelEn, theme.labelHt].filter(Boolean).join(' ') } as never)
      await tx.document.update({ where: { id: d.id }, data: { searchText } })
      await audit(
        { action: 'DOC_PUBLISHED', targetType: 'Document', targetId: d.id,
          meta: { source: SOURCE, motif: 'arrêté du 30 avril 2018 sur la protection des données personnelles',
                  articles: 5, index: indexEntries.length, ministres } },
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
