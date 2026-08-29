/**
 * ORGANISATIONS À BUT NON LUCRATIF — création du thème et versement de quatre textes.
 *
 *     npx tsx scripts/importer-obnl.ts            # simulation
 *     npx tsx scripts/importer-obnl.ts --apply    # Me Vaval, elle seule
 *
 * Décision de Me Vaval, 28 août 2026 : « ajouter dans l'arbre les Organisations à but non
 * lucratif » — en sous-thème de **Droit privé**, frère de Droit civil — puis « téléverser la loi
 * sur la reconnaissance d'utilité publique, la législation sur les fondations et celle sur les
 * ONG ».
 *
 * ─── LES QUATRE TEXTES, ET LEURS DATES ─────────────────────────────────────────────────────
 * La règle du 28 août 2026 s'applique : **une LOI porte la date du DERNIER VOTE**, la
 * promulgation ne compte pas ; **un DÉCRET porte celle de la signature**.
 *   1. Loi du 8 juillet 1921 (Palais Législatif ; promulguée le 21 juillet) — 5 art.
 *   2. Loi du 23 juillet 1934 (Maison Nationale le 20, Chambre le 23 → DERNIER vote le 23 ;
 *      promulguée le 4 août) — 19 art.
 *   3. Loi du 19 septembre 1953 (Chambre le 17, Maison Nationale le 19 → le 19 ; promulguée
 *      le 24 septembre) — 3 art.
 *   4. Décret du 14 septembre 1989 (Gouvernement militaire, signature) — 39 art., 7 chapitres.
 *
 * ─── LA LOI DE 1953 RÉÉCRIT CELLE DE 1934, ET C'EST LA VERSION EN VIGUEUR QUI S'AFFICHE ────
 * Règle de corpus du 26 août 2026 : l'ancienne rédaction se replie, jamais l'inverse. Le corps
 * de la loi de 1934 porte donc la rédaction de 1953 pour les articles 1er et 17 (réécrits) et
 * pour l'article 18 (alinéa ajouté) ; les rédactions de 1934 vont dans `oldVersions`, et les
 * trois articles reçoivent la pastille « modifié ».
 *
 * ⚠️ L'ORACLE N'EST PAS LE FICHIER, C'EST LA LOI DE 1953 ELLE-MÊME. Le .doc de 1934 portait
 * TROIS appels de note « Voir la modification faite par la Loi du 19 septembre 1953 », mais la
 * conversion en texte les a détachés de leurs articles. C'est le dispositif de 1953 qui dit
 * lesquels : son article 1er réécrit les articles 1er et 17, son article 2 ajoute un alinéa à
 * l'article 18. Trois articles, trois notes : les comptes concordent.
 *
 * ⚠️ ESPACE INSÉCABLE APRÈS LE GUILLEMET. Le Journal officiel écrit « U+00A0 Article 1er.- ».
 * Une sentinelle qui cherche « « Article » avec une espace ordinaire refuse un texte pourtant
 * conforme — vécu le 28 août 2026 lors de la préparation.
 *
 * ⚠️ UNE TÊTE D'ARTICLE CITÉE RESTE UNE CITATION. Dans la loi de 1953, la ligne « Article 17.- »
 * appartient au texte cité entre guillemets ouverts à la ligne précédente. `segmentAnnotated`
 * l'ancrera comme une tête : c'est un artefact sans conséquence (la loi de 1953 n'a que trois
 * articles, aucun renvoi ne vise son « article 17 »), et on NE déclare PAS de libellé pour lui.
 * Le corps reste verbatim : on ne retouche pas un texte officiel pour arranger un rendu.
 */
import { prisma } from '../src/lib/db'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { audit } from '../src/lib/auth/audit'
import { reindexDocument } from '../src/lib/search/reindex'
import { articleAnchorFromHeading } from '../src/lib/doc/anchors'

const APPLY = process.argv.includes('--apply')
const D = join(process.cwd(), 'scripts/data/obnl')
const lire = (f: string) => readFileSync(join(D, f), 'utf8').replace(/\n+$/, '')

const THEME = {
  slug: 'organisations-but-non-lucratif',
  labelFr: 'Organisations à but non lucratif',
  labelEn: 'Non-profit organisations',
  labelHt: 'Oganizasyon san bi likratif',
}

type Fiche = {
  source: string; titleFr: string; corps: string; adoptionDate: string; publicationDate: string
  moniteurRef: string; articles: number; chapitres?: boolean
  /** Têtes d'article CITÉES dans le corps (rédactions nouvelles entre guillemets). */
  citées?: string[]
}
const FICHES: Fiche[] = [
  {
    source: 'OBNL_LOI_UTILITE_PUBLIQUE_1921',
    titleFr: 'Loi du 8 juillet 1921 relative à la Reconnaissance d’Utilité Publique',
    corps: 'corps-1921.txt', adoptionDate: '1921-07-08', publicationDate: '1921-07-27',
    moniteurRef: 'Le Moniteur · LM1921-55 · n° 55 du 27 juillet 1921', articles: 5,
  },
  {
    source: 'OBNL_LOI_FONDATIONS_1934',
    titleFr: 'Loi du 23 juillet 1934 organisant le régime des Fondations',
    corps: 'corps-1934-en-vigueur.txt', adoptionDate: '1934-07-23', publicationDate: '1934-08-09',
    moniteurRef: 'Le Moniteur · LM1934-67 · n° 67 du jeudi 9 août 1934', articles: 19,
  },
  {
    source: 'OBNL_LOI_FONDATIONS_1953',
    titleFr: 'Loi du 19 septembre 1953 modifiant les articles 1er, 17 et 18 de la Loi du 23 juillet 1934 sur les Fondations',
    corps: 'corps-1953.txt', adoptionDate: '1953-09-19', publicationDate: '1953-10-15',
    moniteurRef: 'Le Moniteur · LM1953-100 · n° 100 du jeudi 15 octobre 1953', articles: 3,
    // La rédaction nouvelle de l'art. 17 de la loi de 1934, citée dans l'art. 1er de celle-ci.
    citées: ['art-17'],
  },
  {
    source: 'OBNL_DECRET_ONG_1989',
    titleFr: 'Décret du 14 septembre 1989 modifiant la Loi du 13 décembre 1982 régissant les Organisations Non Gouvernementales d’Aide au Développement (ONG)',
    corps: 'corps-1989.txt', adoptionDate: '1989-09-14', publicationDate: '1989-10-05',
    moniteurRef: 'Le Moniteur · LM1989-77 · n° 77 du jeudi 5 octobre 1989', articles: 39, chapitres: true,
  },
]

/**
 * Têtes d'article RÉELLES, et têtes CITÉES, séparées par un discriminant mesurable.
 *
 * ⚠️ Le corps d'une loi modificatrice contient les articles qu'elle réécrit, entre guillemets.
 * Dans la loi de 1953, la ligne « Article 17.- » ouvre la rédaction nouvelle de l'article 17 de
 * la loi de 1934 : c'est une CITATION, pas une tête. Le guillemet ne la distingue pas (il a été
 * ouvert à la ligne précédente).
 *
 * LE DISCRIMINANT : les articles d'une loi se suivent SANS TROU DEPUIS 1. La loi de 1953
 * numérote 1er, 2, 3 ; la citation intercale un 17 entre 1er et 2. Est réelle la tête qui porte
 * le numéro ATTENDU (le précédent plus un) ; toute autre est citée.
 * ⚠️ Un simple « strictement croissant » ne suffit PAS et a été essayé : la citation portant un
 * numéro PLUS HAUT (17 après 1er), elle passait pour réelle et faisait écarter les articles 2
 * et 3 qui la suivaient. Le numéro attendu, lui, ne se laisse pas tromper.
 * Les têtes écartées sont RENDUES À L'APPELANT, jamais en silence : la fiche doit les déclarer,
 * et le script refuse si le compte ne correspond pas.
 */
function ancres(corps: string): { têtes: { anchor: string; label: string }[]; citées: string[] } {
  const têtes: { anchor: string; label: string }[] = []
  const citées: string[] = []
  let attendu = 1
  for (const l of corps.split('\n')) {
    if (!/^Article\s/.test(l)) continue
    const a = articleAnchorFromHeading(l)
    if (!a) continue
    const num = Number((a.match(/^art-(\d+)$/) ?? [])[1] ?? NaN)
    if (num !== attendu) { citées.push(a); continue }
    attendu++
    const m = l.match(/^Article\s+([^\s:.\-]+(?:\s*er)?)/)
    têtes.push({ anchor: a, label: `Article ${(m?.[1] ?? '').replace(/er$/, 'er')}` })
  }
  return { têtes, citées }
}

async function main() {
  const dp = await prisma.theme.findFirst({ where: { slug: 'droit-prive' }, select: { id: true } })
  if (!dp) throw new Error('thème droit-prive introuvable. STOP')
  if (await prisma.theme.findFirst({ where: { slug: THEME.slug } })) throw new Error(`le thème « ${THEME.slug} » existe déjà. STOP`)
  const deja = await prisma.document.findMany({ where: { source: { in: FICHES.map((f) => f.source) } }, select: { source: true } })
  if (deja.length) throw new Error(`${deja.length} fiche(s) déjà versée(s) : ${deja.map((d) => d.source).join(', ')}. STOP`)

  const frères = await prisma.theme.aggregate({ where: { parentId: dp.id }, _max: { position: true } })
  const position = (frères._max.position ?? -1) + 1

  const anciennes: Record<string, string> = JSON.parse(lire('anciennes-1934.json'))
  if (Object.keys(anciennes).length !== 3) throw new Error('les anciennes rédactions ne sont pas 3. STOP')

  const prep = FICHES.map((f) => {
    const corps = lire(f.corps)
    const { têtes: a, citées } = ancres(corps)
    if (a.length !== f.articles) throw new Error(`${f.source} : ${a.length} têtes d'article, ${f.articles} annoncées. STOP`)
    const attendues = (f.citées ?? []).join(',')
    if (citées.join(',') !== attendues)
      throw new Error(`${f.source} : têtes citées « ${citées.join(',') || '—'} », déclarées « ${attendues || '—'} ». STOP`)
    const chap = f.chapitres ? corps.split('\n').filter((l) => /^Chapitre\s+\d/.test(l)) : []
    if (f.chapitres && chap.length !== 7) throw new Error(`${f.source} : ${chap.length} chapitres, 7 attendus. STOP`)
    return { f, corps, a, chap, citées }
  })

  // Le repli doit viser des ancres qui EXISTENT dans le corps de 1934.
  const a34 = new Set(prep.find((p) => p.f.source === 'OBNL_LOI_FONDATIONS_1934')!.a.map((x) => x.anchor))
  for (const k of Object.keys(anciennes)) if (!a34.has(k)) throw new Error(`ancienne rédaction « ${k} » : ancre absente du corps de 1934. STOP`)

  console.log(`thème à créer : « ${THEME.labelFr} » [${THEME.slug}] sous Droit privé, position ${position}`)
  console.log(`  En « ${THEME.labelEn} » · Ht « ${THEME.labelHt} » (créole sans accent grave)\n`)
  for (const { f, corps, a, chap, citées } of prep)
    console.log(`  ${f.source.padEnd(32)} ${String(corps.split('\n').length).padStart(3)} l. · ${String(a.length).padStart(2)} art.${f.chapitres ? ` · ${chap.length} chapitres` : ''} · adopté ${f.adoptionDate}${citées.length ? ` · tête citée écartée du sommaire : ${citées.join(', ')}` : ''}`)
  console.log(`\n  pastilles « modifié » sur la loi de 1934 : ${Object.keys(anciennes).join(', ')} (rédaction de 1934 au repli)`)

  if (!APPLY) { console.log('\nSIMULATION — rien n’a été écrit. --apply est réservé à Me Vaval.'); await prisma.$disconnect(); return }

  const ids = new Map<string, string>()
  await prisma.$transaction(async (tx) => {
    const th = await tx.theme.create({ data: { ...THEME, parentId: dp.id, position } })
    for (const { f, corps, a, chap } of prep) {
      const est1934 = f.source === 'OBNL_LOI_FONDATIONS_1934'
      const toc = chap.map((label, k) => ({ level: 1, label, anchor: `sec-${k + 1}`, kind: 'code' }))
      const ann = {
        title: f.titleFr, annotationAuthor: '', navToc: toc.map((t) => ({ label: t.label, anchor: t.anchor, children: [] })),
        toc, connexes: [], jurisprudence: {}, indexEntries: [],
        labels: Object.fromEntries(a.map((x) => [x.anchor, x.label])),
        ...(est1934 ? { oldVersions: anciennes, status: Object.fromEntries(Object.keys(anciennes).map((k) => [k, 'modifié'])) } : {}),
      }
      const doc = await tx.document.create({
        data: {
          type: 'LEGISLATION', status: 'EN_VIGUEUR', titleFr: f.titleFr, number: f.titleFr,
          bodyOriginal: corps, originalLang: 'fr', source: 'OBNL', category: 'LEGISLATION',
          moniteurRef: f.moniteurRef, adoptionDate: new Date(`${f.adoptionDate}T00:00:00Z`),
          publicationDate: new Date(`${f.publicationDate}T00:00:00Z`),
          annotationsJson: JSON.stringify(ann),
        },
      })
      await tx.document.update({ where: { id: doc.id }, data: { source: f.source } })
      await tx.documentTheme.create({ data: { documentId: doc.id, themeId: th.id, isPrimary: true, assignedBy: 'IMPORT' } })
      ids.set(f.source, doc.id)
    }

    // ── Le graphe : la loi de 1953 modifie celle de 1934 ──
    const id34 = ids.get('OBNL_LOI_FONDATIONS_1934')!, id53 = ids.get('OBNL_LOI_FONDATIONS_1953')!
    await tx.crossRef.create({
      data: {
        fromId: id53, toId: id34, toType: 'LEGISLATION', kind: 'MODIFIE', position: 0, source: 'EDITORIAL',
        toLabel: 'Loi du 23 juillet 1934 organisant le régime des Fondations',
        note:
          'Réécrit les articles 1er et 17, ajoute un alinéa à l’article 18 — dispositif (articles 1er et 2 de la Loi) : ' +
          '« Les articles 1er et 17 de la Loi du 23 Juillet 1934 sur les fondations, sont ainsi modifiées : … » ; ' +
          '« Il est ajouté à l’article 18 de la susdite loi du 23 juillet 1934, l’alinéa suivant : … ». La fiche de 1934 ' +
          'affiche la rédaction de 1953 ; celle de 1934 est repliée sous chacun des trois articles.',
      },
    })
    for (const [anchor, corpsAncien] of Object.entries(anciennes)) {
      await tx.articleVersion.create({
        data: {
          documentId: id34, anchor, label: `Article ${anchor.replace('art-', '')}`, body: corpsAncien,
          status: 'MODIFIE', effectiveDate: new Date('1953-09-19T00:00:00Z'),
          amendedByDocId: id53, amendedByNumber: 'Loi du 19 septembre 1953',
          note: 'Rédaction de 1934, remplacée par la Loi du 19 septembre 1953.', origin: 'MANUAL',
        },
      })
    }
    const id89 = ids.get('OBNL_DECRET_ONG_1989')!
    await tx.crossRef.createMany({
      data: [
        { fromId: id89, toId: id34, toType: 'LEGISLATION', kind: 'CITE', position: 0, source: 'EDITORIAL',
          toLabel: 'Loi du 23 juillet 1934 sur les Fondations',
          note: 'visa du Décret : « Vu la Loi du 23 Juillet 1934 sur les Fondations, modifiée par celle du 19 Septembre 1953 ; »' },
        { fromId: id89, toId: id53, toType: 'LEGISLATION', kind: 'CITE', position: 1, source: 'EDITORIAL',
          toLabel: 'Loi du 19 septembre 1953 modifiant celle du 23 juillet 1934',
          note: 'visa du Décret : « Vu la Loi du 23 Juillet 1934 sur les Fondations, modifiée par celle du 19 Septembre 1953 ; »' },
        { fromId: id89, toType: 'LEGISLATION', kind: 'MODIFIE', position: 2, source: 'EDITORIAL',
          toLabel: 'Décret du 13 décembre 1982 réglementant l’implantation et le fonctionnement en Haïti des Organisations Non Gouvernementales d’Aide au Développement (ONG)',
          note:
            'Texte NON VERSÉ au corpus : renvoi en clair, sans lien. ⚠️ ÉCART D’INTITULÉ conservé tel quel : le TITRE du ' +
            'décret de 1989 dit « la Loi du 13 Décembre 1982 », tandis que son propre VISA dit « le Décret du 13 Décembre ' +
            '1982 ». Rien n’est affirmé sur la nature de l’acte de 1982 : à vérifier sur le fascicule.' },
      ],
    })
    await audit({
      action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: 'OBNL_VERSEMENT',
      meta: {
        motif:
          'Création du thème « Organisations à but non lucratif » sous Droit privé et versement de quatre textes ' +
          '(utilité publique 1921, fondations 1934 et 1953, ONG 1989), décision de Me Vaval du 28 août 2026. ' +
          'La loi de 1934 est versée dans sa rédaction EN VIGUEUR (celle de 1953 pour les art. 1er, 17 et 18) ; ' +
          'la rédaction de 1934 est repliée et portée en ArticleVersion.',
        fiches: FICHES.length, articlesModifies: Object.keys(anciennes).length,
      },
    }, tx)
  }, { timeout: 120_000, maxWait: 30_000 })

  const journal = await prisma.auditLog.count({ where: { targetId: 'OBNL_VERSEMENT' } })
  for (const id of ids.values()) await reindexDocument(id)

  const ctrl = await prisma.document.findMany({ where: { source: { startsWith: 'OBNL_' } }, select: { source: true, titleFr: true, adoptionDate: true, annotationsJson: true } })
  const av = await prisma.articleVersion.count({ where: { document: { source: { startsWith: 'OBNL_' } } } })
  const cr = await prisma.crossRef.count({ where: { from: { source: { startsWith: 'OBNL_' } } } })
  console.log(`\n✓ AuditLog ${journal} (recompté) · ${ids.size} documents réindexés`)
  for (const d of ctrl) {
    const a = JSON.parse(String(d.annotationsJson ?? '{}'))
    console.log(`  ${d.source?.padEnd(32)} ${d.adoptionDate?.toISOString().slice(0, 10)} · ${Object.keys(a.labels ?? {}).length} libellés · toc ${(a.toc ?? []).length} · repli ${Object.keys(a.oldVersions ?? {}).length}`)
  }
  console.log(`  ArticleVersion ${av} · renvois ${cr}`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  const m = e instanceof Error ? e.message : String(e)
  console.error('ÉCHEC :', m.trim() ? m : e)
  await prisma.$disconnect()
  process.exit(1)
})
