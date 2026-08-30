/**
 * TÉLÉCOMMUNICATIONS — CONATEL 1987 (×2), Télévision Numérique Terrestre 2026, circulaire 2022.
 *
 *     npx tsx scripts/importer-telecom-conatel-tnt.ts            # simulation
 *     npx tsx scripts/importer-telecom-conatel-tnt.ts --apply    # Me Vaval, elle seule
 *
 * ⚠️ NEUF FICHIERS, QUATRE ACTES. Deux fichiers sont écartés et le rapport le DIT : l'un est un
 * doublon rigoureusement identique (même empreinte sur le texte extrait), l'autre est le même
 * texte moins la note liminaire — le diff intégral ne porte que sur ces quatorze lignes. Ce n'est
 * PAS une transcription rivale : il n'y a rien à arbitrer.
 *
 * ⚠️ LE DÉCRET DE TAXATION A SEPT ARTICLES, PAS DIX-NEUF. Un comptage naïf additionne trois
 * couches : le sommaire éditorial du transcripteur, le texte, et l'Annexe II d'analyse. Le corps
 * officiel est délimité avant tout comptage, et les rubriques inline en sont SORTIES.
 *
 * ⚠️ CE TEXTE EST LACUNAIRE, ET L'UN DES TROUS PORTE SUR UN MONTANT DE TAXE. Six passages
 * illisibles et six lectures incertaines dans le CORPS (le fichier entier en porte dix et treize —
 * la note et l'Annexe I citent et recensent les autres). L'Annexe I est formelle sur la ligne
 * « télégraphie à impression directe » : « Désignation-type ET MONTANT DE LA TAXE […] Cellules
 * effacées sur la source. LE MONTANT N'EST PAS RESTITUABLE. » Une ligne du barème de l'article 3
 * n'a donc plus de tarif. Et le transcripteur a AMENDÉ le texte en deux endroits — le prénom d'un
 * ministre au contreseing, et la durée du permis à l'article 5, « restituée » par conjecture.
 * Tout cela est porté par la fiche, pas par un fichier de travail.
 *
 * ⚠️ LE SOMMAIRE PORTE LA SEGMENTATION sur le décret TNT : « Section 1re », « Section 2 » et
 * « Section 3 », répétées d'un chapitre à l'autre, entrent en collision avec les articles 1, 2 et 3
 * si le toc n'est pas là. Corps et sommaire dans la MÊME transaction.
 *
 * ⚠️ L'ARRÊTÉ DU 9 JUILLET 2013 N'EST NOMMÉ QU'EN CONSIDÉRANT. Un considérant est un motif, pas
 * une abrogation : `kind: 'CITE'`, jamais `ABROGE`. Le kind AFFIRME.
 *
 * ⚠️ AUCUN RENVOI POUR LES CLAUSES-BALAI (taxation art. 7, CONATEL art. 22, TNT art. 59).
 */
import { prisma } from '../src/lib/db'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { audit } from '../src/lib/auth/audit'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated } from '../src/lib/legislation/annotated'
import { articleAnchorFromHeading } from '../src/lib/doc/anchors'

const APPLY = process.argv.includes('--apply')
const D = join(process.cwd(), 'scripts/data/telecom')
const lire = (f: string) => readFileSync(join(D, f), 'utf8').replace(/\n+$/, '')
const lireJson = <T>(f: string): T => JSON.parse(lire(f)) as T

const THEME = {
  slug: 'telecommunications-audiovisuel',
  labelFr: 'Télécommunications & audiovisuel',
  labelEn: 'Telecommunications & broadcasting',
  labelHt: 'Telekominikasyon ak odyovizyèl',
}

type Toc = { level: number; label: string; anchor: string; kind: string }
type Idx = { subject: string; ctRefs: string[] }
type Rub = { tete: string; rubrique: string }
type Noeud = { label: string; anchor: string; children: Noeud[] }

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

/** Réserve portée par la FICHE du décret de taxation — pas par un fichier de travail. */
const AVERT_TAXATION =
  'Transcription restituée à partir de l’exemplaire numérisé du Moniteur n° 76 du 17 septembre 1987. ' +
  '⚠️ LE TEXTE EST LACUNAIRE : six passages sont illisibles et six lectures sont incertaines dans le ' +
  'corps. Une ligne du barème de l’article 3 (télégraphie à impression directe) a perdu SA ' +
  'DÉSIGNATION ET SON MONTANT DE TAXE, que la source ne permet pas de restituer. Le transcripteur a ' +
  'en outre amendé le texte en deux endroits : le prénom du Ministre des Affaires Étrangères au ' +
  'contreseing (la source porte « Rérard » pour « Hérard »), et la durée du permis d’opérateur à ' +
  'l’article 5, restituée par cohérence avec les catégories B, C et D. Le relevé complet des treize ' +
  'interventions figure à l’annexe I de la transcription. En cas de divergence, l’exemplaire du ' +
  'Journal officiel fait seul foi : un tirage lisible des pages 1381-1388 reste à obtenir.'

const AVERT_TNT =
  'Sommaire et index : annexes éditoriales. L’index emploie une convention propre — « art. 3, 4° » ' +
  'désigne le point 4 de l’article 3, « Vu » renvoie aux visas, « Cons. » aux considérants. Les ' +
  'renvois de points sont ramenés à l’article ; les renvois aux visas et aux considérants n’ont pas ' +
  'd’ancre et sont conservés sans lien.'

const AVERT_CIRC = 'Cette circulaire n’a pas paru au Journal officiel : elle est publiée par le CONATEL sous son propre numéro.'

const FICHES = [
  {
    slug: 'conatel-mission', source: 'DECRET_CONATEL_MISSION_1987', articles: 22, toc: 10,
    titre: 'Décret du 10 juin 1987 redéfinissant la mission du Conseil National des Télécommunications (CONATEL) et fixant ses attributions',
    adoption: '1987-06-10', publication: '1987-08-20',
    moniteur: 'Le Moniteur · LM1987-68 · 142ᵉ année, n° 68 du jeudi 20 août 1987',
    avert: '', rubriques: false, index: false,
  },
  {
    slug: 'conatel-taxation', source: 'DECRET_CONATEL_TAXATION_1987', articles: 7, toc: 0,
    titre: 'Décret du 26 juin 1987 dotant le Conseil National des Télécommunications de moyens techniques et adoptant un mode de taxation en harmonie avec le service rendu',
    adoption: '1987-06-26', publication: '1987-09-17',
    moniteur: 'Le Moniteur · LM1987-76 · 142ᵉ année, n° 76 du jeudi 17 septembre 1987, pages 1381 à 1388',
    avert: AVERT_TAXATION, rubriques: true, index: false,
  },
  {
    slug: 'tnt', source: 'DECRET_TNT_2026', articles: 60, toc: 25,
    titre: 'Décret du 27 mars 2026 portant migration de la télévision analogique vers la Télévision Numérique Terrestre',
    adoption: '2026-03-27', publication: '2026-03-31',
    moniteur: 'Le Moniteur · LM2026-SP17 · 181ᵉ année, Spécial n° 17 du mardi 31 mars 2026',
    avert: AVERT_TNT, rubriques: false, index: true,
  },
  {
    slug: 'circulaire-conatel', source: 'CIRCULAIRE_CONATEL_CONCESSIONNAIRE_2022', articles: 15, toc: 0,
    titre: 'Circulaire CIR-20220011-Rev.0 du Conseil National des Télécommunications portant sur la licence de concessionnaire d’équipements de communications électroniques',
    adoption: null, publication: null, moniteur: null,
    avert: AVERT_CIRC, rubriques: false, index: false,
  },
] as const

async function main() {
  // ⚠️ L'IDEMPOTENCE SE TESTE EN PREMIER.
  const deja = await prisma.document.findMany({ where: { source: { in: FICHES.map((f) => f.source) } }, select: { source: true } })
  if (deja.length === FICHES.length) { console.log('les quatre actes sont déjà versés — rien à faire.'); await prisma.$disconnect(); return }
  if (deja.length) throw new Error(`versement PARTIEL : ${deja.map((d) => d.source).join(', ')}. STOP`)

  const prep = FICHES.map((f) => {
    const corps = lire(`corps-${f.slug}.txt`)
    const toc = f.toc ? lireJson<Toc[]>(`toc-${f.slug}.json`) : []
    if (toc.length !== f.toc) throw new Error(`${f.source} : sommaire ${toc.length}, ${f.toc} attendues. STOP`)
    const jeu = new Set(corps.split('\n').map((x) => x.trim()))
    const orph = toc.filter((t) => !jeu.has(t.label))
    if (orph.length) throw new Error(`${f.source} : ${orph.length} libellé(s) absent(s) — « ${orph[0].label.slice(0, 56)} ». STOP`)

    const blocs = segmentAnnotated(corps, toc) as { kind: string; anchor?: string | null; jurisKey?: string | null }[]
    const porteurs = blocs.filter((b) => b.kind === 'body' && b.anchor)
    const cpt = new Map<string, number>()
    for (const b of porteurs) cpt.set(b.anchor!, (cpt.get(b.anchor!) ?? 0) + 1)
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
        commentaires[k] = [`Rubrique éditoriale de la transcription : ${r.rubrique}`]
      }
      if (Object.keys(commentaires).length !== f.articles) throw new Error(`${f.source} : ${Object.keys(commentaires).length} rubriques, ${f.articles} articles. STOP`)
    }

    const index = f.index ? lireJson<Idx[]>(`index-${f.slug}.json`) : []
    const morts = index.flatMap((e) => e.ctRefs.filter((n) => !ancres.has(`art-${n}`)).map((n) => `${e.subject.slice(0, 24)}→art-${n}`))
    if (morts.length) throw new Error(`${f.source} : ${morts.length} renvoi(s) mort(s) — ${morts.slice(0, 4).join(' · ')}. STOP`)

    const nav = navDepuisToc(toc)
    if (compter(nav) !== toc.length) throw new Error(`${f.source} : ${compter(nav)} nœuds pour ${toc.length} entrées. STOP`)

    // ⚠️ La réserve du décret de taxation AFFIRME six lacunes : le script les compte.
    if (f.slug === 'conatel-taxation') {
      const ill = (corps.match(/\[ill\.\]/g) ?? []).length
      const inc = (corps.match(/⟨/g) ?? []).length
      if (ill !== 6 || inc !== 6) throw new Error(`${f.source} : ${ill} [ill.] et ${inc} lectures incertaines, 6 et 6 attendues. STOP`)
    }
    if (f.slug === 'tnt' && !ancres.has('art-16-1')) throw new Error(`${f.source} : ancre décimale art-16-1 absente. STOP`)
    return { f, corps, toc, nav, index, commentaires, anc }
  })

  const parent = await prisma.theme.findFirst({ where: { slug: 'economique' }, select: { id: true, labelFr: true } })
  if (!parent) throw new Error('thème economique introuvable. STOP')
  const themeExiste = await prisma.theme.findFirst({ where: { slug: THEME.slug }, select: { id: true } })

  // ── renvois aveugles vers le CONATEL, à pourvoir une fois les décrets versés ────────
  const aveugles = await prisma.crossRef.findMany({
    where: { toId: null, OR: [{ toLabel: { contains: 'CONATEL' } }, { toNumber: { contains: 'Conseil National des Télécommunications' } }] },
    select: { id: true, kind: true, toLabel: true, toNumber: true, from: { select: { source: true } } },
  })

  console.log('Télécommunications : CONATEL 1987, TNT 2026, circulaire 2022\n')
  for (const p of prep)
    console.log(`  ${p.f.source.padEnd(40)} ${String(p.corps.split('\n').length).padStart(4)} l. · ${String(p.anc.length).padStart(2)} art. · sommaire ${String(p.toc.length).padStart(2)} · menu ${String(compter(p.nav)).padStart(2)} · rubriques ${String(Object.keys(p.commentaires).length).padStart(2)} · index ${String(p.index.length).padStart(3)}`)
  console.log(`\n  ⚠️ deux fichiers ÉCARTÉS et non versés :`)
  console.log(`     « …taxation-radiocommunications_2.docx » — doublon rigoureusement identique`)
  console.log(`     « …taxation-radiocommunications_1.docx » — même texte moins la note liminaire`)
  console.log(`  ⚠️ décret de taxation : 6 passages illisibles et 6 lectures incertaines dans le corps ;`)
  console.log(`     UNE LIGNE DU BARÈME DE L'ARTICLE 3 A PERDU SON MONTANT, non restituable ;`)
  console.log(`     deux amendements du transcripteur (prénom d'un ministre, durée de l'article 5).`)
  console.log(`  sous-thème « ${THEME.labelFr} » : ${themeExiste ? 'existe déjà' : 'à créer'} sous « ${parent.labelFr} » (niveau 2)`)
  console.log(`\n  renvois aveugles vers le CONATEL à pourvoir : ${aveugles.length}`)
  for (const a of aveugles.slice(0, 6)) console.log(`     [${a.from.source}] ${a.kind} → ${(a.toLabel ?? a.toNumber ?? '').slice(0, 62)}`)
  console.log(`\n  aucun renvoi tiré des clauses-balai (taxation art. 7, CONATEL art. 22, TNT art. 59)`)

  if (!APPLY) { console.log('\nSIMULATION — rien n’a été écrit.'); await prisma.$disconnect(); return }

  const max = await prisma.theme.aggregate({ where: { parentId: parent.id }, _max: { position: true } })
  const ids = new Map<string, string>()
  await prisma.$transaction(async (tx) => {
    const th = themeExiste ?? (await tx.theme.create({ data: { ...THEME, parentId: parent.id, position: (max._max.position ?? -1) + 1 } }))
    if (!themeExiste) await audit({ action: 'THEME_CREATED', targetType: 'Theme', targetId: th.id, meta: { slug: THEME.slug, sous: 'economique', niveau: 2 } }, tx)

    for (const p of prep) {
      const doc = await tx.document.create({
        data: {
          type: 'LEGISLATION', status: 'EN_VIGUEUR', titleFr: p.f.titre, number: p.f.titre,
          bodyOriginal: p.corps, originalLang: 'fr', source: p.f.source, category: 'LEGISLATION',
          moniteurRef: p.f.moniteur,
          adoptionDate: p.f.adoption ? new Date(`${p.f.adoption}T00:00:00Z`) : null,
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
      await tx.documentTheme.create({ data: { documentId: doc.id, themeId: th.id, isPrimary: true, assignedBy: 'IMPORT' } })
    }

    const idTnt = ids.get('tnt')!
    const idMission = ids.get('conatel-mission')!
    const idCirc = ids.get('circulaire-conatel')!
    await tx.crossRef.createMany({
      data: [
        {
          fromId: idTnt, toType: 'LEGISLATION', kind: 'CITE', position: 0, source: 'EDITORIAL',
          toNumber: 'Décret du 12 octobre 2005 sur les droits d’auteur',
          toLabel: 'Décret du 12 octobre 2005 sur les droits d’auteur',
          note: 'Article 37 du Décret TNT : renvoi nominatif. ⚠️ À ne pas confondre avec le Décret du 12 octobre 2005 portant sur la Gestion de l’Environnement : DEUX actes du même jour, sur des matières sans rapport. Renvoi PAR DÉSIGNATION : ce décret n’existe au corpus qu’en notice de catalogue.',
        },
        {
          fromId: idTnt, toType: 'LEGISLATION', kind: 'CITE', position: 1, source: 'EDITORIAL',
          toNumber: 'Arrêté du 9 juillet 2013 fixant la norme de télévision numérique terrestre',
          toLabel: 'Arrêté du 9 juillet 2013 fixant la norme de télévision numérique terrestre',
          note: 'Troisième considérant du Décret TNT : « il convient de changer le mode d’adoption de la version de la norme de télévision numérique terrestre fixée par Arrêté du 9 juillet 2013 ». ⚠️ Nommé en CONSIDÉRANT, jamais dans le dispositif : c’est un motif, pas une abrogation. Le kind AFFIRME — CITE, jamais ABROGE.',
        },
        {
          fromId: idCirc, toId: idMission, toType: 'LEGISLATION', kind: 'APPLIQUE', position: 0, source: 'EDITORIAL',
          toLabel: FICHES[0].titre,
          note: 'La circulaire met en œuvre le régime des licences que ce décret institue, et le vise expressément : « Vu le décret du 10 juin 1987 redéfinissant la mission du Conseil National des Télécommunications (CONATEL) et fixant les attributions… ».',
        },
      ],
    })

    // ⚠️ Les renvois aveugles vers le CONATEL reçoivent leur cible — le décret qui définit sa
    // mission. Repris par leur `id`, jamais par leur libellé.
    for (const a of aveugles) await tx.crossRef.update({ where: { id: a.id }, data: { toId: idMission } })

    await audit({
      action: 'DOC_PUBLISHED', targetType: 'Document', targetId: 'TELECOM_CONATEL_TNT',
      meta: {
        motif:
          'Quatre actes versés en Législation annotée, dans une branche neuve « Télécommunications & ' +
          'audiovisuel » créée au NIVEAU 2 sous Droit économique & des affaires (validé par Me Vaval le ' +
          '30 août 2026 ; un niveau 3 sortirait du menu de domaine de la recherche). ' +
          'Décret du 10 juin 1987 sur la mission du CONATEL (22 art.) ; Décret du 26 juin 1987 sur la ' +
          'taxation des radiocommunications (7 art., et non 19 : un comptage naïf additionnait le sommaire ' +
          'éditorial, le texte et l’annexe d’analyse) ; Décret du 27 mars 2026 sur la migration vers la TNT ' +
          '(59 art. + art. 16.1, index de 151 entrées et 377 renvois) ; Circulaire CIR-20220011-Rev.0. ' +
          '⚠️ Deux fichiers écartés : un doublon exact et le même texte sans note liminaire. ' +
          '⚠️ Le décret de taxation est LACUNAIRE : six passages illisibles et six lectures incertaines dans ' +
          'le corps, dont UNE LIGNE DU BARÈME DE L’ARTICLE 3 qui a perdu son montant de taxe, non ' +
          'restituable ; et deux amendements du transcripteur, le prénom d’un ministre au contreseing et la ' +
          'durée du permis à l’article 5, restituée par conjecture. Ces réserves sont portées par la fiche. ' +
          '⚠️ L’arrêté du 9 juillet 2013 n’est nommé qu’en considérant : CITE, jamais ABROGE. ' +
          `${aveugles.length} renvoi(s) aveugle(s) vers le CONATEL pourvu(s) de leur cible. ` +
          'AUCUN renvoi tiré des clauses-balai.',
        verses: prep.map((p) => p.f.source), articles: prep.map((p) => p.anc.length),
        renvoisAveuglesRepris: aveugles.length,
      },
    }, tx)
  }, { timeout: 180_000, maxWait: 30_000 })

  // ── contrôles de sortie : on RELIT la base ─────────────────────────────────────────
  const journal = await prisma.auditLog.count({ where: { targetId: 'TELECOM_CONATEL_TNT' } })
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
    console.log(`  ${p.f.source.padEnd(40)} ${rendu.size} ancres · toc ${(a.toc ?? []).length} · menu ${compter(a.navToc ?? [])} · rubriques ${Object.keys(a.commentaires ?? {}).length} · index ${(a.indexEntries ?? []).length} · morts ${morts.length} · titre=réf ${d?.titleFr === d?.number ? 'oui' : 'NON'} · ${prim.length} primaire · avert ${a.annotationAuthor ? 'présent' : 'ABSENT'}`)
  }
  const th = await prisma.theme.findFirst({ where: { slug: THEME.slug }, select: { position: true, parent: { select: { labelFr: true } }, _count: { select: { documents: true } } } })
  const repris = await prisma.crossRef.count({ where: { toId: ids.get('conatel-mission')! } })
  console.log(`  branche « ${THEME.labelFr} » sous « ${th?.parent?.labelFr} », position ${th?.position}, ${th?._count.documents} document(s)`)
  console.log(`  ${repris} renvoi(s) pointent désormais le décret sur la mission du CONATEL`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  const m = e instanceof Error ? e.message : String(e)
  console.error('ÉCHEC :', m.trim() ? m : e)
  await prisma.$disconnect(); process.exit(1)
})
