/**
 * Deux décrets vers la Législation annotée, section « Banques & institutions financières ».
 *
 *   npx tsx scripts/import-decrets-bancaires.ts           (à blanc)
 *   npx tsx scripts/import-decrets-bancaires.ts --apply   (écrit)
 *
 * ⚠️ LE FICHIER N'EST PAS QUE LE TEXTE. Chaque fascicule porte autour du décret des choses
 * qui n'en font pas partie : l'ours du Moniteur en tête, et pour les maisons de transfert
 * une « NOTE D'AUDIT » de transcription en fin (source, anomalies préservées, corrections
 * d'OCR). Versées dans le corps, ces lignes se liraient comme du droit. On borne, et on DIT
 * ce qu'on laisse dehors.
 *
 * ⚠️ ADOPTION ≠ PUBLICATION. Le décret sur le blanchiment est donné au Palais National le
 * 30 avril 2023 et publié au Moniteur le 4 mai ; celui sur les maisons de transfert, donné
 * le 5 juin 2020 et publié le 16. Les circulaires BRH déjà en ligne citent « le décret du
 * 30 avril 2023 » — c'est la date d'ADOPTION qui sert de référence dans les renvois.
 */
import { readFileSync } from 'node:fs'
import mammoth from 'mammoth'
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'

const THEME = 'Banques & institutions financières'

interface Texte {
  fichier: string
  source: string
  number: string
  titleFr: string
  moniteurRef: string
  adoption: string
  publication: string
  /** Première ligne du décret — tout ce qui précède est l'ours du fascicule. */
  debut: RegExp
  /** Première ligne à EXCLURE — appareil de transcription, colophon… */
  fin?: RegExp
}

const TEXTES: Texte[] = [
  {
    fichier: '/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur/Decret Blanchiment 2023.docx',
    source: 'DECRET_BLANCHIMENT_2023',
    number: 'Décret du 30 avril 2023',
    titleFr:
      'Décret sanctionnant le blanchiment de capitaux, le financement du terrorisme et le financement de la prolifération des armes de destruction massive',
    moniteurRef: 'Le Moniteur, 178ᵉ Année, Spécial n° 12 du 4 mai 2023',
    adoption: '2023-04-30',
    publication: '2023-05-04',
    debut: /^D[ÉE]CRET SANCTIONNANT LE BLANCHIMENT/i,
  },
  {
    fichier: '/Users/cvaval/Downloads/Decret_Maisons_de_Transfert_5_juin_2020.docx',
    source: 'DECRET_MAISONS_TRANSFERT_2020',
    number: 'Décret du 5 juin 2020 (maisons de transfert)',
    titleFr: 'Décret modifiant certaines dispositions du Décret du 6 juillet 1989 sur les maisons de transfert',
    moniteurRef: 'Le Moniteur, 175ᵉ Année, Spécial n° 9 du 16 juin 2020',
    adoption: '2020-06-05',
    publication: '2020-06-16',
    debut: /^D[ÉE]CRET MODIFIANT CERTAINES DISPOSITIONS/i,
    // ⚠️ La note d'audit du transcripteur n'est pas le décret : elle décrit le travail de
    // transcription (« anomalies préservées », « corrections OCR silencieuses »).
    fin: /^NOTE D.AUDIT$/i,
  },
]

async function main() {
  const apply = process.argv.includes('--apply')
  const theme = await prisma.theme.findFirst({ where: { labelFr: THEME }, select: { id: true } })
  if (!theme) throw new Error(`Thème « ${THEME} » introuvable — on ne verse pas sans section.`)

  for (const t of TEXTES) {
    const lignes = (await mammoth.extractRawText({ buffer: readFileSync(t.fichier) })).value.split('\n').map((l) => l.replace(/\s+$/g, ''))
    const i = lignes.findIndex((l) => t.debut.test(l.trim()))
    if (i < 0) throw new Error(`Début introuvable : ${t.titleFr}`)
    const j = t.fin ? lignes.findIndex((l) => t.fin!.test(l.trim())) : -1
    const fin = j > i ? j : lignes.length
    const texte = lignes.slice(i, fin).join('\n').replace(/\n{3,}/g, '\n\n').trim()
    const arts = [...texte.matchAll(/^\s*Article\s+([\dᵉʳ.]+)/gim)].map((m) => m[1].replace(/[ᵉʳ]/g, ''))

    console.log(`\n### ${t.titleFr.slice(0, 78)}`)
    console.log(`   ${texte.length} car. · ${arts.length} articles : ${arts[0]} → ${arts[arts.length - 1]}`)
    console.log(`   adoption ${t.adoption} · publication ${t.publication} · ${t.moniteurRef}`)
    if (!/Donné au Palais National/i.test(texte)) console.warn('   ⚠ formule de clôture « Donné au Palais National » absente')
    if (j > i) {
      const reste = lignes.slice(j).join('\n').trim()
      console.log(`   NON VERSÉ : ${reste.length} car. — « ${lignes[j].trim()} » (appareil de transcription)`)
    }
    if (i > 0) console.log(`   ignoré en tête : ${lignes.slice(0, i).join('\n').trim().length} car. (ours du fascicule)`)

    const existant = await prisma.document.findFirst({ where: { type: 'LEGISLATION', source: t.source }, select: { id: true, bodyOriginal: true } })
    if (existant && existant.bodyOriginal === texte) { console.log('   = inchangé'); continue }
    if (!apply) { console.log(`   · ${existant ? 'à mettre à jour' : 'à créer'} (--apply)`); continue }

    const donnees = {
      type: 'LEGISLATION', status: 'EN_VIGUEUR', originalLang: 'fr',
      source: t.source, number: t.number, titleFr: t.titleFr, matiere: 'bancaire',
      bodyOriginal: texte, moniteurRef: t.moniteurRef,
      adoptionDate: new Date(`${t.adoption}T00:00:00Z`),
      publicationDate: new Date(`${t.publication}T00:00:00Z`),
    }
    const doc = existant
      ? await prisma.document.update({ where: { id: existant.id }, data: donnees })
      : await prisma.document.create({ data: donnees })

    if (!(await prisma.documentTheme.findFirst({ where: { documentId: doc.id, themeId: theme.id } }))) {
      await prisma.documentTheme.create({ data: { documentId: doc.id, themeId: theme.id, isPrimary: true } })
    }
    // Sans réindexation, le texte existe mais reste introuvable à la recherche.
    await reindexDocument(doc.id)
    await audit({ action: 'DOC_PUBLISHED', targetType: 'Document', targetId: doc.id, meta: { via: 'import-decrets-bancaires', source: t.source, articles: arts.length } })
    console.log(`   ✓ ${existant ? 'mise à jour' : 'créée'} — ${doc.id}`)
  }
  if (!apply) console.log('\n(exécution à blanc — ajouter --apply pour écrire)')
  await prisma.$disconnect()
}
main()
