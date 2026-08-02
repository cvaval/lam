/**
 * DEUX MANQUES COMBLÉS DU DROIT ÉCONOMIQUE.
 *
 * 1. LOI DU 10 JUILLET 2002 SUR LES COOPÉRATIVES D'ÉPARGNE ET DE CRÉDIT — document NOUVEAU
 *    (151 articles). C'est le fondement légal des dix normes CEC de la BRH déjà publiées :
 *    sans elle, qui lit la norme sur la capitalisation ne peut pas remonter au texte qui
 *    l'autorise. Rangée en « Banques & institutions financières ».
 *
 * 2. LES DEUX TEXTES SUR LES COMPAGNIES D'ASSURANCE, repris du JOURNAL OFFICIEL. Ils
 *    figuraient déjà, mais d'après l'édition Vandal du Code de commerce : la loi de 1956 en
 *    22 articles au lieu de 23, et le décret de 1981 réduit à un EXTRAIT de deux articles —
 *    l'édition le disait elle-même en tête. Mis à jour EN PLACE (mêmes `source`, donc mêmes
 *    URL), et « Assurances » devient leur thème PRINCIPAL : la sous-section existait sous
 *    « Droit économique & des affaires » mais ne servait qu'en second rang, derrière
 *    « Droit commercial ».
 *
 * Idempotent.  npx tsx scripts/_import-cec-assurances.ts [--check]
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { articleAnchorFromHeading } from '../src/lib/doc/anchors'
import { segmentAnnotated, parseAnnotations, type Annotations, type TocEntry, type NavGroup, type ConnexeBlock } from '../src/lib/legislation/annotated'

const CEC = 'scripts/data/cec'
const ASS = 'scripts/data/assurances'

interface Texte {
  source: string; titre: string; moniteur: string; date: string
  corps: string; labels: Record<string, string>; notes: Record<string, string[]>
}

/** navToc : arbre des divisions, les articles en feuilles — enrichis de leur rubrique. */
function buildNavToc(titre: string, toc: TocEntry[], body: string, labels: Record<string, string>,
                     rubriques: Record<string, string> = {}): NavGroup[] {
  const racine: NavGroup = { label: titre, anchor: toc[0]?.anchor ?? Object.keys(labels)[0], children: [] }
  const parLabel = new Map(toc.map((t) => [t.label, t]))
  const pile: { level: number; noeud: any }[] = []
  for (const raw of body.split('\n')) {
    const l = raw.trim()
    const t = parLabel.get(l)
    if (t) {
      const noeud = { label: l, anchor: t.anchor, children: [] as any[] }
      while (pile.length && pile[pile.length - 1].level >= t.level) pile.pop()
      ;(pile.length ? pile[pile.length - 1].noeud.children : racine.children).push(noeud)
      pile.push({ level: t.level, noeud })
      continue
    }
    const a = articleAnchorFromHeading(l)
    if (!a || !labels[a]) continue
    const n = a.replace('art-', '')
    const r = rubriques[n]
    ;(pile.length ? pile[pile.length - 1].noeud.children : racine.children)
      .push({ label: r ? `${labels[a]} — ${r}` : labels[a], anchor: a })
  }
  return [racine]
}

function controler(source: string, body: string, toc: TocEntry[], labels: Record<string, string>, attendu: number) {
  const blocks = segmentAnnotated(body, toc)
  const secs = blocks.filter((b) => b.kind === 'section').length
  if (secs !== toc.length) throw new Error(`${source} : segmentation ${secs}/${toc.length} — annulé`)
  const anchors = blocks.filter((b: any) => b.kind === 'body' && b.anchor).map((b: any) => b.anchor as string)
  if (blocks.some((b: any) => b.kind === 'body' && b.noAnchors)) throw new Error(`${source} : article sans ancre — annulé`)
  if (new Set(anchors).size !== anchors.length) throw new Error(`${source} : ancres dupliquées — annulé`)
  const orph = Object.keys(labels).filter((a) => !anchors.includes(a))
  if (orph.length) throw new Error(`${source} : libellés sans article ${orph.slice(0, 5).join(', ')} — annulé`)
  if (anchors.length !== attendu) throw new Error(`${source} : ${anchors.length}/${attendu} articles — annulé`)
  console.log(`✓ ${source.padEnd(22)} ${anchors.length} articles · ${secs} divisions`)
  return anchors
}

async function main() {
  // ── Loi CEC 2002 ──
  const cecBody = readFileSync(`${CEC}/bodyOriginal.txt`, 'utf8').trimEnd()
  const cecSt = JSON.parse(readFileSync(`${CEC}/structure.json`, 'utf8')) as { toc: TocEntry[]; labels: Record<string, string> }
  const cecRub = JSON.parse(readFileSync(`${CEC}/rubriques.json`, 'utf8')) as Record<string, string>
  const cecIdx = JSON.parse(readFileSync(`${CEC}/index.json`, 'utf8')) as Record<string, string[]>
  const cecAnchors = controler('LOI_CEC_2002', cecBody, cecSt.toc, cecSt.labels, 151)
  const morts = Object.values(cecIdx).flat().filter((n) => !cecAnchors.includes(`art-${n}`))
  if (morts.length) throw new Error(`index CEC : renvois morts ${[...new Set(morts)].slice(0, 8).join(', ')} — annulé`)

  // ── Assurances ──
  const assur = JSON.parse(readFileSync(`${ASS}/textes.json`, 'utf8')) as Texte[]
  for (const t of assur) controler(t.source, t.corps, [], t.labels, Object.keys(t.labels).length)

  console.log(`  index CEC : ${Object.keys(cecIdx).length} entrées · ${Object.values(cecIdx).flat().length} renvois, 0 mort`)
  if (process.argv.includes('--check')) {
    console.log('— mode contrôle : rien n’a été écrit')
    return prisma.$disconnect()
  }

  const bancaire = await prisma.theme.findFirst({ where: { slug: 'droit-bancaire' } })
  const assurances = await prisma.theme.findFirst({ where: { slug: 'assurances' } })
  if (!bancaire || !assurances) throw new Error('thèmes droit-bancaire / assurances introuvables')

  // ── 1. La loi CEC ──
  const coll = new Intl.Collator('fr', { sensitivity: 'base' })
  const annCec: Annotations & Record<string, unknown> = {
    title: 'Loi du 10 juillet 2002 sur les coopératives d’épargne et de crédit',
    annotationAuthor: '',
    navToc: buildNavToc('Loi du 10 juillet 2002 sur les coopératives d’épargne et de crédit',
                        cecSt.toc, cecBody, cecSt.labels, cecRub),
    toc: cecSt.toc,
    connexes: [], jurisprudence: {},
    indexEntries: Object.entries(cecIdx)
      .map(([subject, refs]) => ({ subject, ctRefs: [...refs].sort((a, b) => Number(a) - Number(b)) }))
      .sort((a, b) => coll.compare(a.subject, b.subject)),
    labels: cecSt.labels, status: {}, connexe: {},
  }
  const cecData = {
    type: 'LEGISLATION' as const, status: 'EN_VIGUEUR' as const,
    titleFr: 'Loi du 10 juillet 2002 sur les coopératives d’épargne et de crédit',
    titleEn: 'Law of 10 July 2002 on savings and credit cooperatives',
    titleHt: 'Lwa 10 jiyè 2002 sou koperativ epay ak kredi',
    number: 'Loi du 10 juillet 2002',
    matiere: 'droit-bancaire',
    moniteurRef: 'Le Moniteur n° 54 du mercredi 10 juillet 2002 — numéro extraordinaire',
    publicationDate: new Date('2002-07-10T00:00:00Z'),
    keywords: 'coopérative d’épargne et de crédit; CEC; caisse populaire; sociétaire; part sociale; '
      + 'acte constitutif; assemblée générale; conseil d’administration; conseil de surveillance; '
      + 'comité de crédit; BRH; CNC; DIGCP; fédération; caisse centrale; épargne; crédit; '
      + 'intermédiation financière; capitalisation; liquidation; administrateur provisoire; '
      + 'vérification; agrément; supervision',
    summaryFr: 'Loi du 10 juillet 2002 portant sur la constitution, l’organisation, le contrôle et la '
      + 'surveillance des coopératives d’épargne et de crédit (CEC), communément appelées caisses '
      + 'populaires : 151 articles en sept titres — définitions et principes coopératifs, organes de '
      + 'réglementation et de supervision (BRH, CNC, fédérations), constitution et agrément, '
      + 'sociétariat et parts sociales, organes de la coopérative, opérations d’épargne et de crédit, '
      + 'normes prudentielles, redressement, administration provisoire et liquidation. C’est le '
      + 'fondement légal des normes CEC de la Banque de la République d’Haïti.',
    bodyOriginal: cecBody,
    annotationsJson: JSON.stringify(annCec),
    source: 'LOI_CEC_2002',
  }
  const exCec = await prisma.document.findFirst({ where: { source: 'LOI_CEC_2002' }, select: { id: true } })
  const docCec = exCec
    ? await prisma.document.update({ where: { id: exCec.id }, data: cecData, select: { id: true } })
    : await prisma.document.create({ data: { ...cecData, originalLang: 'fr' }, select: { id: true } })
  if (!(await prisma.documentTheme.findFirst({ where: { documentId: docCec.id, themeId: bancaire.id } })))
    await prisma.documentTheme.create({ data: { documentId: docCec.id, themeId: bancaire.id, isPrimary: true, assignedBy: 'IMPORT' } })
  await reindexDocument(docCec.id)
  console.log(`✓ LOI_CEC_2002 ${exCec ? 'mise à jour' : 'créée'} : 151 articles · thème « ${bancaire.labelFr} »`)

  // ── 2. Les deux textes d'assurance ──
  for (const t of assur) {
    const ex = await prisma.document.findFirst({ where: { source: t.source }, select: { id: true, bodyOriginal: true } })
    if (!ex) throw new Error(`${t.source} introuvable`)
    const avant = (ex.bodyOriginal.match(/^Article\s+\d/gm) ?? []).length

    const connexe: Record<string, ConnexeBlock[]> = {}
    for (const [ancre, notes] of Object.entries(t.notes)) {
      if (ancre === 'doc') continue
      connexe[ancre] = notes.map((n) => ({ label: 'Note sur la source imprimée', text: n }))
    }
    const ancien = parseAnnotations((await prisma.document.findUnique({ where: { id: ex.id }, select: { annotationsJson: true } }))!.annotationsJson)
    const ann: Annotations & Record<string, unknown> = {
      ...(ancien ?? { annotationAuthor: '', connexes: [], jurisprudence: {}, indexEntries: [], toc: [] } as any),
      title: t.titre,
      navToc: buildNavToc(t.titre, [], t.corps, t.labels),
      toc: [], labels: t.labels, connexe, status: {},
    }
    const nArt = Object.keys(t.labels).length
    await prisma.document.update({
      where: { id: ex.id },
      data: {
        titleFr: t.titre,
        bodyOriginal: t.corps,
        annotationsJson: JSON.stringify(ann),
        moniteurRef: t.moniteur,
        publicationDate: new Date(`${t.date}T00:00:00Z`),
        matiere: 'assurances',
        summaryFr: `${t.titre} — texte intégral d’après le Journal Officiel : ${nArt} articles, `
          + `publiés au ${t.moniteur}.`
          + (t.notes['doc']?.length ? ` ${t.notes['doc'].join(' ')}` : ''),
      },
    })
    // « Assurances » devient le thème PRINCIPAL ; « Droit commercial » reste en second.
    // DocumentTheme a une clé COMPOSITE (documentId, themeId), pas d'`id` propre.
    const liens = await prisma.documentTheme.findMany({ where: { documentId: ex.id }, select: { themeId: true } })
    for (const l of liens)
      await prisma.documentTheme.update({
        where: { documentId_themeId: { documentId: ex.id, themeId: l.themeId } },
        data: { isPrimary: l.themeId === assurances.id },
      })
    if (!liens.some((l) => l.themeId === assurances.id))
      await prisma.documentTheme.create({ data: { documentId: ex.id, themeId: assurances.id, isPrimary: true, assignedBy: 'IMPORT' } })
    await reindexDocument(ex.id)
    console.log(`✓ ${t.source} : ${avant} → ${nArt} articles · thème principal « ${assurances.labelFr} »`)
  }

  const n = await prisma.documentTheme.count({ where: { themeId: assurances.id } })
  console.log(`\n« ${assurances.labelFr} » (sous Droit économique & des affaires) : ${n} document(s)`)
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
