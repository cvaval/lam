/**
 * DÉCRET SÛRETÉS — L'ENTRÉE EN VIGUEUR EST LE 9 AVRIL 2020 (décision de Me Vaval, 27 août 2026).
 *
 *     npx tsx scripts/entree-en-vigueur-suretes.ts            # simulation
 *     npx tsx scripts/entree-en-vigueur-suretes.ts --apply    # Me Vaval, elle seule
 *
 * La question § 13.1 du prompt est TRANCHÉE : le décret n'a aucune clause d'entrée en vigueur
 * (art. 21 = clause balai, vérifié sur pièce), et la fiche portait par déduction la date de
 * publication (14 mai 2020). Me Vaval a arrêté la position de la plateforme : l'entrée en
 * vigueur est le **9 avril 2020**, la date de l'acte.
 *
 * CE QUE ÇA TOUCHE — la date vit à TROIS endroits, tous alignés d'un seul geste :
 *   · Document du décret : `effectiveDate` 2020-05-14 → 2020-04-09 ;
 *   · les ArticleVersion écrites par la réforme (amendedByDocId = le décret) : 23 au Code
 *     civil (overlay de juillet) + 6 au Code de commerce (hier) = 29 lignes, toutes au
 *     14 mai → 9 avril.
 * La version « MODIFIE » de l'art. 600 (l'ancien texte archivé, sans amendedBy, date NULL)
 * n'est PAS touchée : c'est l'état d'avant, il n'a pas de date de réforme.
 * AUCUN corps, AUCUN annotationsJson n'est modifié — ni Code civil, ni Code de commerce.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'

const APPLY = process.argv.includes('--apply')
const AVANT = '2020-05-14', APRES = '2020-04-09'

async function main() {
  const dec = await prisma.document.findFirst({
    where: { source: 'DECRET_SURETES' },
    select: { id: true, titleFr: true, effectiveDate: true, adoptionDate: true },
  })
  if (!dec) throw new Error('DECRET_SURETES introuvable')
  if (dec.effectiveDate?.toISOString().slice(0, 10) !== AVANT)
    throw new Error(`effectiveDate du décret : ${dec.effectiveDate?.toISOString().slice(0, 10)} — attendu ${AVANT}. L'état n'est pas celui du relevé.`)
  if (dec.adoptionDate?.toISOString().slice(0, 10) !== APRES)
    throw new Error(`adoptionDate : ${dec.adoptionDate?.toISOString().slice(0, 10)} — la décision s'appuie sur la date de l'acte, qui devrait être ${APRES}`)

  const av = await prisma.articleVersion.findMany({
    where: { amendedByDocId: dec.id },
    select: { id: true, documentId: true, anchor: true, effectiveDate: true },
  })
  if (av.length === 0) throw new Error('aucune ArticleVersion liée au décret — le relevé en attendait 29')
  const horsDate = av.filter((v) => v.effectiveDate?.toISOString().slice(0, 10) !== AVANT)
  if (horsDate.length)
    throw new Error(`${horsDate.length} version(s) ne portent pas ${AVANT} (${horsDate.map((v) => v.anchor).join(', ')}) — vérifier avant d'écraser`)
  const parDoc = new Map<string, number>()
  for (const v of av) parDoc.set(v.documentId, (parDoc.get(v.documentId) ?? 0) + 1)

  console.log(`✓ décret ${dec.id} · effectiveDate ${AVANT} → ${APRES} (adoption ${APRES} — cohérent)`)
  console.log(`✓ ${av.length} ArticleVersion à aligner :`)
  for (const [id, n] of parDoc) {
    const d = await prisma.document.findUnique({ where: { id }, select: { titleFr: true } })
    console.log(`    ${n} sur « ${d!.titleFr.slice(0, 50)} »`)
  }
  console.log('  (la version MODIFIE de l’art. 600 — ancien texte, sans amendedBy — n’est pas touchée)')
  console.log('  AUCUN corps, AUCUN annotationsJson modifié.')

  if (!APPLY) {
    console.log('\nSIMULATION — rien n’a été écrit. --apply est réservé à Me Vaval.')
    await prisma.$disconnect()
    return
  }

  const horo = new Date().toISOString().replace(/[:.]/g, '-')
  const fichierEtat = join(process.cwd(), 'scripts/data/decret-suretes', `etat-anterieur-vigueur-${horo}.json`)
  writeFileSync(fichierEtat, JSON.stringify({ decret: { id: dec.id, effectiveDate: AVANT }, articleVersions: av }, null, 2))
  console.log(`\nétat antérieur : ${fichierEtat}`)

  await prisma.$transaction(async (tx) => {
    await tx.document.update({ where: { id: dec.id }, data: { effectiveDate: new Date(APRES) } })
    const r = await tx.articleVersion.updateMany({
      where: { id: { in: av.map((v) => v.id) } },
      data: { effectiveDate: new Date(APRES) },
    })
    if (r.count !== av.length) throw new Error(`${r.count} versions mises à jour, ${av.length} attendues — annulé`)
    await audit({
      action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: dec.id,
      meta: { source: 'DECRET_SURETES',
        motif: `Entrée en vigueur arrêtée au ${APRES} (décision de Me Vaval, 27 août 2026 — le décret n'a aucune clause d'entrée en vigueur ; la date de l'acte fait foi, pas celle de la publication). ${av.length} ArticleVersion alignées (Code civil + Code de commerce).`,
        fichierEtatAnterieur: fichierEtat, versions: av.length },
    }, tx)
  }, { timeout: 120_000, maxWait: 30_000 })

  const journalise = await prisma.auditLog.count({ where: { targetId: dec.id, action: 'ARTICLE_AMENDED' } })
  await reindexDocument(dec.id)
  console.log(`✓ écrit · AuditLog ARTICLE_AMENDED sur le décret : ${journalise} (recompté) · réindexé`)
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error('ÉCHEC :', e instanceof Error ? e.message : e); await prisma.$disconnect(); process.exit(1) })
