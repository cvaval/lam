/**
 * Téléversement de la VAGUE 2 fiscale (édition Joseph Paillant du Code Fiscal, 2018) :
 * CFGDCT (loi du 20 août 1996), CFPB (décret du 5 avril 1979) et Enregistrement
 * (décret du 28 septembre 1977, 1ʳᵉ partie) — lecteur annoté, classés par COPIE dans
 * `fiscalite` (PRINCIPAL) + `fiscalite-impots`.
 * Idempotent (upsert par source). Données : scripts/data/fiscal-vague2/<slug>/.
 *   npx tsx scripts/_import-fiscal-vague2.ts
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated, type Annotations } from '../src/lib/legislation/annotated'

const DOCS = [
  {
    slug: 'cfgdct',
    source: 'LOI_CFGDCT_1996_CONSOLIDE',
    titleFr: 'Loi du 20 août 1996 — Contributions au Fonds de Gestion et de Développement des Collectivités Territoriales (consolidée)',
    titleEn: 'Act of August 20, 1996 — Contributions to the Local Government Management and Development Fund (consolidated)',
    titleHt: 'Lwa 20 out 1996 — Kontribisyon nan Fon Jesyon ak Devlopman Kolektivite Teritoryal yo (konsolide)',
    number: 'Loi du 20 août 1996',
    moniteurRef: 'Le Moniteur, N° 64-A du 2 septembre 1996 — consolidé (LF 2013-2014, 2014-2015 ; éd. Paillant 2018)',
    date: '1996-09-02',
    keywords: 'CFGDCT; collectivités territoriales; FIDES; sections communales; CASEC; mairies; conseils départementaux; retenue sur salaire; DGI',
    summaryFr:
      'Loi du 20 août 1996 portant Contributions au Fonds de Gestion et de Développement des Collectivités Territoriales ' +
      '(CFGDCT), 8 articles, consolidée par les Lois de Finances 2013-2014 et 2014-2015 : assiette (cigarettes, assurances, ' +
      'immatriculation, appels internationaux, douane, billets d’avion, salaires, loterie), charges couvertes, FIDES et ' +
      'répartition entre collectivités.',
  },
  {
    slug: 'cfpb',
    source: 'DECRET_CFPB_1979_CONSOLIDE',
    titleFr: 'Contribution foncière des propriétés bâties — Décret du 5 avril 1979 (texte consolidé)',
    titleEn: 'Built Property Tax (CFPB) — Decree of April 5, 1979 (consolidated)',
    titleHt: 'Kontribisyon fonsyè pwopriyete bati — Dekrè 5 avril 1979 (konsolide)',
    number: 'Décret du 5 avril 1979',
    moniteurRef: 'Le Moniteur, N° 32-A du 19 avril 1979 — consolidé (décret du 23 déc. 1981, LF 2015-2016, 2017-2018 ; éd. Paillant 2018)',
    date: '1979-04-19',
    keywords: 'CFPB; contribution foncière; impôt locatif; valeur vénale; valeur locative; barème; exemptions; recensement; surtaxe; hypothèque; certificat; notaires; communes',
    summaryFr:
      'Décret du 5 avril 1979 sur la Contribution Foncière des Propriétés Bâties (CFPB, « impôt locatif »), 37 articles, ' +
      'modifié par le décret du 23 décembre 1981 et consolidé par les Lois de Finances 2015-2016 et 2017-2018 : barème de ' +
      '6 % à 10 % sur la valeur vénale, abattements, exemptions, déclaration et recensement, pénalités, privilège et ' +
      'inscription hypothécaire, certificat exigé des notaires.',
  },
  {
    slug: 'enregistrement',
    source: 'DECRET_ENREGISTREMENT_1977',
    titleFr: 'De l’enregistrement — Décret du 28 septembre 1977 (première partie)',
    titleEn: 'Registration duties — Decree of September 28, 1977 (part one)',
    titleHt: 'Anrejistreman — Dekrè 28 septanm 1977 (premye pati)',
    number: 'Décret du 28 septembre 1977',
    moniteurRef: 'Le Moniteur, # 67 D de 1977 — éd. Paillant 2018 (Livre II, 3ᵉ partie)',
    date: '1977-09-28',
    keywords: 'enregistrement; droit fixe; droit proportionnel; mutations; actes notariés; actes sous seing privé; conservation foncière; délais; peines; prescriptions; DGI',
    summaryFr:
      'Décret du 28 septembre 1977, Première partie « De l’enregistrement », 112 articles (titres I à IX — le titre IV est ' +
      'absent de la source) : définition, nature et effets de l’enregistrement, droit fixe, droit proportionnel, délais ' +
      'd’enregistrement des actes, paiement, peines pour défaut d’enregistrement, poursuites et prescriptions.',
  },
]

async function main() {
  for (const d of DOCS) {
    const dir = `scripts/data/fiscal-vague2/${d.slug}`
    const body = readFileSync(`${dir}/bodyOriginal.txt`, 'utf8').trimEnd()
    const ann = JSON.parse(readFileSync(`${dir}/annotations.json`, 'utf8')) as Annotations & Record<string, any>
    if (!ann.indexEntries?.length) throw new Error(`${d.slug} : index vide — annulé`)
    const labels = (ann.labels ?? {}) as Record<string, string>
    const blocks = segmentAnnotated(body, ann.toc)
    const secs = blocks.filter((b) => b.kind === 'section').length
    const anchors = new Set(blocks.filter((b: any) => b.kind === 'body' && b.anchor).map((b: any) => b.anchor))
    if (secs !== ann.toc.length) throw new Error(`${d.slug} : segmentation ${secs}/${ann.toc.length} — annulé`)
    const missing = Object.keys(labels).filter((a) => !anchors.has(a))
    if (missing.length) throw new Error(`${d.slug} : ancres sans bloc ${missing.join(', ')} — annulé`)
    const dead = ann.indexEntries.flatMap((e: any) => e.ctRefs).filter((r: any) => !anchors.has(`art-${r}`))
    if (dead.length) throw new Error(`${d.slug} : renvois morts ${[...new Set(dead)].join(', ')} — annulé`)
    const covered = new Set(ann.indexEntries.flatMap((e: any) => e.ctRefs))
    const uncovered = [...anchors].filter((a) => !covered.has((a as string).slice(4)))
    if (uncovered.length) throw new Error(`${d.slug} : non couverts ${uncovered.join(', ')} — annulé`)
    const keys = new Set(blocks.filter((b: any) => b.kind === 'body' && b.jurisKey).map((b: any) => b.jurisKey))
    const badKeys = Object.keys(ann.commentaires ?? {}).filter((k) => !keys.has(k))
    if (badKeys.length) throw new Error(`${d.slug} : annotations orphelines ${badKeys.join(', ')} — annulé`)
    console.log(`✓ ${d.slug} : segmentation ${secs}/${ann.toc.length} · ${anchors.size} ancres · index ${ann.indexEntries.length} sujets (couverture intégrale, 0 mort)`)

    const data = {
      type: 'LEGISLATION' as const,
      status: 'EN_VIGUEUR' as const,
      titleFr: d.titleFr, titleEn: d.titleEn, titleHt: d.titleHt,
      number: d.number,
      matiere: 'fiscal',
      moniteurRef: d.moniteurRef,
      publicationDate: new Date(d.date),
      effectiveDate: new Date(d.date),
      keywords: d.keywords,
      summaryFr: d.summaryFr,
      bodyOriginal: body,
      annotationsJson: JSON.stringify(ann),
      source: d.source,
    }
    const existing = await prisma.document.findFirst({ where: { source: d.source }, select: { id: true } })
    const doc = existing
      ? await prisma.document.update({ where: { id: existing.id }, data })
      : await prisma.document.create({ data: { ...data, originalLang: 'fr' } })
    for (const [slug, isPrimary] of [['fiscalite', true], ['fiscalite-impots', false]] as const) {
      const theme = await prisma.theme.findFirst({ where: { slug } })
      if (!theme) throw new Error(`thème ${slug} introuvable`)
      if (!(await prisma.documentTheme.findFirst({ where: { documentId: doc.id, themeId: theme.id } })))
        await prisma.documentTheme.create({ data: { documentId: doc.id, themeId: theme.id, isPrimary, assignedBy: 'IMPORT' } })
    }
    await reindexDocument(doc.id)
    console.log(`✓ ${d.slug} ${existing ? 'mis à jour' : 'créé'} : ${doc.id}`)
  }
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
