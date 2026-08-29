/**
 * MARCHÉS PUBLICS — attacher les fac-similés aux 25 fiches (§ 13.9, « oui » de Me Vaval).
 *
 *     npx tsx scripts/attacher-facsimiles-marches-publics.ts            # simulation
 *     npx tsx scripts/attacher-facsimiles-marches-publics.ts --apply    # Me Vaval, elle seule
 *
 * ⚠️ LES NOMS DE FICHIERS MENTENT — CHAQUE PAIRAGE EST LU SUR LA COUVERTURE.
 * Le fichier `arrete-sanctionnant-le-manuel-de-procedures-...pdf` contient en réalité l'arrêté
 * d'ORGANISATION de la CNMP (page 115 du Spécial n° 10). Les 25 scans du dossier CNMP et les
 * 7 retenus dans `CNMP/Droit public/` ont donc été identifiés en RENDANT leur page 1 (et, pour
 * les extraits du Spécial n° 10 de 2009, leur page 3) et en LISANT le bandeau du Moniteur :
 * année, numéro, date. Aucun pairage ne repose sur un nom de fichier.
 *
 * ⚠️ 23 DES 25 SCANS N'ONT AUCUNE COUCHE TEXTE (mesuré : 2 caractères sur les deux premières
 * pages). Un pairage par comparaison de texte était donc impossible — d'où la lecture d'image.
 *
 * ⚠️ UN FAC-SIMILÉ EST UN FASCICULE, ET UN FASCICULE PORTE PARFOIS PLUSIEURS TEXTES.
 * Le Spécial n° 8 du 4 févr. 2021 porte les DEUX arrêtés de décembre 2020 ; le Spécial n° 52
 * du 9 nov. 2021 porte le décret sur les bénéficiaires effectifs ET l'arrêté des seuils de 2021.
 * Le même PDF est donc attaché à deux fiches — c'est exact, pas un doublon : il est téléversé
 * UNE fois (chemin déterministe par empreinte) et référencé deux fois.
 *
 * ⚠️ CE QUE LE SPÉCIAL N° 8 DOIT À ME VAVAL : elle a demandé la numérisation de février 2021
 * plutôt que les extraits du dossier CNMP. C'est `Droit public/27.` (20 p., fascicule entier).
 *
 * Mécanique reprise de `scripts/attacher-facsimile-ir-2005.ts` : Blob PRIVÉ « lam-pdfs »,
 * chemin déterministe `source-pdf/legislation/<docId>.pdf`, `multipart` au-delà de 4 Mo,
 * ⚠️ `BLOB_READ_WRITE_TOKEN` passé EXPLICITEMENT (sans lui le SDK privilégie le jeton OIDC,
 * qui lit mais n'écrit pas). Lecture par la route authentifiée `/api/doc/[id]/pdf`.
 */
import { prisma } from '../src/lib/db'
import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { uploadToBlob, isBlobUrl } from '../src/lib/storage/blob'
import { audit } from '../src/lib/auth/audit'

const APPLY = process.argv.includes('--apply')
const CNMP = '/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur/CNMP'
const DP = `${CNMP}/Droit public`

/** source → { fichier, pages attendues, fascicule LU sur la couverture } */
const PAIRAGE: { source: string; fichier: string; pages: number; lu: string }[] = [
  { source: 'MARCHES_DECRET_2004', fichier: `${CNMP}/decret-fixant-la-reglementation-des-marches-publics-de-services-de-fournitures-et-de-travaux-abroge.pdf`, pages: 24, lu: '160ème année, n° 12, lundi 14 février 2005' },
  { source: 'MARCHES_LOI_2009', fichier: `${CNMP}/LoiMarchesPublicsDu10Juin2009.pdf`, pages: 36, lu: 'reproduction n° 78 de la loi-mère (seul scan du lot à porter une couche texte)' },
  { source: 'MARCHES_ARR_MODALITES_2009', fichier: `${DP}/24. Arrete precisant les modalites d'application de la Loi fixant les regles generales relatives aux Marches Publics et aux CCOSP.pdf`, pages: 54, lu: '164ème année, Spécial n° 10, mercredi 4 novembre 2009' },
  { source: 'MARCHES_ARR_MANUEL_2009', fichier: `${DP}/23. Arrete sanctionnant le manuel de procedures pour la passation des Marches Publics et des CCOSP.pdf`, pages: 61, lu: '164ème année, Spécial n° 10, mercredi 4 novembre 2009' },
  { source: 'MARCHES_ARR_ORG_CNMP_2009', fichier: `${CNMP}/arrete-determinant-les-modalites-dorganisation-et-de-fonctionnement-de-la-commission-nationale-des-marches-public.pdf`, pages: 22, lu: '164ème année, Spécial n° 10, 2009 — texte lu page 3 (p. 115 du fascicule)' },
  { source: 'MARCHES_ARR_DAO_TRAVAUX_2011', fichier: `${DP}/20. Arrete sanctionnant pour sortir son plein et entier effet le Dossier d'Appel d'offres(2).pdf`, pages: 5, lu: '166ème année, Spécial n° 3, vendredi 13 mai 2011 — TOME I' },
  { source: 'MARCHES_ARR_CCAG_2011', fichier: `${DP}/21. Arrete sanctionnant pour sortir son plein et entier effet le dossier d'appel d'offres.pdf`, pages: 4, lu: '166ème année, Spécial n° 3, vendredi 13 mai 2011 — TOME IV' },
  { source: 'MARCHES_ARR_DTP_CONSULTANTS_2011', fichier: `${DP}/19. Arrete sanctionnant pour sortir son plein et entier effet le dossier d'appel d'offres(Informatique TOME III).pdf`, pages: 5, lu: '166ème année, Spécial n° 3, 2011 — TOME III' },
  { source: 'MARCHES_ARR_SEUILS_2012', fichier: `${CNMP}/Arrete fixant les seuils de passation des marches publics-Juin 2012.pdf`, pages: 4, lu: '167ème année, n° 104, VENDREDI 29 JUIN 2012 — reproduction pour erreurs matérielles' },
  { source: 'MARCHES_ARR_CHARTE_2012', fichier: `${DP}/6. Charte d'Ethique.pdf`, pages: 17, lu: '168ème année, n° 3, mercredi 9 janvier 2013 — numéro extraordinaire' },
  { source: 'MARCHES_ARR_DP_FOURNITURES_2017', fichier: `${CNMP}/ArreteManuelDeProcdedemandedeprixPrAcquisitionDeFournitures.pdf`, pages: 40, lu: '172e année, Spécial n° 25, jeudi 14 septembre 2017' },
  { source: 'MARCHES_ARR_CELERES_2017', fichier: `${CNMP}/arrete-sanctionnant-pour-sortir-leur-plein-en-entier-effet-manuel-de-proc-celeres-pr-la-passation-des-marches-publics-en-etat-durgence-declare.pdf`, pages: 40, lu: '172e année, Spécial n° 26, vendredi 15 septembre 2017' },
  { source: 'MARCHES_ARR_COTATIONS_TRAVAUX_2017', fichier: `${CNMP}/Arrete sanctionnant pour sortir leur plein en entier effet  Manuel de Proc et Dossier de demande de cotations pr les contrats de travaux.pdf`, pages: 52, lu: '172e année, Spécial n° 28, mercredi 20 septembre 2017' },
  { source: 'MARCHES_ARR_ALLEGES_TRAVAUX_2017', fichier: `${CNMP}/arrete-sanctionnant-pour-sortir-leur-plein-en-entier-effet-manuel-de-proc-allegee-et-dossier-pour-la-passation-des-marches-de-travaux.pdf`, pages: 76, lu: '172e année, Spécial n° 31, mardi 26 septembre 2017' },
  { source: 'MARCHES_ARR_ALLEGES_FOURNITURES_2017', fichier: `${CNMP}/arrete-sanctionnant-pour-sortir-leur-plein-en-entier-effet-manuel-de-proc-allégée-et-dossier-pour-la-passation-des-marchés-de-fournitures.pdf`, pages: 76, lu: '172e année, Spécial n° 35, vendredi 6 octobre 2017' },
  { source: 'MARCHES_ARR_ALLEGES_CONSULTANTS_2017', fichier: `${CNMP}/manuel-et-dossier-de-procédures-de-demande-de-propostion-pour-servives-de-consultants.pdf`, pages: 68, lu: '172e année, Spécial n° 42, mardi 5 décembre 2017' },
  { source: 'MARCHES_ARR_DEFENSE_2019', fichier: `${CNMP}/ARRETE-DU-9-JANVIER-2019-REVISANT-CELUI-DU-30-AOUT-2017-SUR-LES-MARCHES-INTERESSANT-LA-DEFENSE-OU-LA-SECURITE-NATIONALE.pdf`, pages: 8, lu: '174e année, Spécial n° 3, mercredi 16 janvier 2019' },
  { source: 'MARCHES_ARR_NOMINATION_CNMP_2019', fichier: `${CNMP}/Arrêté nommant les membres de la commission nationale des marchés publics (2019).pdf`, pages: 2, lu: '174e année, n° 221, lundi 30 décembre 2019' },
  { source: 'MARCHES_ARR_DEFENSE_2020', fichier: `${CNMP}/arrete-soumettant-les-marches-publics-de-defense-ou-de-securite-nationale-au-respect-des-principes-de-passation-des-marches-publics.pdf`, pages: 8, lu: '175e année, Spécial n° 1, mercredi 12 février 2020' },
  { source: 'MARCHES_ARR_MODIF_227_2020', fichier: `${DP}/27. Le Moniteur Spécial No. 8 Février 2021.pdf`, pages: 20, lu: '176e année, Spécial n° 8, jeudi 4 février 2021 — fascicule entier (numérisation de février 2021, demandée par Me Vaval)' },
  { source: 'MARCHES_ARR_COMPOSITION_CMMP_2020', fichier: `${DP}/27. Le Moniteur Spécial No. 8 Février 2021.pdf`, pages: 20, lu: '176e année, Spécial n° 8, jeudi 4 février 2021 — même fascicule, 2ᵉ arrêté' },
  { source: 'MARCHES_DECRET_BENEFICIAIRES_2021', fichier: `${CNMP}/decret-etablissant-lobligation-de-presenter-les-informations-permettant-didentifier-les-beneficiaires-effectifs-des-marches-publics-et-de-concessions.pdf`, pages: 12, lu: '176e année, Spécial n° 52, mardi 9 novembre 2021' },
  { source: 'MARCHES_ARR_SEUILS_2021', fichier: `${CNMP}/decret-etablissant-lobligation-de-presenter-les-informations-permettant-didentifier-les-beneficiaires-effectifs-des-marches-publics-et-de-concessions.pdf`, pages: 12, lu: '176e année, Spécial n° 52, 2021 — MÊME fascicule : son sommaire porte aussi l’arrêté des seuils, sous son intitulé exact « en dessous des seuils d’intervention »' },
  { source: 'MARCHES_ARR_SEUILS_2022', fichier: `${CNMP}/arrete-fixant-les-seuils-de-passation-des-marches-publics-et-les-seuils-dintervention-des-marches-publics.pdf`, pages: 8, lu: '177e année, Spécial n° 15, vendredi 10 juin 2022' },
  { source: 'MARCHES_CIRC_010_2023', fichier: `${CNMP}/circulaire_010.pdf`, pages: 8, lu: 'papier à en-tête de la Primature, signée — pas un fascicule du Moniteur' },
]

function pagesDe(f: string): number {
  const out = execFileSync('pdfinfo', [f], { encoding: 'utf8' })
  const m = out.match(/^Pages:\s+(\d+)/m)
  if (!m) throw new Error(`pdfinfo ne rend aucun compte de pages pour ${f}`)
  return Number(m[1])
}

async function main() {
  if (PAIRAGE.length !== 25) throw new Error(`${PAIRAGE.length} pairages, 25 attendus`)
  const docs = await prisma.document.findMany({
    where: { source: { startsWith: 'MARCHES_' } },
    select: { id: true, source: true, titleFr: true, sourcePdfUrl: true },
  })
  if (docs.length !== 25) throw new Error(`${docs.length} documents en base, 25 attendus`)

  // Chaque fiche doit être pairée UNE fois, et chaque pairage doit trouver sa fiche.
  const parSource = new Map(docs.map((d) => [d.source ?? '', d]))
  const vus = new Set<string>()
  for (const p of PAIRAGE) {
    if (!parSource.has(p.source)) throw new Error(`${p.source} : pairé mais absent de la base. STOP`)
    if (vus.has(p.source)) throw new Error(`${p.source} : pairé deux fois. STOP`)
    vus.add(p.source)
  }
  const orphelines = docs.filter((d) => !vus.has(d.source ?? ''))
  if (orphelines.length) throw new Error(`${orphelines.length} fiche(s) sans fac-similé : ${orphelines.map((d) => d.source).join(', ')}. STOP`)

  // ⚠️ LE COMPTE DE PAGES EST RE-MESURÉ : c'est le seul garde-fou automatique contre un fichier
  // déplacé ou remplacé depuis la lecture des couvertures.
  let octets = 0
  const empreintes = new Map<string, string>()
  for (const p of PAIRAGE) {
    statSync(p.fichier) // lève si absent
    const n = pagesDe(p.fichier)
    if (n !== p.pages)
      throw new Error(`${p.source} : le fichier fait ${n} pages, ${p.pages} lues à l'identification — la pièce a changé. STOP`)
    if (!empreintes.has(p.fichier)) {
      const buf = readFileSync(p.fichier)
      empreintes.set(p.fichier, createHash('md5').update(buf).digest('hex').slice(0, 10))
      octets += buf.length
    }
  }
  const dejaFait = docs.filter((d) => d.sourcePdfUrl)
  for (const d of dejaFait)
    if (!isBlobUrl(d.sourcePdfUrl)) throw new Error(`${d.source} porte déjà « ${d.sourcePdfUrl} », qui n'est pas une URL Blob : ne pas écraser sans lire. STOP`)

  console.log(`25 fiches · 25 pairages · ${empreintes.size} fichiers distincts · ${(octets / 1048576).toFixed(1)} Mo`)
  console.log(`déjà attachés : ${dejaFait.length}`)
  console.log('\nles deux fascicules qui portent deux textes :')
  for (const p of PAIRAGE.filter((x) => /SEUILS_2021|BENEFICIAIRES|MODIF_227|COMPOSITION_CMMP/.test(x.source)))
    console.log(`  ${p.source.padEnd(36)} ${empreintes.get(p.fichier)} · ${p.lu.slice(0, 76)}`)

  if (!APPLY) {
    console.log('\nSIMULATION — rien n’a été téléversé ni écrit. --apply est réservé à Me Vaval.')
    await prisma.$disconnect()
    return
  }

  const urls = new Map<string, string>()
  let i = 0
  for (const p of PAIRAGE) {
    const doc = parSource.get(p.source)!
    i++
    const cle = `${p.fichier}`
    if (!urls.has(cle)) {
      const buf = readFileSync(p.fichier)
      const url = await uploadToBlob(`source-pdf/legislation/${doc.id}.pdf`, buf, 'application/pdf', {
        multipart: buf.length > 4 * 1024 * 1024,
      })
      urls.set(cle, url)
      process.stdout.write(`\r  téléversé ${urls.size}/${empreintes.size} · ${p.source}                    `)
    }
    await prisma.document.update({ where: { id: doc.id }, data: { sourcePdfUrl: urls.get(cle)! } })
  }
  console.log(`\n  ${i} fiches renseignées`)

  await audit({
    action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: 'MARCHES_PUBLICS_FACSIMILES',
    meta: {
      motif:
        'Fac-similés attachés aux 25 fiches des marchés publics (§ 13.9, accord de Me Vaval du ' +
        '28 août 2026). Chaque pairage est lu sur le BANDEAU du fascicule (page 1, ou page 3 pour ' +
        'les extraits du Spécial n° 10 de 2009), jamais sur un nom de fichier : le fichier dit ' +
        '« manuel de procédures » contenait en réalité l’arrêté d’organisation de la CNMP. ' +
        '23 des 25 scans n’ont aucune couche texte. Deux fascicules portent chacun deux textes du ' +
        'corpus (Spécial n° 8 de 2021, Spécial n° 52 de 2021) : le PDF y est téléversé une fois et ' +
        'référencé deux fois. Spécial n° 8 : numérisation de février 2021, choisie par Me Vaval.',
      fiches: i, fichiers: empreintes.size,
    },
  })
  const journal = await prisma.auditLog.count({ where: { targetId: 'MARCHES_PUBLICS_FACSIMILES' } })
  const ctrl = await prisma.document.count({ where: { source: { startsWith: 'MARCHES_' }, sourcePdfUrl: { not: null } } })
  console.log(`\n✓ ${ctrl} / 25 fiches portent un fac-similé · AuditLog ${journal} (recompté)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('ÉCHEC :', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
