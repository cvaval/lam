/**
 * PRIX, CONCURRENCE ET PROTECTION DU CONSOMMATEUR — le sous-thème et trois textes.
 *
 *     npx tsx scripts/importer-prix-consommateur.ts            # simulation
 *     npx tsx scripts/importer-prix-consommateur.ts --apply    # Me Vaval, elle seule
 *
 * ⚠️ CINQ FICHIERS, QUATRE TEXTES, TROIS À VERSER. « Affichage des Prix en HTG 2020.docx » et
 * « Le Moniteur - Special No 41 » sont BYTE-IDENTIQUES ; et le décret qu'ils portent est DÉJÀ au
 * corpus (`DECRET_AFFICHAGE_PRIX_2020`), en PLUS COMPLET que la pièce — 145 lignes contre 112.
 * Il n'est donc pas versé : il sert de pièce de contrôle, et le script COMPARE ses 13 articles
 * sans rien y écrire.
 *
 * ⚠️ LA LOI DE 1939 A BIEN UN INTITULÉ, au sommaire du fascicule : « Loi autorisant le Pouvoir
 * Exécutif à prendre par voie d'Arrêtés ou de Décrets présidentiels, toutes mesures d'urgence pour
 * protéger les consommateurs contre les spéculations commerciales. » Le nom du fichier
 * (« Speculation Commerciale ») n'en est pas un.
 *
 * ⚠️ LES DATES SE LISENT DANS LES FORMULES, ET LES ÉCARTS SONT GRANDS :
 *   · Loi de 1939 — Chambre le 11 sept., MAISON NATIONALE LE 12 SEPT. (dernier vote), promulguée
 *     le 12, publiée le 14. Une loi porte la date de son DERNIER VOTE ⇒ 1939-09-12.
 *   · Arrêté de 2018 — signé le 19 sept., publié le 9 oct. (20 jours).
 *   · Décret consommateur — signé le 11 mars 2020, publié le 22 juillet (PLUS DE QUATRE MOIS).
 *     ⚠️ Le nom du fichier dit « 22 juillet » : il ne se trompe pas, il nomme la PUBLICATION.
 *
 * ⚠️ ON AJOUTE, ON NE DÉPLACE PAS. Les trois textes déjà au corpus reçoivent le sous-thème en
 * rattachement NON primaire : leurs thèmes actuels ne bougent pas (règle de la maison).
 */
import { prisma } from '../src/lib/db'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { audit } from '../src/lib/auth/audit'
import { reindexDocument } from '../src/lib/search/reindex'
import { articleAnchorFromHeading } from '../src/lib/doc/anchors'

const APPLY = process.argv.includes('--apply')
const D = join(process.cwd(), 'scripts/data/commerce-prix')
const lire = (f: string) => readFileSync(join(D, f), 'utf8').replace(/\n+$/, '')
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, "'").replace(/[—–]/g, '-').replace(/\s+/g, ' ').trim()

const THEME = {
  slug: 'prix-concurrence-consommateur',
  labelFr: 'Prix, concurrence et protection du consommateur',
  labelEn: 'Prices, competition and consumer protection',
  labelHt: 'Pri, konkirans ak pwoteksyon konsomatè',
}

const FICHES = [
  {
    source: 'LOI_MESURES_URGENCE_1939', corps: 'corps-speculation.txt', articles: 3,
    titre: 'Loi du 12 septembre 1939 autorisant le Pouvoir Exécutif à prendre par voie d’Arrêtés ou de Décrets présidentiels, toutes mesures d’urgence pour protéger les consommateurs contre les spéculations commerciales',
    adoption: '1939-09-12', publication: '1939-09-14',
    moniteur: 'Le Moniteur · LM1939-75 · 94ᵉ année, n° 75 du jeudi 14 septembre 1939',
  },
  {
    source: 'ARRETE_PRIX_MONNAIE_NATIONALE_2018', corps: 'corps-no175.txt', articles: 6,
    titre: 'Arrêté du 19 septembre 2018 portant obligation de libeller et d’afficher les prix des biens et services sur le territoire haïtien dans la monnaie nationale',
    adoption: '2018-09-19', publication: '2018-10-09',
    moniteur: 'Le Moniteur · LM2018-175 · 173ᵉ année, n° 175 du 9 octobre 2018',
  },
  {
    source: 'DECRET_PROTECTION_CONSOMMATEUR_2020', corps: 'corps-consommateur.txt', articles: 44,
    titre: 'Décret du 11 mars 2020 fixant les règles relatives à la sécurité des biens et services, la loyauté des transactions économiques et la protection du consommateur',
    adoption: '2020-03-11', publication: '2020-07-22',
    moniteur: 'Le Moniteur · LM2020-SP17 · 175ᵉ année, Spécial n° 17 du mercredi 22 juillet 2020',
  },
]
/** Les trois du corpus qui REÇOIVENT le sous-thème, sans rien perdre. */
const A_RATTACHER = ['DECRET_AFFICHAGE_PRIX_2020', 'CC_VANDAL_I-P-1', 'CC_VANDAL_I-P-2']

function ancres(corps: string) {
  return [...new Set(corps.split('\n').map((x) => articleAnchorFromHeading(x.trim())).filter(Boolean) as string[])]
}

async function main() {
  // ⚠️ ENFANT DIRECT DE « Droit économique & des affaires », PAS DE « Droit commercial ».
  // Le menu de domaine de la recherche n'aplatit que DEUX niveaux
  // (src/app/[locale]/(app)/search/page.tsx : `aplatir(null, 0)` puis `if (profondeur >= NIVEAUX)
  // return`, NIVEAUX = 2) : les racines et leurs enfants y entrent, les PETITS-ENFANTS non.
  // Créé sous « Droit commercial » le 29 août 2026, ce thème était petit-enfant : lui et ses six
  // documents — dont le Décret du 11 mars 2020 sur la protection du consommateur — étaient absents
  // du filtre. Remonté le même jour d'un cran (scripts/remonter-theme-prix-consommateur.ts, décision
  // de Me Vaval). Ce script est corrigé pour que le rejouer ne recrée pas la branche au mauvais
  // endroit : l'idempotence de la ligne suivante le protège tant que le thème existe, mais sur une
  // base neuve, elle ne protège rien.
  const parent = await prisma.theme.findFirst({ where: { slug: 'economique' }, select: { id: true, labelFr: true } })
  if (!parent) throw new Error('thème economique introuvable. STOP')
  if (await prisma.theme.findFirst({ where: { slug: THEME.slug } })) { console.log('sous-thème déjà créé — rien à faire.'); await prisma.$disconnect(); return }
  const deja = await prisma.document.findMany({ where: { source: { in: FICHES.map((f) => f.source) } }, select: { source: true } })
  if (deja.length) throw new Error(`${deja.length} fiche(s) déjà versée(s) : ${deja.map((d) => d.source).join(', ')}. STOP`)

  const prep = FICHES.map((f) => {
    const corps = lire(f.corps)
    const a = ancres(corps)
    if (a.length !== f.articles) throw new Error(`${f.source} : ${a.length} têtes, ${f.articles} attendues. STOP`)
    for (let n = 1; n <= f.articles; n++) if (!a.includes(`art-${n}`)) throw new Error(`${f.source} : article ${n} manquant. STOP`)
    return { f, corps, a }
  })

  const arattacher = await prisma.document.findMany({ where: { source: { in: A_RATTACHER } }, select: { id: true, source: true, titleFr: true, themes: { select: { isPrimary: true, theme: { select: { slug: true } } } } } })
  if (arattacher.length !== 3) throw new Error(`${arattacher.length} textes à rattacher, 3 attendus. STOP`)
  for (const d of arattacher) if (d.themes.some((t) => t.theme.slug === THEME.slug)) throw new Error(`${d.source} porte déjà le sous-thème. STOP`)

  // ── Le décret déjà au corpus : on COMPARE, on n'écrit pas ──
  const ref = await prisma.document.findFirst({ where: { source: 'DECRET_AFFICHAGE_PRIX_2020' }, select: { id: true, bodyOriginal: true } })
  const empreinte = createHash('md5').update(ref?.bodyOriginal ?? '').digest('hex')
  const piece = lire('affichage.txt').split('\n')
  const base = (ref?.bodyOriginal ?? '').split('\n')
  // ⚠️ LE DÉCOUPAGE PASSE PAR `articleAnchorFromHeading`, JAMAIS PAR UNE EXPRESSION MAISON.
  // Essayé d'abord avec `^Article N…[—-]` : la pièce écrit « Article 6. » avec un point et SANS
  // tiret, et six articles ont paru « absents » ou fondus dans le précédent. Six fausses
  // divergences, toutes imputables à ma propre expression. La fonction de la plateforme, elle,
  // connaît toutes les ponctuations du Journal officiel.
  const bloc = (l: string[], cible: string) => {
    const i = l.findIndex((x) => articleAnchorFromHeading(x.trim()) === cible)
    if (i < 0) return null
    const j = l.findIndex((x, k) => k > i && Boolean(articleAnchorFromHeading(x.trim())))
    return norm(l.slice(i, j < 0 ? l.length : j).join(' '))
  }
  // ⚠️ ON PARCOURT LES ANCRES RÉELLES, PAS UNE SUITE DE 1 À N. Essayé d'abord avec `for n = 1..13` :
  // le décret a bien treize ancres, mais la treizième est `art-3-1` — pas `art-13`. La boucle
  // déclarait donc « article 13 absent de la base », alors que ni la base ni la pièce n'en a.
  // Une numérotation supposée est une hypothèse, pas une mesure.
  const ancresRef = [...new Set([...ancres(base.join('\n')), ...ancres(piece.join('\n'))])]
  const divergents: string[] = []
  for (const n of ancresRef) {
    const a = bloc(base, n), b = bloc(piece, n)
    if (a === null || b === null) { divergents.push(`${n} : ${a === null ? 'absent de la BASE' : 'absent de la pièce'}`); continue }
    if (a !== b) {
      const wa = a.split(' '), wb = b.split(' ')
      let k = 0; while (k < wa.length && k < wb.length && wa[k] === wb[k]) k++
      divergents.push(`${n} : base « …${wa.slice(Math.max(0, k - 5), k + 7).join(' ')}… » / pièce « …${wb.slice(Math.max(0, k - 5), k + 7).join(' ')}… »`)
    }
  }

  console.log(`sous-thème « ${THEME.labelFr} » [${THEME.slug}] sous « ${parent.labelFr} »`)
  console.log(`   En « ${THEME.labelEn} » · Ht « ${THEME.labelHt} »\n`)
  for (const { f, corps, a } of prep)
    console.log(`  ${f.source.padEnd(38)} ${String(corps.split('\n').length).padStart(3)} l. · ${String(a.length).padStart(2)} art. · adopté ${f.adoption} · publié ${f.publication}`)
  console.log(`\n  reçoivent le sous-thème en NON primaire (sans rien perdre) :`)
  for (const d of arattacher) console.log(`    ${d.source?.padEnd(28)} thèmes actuels : ${d.themes.map((t) => t.theme.slug + (t.isPrimary ? '★' : '')).join(', ')}`)
  console.log(`\n── contrôle du décret du 25 novembre 2020 contre la pièce (${ancresRef.length} ancres réelles) ──`)
  console.log(divergents.length ? `  ⚠️ ${divergents.length} divergence(s) :` : `  aucune divergence ✓`)
  for (const x of divergents.slice(0, 8)) console.log('     ' + x.slice(0, 190))
  console.log(`  la fiche en base n'est PAS touchée (empreinte ${empreinte.slice(0, 10)})`)

  if (!APPLY) { console.log('\nSIMULATION — rien n’a été écrit.'); await prisma.$disconnect(); return }

  const max = await prisma.theme.aggregate({ where: { parentId: parent.id }, _max: { position: true } })
  const ids = new Map<string, string>()
  await prisma.$transaction(async (tx) => {
    const th = await tx.theme.create({ data: { ...THEME, parentId: parent.id, position: (max._max.position ?? -1) + 1 } })
    for (const { f, corps, a } of prep) {
      const doc = await tx.document.create({
        data: {
          type: 'LEGISLATION', status: 'EN_VIGUEUR', titleFr: f.titre, number: f.titre,
          bodyOriginal: corps, originalLang: 'fr', source: f.source, category: 'LEGISLATION',
          moniteurRef: f.moniteur,
          adoptionDate: new Date(`${f.adoption}T00:00:00Z`), publicationDate: new Date(`${f.publication}T00:00:00Z`),
          annotationsJson: JSON.stringify({
            title: f.titre, annotationAuthor: '', navToc: [], toc: [], connexes: [], jurisprudence: {},
            indexEntries: [], labels: Object.fromEntries(a.map((x) => [x, `Article ${x.replace('art-', '')}`])),
          }),
        },
      })
      ids.set(f.source, doc.id)
      await tx.documentTheme.create({ data: { documentId: doc.id, themeId: th.id, isPrimary: true, assignedBy: 'IMPORT' } })
    }
    // ⚠️ NON primaire : leur primaire actuel reste, DocumentTheme_one_primary est préservé.
    for (const d of arattacher) await tx.documentTheme.create({ data: { documentId: d.id, themeId: th.id, isPrimary: false, assignedBy: 'ADMIN' } })

    // ── Les renvois FONDÉS SUR UNE CLAUSE, jamais sur un rapprochement de matière ──
    const id39 = ids.get('LOI_MESURES_URGENCE_1939')!, id18 = ids.get('ARRETE_PRIX_MONNAIE_NATIONALE_2018')!, id20 = ids.get('DECRET_PROTECTION_CONSOMMATEUR_2020')!
    const l46 = arattacher.find((d) => d.source === 'CC_VANDAL_I-P-1')!
    await tx.crossRef.createMany({
      data: [
        { fromId: ref!.id, toId: id20, toType: 'LEGISLATION', kind: 'CITE', position: 10, source: 'EDITORIAL',
          toLabel: 'Décret du 11 mars 2020 sur la protection du consommateur',
          note: 'visa du Décret du 25 novembre 2020 : « Vu le Décret du 11 mars 2020 fixant les règles relatives à la sécurité des biens et services, la loyauté des transactions économiques… ».' },
        { fromId: ref!.id, toId: id18, toType: 'LEGISLATION', kind: 'CITE', position: 11, source: 'EDITORIAL',
          toLabel: 'Arrêté du 19 septembre 2018 sur les prix en monnaie nationale',
          note: 'considérant du Décret du 25 novembre 2020 : « Considérant que, par Arrêté en date du 19 septembre 2018, l’État a pris des mesures pour faire libeller et afficher les prix des biens et services sur le territoire dans la monnaie nationale ; ». ⚠️ Le décret RECONNAÎT l’arrêté et reprend sa matière, mais son article 12 n’abroge que « toutes Lois, tous Décrets-Lois, tous Décrets » contraires — il NE NOMME PAS les arrêtés. Aucune pastille n’en est tirée : la question est réservée à l’éditeur.' },
        { fromId: ref!.id, toId: l46.id, toType: 'LEGISLATION', kind: 'CITE', position: 12, source: 'EDITORIAL',
          toLabel: 'Loi du 20 décembre 1946 sur le marché noir',
          note: 'visa du Décret du 25 novembre 2020 : « Vu la Loi du 20 décembre 1946 sur le marché noir ; ».' },
        // ⚠️ AUCUN RENVOI POUR LA CLAUSE-BALAI DE L'ARTICLE 44 du Décret du 11 mars 2020
        // (« abroge toutes Lois ou dispositions de Lois […] qui lui sont contraires »). Elle ne
        // NOMME personne : un CrossRef est un renvoi VERS UN TEXTE, et une clause sans texte
        // désigné n'a pas de cible. L'inscrire faisait afficher « ABROGE → Toutes lois et
        // dispositions contraires (clause générale) · cible non importée », soit un texte abrogé
        // que la plateforme aurait omis de verser. La clause reste lisible dans le CORPS, à
        // l'article 44 ; elle ne donne ni pastille, ni renvoi. C'est la même règle que celle déjà
        // dite ci-dessus sur l'Arrêté du 19 septembre 2018 : une clause qui n'énumère pas les
        // arrêtés ne les abroge pas sous la plume de la plateforme.
        // Retrait en base : scripts/retirer-renvois-clause-balai.ts
      ],
    })
    await audit({
      action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: 'PRIX_CONSOMMATEUR',
      meta: {
        motif:
          'Sous-thème « Prix, concurrence et protection du consommateur » créé sous Droit commercial ' +
          '(décision de Me Vaval du 29 août 2026) et trois textes versés : loi du 12 septembre 1939 ' +
          '(mesures d’urgence contre les spéculations commerciales), arrêté du 19 septembre 2018 (prix ' +
          'en monnaie nationale), décret du 11 mars 2020 (protection du consommateur). Trois textes déjà ' +
          'au corpus reçoivent le sous-thème en NON primaire, sans rien perdre. ⚠️ Le décret du ' +
          '25 novembre 2020 était déjà versé, en plus complet que la pièce (145 lignes contre 112) : il ' +
          'n’a pas été touché, seulement comparé. Aucune pastille d’abrogation : l’article 12 du décret ' +
          'de 2020 ne nomme pas les arrêtés, et l’article 44 de celui de 2020 est une clause générale.',
        verses: prep.length, rattaches: arattacher.length, divergencesRelevees: divergents.length,
      },
    }, tx)
  }, { timeout: 120_000, maxWait: 30_000 })

  const journal = await prisma.auditLog.count({ where: { targetId: 'PRIX_CONSOMMATEUR' } })
  for (const id of ids.values()) await reindexDocument(id)
  for (const d of arattacher) await reindexDocument(d.id)
  const th = await prisma.theme.findFirst({ where: { slug: THEME.slug }, select: { position: true, parent: { select: { labelFr: true } }, _count: { select: { documents: true } } } })
  const ap = await prisma.document.findUnique({ where: { id: ref!.id }, select: { bodyOriginal: true } })
  const sansPrim = await prisma.document.count({ where: { themes: { some: {} }, NOT: { themes: { some: { isPrimary: true } } } } })
  console.log(`\n✓ AuditLog ${journal} (recompté) · ${ids.size + arattacher.length} documents réindexés`)
  console.log(`  sous-thème : sous « ${th?.parent?.labelFr} », position ${th?.position}, ${th?._count.documents} documents`)
  console.log(`  décret du 25 nov. 2020 : ${createHash('md5').update(ap?.bodyOriginal ?? '').digest('hex') === empreinte ? 'INTACT ✓' : '⚠️ MODIFIÉ'}`)
  console.log(`  documents à thème sans primaire : ${sansPrim} ${sansPrim === 0 ? '✓' : '⚠️'}`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  const m = e instanceof Error ? e.message : String(e)
  console.error('ÉCHEC :', m.trim() ? m : e)
  await prisma.$disconnect(); process.exit(1)
})
