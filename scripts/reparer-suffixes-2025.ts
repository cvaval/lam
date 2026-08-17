/**
 * Rend son suffixe à chaque fascicule de 2025 écrasé sur la référence de son voisin.
 *
 *   npx tsx scripts/reparer-suffixes-2025.ts            (à blanc)
 *   npx tsx scripts/reparer-suffixes-2025.ts --commit   (écrit)
 *
 * ⚠️ CE NE SONT PAS DES DOUBLONS. `LM2025-147` porte SEPT fascicules distincts — les n° 147,
 * 147-A à 147-F —, tous catalogués sous la même référence et sous le même intitulé
 * « Le Moniteur n° 147 — Novembre 2025 ». À l'écran, sept lignes identiques ; à la
 * recherche, le n° 147-D n'existe pas. Le fac-similé, lui, est le bon sur chacune : seule
 * l'identité est fausse.
 *
 * La cause est datée : le versement de juin 2026 a précédé le correctif `04fd98f`, qui a
 * appris à `editionRef()` à porter le suffixe. 22 références, 49 fiches.
 *
 * ⚠️ ON NE SUPPRIME RIEN ET ON NE RÉ-IMPORTE RIEN. Le nom du fichier source est conservé
 * dans le corps de chaque fiche : il suffit de le relire pour retrouver le suffixe. Un
 * ré-import purgerait la source et emporterait les corrections éditoriales portées depuis
 * quatorze mois.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const SOURCE = 'MONITEUR_PDF_2025'

/** « Le Moniteur No.147-D Novembre 2025.pdf » → « 147-D ». */
function numeroDuFichier(nom: string): { num: number; suffixe: string } | null {
  const m = /No\.?\s*(\d+)\s*-?\s*([A-Za-z])?(?![A-Za-z0-9])/.exec(nom)
  if (!m) return null
  return { num: Number(m[1]), suffixe: (m[2] ?? '').toUpperCase() }
}

async function main() {
  const commit = process.argv.includes('--commit')
  const docs = await prisma.document.findMany({
    where: { source: SOURCE },
    select: { id: true, number: true, titleFr: true, moniteurRef: true, bodyOriginal: true, editionType: true },
    orderBy: { publicationDate: 'asc' },
  })

  const corrections: { id: string; de: string; vers: string; titre: string; ref: string }[] = []
  const illisibles: string[] = []

  for (const d of docs) {
    const m = /Fichier\s*:\s*(.+?)\]/.exec(d.bodyOriginal ?? '')
    if (!m) continue
    const nom = m[1].split(' ; ')[0].trim()
    const lu = numeroDuFichier(nom)
    if (!lu) {
      illisibles.push(nom)
      continue
    }
    if (!lu.suffixe) continue // pas de suffixe à rendre

    const speciale = d.editionType === 'SPECIALE'
    const attendu = `LM2025-${speciale ? 'SP' : ''}${lu.num}-${lu.suffixe}`
    if (d.number === attendu) continue

    // L'intitulé et la référence Moniteur portent le numéro : ils suivent.
    const titre = (d.titleFr ?? '').replace(
      new RegExp(`n°\\s*${lu.num}(?!\\d)(-[A-Z])?`),
      `n° ${lu.num}-${lu.suffixe}`,
    )
    const ref = (d.moniteurRef ?? '').replace(
      new RegExp(`n°\\s*${lu.num}(?!\\d)(-[A-Z])?`),
      `n° ${lu.num}-${lu.suffixe}`,
    )
    corrections.push({ id: d.id, de: d.number!, vers: attendu, titre, ref })
  }

  console.log(`${docs.length} fiches 2025 examinées · ${corrections.length} à corriger`)
  if (illisibles.length) console.log(`⚠ ${illisibles.length} nom(s) de fichier illisible(s) : ${illisibles.slice(0, 3).join(', ')}`)

  // ⚠️ CONTRÔLE AVANT ÉCRITURE : la correction ne doit pas créer une NOUVELLE collision.
  const apres = new Map<string, number>()
  for (const d of docs) apres.set(d.number!, (apres.get(d.number!) ?? 0) + 1)
  for (const c of corrections) {
    apres.set(c.de, (apres.get(c.de) ?? 1) - 1)
    apres.set(c.vers, (apres.get(c.vers) ?? 0) + 1)
  }
  const restantes = [...apres].filter(([, n]) => n > 1)
  console.log(`\nAPRÈS correction : ${restantes.length ? `⛔ ${restantes.length} collision(s) subsisteraient : ${restantes.map(([r, n]) => `${r}×${n}`).join(', ')}` : '✔ aucune référence en double'}`)
  if (restantes.length) {
    console.error('\n⛔ ARRÊT — la correction ne résout pas tout, elle n’est pas appliquée.')
    process.exit(1)
  }

  for (const c of corrections.slice(0, 12)) console.log(`   ${c.de.padEnd(14)} → ${c.vers.padEnd(16)} « ${c.titre} »`)
  if (corrections.length > 12) console.log(`   … et ${corrections.length - 12} autres`)

  if (!commit) {
    console.log('\n(à blanc — ajouter --commit pour écrire)')
    await prisma.$disconnect()
    return
  }

  for (const c of corrections) {
    await prisma.document.update({
      where: { id: c.id },
      data: { number: c.vers, titleFr: c.titre, moniteurRef: c.ref },
    })
  }
  console.log(`\n✅ ${corrections.length} fascicules ont retrouvé leur suffixe.`)
  console.log('   Penser à réindexer (npx tsx scripts/reindex.ts) — la référence est indexée.')
  await prisma.$disconnect()
}

main()
