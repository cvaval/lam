/**
 * CODE FISCAL DE 2026 — Décret du 30 septembre 2026 remplaçant le Décret du 19 décembre 2022
 * portant Code Fiscal (Le Moniteur, Spécial N° 48-A) — en Législation annotée, au format du
 * Code civil : texte, Sommaire (plages d'articles), Index, renvois « article N » cliquables.
 *
 *     npx tsx scripts/_import-code-fiscal-2026.ts                       # à blanc : contrôles, rien n'est écrit
 *     npx tsx scripts/_import-code-fiscal-2026.ts --commit              # écrit (sur instruction de Me Vaval)
 *
 * Spécification : docs/prompt-code-fiscal-2026.md. Données : scripts/data/code-fiscal-2026/
 * (parse_cf.py → bodyOriginal.txt, annotations.json, rich.json ; visas.json ; corrections-jo.json).
 * Collation : docs/livraison-code-fiscal-2026/collation.csv.
 *
 * ─── CE QUE LE SCRIPT ÉCRIT (avec --commit) ────────────────────────────────────────────────
 *  · la fiche `LEGISLATION` / `CODE_FISCAL_2026` (création, ou mise à jour si elle existe) ;
 *  · ses deux thèmes : `fiscalite` (principal) et `fiscalite-impots` ;
 *  · ses renvois (`CrossRef`), tous refaits à chaque passage :
 *      - un `ABROGE` NOMINATIF vers le Décret du 19 décembre 2022 portant Code Fiscal, NON RÉSOLU
 *        (`toId` nul) : il n'existe qu'en Index et en Éditions, et un ABROGE vers un fascicule
 *        affirmerait que le fascicule est abrogé ;
 *      - un `VOIR` vers le fascicule `LM2023-SP3` (texte de 2022), un `VOIR` vers `LM2026-SP48-A` ;
 *      - les `CITE` de la table FERMÉE des visas, résolus par `source` (et `type`), jamais par titre.
 *    ⚠️ AUCUN renvoi ni statut tiré des clauses-balais des art. 541-543 : elles ne nomment
 *    aucun texte ;
 *  · le .docx d'origine sur le Blob PRIVÉ (`sourceFileUrl`) et le fac-similé (`sourcePdfUrl`).
 * Puis `reindexDocument()` HORS transaction, l'audit, et un RECOMPTE (audit() avale ses erreurs).
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { parseAnnotations, segmentAnnotated, type NavItem } from '../src/lib/legislation/annotated'
import { parseRichBlocks } from '../src/lib/doc/richblocks'
import { uploadToBlob, isBlobUrl } from '../src/lib/storage/blob'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const COMMIT = process.argv.includes('--commit')
const DIR = join(process.cwd(), 'scripts/data/code-fiscal-2026')
const LIVRAISON = join(process.cwd(), 'docs/livraison-code-fiscal-2026')
const SOURCE = 'CODE_FISCAL_2026'
// Le titre TEL QUE DANS LE TEXTE (décision de Me Vaval, 13 oct. 2026) : l'intitulé imprimé, en casse
// ordinaire. La référence (`number`) garde la désignation complète, nature + date + objet.
const TITRE = 'Décret remplaçant le Décret du 19 décembre 2022 portant Code Fiscal'
const REFERENCE = 'Décret du 30 septembre 2026 remplaçant le Décret du 19 décembre 2022 portant Code Fiscal'
const DOCX = '/Users/cvaval/Downloads/Code_Fiscal_2026_Moniteur_48-A.docx'
const DOCX_SHA = '02193031afd76a0a2ea4b605a0ae788b42e01fc44d6174d35b1897164f8be074'
const PDF = '/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur/Code Fiscal_2026_small.pdf'
const PDF_SHA = '4de4e837f1a58b9e495b5cd2e08c3406c50ef513e6a74b0b2b1b0dca05153ae6'
const ABROGE_LABEL = 'Décret du 19 décembre 2022 portant Code Fiscal'

const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex')
const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`⛔ ${msg} — rien n'est écrit`)
}
const log = (s: string) => console.log(s)

type Visa = { n: number; visa: string; source: string | null; type: string | null; certitude: string; note: string }

async function main() {
  // ══════════════════════════════════════════════════════════════════════════════════════════
  // 1. LES DONNÉES, ET LES CONTRÔLES DU § 11 — sans base
  // ══════════════════════════════════════════════════════════════════════════════════════════
  const corps = readFileSync(join(DIR, 'bodyOriginal.txt'), 'utf8').trimEnd()
  const ann = parseAnnotations(readFileSync(join(DIR, 'annotations.json'), 'utf8'))
  ok(ann, 'annotations.json illisible')
  const a = ann!
  const richBrut = readFileSync(join(DIR, 'rich.json'), 'utf8')
  const rich = parseRichBlocks(richBrut)
  const lignes = corps.split('\n')

  // § 11.6 — bornes du corps et signataires
  ok(lignes[0] === 'LIBERTÉ ÉGALITÉ FRATERNITÉ', `le corps commence par « ${lignes[0]} »`)
  ok(lignes[lignes.length - 1].endsWith('Pr. Vijonet DEMERO'), 'le corps ne finit pas à la dernière signature')
  const par = lignes.findLastIndex((l) => /^Par\s*:$/u.test(l)) // « Par\u00a0: » (espace insécable)
  const signataires = lignes.slice(par + 1)
  ok(signataires.length === 19, `${signataires.length} signataires au lieu de 19`)
  ok(!/^(LE MONITEUR|SOMMAIRE|NUMÉRO SPÉCIAL|Paraissant du Lundi)/m.test(corps) && !corps.includes('Directeur Général : Ronald'), 'la manchette ou le sommaire du fascicule est resté dans le corps')

  // § 11.1 et 11.2 bis — têtes d'article, par forme ; aucune tête collée
  const tetes = lignes.filter((l) => /^Article\s*(?:1er|\d{1,3})\s*\./.test(l))
  ok(tetes.length === 542, `${tetes.length} têtes au lieu de 542`)
  const formes = {
    premier: tetes.filter((t) => t.startsWith('Article 1er.-')).length,
    sansTiret: tetes.filter((t) => /^Article \d+\. /.test(t)).map((t) => t.match(/\d+/)![0]),
    collee: tetes.filter((t) => /^Article\d/.test(t)).map((t) => t.match(/\d+/)![0]),
    tiret: tetes.filter((t) => /^Article \d+\.-/.test(t)).length,
  }
  ok(formes.premier === 1, 'tête « Article 1er.- »')
  ok(formes.sansTiret.join(',') === '296,442,443,444,492,519,527,534,535,536', `têtes sans tiret : ${formes.sansTiret.join(',')}`)
  ok(formes.collee.join(',') === '129', `tête collée : ${formes.collee.join(',')}`)
  ok(formes.tiret === 530, `${formes.tiret} têtes « N.- »`)
  ok(!/^Article \d+\.-\S/m.test(corps), 'tête collée « Article N.-Texte » (bug <w:tab/>)')
  ok(!corps.includes('\t'), 'tabulation dans le corps')
  ok(tetes.filter((t) => t.startsWith('Article 406.-')).length === 2 && !tetes.some((t) => /^Article 294\b/.test(t)), '294 absent et 406 deux fois')

  // § 11.2 — la collation est complète, et ses corrections sont dans le corps
  ok(existsSync(join(LIVRAISON, 'collation.csv')), 'collation.csv absent')
  const collation = readFileSync(join(LIVRAISON, 'collation.csv'), 'utf8').split('\n').slice(1).filter(Boolean)
  ok(collation.every((l) => /;(CONFORME|CORRIGER|HORS_CORPS);/.test(l)), 'une ligne de la collation n’est pas tranchée')
  const corrections = (JSON.parse(readFileSync(join(DIR, 'corrections-jo.json'), 'utf8')) as { corrections: { id: string; apres: string }[] }).corrections
  for (const c of corrections) ok(corps.includes(c.apres), `correction ${c.id} absente du corps`)
  ok(corps.includes('De 21 à moins 31 ans révolus'), 'art. 230 : la 2e rangée doit rester SANS « de » (J.O., vérifié à l’image)')

  // § 11.3 — segmentation, sommaire, plages
  const blocs = segmentAnnotated(corps, a.toc, a.pointAnchors, a.repeatedHeads)
  const sections = blocs.filter((b) => b.kind === 'section')
  ok(sections.length === a.toc.length, `segmentation ${sections.length}/${a.toc.length}`)
  const divisions = a.toc.filter((t) => t.kind === 'code')
  ok(divisions.length === 419, `${divisions.length} divisions au lieu de 419`)
  const secs = a.toc.map((t) => t.anchor)
  ok(new Set(secs).size === secs.length, 'ancre sec-N en double')
  const arts = blocs.filter((b) => b.kind === 'body' && b.anchor && !b.noAnchors).map((b) => (b.kind === 'body' ? b.anchor! : ''))
  ok(arts.length === 542 && new Set(arts).size === 542, `${arts.length} ancres d’article`)
  ok(arts.includes('art-406-2') && !arts.includes('art-294') && !arts.includes('art-405'), 'ancres 406 / 406-2 / 294 / 405')
  const labels = a.labels ?? {}
  ok(Object.keys(labels).length === 542 && Object.keys(labels).every((k) => arts.includes(k)), 'libellés sans ancre')
  const noeuds: NavItem[] = []
  const parcourir = (n: NavItem) => {
    noeuds.push(n)
    for (const c of n.children ?? []) parcourir(c)
  }
  for (const g of a.navToc) parcourir(g as NavItem)
  const sansPlage = noeuds.filter((n) => n.label !== 'Préambule' && !n.articles)
  ok(!sansPlage.length, `${sansPlage.length} division(s) sans plage`)
  ok(noeuds.length === 420, `${noeuds.length} entrées au sommaire (419 + Préambule attendues)`)
  ok(noeuds.every((n) => secs.includes(n.anchor) && (!n.articlesAnchor || arts.includes(n.articlesAnchor))), 'ancre morte au sommaire')
  ok(!noeuds.some((n) => /\bp\.\s?\d/.test(`${n.label} ${n.articles ?? ''}`)), 'un numéro de page au sommaire')
  const plage = (debut: string) => noeuds.find((n) => n.label.replace(/\u00a0/g, ' ').startsWith(debut))?.articles
  ok(plage('LIVRE I :') === 'art. 1 à 297' && plage('LIVRE II :') === 'art. 298 à 543', 'plages des Livres')
  ok(plage('CONCLUSION') === 'art. 540 à 543', 'plage de la Conclusion (union)')
  ok(plage('CHAPITRE 7 — DROIT D’AFFICHAGE') === 'art. 293 à 295' && plage('Section IV. Vérification de comptabilité') === 'art. 404 à 414', 'plages irrégulières du J.O.')
  ok((a.crossRefs ?? []).length === 3 && (a.crossRefs ?? []).every((c) => secs.includes(c.anchor)), 'les trois notes de section')

  // § 11.4 — index : 0 lien mort
  const renvois = a.indexEntries.flatMap((e) => e.ctRefs.map(String))
  const morts = renvois.filter((r) => !arts.includes(`art-${r}`))
  ok(a.refDisplay?.['406-2'] === '406 (2ᵉ)' && renvois.includes('406-2') && !renvois.some((r) => r === '405' || r === '294'), 'index : redirection 405 → 406, 406 → 406 (2ᵉ), 294 → 293')
  ok(!morts.length, `index : ${morts.length} lien(s) mort(s) (${[...new Set(morts)].join(', ')})`)
  const couverts = new Set(renvois)

  // § 11.5 — tableaux : neuf, au bon article, rangées conservées par la sanitisation
  ok(rich.length === 9, `${rich.length} tableaux`)
  const rangeesBrutes = (JSON.parse(richBrut) as { rows: unknown[] }[]).reduce((n, t) => n + t.rows.length, 0)
  const rangees = rich.reduce((n, t) => n + ((t as { rows?: unknown[] }).rows?.length ?? 0), 0)
  ok(rangees === rangeesBrutes, `${rangeesBrutes - rangees} rangée(s) perdue(s) à la sanitisation`)
  const lieux = rich.map((t) => {
    const premiere = ((t as { rows: { text: string }[][] }).rows[0] ?? []).map((c) => c.text).join(' | ')
    const b = blocs.find((x) => x.kind === 'body' && x.text.split('\n').includes(premiere))
    return b && b.kind === 'body' ? b.anchor : null
  })
  ok(lieux.join(',') === 'art-154,art-154,art-202,art-230,art-274,art-293,art-403,art-403,art-403', `tableaux : ${lieux.join(',')}`)

  log(`✓ corps : ${lignes.length} lignes · ${corps.length.toLocaleString('fr-FR')} c. · de « LIBERTÉ ÉGALITÉ FRATERNITÉ » à « Pr. Vijonet DEMERO » · 19 signataires`)
  log(`✓ têtes : 542 — « 1er.- » 1 · « N.- » ${formes.tiret} · « N. » ${formes.sansTiret.length} (${formes.sansTiret.join(', ')}) · « Article129.- » · 406 ×2 (art-406, art-406-2) · pas de 294`)
  log(`✓ collation : ${collation.length} lignes tranchées · ${corrections.length} corrections dans le corps`)
  log(`✓ segmentation : ${sections.length}/${a.toc.length} en-têtes (419 divisions) · ${noeuds.length} entrées au sommaire, toutes à plage · 0 page`)
  log(`✓ index : ${a.indexEntries.length} sujets · ${renvois.length} renvois · 0 mort · 405/406/294 redirigés · couverture ${couverts.size}/542`)
  log(`✓ tableaux : 9 au bon article (154 ×2, 202, 230, 274, 293, 403 ×3) · ${rangees} rangées`)

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // 2. LA BASE — lecture seule jusqu'au --commit
  // ══════════════════════════════════════════════════════════════════════════════════════════
  const themes = await prisma.theme.findMany({ where: { slug: { in: ['fiscalite', 'fiscalite-impots'] } }, select: { id: true, slug: true } })
  ok(themes.length === 2, 'thèmes fiscalite / fiscalite-impots introuvables')
  const existant = await prisma.document.findMany({ where: { source: SOURCE }, select: { id: true } })
  ok(existant.length <= 1, `${existant.length} fiches ${SOURCE}`)
  const fasc2022 = await prisma.document.findMany({ where: { source: 'MONITEUR_PDF_2023', number: 'LM2023-SP3' }, select: { id: true, titleFr: true } })
  ok(fasc2022.length === 1, `fascicule LM2023-SP3 : ${fasc2022.length}`)
  const fasc2026 = await prisma.document.findMany({ where: { source: 'MONITEUR_PDF_2026', number: 'LM2026-SP48-A' }, select: { id: true, titleFr: true } })
  const visas = (JSON.parse(readFileSync(join(DIR, 'visas.json'), 'utf8')) as { visas: Visa[] }).visas
  ok(visas.length === 103, `${visas.length} visas`)
  const cibles: { visa: Visa; id: string; titre: string }[] = []
  for (const v of visas.filter((x) => x.source)) {
    const d = await prisma.document.findMany({ where: { source: v.source!, type: v.type! }, select: { id: true, titleFr: true } })
    ok(d.length === 1, `visa ${v.n} : ${d.length} fiche(s) ${v.type}/${v.source}`)
    cibles.push({ visa: v, id: d[0].id, titre: d[0].titleFr })
  }
  log(`✓ base : thèmes ${themes.map((t) => t.slug).join(' + ')} · fiche ${existant.length ? `EXISTANTE ${existant[0].id} (mise à jour)` : 'à créer'} · LM2023-SP3 ${fasc2022[0].id} · LM2026-SP48-A ${fasc2026[0]?.id ?? 'ABSENT'}`)
  log(`✓ visas : ${cibles.length}/103 identifiés avec certitude → CITE ; ${visas.length - cibles.length} restent du texte`)
  for (const c of cibles.filter((x) => x.visa.note.startsWith('⚠️'))) log(`   ⚠️ visa ${c.visa.n} : ${c.visa.note}`)
  ok(fasc2026.length === 1, 'le fascicule LM2026-SP48-A doit être en Éditions avant la fiche (VOIR + fac-similé)')

  // Les pièces à archiver
  ok(existsSync(DOCX) && sha(readFileSync(DOCX)) === DOCX_SHA, 'le .docx d’origine a changé ou manque')
  ok(existsSync(PDF) && sha(readFileSync(PDF)) === PDF_SHA, 'le fac-similé a changé ou manque')

  const data = {
    type: 'LEGISLATION',
    status: 'EN_VIGUEUR',
    source: SOURCE,
    titleFr: TITRE,
    titleEn: 'Decree replacing the Decree of December 19, 2022 on the Tax Code',
    // Créole : convention de la cliente, sans accent grave (« refere », « Mache piblik »).
    titleHt: 'Dekre ki ranplase Dekre 19 desanm 2022 sou Kod Fiskal la',
    number: REFERENCE,
    matiere: 'fiscal',
    moniteurRef: 'Le Moniteur, 181ᵉ Année – Spécial N° 48-A, mercredi 30 septembre 2026',
    adoptionDate: new Date('2026-09-30T00:00:00Z'),
    publicationDate: new Date('2026-09-30T00:00:00Z'),
    effectiveDate: new Date('2026-10-01T00:00:00Z'),
    keywords:
      'Code fiscal; Code général des impôts (CGI); Livre des procédures fiscales (LPF); matricule fiscal; NIF; patente; ' +
      'droit de licence; impôt sur le revenu; impôt sur les sociétés; taxe sur la masse salariale; TCA; taxe sur le chiffre ' +
      'd’affaires; droits d’accises; droit de timbre; enregistrement; CFGDCT; CFPB; contribution foncière; vérification de ' +
      'comptabilité; taxation d’office; rescrit fiscal; recouvrement; contentieux fiscal; DGI',
    summaryFr:
      'Décret du 30 septembre 2026 remplaçant le Décret du 19 décembre 2022 portant Code Fiscal, donné au Palais National ' +
      'par le Conseil des Ministres et publié au Moniteur, 181ᵉ Année – Spécial N° 48-A, mercredi 30 septembre 2026. ' +
      'Il entre en vigueur le 1er octobre 2026 (art. 540). Le Code comprend le Code Général des Impôts (Livre I, art. 1 ' +
      'à 297) et le Livre des Procédures Fiscales (Livre II, art. 298 à 543). Ses articles 541 à 543 abrogent les impôts, ' +
      'droits, taxes et redevances non reconduits, les procédures non reconduites et les dispositions contraires, sans ' +
      'nommer de texte : aucun texte du corpus n’est marqué abrogé de ce fait. Le texte est celui du Journal officiel, à la ' +
      'lettre, y compris ses irrégularités (pas d’article 294, deux « Article 406 »), signalées en note à leur place.',
    bodyOriginal: corps,
    annotationsJson: JSON.stringify(a),
    richBlocksJson: richBrut,
  }

  if (!COMMIT) {
    log('\n(à blanc — tous les contrôles passent ; --commit pour écrire, sur instruction de Me Vaval)')
    return
  }

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // 3. ÉCRITURE
  // ══════════════════════════════════════════════════════════════════════════════════════════
  const env = Object.fromEntries(
    readFileSync('.env', 'utf8')
      .split('\n')
      .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
  ) as Record<string, string>
  if (env.BLOB_READ_WRITE_TOKEN) process.env.BLOB_READ_WRITE_TOKEN = env.BLOB_READ_WRITE_TOKEN
  ok(process.env.BLOB_READ_WRITE_TOKEN, 'BLOB_READ_WRITE_TOKEN absent (piège OIDC)')

  const doc = await prisma.$transaction(async (tx) => {
    const d = existant.length
      ? await tx.document.update({ where: { id: existant[0].id }, data })
      : await tx.document.create({ data: { ...data, originalLang: 'fr' } })
    for (const t of themes) {
      const isPrimary = t.slug === 'fiscalite'
      const lien = await tx.documentTheme.findFirst({ where: { documentId: d.id, themeId: t.id } })
      if (!lien) await tx.documentTheme.create({ data: { documentId: d.id, themeId: t.id, isPrimary, assignedBy: 'IMPORT' } })
    }
    await tx.crossRef.deleteMany({ where: { fromId: d.id } })
    let position = 0
    await tx.crossRef.create({
      data: { fromId: d.id, toType: 'LEGISLATION', toNumber: ABROGE_LABEL, toLabel: ABROGE_LABEL, kind: 'ABROGE', source: 'EDITORIAL', position: position++ },
    })
    await tx.crossRef.create({ data: { fromId: d.id, toId: fasc2022[0].id, toType: 'LEGISLATION', toLabel: fasc2022[0].titleFr, kind: 'VOIR', source: 'EDITORIAL', position: position++ } })
    await tx.crossRef.create({ data: { fromId: d.id, toId: fasc2026[0].id, toType: 'LEGISLATION', toLabel: fasc2026[0].titleFr, kind: 'VOIR', source: 'EDITORIAL', position: position++ } })
    for (const c of cibles)
      await tx.crossRef.create({ data: { fromId: d.id, toId: c.id, toType: c.visa.type!, toLabel: c.titre, kind: 'CITE', source: 'EDITORIAL', position: position++ } })
    return d
  }, { timeout: 120_000 })

  const urlDocx = await uploadToBlob(`source-file/legislation/${doc.id}.docx`, readFileSync(DOCX), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  const urlPdf = await uploadToBlob(`source-pdf/legislation/${doc.id}.pdf`, readFileSync(PDF), 'application/pdf', { multipart: true })
  ok(isBlobUrl(urlDocx) && isBlobUrl(urlPdf), 'téléversement Blob')
  await prisma.document.update({ where: { id: doc.id }, data: { sourceFileUrl: urlDocx, sourcePdfUrl: urlPdf } })
  await reindexDocument(doc.id)
  await audit({ action: 'DOC_PUBLISHED', targetType: 'DOCUMENT', targetId: doc.id, meta: { via: '_import-code-fiscal-2026', source: SOURCE, crossRefs: 3 + cibles.length } })

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // 4. RECOMPTE — après la transaction
  // ══════════════════════════════════════════════════════════════════════════════════════════
  const relu = await prisma.document.findUnique({ where: { id: doc.id }, select: { titleFr: true, bodyOriginal: true, annotationsJson: true, richBlocksJson: true, sourceFileUrl: true, sourcePdfUrl: true, adoptionDate: true, publicationDate: true, effectiveDate: true, searchText: true, status: true } })
  ok(relu && relu.bodyOriginal === corps && relu.annotationsJson === data.annotationsJson && relu.richBlocksJson === richBrut, 'relecture : contenu différent')
  ok(relu!.sourceFileUrl === urlDocx && relu!.sourcePdfUrl === urlPdf, 'relecture : URL Blob')
  ok(relu!.adoptionDate?.toISOString().startsWith('2026-09-30') && relu!.effectiveDate?.toISOString().startsWith('2026-10-01'), 'relecture : dates')
  const refs = await prisma.crossRef.groupBy({ by: ['kind'], where: { fromId: doc.id }, _count: true })
  const n = Object.fromEntries(refs.map((r) => [r.kind, r._count]))
  ok(n.ABROGE === 1 && n.VOIR === 2 && n.CITE === cibles.length, `relecture : renvois ${JSON.stringify(n)}`)
  const abroge = await prisma.crossRef.findFirst({ where: { fromId: doc.id, kind: 'ABROGE' } })
  ok(abroge?.toId === null, 'l’ABROGE doit rester non résolu')
  const liens = await prisma.documentTheme.findMany({ where: { documentId: doc.id }, select: { isPrimary: true, theme: { select: { slug: true } } } })
  ok(liens.length === 2 && liens.some((l) => l.isPrimary && l.theme.slug === 'fiscalite'), 'relecture : thèmes')
  const journal = await prisma.auditLog.count({ where: { targetId: doc.id, action: 'DOC_PUBLISHED' } })
  log(`\n✅ fiche ${existant.length ? 'mise à jour' : 'créée'} : ${doc.id}`)
  log(`   renvois : ${JSON.stringify(n)} · thèmes ${liens.map((l) => l.theme.slug + (l.isPrimary ? ' (principal)' : '')).join(' + ')} · audit ${journal ? 'écrit' : '⚠️ ABSENT'}`)
  log(`   Word : ${urlDocx.slice(0, 70)}… · fac-similé : ${urlPdf.slice(0, 70)}…`)
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
