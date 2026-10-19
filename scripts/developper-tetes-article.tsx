/**
 * « Art. » → « Article » en tête d'article, dans TOUTE la Législation annotée (Me Vaval, 18 oct. 2026 : « remplacer
 * Art par Article » — portée « Partout (Législation annotée) »).
 *
 * Portée : les fiches qui ont des annotations (lecteur annoté) ; dans chacune, les lignes du corps que le lecteur tient
 * DÉJÀ pour une tête d'article (`articleAnchorFromHeading`, hors lignes d'en-tête de la table), la 1re ligne des
 * `ArticleVersion` et des anciennes rédactions (`annotations.oldVersions`). Les annotations (jurisprudence, renvois,
 * textes connexes cités) ne bougent pas : ce sont des citations.
 *   « Art. 14 Tous ceux… » → « Article 14 Tous ceux… » · « Art. 1er.- … » → « Article 1er.- … » · « Art 269 Const… » →
 *   « Article 269 Const… ». Le reste de la ligne est inchangé.
 *
 * Garde-fous, par fiche (refus d'écrire la fiche si l'un échoue) : même nombre de lignes ; même suite d'ancres
 * d'article ; mêmes ancres de section et mêmes clés d'annotation (`segmentAnnotated`) ; rendu du lecteur : même nombre
 * de liens. Instantané de chaque fiche écrit AVANT (hors dépôt) : `<dossier>/<id>.json`.
 *
 *     npx tsx --tsconfig <tsconfig jsx> scripts/developper-tetes-article.tsx <dossier instantanés> [--commit]
 */
import { PrismaClient } from '@prisma/client'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { AnnotatedText } from '../src/components/AnnotatedText'
import { parseAnnotations, segmentAnnotated, type Annotations } from '../src/lib/legislation/annotated'
import { articleAnchorFromHeading } from '../src/lib/doc/anchors'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const DOSSIER = process.argv.slice(2).find((a) => !a.startsWith('--'))
const COMMIT = process.argv.includes('--commit')
/** `--reindexer id1,id2` : fiches écrites dont la réindexation a échoué (une reprise ne les revoit pas : rien à écrire). */
const REINDEXER = process.argv[process.argv.indexOf('--reindexer') + 1]
const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
const ART = /^Art\.?\s*(?=1\s*er\b|\d)/
/** Réseau instable (18 oct. : 33 % de paquets perdus) : trois essais, espacés. */
async function essayer<T>(f: () => Promise<T>, n = 3): Promise<T> {
  for (let k = 1; ; k++) {
    try { return await f() } catch (e) { if (k >= n) throw e; await new Promise((r) => setTimeout(r, 20_000 * k)) }
  }
}

/** « Art. 14 Tous… » → « Article 14 Tous… », si la ligne est une tête d'article pour le lecteur. */
function developper(ligne: string): string {
  if (!ART.test(ligne) || !articleAnchorFromHeading(norm(ligne))) return ligne
  return ligne.replace(ART, 'Article ')
}

async function main() {
  if (!DOSSIER) throw new Error('usage : developper-tetes-article.tsx <dossier instantanés> [--commit]')
  mkdirSync(DOSSIER, { recursive: true })
  if (process.argv.includes('--reindexer')) {
    for (const id of (REINDEXER ?? '').split(',').filter(Boolean)) {
      try { await essayer(() => reindexDocument(id)); console.log(`✓ ${id} réindexée`) } catch { console.log(`✗ ${id} : réindexation impossible`) }
    }
    return
  }
  // Les identifiants d'abord, puis une fiche à la fois : tout charger d'un coup (corps + annotations de toutes les
  // fiches annotées) fait tomber la connexion du pooler (« Server has closed the connection », 18 oct.).
  // Les plus petites d'abord : le Code civil (2 Mo) passe en dernier, une panne de réseau n'arrête pas les autres.
  const ids = (await essayer(() => prisma.$queryRawUnsafe<{ id: string }[]>(
    `select id from "Document" where "annotationsJson" is not null and "bodyOriginal" like '%Art%' order by length("bodyOriginal") + length("annotationsJson")`,
  )))
  let fiches = 0, tetes = 0, versions = 0, anciennes = 0, refus = 0
  const echecs: string[] = []
  const aReindexer: string[] = []
  const journal: Record<string, unknown>[] = []
  for (const { id } of ids) {
    let d
    try {
      d = await essayer(() => prisma.document.findUniqueOrThrow({ where: { id }, select: { id: true, type: true, source: true, titleFr: true, bodyOriginal: true, annotationsJson: true } }))
    } catch (e) { echecs.push(id); console.log(`✗ ${id} : lecture impossible`); continue }
    const a0 = parseAnnotations(d.annotationsJson)
    if (!a0) continue
    const table = new Set(a0.toc.map((t) => norm(t.label)))
    const L0 = (d.bodyOriginal ?? '').split('\n')
    let n = 0
    const L1 = L0.map((l) => { if (table.has(norm(l))) return l; const t = developper(l); if (t !== l) n++; return t })
    const vs = await essayer(() => prisma.articleVersion.findMany({ where: { documentId: d.id }, select: { id: true, body: true } }))
    const vs1 = vs.map((v) => { const [p, ...r] = v.body.split('\n'); return { ...v, nb: [developper(p), ...r].join('\n') } }).filter((v) => v.nb !== v.body)
    const brut = JSON.parse(d.annotationsJson!) as Record<string, any>
    let nOld = 0
    for (const k of Object.keys(brut.oldVersions ?? {})) {
      const [p, ...r] = String(brut.oldVersions[k]).split('\n')
      const nb = [developper(p), ...r].join('\n')
      if (nb !== brut.oldVersions[k]) { brut.oldVersions[k] = nb; nOld++ }
    }
    if (!n && !vs1.length && !nOld) continue
    const body1 = L1.join('\n'), json1 = JSON.stringify(brut)
    const a1 = parseAnnotations(json1)!
    // ── Garde-fous ──
    const erreurs: string[] = []
    if (L1.length !== L0.length) erreurs.push('nombre de lignes')
    const ancres = (L: string[]) => L.map((l) => (/^Art/i.test(l.trim()) ? articleAnchorFromHeading(norm(l)) : undefined)).filter(Boolean).join(' ')
    if (ancres(L0) !== ancres(L1)) erreurs.push("ancres d'article")
    const sig = (b: string, a: Annotations) => segmentAnnotated(b, a.toc, a.pointAnchors, a.repeatedHeads).map((x: any) => `${x.kind}:${x.anchor ?? ''}:${x.jurisKey ?? ''}`).join('|')
    if (sig(d.bodyOriginal ?? '', a0) !== sig(body1, a1)) erreurs.push('segmentation (sections, clés)')
    const liens = (b: string, a: Annotations) => (renderToStaticMarkup(<AnnotatedText text={b} annotations={a} locale="fr" linkArtRefs hideInlineIndex linkCivRefs={d.source === 'CODE_CIVIL_ANNOTE'} />).match(/href="/g) ?? []).length
    const l0 = liens(d.bodyOriginal ?? '', a0), l1 = liens(body1, a1)
    if (l1 < l0) erreurs.push(`liens ${l0} → ${l1}`)
    journal.push({ id: d.id, source: d.source, titre: (d.titleFr ?? '').slice(0, 70), tetes: n, versions: vs1.length, anciennes: nOld, liens: [l0, l1], erreurs })
    if (erreurs.length) { refus++; console.log(`⛔ ${d.source} — ${erreurs.join(', ')}`); continue }
    fiches++; tetes += n; versions += vs1.length; anciennes += nOld
    if (!COMMIT) continue
    writeFileSync(join(DOSSIER, `${d.id}.json`), JSON.stringify({ id: d.id, source: d.source, bodyOriginal: d.bodyOriginal, annotationsJson: d.annotationsJson, versions: vs }))
    // ⚠️ 18 oct. : le pooler a décroché en pleine écriture du Code civil (transaction expirée après 440 s, ANNULÉE).
    // Délai long, et une fiche en échec n'arrête pas les autres : le script est rejouable (il repart de l'état en base).
    try {
      await essayer(() => prisma.$transaction(async (tx) => {
        await tx.document.update({ where: { id: d.id }, data: { bodyOriginal: body1, annotationsJson: json1 } })
        for (const v of vs1) await tx.articleVersion.update({ where: { id: v.id }, data: { body: v.nb } })
      }, { timeout: 600_000, maxWait: 60_000 }))
      // Écrite : un échec de la réindexation ne doit plus la compter comme « à rejouer » (elle ne serait pas revue).
      try { await essayer(() => reindexDocument(d.id)) } catch { aReindexer.push(d.id); console.log(`⚠ ${d.source} : écrite, réindexation à reprendre`) }
      await audit({ action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: d.id, meta: { via: 'developper-tetes-article', tetes: n, versions: vs1.length, anciennes: nOld, decision: '« Art. » → « Article » — Me Vaval, 18 oct. 2026' } })
      console.log(`✓ ${d.source} : ${n} tête(s), ${vs1.length} version(s), ${nOld} ancienne(s)`)
    } catch (e) {
      echecs.push(d.source ?? d.id)
      console.log(`✗ ${d.source} : ${String(e instanceof Error ? e.message : e).split('\n').filter(Boolean).slice(-1)[0]?.slice(0, 160)}`)
    }
  }
  writeFileSync(join(DOSSIER, `journal-${COMMIT ? 'ecrit' : 'a-blanc'}.json`), JSON.stringify(journal, null, 1))
  console.log(`${fiches} fiche(s) ${COMMIT ? 'traitées' : 'à écrire'} — ${tetes} tête(s), ${versions} version(s), ${anciennes} ancienne(s) rédaction(s) ; refus : ${refus} ; échecs d'écriture : ${echecs.length}${echecs.length ? ' (' + echecs.join(', ') + ') — rejouer' : ''}`)
  if (aReindexer.length) console.log(`À réindexer : --reindexer ${aReindexer.join(',')}`)
  if (!COMMIT) console.log('(à blanc — --commit pour écrire)')
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
