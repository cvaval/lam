/**
 * Loi CEC 2002 — LE LOT FERME DES RENVOIS SORTANTS : les visas du préambule (§ 7.8).
 *
 *     npx tsx scripts/data/cec/maj2026-renvois-visas.ts            # simulation, n'écrit rien
 *     npx tsx scripts/data/cec/maj2026-renvois-visas.ts --apply    # lancé par Me Vaval, elle seule
 *
 * Trois des six « Vu » du préambule ont une cible au corpus ; ce script pose ces trois
 * renvois, kind CITE (un visa CITE, il n'abroge ni ne modifie — § 6.4), source EDITORIAL,
 * résolution PAR `source` (§ 7.8, jamais par titre ni par date seule) :
 *
 *   1. « Vu les articles 1, 111-1, 144, 245, 246 de la Constitution, »  → CONSTITUTION_1987
 *   2. « Vu la loi du 17 août 1979 créant la Banque de la République d'Haïti, »
 *        → CC_VANDAL_II-B-1 (la loi ORGANIQUE de la BRH). L'identification contre
 *        CC_VANDAL_II-A (« remplaçant ») est ÉTABLIE SUR PIÈCES — dossier complet :
 *        scripts/data/cec/maj2026-identification-loi-1979.md. L'argument décisif : le
 *        5ᵉ visa de la même loi vise « le décret du 27 mars 1985 modifiant les articles 9
 *        et 17 » de la loi ainsi nommée — articles que seule II-B-1 comporte (66 têtes),
 *        II-A s'arrêtant à l'article 3. Chaque fait est RE-VÉRIFIÉ ci-dessous sur les corps
 *        en base avant toute écriture.
 *   3. « Vu le décret du 17 mai 1995 sur la libéralisation des taux d'intérêt ; » → CC_VANDAL_II-M
 *
 * Les trois autres visas (décrets des 31 mars 1981, 2 avril 1981, 27 mars 1985) n'ont pas
 * de cible au corpus : AUCUN renvoi — ils vont au rapport (§ 13.7). L'UCREF 2017 ne cite
 * pas la loi (mesuré) : rien depuis elle (§ 12.11). Le lot des renvois ENTRANTS est
 * consigné SANS écriture dans maj2026-renvois-entrants-proposes.json (§ 13.9).
 *
 * Ces renvois sont NEUTRES vis-à-vis du § 13.1 (titre de la fiche) : leurs notes ne citent
 * aucune des deux dates de la loi ; leurs toLabel portent le titre des fiches CIBLES.
 *
 * Le CrossRef ENTRANT du décret sûretés (posé le 27 août) doit ressortir INTACT — vérifié
 * avant et après. Le script ne touche ni au corps, ni aux annotations, ni aux dates.
 *
 * COMPOSITION AVEC maj2026-lot-corps.ts : indifférente. Ce script n'exige du corps que ses
 * six visas ; il admet les deux empreintes du corps — avant et après la fusion § 7.4 des
 * trois libellés de TITRES (empreinte d'après calculée depuis maj2026-libelles-titres.json).
 * Une TROISIÈME empreinte, inconnue, interdit --apply : relire le corps, puis ajouter
 * l'empreinte à CORPS_ADMIS si — et seulement si — les visas et le préambule sont intacts.
 */
import { PrismaClient } from '@prisma/client'
import { createHash } from 'node:crypto'
import { reindexDocument } from '../../../src/lib/search/reindex'
import { audit } from '../../../src/lib/auth/audit'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')
const md5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex')

const SOURCE_CEC = 'LOI_CEC_2002'
const ID_CEC = 'cms8jhhz700004szrkm41yahg'

/** Les deux états admis du corps (§ 7.1 / § 7.4) — relevés et calculés le 27 août 2026. */
const CORPS_ADMIS: Record<string, string> = {
  '67a109181877e5e2b06c13c583992c9d': 'corps du relevé du 27 août (504 lignes) — lot-corps § 7.4 non appliqué',
  '5d781360044ab6db9eee8ba49f369261': 'corps après maj2026-lot-corps.ts (fusion des 3 libellés de TITRES, 501 lignes)',
}

/** Les visas, EN LETTRE DU CORPS (apostrophes U+2019 — lus du corps en base, jamais retapés). */
const VISA_CONSTITUTION = 'Vu les articles 1, 111-1, 144, 245, 246 de la Constitution,'
const VISA_1979 = 'Vu la loi du 17 août 1979 créant la Banque de la République d’Haïti,'
const VISA_1985 = 'Vu le décret du 27 mars 1985 modifiant les articles 9 et 17 de la Loi du 17 août 1979 créant la Banque de la République d’Haïti,'
const VISA_1995 = 'Vu le décret du 17 mai 1995 sur la libéralisation des taux d’intérêt ;'

// ══════════════════════════════════════════════════════════════════════════════════════════
// LES TROIS RENVOIS — cible, preuves sur pièce, note rédigée
// ══════════════════════════════════════════════════════════════════════════════════════════
interface Renvoi {
  visa: string
  sourceCible: string
  idCibleAttendu: string
  /** Chaînes qui DOIVENT se lire au corps de la cible — l'identité, pas l'homonyme. */
  preuvesCible: string[]
  note: string
}

const RENVOIS: Renvoi[] = [
  {
    visa: VISA_CONSTITUTION,
    sourceCible: 'CONSTITUTION_1987',
    idCibleAttendu: 'cmr1it23a0000b4r0l6r1xp5l',
    preuvesCible: ['Article 245', 'Article 246'],
    note:
      'Visé au préambule de la loi : « Vu les articles 1, 111-1, 144, 245, 246 de la ' +
      'Constitution, ». La fiche cible présente la Constitution du 29 mars 1987 dans sa ' +
      'rédaction consolidée, intégrant les amendements de la Loi constitutionnelle du ' +
      '9 mai 2011 ; en 2002, le visa s’entendait de la rédaction alors en vigueur.',
  },
  {
    visa: VISA_1979,
    sourceCible: 'CC_VANDAL_II-B-1',
    idCibleAttendu: 'cmrtiw94r0001ue7edw6au9ca',
    preuvesCible: [
      'Il est créé, par la présente, un organisme public autonome',
      'BANQUE DE LA RÉPUBLIQUE D’HAÏTI',
    ],
    note:
      'Visé au préambule : « Vu la loi du 17 août 1979 créant la Banque de la République ' +
      'd’Haïti, ». Trois lois du 17 août 1979 coexistent (Le Moniteur n° 72 du 11 septembre ' +
      '1979) : l’une remplace la Banque Nationale de la République d’Haïti par la BRH et la ' +
      'BNC, la deuxième organise la BRH, la troisième la Banque Nationale de Crédit. Le visa ' +
      'désigne la deuxième — la loi organique de la BRH, fiche cible de ce renvoi : c’est ' +
      'elle qui crée l’institution (article 1er : « Il est créé, par la présente, un ' +
      'organisme public autonome… dénommé : « BANQUE DE LA RÉPUBLIQUE D’HAÏTI » »), et le ' +
      'préambule de la même loi de 2002 vise aussi « le décret du 27 mars 1985 modifiant ' +
      'les articles 9 et 17 de la Loi du 17 août 1979 créant la Banque de la République ' +
      'd’Haïti » — articles que seule la loi organique comporte, la loi de remplacement ' +
      's’arrêtant à l’article 3.',
  },
  {
    visa: VISA_1995,
    sourceCible: 'CC_VANDAL_II-M',
    idCibleAttendu: 'cmrtiwna3000hue7eew1lauci',
    preuvesCible: ['établissant un plafond pour les taux', 'Moniteur No 50 du 29 juin 1995'],
    note:
      'Visé au préambule : « Vu le décret du 17 mai 1995 sur la libéralisation des taux ' +
      'd’intérêt ; ». La fiche cible porte le même décret sous son intitulé développé, ' +
      // L'intitulé est cité À LA LETTRE de la fiche (apostrophe droite comprise) — l'assertion
      // « la note contient titleFr » du § 3 ci-dessous le garantit.
      "« Décret du 17 mai 1995 supprimant le plafond des taux d'intérêt conventionnel et " +
      'abrogeant les décrets des 1er décembre 1976, 8 avril 1980 et 2 avril 1981 » ' +
      '(Le Moniteur n° 50 du 29 juin 1995) : même date, même objet, seul texte du corpus ' +
      'daté du 17 mai 1995.',
  },
]

const tetesArticles = (corps: string): Set<string> => {
  const s = new Set<string>()
  for (const m of corps.matchAll(/^Article\s+(\d+)/gm)) s.add(m[1])
  return s
}

async function main() {
  const p = (s = '') => console.log(s)

  // ════════════════════════════════════════════════════════════════════════════════════════
  // 1. LA FICHE — garde d'unicité (§ 10.7), empreinte du corps en première assertion
  // ════════════════════════════════════════════════════════════════════════════════════════
  const nCec = await prisma.document.count({ where: { source: SOURCE_CEC } })
  if (nCec !== 1) throw new Error(`${nCec} fiches ${SOURCE_CEC} — il en faut exactement 1`)
  const cec = await prisma.document.findFirstOrThrow({
    where: { source: SOURCE_CEC },
    select: { id: true, type: true, number: true, titleFr: true, publicationDate: true, bodyOriginal: true },
  })
  if (cec.id !== ID_CEC) throw new Error(`la fiche ${SOURCE_CEC} est ${cec.id}, attendu ${ID_CEC}`)
  const corps = cec.bodyOriginal ?? ''
  const empreinte = md5(corps)
  const etatCorps = CORPS_ADMIS[empreinte]
  if (!etatCorps) {
    p(`⚠ corps : md5 ${empreinte} — AUCUN des états admis (${Object.keys(CORPS_ADMIS).join(', ')}).`)
    p('  Les visas sont vérifiés un à un ci-dessous, mais --apply est REFUSÉ tant que cette')
    p('  empreinte n’a pas été relue et ajoutée à CORPS_ADMIS (en-tête du script).')
    if (APPLY) throw new Error('corps dans un état inconnu — --apply refusé (§ 10.8)')
  }

  // ════════════════════════════════════════════════════════════════════════════════════════
  // 2. LES VISAS, SUR PIÈCE — chacun présent EXACTEMENT une fois, dans le préambule
  // ════════════════════════════════════════════════════════════════════════════════════════
  const finPreambule = corps.indexOf('\nTITRE I')
  if (finPreambule < 0) throw new Error('« TITRE I » introuvable au corps — segmentation inattendue, STOP')
  for (const v of [VISA_CONSTITUTION, VISA_1979, VISA_1985, VISA_1995]) {
    const occurrences = corps.split(v).length - 1
    if (occurrences !== 1) throw new Error(`visa présent ${occurrences} fois (attendu 1) : « ${v.slice(0, 60)}… »`)
    if (corps.indexOf(v) > finPreambule) throw new Error(`visa hors du préambule : « ${v.slice(0, 60)}… »`)
  }

  // ════════════════════════════════════════════════════════════════════════════════════════
  // 3. LES CIBLES — résolution par source, exactement une ligne, identité prouvée au corps
  // ════════════════════════════════════════════════════════════════════════════════════════
  type Cible = { id: string; type: string; number: string | null; titleFr: string; bodyOriginal: string }
  const cibles = new Map<string, Cible>()
  for (const r of RENVOIS) {
    const lignes = await prisma.document.findMany({
      where: { source: r.sourceCible },
      select: { id: true, type: true, number: true, titleFr: true, bodyOriginal: true },
    })
    if (lignes.length !== 1)
      throw new Error(`résolution ${r.sourceCible} : ${lignes.length} ligne(s), il en faut exactement 1`)
    const c = lignes[0]
    if (c.id !== r.idCibleAttendu)
      throw new Error(`résolution ${r.sourceCible} : id ${c.id}, attendu ${r.idCibleAttendu} (relevé du 27 août)`)
    for (const preuve of r.preuvesCible)
      if (!c.bodyOriginal.includes(preuve))
        throw new Error(`cible ${r.sourceCible} : la preuve d'identité « ${preuve.slice(0, 60)} » ne se lit pas à son corps — NE PAS poser le renvoi`)
    // Une note qui cite l'intitulé de la cible doit le citer À LA LETTRE (apostrophes comprises).
    if (r.note.includes('intitulé développé') && !r.note.includes(c.titleFr))
      throw new Error(`la note vers ${r.sourceCible} cite un intitulé qui n'est pas, à la lettre, le titre de la fiche — la relire`)
    cibles.set(r.sourceCible, c)
  }

  // L'identification de 1979 (dossier maj2026-identification-loi-1979.md), re-vérifiée ici :
  // II-B-1 comporte les articles 9 et 17 que le 5ᵉ visa attribue à la loi visée ; II-A non.
  const iiA = await prisma.document.findMany({
    where: { source: 'CC_VANDAL_II-A' },
    select: { id: true, bodyOriginal: true },
  })
  if (iiA.length !== 1) throw new Error(`résolution CC_VANDAL_II-A : ${iiA.length} ligne(s), il en faut exactement 1`)
  const tetesA = tetesArticles(iiA[0].bodyOriginal)
  const tetesB1 = tetesArticles(cibles.get('CC_VANDAL_II-B-1')!.bodyOriginal)
  if (!tetesB1.has('9') || !tetesB1.has('17'))
    throw new Error('CC_VANDAL_II-B-1 : articles 9 et 17 introuvables — l’identification du dossier ne tient plus, STOP')
  if (tetesA.has('9') || tetesA.has('17'))
    throw new Error('CC_VANDAL_II-A comporte un article 9 ou 17 — le discriminant du dossier ne discrimine plus, STOP')
  if (!VISA_1985.includes('les articles 9 et 17'))
    throw new Error('le 5ᵉ visa ne cite plus les articles 9 et 17 — incohérence interne du script')

  // ════════════════════════════════════════════════════════════════════════════════════════
  // 4. L'ENTRANT DU DÉCRET SÛRETÉS — photographié avant, comparé après (§ 11.9)
  // ════════════════════════════════════════════════════════════════════════════════════════
  const entrantsAvant = await prisma.crossRef.findMany({
    where: { toId: cec.id },
    orderBy: { id: 'asc' },
    select: { id: true, fromId: true, kind: true, toLabel: true, note: true, position: true },
  })
  const photoEntrants = JSON.stringify(entrantsAvant)

  // ════════════════════════════════════════════════════════════════════════════════════════
  // 5. DÉDOUBLONNAGE ET POSITIONS
  // ════════════════════════════════════════════════════════════════════════════════════════
  const existants = await prisma.crossRef.findMany({
    where: { fromId: cec.id },
    select: { id: true, toId: true, kind: true },
  })
  const aCreer = RENVOIS.filter((r) => !existants.some((e) => e.toId === r.idCibleAttendu))
  const dejaPoses = RENVOIS.filter((r) => existants.some((e) => e.toId === r.idCibleAttendu))
  const posMax = await prisma.crossRef.aggregate({ where: { fromId: cec.id }, _max: { position: true } })
  let position = (posMax._max.position ?? -1) + 1

  // ════════════════════════════════════════════════════════════════════════════════════════
  // RAPPORT
  // ════════════════════════════════════════════════════════════════════════════════════════
  p('══════════════════════════════════════════════════════════════════════════════════')
  p('  LOI CEC 2002 — RENVOIS SORTANTS DES VISAS (§ 7.8, lot ferme)')
  p(`  ${cec.id} · source ${SOURCE_CEC} · corps md5 ${empreinte}${etatCorps ? ` (${etatCorps})` : ' (ÉTAT INCONNU)'}`)
  p('══════════════════════════════════════════════════════════════════════════════════')
  p()
  p(`Renvois sortants existants : ${existants.length} · entrants : ${entrantsAvant.length} (photographiés)`)
  p()
  for (const r of RENVOIS) {
    const c = cibles.get(r.sourceCible)!
    const etat = dejaPoses.includes(r) ? 'DÉJÀ POSÉ — rien à écrire' : 'À CRÉER'
    p(`■ ${r.sourceCible} → ${c.id} — ${etat}`)
    p(`  visa   : ${r.visa}`)
    p(`  cible  : « ${c.titleFr.slice(0, 96)} »`)
    p(`  kind CITE · source EDITORIAL · toLabel = titre actuel de la cible`)
    p(`  note   : ${r.note}`)
    p()
  }
  p('CE QUE LE LOT NE POSE PAS (au rapport, pas au regret) :')
  p('  · décrets des 31 mars 1981 (CNC), 2 avril 1981 (coopératives), 27 mars 1985 : sans')
  p('    cible au corpus — § 13.7 (fiches à créer un jour, ou renvois par désignation).')
  p('  · l’UCREF 2017 ne cite pas la loi (mesuré) — aucun renvoi (§ 12.11).')
  p('  · les renvois ENTRANTS (19 corps citants) : consignés sans écriture dans')
  p('    maj2026-renvois-entrants-proposes.json — § 13.9.')
  p()

  if (aCreer.length === 0) {
    p('Les renvois du lot existent tous — rien à écrire.')
    await prisma.$disconnect()
    return
  }

  if (!APPLY) {
    p('CE QUI SERAIT ÉCRIT')
    p(`  CrossRef : ${aCreer.length} création(s), positions ${aCreer.map((_, i) => position + i).join(', ')}`)
    p(`  AuditLog : ${aCreer.length} × CROSSREF_ADDED (cible d’audit : la fiche CEC)`)
    p('  reindexDocument : 1 document, HORS transaction')
    p()
    p('SIMULATION — rien n’a été écrit. --apply est réservé à Me Vaval (§ 10.2).')
    await prisma.$disconnect()
    return
  }

  // ════════════════════════════════════════════════════════════════════════════════════════
  // ÉCRITURE — transaction, audit recompté, réindexation hors transaction
  // ════════════════════════════════════════════════════════════════════════════════════════
  const auditsAvant = await prisma.auditLog.count({ where: { targetId: cec.id, action: 'CROSSREF_ADDED' } })

  await prisma.$transaction(
    async (tx) => {
      for (const r of aCreer) {
        const c = cibles.get(r.sourceCible)!
        await tx.crossRef.create({
          data: {
            fromId: cec.id,
            toId: c.id,
            toType: c.type,
            toNumber: c.number,
            toLabel: c.titleFr,
            kind: 'CITE',
            note: r.note,
            position: position++,
            source: 'EDITORIAL',
          },
        })
        await audit(
          {
            action: 'CROSSREF_ADDED',
            targetType: 'Document',
            targetId: cec.id,
            meta: {
              motif:
                `Visa du préambule de la loi CEC 2002 matérialisé en CrossRef CITE vers ${r.sourceCible} ` +
                '(§ 7.8 de la feuille de route du 27 août 2026 ; résolution par source ; ' +
                'identification de la loi de 1979 : scripts/data/cec/maj2026-identification-loi-1979.md).',
              visa: r.visa,
              toId: c.id,
              sourceCible: r.sourceCible,
              md5BodyOriginal: empreinte,
            },
          },
          tx,
        )
      }
    },
    { timeout: 60_000, maxWait: 15_000 },
  )

  // ⚠️ audit() avale ses erreurs : recompter APRÈS la transaction.
  const auditsApres = await prisma.auditLog.count({ where: { targetId: cec.id, action: 'CROSSREF_ADDED' } })

  // L'entrant du décret sûretés, INTACT (§ 11.9) — et rien d'autre n'est entré.
  const entrantsApres = await prisma.crossRef.findMany({
    where: { toId: cec.id },
    orderBy: { id: 'asc' },
    select: { id: true, fromId: true, kind: true, toLabel: true, note: true, position: true },
  })
  if (JSON.stringify(entrantsApres) !== photoEntrants)
    throw new Error('les renvois ENTRANTS de la fiche ont changé pendant le lot — ils ne devaient pas : investiguer immédiatement')

  // Chaque renvoi créé se RELIT.
  for (const r of RENVOIS) {
    const relu = await prisma.crossRef.findMany({ where: { fromId: cec.id, toId: r.idCibleAttendu } })
    if (relu.length !== 1) throw new Error(`après écriture : ${relu.length} renvoi(s) vers ${r.sourceCible}, attendu 1`)
    if (relu[0].kind !== 'CITE') throw new Error(`après écriture : kind ${relu[0].kind} vers ${r.sourceCible}, attendu CITE`)
  }
  // Les champs de la fiche n'ont pas bougé (§ 11.10).
  const ficheRelue = await prisma.document.findUniqueOrThrow({
    where: { id: cec.id },
    select: { titleFr: true, number: true, publicationDate: true, bodyOriginal: true },
  })
  if (ficheRelue.titleFr !== cec.titleFr || ficheRelue.number !== cec.number)
    throw new Error('après écriture : titre ou number de la fiche a bougé — il ne devait pas')
  if (String(ficheRelue.publicationDate) !== String(cec.publicationDate))
    throw new Error('après écriture : publicationDate a bougé — elle ne devait pas')
  if (md5(ficheRelue.bodyOriginal) !== empreinte)
    throw new Error('après écriture : le corps a changé — il ne devait pas')

  // ⚠️ HORS transaction (prend le singleton Prisma, et vide le cache de recherche).
  await reindexDocument(cec.id)

  p(`✓ ${aCreer.length} renvoi(s) posé(s) · entrants intacts · fiche inchangée · réindexé`)
  if (auditsApres - auditsAvant !== aCreer.length) {
    p()
    p('⛔ L’ÉCRITURE EST FAITE, MAIS L’AUDIT NE LA COUVRE PAS EN ENTIER.')
    p(`   CROSSREF_ADDED sur la fiche : ${auditsAvant} → ${auditsApres} (attendu +${aCreer.length}).`)
    p('   audit() avale ses erreurs — investiguer avant toute autre écriture.')
    process.exitCode = 1
  } else {
    p(`  journalisé et VÉRIFIÉ : CROSSREF_ADDED ${auditsAvant} → ${auditsApres}`)
  }
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('\nÉCHEC :', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
