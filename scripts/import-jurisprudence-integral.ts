/**
 * Versement des TEXTES INTÉGRAUX d'un recueil déjà présent en base.
 *
 *   npx tsx scripts/import-jurisprudence-integral.ts <fichier.docx> <SOURCE>            (à blanc)
 *   npx tsx scripts/import-jurisprudence-integral.ts <fichier.docx> <SOURCE> --apply    (écrit)
 *
 * ⚠️ À BLANC PAR DÉFAUT. Le script ne crée AUCUNE décision : il ne fait que remplacer le
 * corps de fiches existantes, rapprochées par numéro d'arrêt. Un numéro sans correspondance
 * est signalé et ignoré — jamais créé au jugé.
 *
 * ⚠️ IL N'ÉCRIT PAS LES NOTES DE TRANSCRIPTION. Ces notes sont un commentaire ; les poser
 * en base depuis un script les signerait au nom d'un éditeur qui ne les a pas relues. Elles
 * sont imprimées ici, et l'écran « Éditer le corpus » permet de les reprendre nominativement.
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { paragraphesDuDocx } from '../src/lib/jurisprudence/docx'
import { analyserTextesIntegraux } from '../src/lib/jurisprudence/full-text'
import { reindexDocument } from '../src/lib/search/reindex'

async function main() {
  const [fichier, source] = process.argv.slice(2)
  const apply = process.argv.includes('--apply')
  if (!fichier || !source) {
    console.error('usage : import-jurisprudence-integral.ts <fichier.docx> <SOURCE> [--apply]')
    process.exit(1)
  }

  const r = analyserTextesIntegraux(await paragraphesDuDocx(readFileSync(fichier)))
  for (const a of r.avertissements) console.warn(`⚠ ${a}`)

  const enBase = await prisma.document.findMany({
    where: { type: 'JURISPRUDENCE', source },
    select: { id: true, number: true, publicationDate: true, bodyOriginal: true },
  })
  const parNumero = new Map(enBase.map((d) => [d.number ?? '', d]))

  let ecrits = 0
  let inchanges = 0
  const orphelins: string[] = []
  for (const t of r.textes) {
    const d = parNumero.get(t.numero)
    if (!d) { orphelins.push(t.numero); continue }
    const dateBase = d.publicationDate?.toISOString().slice(0, 10) ?? null
    // Recoupement, jamais correction : un écart de date signale un mauvais rapprochement.
    const ecart = t.dateISO && dateBase && t.dateISO !== dateBase ? ` ⚠ date ${t.dateISO} ≠ ${dateBase}` : ''
    if (d.bodyOriginal === t.texte) { inchanges++; console.log(` = n° ${t.numero.padStart(2)} inchangé${ecart}`); continue }
    console.log(` ${apply ? '→' : '·'} n° ${t.numero.padStart(2)} · ${t.texte.length} car. (corps actuel : ${d.bodyOriginal?.length ?? 0})${ecart}`)
    if (apply) {
      await prisma.document.update({ where: { id: d.id }, data: { bodyOriginal: t.texte } })
      // Sans réindexation, le texte versé resterait introuvable à la recherche.
      await reindexDocument(d.id)
      ecrits++
    }
  }

  if (orphelins.length) console.warn(`⚠ sans correspondance dans « ${source} » : n° ${orphelins.join(', ')}`)
  const notes = Object.entries(r.notesParArret)
  if (notes.length) {
    console.log(`\nNotes de transcription NON écrites (${notes.length}) — à reprendre depuis « Éditer le corpus » :`)
    for (const [n, txt] of notes) console.log(`  n° ${n} : ${txt.slice(0, 110)}${txt.length > 110 ? '…' : ''}`)
  }
  for (const g of r.notesGenerales) console.log(`  général : ${g.slice(0, 110)}`)

  console.log(`\n${apply ? 'écrits' : 'à écrire'} : ${apply ? ecrits : r.textes.length - inchanges - orphelins.length} · inchangés : ${inchanges} · orphelins : ${orphelins.length}`)
  if (!apply) console.log('(exécution à blanc — ajouter --apply pour écrire)')
  await prisma.$disconnect()
}
main()
