/**
 * Ajoute à la table des matières du Code civil les trois « Dispositions générales »
 * que le corps porte mais qu'elle ignorait — le sommaire de l'édition les liste.
 *
 * Elles coiffent une subdivision juste sous un chapitre :
 *   - LOI Nº 15 (l. 941)  · CHAPITRE IV du bail à cheptel (l. 2509)
 *   - CHAPITRE V du temps requis pour prescrire (l. 3393)
 *
 * Deux raisons de les inscrire, pas seulement l'exhaustivité du sommaire latéral :
 * une ligne d'en-tête HORS table vit dans le bloc de l'article qui la suit ; si cet
 * article est un jour amendé, l'overlay remplace le bloc entier et la rubrique
 * DISPARAÎT de l'affichage (leçon du décret Régimes matrimoniaux).
 *
 * ⚠ Une entrée de table change la SECTION COURANTE des articles qui suivent, donc leur
 * clé d'annotation `sec-K|art-N`. Les clés sont recalculées et MIGRÉES : le script
 * compare la segmentation avant et après, puis renomme. Il échoue si une clé se
 * perdrait en route.
 *
 *     npx tsx scripts/ajouter-dispositions-generales-toc.ts
 *     npx tsx scripts/ajouter-dispositions-generales-toc.ts --apply
 */
import { PrismaClient } from '@prisma/client'
import { parseAnnotations, segmentAnnotated } from '../src/lib/legislation/annotated'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')

/** Rubrique à inscrire : le libellé EXACT de la ligne, et l'entrée qu'elle suit. */
const AJOUTS = [
  { label: 'Dispositions générales', apres: 'LOI Nº 15 — Des différentes manières dont on acquiert la propriété' },
  { label: 'Dispositions générales', apres: 'CHAPITRE IV — DU BAIL À CHEPTEL' },
  { label: 'Dispositions générales', apres: 'CHAPITRE V — DU TEMPS REQUIS POUR PRESCRIRE' },
]

async function main() {
  const doc = await prisma.document.findFirst({
    where: { source: 'CODE_CIVIL_ANNOTE' },
    select: { id: true, bodyOriginal: true, annotationsJson: true },
  })
  if (!doc) throw new Error('Code civil introuvable.')
  const ann = parseAnnotations(doc.annotationsJson)!
  const brut = JSON.parse(doc.annotationsJson!) as {
    // `kind` est REQUIS côté TocEntry : une entrée sans genre ferait échouer la
    // segmentation là où elle distingue le Code de ses annexes.
    toc: Array<{ anchor: string; label: string; level: number; kind: string }>
    jurisprudence: Record<string, Array<{ ref?: string; excerpt?: string }>>
  }

  // ── clés AVANT ────────────────────────────────────────────────────────────────
  const avant = new Map<string, string>() // ancre d'article → clé
  for (const b of segmentAnnotated(doc.bodyOriginal, ann.toc))
    if (b.kind === 'body' && b.anchor && b.jurisKey) avant.set(b.anchor, b.jurisKey)

  // ── insertion, avec des ancres NEUVES (jamais renuméroter l'existant) ─────────
  const maxSec = Math.max(...brut.toc.map((t) => Number(/sec-(\d+)/.exec(t.anchor)?.[1] ?? 0)))
  const toc = [...brut.toc]
  let suivante = maxSec + 1
  for (const a of AJOUTS) {
    const i = toc.findIndex((t) => t.label === a.apres)
    if (i < 0) throw new Error(`entrée de rattachement introuvable : ${a.apres}`)
    if (toc[i + 1]?.label === a.label) {
      console.log(`  déjà inscrite sous « ${a.apres.slice(0, 60)} » — rien à faire`)
      continue
    }
    const parent = toc[i]
    toc.splice(i + 1, 0, { anchor: `sec-${suivante}`, label: a.label, level: parent.level + 1, kind: 'section' })
    console.log(`  sec-${suivante} « ${a.label} » inscrite sous « ${a.apres.slice(0, 60)} »`)
    suivante++
  }
  if (toc.length === brut.toc.length) {
    console.log('\nRien à ajouter.')
    await prisma.$disconnect()
    return
  }

  // ── clés APRÈS, et migration ─────────────────────────────────────────────────
  const apres = new Map<string, string>()
  for (const b of segmentAnnotated(doc.bodyOriginal, toc))
    if (b.kind === 'body' && b.anchor && b.jurisKey) apres.set(b.anchor, b.jurisKey)

  const migrations: Array<[string, string]> = []
  for (const [art, ancienne] of avant) {
    const neuve = apres.get(art)
    if (!neuve) throw new Error(`l'article ${art} n'a plus de clé après insertion — arrêt`)
    if (neuve !== ancienne && brut.jurisprudence[ancienne]) migrations.push([ancienne, neuve])
  }
  const deplaces = new Set(migrations.map(([a]) => a))
  const orphelines = Object.keys(brut.jurisprudence).filter(
    (k) => !deplaces.has(k) && ![...apres.values()].includes(k),
  )

  console.log(`\nentrées de table : ${brut.toc.length} → ${toc.length}`)
  console.log(`clés d'annotation à migrer : ${migrations.length}`)
  migrations.forEach(([a, b]) => console.log(`   ${a} → ${b}`))
  if (orphelines.length) {
    console.error(`\n⚠ ${orphelines.length} clé(s) resteraient orphelines : ${orphelines.slice(0, 6).join(', ')}`)
    throw new Error('migration incomplète — aucune écriture')
  }
  console.log('clés orphelines après migration : 0')

  if (!APPLY) {
    console.log('\nSIMULATION — rien n’a été écrit. Relancer avec --apply.')
    await prisma.$disconnect()
    return
  }
  for (const [ancienne, neuve] of migrations) {
    brut.jurisprudence[neuve] = [...(brut.jurisprudence[neuve] ?? []), ...brut.jurisprudence[ancienne]]
    delete brut.jurisprudence[ancienne]
  }
  brut.toc = toc
  await prisma.$transaction(
    async (tx) => {
      await tx.document.update({ where: { id: doc.id }, data: { annotationsJson: JSON.stringify(brut) } })
      await audit(
        { action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: doc.id,
          meta: { source: 'CODE_CIVIL_ANNOTE', motif: 'trois « Dispositions générales » inscrites au sommaire', migrations: migrations.length } },
        tx,
      )
    },
    { timeout: 120_000, maxWait: 30_000 },
  )
  console.log('\n✓ Écrit et journalisé.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('ÉCHEC :', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
