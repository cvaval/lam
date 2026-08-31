/**
 * LES RÉSERVES ÉDITORIALES ÉTAIENT INVISIBLES — les remettre là où le lecteur les voit.
 *
 *     npx tsx scripts/reparer-reserves-invisibles.ts            # simulation
 *     npx tsx scripts/reparer-reserves-invisibles.ts --apply    # Me Vaval, elle seule
 *
 * ─── LE DÉFAUT ─────────────────────────────────────────────────────────────────────────────
 * Les quatre imports du 30 août ont placé leurs avertissements dans `annotationsJson.annotationAuthor`.
 * MESURÉ : ce champ n'est lu par AUCUN composant de rendu. `grep -rn annotationAuthor src/` ne donne
 * que sa déclaration de type (annotated.ts l. 86), sa coercition (l. 140) et deux fixtures de test.
 * Sept fiches portaient donc une réserve que personne ne peut lire — dont celle du décret de
 * taxation de 1987, qui dit qu'UNE LIGNE DU BARÈME A PERDU SON MONTANT et que le transcripteur a
 * amendé le texte en deux endroits. Sur un texte officiel, une réserve invisible ne réserve rien.
 *
 * ─── LES DEUX CANAUX, ET LEQUEL CHOISIR ────────────────────────────────────────────────────
 * · `annotationsJson.crossRefs` — rendu par AnnotatedText (l. 120, 153) sur les têtes de SECTION,
 *   à l'ancre `sec-N`. C'est le canal de la « note de provenance en tête de fiche » employé pour
 *   le Décret sur l'Impôt sur le Revenu de 2005. Utilisable seulement si le document a un sommaire.
 * · `annotationsJson.commentaires` — rendu sous l'article, clé `sec-K|art-N`. Pour un document sans
 *   sommaire, la clé du premier article est `sec-0|art-1`.
 * Chaque fiche reçoit le canal qui lui convient, et le script REFUSE d'écrire s'il n'en a aucun.
 *
 * `annotationAuthor` est laissé en place : il ne gêne pas, et le vider ferait perdre la trace.
 */
import { prisma } from '../src/lib/db'
import { audit } from '../src/lib/auth/audit'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated } from '../src/lib/legislation/annotated'

const APPLY = process.argv.includes('--apply')

/** Les sept fiches versées le 30 août dont la réserve est aujourd'hui invisible. */
const FICHES = [
  'CODE_INVESTISSEMENTS_2002',
  'DECRET_DENREES_ALIMENTAIRES_2020',
  'AVIS_MCI_ETIQUETAGE_2024',
  'DECRET_GESTION_ENVIRONNEMENT_2005',
  'DECRET_CONATEL_TAXATION_1987',
  'DECRET_TNT_2026',
  'CIRCULAIRE_CONATEL_CONCESSIONNAIRE_2022',
]

type Bloc = { kind: string; anchor?: string | null; jurisKey?: string | null; level?: number }

async function main() {
  const docs = await prisma.document.findMany({
    where: { source: { in: FICHES } },
    select: { id: true, source: true, titleFr: true, bodyOriginal: true, annotationsJson: true },
  })
  if (docs.length !== FICHES.length) throw new Error(`${docs.length} fiche(s) sur ${FICHES.length}. STOP`)

  const plan: { doc: (typeof docs)[number]; note: string; canal: 'crossRefs' | 'commentaires'; cle: string; a: Record<string, unknown> }[] = []
  const sansCanal: string[] = []
  let dejaFait = 0

  for (const d of docs) {
    const a = JSON.parse(String(d.annotationsJson ?? '{}')) as Record<string, unknown>
    const note = String(a.annotationAuthor ?? '').trim()
    if (!note) throw new Error(`${d.source} : aucune réserve dans annotationAuthor — état inattendu. STOP`)

    const toc = (a.toc ?? []) as { anchor: string }[]
    const blocs = segmentAnnotated(d.bodyOriginal ?? '', toc as never) as Bloc[]
    const sections = blocs.filter((b) => b.kind === 'section' && b.anchor)
    const articles = blocs.filter((b) => b.kind === 'body' && b.anchor && b.jurisKey)

    // ⚠️ Idempotence par fiche : la réserve est-elle DÉJÀ dans un canal visible ?
    const xr = (a.crossRefs ?? []) as { anchor: string; note?: string }[]
    const cm = (a.commentaires ?? {}) as Record<string, string[]>
    const dejaXr = xr.some((c) => (c.note ?? '').includes(note.slice(0, 40)))
    const dejaCm = Object.values(cm).some((v) => v.some((x) => x.includes(note.slice(0, 40))))
    if (dejaXr || dejaCm) { dejaFait++; continue }

    if (sections.length) plan.push({ doc: d, note, canal: 'crossRefs', cle: sections[0].anchor!, a })
    else if (articles.length) plan.push({ doc: d, note, canal: 'commentaires', cle: articles[0].jurisKey!, a })
    else sansCanal.push(d.source!)
  }

  console.log('RÉSERVES ÉDITORIALES — les remettre là où le lecteur les voit\n')
  for (const p of plan)
    console.log(`  ${p.doc.source!.padEnd(40)} → ${p.canal.padEnd(13)} à « ${p.cle} »  (${p.note.length} car.)`)
  if (dejaFait) console.log(`  ${dejaFait} fiche(s) portent déjà leur réserve dans un canal visible`)
  if (sansCanal.length) {
    console.log(`\n  ⚠️ ${sansCanal.length} fiche(s) SANS canal — ni section, ni article où accrocher :`)
    for (const s of sansCanal) console.log(`     ${s}`)
    console.log(`     Leur réserve reste invisible. Ce n'est pas réparable ici : c'est à dire, pas à cacher.`)
  }
  if (!plan.length) { console.log('\nrien à faire.'); await prisma.$disconnect(); return }
  if (!APPLY) { console.log('\nSIMULATION — rien n’a été écrit.'); await prisma.$disconnect(); return }

  await prisma.$transaction(async (tx) => {
    for (const p of plan) {
      const a = { ...p.a }
      if (p.canal === 'crossRefs') {
        const xr = [...((a.crossRefs ?? []) as { anchor: string; articles: number[]; note?: string }[])]
        xr.unshift({ anchor: p.cle, articles: [], note: p.note })
        a.crossRefs = xr
      } else {
        const cm = { ...((a.commentaires ?? {}) as Record<string, string[]>) }
        cm[p.cle] = [p.note, ...(cm[p.cle] ?? [])]
        a.commentaires = cm
      }
      await tx.document.update({ where: { id: p.doc.id }, data: { annotationsJson: JSON.stringify(a) } })
      await audit({
        action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: p.doc.id,
        meta: {
          motif:
            'Réserve éditoriale rendue VISIBLE. Elle avait été placée dans annotationAuthor, champ que ' +
            'AUCUN composant de rendu ne lit — mesuré : sa seule présence dans src/ est sa déclaration de ' +
            'type, sa coercition et deux fixtures de test. Elle est déplacée vers ' +
            `${p.canal === 'crossRefs' ? 'annotationsJson.crossRefs (note de tête de fiche, ancre ' + p.cle + ')' : 'annotationsJson.commentaires (clé ' + p.cle + ', sous le premier article)'}` +
            ', canal effectivement rendu par AnnotatedText. Défaut trouvé par l’audit adversarial du ' +
            '30 août 2026. Sur un texte officiel, une réserve invisible ne réserve rien.',
          canal: p.canal, cle: p.cle, longueur: p.note.length,
        },
      }, tx)
    }
  }, { timeout: 120_000 })

  for (const p of plan) await reindexDocument(p.doc.id)
  console.log(`\n✓ ${plan.length} réserve(s) déplacée(s), ${plan.length} fiche(s) réindexée(s)`)
  for (const p of plan) {
    const d = await prisma.document.findUnique({ where: { id: p.doc.id }, select: { annotationsJson: true } })
    const a = JSON.parse(String(d?.annotationsJson ?? '{}'))
    const vu = p.canal === 'crossRefs'
      ? ((a.crossRefs ?? []) as { note?: string }[]).some((c) => (c.note ?? '').includes(p.note.slice(0, 40)))
      : Object.values((a.commentaires ?? {}) as Record<string, string[]>).some((v) => v.some((x) => x.includes(p.note.slice(0, 40))))
    console.log(`  ${vu ? '✓' : '✗'} ${p.doc.source!.padEnd(40)} réserve retrouvée dans ${p.canal}`)
  }
  await prisma.$disconnect()
}

main().catch(async (e) => {
  const m = e instanceof Error ? e.message : String(e)
  console.error('ÉCHEC :', m.trim() ? m : e)
  await prisma.$disconnect(); process.exit(1)
})
