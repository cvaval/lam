/**
 * LA LOI SUR L'ORDRE DES AVOCATS EST DU 24 JUIN 1932 — visa 36 du Code fiscal de 2026, tranché le
 * 17 oct. 2026 sur la règle de Me Vaval : « la date d'entrée effective de la loi est celle du vote
 * de la dernière chambre ».
 *
 * Pièce : Bulletin des lois et actes, année 1932, édition officielle (Imprimerie de l'État),
 * p. 166-172 — Dropbox `Moniteur/Lois_18_20/1932-N.pdf`, p. 168-174 du PDF, lues sur l'image :
 *   · Sénat — « Donné à la Maison Nationale à Port-au-Prince, le 6 Mai 1932, an 129ème de
 *     l'Indépendance » (Président du Sénat : Denis St-Aude) ;
 *   · Chambre des députés — « Fait à la Chambre des Députés, à Port-au-Prince, le 24 Juin 1932,
 *     an 128ème de l'Indépendance » (Président : Dr Jh. Loubeau) : DERNIER VOTE ;
 *   · promulgation — « Donné au Palais National, à Port-au-Prince le 29 Juillet 1932 » (Sténio
 *     Vincent ; Secrétaire d'État de la Justice : E. Lescot).
 * Le J.O. dit de même : le Décret du 29 mars 1979 paraît au Moniteur n° 31 du 16 avril 1979 sous
 * le titre « Décret révisant la Loi du 24 Juin 1932… » (Index du Moniteur, LM1979-31), comme le
 * citent le Moniteur n° 76-B d'oct. 1989, le Code fiscal de 2026 et la Cassation (28 juin 1976 ;
 * Me Joseph Auguste, 1989 : « l'article 26 de la loi du 24 juin 1932 »).
 *
 * Seule la fiche de l'Appendice III.2 du Code de procédure civile disait « 6 mai 1932 » — la date
 * du Sénat, premier vote. On corrige l'appareil éditorial : titre, résumé, appareil (titre et
 * sommaire), libellé du renvoi du visa 36. Le corps n'est pas touché (il ne porte pas la date) ;
 * la transcription du Moniteur n° 212 de 2013, qui cite « la loi du 6 mai 1932 » dans un visa, est
 * le J.O. : elle reste telle quelle.
 *
 *     npx tsx scripts/corriger-date-loi-avocats-1932.ts            # à blanc
 *     npx tsx scripts/corriger-date-loi-avocats-1932.ts --commit   # écrit, sauvegarde l'état antérieur
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { parseAnnotations, segmentAnnotated } from '../src/lib/legislation/annotated'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const COMMIT = process.argv.includes('--commit')
const SOURCE = 'CPC_APPENDICE_III_2_1'
const AVANT = 'loi du 6 mai 1932'
const APRES = 'loi du 24 juin 1932'

const compter = (s: string | null | undefined, x: string) => (s ? s.split(x).length - 1 : 0)
const remplacer = (s: string, n: number, champ: string) => {
  if (compter(s, AVANT) !== n) stop(`${champ} : ${compter(s, AVANT)} occurrence(s) au lieu de ${n}`)
  return s.split(AVANT).join(APRES)
}
const stop = (m: string): never => {
  throw new Error(`⛔ ${m} — rien n'est écrit`)
}

async function main() {
  const fiches = await prisma.document.findMany({ where: { source: SOURCE } })
  if (fiches.length !== 1) stop(`${fiches.length} fiche(s) de source ${SOURCE} au lieu d'une`)
  const f = fiches[0]
  if (f.bodyOriginal.includes('1932') || f.bodyClean?.includes('1932')) stop('le corps porte la date : non prévu')
  const nAnn = compter(f.annotationsJson, AVANT)
  console.log(`fiche ${f.id} « ${f.titleFr} »`)
  console.log(`   titre ${compter(f.titleFr, AVANT)} · résumé ${compter(f.summaryFr, AVANT)} · appareil ${nAnn} · corps 0`)
  const titleFr = remplacer(f.titleFr, 1, 'titre')
  const summaryFr = remplacer(f.summaryFr ?? '', 1, 'résumé')
  if (nAnn < 1) stop('appareil : la date n’y est pas')
  const annotationsJson = remplacer(f.annotationsJson!, nAnn, 'appareil')
  const a = parseAnnotations(annotationsJson)
  if (!a) stop('appareil illisible après correction')
  const avant = parseAnnotations(f.annotationsJson)!
  const seg = (corps: string, x: NonNullable<typeof a>) => segmentAnnotated(corps, x.toc, x.pointAnchors).map((b) => b.anchor).join(',')
  if (seg(f.bodyOriginal, avant) !== seg(f.bodyOriginal, a!)) stop('la segmentation change')

  const renvois = await prisma.crossRef.findMany({ where: { toId: f.id, toLabel: { contains: AVANT } }, select: { id: true, fromId: true, toLabel: true } })
  console.log(`renvois dont le libellé porte la date : ${renvois.length}`)
  for (const r of renvois) console.log(`   → ${r.id} depuis ${r.fromId}`)
  const ailleurs = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) n FROM "Document" WHERE id <> ${f.id}
    AND type NOT IN ('INDEX', 'JURISPRUDENCE') AND (source IS NULL OR source NOT LIKE 'MONITEUR_PDF_%')
    AND ("titleFr" ILIKE '%6 mai 1932%' OR number ILIKE '%6 mai 1932%' OR "summaryFr" ILIKE '%6 mai 1932%' OR "annotationsJson" ILIKE '%6 mai 1932%')`
  if (Number(ailleurs[0].n)) stop(`${ailleurs[0].n} autre(s) fiche(s) éditoriale(s) portent « 6 mai 1932 » : à examiner d'abord`)
  console.log(`   titre corrigé : « ${titleFr} »`)
  if (!COMMIT) {
    console.log('\n(à blanc — --commit pour écrire)')
    return
  }

  const journal = join(process.cwd(), `docs/livraison-code-fiscal-2026/etat-anterieur-loi-avocats-1932-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  writeFileSync(journal, JSON.stringify({ fiche: { id: f.id, titleFr: f.titleFr, summaryFr: f.summaryFr, annotationsJson: f.annotationsJson }, renvois }, null, 1))
  await prisma.$transaction(async (tx) => {
    await tx.document.update({ where: { id: f.id }, data: { titleFr, summaryFr, annotationsJson } })
    for (const r of renvois) await tx.crossRef.update({ where: { id: r.id }, data: { toLabel: r.toLabel!.split(AVANT).join(APRES) } })
  }, { timeout: 120_000 })
  await reindexDocument(f.id)
  await audit({ action: 'DOC_PUBLISHED', targetType: 'DOCUMENT', targetId: f.id, meta: { via: 'corriger-date-loi-avocats-1932', correction: 'loi du 6 mai 1932 → loi du 24 juin 1932 (dernier vote : Chambre des députés)', renvois: renvois.length, decision: 'date d’entrée effective = vote de la dernière chambre (17 oct. 2026)' } })

  const relu = await prisma.document.findUnique({ where: { id: f.id }, select: { titleFr: true, summaryFr: true, annotationsJson: true } })
  const reste = compter(relu?.titleFr, AVANT) + compter(relu?.summaryFr, AVANT) + compter(relu?.annotationsJson, AVANT)
  const resteRenvois = await prisma.crossRef.count({ where: { toId: f.id, toLabel: { contains: AVANT } } })
  if (reste || resteRenvois || !relu?.titleFr.includes(APRES)) stop(`recompte : ${reste} occurrence(s) et ${resteRenvois} renvoi(s) à l'ancienne date`)
  console.log(`\n✅ écrit et recompté (0 « ${AVANT} » restant) — état antérieur : ${journal}`)
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
