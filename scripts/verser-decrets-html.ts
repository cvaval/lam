/**
 * Version HTML des quatre décrets versés depuis leurs fascicules : `bodyClean` (texte
 * propre issu du HTML de mammoth — titres, paragraphes, puces) et `richBlocksJson` (les
 * TABLEAUX du Word, rendus en grille par React).
 *
 *   npx tsx scripts/verser-decrets-html.ts           (à blanc)
 *   npx tsx scripts/verser-decrets-html.ts --apply   (écrit)
 *
 * ⚠️ LE DÉCOUPAGE DOIT ÊTRE REFAIT SUR LA VERSION HTML. `bodyClean` est produit à partir
 * du fascicule ENTIER : le poser tel quel donnerait aux deux décrets du Spécial n° 41 le
 * même corps, et rendrait au décret sur les maisons de transfert la note d'audit du
 * transcripteur. On retrouve donc les mêmes bornes dans le texte propre.
 *
 * ⚠️ UN TABLEAU SUIT SON DÉCRET. Chaque bloc porte une ancre `afterText` — les derniers
 * mots du texte qui le précède. Un bloc dont l'ancre ne tombe pas dans la tranche
 * appartient à un autre texte du fascicule : le garder afficherait, sous un décret, le
 * tableau d'un autre.
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { wordToHtmlVersion } from '../src/lib/doc/word'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'
import type { RichBlock } from '../src/lib/doc/richblocks'

const SP41 = '/Users/cvaval/Downloads/Intermediaire de Change Moniteur_Special_N41_2020_RECONSTITUE.docx'

interface Cible {
  source: string
  fichier: string
  /** Première ligne du texte dans la version propre. */
  debut: RegExp
  /** Première ligne à EXCLURE (début du texte suivant, colophon, appareil…). */
  fin?: RegExp
}

const CIBLES: Cible[] = [
  {
    source: 'DECRET_BLANCHIMENT_2023',
    fichier: '/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur/Decret Blanchiment 2023.docx',
    debut: /^D[ÉE]CRET SANCTIONNANT LE BLANCHIMENT/i,
  },
  {
    source: 'DECRET_INTERMEDIAIRES_CHANGE_2020',
    fichier: SP41,
    debut: /^SUR LES INTERM[ÉE]DIAIRES DE CHANGE$/i,
    fin: /^FIXANT LES R[ÈE]GLES RELATIVES [ÀA] L.OBLIGATION D.AFFICHAGE DES PRIX/i,
  },
  {
    source: 'DECRET_AFFICHAGE_PRIX_2020',
    fichier: SP41,
    debut: /^FIXANT LES R[ÈE]GLES RELATIVES [ÀA] L.OBLIGATION D.AFFICHAGE DES PRIX/i,
    fin: /^Achev[ée] d.imprimer/i,
  },
  {
    source: 'DECRET_MAISONS_TRANSFERT_2020',
    fichier: '/Users/cvaval/Downloads/Decret_Maisons_de_Transfert_5_juin_2020.docx',
    debut: /^D[ÉE]CRET MODIFIANT CERTAINES DISPOSITIONS/i,
    fin: /^NOTE D.AUDIT$/i,
  },
]

/** Cache de conversion : le Spécial n° 41 sert deux fiches, on ne le convertit qu'une fois. */
const converti = new Map<string, Awaited<ReturnType<typeof wordToHtmlVersion>>>()
async function version(f: string) {
  if (!converti.has(f)) converti.set(f, await wordToHtmlVersion(readFileSync(f)))
  return converti.get(f)!
}

async function main() {
  const apply = process.argv.includes('--apply')
  for (const c of CIBLES) {
    const v = await version(c.fichier)
    const lignes = v.bodyClean.split('\n')
    let i = lignes.findIndex((l) => c.debut.test(l.trim()))
    if (i < 0) { console.error(`✗ ${c.source} : début introuvable dans la version propre`); continue }
    // ⚠️ MÊME BORNE QUE LE TEXTE OFFICIEL. L'import initial faisait commencer les décrets du
    // Spécial n° 41 à la ligne « RÉPUBLIQUE D'HAÏTI » qui les ouvre ; partir de l'intitulé
    // donnerait une version propre amputée de son en-tête et deux corps qui ne se
    // correspondent plus ligne à ligne.
    while (i > 0 && /^(R[ÉE]PUBLIQUE D.HA[ÏI]TI|LIBERT[ÉE]|D[ÉE]CRET)\b/i.test(lignes[i - 1].trim())) i--
    const j = c.fin ? lignes.findIndex((l, k) => k > i && c.fin!.test(l.trim())) : -1
    const bodyClean = lignes.slice(i, j > i ? j : lignes.length).join('\n').replace(/\n{3,}/g, '\n\n').trim()

    // Les tableaux dont l'ancre tombe dans la tranche — et eux seuls.
    const blocs = v.richBlocks.filter((b: RichBlock) => {
      const a = (b as { afterText?: string }).afterText
      return a ? bodyClean.includes(a) : false
    })
    const orphelins = v.richBlocks.length - blocs.length

    const doc = await prisma.document.findFirst({ where: { source: c.source }, select: { id: true, titleFr: true, bodyOriginal: true, bodyClean: true, richBlocksJson: true } })
    if (!doc) { console.error(`✗ ${c.source} : fiche absente`); continue }

    const richBlocksJson = blocs.length ? JSON.stringify(blocs) : null
    console.log(`\n### ${doc.titleFr.slice(0, 72)}`)
    console.log(`   corps officiel ${doc.bodyOriginal?.length ?? 0} car. → version propre ${bodyClean.length} car. · ${blocs.length} tableau(x)${orphelins ? ` (${orphelins} d'un autre texte du fascicule, écartés)` : ''}`)
    // Contrôle : la version propre doit dire la MÊME chose que le texte officiel. Un écart
    // de plus de 2 % signalerait une borne mal placée, pas une remise en forme.
    const ecart = Math.abs((bodyClean.length - (doc.bodyOriginal?.length ?? 0)) / Math.max(1, doc.bodyOriginal?.length ?? 1))
    if (ecart > 0.02) console.warn(`   ⚠ écart de ${(ecart * 100).toFixed(1)} % avec le texte officiel — borne à vérifier`)

    if (doc.bodyClean === bodyClean && doc.richBlocksJson === richBlocksJson) { console.log('   = inchangé'); continue }
    if (!apply) { console.log('   · à écrire (--apply)'); continue }

    await prisma.document.update({ where: { id: doc.id }, data: { bodyClean, richBlocksJson } })
    await reindexDocument(doc.id)
    await audit({ action: 'DOC_PUBLISHED', targetType: 'Document', targetId: doc.id, meta: { via: 'verser-decrets-html', source: c.source, bodyClean: bodyClean.length, tableaux: blocs.length } })
    console.log('   ✓ version HTML posée')
  }
  if (!apply) console.log('\n(exécution à blanc — ajouter --apply pour écrire)')
  await prisma.$disconnect()
}
main()
