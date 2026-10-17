/**
 * CODE PÉNAL et CODE DE PROCÉDURE PÉNALE RÉVISÉS — Décrets du 24 juin 2025 révisant ceux du 11 mars 2020
 * (Le Moniteur, Spéciaux N° 44 et 44-A du 24 juin 2025) — en Législation annotée, au format du Code civil :
 * texte, Sommaire (plages d'articles), Index, renvois « article N » cliquables.
 *
 *     npx tsx scripts/_import-codes-penaux-2025.ts cp              # à blanc : contrôles, rien n'est écrit
 *     npx tsx scripts/_import-codes-penaux-2025.ts cpp
 *     npx tsx scripts/_import-codes-penaux-2025.ts cp --commit     # écrit
 *
 * Décision de Me Vaval (17 oct. 2026) : « nous devons les téléverser dans législation annotée avant de faire
 * les cross reference » (renvois du Code fiscal 2026, docs/prompt-code-fiscal-2026-renvois.md § 0.3).
 * Données : scripts/data/codes-penaux-2025/<code>/ (assembler.py → transcription.txt ; collation tranchée sur
 * l'image → corrections-jo.json ; parse.py → bodyOriginal.txt, annotations.json ; indexer.ts → index-ia.jsonl).
 *
 * ─── PAS ENCORE EN VIGUEUR ───────────────────────────────────────────────────────────────────────────
 * Le Décret du 24 décembre 2025 (Le Moniteur Spécial N° 5 du 16 février 2026) fixe leur « entrée en vigueur
 * intégrale » au 1er janvier 2027, au terme de trois phases. D'où :
 *   · statut `PUBLIE` (« Publié »), jamais `EN_VIGUEUR` ; `effectiveDate` = 2027-01-01 ;
 *   · AUCUN `ABROGE`, ni statut, tiré des articles d'abrogation (C. pén. art. 1035 ; C. proc. pén. art. 1365) :
 *     ils n'auront effet qu'à l'entrée en vigueur ; le Code pénal de 1835 et le Code d'instruction criminelle
 *     restent tels quels.
 *
 * ─── CE QUE LE SCRIPT ÉCRIT (avec --commit) ─────────────────────────────────────────────────────────
 *  · la fiche `LEGISLATION` (création, ou mise à jour si elle existe) ; son thème principal ;
 *  · ses renvois (`CrossRef`), refaits à chaque passage :
 *      - un `MODIFIE` NOMINATIF, non résolu, vers le décret du 11 mars 2020 qu'il révise (le titre le dit) ;
 *      - des `VOIR` : son fascicule d'Éditions, le fascicule du décret de report (LM2026-SP5), l'entrée
 *        d'Index du décret de 2020 quand elle existe, et l'autre code révisé s'il est déjà versé (réciproque) ;
 *  · le fac-similé sur le Blob PRIVÉ (`sourcePdfUrl`).
 * Puis `reindexDocument()` HORS transaction, l'audit, et un RECOMPTE (audit() avale ses erreurs).
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { parseAnnotations, segmentAnnotated, type NavItem } from '../src/lib/legislation/annotated'
import { articleAnchorFromNum } from '../src/lib/doc/anchors'
import { uploadToBlob, isBlobUrl } from '../src/lib/storage/blob'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const code = process.argv[2]
if (code !== 'cp' && code !== 'cpp') throw new Error('usage : _import-codes-penaux-2025.ts cp|cpp [--commit]')
const COMMIT = process.argv.includes('--commit')
const DIR = join(process.cwd(), 'scripts/data/codes-penaux-2025', code)
const PDF_DIR = '/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur/MONITEURS 2025 Complet/LES MONITEURS JUIN 2025'

const CFG = {
  cp: {
    source: 'CODE_PENAL_2025',
    autre: 'CODE_PROCEDURE_PENALE_2025',
    titre: 'Décret révisant celui du 11 mars 2020 portant Code pénal',
    reference: 'Décret du 24 juin 2025 révisant celui du 11 mars 2020 portant Code pénal',
    titleEn: 'Decree of June 24, 2025 revising the Decree of March 11, 2020 on the Penal Code',
    // Créole : convention de la cliente, sans accent grave.
    titleHt: 'Dekre ki revize Dekre 11 mas 2020 sou Kod Penal la',
    revise: 'Décret du 11 mars 2020 portant Code pénal',
    index2020: 'LM2020-SP10',
    fascicule: 'LM2025-SP44',
    numeroSpecial: '44',
    pdf: join(PDF_DIR, 'Le Moniteur Spécial No.44 24Juin 2025.pdf'),
    theme: 'penal-general',
    tetes: 1035,
    divisions: 317,
    signataires: 20,
    abrogation: 'art. 1035',
    keywords:
      'Code pénal; Code pénal révisé; Décret du 11 mars 2020; infraction; crime; délit; contravention; peine; réclusion criminelle; ' +
      'emprisonnement; amende; jour-amende; travail d’intérêt général; sursis; récidive; responsabilité pénale; personne morale; ' +
      'légitime défense; tentative; complicité; génocide; crimes contre l’humanité; viol; agression sexuelle; vol; escroquerie; ' +
      'corruption; blanchiment; terrorisme; fausse monnaie; prescription',
  },
  cpp: {
    source: 'CODE_PROCEDURE_PENALE_2025',
    autre: 'CODE_PENAL_2025',
    titre: 'Décret révisant celui du 11 mars 2020 portant Code de procédure pénale',
    reference: 'Décret du 24 juin 2025 révisant celui du 11 mars 2020 portant Code de procédure pénale',
    titleEn: 'Decree of June 24, 2025 revising the Decree of March 11, 2020 on the Code of Criminal Procedure',
    titleHt: 'Dekre ki revize Dekre 11 mas 2020 sou Kod Pwosedi Penal la',
    revise: 'Décret du 11 mars 2020 portant Code de procédure pénale',
    index2020: null,
    fascicule: 'LM2025-SP44-A',
    numeroSpecial: '44-A',
    pdf: join(PDF_DIR, 'Le Moniteur Spécial No.44-A 24Juin 2025.pdf'),
    theme: 'procedure-penale',
    tetes: 1386,
    divisions: 252,
    signataires: 20,
    abrogation: 'art. 1365',
    keywords:
      'Code de procédure pénale; Code de procédure pénale révisé; Décret du 11 mars 2020; action publique; action civile; ' +
      'ministère public; police judiciaire; enquête; flagrance; garde à vue; juge d’instruction; juge des libertés; détention ' +
      'provisoire; contrôle judiciaire; mandat; chambre de l’instruction; cour d’assises; jury; tribunal correctionnel; appel; ' +
      'pourvoi en cassation; révision; extradition; entraide judiciaire; habeas corpus; casier judiciaire; libération conditionnelle; ' +
      'réhabilitation; frais de justice',
  },
}[code]

const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex')
const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`⛔ ${msg} — rien n'est écrit`)
}
const log = (s: string) => console.log(s)

async function main() {
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // 1. LES DONNÉES, ET LEURS CONTRÔLES — sans base
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  const corps = readFileSync(join(DIR, 'bodyOriginal.txt'), 'utf8').trimEnd()
  const brut = readFileSync(join(DIR, 'annotations.json'), 'utf8')
  const a = parseAnnotations(brut)
  ok(a, 'annotations.json illisible')
  const ann = a!
  const lignes = corps.split('\n')

  // Bornes du corps et signataires
  ok(lignes[0] === 'LIBERTÉ ÉGALITÉ FRATERNITÉ', `le corps commence par « ${lignes[0]} »`)
  ok(lignes[lignes.length - 1] === 'Jean Michel MOÏSE', 'le corps ne finit pas à la dernière signature')
  const pour = lignes.lastIndexOf('Pour le Conseil :')
  const signataires = lignes.slice(pour + 1).filter((_, i) => i % 2 === 1)
  ok(signataires.length === CFG.signataires, `${signataires.length} signataires au lieu de ${CFG.signataires}`)
  ok(!/LE MONITEUR|SOMMAIRE|NUMÉRO SPÉCIAL|Paraissant du Lundi|Achevé d’imprimer|<\/?[a-z_]+>/.test(corps), 'manchette, titre courant, colophon ou balise d’OCR resté dans le corps')
  ok(!corps.includes('\t') && !corps.includes("'"), 'tabulation ou apostrophe droite dans le corps')

  // Têtes d'article
  const tetes = lignes.filter((l) => /^Article\s*(?:1er|\d{1,4}(?:[.\-]\d{1,3})*)\s*\.?\s*-/.test(l))
  ok(tetes.length === CFG.tetes, `${tetes.length} têtes au lieu de ${CFG.tetes}`)
  // le tiret de tête n'est jamais suivi d'un chiffre : « Article 30-1.- » est un numéro composé, pas une tête collée
  ok(!/^Article\s*\d+(?:[.\-]\d+)*\s*\.?\s*-(?!\d)\S/m.test(corps), 'tête collée « Article N.-Texte »')
  if (code === 'cp') {
    ok(tetes.filter((t) => t.startsWith('Article 562.-')).length === 2 && !tetes.some((t) => /^Article (563|698)\b/.test(t)), 'C. pén. : 562 deux fois, ni 563 ni 698 (J.O.)')
    ok(tetes.some((t) => t.startsWith('Article 704- ')) && tetes.some((t) => t.startsWith('Article 752- ')), 'C. pén. : « Article 704- » et « Article 752- » sans point (J.O.)')
  }

  // Collation : chaque correction est dans le corps
  const corrections = (JSON.parse(readFileSync(join(DIR, 'corrections-jo.json'), 'utf8')) as { corrections: { id: string; apres: string }[] }).corrections
  for (const c of corrections) ok(corps.includes(c.apres.replace(/'/g, '’')), `correction ${c.id} absente du corps`)

  // Segmentation, sommaire, plages
  const blocs = segmentAnnotated(corps, ann.toc, ann.pointAnchors, ann.repeatedHeads)
  const sections = blocs.filter((b) => b.kind === 'section')
  ok(sections.length === ann.toc.length, `segmentation ${sections.length}/${ann.toc.length}`)
  ok(ann.toc.filter((t) => t.kind === 'code').length === CFG.divisions, 'nombre de divisions')
  const secs = ann.toc.map((t) => t.anchor)
  ok(new Set(secs).size === secs.length, 'ancre sec-N en double')
  const arts = blocs.filter((b) => b.kind === 'body' && b.anchor?.startsWith('art-')).map((b) => (b.kind === 'body' ? b.anchor! : ''))
  ok(arts.length === CFG.tetes && new Set(arts).size === CFG.tetes, `${arts.length} ancres d’article`)
  const labels = ann.labels ?? {}
  ok(Object.keys(labels).length === CFG.tetes && Object.keys(labels).every((k) => arts.includes(k)), 'libellés sans ancre')
  const noeuds: NavItem[] = []
  const parcourir = (n: NavItem) => {
    noeuds.push(n)
    for (const c of n.children ?? []) parcourir(c)
  }
  for (const g of ann.navToc) parcourir(g as NavItem)
  ok(noeuds.every((n) => secs.includes(n.anchor) && (!n.articlesAnchor || arts.includes(n.articlesAnchor))), 'ancre morte au sommaire')
  ok(!noeuds.some((n) => /\bp\.\s?\d/.test(`${n.label} ${n.articles ?? ''}`)), 'un numéro de page au sommaire')
  ok(noeuds.filter((n) => n.label !== 'Préambule').every((n) => n.articles), 'division sans plage')
  ok((ann.crossRefs ?? []).length === (code === 'cp' ? 2 : 0) && (ann.crossRefs ?? []).every((c) => secs.includes(c.anchor)), 'notes de division')

  // Index : présent, 0 lien mort
  ok(ann.indexEntries.length > 300, `index : ${ann.indexEntries.length} sujets seulement`)
  const renvois = ann.indexEntries.flatMap((e) => e.ctRefs.map(String))
  const morts = renvois.filter((r) => !arts.includes(articleAnchorFromNum(r)))
  ok(!morts.length, `index : ${morts.length} lien(s) mort(s) (${[...new Set(morts)].slice(0, 10).join(', ')})`)
  const couverts = new Set(renvois.map(articleAnchorFromNum))

  log(`✓ corps : ${lignes.length} lignes · ${corps.length.toLocaleString('fr-FR')} c. · de « LIBERTÉ ÉGALITÉ FRATERNITÉ » à « Jean Michel MOÏSE » · ${signataires.length} signataires`)
  log(`✓ têtes : ${tetes.length} · segmentation ${sections.length}/${ann.toc.length} · ${noeuds.length} entrées au sommaire, toutes à plage · ${corrections.length} corrections de collation dans le corps`)
  log(`✓ index : ${ann.indexEntries.length} sujets · ${renvois.length} renvois · 0 mort · couverture ${couverts.size}/${CFG.tetes}`)

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // 2. LA BASE — lecture seule jusqu'au --commit
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  const theme = await prisma.theme.findMany({ where: { slug: CFG.theme }, select: { id: true, slug: true } })
  ok(theme.length === 1, `thème ${CFG.theme} introuvable`)
  const existant = await prisma.document.findMany({ where: { source: CFG.source }, select: { id: true } })
  ok(existant.length <= 1, `${existant.length} fiches ${CFG.source}`)
  const fasc = await prisma.document.findMany({ where: { source: 'MONITEUR_PDF_2025', number: CFG.fascicule }, select: { id: true, titleFr: true } })
  ok(fasc.length === 1, `fascicule ${CFG.fascicule} : ${fasc.length}`)
  const report = await prisma.document.findMany({ where: { source: 'MONITEUR_PDF_2026', number: 'LM2026-SP5' }, select: { id: true, titleFr: true } })
  ok(report.length === 1, `fascicule LM2026-SP5 (décret de report) : ${report.length}`)
  const idx2020 = CFG.index2020 ? await prisma.document.findMany({ where: { type: 'INDEX', number: CFG.index2020, titleFr: 'Décret - Code Pénal' }, select: { id: true, titleFr: true } }) : []
  ok(!CFG.index2020 || idx2020.length === 1, `entrée d’Index ${CFG.index2020} : ${idx2020.length}`)
  const autre = await prisma.document.findMany({ where: { source: CFG.autre, type: 'LEGISLATION' }, select: { id: true, titleFr: true } })
  ok(existsSync(CFG.pdf), 'fac-similé introuvable')
  const pdf = readFileSync(CFG.pdf)
  log(`✓ base : thème ${CFG.theme} · fiche ${existant.length ? `EXISTANTE ${existant[0].id} (mise à jour)` : 'à créer'} · ${CFG.fascicule} ${fasc[0].id} · LM2026-SP5 ${report[0].id}${idx2020.length ? ` · Index ${CFG.index2020} ${idx2020[0].id}` : ''} · ${CFG.autre} ${autre[0]?.id ?? 'pas encore versé'}`)
  log(`✓ fac-similé : ${(pdf.length / 1e6).toFixed(1)} Mo · sha256 ${sha(pdf).slice(0, 16)}…`)

  const data = {
    type: 'LEGISLATION',
    status: 'PUBLIE',
    source: CFG.source,
    titleFr: CFG.titre,
    titleEn: CFG.titleEn,
    titleHt: CFG.titleHt,
    number: CFG.reference,
    matiere: 'penal',
    moniteurRef: `Le Moniteur, 180ᵉ Année – Spécial N° ${CFG.numeroSpecial}, mardi 24 juin 2025`,
    adoptionDate: new Date('2025-06-24T00:00:00Z'),
    publicationDate: new Date('2025-06-24T00:00:00Z'),
    effectiveDate: new Date('2027-01-01T00:00:00Z'),
    keywords: CFG.keywords,
    summaryFr:
      `${CFG.reference}, donné au Palais National par le Conseil Présidentiel de Transition et publié au Moniteur, 180ᵉ Année – ` +
      `Spécial N° ${CFG.numeroSpecial}, mardi 24 juin 2025. Le texte reprend en entier le code du 11 mars 2020, dans sa rédaction révisée ` +
      `(${CFG.tetes} articles). Il n’est pas encore en vigueur : le Décret du 24 décembre 2025 (Le Moniteur Spécial N° 5 du 16 février ` +
      `2026) fixe son entrée en vigueur intégrale au 1er janvier 2027, au terme d’une mise en œuvre en trois phases, après les reports de ` +
      `2022 et de 2024. Ses dispositions d’abrogation (${CFG.abrogation}) n’ont pas encore d’effet : aucun texte du corpus n’est marqué ` +
      `abrogé de ce fait. Le texte est celui du Journal officiel, à la lettre, y compris ses irrégularités` +
      (code === 'cp' ? ' (deux « Article 562 », pas d’article 698), signalées en note à leur place.' : '.') +
      ' L’index alphabétique est éditorial (Agora).',
    bodyOriginal: corps,
    annotationsJson: JSON.stringify(ann),
    richBlocksJson: null,
  }

  if (!COMMIT) {
    log('\n(à blanc — tous les contrôles passent ; --commit pour écrire)')
    return
  }

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // 3. ÉCRITURE
  // ══════════════════════════════════════════════════════════════════════════════════════════════
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
    const lien = await tx.documentTheme.findFirst({ where: { documentId: d.id, themeId: theme[0].id } })
    if (!lien) await tx.documentTheme.create({ data: { documentId: d.id, themeId: theme[0].id, isPrimary: true, assignedBy: 'IMPORT' } })
    await tx.crossRef.deleteMany({ where: { fromId: d.id } })
    let position = 0
    await tx.crossRef.create({ data: { fromId: d.id, toType: 'LEGISLATION', toNumber: CFG.revise, toLabel: CFG.revise, kind: 'MODIFIE', source: 'EDITORIAL', position: position++ } })
    await tx.crossRef.create({ data: { fromId: d.id, toId: fasc[0].id, toType: 'LEGISLATION', toLabel: fasc[0].titleFr, kind: 'VOIR', source: 'EDITORIAL', position: position++ } })
    await tx.crossRef.create({ data: { fromId: d.id, toId: report[0].id, toType: 'LEGISLATION', toLabel: report[0].titleFr, kind: 'VOIR', source: 'EDITORIAL', position: position++ } })
    if (idx2020.length) await tx.crossRef.create({ data: { fromId: d.id, toId: idx2020[0].id, toType: 'INDEX', toLabel: idx2020[0].titleFr, kind: 'VOIR', source: 'EDITORIAL', position: position++ } })
    if (autre.length) {
      await tx.crossRef.create({ data: { fromId: d.id, toId: autre[0].id, toType: 'LEGISLATION', toLabel: autre[0].titleFr, kind: 'VOIR', source: 'EDITORIAL', position: position++ } })
      const retour = await tx.crossRef.findFirst({ where: { fromId: autre[0].id, toId: d.id, kind: 'VOIR' } })
      if (!retour) await tx.crossRef.create({ data: { fromId: autre[0].id, toId: d.id, toType: 'LEGISLATION', toLabel: CFG.titre, kind: 'VOIR', source: 'EDITORIAL', position: 99 } })
    }
    return d
  }, { timeout: 120_000 })

  const urlPdf = await uploadToBlob(`source-pdf/legislation/${doc.id}.pdf`, pdf, 'application/pdf', { multipart: true })
  ok(isBlobUrl(urlPdf), 'téléversement Blob')
  await prisma.document.update({ where: { id: doc.id }, data: { sourcePdfUrl: urlPdf } })
  await reindexDocument(doc.id)
  await audit({ action: 'DOC_PUBLISHED', targetType: 'DOCUMENT', targetId: doc.id, meta: { via: '_import-codes-penaux-2025', source: CFG.source, decision: 'téléverser en législation annotée avant les renvois (17 oct. 2026)' } })

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // 4. RECOMPTE — après la transaction
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  const relu = await prisma.document.findUnique({ where: { id: doc.id }, select: { bodyOriginal: true, annotationsJson: true, sourcePdfUrl: true, status: true, effectiveDate: true, adoptionDate: true } })
  ok(relu && relu.bodyOriginal === corps && relu.annotationsJson === data.annotationsJson, 'relecture : contenu différent')
  ok(relu!.sourcePdfUrl === urlPdf && relu!.status === 'PUBLIE', 'relecture : fac-similé ou statut')
  ok(relu!.effectiveDate?.toISOString().startsWith('2027-01-01') && relu!.adoptionDate?.toISOString().startsWith('2025-06-24'), 'relecture : dates')
  const refs = await prisma.crossRef.groupBy({ by: ['kind'], where: { fromId: doc.id }, _count: true })
  const n = Object.fromEntries(refs.map((r) => [r.kind, r._count]))
  ok(n.MODIFIE === 1 && n.VOIR === 2 + idx2020.length + autre.length && !n.ABROGE, `relecture : renvois ${JSON.stringify(n)}`)
  const liens = await prisma.documentTheme.findMany({ where: { documentId: doc.id }, select: { isPrimary: true, theme: { select: { slug: true } } } })
  ok(liens.some((l) => l.isPrimary && l.theme.slug === CFG.theme), 'relecture : thème')
  const journal = await prisma.auditLog.count({ where: { targetId: doc.id, action: 'DOC_PUBLISHED' } })
  log(`\n✅ fiche ${existant.length ? 'mise à jour' : 'créée'} : ${doc.id}`)
  log(`   renvois : ${JSON.stringify(n)} · thème ${CFG.theme} · audit ${journal ? 'écrit' : '⚠️ ABSENT'} · fac-similé ${urlPdf.slice(0, 70)}…`)
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
