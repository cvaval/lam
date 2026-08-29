/**
 * NOTARIAT — téléversement des 8 documents : le décret-loi du 27 novembre 1969 (80 articles)
 * et les 7 textes de la compilation (1862 → 1986).
 *
 * Thèmes : Justice (principal, Droit public & administratif) + Droit civil — le notaire est
 * un officier public, mais ses actes relèvent de la matière civile.
 *
 * Les amendements entre ces textes sont posés SÉPARÉMENT par _apply-notariat-overlays.ts :
 * ce script ne fait que publier les textes dans leur rédaction d'origine.
 *
 * Idempotent (upsert par source). Données : scripts/data/notariat-1969/ et
 * scripts/data/notariat-compilation/.
 *   npx tsx scripts/_import-notariat.ts
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated, type Annotations, type TocEntry, type NavGroup } from '../src/lib/legislation/annotated'

const D69 = 'scripts/data/notariat-1969'
const DC = 'scripts/data/notariat-compilation'

interface Meta {
  source: string
  titleFr: string
  titleEn: string
  titleHt: string
  number: string
  date: string
  moniteurRef?: string
  keywords: string
  summaryFr: string
}

const META: Record<string, Meta> = {
  'loi-1862-notariat': {
    source: 'LOI_NOTARIAT_1862',
    titleFr: 'Loi du 21 août 1862 sur le Notariat',
    titleEn: 'Law of 21 August 1862 on the Notarial Profession',
    titleHt: 'Lwa 21 out 1862 sou Notarya a',
    number: 'Loi du 21 août 1862', date: '1862-08-21',
    keywords: 'notariat; notaire; officier public; acte notarié; minute; expédition; témoin; tarif',
    summaryFr: 'Texte fondateur du notariat haïtien : statut du notaire, réception des actes, témoins, '
      + 'minutes et expéditions, tarif. Ses articles 32 et 33 ont été réécrits par la loi du 8 août 1877.',
  },
  'loi-1877-modificative': {
    source: 'LOI_NOTARIAT_1877',
    titleFr: 'Loi du 8 août 1877 modificative sur le Notariat',
    titleEn: 'Amending Law of 8 August 1877 on the Notarial Profession',
    titleHt: 'Lwa 8 out 1877 ki modifye Notarya a',
    number: 'Loi du 8 août 1877', date: '1877-08-08',
    keywords: 'notariat; inventaire; partage; compte de gestion; honoraires; déplacement; tarif',
    summaryFr: 'Réécrit les articles 32 et 33 de la loi du 21 août 1862 (inventaires, partages, comptes '
      + 'de gestion ; indemnité de déplacement du notaire) et modifie le tarif des actes notariés.',
  },
  'loi-1919-notariat': {
    source: 'LOI_NOTARIAT_1919',
    titleFr: 'Loi du 24 février 1919 sur le Notariat',
    titleEn: 'Law of 24 February 1919 on the Notarial Profession',
    titleHt: 'Lwa 24 fevriye 1919 sou Notarya a',
    number: 'Loi du 24 février 1919', date: '1919-02-24',
    keywords: 'notariat; notaire; fonctionnaire public; nomination; résidence; incompatibilité; acte notarié; '
      + 'minute; grosse; expédition; répertoire; archives; discipline; destitution; cautionnement; tarif',
    summaryFr: 'Régime du notariat que le décret-loi du 27 novembre 1969 « harmonisera » : statut et nomination '
      + 'des notaires, conditions d’admission, incompatibilités, forme et validité des actes, minutes, grosses '
      + 'et répertoires, discipline, tarif. Son article 30 a été réécrit par le décret-loi du 20 juin 1941.',
  },
  'arrete-1919-examen': {
    source: 'ARRETE_NOTARIAT_EXAMEN_1919',
    titleFr: 'Arrêté réglementant les détails de l’examen en Notariat et fixant le mode de versement et d’affectation du cautionnement',
    titleEn: 'Order regulating the notarial examination and the lodging of the security deposit',
    titleHt: 'Arete ki reglemante egzamen Notarya a ak kosyon an',
    number: 'Arrêté de 1919', date: '1919-01-01',
    keywords: 'notariat; examen; jury; session; épreuve orale; épreuve écrite; cautionnement; Banque Nationale',
    summaryFr: 'Pris pour l’application de la loi du 24 février 1919 : sessions d’examen, composition du jury, '
      + 'déroulement et notation des épreuves, puis versement du cautionnement à la Banque Nationale et son '
      + 'affectation à la garantie des condamnations pour fautes professionnelles.',
  },
  'decret-loi-1941-etude-vacante': {
    source: 'DECRET_LOI_NOTARIAT_1941',
    titleFr: 'Décret-loi du 20 juin 1941 sur le notaire dont l’étude est devenue vacante',
    titleEn: 'Decree-Law of 20 June 1941 on vacant notarial offices',
    titleHt: 'Dekrè-lwa 20 jen 1941 sou etid notè ki vid',
    number: 'Décret-loi du 20 juin 1941', date: '1941-06-20',
    keywords: 'notariat; étude vacante; scellés; archives; juge de paix; destitution; démission; décès; mutation',
    summaryFr: 'Réécrit l’article 30 de la loi du 24 février 1919 : en cas de destitution, démission, '
      + 'interdiction, décès ou mutation d’un notaire, le juge de paix appose d’office les scellés sur ses '
      + 'archives, afin d’assurer sans délai la délivrance des copies, extraits, expéditions et grosses.',
  },
  'decret-1974-nombre-notaires': {
    source: 'DECRET_NOTARIAT_1974',
    titleFr: 'Décret du 30 septembre 1974 augmentant le nombre des notaires',
    titleEn: 'Decree of 30 September 1974 increasing the number of notaries',
    titleHt: 'Dekrè 30 septanm 1974 ki ogmante kantite notè',
    number: 'Décret du 30 septembre 1974', date: '1974-09-30',
    keywords: 'notariat; nombre de notaires; commune; Port-au-Prince; abrogation',
    summaryFr: 'Réécrit l’article 3 du décret du 27 novembre 1969 en portant à 20 le nombre de notaires de '
      + 'Port-au-Prince, et ABROGE l’article 76 du même décret.',
  },
  'decret-1986-nombre-notaires': {
    source: 'DECRET_NOTARIAT_1986',
    titleFr: 'Décret du 9 juillet 1986 du Conseil National de Gouvernement fixant le nombre des notaires',
    titleEn: 'Decree of 9 July 1986 setting the number of notaries',
    titleHt: 'Dekrè 9 jiyè 1986 ki fikse kantite notè',
    number: 'Décret du 9 juillet 1986', date: '1986-07-09',
    keywords: 'notariat; nombre de notaires; commune; Delmas; Pétion-Ville; Carrefour; Conseil National de Gouvernement',
    summaryFr: 'Rédaction EN VIGUEUR du nombre de notaires par commune : 22 pour Port-au-Prince, 5 pour Delmas '
      + 'et Pétion-Ville, 4 pour Carrefour, etc. Modifie le décret du 30 septembre 1974, lui-même modificatif '
      + 'de l’article 3 du décret du 27 novembre 1969.',
  },
}

/** navToc : un groupe par en-tête de premier niveau, les articles en enfants (rubrique du sommaire). */
function buildNavToc(titre: string, toc: TocEntry[], body: string, rubriques: Record<string, { r: string }>): NavGroup[] {
  const racine: NavGroup = { label: titre, anchor: toc[0]?.anchor ?? 'art-1', children: [] }
  let courant: { label: string; anchor: string; children: { label: string; anchor: string }[] } | null = null
  const parLabel = new Map(toc.map((t) => [t.label, t]))
  for (const raw of body.split('\n')) {
    const l = raw.trim()
    const t = parLabel.get(l)
    if (t) {
      courant = { label: l, anchor: t.anchor, children: [] }
      racine.children.push(courant as never)
      continue
    }
    const m = l.match(/^Article\s+(\d{1,3})\.\s*—/)
    if (!m) continue
    const n = m[1]
    const lib = n === '1' ? 'Article 1er' : `Article ${n}`
    const r = rubriques[n]?.r
    const item = { label: r ? `${lib} — ${r}` : lib, anchor: `art-${n}` }
    if (courant) courant.children.push(item)
    else racine.children.push(item as never)
  }
  return [racine]
}

/**
 * indexEntries : repris de l'index CORRIGÉ (index-final.json), produit par les scripts de
 * rendu — fusions des doublons, capitalisation française, désambiguïsations.
 * ⚠️ NE PAS reconstruire depuis la sortie brute de l'IA : la plateforme afficherait alors un
 * index de moindre qualité que le .docx remis à la cliente (« Acte Notarié » ET « Acte
 * notarié », « Accès à la Fonction », « Ministère » ambigu…).
 */
function buildIndex(corrige: Record<string, number[]>): { subject: string; ctRefs: number[] }[] {
  const coll = new Intl.Collator('fr', { sensitivity: 'base' })
  return Object.entries(corrige)
    .map(([subject, refs]) => ({ subject: subject.replace(/'/g, '’'), ctRefs: [...refs].sort((a, b) => a - b) }))
    .sort((a, b) => coll.compare(a.subject, b.subject))
}

async function publier(meta: Meta, body: string, ann: Annotations & Record<string, unknown>, themes: { id: string; slug: string }[]) {
  const blocks = segmentAnnotated(body, ann.toc)
  const secs = blocks.filter((b) => b.kind === 'section').length
  const anchors = new Set(blocks.filter((b: any) => b.kind === 'body' && b.anchor).map((b: any) => b.anchor))
  if (secs !== ann.toc.length) throw new Error(`${meta.source} : segmentation ${secs}/${ann.toc.length} — annulé`)
  const orphelins = Object.keys((ann.labels ?? {}) as object).filter((a) => !anchors.has(a))
  if (orphelins.length) throw new Error(`${meta.source} : libellés sans article ${orphelins.slice(0, 6).join(', ')} — annulé`)
  const morts = ann.indexEntries.flatMap((e) => e.ctRefs).filter((r) => !anchors.has(`art-${r}`))
  if (morts.length) throw new Error(`${meta.source} : index, renvois morts ${[...new Set(morts)].slice(0, 6).join(', ')} — annulé`)

  const data = {
    type: 'LEGISLATION' as const,
    status: 'EN_VIGUEUR' as const,
    titleFr: meta.titleFr, titleEn: meta.titleEn, titleHt: meta.titleHt,
    number: meta.number,
    matiere: 'notariat',
    moniteurRef: meta.moniteurRef ?? null,
    publicationDate: new Date(meta.date),
    keywords: meta.keywords,
    summaryFr: meta.summaryFr,
    bodyOriginal: body,
    annotationsJson: JSON.stringify(ann),
    source: meta.source,
  }
  const existing = await prisma.document.findFirst({ where: { source: meta.source }, select: { id: true } })
  const doc = existing
    ? await prisma.document.update({ where: { id: existing.id }, data })
    : await prisma.document.create({ data: { ...data, originalLang: 'fr' } })
  for (const t of themes) {
    if (!(await prisma.documentTheme.findFirst({ where: { documentId: doc.id, themeId: t.id } })))
      await prisma.documentTheme.create({
        data: { documentId: doc.id, themeId: t.id, isPrimary: t.slug === 'notariat', assignedBy: 'IMPORT' },
      })
  }
  await reindexDocument(doc.id)
  console.log(`  ${existing ? '↻' : '✓'} ${meta.source.padEnd(30)} ${anchors.size.toString().padStart(3)} art · ${secs} en-têtes · ${ann.indexEntries.length} entrées d’index`)
  return doc.id
}

async function main() {
  // ⚠️ Le 28 août 2026, Me Vaval a fait du Notariat une RACINE de l'arbre (« créer comme un titre 1,
  // comme le Droit privé »), et le thème « justice » a été SUPPRIMÉ. Les huit textes portent
  // désormais « notariat » en primaire, et gardent leur double rattachement à « droit-civil ».
  const themes = await prisma.theme.findMany({ where: { slug: { in: ['notariat', 'droit-civil'] } }, select: { id: true, slug: true } })
  if (themes.length !== 2) throw new Error('thèmes notariat / droit-civil introuvables — créer « notariat » en racine (Notariat / Notarial practice / Notarya)')

  // ── Décret-loi du 27 novembre 1969 ──
  const body69 = readFileSync(`${D69}/bodyOriginal.txt`, 'utf8').trimEnd()
  const st69 = JSON.parse(readFileSync(`${D69}/structure.json`, 'utf8')) as { toc: TocEntry[]; labels: Record<string, string> }
  const si69 = JSON.parse(readFileSync(`${D69}/sommaire-index.json`, 'utf8')) as Record<string, { r: string; s: string[] }>
  const idx69 = JSON.parse(readFileSync(`${D69}/index-final.json`, 'utf8')) as Record<string, number[]>
  const ann69: Annotations & Record<string, unknown> = {
    title: 'Décret-loi du 27 novembre 1969 sur le Notariat',
    annotationAuthor: '',
    navToc: buildNavToc('Décret-loi du 27 novembre 1969 sur le Notariat', st69.toc, body69, si69),
    toc: st69.toc,
    connexes: [],
    jurisprudence: {},
    indexEntries: buildIndex(idx69),
    labels: st69.labels,
  }
  await publier({
    source: 'DECRET_LOI_NOTARIAT_1969',
    titleFr: 'Décret-loi du 27 novembre 1969 harmonisant les dispositions de la Loi du 24 février 1919 sur le Notariat',
    titleEn: 'Decree-Law of 27 November 1969 on the Notarial Profession',
    titleHt: 'Dekrè-lwa 27 novanm 1969 sou Notarya a',
    number: 'Décret-loi du 27 novembre 1969', date: '1969-11-27',
    moniteurRef: 'Le Moniteur n° 113 et 114 des 27 novembre et 1er décembre 1969',
    keywords: 'notariat; notaire; officier public; juridiction volontaire; examen; stage; serment; commission; '
      + 'incompatibilité; acte notarié; authenticité; témoin instrumentaire; minute; grosse; expédition; '
      + 'répertoire; archives; discipline; suspension; destitution; cautionnement; honoraires; timbre mobile spécial',
    summaryFr: 'Régime en vigueur du notariat haïtien : le notaire, officier public exerçant une juridiction '
      + 'volontaire et amiable — accès à la fonction (examen, stage, serment), exercice et incompatibilités, '
      + 'conditions essentielles de validité des actes, minutes, grosses, expéditions et répertoires, discipline '
      + 'confiée au Ministère Public, tarif des honoraires, cautionnement et archives. Harmonise la loi du '
      + '24 février 1919. Son article 3 a été réécrit en 1974 puis en 1986, son article 30 par la loi du '
      + '14 février 2017, et son article 76 est abrogé depuis 1974.',
  }, body69, ann69, themes)

  // ── Les 7 textes de la compilation ──
  const textes = JSON.parse(readFileSync(`${DC}/textes.json`, 'utf8')) as Record<string, { titre: string; articles: { num: string }[]; corps: string }>
  const siC = JSON.parse(readFileSync(`${DC}/sommaire-index.json`, 'utf8')) as Record<string, Record<string, { r: string; s: string[] }>>
  const idxC = JSON.parse(readFileSync(`${DC}/index-final.json`, 'utf8')) as Record<string, Record<string, number[]>>
  for (const [slug, meta] of Object.entries(META)) {
    const t = textes[slug]
    if (!t) throw new Error(`texte ${slug} absent de textes.json`)
    // Un en-tête unique, égal au titre : donne une section d'accroche à la navigation.
    const body = `${meta.titleFr}\n${t.corps.trim()}`
    const toc: TocEntry[] = [{ level: 1, label: meta.titleFr, anchor: 'sec-1', kind: 'code' }]
    const donnees = siC[slug] ?? {}
    const ann: Annotations & Record<string, unknown> = {
      title: meta.titleFr,
      annotationAuthor: '',
      navToc: buildNavToc(meta.titleFr, toc, body, donnees),
      toc,
      connexes: [],
      jurisprudence: {},
      indexEntries: buildIndex(idxC[slug] ?? {}),
      labels: Object.fromEntries(t.articles.map((a) => [`art-${a.num}`, a.num === '1' ? 'Article 1er' : `Article ${a.num}`])),
    }
    await publier(meta, body, ann, themes)
  }

  await prisma.$disconnect()
  console.log('\n✅ 8 documents publiés — Justice (principal) + Droit civil')
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
