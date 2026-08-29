/**
 * CODE DE PROCÉDURE CIVILE D'HAÏTI — Livres I à X.
 * Voté par la Chambre Législative le 17 septembre 1963, promulgué le 17 janvier 1964.
 *
 * 1 040 articles (997 entiers + 43 décimaux de la partie arbitrage), 116 divisions sur
 * 5 niveaux, index de 1 060 entrées.
 *
 * ⚠️ Aucune mention d'édition, d'éditeur ni d'annotateur : la plateforme publie le TEXTE
 * DE LOI, non une édition commerciale.
 *
 * Les renvois au Code de procédure civile FRANÇAIS ont été retirés à l'extraction ; les
 * notes « Anc. art. N » (ancienne numérotation haïtienne) sont conservées — elles ne
 * produisent aucune ancre (vérifié).
 *
 * L'Appendice (114 textes annexés) et le répertoire de jurisprudence font l'objet de lots
 * ultérieurs. Idempotent (upsert par source).
 *   npx tsx scripts/_import-cpc.ts
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated, type Annotations, type TocEntry, type NavGroup, type ConnexeBlock } from '../src/lib/legislation/annotated'

const DIR = 'scripts/data/cpc'
const SOURCE = 'CODE_PROCEDURE_CIVILE'
const TITLE = 'Code de procédure civile d’Haïti'

interface Struct { toc: TocEntry[]; labels: Record<string, string>; amendes: Record<string, string> }

/** Clé de tri d'un numéro d'article : « 957-1 » après « 957 », avant « 958 ». */
function cle(n: string): [number, number] {
  const [a, b] = n.split('-')
  return [Number(a), b ? Number(b) : 0]
}

/** navToc : arbre des divisions, les articles en feuilles sous leur division. */
function buildNavToc(toc: TocEntry[], body: string): NavGroup[] {
  const racine: NavGroup = { label: TITLE, anchor: toc[0]?.anchor ?? 'art-1', children: [] }
  const parLabel = new Map(toc.map((t) => [t.label, t]))
  // pile des divisions ouvertes, par niveau
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
    const m = l.match(/^Article\s+(\d{1,4}(?:-\d{1,2})?)(?:er)?\s*(?:\([^)]*\))?\s*\.\-/)
    if (!m) continue
    const n = m[1]
    const item = { label: n === '1' ? 'Article 1er' : `Article ${n}`, anchor: `art-${n}` }
    ;(pile.length ? pile[pile.length - 1].noeud.children : racine.children).push(item)
  }
  return [racine]
}

async function main() {
  const body = readFileSync(`${DIR}/bodyOriginal.txt`, 'utf8').trimEnd()
  const st = JSON.parse(readFileSync(`${DIR}/structure.json`, 'utf8')) as Struct
  const idx = JSON.parse(readFileSync(`${DIR}/index.json`, 'utf8')) as Record<string, string[]>

  // ── Contrôles bloquants ──
  const blocks = segmentAnnotated(body, st.toc)
  const secs = blocks.filter((b) => b.kind === 'section').length
  const anchors = new Set(blocks.filter((b: any) => b.kind === 'body' && b.anchor).map((b: any) => b.anchor))
  if (secs !== st.toc.length) throw new Error(`segmentation ${secs}/${st.toc.length} — annulé`)
  const orph = Object.keys(st.labels).filter((a) => !anchors.has(a))
  if (orph.length) throw new Error(`libellés sans article : ${orph.slice(0, 6).join(', ')} — annulé`)
  const morts = Object.values(idx).flat().filter((n) => !anchors.has(`art-${n}`))
  if (morts.length) throw new Error(`index : renvois morts ${[...new Set(morts)].slice(0, 8).join(', ')} — annulé`)
  // ⚠️ Le « \b » de JavaScript est ASCII : dans « frères », le « è » compte comme une
  // frontière de mot, si bien que /\bfr\b/ y voit le mot « fr ». Bornes Unicode explicites.
  if (/(?<!\p{L})fr(?!\p{L})/u.test(body)) throw new Error('renvoi au Code français résiduel dans le corps — annulé')
  const entiers = Object.keys(st.labels).map((k) => k.replace('art-', '')).filter((n) => !n.includes('-'))
  if (entiers.length !== 997) throw new Error(`articles entiers : ${entiers.length}/997 — annulé`)
  console.log(`✓ contrôles : ${secs} divisions · ${anchors.size} articles (997 entiers + ${anchors.size - 997} décimaux) · index ${Object.keys(idx).length} entrées, 0 mort · 0 renvoi français`)

  // ── Thème « Procédure civile », créé sous DROIT CIVIL s'il n'existe pas ──
  // ⚠️ Il naissait sous « justice », en Droit public. Me Vaval l'a fait passer sous Droit civil le
  // 28 août 2026 (« la procédure civile doit aller sous droit civil »), et le thème « justice » a
  // été SUPPRIMÉ le même jour. Rétablir l'ancien parent recréerait un thème mort.
  const droitCivil = await prisma.theme.findFirst({ where: { slug: 'droit-civil' } })
  if (!droitCivil) throw new Error('thème droit-civil introuvable')
  let pc = await prisma.theme.findFirst({ where: { slug: 'procedure-civile' } })
  if (!pc) {
    const max = await prisma.theme.aggregate({ where: { parentId: droitCivil.id }, _max: { position: true } })
    pc = await prisma.theme.create({
      data: {
        slug: 'procedure-civile', parentId: droitCivil.id, position: (max._max.position ?? 0) + 1,
        labelFr: 'Procédure civile', labelEn: 'Civil procedure', labelHt: 'Pwosedi sivil',
      },
    })
    console.log(`✓ thème créé : Droit civil → « ${pc.labelFr} »`)
  } else console.log(`✓ thème existant : « ${pc.labelFr} »`)
  const dc = await prisma.theme.findFirst({ where: { slug: 'droit-civil' } })
  if (!dc) throw new Error('thème droit-civil introuvable')

  // ── Annotations ──
  const coll = new Intl.Collator('fr', { sensitivity: 'base' })
  const connexe: Record<string, ConnexeBlock[]> = {}
  const status: Record<string, string> = {}
  for (const [ancre, mention] of Object.entries(st.amendes)) {
    status[ancre] = 'modifié'
    connexe[ancre] = [{
      label: `Article modifié — ${mention}`,
      text: `Le présent article a été modifié par : ${mention}. La rédaction affichée est celle en `
        + `vigueur ; le texte antérieur ne figure pas au document publié au Journal Officiel.`,
    }]
  }

  const ann: Annotations & Record<string, unknown> = {
    title: TITLE, annotationAuthor: '',
    navToc: buildNavToc(st.toc, body),
    toc: st.toc,
    connexes: [], jurisprudence: {},
    indexEntries: Object.entries(idx)
      .map(([subject, refs]) => ({ subject, ctRefs: [...refs].sort((a, b) => cle(a)[0] - cle(b)[0] || cle(a)[1] - cle(b)[1]) }))
      .sort((a, b) => coll.compare(a.subject, b.subject)),
    labels: st.labels,
    status, connexe,
  }

  const data = {
    type: 'LEGISLATION' as const, status: 'EN_VIGUEUR' as const,
    titleFr: TITLE,
    titleEn: 'Code of Civil Procedure of Haiti',
    titleHt: 'Kòd pwosedi sivil peyi d’Ayiti',
    number: 'Code de procédure civile',
    matiere: 'procedure-civile',
    moniteurRef: 'Voté par la Chambre Législative le 17 septembre 1963 · promulgué le 17 janvier 1964',
    publicationDate: new Date('1964-01-17'),
    keywords: 'procédure civile; juge de paix; tribunal civil; exploit; ajournement; citation; exception; '
      + 'jugement; opposition; appel; cassation; saisie-arrêt; saisie-exécution; saisie immobilière; '
      + 'péremption d’instance; référé; scellés; inventaire; partage; licitation; arbitrage; '
      + 'clause compromissoire; compromis; sentence arbitrale; huissier; défenseur; ministère public',
    summaryFr: 'Code de procédure civile d’Haïti, voté par la Chambre Législative le 17 septembre 1963 et '
      + 'promulgué le 17 janvier 1964 : 1 040 articles en dix Livres — procédure devant la justice de paix, '
      + 'tribunaux civils (exploits, exceptions, jugements, voies de recours), procédures d’exécution '
      + '(saisies mobilière et immobilière, distribution), procédures particulières (scellés, inventaire, '
      + 'partage, licitation, reddition de comptes), et arbitrage interne et international. '
      + 'Les articles 717 à 728 ont été modifiés par la loi du 12 septembre 1966, l’article 18 par la loi du '
      + '18 septembre 1985 et le décret du 22 août 1995, l’article 813 par le décret du 29 mai 1968.',
    bodyOriginal: body,
    annotationsJson: JSON.stringify(ann),
    source: SOURCE,
  }

  const ex = await prisma.document.findFirst({ where: { source: SOURCE }, select: { id: true } })
  const doc = ex ? await prisma.document.update({ where: { id: ex.id }, data })
                 : await prisma.document.create({ data: { ...data, originalLang: 'fr' } })
  for (const t of [pc, dc]) {
    if (!(await prisma.documentTheme.findFirst({ where: { documentId: doc.id, themeId: t.id } })))
      await prisma.documentTheme.create({ data: { documentId: doc.id, themeId: t.id, isPrimary: t.id === pc.id, assignedBy: 'IMPORT' } })
  }
  await reindexDocument(doc.id)
  console.log(`✓ ${ex ? 'mis à jour' : 'créé'} : ${doc.id} · ${Object.keys(status).length} articles « modifié » · thèmes « ${pc.labelFr} » + « ${dc.labelFr} »`)
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
