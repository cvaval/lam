/**
 * DENRÉES ALIMENTAIRES 2020 · ABATTAGE DU CHEPTEL BOVIN 2015 · AVIS D'ÉTIQUETAGE 2024.
 *
 *     npx tsx scripts/importer-denrees-abattage-2020.ts            # simulation
 *     npx tsx scripts/importer-denrees-abattage-2020.ts --apply    # Me Vaval, elle seule
 *
 * ⚠️ QUATRE ACTES, CINQ FICHIERS. Le fichier « moniteur_146_abattage_cheptel_bovin.docx » porte
 * DEUX arrêtés : celui du Premier Ministre qui DÉLÈGUE le pouvoir réglementaire, et celui du
 * Ministre de l'Agriculture qui L'EXERCE. Chacun redémarre à l'article 1er : les verser ensemble
 * produirait deux art-1 et deux art-2 en collision.
 *
 * ⚠️ L'AVIS DU MCI NE VISE PAS LE DÉCRET SUR LES DENRÉES. Il nomme sa cible lui-même :
 * « l'article 14 du décret fixant les règles relatives à la sécurité des biens et services, la
 * loyauté des transactions économiques et la protection du consommateur du 11 mars 2020 » — soit
 * DECRET_PROTECTION_CONSOMMATEUR_2020, déjà en base. Vérifié : son article 15 dispose bien que les
 * données sont fournies « dans l'une ou l'autre des langues nationales ». Les deux renvois sont
 * donc CLIQUABLES.
 *
 * ⚠️ LE SOMMAIRE PORTE LA SEGMENTATION. `articleAnchorFromHeading` reconnaît volontairement les
 * têtes « Section N » et leur donne art-N. Mesuré SANS le toc : art-1×5 … art-9×2 sur le décret,
 * art-1×4 et art-2×3 sur l'arrêté d'abattage. AVEC : aucune collision. Corps et sommaire dans la
 * MÊME transaction.
 *
 * ⚠️ AUCUN RENVOI POUR LES CLAUSES-BALAI (denrées art. 45, abattage art. 12) : elles ne nomment
 * personne. Le rendu public afficherait « ABROGE → … · cible non importée » sans jamais lire la
 * note. AUCUNE abrogation nominative dans ce lot. Les trois renvois posés sont : l'arrêté
 * d'abattage vers l'arrêté de délégation qui l'autorise, et l'avis du MCI vers les articles 14
 * et 15 du décret sur la protection du consommateur.
 *
 * ⚠️ LE CHEPTEL BOVIN N'EST PAS UN TEXTE DE COMMERCE. Recensement, boucles d'identification,
 * vaccination contre le charbon bactéridien, abattage sous contrôle vétérinaire, Code rural en
 * visa. Thème primaire AGRICULTURE, copie sous le thème alimentaire — décision de Me Vaval du
 * 30 août 2026.
 */
import { prisma } from '../src/lib/db'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { audit } from '../src/lib/auth/audit'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated } from '../src/lib/legislation/annotated'
import { articleAnchorFromHeading } from '../src/lib/doc/anchors'

const APPLY = process.argv.includes('--apply')
const D = join(process.cwd(), 'scripts/data/denrees-2020')
const lire = (f: string) => readFileSync(join(D, f), 'utf8').replace(/\n+$/, '')
const lireJson = <T>(f: string): T => JSON.parse(lire(f)) as T

const MON2020 = 'Le Moniteur · LM2020-SP21 · 175ᵉ année, Spécial n° 21 du lundi 10 août 2020'
const MON2015 = 'Le Moniteur · LM2015-146 · 170ᵉ année, n° 146 du mardi 4 août 2015'
const AVERT_DENREES =
  'Sommaire analytique et index : les intitulés de chapitres et de sections sont ceux du décret. ' +
  'Les rubriques placées en regard de chaque article sont éditoriales — le décret ne comporte pas ' +
  'd’intitulés d’articles. L’index porte en outre trois annexes éditoriales (termes définis, textes ' +
  'visés au préambule, autorités désignées) qui ne font pas partie du texte publié au Moniteur.'
const AVERT_AVIS = 'Cet avis n’a pas paru au Journal officiel : il est publié par le Ministère du Commerce et de l’Industrie sous son propre numéro.'

type Toc = { level: number; label: string; anchor: string; kind: string }
type Idx = { subject: string; ctRefs: number[] }
type Rub = { tete: string; rubrique: string }
type Noeud = { label: string; anchor: string; children: Noeud[] }

function navDepuisToc(toc: Toc[]): Noeud[] {
  const r: Noeud[] = []; const pile: { level: number; noeud: Noeud }[] = []
  for (const t of toc) {
    const n: Noeud = { label: t.label, anchor: t.anchor, children: [] }
    while (pile.length && pile[pile.length - 1].level >= t.level) pile.pop()
    if (pile.length) pile[pile.length - 1].noeud.children.push(n); else r.push(n)
    pile.push({ level: t.level, noeud: n })
  }
  return r
}
const compter = (n: Noeud[]): number => n.reduce((s, x) => s + 1 + compter(x.children), 0)
const libelle = (a: string) => { const n = a.replace('art-', '').replace(/-/g, '.'); return `Article ${n === '1' ? '1er' : n}` }

const FICHES = [
  { slug: 'denrees', source: 'DECRET_DENREES_ALIMENTAIRES_2020', articles: 45, toc: 27,
    titre: 'Décret du 11 mars 2020 définissant la réglementation et le contrôle de la production et du commerce des denrées alimentaires',
    adoption: '2020-03-11', publication: '2020-08-10', moniteur: `${MON2020}, pages 1 à 18`,
    theme: 'prix-concurrence-consommateur', copie: null, avert: AVERT_DENREES, rubriques: true, index: true },
  { slug: 'delegation', source: 'ARRETE_DELEGATION_ABATTAGE_2015', articles: 2, toc: 0,
    titre: 'Arrêté du 30 juin 2015 donnant délégation de pouvoir au Ministre de l’Agriculture, des Ressources Naturelles et du Développement Rural à l’effet de prendre un arrêté portant sur les mécanismes de contrôle, d’identification, de mouvement et d’abattage du cheptel bovin',
    adoption: '2015-06-30', publication: '2015-08-04', moniteur: `${MON2015}, page 5`,
    theme: 'agriculture-rural', copie: 'prix-concurrence-consommateur', avert: '', rubriques: false, index: false },
  { slug: 'abattage', source: 'ARRETE_ABATTAGE_CHEPTEL_BOVIN_2015', articles: 12, toc: 9,
    titre: 'Arrêté du 30 juin 2015 portant règlementation des mécanismes de contrôle d’identification, de mouvement et d’abattage du cheptel bovin',
    adoption: '2015-06-30', publication: '2015-08-04', moniteur: `${MON2015}, pages 6 à 8`,
    theme: 'agriculture-rural', copie: 'prix-concurrence-consommateur', avert: '', rubriques: false, index: false },
  { slug: 'avis-mci', source: 'AVIS_MCI_ETIQUETAGE_2024', articles: 0, toc: 0,
    titre: 'Avis du Ministère du Commerce et de l’Industrie n° MCI/JM/DCQPC/0018/08/24 du 6 août 2024 relatif à l’étiquetage des denrées alimentaires préemballées',
    adoption: '2024-08-06', publication: null, moniteur: null,
    theme: 'prix-concurrence-consommateur', copie: null, avert: AVERT_AVIS, rubriques: false, index: false },
] as const

async function main() {
  const deja = await prisma.document.findMany({ where: { source: { in: FICHES.map((f) => f.source) } }, select: { source: true } })
  if (deja.length === FICHES.length) { console.log('les quatre actes sont déjà versés — rien à faire.'); await prisma.$disconnect(); return }
  if (deja.length) throw new Error(`versement PARTIEL : ${deja.map((d) => d.source).join(', ')}. STOP`)

  const prep = FICHES.map((f) => {
    const corps = lire(`corps-${f.slug}.txt`)
    const toc = f.toc ? lireJson<Toc[]>(`toc-${f.slug}.json`) : []
    if (toc.length !== f.toc) throw new Error(`${f.source} : sommaire ${toc.length}, ${f.toc} attendues. STOP`)
    const jeu = new Set(corps.split('\n').map((x) => x.trim()))
    const orph = toc.filter((t) => !jeu.has(t.label))
    if (orph.length) throw new Error(`${f.source} : ${orph.length} libellé(s) absent(s) du corps — « ${orph[0].label.slice(0, 56)} ». STOP`)

    const blocs = segmentAnnotated(corps, toc) as { kind: string; anchor?: string | null; jurisKey?: string | null }[]
    const porteurs = blocs.filter((b) => b.kind === 'body' && b.anchor)
    const cpt = new Map<string, number>(); for (const b of porteurs) cpt.set(b.anchor!, (cpt.get(b.anchor!) ?? 0) + 1)
    const col = [...cpt].filter(([, n]) => n > 1)
    if (col.length) throw new Error(`${f.source} : ancres en COLLISION — ${col.map(([a, n]) => `${a}×${n}`).join(', ')}. STOP`)
    if (porteurs.length !== f.articles) throw new Error(`${f.source} : ${porteurs.length} blocs à ancre, ${f.articles} attendus. STOP`)
    if (blocs.filter((b) => b.kind === 'section').length !== f.toc) throw new Error(`${f.source} : sections rendues ≠ ${f.toc}. STOP`)

    const anc = [...cpt.keys()]
    const ancres = new Set(anc)
    const cle = new Map(porteurs.map((b) => [b.anchor!, b.jurisKey!]))

    const commentaires: Record<string, string[]> = {}
    if (f.rubriques) {
      const rub = lireJson<Rub[]>(`rubriques-${f.slug}.json`)
      for (const r of rub) {
        const a = articleAnchorFromHeading(r.tete)
        if (!a) throw new Error(`${f.source} : tête de rubrique non reconnue « ${r.tete} ». STOP`)
        const k = cle.get(a)
        if (!k) throw new Error(`${f.source} : la rubrique « ${r.tete} » ne trouve pas son bloc (${a}). STOP`)
        if (commentaires[k]) throw new Error(`${f.source} : deux rubriques pour ${a}. STOP`)
        commentaires[k] = [`Rubrique du sommaire analytique : ${r.rubrique}`]
      }
      if (Object.keys(commentaires).length !== f.articles) throw new Error(`${f.source} : ${Object.keys(commentaires).length} rubriques, ${f.articles} articles. STOP`)
    }

    const index = f.index ? lireJson<Idx[]>(`index-${f.slug}.json`) : []
    const morts = index.flatMap((e) => e.ctRefs.filter((n) => !ancres.has(`art-${n}`)).map((n) => `${e.subject.slice(0, 24)}→art-${n}`))
    if (morts.length) throw new Error(`${f.source} : ${morts.length} renvoi(s) mort(s) — ${morts.slice(0, 4).join(' · ')}. STOP`)

    const nav = navDepuisToc(toc)
    if (compter(nav) !== toc.length) throw new Error(`${f.source} : ${compter(nav)} nœuds pour ${toc.length} entrées. STOP`)
    return { f, corps, toc, nav, index, commentaires, anc }
  })

  // ── la cible de l'avis : le décret JUMEAU du 11 mars 2020, déjà en base ────────────
  const conso = await prisma.document.findFirst({ where: { source: 'DECRET_PROTECTION_CONSOMMATEUR_2020' }, select: { id: true, titleFr: true, bodyOriginal: true } })
  if (!conso) throw new Error('DECRET_PROTECTION_CONSOMMATEUR_2020 introuvable — l’avis y renvoie nommément. STOP')
  // ⚠️ On VÉRIFIE que les articles cités disent bien ce que l'avis leur fait dire.
  const a14 = (conso.bodyOriginal ?? '').split('\n').find((l) => /^Article\s+14\b/.test(l.trim()))
  const a15 = (conso.bodyOriginal ?? '').split('\n').find((l) => /^Article\s+15\b/.test(l.trim()))
  if (!a14 || !a15) throw new Error('articles 14 ou 15 introuvables dans le décret consommateur. STOP')
  if (!/langue/i.test(a15)) throw new Error('l’article 15 du décret consommateur ne parle pas de langue — la cible de l’avis est douteuse. STOP')

  const themes = await prisma.theme.findMany({ where: { slug: { in: ['prix-concurrence-consommateur', 'agriculture-rural'] } }, select: { id: true, slug: true, labelFr: true } })
  if (themes.length !== 2) throw new Error(`${themes.length} thème(s) sur 2 trouvés. STOP`)
  const parSlug = new Map(themes.map((t) => [t.slug, t]))

  const memeJour = await prisma.document.findMany({ where: { adoptionDate: new Date('2020-03-11T00:00:00Z') }, select: { source: true, titleFr: true, type: true } })
  const titres = [...memeJour.map((d) => d.titleFr ?? ''), ...FICHES.map((f) => f.titre)]
  if (new Set(titres).size !== titres.length) throw new Error('deux actes du 11 mars 2020 porteraient le même intitulé. STOP')

  console.log('Denrées alimentaires · abattage du cheptel bovin · avis d’étiquetage\n')
  for (const p of prep) {
    const th = parSlug.get(p.f.theme)!
    console.log(`  ${p.f.source.padEnd(36)} ${String(p.corps.split('\n').length).padStart(4)} l. · ${String(p.anc.length).padStart(2)} art. · sommaire ${String(p.toc.length).padStart(2)} · rubriques ${String(Object.keys(p.commentaires).length).padStart(2)} · index ${String(p.index.length).padStart(3)}`)
    console.log(`  ${' '.repeat(36)} → ${th.labelFr}${p.f.copie ? ` (+ copie sous ${parSlug.get(p.f.copie)!.labelFr})` : ''}`)
  }
  console.log(`\n  actes du 11 mars 2020 déjà en base : ${memeJour.filter((d) => d.type !== 'INDEX').length} texte(s) intégral(aux) — tous d’intitulé distinct (contrôlé)`)
  console.log(`  cible de l’avis : « ${conso.titleFr?.slice(0, 68)} »`)
  console.log(`     art. 14 vérifié · art. 15 vérifié (il parle bien de langue)`)
  console.log(`  aucun renvoi tiré des clauses-balai (denrées art. 45, abattage art. 12)`)

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
          publicationDate: p.f.publication ? new Date(`${p.f.publication}T00:00:00Z`) : null,
          annotationsJson: JSON.stringify({
            title: p.f.titre, annotationAuthor: p.f.avert, toc: p.toc, navToc: p.nav,
            connexes: [], connexe: {}, jurisprudence: {},
            indexEntries: p.index, commentaires: p.commentaires,
            labels: Object.fromEntries(p.anc.map((a) => [a, libelle(a)])),
          }),
        },
      })
      ids.set(p.f.slug, doc.id)
      await tx.documentTheme.create({ data: { documentId: doc.id, themeId: parSlug.get(p.f.theme)!.id, isPrimary: true, assignedBy: 'IMPORT' } })
      if (p.f.copie) await tx.documentTheme.create({ data: { documentId: doc.id, themeId: parSlug.get(p.f.copie)!.id, isPrimary: false, assignedBy: 'IMPORT' } })
    }

    const idDel = ids.get('delegation')!, idAbt = ids.get('abattage')!, idAvis = ids.get('avis-mci')!
    await tx.crossRef.createMany({
      data: [
        { fromId: idAbt, toId: idDel, toType: 'LEGISLATION', kind: 'APPLIQUE', position: 0, source: 'EDITORIAL',
          toLabel: FICHES[1].titre,
          note: 'L’Arrêté du Premier Ministre délègue expressément au Ministre de l’Agriculture le pouvoir de prendre le présent arrêté : le second exerce la délégation que le premier institue. Les deux sont du 30 juin 2015 et paraissent au même fascicule.' },
        { fromId: idAvis, toId: conso.id, toType: 'LEGISLATION', kind: 'APPLIQUE', toAnchor: 'art-14', position: 0, source: 'EDITORIAL',
          toLabel: conso.titleFr ?? 'Décret du 11 mars 2020 sur la protection du consommateur',
          note: 'L’avis nomme sa cible : « conformément à l’article 14 du décret fixant les règles relatives à la sécurité des biens et services, la loyauté des transactions économiques et la protection du consommateur du 11 mars 2020 ». ⚠️ Ce n’est PAS le décret du même jour sur les denrées alimentaires.' },
        { fromId: idAvis, toId: conso.id, toType: 'LEGISLATION', kind: 'CITE', toAnchor: 'art-15', position: 1, source: 'EDITORIAL',
          toLabel: conso.titleFr ?? 'Décret du 11 mars 2020 sur la protection du consommateur',
          note: 'L’avis : « Conformément à l’article 15 du décret susmentionné, les informations précédentes doivent être libellées dans l’une ou l’autre des langues nationales ». Vérifié sur pièce : l’article 15 dispose bien que les données sont fournies « dans l’une ou l’autre des langues nationales en des termes compréhensibles et lisibles ».' },
      ],
    })

    await audit({
      action: 'DOC_PUBLISHED', targetType: 'Document', targetId: 'DENREES_ABATTAGE_2020',
      meta: {
        motif:
          'Quatre actes versés en Législation annotée : Décret du 11 mars 2020 sur les denrées alimentaires ' +
          '(45 art., 7 chapitres, 20 sections, index de 207 entrées et 362 renvois) ; les DEUX arrêtés du ' +
          '30 juin 2015 sur le cheptel bovin, séparés d’un seul fichier — celui du Premier Ministre qui ' +
          'délègue (2 art.) et celui du Ministre de l’Agriculture qui exerce (12 art.), chacun redémarrant à ' +
          'l’article 1er ; l’Avis du MCI du 6 août 2024 sur l’étiquetage, qui n’a pas paru au Journal officiel. ' +
          '⚠️ L’avis vise le décret du 11 mars 2020 sur la PROTECTION DU CONSOMMATEUR, déjà en base, et non ' +
          'celui du même jour sur les denrées : ses articles 14 et 15 ont été vérifiés sur pièce avant que ' +
          'les renvois ne soient posés. ⚠️ Le cheptel bovin va sous Agriculture en primaire, avec copie sous ' +
          'Prix, concurrence et protection du consommateur (décision de Me Vaval du 30 août 2026) : sa matière ' +
          'est la santé animale, non le commerce. AUCUN renvoi tiré des clauses-balai.',
        verses: prep.map((p) => p.f.source), articles: prep.map((p) => p.anc.length),
      },
    }, tx)
  }, { timeout: 180_000, maxWait: 30_000 })

  const journal = await prisma.auditLog.count({ where: { targetId: 'DENREES_ABATTAGE_2020' } })
  for (const id of ids.values()) await reindexDocument(id)
  console.log(`\n✓ AuditLog ${journal} (recompté) · ${ids.size} documents réindexés`)
  for (const p of prep) {
    const d = await prisma.document.findUnique({
      where: { id: ids.get(p.f.slug)! },
      select: { bodyOriginal: true, annotationsJson: true, titleFr: true, number: true, adoptionDate: true, searchText: true,
        themes: { select: { isPrimary: true, theme: { select: { slug: true } } } } },
    })
    const a = JSON.parse(String(d?.annotationsJson ?? '{}'))
    const rendu = new Set((segmentAnnotated(d?.bodyOriginal ?? '', a.toc ?? []) as { kind: string; anchor?: string | null }[])
      .filter((x) => x.kind === 'body' && x.anchor).map((x) => x.anchor))
    const morts = (a.indexEntries ?? []).flatMap((e: Idx) => e.ctRefs.filter((n) => !rendu.has(`art-${n}`)))
    const prim = d?.themes.filter((t) => t.isPrimary) ?? []
    console.log(`  ${p.f.source.padEnd(36)} ${rendu.size} ancres · toc ${(a.toc ?? []).length} · menu ${compter(a.navToc ?? [])} · rubriques ${Object.keys(a.commentaires ?? {}).length} · index ${(a.indexEntries ?? []).length} · morts ${morts.length} · titre=réf ${d?.titleFr === d?.number ? 'oui' : 'NON'} · ${prim.length} primaire (${d?.themes.map((t) => t.theme.slug).join(',')}) · ${d?.searchText?.length ?? 0} c.`)
  }
  const xr = await prisma.crossRef.count({ where: { fromId: { in: [...ids.values()] } } })
  console.log(`  ${xr} renvois posés, tous NOMINATIFS`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  const m = e instanceof Error ? e.message : String(e)
  console.error('ÉCHEC :', m.trim() ? m : e)
  await prisma.$disconnect(); process.exit(1)
})
