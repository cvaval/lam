/**
 * Doublon « Circulaire n° 95 » ↔ « Circulaire CIRC-RES n° 95 » : deux fiches pour un SEUL
 * acte — CIRC-RES # 95 du 6 juillet 2015, coefficients de réserves obligatoires.
 *
 *   conservée : « Circulaire CIRC-RES n° 95 » — fac-similé propre à la circulaire, tableau
 *               de coefficients structuré, texte complet jusqu'à la signature ;
 *   supprimée : « Circulaire n° 95 » — extrait du recueil du Moniteur Spécial n° 18 de 2017
 *               (p. 347-350), coefficients aplatis en puces, fac-similé = page de recueil.
 *
 * Suit le précédent du 22 juin (« Circulaire n° 78 (réserves obligatoires) » supprimée au
 * profit du téléversement individuel). La suppression écrit un audit DOC_DELETED.
 *
 * Effet de bord voulu : le numéro « Circulaire n° 95 » disparaît de la section. C'est lui
 * qui avait fait porter à tort l'abrogation de la 95-1 — dont la clause vise la circulaire
 * n° 95 DU 1er AOÛT 2000, absente du corpus.
 *
 *   npx tsx scripts/_dedup-circulaire-95.ts          (simulation)
 *   npx tsx scripts/_dedup-circulaire-95.ts --commit
 */
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    }),
)
for (const k of ['DATABASE_URL', 'DIRECT_URL']) if (env[k]) process.env[k] = env[k]

import { prisma } from '../src/lib/db'
import { audit } from '../src/lib/auth/audit'
import { reindexDocument } from '../src/lib/search/reindex'

const GARDEE = 'cmqpfaxth001a13iy63ya2ofh' // Circulaire CIRC-RES n° 95
const SUPPRIMEE = 'cmqomvtw3002611mfynsv2ycs' // Circulaire n° 95 (extrait de recueil)
const COMMIT = process.argv.includes('--commit')

async function main() {
  const [gardee, doublon] = await Promise.all([
    prisma.document.findUnique({ where: { id: GARDEE }, select: { id: true, number: true, titleFr: true, publicationDate: true, bodyOriginal: true } }),
    prisma.document.findUnique({
      where: { id: SUPPRIMEE },
      select: {
        id: true, number: true, titleFr: true, bodyOriginal: true, status: true,
        _count: { select: { favorites: true, citationsFrom: true, citationsTo: true, themes: true, exports: true, versions: true, refsFrom: true, refsTo: true, publications: true } },
      },
    }),
  ])
  if (!gardee) throw new Error('la fiche à conserver est introuvable — annulé')
  if (!doublon) { console.log('✓ doublon déjà supprimé — rien à faire'); await prisma.$disconnect(); return }

  // Garde : les deux fiches doivent bien porter le MÊME acte (référence + coefficients).
  for (const marqueur of ['CIRC-RES # 95', '44%', '32.5%', '48%', '36.5%', '6 juillet 2015']) {
    if (!gardee.bodyOriginal.includes(marqueur) || !doublon.bodyOriginal.includes(marqueur))
      throw new Error(`marqueur « ${marqueur} » absent d'une des deux fiches — ce ne sont pas des doublons — annulé`)
  }
  const liens = Object.values(doublon._count).reduce((a, b) => a + b, 0)
  if (liens) throw new Error(`la fiche à supprimer porte ${liens} référence(s) — annulé`)

  console.log(`conservée : ${gardee.number} — ${gardee.titleFr}`)
  console.log(`supprimée : ${doublon.number} — ${doublon.titleFr} (${doublon.bodyOriginal.length} car., 0 référence)`)
  // La date de publication de la fiche conservée était celle de la PRISE D'EFFET
  // (16 juillet) ; l'acte est signé du 6 juillet 2015.
  const corrigeDate = gardee.publicationDate?.toISOString().slice(0, 10) !== '2015-07-06'
  console.log(`date de publication de la fiche conservée : ${gardee.publicationDate?.toISOString().slice(0, 10)}` +
    `${corrigeDate ? ' → 2015-07-06 (date de signature)' : ' (déjà correcte)'}`)

  if (!COMMIT) { console.log('\n(simulation — relancer avec --commit)'); await prisma.$disconnect(); return }

  if (corrigeDate) {
    await prisma.document.update({ where: { id: GARDEE }, data: { publicationDate: new Date('2015-07-06T00:00:00Z') } })
    await reindexDocument(GARDEE)
  }
  await audit({
    action: 'DOC_DELETED',
    targetType: 'Document',
    targetId: doublon.id,
    meta: {
      raison: 'doublon : même acte que « Circulaire CIRC-RES n° 95 » (CIRC-RES # 95 du 6 juillet 2015)',
      conserve: GARDEE,
      numero: doublon.number,
      titre: doublon.titleFr,
      corpsLongueur: doublon.bodyOriginal.length,
    },
  })
  await prisma.document.delete({ where: { id: SUPPRIMEE } })
  console.log('\n✓ doublon supprimé (DOC_DELETED tracé) · fiche conservée mise à jour')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
