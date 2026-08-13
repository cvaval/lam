/**
 * Moniteur Spécial n° 41 — DEUX décrets du 25 novembre 2020, en DEUX fiches.
 *
 *   npx tsx scripts/import-decrets-25-nov-2020.ts           (à blanc)
 *   npx tsx scripts/import-decrets-25-nov-2020.ts --apply   (écrit)
 *
 * ⚠️ UN FASCICULE N'EST PAS UN DOCUMENT. Le fichier porte deux décrets distincts, chacun
 * avec ses visas, son dispositif, ses abrogations et sa propre numérotation d'articles
 * (1→58 puis 1→12). Les verser en un seul bloc rendrait un « article 3 » ambigu et un renvoi
 * inexploitable. La césure se lit sur la structure du texte : l'en-tête « RÉPUBLIQUE
 * D'HAÏTI / DÉCRET » qui rouvre après la liste des signataires du premier.
 *
 * ⚠️ TROIS DATES, TROIS SENS, aucune ne remplace l'autre :
 *   adoptionDate     « Donné au Palais National, à Port-au-Prince, le 25 novembre 2020 »
 *   publicationDate  Le Moniteur, 175ᵉ Année, Spécial n° 41, lundi 30 novembre 2020
 *   effectiveDate    à défaut de disposition contraire, la publication vaut entrée en
 *                    vigueur — mais on ne l'INVENTE pas : elle reste nulle si le texte se tait.
 */
import { readFileSync } from 'node:fs'
import mammoth from 'mammoth'
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'

const FICHIER = '/Users/cvaval/Downloads/Intermediaire de Change Moniteur_Special_N41_2020_RECONSTITUE.docx'
const MONITEUR = 'Le Moniteur, 175ᵉ Année, Spécial n° 41 du 30 novembre 2020'
const ADOPTION = new Date('2020-11-25T00:00:00Z')
const PUBLICATION = new Date('2020-11-30T00:00:00Z')

interface Decret {
  source: string
  number: string
  titleFr: string
  matiere: string
  theme: string
  /** Intitulé en capitales qui ouvre le décret dans le fascicule. */
  entete: RegExp
}

const DECRETS: Decret[] = [
  {
    source: 'DECRET_INTERMEDIAIRES_CHANGE_2020',
    number: 'Décret du 25 novembre 2020 (intermédiaires de change)',
    titleFr: 'Décret sur les intermédiaires de change',
    matiere: 'bancaire',
    theme: 'Banques & institutions financières',
    entete: /^SUR LES INTERM[ÉE]DIAIRES DE CHANGE$/i,
  },
  {
    source: 'DECRET_AFFICHAGE_PRIX_2020',
    number: 'Décret du 25 novembre 2020 (affichage des prix)',
    titleFr:
      'Décret fixant les règles relatives à l’obligation d’affichage des prix, au paiement en gourde et à la part des marges bénéficiaires',
    matiere: 'commercial',
    theme: 'Droit commercial',
    entete: /^FIXANT LES R[ÈE]GLES RELATIVES [ÀA] L.OBLIGATION D.AFFICHAGE DES PRIX/i,
  },
]

/** Numéros d'article rencontrés, dans l'ordre — sert à prouver la césure. */
function articles(texte: string): string[] {
  return [...texte.matchAll(/^\s*Article\s+([\dᵉʳ.]+)/gim)].map((m) => m[1].replace(/[ᵉʳ]/g, ''))
}

async function main() {
  const apply = process.argv.includes('--apply')
  const brut = (await mammoth.extractRawText({ buffer: readFileSync(FICHIER) })).value
  const lignes = brut.split('\n').map((l) => l.replace(/\s+$/g, ''))

  // Repérage des deux en-têtes, puis découpe : chaque décret court de la ligne
  // « RÉPUBLIQUE D'HAÏTI » qui le précède jusqu'à celle du suivant (ou la fin).
  const debuts = DECRETS.map((d) => {
    const i = lignes.findIndex((l) => d.entete.test(l.trim()))
    if (i < 0) throw new Error(`En-tête introuvable : ${d.titleFr}`)
    // On remonte au « DÉCRET » puis à « RÉPUBLIQUE D'HAÏTI » qui l'ouvrent.
    let j = i
    while (j > 0 && !/^R[ÉE]PUBLIQUE D.HA[ÏI]TI$/i.test(lignes[j].trim())) j--
    return { d, debut: j, entete: i }
  })
  debuts.sort((a, b) => a.debut - b.debut)

  // ⚠️ LE FASCICULE NE S'ARRÊTE PAS AU DERNIER DÉCRET. Après les signataires vient le
  // colophon des Presses Nationales, puis — dans ce fichier — un AVIS de la BRH du
  // 14 décembre 2020 et ses LIGNES DIRECTRICES aux agents de change, prises en application
  // de l'article 56 du décret. Ce sont des textes de la BRH, postérieurs de trois semaines :
  // les laisser tomber dans le second décret y ajouterait 25 000 caractères qui n'en font
  // pas partie. On borne donc au colophon, et on DIT ce qui reste dehors.
  const colophon = lignes.findIndex((l) => /^Achev[ée] d.imprimer/i.test(l.trim()))
  const finFascicule = colophon > 0 ? colophon : lignes.length

  console.log(`fichier : ${brut.length} car. · ${lignes.length} lignes`)
  for (let k = 0; k < debuts.length; k++) {
    const { d, debut } = debuts[k]
    const fin = k + 1 < debuts.length ? debuts[k + 1].debut : finFascicule
    const texte = lignes.slice(debut, fin).join('\n').replace(/\n{3,}/g, '\n\n').trim()
    const arts = articles(texte)
    console.log(`\n### ${d.titleFr.slice(0, 74)}`)
    console.log(`   lignes ${debut}–${fin} · ${texte.length} car. · ${arts.length} articles : ${arts[0]} → ${arts[arts.length - 1]}`)
    console.log(`   adoption ${ADOPTION.toISOString().slice(0, 10)} · publication ${PUBLICATION.toISOString().slice(0, 10)}`)
    // ⚠️ Contrôle de césure : une numérotation qui repart à 1 au milieu signalerait que
    // les deux décrets sont restés collés.
    const reprises = arts.filter((a, i) => i > 0 && Number(a) < Number(arts[i - 1]) && !a.includes('.'))
    if (reprises.length) console.warn(`   ⚠ la numérotation repart à ${reprises.join(', ')} — césure douteuse`)
    if (!/Donné au Palais National/i.test(texte)) console.warn('   ⚠ pas de formule de clôture « Donné au Palais National »')

    const existant = await prisma.document.findFirst({ where: { type: 'LEGISLATION', source: d.source }, select: { id: true, bodyOriginal: true } })
    if (existant && existant.bodyOriginal === texte) { console.log('   = inchangé'); continue }
    if (!apply) { console.log(`   · ${existant ? 'à mettre à jour' : 'à créer'} (--apply)`); continue }

    const donnees = {
      type: 'LEGISLATION', status: 'EN_VIGUEUR', originalLang: 'fr',
      source: d.source, number: d.number, titleFr: d.titleFr, matiere: d.matiere,
      bodyOriginal: texte, moniteurRef: MONITEUR,
      adoptionDate: ADOPTION, publicationDate: PUBLICATION,
    }
    const doc = existant
      ? await prisma.document.update({ where: { id: existant.id }, data: donnees })
      : await prisma.document.create({ data: donnees })

    const theme = await prisma.theme.findFirst({ where: { labelFr: d.theme }, select: { id: true } })
    if (theme && !(await prisma.documentTheme.findFirst({ where: { documentId: doc.id, themeId: theme.id } }))) {
      await prisma.documentTheme.create({ data: { documentId: doc.id, themeId: theme.id, isPrimary: true } })
    } else if (!theme) console.warn(`   ⚠ thème « ${d.theme} » introuvable — fiche sans thème`)

    await reindexDocument(doc.id)
    await audit({ action: 'DOC_PUBLISHED', targetType: 'Document', targetId: doc.id, meta: { via: 'import-decrets-25-nov-2020', source: d.source, articles: arts.length } })
    console.log(`   ✓ ${existant ? 'mise à jour' : 'créée'} — ${doc.id}`)
  }
  // ⚠️ AUCUNE TRONCATURE SILENCIEUSE : ce qui n'est pas versé est nommé et compté.
  if (colophon > 0) {
    const reste = lignes.slice(colophon).join('\n').trim()
    const titres = lignes.slice(colophon).filter((l) => /^(AVIS|LIGNES DIRECTRICES|ANNEXE \d)/i.test(l.trim()))
    console.log(`\nNON VERSÉ — ${reste.length} car. après le colophon du fascicule :`)
    console.log(`   ${[...new Set(titres.map((t) => t.trim()))].join(' · ') || '(sans intitulé reconnu)'}`)
    console.log('   Textes de la BRH (avis du 14 décembre 2020 et lignes directrices aux agents de')
    console.log('   change, art. 56 du décret) — ils relèvent des circulaires BRH, pas de ces décrets.')
  }
  if (!apply) console.log('\n(exécution à blanc — ajouter --apply pour écrire)')
  await prisma.$disconnect()
}
main()
