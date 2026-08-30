/**
 * GESTION DE L'ENVIRONNEMENT 2005 · TAXATION DES CARRIÈRES 2020 · CIMENT ET ACIERS 2018.
 *
 *     npx tsx scripts/importer-environnement-carrieres-2005.ts            # simulation
 *     npx tsx scripts/importer-environnement-carrieres-2005.ts --apply    # Me Vaval, elle seule
 *
 * ⚠️ LE DÉCRET SUR LES CARRIÈRES EST LE SECOND DU SPÉCIAL N° 21 — celui qui manquait au lot des
 * denrées alimentaires. Le fascicule est désormais complet. Et il porte ENCORE la date du 11 mars
 * 2020 : avec les denrées, la protection du consommateur et la notice du NIN, quatre actes la
 * partagent. Seul le nom complet les distingue.
 *
 * ⚠️ AUCUNE COLLISION D'ANCRES ICI, et il faut savoir pourquoi. `articleAnchorFromHeading`
 * reconnaît volontairement les têtes « Section N » et leur donne art-N — ce qui a fait entrer en
 * collision 20 lignes du décret sur les denrées. Ici, rien : les sections du décret de 2005 sont
 * numérotées en CHIFFRES ROMAINS (« Section I.- »), que l'expression n'attend pas. Le sommaire
 * reste indispensable pour porter les 41 ancres sec-N ; il ne rattrape simplement aucune collision.
 *
 * ⚠️ L'INDEX DE 2005 A DEUX PARTICULARITÉS, et un premier lecteur en a perdu 97 lignes :
 *   · la virgule avant « art. » est FACULTATIVE (« Assemblées de collectivités territoriales
 *     art. 31, 34 ») ;
 *   · les sous-entrées ne portent pas de tiret : elles se signalent par une MINUSCULE initiale.
 * Compté à la relecture : 352 entrées, 1 284 renvois, aucun mort.
 *
 * ⚠️ LE SOMMAIRE DE LA CLIENTE ANNONCE 27 VISAS, LE CORPS EN PORTE 33. Le Moniteur prévaut : le
 * corps n'est pas amputé pour coller au sommaire. L'écart est dit en note d'édition, et le script
 * REFUSE de tourner si les comptes changent.
 *
 * ⚠️ L'ARRÊTÉ SUR LE CIMENT N'EST NI MINIER NI ENVIRONNEMENTAL : il soumet l'importation à une
 * autorisation du Ministère du Commerce, avec contrôle qualité du Laboratoire National du Bâtiment
 * et des Douanes. Thème COMMERCE en primaire, copie sous Travaux publics — décision de Me Vaval
 * du 30 août 2026.
 */
import { prisma } from '../src/lib/db'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { audit } from '../src/lib/auth/audit'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated } from '../src/lib/legislation/annotated'

const APPLY = process.argv.includes('--apply')
const D = join(process.cwd(), 'scripts/data/environnement-2005')
const lire = (f: string) => readFileSync(join(D, f), 'utf8').replace(/\n+$/, '')
const lireJson = <T>(f: string): T => JSON.parse(lire(f)) as T

type Toc = { level: number; label: string; anchor: string; kind: string }
type Idx = { subject: string; ctRefs: number[] }
type Noeud = { label: string; anchor: string; children: Noeud[] }

/** Menu latéral HIÉRARCHIQUE — TocPanel n'affiche que les groupes et leurs enfants, jamais toc. */
function navDepuisToc(toc: Toc[]): Noeud[] {
  const r: Noeud[] = []
  const pile: { level: number; noeud: Noeud }[] = []
  for (const t of toc) {
    const n: Noeud = { label: t.label, anchor: t.anchor, children: [] }
    while (pile.length && pile[pile.length - 1].level >= t.level) pile.pop()
    if (pile.length) pile[pile.length - 1].noeud.children.push(n)
    else r.push(n)
    pile.push({ level: t.level, noeud: n })
  }
  return r
}
const compter = (n: Noeud[]): number => n.reduce((s, x) => s + 1 + compter(x.children), 0)
const libelle = (a: string) => {
  const n = a.replace('art-', '').replace(/-/g, '.')
  return `Article ${n === '1' ? '1er' : n}`
}

const AVERT_ENV =
  'Sommaire et index : annexes éditoriales. ⚠️ Le sommaire fourni annonce « 27 visas » ; le texte ' +
  'publié au Moniteur en porte 33, et 9 considérants. Le Journal officiel fait foi : le corps n’a ' +
  'pas été amputé pour coller au sommaire.'

const FICHES = [
  {
    slug: 'environnement', source: 'DECRET_GESTION_ENVIRONNEMENT_2005', articles: 162, toc: 41,
    titre: 'Décret du 12 octobre 2005 portant sur la Gestion de l’Environnement et de Régulation de la Conduite des Citoyens et Citoyennes pour un Développement Durable',
    adoption: '2005-10-12', publication: '2006-01-26',
    moniteur: 'Le Moniteur · LM2006-11 · 161ᵉ année, n° 11 du jeudi 26 janvier 2006',
    theme: 'environnement', copie: null, avert: AVERT_ENV, index: true,
  },
  {
    slug: 'carrieres', source: 'DECRET_TAXATION_CARRIERES_2020', articles: 13, toc: 0,
    titre: 'Décret du 11 mars 2020 établissant un système de taxation couvrant les carrières, les matériaux de carrières et les transporteurs de matériaux de carrières',
    adoption: '2020-03-11', publication: '2020-08-10',
    moniteur: 'Le Moniteur · LM2020-SP21 · 175ᵉ année, Spécial n° 21 du lundi 10 août 2020',
    theme: 'droit-minier', copie: null, avert: '', index: false,
  },
  {
    slug: 'ciment', source: 'ARRETE_CIMENT_ACIERS_2018', articles: 6, toc: 0,
    titre: 'Arrêté du 13 mars 2018 portant régulation de l’importation et de la commercialisation du ciment et des aciers utilisés dans la construction',
    adoption: '2018-03-13', publication: '2018-04-30',
    moniteur: 'Le Moniteur · LM2018-77 · 173ᵉ année, n° 77 du lundi 30 avril 2018',
    theme: 'commerce-industrie', copie: 'travaux-publics-transports', avert: '', index: false,
  },
] as const

async function main() {
  // ⚠️ L'IDEMPOTENCE SE TESTE EN PREMIER.
  const deja = await prisma.document.findMany({ where: { source: { in: FICHES.map((f) => f.source) } }, select: { source: true } })
  if (deja.length === FICHES.length) { console.log('les trois actes sont déjà versés — rien à faire.'); await prisma.$disconnect(); return }
  if (deja.length) throw new Error(`versement PARTIEL : ${deja.map((d) => d.source).join(', ')}. STOP`)

  const prep = FICHES.map((f) => {
    const corps = lire(`corps-${f.slug}.txt`)
    const toc = lireJson<Toc[]>(`toc-${f.slug}.json`)
    if (toc.length !== f.toc) throw new Error(`${f.source} : sommaire ${toc.length}, ${f.toc} attendues. STOP`)
    const jeu = new Set(corps.split('\n').map((x) => x.trim()))
    const orph = toc.filter((t) => !jeu.has(t.label))
    if (orph.length) throw new Error(`${f.source} : ${orph.length} libellé(s) absent(s) — « ${orph[0].label.slice(0, 56)} ». STOP`)

    const blocs = segmentAnnotated(corps, toc) as { kind: string; anchor?: string | null }[]
    const porteurs = blocs.filter((b) => b.kind === 'body' && b.anchor)
    const cpt = new Map<string, number>()
    for (const b of porteurs) cpt.set(b.anchor!, (cpt.get(b.anchor!) ?? 0) + 1)
    const col = [...cpt].filter(([, n]) => n > 1)
    if (col.length) throw new Error(`${f.source} : ancres en COLLISION — ${col.map(([a, n]) => `${a}×${n}`).join(', ')}. STOP`)
    if (porteurs.length !== f.articles) throw new Error(`${f.source} : ${porteurs.length} blocs à ancre, ${f.articles} attendus. STOP`)
    if (blocs.filter((b) => b.kind === 'section').length !== f.toc) throw new Error(`${f.source} : sections rendues ≠ ${f.toc}. STOP`)

    const anc = [...cpt.keys()]
    const ancres = new Set(anc)
    const index = f.index ? lireJson<Idx[]>(`index-${f.slug}.json`) : []
    const morts = index.flatMap((e) => e.ctRefs.filter((n) => !ancres.has(`art-${n}`)).map((n) => `${e.subject.slice(0, 24)}→art-${n}`))
    if (morts.length) throw new Error(`${f.source} : ${morts.length} renvoi(s) mort(s) — ${morts.slice(0, 4).join(' · ')}. STOP`)

    const nav = navDepuisToc(toc)
    if (compter(nav) !== toc.length) throw new Error(`${f.source} : ${compter(nav)} nœuds pour ${toc.length} entrées. STOP`)

    // ⚠️ Le script AFFIRME 33 visas et 9 considérants dans sa note d'édition : il le vérifie.
    if (f.slug === 'environnement') {
      const vus = corps.split('\n').filter((l) => /^Vu /.test(l.trim())).length
      const cons = corps.split('\n').filter((l) => /^Considérant/.test(l.trim())).length
      if (vus !== 33 || cons !== 9) throw new Error(`${f.source} : ${vus} visas et ${cons} considérants, 33 et 9 attendus. STOP`)
    }
    return { f, corps, toc, nav, index, anc }
  })

  const slugs = [...new Set(FICHES.flatMap((f) => [f.theme, f.copie].filter(Boolean) as string[]))]
  const themes = await prisma.theme.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true, labelFr: true, _count: { select: { documents: true } } },
  })
  if (themes.length !== slugs.length) throw new Error(`${themes.length} thème(s) sur ${slugs.length} trouvés. STOP`)
  const parSlug = new Map(themes.map((t) => [t.slug, t]))

  const memeJour = await prisma.document.findMany({ where: { adoptionDate: new Date('2020-03-11T00:00:00Z') }, select: { titleFr: true, type: true } })
  const titres = [...memeJour.map((d) => d.titleFr ?? ''), ...FICHES.map((f) => f.titre)]
  if (new Set(titres).size !== titres.length) throw new Error('deux actes du 11 mars 2020 porteraient le même intitulé. STOP')
  const memeJour2005 = await prisma.document.findMany({ where: { titleFr: { contains: '12 octobre 2005' } }, select: { source: true } })

  console.log('Gestion de l’environnement · taxation des carrières · ciment et aciers\n')
  for (const p of prep) {
    const th = parSlug.get(p.f.theme)!
    console.log(`  ${p.f.source.padEnd(34)} ${String(p.corps.split('\n').length).padStart(4)} l. · ${String(p.anc.length).padStart(3)} art. · sommaire ${String(p.toc.length).padStart(2)} · index ${String(p.index.length).padStart(3)} (${p.index.reduce((n, e) => n + e.ctRefs.length, 0)} renvois)`)
    console.log(`  ${' '.repeat(34)} → ${th.labelFr} (${th._count.documents} doc)${p.f.copie ? ` + copie sous ${parSlug.get(p.f.copie)!.labelFr}` : ''}`)
  }
  console.log(`\n  visas du décret de 2005 : 33 dans le corps contre 27 annoncés par le sommaire — le Moniteur prévaut, l’écart est dit en note`)
  console.log(`  actes du 12 octobre 2005 déjà en base : ${memeJour2005.length}${memeJour2005.length ? ' — ' + memeJour2005.map((d) => d.source).join(', ') : ''}`)
  console.log(`  ⚠️ le décret TNT de 2026 cite un « Décret du 12 octobre 2005 sur les droits d’auteur » : autre acte du même jour, absent du corpus`)
  console.log(`  aucun renvoi tiré des clauses-balai (env. art. 162, carrières art. 13, ciment art. 6)`)

  if (!APPLY) { console.log('\nSIMULATION — rien n’a été écrit.'); await prisma.$disconnect(); return }

  const ids = new Map<string, string>()
  await prisma.$transaction(async (tx) => {
    for (const p of prep) {
      const doc = await tx.document.create({
        data: {
          type: 'LEGISLATION', status: 'EN_VIGUEUR', titleFr: p.f.titre, number: p.f.titre,
          bodyOriginal: p.corps, originalLang: 'fr', source: p.f.source, category: 'LEGISLATION',
          moniteurRef: p.f.moniteur,
          adoptionDate: new Date(`${p.f.adoption}T00:00:00Z`),
          publicationDate: new Date(`${p.f.publication}T00:00:00Z`),
          annotationsJson: JSON.stringify({
            title: p.f.titre, annotationAuthor: p.f.avert, toc: p.toc, navToc: p.nav,
            connexes: [], connexe: {}, jurisprudence: {},
            indexEntries: p.index, commentaires: {},
            labels: Object.fromEntries(p.anc.map((a) => [a, libelle(a)])),
          }),
        },
      })
      ids.set(p.f.slug, doc.id)
      await tx.documentTheme.create({ data: { documentId: doc.id, themeId: parSlug.get(p.f.theme)!.id, isPrimary: true, assignedBy: 'IMPORT' } })
      if (p.f.copie) await tx.documentTheme.create({ data: { documentId: doc.id, themeId: parSlug.get(p.f.copie)!.id, isPrimary: false, assignedBy: 'IMPORT' } })
    }

    const idEnv = ids.get('environnement')!
    const idCar = ids.get('carrieres')!
    // ⚠️ Le Code des investissements peut avoir été versé par l'autre import : on le CHERCHE, et
    // l'on pose un lien si on le trouve, une désignation sinon. Jamais de supposition sur l'ordre.
    const codeInv = await tx.document.findFirst({ where: { source: 'CODE_INVESTISSEMENTS_2002' }, select: { id: true } })
    await tx.crossRef.createMany({
      data: [
        {
          fromId: idCar, toType: 'LEGISLATION', kind: 'CITE', position: 0, source: 'EDITORIAL',
          toNumber: 'Décret du 2 mars 1984 réglementant les exploitations de carrières sur toute l’étendue du territoire national',
          toLabel: 'Décret du 2 mars 1984 réglementant les exploitations de carrières',
          note: 'Articles 3 et 6 du Décret : « tout titulaire d’un permis d’exploitation de carrières délivré par le Bureau des Mines et de l’Énergie en application des dispositions du Décret du 2 mars 1984 réglementant les exploitations de carrières ». UN SEUL renvoi pour DEUX articles. Renvoi PAR DÉSIGNATION : le décret de 1984 n’est pas au corpus — sans lui, le régime des permis de carrière reste hors de portée du lecteur.',
        },
        codeInv
          ? {
              fromId: idEnv, toId: codeInv.id, toType: 'LEGISLATION', kind: 'CITE', position: 0, source: 'EDITORIAL',
              toLabel: 'Code des investissements (Loi du 9 septembre 2002)',
              note: 'Article 83 du Décret : renvoi nominatif au Code des investissements.',
            }
          : {
              fromId: idEnv, toType: 'LEGISLATION', kind: 'CITE', position: 0, source: 'EDITORIAL',
              toNumber: 'Loi du 9 septembre 2002 portant sur le Code des investissements',
              toLabel: 'Code des investissements (Loi du 9 septembre 2002)',
              note: 'Article 83 du Décret : renvoi nominatif au Code des investissements. Renvoi PAR DÉSIGNATION : le Code n’était pas au corpus au moment du versement — à reprendre s’il y entre.',
            },
      ],
    })

    await audit({
      action: 'DOC_PUBLISHED', targetType: 'Document', targetId: 'ENVIRONNEMENT_CARRIERES_2005',
      meta: {
        motif:
          'Trois actes versés en Législation annotée : Décret du 12 octobre 2005 sur la Gestion de ' +
          'l’Environnement (162 art., 41 divisions, index de 352 entrées et 1 284 renvois — il OUVRE la ' +
          'branche Environnement, jusque-là vide) ; Décret du 11 mars 2020 sur la taxation des carrières ' +
          '(13 art.), SECOND décret du Spécial n° 21, qui complète le fascicule commencé avec les denrées ' +
          'alimentaires ; Arrêté du 13 mars 2018 sur le ciment et les aciers (6 art.). ' +
          '⚠️ Le sommaire fourni annonce 27 visas, le corps en porte 33 : le Moniteur prévaut, l’écart est ' +
          'porté en note d’édition et vérifié par le script. ⚠️ L’arrêté sur le ciment va sous Commerce & ' +
          'industrie en primaire, avec copie sous Travaux publics (décision de Me Vaval du 30 août 2026) : ' +
          'il régit l’importation et le contrôle de qualité de matériaux, non l’extraction ni l’environnement. ' +
          `Renvoi vers le Code des investissements : ${codeInv ? 'CLIQUABLE' : 'par désignation (Code absent au moment du versement)'}. ` +
          'AUCUN renvoi tiré des clauses-balai.',
        verses: prep.map((p) => p.f.source), articles: prep.map((p) => p.anc.length),
      },
    }, tx)
  }, { timeout: 180_000, maxWait: 30_000 })

  // ── contrôles de sortie : on RELIT la base (audit() avale ses erreurs) ─────────────
  const journal = await prisma.auditLog.count({ where: { targetId: 'ENVIRONNEMENT_CARRIERES_2005' } })
  for (const id of ids.values()) await reindexDocument(id)
  console.log(`\n✓ AuditLog ${journal} (recompté) · ${ids.size} documents réindexés`)
  for (const p of prep) {
    const d = await prisma.document.findUnique({
      where: { id: ids.get(p.f.slug)! },
      select: {
        bodyOriginal: true, annotationsJson: true, titleFr: true, number: true, adoptionDate: true, searchText: true,
        themes: { select: { isPrimary: true, theme: { select: { slug: true } } } },
      },
    })
    const a = JSON.parse(String(d?.annotationsJson ?? '{}'))
    const rendu = new Set((segmentAnnotated(d?.bodyOriginal ?? '', a.toc ?? []) as { kind: string; anchor?: string | null }[])
      .filter((x) => x.kind === 'body' && x.anchor).map((x) => x.anchor))
    const morts = (a.indexEntries ?? []).flatMap((e: Idx) => e.ctRefs.filter((n) => !rendu.has(`art-${n}`)))
    const prim = d?.themes.filter((t) => t.isPrimary) ?? []
    console.log(`  ${p.f.source.padEnd(34)} ${rendu.size} ancres · toc ${(a.toc ?? []).length} · menu ${compter(a.navToc ?? [])} · index ${(a.indexEntries ?? []).length} · morts ${morts.length} · titre=réf ${d?.titleFr === d?.number ? 'oui' : 'NON'} · ${prim.length} primaire (${d?.themes.map((t) => t.theme.slug).join(',')}) · ${d?.searchText?.length ?? 0} c.`)
  }
  const env = await prisma.theme.findFirst({ where: { slug: 'environnement' }, select: { labelFr: true, _count: { select: { documents: true } } } })
  console.log(`  branche « ${env?.labelFr} » : ${env?._count.documents} document(s)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  const m = e instanceof Error ? e.message : String(e)
  console.error('ÉCHEC :', m.trim() ? m : e)
  await prisma.$disconnect(); process.exit(1)
})
