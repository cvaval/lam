/**
 * SIGNATURE ÉLECTRONIQUE · ÉCHANGES ÉLECTRONIQUES · ADMINISTRATION ÉLECTRONIQUE
 * Téléversement des 5 textes (2015 → 2025).
 *
 *  · Loi du 14 février 2017 sur la signature électronique — texte CONSOLIDÉ (25 articles) :
 *    8 « nouveau », 8 « modifié » (rédaction 2017 repliée), 1 « abrogé » (art. 16).
 *    L'index de la cliente le dit : « les renvois s'entendent des articles de la Loi du
 *    14 février 2017 TELLE QU'AMENDÉE ».
 *  · Décret du 20 août 2025 — texte autonome (3 articles), instrument de l'amendement.
 *  · Loi du 14 février 2017 sur les échanges électroniques (18 têtes, dont l'art. 9-1).
 *  · Décret du 6 janvier 2016 sur l'administration électronique (51 art.) → DROIT PUBLIC.
 *  · Décret du 9 décembre 2015 — ABROGÉ, supplanté par la loi de 2017 (décision cliente).
 *
 * Les effets sur le CODE CIVIL (art. 1101, 1102, 1111, 1112) sont posés séparément par
 * _apply-electronique-cc.ts.
 *
 * Idempotent (upsert par source).
 *   npx tsx scripts/_import-electronique.ts
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated, type Annotations, type TocEntry, type NavGroup } from '../src/lib/legislation/annotated'

const DIR = 'scripts/data/electronique-2015-2025'

interface Meta {
  source: string
  titleFr: string; titleEn: string; titleHt: string
  number: string; date: string; moniteurRef: string
  statut: 'EN_VIGUEUR' | 'ABROGE'
  themes: string[]
  keywords: string
  summaryFr: string
}

const META: Record<string, Meta> = {
  'decret-2015-signature': {
    source: 'DECRET_SIGNATURE_ELECTRONIQUE_2015',
    titleFr: 'Décret du 9 décembre 2015 portant sur la signature électronique',
    titleEn: 'Decree of 9 December 2015 on electronic signatures',
    titleHt: 'Dekrè 9 desanm 2015 sou siyati elektwonik',
    number: 'Décret du 9 décembre 2015', date: '2016-01-29',
    moniteurRef: 'Le Moniteur, 171e Année, No. 20 du 29 janvier 2016',
    statut: 'ABROGE', themes: ['signature-electronique'],
    keywords: 'signature électronique; preuve littérale; acte authentique; notariat; certification; CONATEL; certificat électronique',
    summaryFr: 'SUPPLANTÉ par la loi du 14 février 2017 sur la signature électronique, qui reprend la même matière '
      + 'et abroge les dispositions contraires (art. 17). Réécrivait les articles 1101, 1102, 1111 et 1112 du Code '
      + 'civil et le premier paragraphe de l’article 30 du décret-loi du 27 novembre 1969 sur le notariat, et '
      + 'organisait la qualification des prestataires de certification par le CONATEL.',
  },
  'decret-2016-administration': {
    source: 'DECRET_ADMINISTRATION_ELECTRONIQUE_2016',
    titleFr: 'Décret du 6 janvier 2016 reconnaissant le droit de tout administré à s’adresser à l’administration publique par des moyens électroniques',
    titleEn: 'Decree of 6 January 2016 on electronic communication with public administration',
    titleHt: 'Dekrè 6 janvye 2016 sou dwa administre yo pou kominike alektwonik ak administrasyon an',
    number: 'Décret du 6 janvier 2016', date: '2016-01-29',
    moniteurRef: 'Le Moniteur, 171e Année, No. 20 du 29 janvier 2016',
    statut: 'EN_VIGUEUR', themes: ['droit-public', 'administration-centrale'],
    keywords: 'administration électronique; administré; service public; démarche administrative; identification électronique; '
      + 'authentification; interopérabilité; registre administratif; notification électronique; archivage; accessibilité',
    summaryFr: 'Reconnaît à tout administré le droit de s’adresser à l’administration publique par des moyens '
      + 'électroniques : principes généraux et définitions, droits des administrés, identification et authentification, '
      + 'interopérabilité et accréditation, registres, communications et notifications électroniques, archivage.',
  },
  'loi-2017-echanges': {
    source: 'LOI_ECHANGES_ELECTRONIQUES_2017',
    titleFr: 'Loi du 14 février 2017 sur les échanges électroniques',
    titleEn: 'Law of 14 February 2017 on electronic exchanges',
    titleHt: 'Lwa 14 fevriye 2017 sou echanj elektwonik',
    number: 'Loi du 14 février 2017', date: '2017-04-11',
    moniteurRef: 'Le Moniteur, 172e Année, Spécial No 12 du 11 avril 2017',
    statut: 'EN_VIGUEUR', themes: ['signature-electronique'],
    keywords: 'échanges électroniques; message de données; échange de données informatisées; EDI; expéditeur; destinataire; '
      + 'accusé de réception; formation du contrat; force probante; conservation; transport de marchandises; connaissement',
    summaryFr: 'Adapte le droit haïtien au commerce électronique, sur le modèle de la loi-type de la CNUDCI : champ '
      + 'd’application et définitions, application des exigences légales aux messages de données (forme originale, '
      + 'conservation), communication des messages (formation du contrat, attribution à l’expéditeur, accusé de '
      + 'réception, moment et lieu d’expédition et de réception) et transport de marchandises.',
  },
  'loi-2017-signature': {
    source: 'LOI_SIGNATURE_ELECTRONIQUE_2017',
    titleFr: 'Loi du 14 février 2017 sur la signature électronique, telle qu’amendée par le décret du 20 août 2025',
    titleEn: 'Law of 14 February 2017 on electronic signatures, as amended in 2025',
    titleHt: 'Lwa 14 fevriye 2017 sou siyati elektwonik, jan dekrè 20 out 2025 modifye l',
    number: 'Loi du 14 février 2017', date: '2017-04-11',
    moniteurRef: 'Le Moniteur, 172e Année, Spécial No 12 du 11 avril 2017 — amendée par Le Moniteur, Spécial N° 55 du 27 août 2025',
    statut: 'EN_VIGUEUR', themes: ['signature-electronique'],
    keywords: 'signature électronique; preuve littérale; acte authentique; écrit électronique; prestataire de services de confiance; '
      + 'service de confiance qualifié; certificat qualifié; cachet électronique; horodatage; CONATEL; accréditation; audit; '
      + 'numérisation certifiée; Code civil 1101 1102 1111 1112',
    summaryFr: 'Texte CONSOLIDÉ (rédaction en vigueur, amendée par le décret du 20 août 2025) : adapte le droit de la preuve '
      + 'aux technologies de l’information et élargit les compétences du CONATEL. Réécrit les articles 1101, 1102, 1111 et '
      + '1112 du Code civil ainsi que l’article 30 du décret-loi de 1969 sur le notariat. Le décret de 2025 y ajoute les '
      + 'niveaux de sécurité de la signature, les services de confiance et les prestataires qualifiés, le recours contre les '
      + 'décisions du CONATEL et l’admissibilité en justice du document électronique ; il abroge l’article 16.',
  },
  'decret-2025-signature': {
    source: 'DECRET_SIGNATURE_ELECTRONIQUE_2025',
    titleFr: 'Décret du 20 août 2025 portant amendement de la Loi du 14 février 2017 sur la signature électronique',
    titleEn: 'Decree of 20 August 2025 amending the 2017 Electronic Signature Law',
    titleHt: 'Dekrè 20 out 2025 ki modifye Lwa 14 fevriye 2017 sou siyati elektwonik',
    number: 'Décret du 20 août 2025', date: '2025-08-27',
    moniteurRef: 'Le Moniteur, 180e Année, Spécial N° 55 du 27 août 2025',
    statut: 'EN_VIGUEUR', themes: ['signature-electronique'],
    keywords: 'signature électronique; amendement; service de confiance; prestataire qualifié; CONATEL; arrêté d’application; '
      + 'cachet électronique; horodatage; numérisation certifiée; Conseil Présidentiel de Transition',
    summaryFr: 'Amende la loi du 14 février 2017 : ajoute 8 articles (niveaux de sécurité de la signature, contrat '
      + 'synallagmatique électronique, services de confiance et services qualifiés, admissibilité en justice, recours '
      + 'contre les décisions du CONATEL, habilitation des entités d’audit), en réécrit 8 (dont l’article 2, qui porte '
      + 'la rédaction de l’article 1102 du Code civil) et abroge l’article 16.',
  },
}

const ORDRE = ['loi-2017-signature', 'decret-2025-signature', 'loi-2017-echanges',
  'decret-2016-administration', 'decret-2015-signature']

function cle(n: string): [number, number] {
  const [a, b] = n.split(/[.\-]/)
  return [Number(a), b ? Number(b) : 0]
}

function buildNavToc(titre: string, toc: TocEntry[], body: string, som: Record<string, string>): NavGroup[] {
  const racine: NavGroup = { label: titre, anchor: toc[0]?.anchor ?? 'art-1', children: [] }
  let courant: { label: string; anchor: string; children: { label: string; anchor: string }[] } | null = null
  const parLabel = new Map(toc.map((t) => [t.label, t]))
  for (const raw of body.split('\n')) {
    const l = raw.trim()
    const t = parLabel.get(l)
    if (t) { courant = { label: l, anchor: t.anchor, children: [] }; racine.children.push(courant as never); continue }
    const m = l.match(/^Article\s+(\d{1,3}(?:[.\-]\d{1,2})?)\.-/)
    if (!m) continue
    const n = m[1]
    const lib = n === '1' ? 'Article 1er' : `Article ${n}`
    const r = som[n]
    const item = { label: r ? `${lib} — ${r}` : lib, anchor: `art-${n.replace('.', '-')}` }
    if (courant) courant.children.push(item)
    else racine.children.push(item as never)
  }
  return [racine]
}

async function main() {
  const textes = JSON.parse(readFileSync(`${DIR}/textes.json`, 'utf8')) as Record<string, any>
  const app = JSON.parse(readFileSync(`${DIR}/appareil.json`, 'utf8')) as Record<string, { index: Record<string, string[]>; sommaire: Record<string, string> }>
  const coll = new Intl.Collator('fr', { sensitivity: 'base' })

  const slugsThemes = [...new Set(Object.values(META).flatMap((m) => m.themes))]
  const themes = await prisma.theme.findMany({ where: { slug: { in: slugsThemes } }, select: { id: true, slug: true } })
  if (themes.length !== slugsThemes.length) throw new Error(`thèmes manquants : ${slugsThemes.filter((s) => !themes.some((t) => t.slug === s)).join(', ')}`)

  for (const slug of ORDRE) {
    const meta = META[slug]
    const t = textes[slug]
    const a = app[slug]
    const arts: { num: string; text: string }[] = t.consolide ?? t.articles

    // Corps : en-tête (visas, considérants) puis les articles, en-têtes de chapitre replacés.
    const lignes: string[] = [meta.titleFr, ...(t.entete ?? [])]
    const toc: TocEntry[] = [{ level: 1, label: meta.titleFr, anchor: 'sec-1', kind: 'code' }]
    for (const art of arts) {
      const lib = art.num === '1' ? 'Article 1er' : `Article ${art.num}`
      lignes.push(`${lib}.- ${art.text}`)
    }
    const body = lignes.join('\n')

    const labels = Object.fromEntries(arts.map((x) => [`art-${x.num.replace('.', '-')}`, x.num === '1' ? 'Article 1er' : `Article ${x.num}`]))
    const ann: Annotations & Record<string, any> = {
      title: meta.titleFr, annotationAuthor: '',
      navToc: buildNavToc(meta.titleFr, toc, body, a.sommaire),
      toc, connexes: [], jurisprudence: {},
      indexEntries: Object.entries(a.index)
        .map(([subject, refs]) => ({ subject, ctRefs: [...refs].sort((x, y) => cle(x)[0] - cle(y)[0] || cle(x)[1] - cle(y)[1]) }))
        .sort((x, y) => coll.compare(x.subject, y.subject)),
      labels,
    }
    // Loi de 2017 : statuts + rédactions de 2017 repliées.
    if (slug === 'loi-2017-signature') {
      ann.status = Object.fromEntries(Object.entries(t.statuts as Record<string, string>).map(([n, s]) => [`art-${n.replace('.', '-')}`, s]))
      ann.oldVersions = Object.fromEntries(Object.entries(t.anciennes as Record<string, string>).map(([n, v]) => [
        `art-${n.replace('.', '-')}`,
        `Rédaction de la loi du 14 février 2017, avant le décret du 20 août 2025 :\n${v}`,
      ]))
    }

    const blocks = segmentAnnotated(body, ann.toc)
    const anchors = new Set(blocks.filter((b: any) => b.kind === 'body' && b.anchor).map((b: any) => b.anchor))
    const orph = Object.keys(labels).filter((x) => !anchors.has(x))
    if (orph.length) throw new Error(`${meta.source} : libellés sans article ${orph.slice(0, 6).join(', ')} — annulé`)
    const morts = ann.indexEntries.flatMap((e) => e.ctRefs).filter((r) => !anchors.has(`art-${String(r).replace('.', '-')}`))
    if (morts.length) throw new Error(`${meta.source} : renvois morts ${[...new Set(morts)].slice(0, 6).join(', ')} — annulé`)

    const data = {
      type: 'LEGISLATION' as const, status: meta.statut,
      titleFr: meta.titleFr, titleEn: meta.titleEn, titleHt: meta.titleHt,
      number: meta.number, matiere: 'electronique', moniteurRef: meta.moniteurRef,
      publicationDate: new Date(meta.date), keywords: meta.keywords, summaryFr: meta.summaryFr,
      bodyOriginal: body, annotationsJson: JSON.stringify(ann), source: meta.source,
    }
    const ex = await prisma.document.findFirst({ where: { source: meta.source }, select: { id: true } })
    const doc = ex ? await prisma.document.update({ where: { id: ex.id }, data })
                   : await prisma.document.create({ data: { ...data, originalLang: 'fr' } })
    for (const s of meta.themes) {
      const th = themes.find((x) => x.slug === s)!
      if (!(await prisma.documentTheme.findFirst({ where: { documentId: doc.id, themeId: th.id } })))
        await prisma.documentTheme.create({ data: { documentId: doc.id, themeId: th.id, isPrimary: s === meta.themes[0], assignedBy: 'IMPORT' } })
    }
    await reindexDocument(doc.id)
    const st = ann.status ? ` · ${Object.values(ann.status).filter((v) => v === 'nouveau').length} nouveau/${Object.values(ann.status).filter((v) => v === 'modifié').length} modifié/${Object.values(ann.status).filter((v) => v === 'abrogé').length} abrogé` : ''
    console.log(`  ${ex ? '↻' : '✓'} ${meta.source.padEnd(38)} ${String(anchors.size).padStart(3)} art · ${String(ann.indexEntries.length).padStart(3)} index · ${meta.statut}${st}`)
  }
  await prisma.$disconnect()
  console.log('\n✅ 5 documents publiés')
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
