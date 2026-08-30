/**
 * CODE DES INVESTISSEMENTS — Loi du 9 septembre 2002.
 *
 *     npx tsx scripts/importer-code-investissements-2002.ts            # simulation
 *     npx tsx scripts/importer-code-investissements-2002.ts --apply    # Me Vaval, elle seule
 *
 * ⚠️ TROIS DATES, UNE SEULE FAIT LA RÉFÉRENCE. Sénat le 22 août 2002, Chambre des Députés le
 * 9 SEPTEMBRE 2002, promulgation le 9 octobre, publication le 26 novembre (Spécial n° 4). Une LOI
 * porte la date de son DERNIER VOTE : le 9 septembre. Ce n'est pas une commodité — c'est la date
 * sous laquelle le corpus la cite déjà, dans les visas du Décret énergie de 2016.
 *
 * ⚠️ LES TÊTES D'ARTICLE SONT NUES : « Article 1er » seul sur sa ligne, le texte à la suivante.
 * Forme que seule la Constitution partage dans le corpus. Mesuré : 85 ancres, aucune collision,
 * aucun trou de 1 à 83, plus « Art. 45.1 » et « Art. 45.2 » → art-45-1 et art-45-2.
 *
 * ⚠️ UN RENVOI AVEUGLE À RÉPARER. `DECRET_ENERGIE_ELECTRIQUE_2016` porte depuis le 29 août un
 * CrossRef vers ce Code avec `toId = NULL`, posé par désignation faute de cible. Le verser sans
 * lui donner son identifiant laisserait la fiche du décret énergie afficher « cible non importée »
 * alors que la cible existe. Il est repris DANS LA MÊME TRANSACTION, retrouvé par son `id`.
 *
 * ⚠️ AUCUN RENVOI POUR LA CLAUSE-BALAI de l'article 83 : elle ne nomme personne. Le rendu public
 * afficherait « ABROGE → … · cible non importée » sans jamais lire la note — quatre renvois de ce
 * type ont été retirés du corpus le 30 août pour cette raison.
 *
 * ⚠️ L'INDEX SE LIT AU TIRET CADRATIN, pas à la virgule. Et une liste de préfixes à sauter est un
 * piège : « Convention » écartait « Convention avec l'État — art. 1, 15, 37… », dix renvois.
 */
import { prisma } from '../src/lib/db'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { audit } from '../src/lib/auth/audit'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated } from '../src/lib/legislation/annotated'

const APPLY = process.argv.includes('--apply')
const D = join(process.cwd(), 'scripts/data/investissements-2002')
const lire = (f: string) => readFileSync(join(D, f), 'utf8').replace(/\n+$/, '')
const lireJson = <T>(f: string): T => JSON.parse(lire(f)) as T

const SOURCE = 'CODE_INVESTISSEMENTS_2002'
const TITRE =
  'Loi du 9 septembre 2002 portant sur le Code des investissements modifiant le Décret du 30 octobre 1989 ' +
  'relatif au Code des investissements'
const MONITEUR = 'Le Moniteur · LM2002-SP4 · Spécial n° 4 du mardi 26 novembre 2002'
const AVERTISSEMENT =
  'Index alphabétique des mots-clés : annexe éditoriale. Les renvois indiquent les articles du Code, ' +
  'non les pages. Cet index ne fait pas partie du texte publié au Moniteur.'
const ARTICLES = 85
const DIVISIONS = 32

type Toc = { level: number; label: string; anchor: string; kind: string }
type Idx = { subject: string; ctRefs: string[] }
type Noeud = { label: string; anchor: string; children: Noeud[] }

/** Menu latéral HIÉRARCHIQUE — TocPanel n'affiche que les groupes et leurs enfants, jamais toc. */
function navDepuisToc(toc: Toc[]): Noeud[] {
  const racines: Noeud[] = []
  const pile: { level: number; noeud: Noeud }[] = []
  for (const t of toc) {
    const n: Noeud = { label: t.label, anchor: t.anchor, children: [] }
    while (pile.length && pile[pile.length - 1].level >= t.level) pile.pop()
    if (pile.length) pile[pile.length - 1].noeud.children.push(n)
    else racines.push(n)
    pile.push({ level: t.level, noeud: n })
  }
  return racines
}
const compter = (n: Noeud[]): number => n.reduce((s, x) => s + 1 + compter(x.children), 0)

/** « art-45-1 » → « Article 45.1 » ; « art-1 » → « Article 1er ». labelFromAnchor ignore l'ordinal. */
function libelle(ancre: string): string {
  const n = ancre.replace('art-', '').replace(/-/g, '.')
  return `Article ${n === '1' ? '1er' : n}`
}

async function main() {
  // ⚠️ L'IDEMPOTENCE SE TESTE EN PREMIER.
  if (await prisma.document.findFirst({ where: { source: SOURCE }, select: { id: true } })) {
    console.log('Code des investissements déjà versé — rien à faire.'); await prisma.$disconnect(); return
  }

  const corps = lire('corps-investissements.txt')
  const toc = lireJson<Toc[]>('toc-investissements.json')
  const index = lireJson<Idx[]>('index-investissements.json')
  if (toc.length !== DIVISIONS) throw new Error(`sommaire ${toc.length}, ${DIVISIONS} attendues. STOP`)

  const jeu = new Set(corps.split('\n').map((x) => x.trim()))
  const orphelines = toc.filter((t) => !jeu.has(t.label))
  if (orphelines.length) throw new Error(`${orphelines.length} libellé(s) de sommaire absent(s) du corps — « ${orphelines[0].label.slice(0, 60)} ». STOP`)

  const blocs = segmentAnnotated(corps, toc) as { kind: string; anchor?: string | null; jurisKey?: string | null }[]
  const porteurs = blocs.filter((b) => b.kind === 'body' && b.anchor)
  const compte = new Map<string, number>()
  for (const b of porteurs) compte.set(b.anchor!, (compte.get(b.anchor!) ?? 0) + 1)
  const collisions = [...compte].filter(([, n]) => n > 1)
  if (collisions.length) throw new Error(`ancres en COLLISION — ${collisions.map(([a, n]) => `${a}×${n}`).join(', ')}. STOP`)
  if (porteurs.length !== ARTICLES) throw new Error(`${porteurs.length} blocs à ancre, ${ARTICLES} attendus. STOP`)
  const sections = blocs.filter((b) => b.kind === 'section').length
  if (sections !== DIVISIONS) throw new Error(`${sections} sections rendues, ${DIVISIONS} attendues. STOP`)

  const anc = [...compte.keys()]
  for (const d of ['art-45-1', 'art-45-2']) if (!anc.includes(d)) throw new Error(`ancre décimale ${d} absente. STOP`)

  const ancres = new Set(anc)
  const morts = index.flatMap((e) => e.ctRefs.filter((r) => !ancres.has(`art-${r}`)).map((r) => `${e.subject.slice(0, 26)}→art-${r}`))
  if (morts.length) throw new Error(`${morts.length} renvoi(s) mort(s) — ${morts.slice(0, 4).join(' · ')}. STOP`)

  const nav = navDepuisToc(toc)
  if (compter(nav) !== toc.length) throw new Error(`${compter(nav)} nœuds de menu pour ${toc.length} entrées. STOP`)

  // ── cibles des renvois sortants ────────────────────────────────────────────────────
  // ⚠️ `source` N'EST PAS UNE CLEF UNIQUE. Le Code des douanes existe en DEUX exemplaires sous
  // le même `source` — un en LEGISLATION, un en DOCTRINE (la copie voulue de juin 2026). On vise
  // l'exemplaire de LÉGISLATION quand il existe, et l'on exige qu'il n'y en ait qu'un.
  const codes = await prisma.document.findMany({
    where: { source: { in: ['CODE_TRAVAIL_ANNOTE', 'CODE_PROCEDURE_CIVILE', 'CODE_DOUANES_ANNOTE'] } },
    select: { id: true, source: true, type: true, titleFr: true },
  })
  const parSource = new Map<string, { id: string; source: string | null; type: string; titleFr: string | null }>()
  for (const src of ['CODE_TRAVAIL_ANNOTE', 'CODE_PROCEDURE_CIVILE', 'CODE_DOUANES_ANNOTE']) {
    const tous = codes.filter((c) => c.source === src)
    if (!tous.length) throw new Error(`${src} introuvable en base. STOP`)
    const leg = tous.filter((c) => c.type === 'LEGISLATION')
    const choix = leg.length ? leg : tous
    if (choix.length !== 1) throw new Error(`${src} : ${choix.length} exemplaires concurrents (${choix.map((c) => c.type).join(', ')}) — on ne devine pas. STOP`)
    parSource.set(src, choix[0])
  }
  console.log(`  cibles des renvois : ${[...parSource].map(([s, c]) => `${s} [${c.type}]`).join(' · ')}`)

  // ── le renvoi aveugle du décret énergie ────────────────────────────────────────────
  const aveugles = await prisma.crossRef.findMany({
    where: { toId: null, toLabel: { contains: 'Code des investissements' } },
    select: { id: true, kind: true, toLabel: true, from: { select: { source: true } } },
  })

  // ── contrôle d'unicité de l'intitulé ───────────────────────────────────────────────
  const homonymes = await prisma.document.findMany({ where: { titleFr: TITRE }, select: { source: true } })
  if (homonymes.length) throw new Error(`intitulé déjà porté par ${homonymes.map((h) => h.source).join(', ')}. STOP`)

  console.log(`${TITRE}\n`)
  console.log(`  ${corps.split('\n').length} lignes · ${porteurs.length} articles (dont art-45-1 et art-45-2) · sommaire ${toc.length} · menu ${compter(nav)} nœuds`)
  console.log(`  index ${index.length} entrées · ${index.reduce((n, e) => n + e.ctRefs.length, 0)} renvois · 0 mort`)
  console.log(`  adopté 2002-09-09 (dernier vote, Chambre des Députés) · publié 2002-11-26`)
  console.log(`  thème : Droit économique & des affaires (racine) en primaire · copie sous Fiscalité`)
  const LIBELLES: Record<string, string> = {
    CODE_TRAVAIL_ANNOTE: 'Code du Travail',
    CODE_PROCEDURE_CIVILE: 'Code de procédure civile d’Haïti',
    CODE_DOUANES_ANNOTE: 'Code douanier d’Haïti (Décret du 21 mars 2023)',
  }
  console.log(`\n  renvois sortants :`)
  console.log(`     titre de la loi → Décret du 30 octobre 1989 (désignation — absent du corpus)`)
  for (const [art, src] of [['7 b)', 'CODE_TRAVAIL_ANNOTE'], ['15', 'CODE_PROCEDURE_CIVILE'], ['28 b) et 31 3)', 'CODE_DOUANES_ANNOTE']] as const)
    console.log(`     art. ${art} → ${LIBELLES[src]} [lien vers ${src}]`)
  console.log(`\n  renvoi aveugle à réparer : ${aveugles.length}`)
  for (const a of aveugles) console.log(`     [${a.from.source}] ${a.kind} → ${a.toLabel?.slice(0, 56)}`)
  console.log(`\n  aucun renvoi tiré de la clause-balai de l'article 83`)

  if (!APPLY) { console.log('\nSIMULATION — rien n’a été écrit.'); await prisma.$disconnect(); return }

  const eco = await prisma.theme.findFirst({ where: { slug: 'economique' }, select: { id: true, labelFr: true } })
  const fisc = await prisma.theme.findFirst({ where: { slug: 'fiscalite' }, select: { id: true, labelFr: true } })
  if (!eco || !fisc) throw new Error('thème economique ou fiscalite introuvable. STOP')

  let docId = ''
  await prisma.$transaction(async (tx) => {
    const doc = await tx.document.create({
      data: {
        type: 'LEGISLATION', status: 'EN_VIGUEUR', titleFr: TITRE, number: TITRE,
        bodyOriginal: corps, originalLang: 'fr', source: SOURCE, category: 'LEGISLATION',
        moniteurRef: MONITEUR,
        adoptionDate: new Date('2002-09-09T00:00:00Z'),
        publicationDate: new Date('2002-11-26T00:00:00Z'),
        annotationsJson: JSON.stringify({
          title: TITRE, annotationAuthor: AVERTISSEMENT, toc, navToc: nav,
          connexes: [], connexe: {}, jurisprudence: {},
          indexEntries: index, commentaires: {},
          labels: Object.fromEntries(anc.map((a) => [a, libelle(a)])),
        }),
      },
    })
    docId = doc.id
    // ⚠️ Supprimer d'abord, promouvoir ensuite — jamais l'inverse (DocumentTheme_one_primary).
    await tx.documentTheme.create({ data: { documentId: doc.id, themeId: eco.id, isPrimary: true, assignedBy: 'IMPORT' } })
    await tx.documentTheme.create({ data: { documentId: doc.id, themeId: fisc.id, isPrimary: false, assignedBy: 'IMPORT' } })

    await tx.crossRef.createMany({
      data: [
        { fromId: doc.id, toType: 'LEGISLATION', kind: 'MODIFIE', position: 0, source: 'EDITORIAL',
          toNumber: 'Décret du 30 octobre 1989 relatif au Code des investissements',
          toLabel: 'Décret du 30 octobre 1989 relatif au Code des investissements',
          note: 'Intitulé même de la loi : « Loi portant sur le Code des investissements MODIFIANT le décret du 30 octobre 1989 relatif au Code des investissements ». Renvoi PAR DÉSIGNATION : le décret de 1989 n’est pas au corpus — sans lui, ce qui a changé ne peut être mesuré.' },
        { fromId: doc.id, toId: parSource.get('CODE_TRAVAIL_ANNOTE')!.id, toType: 'LEGISLATION', kind: 'CITE', position: 1, source: 'EDITORIAL',
          toLabel: 'Code du Travail',
          note: 'Article 7 b) : « embaucher et de licencier son personnel dans le respect des dispositions du Code du Travail ».' },
        { fromId: doc.id, toId: parSource.get('CODE_PROCEDURE_CIVILE')!.id, toType: 'LEGISLATION', kind: 'CITE', position: 2, source: 'EDITORIAL',
          toLabel: 'Code de procédure civile d’Haïti',
          note: 'Article 15 : « Les décisions judiciaires et les sentences arbitrales prononcées à l’étranger sont exécutoires en Haïti sous réserve des formalités prévues au Code de Procédure Civile et dans les conventions internationales… ».' },
        { fromId: doc.id, toId: parSource.get('CODE_DOUANES_ANNOTE')!.id, toType: 'LEGISLATION', kind: 'CITE', position: 3, source: 'EDITORIAL',
          // ⚠️ Libellé ÉCRIT, non emprunté au titre de la cible : le titleFr de cette fiche commence par
          // le mastic du Moniteur (« Le Moniteur — Édition spéciale n° 11 — 21 mars 2023 — Décret… »),
          // ce qui ferait un renvoi illisible. Défaut de CETTE fiche, signalé à part.
          toLabel: 'Code douanier d’Haïti (Décret du 21 mars 2023)',
          note: 'Articles 28 b) et 31 3) : « la dispense du dépôt des garanties prévue au Code Douanier pour les mêmes biens en admission temporaire ». UN SEUL renvoi pour DEUX articles : on ne pose pas deux liens vers la même cible.' },
      ],
    })

    // ⚠️ Le renvoi aveugle reçoit sa cible. Repris par son `id`, jamais par son `toLabel`.
    for (const a of aveugles)
      await tx.crossRef.update({ where: { id: a.id }, data: { toId: doc.id } })

    await audit({
      action: 'DOC_PUBLISHED', targetType: 'Document', targetId: doc.id,
      meta: {
        motif:
          'Code des investissements versé en Législation annotée : Loi du 9 SEPTEMBRE 2002 (date du dernier ' +
          'vote, Chambre des Députés ; le Sénat avait voté le 22 août, la promulgation est du 9 octobre, la ' +
          'publication du 26 novembre au Spécial n° 4). 85 articles dont art-45-1 et art-45-2, 32 divisions, ' +
          'index de 138 entrées et 393 renvois, aucun mort. Thème primaire : Droit économique & des affaires ' +
          '(la racine, décision de Me Vaval du 30 août 2026) ; copie sous Fiscalité, où l’on vient chercher ' +
          'les exemptions du Titre IV. Quatre renvois sortants, dont trois cliquables (Code du travail, Code ' +
          'de procédure civile, Code douanier) et un par désignation (Décret du 30 octobre 1989, absent). ' +
          'AUCUN renvoi tiré de la clause-balai de l’article 83. ' +
          `${aveugles.length} renvoi(s) aveugle(s) vers ce Code repris et pourvu(s) de leur identifiant.`,
        articles: porteurs.length, index: index.length, renvoisAveuglesRepris: aveugles.length,
      },
    }, tx)
  }, { timeout: 180_000, maxWait: 30_000 })

  // ── contrôles de sortie : on RELIT la base ─────────────────────────────────────────
  await reindexDocument(docId)
  const d = await prisma.document.findUnique({
    where: { id: docId },
    select: { bodyOriginal: true, annotationsJson: true, titleFr: true, number: true, adoptionDate: true, publicationDate: true, searchText: true,
      themes: { select: { isPrimary: true, theme: { select: { slug: true } } } } },
  })
  const a = JSON.parse(String(d?.annotationsJson ?? '{}'))
  const rendu = new Set((segmentAnnotated(d?.bodyOriginal ?? '', a.toc ?? []) as { kind: string; anchor?: string | null }[])
    .filter((x) => x.kind === 'body' && x.anchor).map((x) => x.anchor))
  const mortsApres = (a.indexEntries ?? []).flatMap((e: Idx) => e.ctRefs.filter((r) => !rendu.has(`art-${r}`)))
  const xr = await prisma.crossRef.findMany({ where: { fromId: docId }, select: { kind: true, toId: true } })
  const repris = await prisma.crossRef.count({ where: { toId: docId } })
  const prim = d?.themes.filter((t) => t.isPrimary) ?? []
  console.log(`\n✓ ${rendu.size} ancres · sommaire ${(a.toc ?? []).length} · menu ${compter(a.navToc ?? [])} nœuds · index ${(a.indexEntries ?? []).length} · renvois morts ${mortsApres.length}`)
  console.log(`  titre=réf ${d?.titleFr === d?.number ? 'oui' : 'NON'} · adopté ${d?.adoptionDate?.toISOString().slice(0, 10)} · publié ${d?.publicationDate?.toISOString().slice(0, 10)} · searchText ${d?.searchText?.length ?? 0} c.`)
  console.log(`  thèmes : ${d?.themes.map((t) => `${t.theme.slug}${t.isPrimary ? '*' : ''}`).join(', ')} — ${prim.length} primaire`)
  console.log(`  ${xr.length} renvois sortants (${xr.filter((r) => r.toId).length} cliquables) · ${repris} renvoi(s) entrant(s) désormais pourvus`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  const m = e instanceof Error ? e.message : String(e)
  console.error('ÉCHEC :', m.trim() ? m : e)
  await prisma.$disconnect(); process.exit(1)
})
