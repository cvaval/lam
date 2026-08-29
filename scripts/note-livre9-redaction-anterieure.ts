/**
 * LIVRE IX — dire au lecteur CE QUI A ÉTÉ CHERCHÉ, et non seulement ce qui manque.
 *
 *     npx tsx scripts/note-livre9-redaction-anterieure.ts            # simulation
 *     npx tsx scripts/note-livre9-redaction-anterieure.ts --apply    # Me Vaval, elle seule
 *
 * Le 28 août, la note posée sur l'en-tête du Livre IX disait que la rédaction antérieure à 2005
 * « n'est pas au corpus ». C'était exact mais court : elle ne disait pas si on avait cherché.
 * Recherche menée le 29 août 2026, à la demande de Me Vaval, et close par elle (« il n'est pas
 * dans le corpus ») :
 *   · CORPUS — un seul document porte un article 955 d'arbitrage : le Code, en rédaction de 2005 ;
 *     les 116 textes de l'Appendice sont des satellites ; les 9 entrées d'Index sur l'arbitrage
 *     d'avant 2006 visent la Commission Tripartite ou des conventions internationales ;
 *   · DISQUE — 1 769 PDF balayés (Moniteur, lois haïti, Lesgislation, Cabinet Salès). UN SEUL
 *     contient « peuvent compromettre » : `Moniteur/Code_procedure_civile-pdf.pdf`, 567 pages —
 *     et c'est encore la rédaction de 2005 (son art. 956 est identique) ;
 *   · `scripts/data/cpc/anciens.json` ne porte que d'anciennes NUMÉROTATIONS (771 articles),
 *     aucune entre 955 et 980 ;
 *   · le fichier « NOUVEAU CODE DE PROCEDURE CIVILE » du Cabinet Salès est le Code FRANÇAIS,
 *     tiré de Légifrance — faux ami écarté.
 *
 * ⚠️ Une note qui dit « nous ne l'avons pas » invite à chercher de nouveau. Une note qui dit
 * « voici ce qui a été cherché » évite à la prochaine session de refaire 1 769 lectures.
 */
import { prisma } from '../src/lib/db'
import { audit } from '../src/lib/auth/audit'
import { reindexDocument } from '../src/lib/search/reindex'
import { createHash } from 'node:crypto'

const APPLY = process.argv.includes('--apply')
const ANCIENNE_AMORCE = 'Livre IX réformé en entier par le Décret du 28 décembre 2005'

const NOUVELLE =
  'Livre IX réformé en entier par le Décret du 28 décembre 2005 (Le Moniteur n° 32 du 3 avril 2006) : ' +
  'les articles 955 à 980 « se liront désormais comme suit », et 43 articles décimaux y ont été ' +
  'ajoutés. Le texte ci-dessous est celui de 2005. ' +
  '⚠️ LA RÉDACTION ANTÉRIEURE EST INTROUVABLE, ET ELLE A ÉTÉ CHERCHÉE. Les articles portant la ' +
  'pastille « modifié » n’ouvrent donc aucun repli — non qu’il n’y ait rien à replier, mais parce ' +
  'que la pièce manque. Recherche du 29 août 2026 : dans le corpus, un seul document porte un ' +
  'article 955 d’arbitrage, ce Code lui-même en rédaction de 2005 ; les textes de l’Appendice sont ' +
  'des satellites, et les entrées d’Index sur l’arbitrage d’avant 2006 visent la Commission ' +
  'Tripartite de Consultation et d’Arbitrage ou des conventions internationales. Hors corpus, ' +
  '1 769 fascicules et recueils numérisés ont été balayés : un seul porte la formule « peuvent ' +
  'compromettre », et c’est encore la rédaction de 2005. ' +
  'La pièce à acquérir est une édition du Code de procédure civile imprimée AVANT 2006 : elle ' +
  'seule rendrait aux vingt-six articles leur ancienne rédaction. Le jour où elle arrivera, les ' +
  'replis s’ajouteront sans rien défaire de ce qui est ici.'

async function main() {
  const d = await prisma.document.findFirst({ where: { source: 'CODE_PROCEDURE_CIVILE' }, select: { id: true, bodyOriginal: true, annotationsJson: true } })
  if (!d) throw new Error('CODE_PROCEDURE_CIVILE introuvable. STOP')
  const empreinte = createHash('md5').update(d.bodyOriginal ?? '').digest('hex')
  const ann = JSON.parse(String(d.annotationsJson ?? '{}'))
  const cr: { anchor: string; note?: string }[] = Array.isArray(ann.crossRefs) ? ann.crossRefs : []
  const i = cr.findIndex((x) => (x.note ?? '').startsWith(ANCIENNE_AMORCE))
  if (i < 0) throw new Error(`la note du Livre IX est introuvable ou a changé (${cr.length} renvois éditoriaux). STOP`)
  if (cr[i].note === NOUVELLE) { console.log('note déjà à jour — rien à faire.'); await prisma.$disconnect(); return }

  const st = ann.status ?? {}
  const mod = Object.values(st).filter((x) => x === 'modifié').length
  const neu = Object.values(st).filter((x) => x === 'nouveau').length
  if (neu !== 43) throw new Error(`${neu} pastilles « nouveau », 43 attendues — l’état n’est plus celui du 28 août. STOP`)

  console.log(`renvoi éditorial n° ${i} sur l’ancre « ${cr[i].anchor} »`)
  console.log(`  AVANT (${cr[i].note?.length} car.) : …${(cr[i].note ?? '').slice(-190)}`)
  console.log(`\n  APRÈS (${NOUVELLE.length} car.) : …${NOUVELLE.slice(-460)}`)
  console.log(`\n  pastilles inchangées : ${mod} « modifié » · ${neu} « nouveau »`)
  console.log(`  corps : INTACT (${empreinte.slice(0, 10)})`)
  if (!APPLY) { console.log('\nSIMULATION — rien n’a été écrit.'); await prisma.$disconnect(); return }

  const neufs = cr.map((x, k) => (k === i ? { ...x, note: NOUVELLE } : x))
  await prisma.$transaction(async (tx) => {
    await tx.document.update({ where: { id: d.id }, data: { annotationsJson: JSON.stringify({ ...ann, crossRefs: neufs }) } })
    await audit({
      action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: 'CPC_LIVRE_IX_2005',
      meta: {
        motif:
          'Note de l’en-tête du Livre IX enrichie : elle disait que la rédaction antérieure à 2005 ' +
          'n’était pas au corpus ; elle dit désormais CE QUI A ÉTÉ CHERCHÉ — corpus, 1 769 PDF ' +
          'numérisés, anciens.json, et le faux ami du Code français de Légifrance — et NOMME la pièce ' +
          'à acquérir : une édition du Code imprimée avant 2006. Recherche demandée par Me Vaval le ' +
          '29 août 2026 et close par elle (« il n’est pas dans le corpus »). Aucune pastille, aucune ' +
          'ligne de corps n’est touchée.',
      },
    }, tx)
  }, { timeout: 120_000, maxWait: 30_000 })

  const journal = await prisma.auditLog.count({ where: { targetId: 'CPC_LIVRE_IX_2005' } })
  await reindexDocument(d.id)
  const ap = await prisma.document.findUnique({ where: { id: d.id }, select: { bodyOriginal: true, annotationsJson: true } })
  const a = JSON.parse(String(ap?.annotationsJson ?? '{}'))
  console.log(`\n✓ AuditLog ${journal} (recompté)`)
  console.log(`  corps : ${createHash('md5').update(ap?.bodyOriginal ?? '').digest('hex') === empreinte ? 'INTACT ✓' : '⚠️ MODIFIÉ'}`)
  console.log(`  pastilles : ${Object.keys(a.status ?? {}).length} (inchangées)`)
  console.log(`  note posée : ${String((a.crossRefs ?? [])[i]?.note ?? '').includes('1 769') ? 'oui ✓' : '⚠️ non'}`)
  await prisma.$disconnect()
}
main().catch(async (e) => {
  const m = e instanceof Error ? e.message : String(e)
  console.error('ÉCHEC :', m.trim() ? m : e)
  await prisma.$disconnect(); process.exit(1)
})
