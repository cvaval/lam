/**
 * Verse le corpus des JEUX DE HASARD ET D'ARGENT — sept textes, de 1958 à 2026.
 *
 *   npx tsx scripts/verser-corpus-jeux-hasard.ts            (à blanc)
 *   npx tsx scripts/verser-corpus-jeux-hasard.ts --commit   (écrit)
 *
 * Cf. docs/prompt-jeux-de-hasard-2026.md, docs/prompt-loterie-etat-haitien-1958-1960.md
 * et docs/analyse-abrogations-jeux-1958-1960-vs-2026.md.
 *
 * ⚠️ TROIS CONVENTIONS DE TÊTE D'ARTICLE DANS UN MÊME CORPUS. Les textes de 1958-1960
 * écrivent « Article 1er.— » au TIRET CADRATIN ; ceux de 2026, « Article 1er.- » au trait
 * d'union. Un analyseur calé sur l'un ne voit RIEN de l'autre — mon premier relevé a compté
 * zéro article sur les trois fascicules anciens, pour cette seule raison.
 *
 * ⚠️ UN FASCICULE ANCIEN PORTE PLUSIEURS ACTES. Le Moniteur n° 47 de 1958 en contient NEUF,
 * le n° 97 de 1960 en contient SIX. L'article 1er y revient donc autant de fois : la borne
 * d'un acte est le RETOUR à l'article 1er, jamais la fin du fichier.
 */
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'
import { buildSearchText, fold } from '../src/lib/search/normalize'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const DL = '/Users/cvaval/Downloads'

/** Tête d'article, les DEUX ponctuations — cadratin de 1958-60, trait d'union de 2026. */
const TETE = /^Article\s+(\d+(?:er)?(?:\.\d+)?)\s*\.?\s*[—–-]/

interface Texte {
  source: string
  titre: string
  fichier: string
  /** Première ligne du texte dans le fascicule (0 = tout le fichier après la manchette). */
  debut: number
  articles: number
  adoption: string
  publication: string
  moniteurRef: string
  themes: string[]
}

const TEXTES: Texte[] = [
  {
    source: 'LOI_LOTERIE_LEH_1958',
    titre: "Loi du 24 mars 1958 portant organisation de la Loterie de l'État Haïtien",
    fichier: 'Le_Moniteur_No47_14_avril_1958.docx',
    debut: 40, articles: 35,
    adoption: '1958-03-24', publication: '1958-04-14',
    moniteurRef: 'Le Moniteur, 113ᵉ Année, n° 47, lundi 14 avril 1958',
    themes: ['jeux-loterie-casinos'],
  },
  {
    source: 'LOI_LOTERIE_LEH_REFORME_1958',
    titre: "Loi du 2 septembre 1958 modifiant et complétant certaines dispositions de la Loi organique de la Loterie de l'État Haïtien",
    fichier: 'Le_Moniteur_No101_4_septembre_1958.docx',
    debut: 32, articles: 17,
    adoption: '1958-09-02', publication: '1958-09-04',
    moniteurRef: 'Le Moniteur, 113ᵉ Année, n° 101, jeudi 4 septembre 1958',
    themes: ['jeux-loterie-casinos'],
  },
  {
    source: 'DECRET_CASINOS_1960',
    titre: "Décret du 20 octobre 1960 réservant exclusivement à l'État le droit d'établir et d'exploiter les casinos et autres maisons de jeux de grand luxe et mettant des obligations à la charge des concessionnaires bénéficiaires",
    fichier: 'Le_Moniteur_No97_20_octobre_1960.docx',
    debut: 124, articles: 13,
    adoption: '1960-10-20', publication: '1960-10-20',
    moniteurRef: 'Le Moniteur, 115ᵉ Année, n° 97, jeudi 20 octobre 1960',
    themes: ['jeux-loterie-casinos'],
  },
  {
    source: 'ARRETE_LEH_PERSONNEL_1960',
    titre: "Arrêté du 8 mars 1960 définissant le statut du Personnel de la Loterie de l'État Haïtien",
    fichier: 'Le_Moniteur_28_Mars_1960_No30_transcription.docx',
    debut: 9, articles: 33,
    adoption: '1960-03-08', publication: '1960-03-28',
    moniteurRef: 'Le Moniteur, 115ᵉ Année, n° 30, lundi 28 mars 1960',
    themes: ['jeux-loterie-casinos'],
  },
  {
    source: 'DECRET_ANJHA_2026',
    titre: "Décret du 11 août 2026 portant création, organisation et fonctionnement de l'Autorité Nationale des Jeux de Hasard et d'Argent (ANJHA)",
    fichier: 'Le_Moniteur_Special_No_43_21_aout_2026_ANJHA.docx',
    debut: 14, articles: 33,
    adoption: '2026-08-11', publication: '2026-08-21',
    moniteurRef: 'Le Moniteur, 181ᵉ Année, Spécial n° 43, vendredi 21 août 2026',
    themes: ['jeux-anjha'],
  },
  {
    source: 'DECRET_JEUX_HASARD_2026',
    titre: "Décret du 11 août 2026 portant règlementation des jeux de hasard et d'argent",
    fichier: 'Le_Moniteur_Special_43-A_Decret_Jeux_de_Hasard.docx',
    debut: 12, articles: 75,
    adoption: '2026-08-11', publication: '2026-08-21',
    moniteurRef: 'Le Moniteur, 181ᵉ Année, Spécial n° 43-A, vendredi 21 août 2026',
    themes: ['jeux-reglementation'],
  },
  {
    source: 'DECRET_JEUX_IMPOSITION_2026',
    titre: "Décret du 11 août 2026 établissant le régime d'imposition applicable aux jeux de hasard et d'argent",
    fichier: 'Le_Moniteur_Special_43-B_21_aout_2026.docx',
    debut: 10, articles: 23,
    adoption: '2026-08-11', publication: '2026-08-21',
    moniteurRef: 'Le Moniteur, 181ᵉ Année, Spécial n° 43-B, vendredi 21 août 2026',
    themes: ['jeux-fiscalite', 'fiscalite'],
  },
]

/** Lignes utiles d'un .docx. ⚠️ `<w:tab/>` → espace : sans quoi les colonnes se collent. */
function lignes(fichier: string): string[] {
  const xml = execFileSync('unzip', ['-p', `${DL}/${fichier}`, 'word/document.xml'], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  })
  return xml
    .replace(/<w:tab\/>/g, ' ')
    .replace(/<\/w:p>|<w:br\/>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .split('\n').map((l) => l.trim()).filter(Boolean)
}

/** Extrait UN acte : de `debut` jusqu'au retour de l'article 1er, signatures comprises. */
function extraire(t: Texte): { corps: string; arts: string[] } {
  const L = lignes(t.fichier)
  const arts: string[] = []
  let dernier = t.debut
  let i = t.debut
  for (; i < L.length; i++) {
    const m = TETE.exec(L[i])
    if (!m) continue
    const n = m[1]
    // ⚠️ Le retour à « Article 1er » ouvre l'acte SUIVANT — c'est la seule borne fiable.
    if (n === '1er' && arts.length) break
    // Garde-fou : « Article 7904-R » est un numéro de brevet, pas un article.
    if (/^\d+$/.test(n) && Number(n) > 400) break
    arts.push(n)
    dernier = i
  }
  /**
   * On prolonge jusqu'aux signatures — et l'on S'ARRÊTE AU TITRE DE L'ACTE SUIVANT.
   *
   * ⚠️ LE RETOUR À L'ARTICLE 1er BORNE LE DISPOSITIF, PAS LE FASCICULE. Après le dernier
   * article viennent la formule de promulgation et les signatures, puis — sans autre
   * séparateur qu'une ligne « LOI », « DÉCRET » ou « ARRÊTÉ » — l'acte suivant commence par
   * son propre préambule. Une première version balayait quarante lignes en quête de
   * signatures : le décret des casinos avalait l'arrêté sur le chômage du Jour des
   * Nations-Unies, et la réforme de 1958 la loi fondant le Lycée de l'Arcahaie. Les deux
   * s'affichaient alors avec DEUX articles 1er, et c'est le second qui se lisait.
   */
  const TITRE_ACTE = /^(LOI|DÉCRET|DECRET|ARRÊTÉ|ARRETE|AVIS|DÉCRET-LOI)$/
  let fin = dernier
  for (let k = dernier + 1; k < Math.min(L.length, dernier + 40); k++) {
    if (TITRE_ACTE.test(L[k].trim())) break
    if (/^(Donné|Fait à|Fait au|Le Président|Par le Président|Par :|Dr\. |Les Secrétaires|Le Secrétaire d|Le Premier Ministre|Le Ministre|La Ministre|Pr\. |[A-ZÉÈÀÇ][A-ZÉÈÀÇ' .-]{4,}$)/.test(L[k])) fin = k
    else if (L[k] === L[k].toUpperCase() && L[k].length > 8) break
  }
  return { corps: L.slice(t.debut, fin + 1).join('\n'), arts }
}

async function main() {
  const commit = process.argv.includes('--commit')
  console.log('CORPUS DES JEUX DE HASARD ET D’ARGENT — 7 textes\n')

  const prets: { t: Texte; corps: string; arts: string[] }[] = []
  let stop = false
  for (const t of TEXTES) {
    const { corps, arts } = extraire(t)
    const ok = arts.length === t.articles
    console.log(
      `  ${ok ? '✔' : '⛔'} ${t.source.padEnd(30)} ${String(arts.length).padStart(3)}/${t.articles} art. · ${corps.length.toLocaleString('fr')} c.`,
    )
    if (!ok) { console.log(`      attendu ${t.articles}, trouvé ${arts.length} : ${arts.slice(0, 6).join(', ')}…`); stop = true }
    prets.push({ t, corps, arts })
  }
  if (stop) {
    console.error('\n⛔ ARRÊT — un compte d’articles ne tombe pas. Rien n’est écrit.')
    process.exit(1)
  }

  const deja = await prisma.document.findMany({
    where: { source: { in: TEXTES.map((t) => t.source) } }, select: { source: true },
  })
  console.log(`\n  ${deja.length} déjà en base${deja.length ? ' : ' + deja.map((x) => x.source).join(', ') : ''}`)

  if (!commit) { console.log('\n(à blanc — ajouter --commit pour écrire)'); await prisma.$disconnect(); return }

  const connus = new Set(deja.map((x) => x.source))
  let n = 0
  for (const { t, corps } of prets) {
    if (connus.has(t.source)) { console.log(`   = ${t.source} — déjà versé, sauté`); continue }
    const doc = await prisma.document.create({
      data: {
        type: 'LEGISLATION',
        status: 'EN_VIGUEUR',
        source: t.source,
        // ⚠️ LA RÉFÉRENCE EST LE TITRE COMPLET (règle du 26 août) : sans quoi les deux lois
        // de 1958 et les trois décrets de 2026 se présenteraient sous une même mention.
        number: t.titre,
        titleFr: t.titre,
        bodyOriginal: corps,
        moniteurRef: t.moniteurRef,
        adoptionDate: new Date(`${t.adoption}T00:00:00Z`),
        publicationDate: new Date(`${t.publication}T00:00:00Z`),
        sealed: false,
        searchText: [buildSearchText({ titleFr: t.titre, number: t.titre, moniteurRef: t.moniteurRef }), fold(corps)]
          .filter(Boolean).join(' '),
      },
    })
    for (const [i, slug] of t.themes.entries()) {
      const th = await prisma.theme.findUnique({ where: { slug }, select: { id: true } })
      if (!th) { console.log(`   ⚠ thème « ${slug} » introuvable`); continue }
      await prisma.documentTheme.create({ data: { documentId: doc.id, themeId: th.id, isPrimary: i === 0 } })
    }
    n++
    console.log(`   + ${t.source}`)
  }
  await audit({ action: 'DOC_PUBLISHED', targetType: 'DOCUMENT', meta: { via: 'verser-corpus-jeux-hasard', textes: n } })
  console.log(`\n✅ ${n} textes versés.`)
  await prisma.$disconnect()
}

main()
