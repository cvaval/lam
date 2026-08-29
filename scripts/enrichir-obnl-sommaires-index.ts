/**
 * OBNL — poser les SOMMAIRES et les INDEX fournis par Me Vaval le 28 août 2026.
 *
 *     npx tsx scripts/enrichir-obnl-sommaires-index.ts            # simulation
 *     npx tsx scripts/enrichir-obnl-sommaires-index.ts --apply    # Me Vaval, elle seule
 *
 * Pièces : `Sommaire_Loi_23_juillet_1934.docx`, `Sommaire_Loi_19_septembre_1953.docx`,
 * `Sommaire_Decret_ONG_1989.docx`, `Index_mots-cles_Fondations.docx`, `index_decret_ONG_1989.md`.
 * « pas de sommaire ni index pour celui sur la reconnaissance d'utilité publique » — la loi de
 * 1921 n'est donc pas touchée.
 *
 * ─── CE QUE LE SOMMAIRE DE LA CLIENTE A RÉVÉLÉ ─────────────────────────────────────────────
 * Le décret de 1989 porte DEUX sections à l'intérieur du chapitre 4 — « SECTION 1 : Des
 * Prérogatives » et « SECTION 2 : Des Obligations » — que le versement de la veille avait
 * manquées : mon relevé cherchait « ^Section » quand le Journal officiel écrit en CAPITALES.
 * Le sommaire compte donc 9 entrées, pas 7.
 *
 * ─── OÙ VA QUOI, ET POURQUOI ───────────────────────────────────────────────────────────────
 *  · `toc` = les en-têtes RÉELS du corps. `segmentAnnotated` les reconnaît par égalité de
 *    ligne : un libellé qui ne figure pas mot pour mot dans le corps ne s'afficherait jamais.
 *    Les libellés sont donc RELUS DANS LE CORPS, jamais recopiés du sommaire.
 *  · `indexEntries` = sujet → articles. Y vont L'INDEX (mots-clés) ET le SOMMAIRE analytique :
 *    les lois de 1934 et 1953 n'ont aucun en-tête de section, leur sommaire ne peut pas être un
 *    `toc`, et il EST une table sujet → article.
 *  · `labels` reste du NUMÉROTAGE PUR. Mesuré avant de décider : sur 1 414 libellés du corpus
 *    (CEC, IR 2005, Code de procédure civile, UCREF), AUCUN ne dépasse 22 caractères. Y glisser
 *    le titre du sommaire romprait une convention de corpus et ferait passer de l'éditorial
 *    pour de l'officiel.
 *
 * ⚠️ L'INDEX DES FONDATIONS EST À DEUX COLONNES — un index multi-textes. Chaque mot-clé renvoie
 * aux articles de la loi de 1934 ET à ceux de celle de 1953. Sur chaque fiche, la colonne du
 * texte courant devient `ctRefs`, l'autre devient `docRefs` (liens /doc/{id}#art-N).
 * ⚠️ Les PARENTHÈSES sont des gloses, pas des renvois : « art. 1 (art. 17 nouveau) » vise
 * l'article 1 de la loi de 1953, pas son article 17 — elle n'en a que trois.
 * ⚠️ Les LETTRES sont des alinéas : « art. 8 a », « art. 16 h, k, l » visent les articles 8 et 16.
 */
import { prisma } from '../src/lib/db'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { audit } from '../src/lib/auth/audit'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated } from '../src/lib/legislation/annotated'

const APPLY = process.argv.includes('--apply')
const D = join(process.cwd(), 'scripts/data/obnl')
const lire = (f: string) => JSON.parse(readFileSync(join(D, f), 'utf8'))

type Somm = { subject: string; art: number }
type Fond = { subject: string; r34: number[]; r53: number[] }
type Idx = { subject: string; ctRefs: number[]; docRefs?: { label: string; id: string; anchor: string }[] }

const SEC_RE = /^(CHAPITRE|Chapitre)\s+\d|^SECTION\s+\d/

async function main() {
  const somm: { s34: Somm[]; s53: Somm[]; s89: Somm[] } = lire('sommaires.json')
  const fond: Fond[] = lire('idx-fondations.json')
  const idxOng: Idx[] = lire('idx-ong.json')
  if (somm.s34.length !== 19 || somm.s53.length !== 5 || somm.s89.length !== 39)
    throw new Error(`sommaires : ${somm.s34.length}/${somm.s53.length}/${somm.s89.length}, attendus 19/5/39. STOP`)
  if (fond.length !== 43) throw new Error(`index fondations : ${fond.length} entrées, 43 attendues. STOP`)
  if (idxOng.length !== 137) throw new Error(`index ONG : ${idxOng.length} entrées, 137 attendues. STOP`)

  const docs = await prisma.document.findMany({
    where: { source: { in: ['OBNL_LOI_FONDATIONS_1934', 'OBNL_LOI_FONDATIONS_1953', 'OBNL_DECRET_ONG_1989'] } },
    select: { id: true, source: true, bodyOriginal: true, annotationsJson: true },
  })
  if (docs.length !== 3) throw new Error(`${docs.length} fiches trouvées, 3 attendues. STOP`)
  const par = (s: string) => docs.find((d) => d.source === s)!
  const d34 = par('OBNL_LOI_FONDATIONS_1934'), d53 = par('OBNL_LOI_FONDATIONS_1953'), d89 = par('OBNL_DECRET_ONG_1989')

  /** Ancres RÉELLEMENT rendues par le lecteur — c'est contre elles qu'on valide les renvois. */
  const ancresDe = (d: (typeof docs)[number]) => {
    const a = JSON.parse(String(d.annotationsJson ?? '{}'))
    const b: { anchor?: string | null }[] = segmentAnnotated(d.bodyOriginal ?? '', a.toc ?? [])
    return { ann: a, ancres: new Set(b.map((x) => x.anchor).filter(Boolean) as string[]) }
  }
  const A34 = ancresDe(d34), A53 = ancresDe(d53), A89 = ancresDe(d89)

  // ── Le sommaire du décret ONG révèle 9 en-têtes : on les RELIT DANS LE CORPS ──
  const têtes = (d89.bodyOriginal ?? '').split('\n').filter((l) => SEC_RE.test(l.trim()))
  if (têtes.length !== 9) throw new Error(`décret ONG : ${têtes.length} en-têtes dans le corps, 9 attendus (7 chapitres + 2 sections). STOP`)
  const toc89 = têtes.map((label, i) => ({ level: /^SECTION/.test(label.trim()) ? 2 : 1, label, anchor: `sec-${i + 1}`, kind: 'code' }))
  const navToc89: { label: string; anchor: string; children: { label: string; anchor: string }[] }[] = []
  for (const t of toc89) {
    if (t.level === 1) navToc89.push({ label: t.label, anchor: t.anchor, children: [] })
    else navToc89[navToc89.length - 1]?.children.push({ label: t.label, anchor: t.anchor })
  }

  const lien = (art: number[], id: string, label: string) => art.map((n) => ({ label: `${label}, art. ${n}`, id, anchor: `art-${n}` }))
  const idx34: Idx[] = [
    ...somm.s34.map((s) => ({ subject: s.subject, ctRefs: [s.art] })),
    ...fond.filter((f) => f.r34.length).map((f) => ({
      subject: f.subject, ctRefs: f.r34,
      ...(f.r53.length ? { docRefs: lien(f.r53, d53.id, 'L. 19 sept. 1953') } : {}),
    })),
  ]
  const idx53: Idx[] = [
    ...somm.s53.map((s) => ({ subject: s.subject, ctRefs: [s.art] })),
    ...fond.filter((f) => f.r53.length).map((f) => ({
      subject: f.subject, ctRefs: f.r53,
      ...(f.r34.length ? { docRefs: lien(f.r34, d34.id, 'L. 23 juill. 1934') } : {}),
    })),
  ]
  const idx89: Idx[] = [...somm.s89.map((s) => ({ subject: s.subject, ctRefs: [s.art] })), ...idxOng]

  // ⚠️ TOUT renvoi doit viser une ancre QUI EXISTE. Un index qui pointe dans le vide est pire
  // qu'un index absent : il promet une navigation qui ne mène nulle part.
  const valider = (nom: string, l: Idx[], ancres: Set<string>) => {
    const morts = l.flatMap((e) => e.ctRefs.filter((n) => !ancres.has(`art-${n}`)).map((n) => `${e.subject} → art. ${n}`))
    if (morts.length) throw new Error(`${nom} : ${morts.length} renvoi(s) mort(s) — ${morts.slice(0, 3).join(' · ')}. STOP`)
    const dm = l.flatMap((e) => (e.docRefs ?? []).map((r) => r.anchor))
    return { entrées: l.length, renvois: l.reduce((s, e) => s + e.ctRefs.length, 0), croisés: dm.length }
  }
  const c34 = valider('1934', idx34, A34.ancres)
  const c53 = valider('1953', idx53, A53.ancres)
  const c89 = valider('1989', idx89, A89.ancres)
  // Les renvois croisés doivent viser des ancres de l'AUTRE fiche.
  for (const [nom, l, cible] of [['1934→1953', idx34, A53.ancres], ['1953→1934', idx53, A34.ancres]] as const) {
    const morts = l.flatMap((e) => (e.docRefs ?? []).filter((r) => !cible.has(r.anchor)).map((r) => r.label))
    if (morts.length) throw new Error(`renvois croisés ${nom} : ${morts.length} mort(s) — ${morts.slice(0, 3).join(' · ')}. STOP`)
  }

  console.log(`décret ONG : sommaire ${toc89.length} entrées (${toc89.filter((t) => t.level === 1).length} chapitres + ${toc89.filter((t) => t.level === 2).length} sections)`)
  for (const t of toc89) console.log(`   ${'  '.repeat(t.level - 1)}${t.label.trim().slice(0, 88)}`)
  console.log(`\nindex :`)
  console.log(`   1934 : ${c34.entrées} entrées · ${c34.renvois} renvois · ${c34.croisés} renvois croisés vers 1953`)
  console.log(`   1953 : ${c53.entrées} entrées · ${c53.renvois} renvois · ${c53.croisés} renvois croisés vers 1934`)
  console.log(`   1989 : ${c89.entrées} entrées · ${c89.renvois} renvois`)
  console.log(`   aucun renvoi mort · la loi de 1921 n’est pas touchée (ni sommaire ni index fournis)`)

  if (!APPLY) { console.log('\nSIMULATION — rien n’a été écrit.'); await prisma.$disconnect(); return }

  await prisma.$transaction(async (tx) => {
    for (const [d, A, entries, toc, nav] of [
      [d34, A34, idx34, undefined, undefined],
      [d53, A53, idx53, undefined, undefined],
      [d89, A89, idx89, toc89, navToc89],
    ] as const) {
      const ann = { ...A.ann, indexEntries: entries, ...(toc ? { toc, navToc: nav } : {}) }
      await tx.document.update({ where: { id: d.id }, data: { annotationsJson: JSON.stringify(ann) } })
    }
    await audit({
      action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: 'OBNL_SOMMAIRES_INDEX',
      meta: {
        motif:
          'Sommaires et index fournis par Me Vaval le 28 août 2026, posés sur les trois textes des ' +
          'fondations et des ONG (la loi de 1921 n’en a pas). Le sommaire du décret de 1989 a révélé ' +
          'DEUX sections en capitales à l’intérieur du chapitre 4, manquées au versement de la veille : ' +
          'le sommaire passe de 7 à 9 entrées. L’index des fondations est à deux colonnes : sur chaque ' +
          'fiche, la colonne du texte courant devient ctRefs, l’autre des docRefs vers l’autre loi. ' +
          'Les libellés d’article restent du numérotage pur, conformément au corpus.',
        entrees1934: c34.entrées, entrees1953: c53.entrées, entrees1989: c89.entrées, sommaireOng: toc89.length,
      },
    }, tx)
  }, { timeout: 120_000, maxWait: 30_000 })

  const journal = await prisma.auditLog.count({ where: { targetId: 'OBNL_SOMMAIRES_INDEX' } })
  for (const d of [d34, d53, d89]) await reindexDocument(d.id)
  const ctrl = await prisma.document.findMany({ where: { source: { startsWith: 'OBNL_' } }, select: { source: true, annotationsJson: true, searchText: true } })
  console.log(`\n✓ AuditLog ${journal} (recompté) · 3 documents réindexés`)
  for (const d of ctrl) {
    const a = JSON.parse(String(d.annotationsJson ?? '{}'))
    console.log(`  ${d.source?.padEnd(32)} toc ${String((a.toc ?? []).length).padStart(2)} · index ${String((a.indexEntries ?? []).length).padStart(3)} · libellés ${Object.keys(a.labels ?? {}).length}`)
  }
  await prisma.$disconnect()
}

main().catch(async (e) => {
  const m = e instanceof Error ? e.message : String(e)
  console.error('ÉCHEC :', m.trim() ? m : e)
  await prisma.$disconnect(); process.exit(1)
})
