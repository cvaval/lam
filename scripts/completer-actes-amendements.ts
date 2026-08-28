/**
 * Complète les lignes d'amendement qui NOMMENT leur acte en prose sans le DÉSIGNER en base.
 *
 *   npx tsx scripts/completer-actes-amendements.ts [--commit]
 *
 * ⚠️ UNE NOTE N'EST PAS UNE DONNÉE. Trois textes versés en août portaient tout leur savoir
 * dans `note` — « Abrogé par l'article 2 du Décret du 6 janvier 2016 » — et rien dans
 * `amendedByNumber`, `amendedByDocId`, `effectiveDate`. Conséquence à l'écran : le corps
 * affichait « [Abrogé] » tout court, l'historique disait « Abrogé » sans date ni acte, et
 * aucune pastille ne pouvait renvoyer nulle part. Les trois codes (civil, commerce, pénal),
 * eux, renseignent ces trois champs sur 100 % de leurs lignes : c'est la norme du corpus.
 *
 * ⚠️ LA DÉSIGNATION EST COURTE, ET C'EST LA RÉFÉRENCE AU MONITEUR QUI LÈVE L'AMBIGUÏTÉ —
 * convention relevée sur le Code civil (« Décret réformant le Droit des Sûretés (Le Moniteur,
 * Spécial n° 7 du 14 mai 2020) »). C'est elle qui s'affiche DANS LE CORPS, entre crochets :
 * un titre complet y tenait sur trois lignes et noyait l'article abrogé, qui n'en fait qu'une.
 * Et elle suffit : les DEUX décrets du 6 janvier 2016 se séparent par leur Moniteur — n° 21
 * pour celui-ci, n° 20 pour celui sur l'administration électronique.
 *
 * ⚠️ UNE LIGNE `MODIFIE` NE PORTE JAMAIS L'ACTE — convention du corpus, vérifiée : les trois
 * codes renseignent l'acte sur 100 % de leurs lignes EN_VIGUEUR et ABROGE, et sur 0 de leurs
 * 132 lignes MODIFIE. C'est juste : une ligne MODIFIE est l'instantané de l'ANCIENNE
 * rédaction. Lui attacher l'acte modificatif ferait lire « Ancienne version — 1ᵉʳ février 2016
 * (Décret du 6 janvier 2016) », c'est-à-dire l'inverse de la vérité : ce décret ne l'a pas
 * écrite, il l'a remplacée.
 *
 * ⚠️ ET L'ABROGATION DES TEXTES DE 1958-1960 RESTE UNE LECTURE, PAS UNE CITATION. Les décrets
 * du 11 août 2026 n'abrogent NOMMÉMENT personne : c'est leur clause générale, confrontée
 * article par article, qui emporte les textes anciens. La note le dit et continue de le dire ;
 * on ne fait ici que rattacher la ligne au décret qui la porte.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/** Un motif reconnu dans la note → l'acte qui en répond. */
const REGLES: { source: string; motif: RegExp; acte: string }[] = [
  { source: 'DECRET_ADMIN_CENTRALE_2005', motif: /Décret du 6 janvier 2016/, acte: 'DECRET_ADMIN_CENTRALE_AMEND_2016' },
  { source: 'LOI_LOTERIE_LEH_1958', motif: /Loi du 2 septembre 1958/, acte: 'LOI_LOTERIE_LEH_REFORME_1958' },
  { source: 'LOI_LOTERIE_LEH_1958', motif: /Décrets? du 11 août 2026/, acte: 'DECRET_JEUX_HASARD_2026' },
  { source: 'DECRET_CASINOS_1960', motif: /Décrets? du 11 août 2026/, acte: 'DECRET_JEUX_HASARD_2026' },
]

/** « Décret du 6 janvier 2016 » — la tête du titre, avant l'objet. */
const ACTE_COURT = /^((?:Décret-Loi|Décret|Loi|Arrêté|Avis)(?:\s+N[o°º][^\s,]*)?\s+du\s+\d{1,2}(?:er|ᵉʳ)?\s+\p{L}+\s+\d{4})/u

/** Désignation courte + référence au Moniteur, comme les trois codes. */
function designation(titre: string, moniteurRef: string | null): string {
  const court = ACTE_COURT.exec(titre)?.[1] ?? titre
  return moniteurRef ? `${court} (${moniteurRef})` : court
}

async function main() {
  const commit = process.argv.includes('--commit')
  const sources = [...new Set(REGLES.flatMap((r) => [r.source, r.acte]))]
  const docs = await prisma.document.findMany({
    where: { source: { in: sources } },
    select: { id: true, source: true, titleFr: true, moniteurRef: true, publicationDate: true },
  })
  const parSource = new Map(docs.map((d) => [d.source!, d]))
  const manquants = sources.filter((s) => !parSource.has(s))
  if (manquants.length) { console.error(`⛔ ARRÊT — textes absents : ${manquants.join(', ')}`); process.exit(1) }

  console.log('LIGNES D’AMENDEMENT SANS ACTE DÉSIGNÉ\n')
  const aFaire: { id: string; num: string; docId: string; date: Date | null; quoi: string }[] = []

  for (const r of REGLES) {
    const texte = parSource.get(r.source)!
    const acte = parSource.get(r.acte)!
    const lignes = await prisma.articleVersion.findMany({
      where: { documentId: texte.id, status: { in: ['EN_VIGUEUR', 'ABROGE'] } },
      select: { id: true, anchor: true, status: true, note: true, amendedByNumber: true, amendedByDocId: true },
      orderBy: { anchor: 'asc' },
    })
    const num = designation(acte.titleFr, acte.moniteurRef)
    // Rejouable : on ne touche qu'aux lignes dont la désignation n'est pas déjà la bonne.
    const vises = lignes.filter((l) => l.note && r.motif.test(l.note) && (l.amendedByNumber !== num || l.amendedByDocId !== acte.id))
    if (!vises.length) continue
    console.log(`   ${r.source} → ${r.acte}`)
    console.log(`      ${vises.length} ligne(s) : ${vises.map((v) => v.status[0] + v.anchor.replace('art-', '')).join(' ')}`)
    console.log(`      désignation : ${num.slice(0, 104)}`)
    console.log(`      effet : ${acte.publicationDate?.toISOString().slice(0, 10) ?? '(sans date)'}\n`)
    for (const v of vises) aFaire.push({ id: v.id, num, docId: acte.id, date: acte.publicationDate, quoi: `${v.status} ${v.anchor}` })
  }

  console.log(`   ${aFaire.length} lignes à compléter`)
  if (!commit) { console.log('\n(à blanc — ajouter --commit pour écrire)'); await prisma.$disconnect(); return }
  for (const a of aFaire) {
    await prisma.articleVersion.update({
      where: { id: a.id },
      data: { amendedByNumber: a.num, amendedByDocId: a.docId, effectiveDate: a.date },
    })
  }
  console.log(`\n✅ ${aFaire.length} lignes complétées.`)
  await prisma.$disconnect()
}

main()
