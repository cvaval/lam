/**
 * RÉPARATION — la circulaire du 13 mars 1995 avait reçu le titre d'une autre.
 *
 *     npx tsx scripts/reparer-titre-brh-1995.ts            # simulation
 *     npx tsx scripts/reparer-titre-brh-1995.ts --apply    # Me Vaval, elle seule
 *
 * ⚠️ CE QUE J'AI CASSÉ, ET COMMENT. `scripts/noms-complets-actes.ts`, dans sa première version,
 * indexait les identifiants PAR SOURCE. Les 86 circulaires du site de la BRH partagent la source
 * « BRH-WEB » : les onze mises à jour ont donc toutes écrit sur la MÊME fiche, chacune écrasant la
 * précédente. La dernière a laissé sur la fiche `cmqomlr2v000211mfwq8doaae` — publiée le
 * 13 mars 1995 — le titre d'une circulaire du 2 mars 1992.
 *
 * ⚠️ RIEN N'A ÉTÉ PERDU : la circulaire de 1992 existe sur sa propre fiche
 * (`cmqomw1e3002811mf3t5hfqwt`, publiée le 2 mars 1992), intacte. Un titre a été RECOPIÉ au
 * mauvais endroit, pas déplacé.
 *
 * L'IDENTITÉ EST ÉTABLIE SUR LE CORPS, pas sur un souvenir : la fiche est publiée le 13 mars 1995,
 * et son texte parle quatre fois de « dépôts en devises » et deux fois du « 13 mars 1995 ».
 * Son titre est donc « Circulaire BRH du 13 mars 1995 (CIR/95/62) — Gestion des depots en devises ».
 */
import { prisma } from '../src/lib/db'
import { audit } from '../src/lib/auth/audit'
import { reindexDocument } from '../src/lib/search/reindex'

const APPLY = process.argv.includes('--apply')
const ID = 'cmqomlr2v000211mfwq8doaae'
const VRAI = 'Circulaire BRH du 13 mars 1995 (CIR/95/62) — Gestion des depots en devises'
const FAUX = 'Circulaire BRH du 2 mars 1992 (CT/92/43) — Flux dinformation apb brh'

async function main() {
  const d = await prisma.document.findUnique({ where: { id: ID }, select: { titleFr: true, number: true, bodyOriginal: true, publicationDate: true } })
  if (!d) throw new Error(`${ID} introuvable. STOP`)
  if (d.titleFr === VRAI) { console.log('titre déjà rétabli — rien à faire.'); await prisma.$disconnect(); return }
  if (d.titleFr !== FAUX) throw new Error(`la fiche porte « ${d.titleFr} », ni le titre faux ni le vrai — relire. STOP`)

  // ── L'identité se prouve sur le corps et la date, jamais sur un souvenir ──
  const b = d.bodyOriginal ?? ''
  const pub = d.publicationDate?.toISOString().slice(0, 10)
  if (pub !== '1995-03-13') throw new Error(`publiée le ${pub}, 1995-03-13 attendu. STOP`)
  const devises = b.split('dépôts en devises').length - 1
  const mars95 = b.split('13 mars 1995').length - 1
  if (devises < 1 || mars95 < 1) throw new Error(`le corps ne confirme pas l'identité (« dépôts en devises » ×${devises}, « 13 mars 1995 » ×${mars95}). STOP`)

  // ── La circulaire de 1992 doit exister ailleurs, intacte ──
  const vraie92 = await prisma.document.findFirst({ where: { source: 'BRH-WEB', titleFr: FAUX, publicationDate: new Date('1992-03-02T00:00:00Z') }, select: { id: true } })
  if (!vraie92) throw new Error('la circulaire du 2 mars 1992 est introuvable sur sa propre fiche — ne rien écraser avant de comprendre. STOP')

  console.log(`fiche ${ID} · publiée le ${pub}`)
  console.log(`  corps : « dépôts en devises » ×${devises} · « 13 mars 1995 » ×${mars95}`)
  console.log(`  titre porté à tort : « ${d.titleFr} »`)
  console.log(`  titre rétabli      : « ${VRAI} »`)
  console.log(`  la circulaire de 1992 reste sur sa fiche ${vraie92.id} ✓`)
  if (!APPLY) { console.log('\nSIMULATION — rien n’a été écrit.'); await prisma.$disconnect(); return }

  await prisma.$transaction(async (tx) => {
    await tx.document.update({ where: { id: ID }, data: { titleFr: VRAI, number: VRAI } })
    await audit({
      action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: 'REPARATION_BRH_1995',
      meta: {
        motif:
          'Rétablissement du titre de la circulaire BRH du 13 mars 1995 (CIR/95/62), qui portait celui ' +
          'd’une circulaire du 2 mars 1992. Cause : scripts/noms-complets-actes.ts indexait les ' +
          'identifiants par `source`, non unique — les 86 circulaires du site BRH la partagent, et les ' +
          'onze mises à jour ont toutes écrit sur la même fiche. Rien n’a été perdu : la circulaire de ' +
          '1992 est restée intacte sur sa propre fiche. Identité rétablie sur le corps (« dépôts en ' +
          'devises », « 13 mars 1995 ») et la date de publication, jamais sur un souvenir.',
      },
    }, tx)
  }, { timeout: 60_000, maxWait: 30_000 })

  const n = await prisma.auditLog.count({ where: { targetId: 'REPARATION_BRH_1995' } })
  await reindexDocument(ID)
  const ap = await prisma.document.findUnique({ where: { id: ID }, select: { titleFr: true, number: true } })
  console.log(`\n✓ AuditLog ${n} (recompté)`)
  console.log(`  titre : « ${ap?.titleFr} »`)
  console.log(`  référence = titre : ${ap?.number === ap?.titleFr}`)
  await prisma.$disconnect()
}
main().catch(async (e) => {
  const m = e instanceof Error ? e.message : String(e)
  console.error('ÉCHEC :', m.trim() ? m : e)
  await prisma.$disconnect(); process.exit(1)
})
