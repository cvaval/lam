/**
 * CODE DE PROCÉDURE CIVILE — le corps ne garde plus que la LOI.
 *
 * Le texte publié jusqu'ici mêlait trois matières que l'imprimé distingue à l'œil : les
 * articles, les notes de jurisprudence et les renvois de marge à l'ancienne numérotation.
 * Le lecteur voyait 1 137 extraits d'arrêts coulés dans le fil des articles, et 765 lignes
 * « Anc. art. 78 » entre deux alinéas. Tout cela passe en annotations repliables :
 *
 *   corps          5 543 → 1 955 lignes — articles, divisions, rien d'autre
 *   jurisprudence  1 287 notes sur 249 articles, citant 908 arrêts
 *   ancienne num.  771 articles, dont 2 portent deux numéros anciens
 *
 * Le discriminant est l'ITALIQUE du .docx, que le scan confirme (p. 40) : articles en
 * romain, jurisprudence en italique. Aucune règle de forme n'y aurait suffi — 122 lignes
 * « N.- » en romain sont de vraies énumérations d'articles, et 58 articles portent un arrêt
 * sans extrait numéroté.
 *
 * Contrôle de conservation exécuté avant écriture : chaque ligne de l'ancien corps se
 * retrouve soit au nouveau corps, soit dans les annotations. Aucune ligne inventée.
 *
 * Idempotent.  npx tsx scripts/_import-cpc-jurisprudence.ts [--check]
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated, parseAnnotations, type JurisCase } from '../src/lib/legislation/annotated'

const DIR = 'scripts/data/cpc'
const SOURCE = 'CODE_PROCEDURE_CIVILE'

interface Note { n: number | null; excerpt: string; refs: string[] }

async function main() {
  const body = readFileSync(`${DIR}/bodyOriginal.txt`, 'utf8').trimEnd()
  const st = JSON.parse(readFileSync(`${DIR}/structure.json`, 'utf8')) as {
    toc: { level: number; label: string; anchor: string; kind: string }[]
    labels: Record<string, string>
    amendes: Record<string, string>
  }
  const juris = JSON.parse(readFileSync(`${DIR}/jurisprudence.json`, 'utf8')) as Record<string, Note[]>
  const anciens = JSON.parse(readFileSync(`${DIR}/anciens.json`, 'utf8')) as Record<string, string[]>

  const ex = await prisma.document.findFirst({ where: { source: SOURCE }, select: { id: true, bodyOriginal: true, annotationsJson: true } })
  if (!ex) throw new Error(`${SOURCE} introuvable`)
  const ancien = parseAnnotations(ex.annotationsJson)
  if (!ancien) throw new Error('annotations actuelles illisibles — annulé')

  // ── Contrôles bloquants ──
  const blocks = segmentAnnotated(body, st.toc)
  const secs = blocks.filter((b) => b.kind === 'section').length
  if (secs !== st.toc.length) throw new Error(`segmentation ${secs}/${st.toc.length} — annulé`)
  const anchors = new Set(blocks.filter((b: any) => b.kind === 'body' && b.anchor).map((b: any) => b.anchor as string))
  if (anchors.size !== 1040) throw new Error(`${anchors.size}/1040 articles — annulé`)
  const orph = Object.keys(st.labels).filter((a) => !anchors.has(a))
  if (orph.length) throw new Error(`libellés sans article : ${orph.slice(0, 5).join(', ')} — annulé`)

  // Les clés de jurisprudence sont « sec-K|art-N » : elles doivent tomber sur les couples
  // que le LECTEUR calcule lui-même, sinon les notes s'affichent sous le mauvais article —
  // ou nulle part.
  const attendues = new Set(blocks.filter((b: any) => b.kind === 'body' && b.jurisKey).map((b: any) => b.jurisKey as string))
  const perdues = Object.keys(juris).filter((k) => !attendues.has(k))
  if (perdues.length) throw new Error(`clés de jurisprudence sans article : ${perdues.slice(0, 5).join(', ')} — annulé`)
  const ancOrph = Object.keys(anciens).filter((a) => !anchors.has(a))
  if (ancOrph.length) throw new Error(`ancienne numérotation sur un article inexistant : ${ancOrph.slice(0, 5).join(', ')} — annulé`)

  // Le corps ne doit plus rien contenir de l'appareil.
  const restes = body.split('\n').filter((l) => /^(Cass\b|Anc\.? art)/i.test(l.trim()))
  if (restes.length) throw new Error(`appareil résiduel dans le corps : ${restes.length} lignes — annulé`)
  if (/(?<!\p{L})fr(?!\p{L})/u.test(body)) throw new Error('renvoi au Code français résiduel — annulé')

  // Conservation : toute ligne de l'ANCIEN corps doit se retrouver quelque part.
  const norm = (s: string) => s.replace(/^\d{1,2}\s*\.\-\s*/, '').replace(/\s+/g, ' ').trim()
  const gardees = new Set(body.split('\n').map(norm).filter(Boolean))
  const enAnnexe = new Set<string>()
  for (const notes of Object.values(juris))
    for (const nt of notes) {
      nt.excerpt.split('\n').forEach((x) => x.trim() && enAnnexe.add(norm(x)))
      nt.refs.forEach((r) => enAnnexe.add(norm(r)))
    }
  const evapore = ex.bodyOriginal.split('\n').map(norm).filter(Boolean)
    .filter((l) => !gardees.has(l) && !enAnnexe.has(l) && !/^Anc\.? art/i.test(l))
  // Douze lignes légitimes s'en vont : fragments de concordance française restés seuls
  // (« [Art 75,] », « Art 158, 3e al ») et deux notes du transcripteur sur son édition.
  if (evapore.length > 15) throw new Error(`${evapore.length} lignes perdues — annulé\n${evapore.slice(0, 8).join('\n')}`)

  const nNotes = Object.values(juris).reduce((s, v) => s + v.length, 0)
  const nArrets = Object.values(juris).reduce((s, v) => s + v.reduce((t, i) => t + i.refs.length, 0), 0)
  console.log(`✓ contrôles : ${anchors.size} articles · ${secs} divisions · ${Object.keys(juris).length} articles annotés`)
  console.log(`  ${nNotes} notes (${nArrets} arrêts cités) · ${Object.keys(anciens).length} renvois d’ancienne numérotation`)
  console.log(`  corps ${ex.bodyOriginal.split('\n').length} → ${body.split('\n').length} lignes · ${evapore.length} lignes écartées`)
  if (process.argv.includes('--check')) {
    console.log('— mode contrôle : rien n’a été écrit')
    return prisma.$disconnect()
  }

  // ── Annotations ──
  const jurisprudence: Record<string, JurisCase[]> = {}
  for (const [cle, notes] of Object.entries(juris))
    jurisprudence[cle] = notes.map((nt) => ({ ref: nt.refs.join(' · '), excerpt: nt.excerpt }))

  // L'ancienne numérotation rejoint le pliable « Annotations », au bas de l'article : c'est
  // une note d'édition, non du texte de loi. Elle ne doit surtout pas devenir une ancre —
  // le Code est cité par douze autres documents sous sa numérotation ACTUELLE.
  const commentaires: Record<string, string[]> = {}
  for (const [ancre, nums] of Object.entries(anciens))
    commentaires[ancre] = [nums.length > 1
      ? `Ancienne numérotation : articles ${nums.slice(0, -1).join(', ')} et ${nums[nums.length - 1]}.`
      : `Ancienne numérotation : article ${nums[0]}.`]

  const ann = { ...ancien, toc: st.toc, labels: st.labels, jurisprudence, commentaires }
  const doc = await prisma.document.update({
    where: { id: ex.id },
    data: { bodyOriginal: body, annotationsJson: JSON.stringify(ann) },
    select: { id: true },
  })
  await reindexDocument(doc.id)
  console.log(`✓ ${SOURCE} mis à jour : corps allégé de l’appareil, ${nNotes} notes et ${Object.keys(anciens).length} renvois en annotation`)
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
