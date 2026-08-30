/**
 * SECTEUR DE L'ÉNERGIE — trois des QUATRE décrets du Moniteur n° 23 du 3 février 2016.
 *
 * ⚠️ LE FASCICULE PORTE QUATRE DÉCRETS, PAS TROIS. Son sommaire imprimé en page 1 (fac-similé
 * fourni par la cliente) en liste quatre, et l'Index du Moniteur de la plateforme le sait déjà :
 * Document{type:'INDEX', number:'LM2016-23'} rend QUATRE notices. Le quatrième — « Décret créant
 * un Organisme Autonome à caractère industriel et commercial […] dénommée : Électricité d'Haïti
 * (EDH) » — N'A PAS ÉTÉ FOURNI : il occupe les pages 38 et suivantes, hors du fac-similé de
 * 30 pages, et ne figure dans aucun des sept .docx. Il n'est donc pas versé, et on le DIT.
 * La réforme électrique du 6 janvier 2016 est un triptyque — le marché (ce décret), le régulateur
 * (ANARSE), l'opérateur historique (EDH) : on en verse deux tiers, il faut réclamer le troisième.
 *
 *     npx tsx scripts/importer-decrets-energie-2016.ts            # simulation
 *     npx tsx scripts/importer-decrets-energie-2016.ts --apply    # Me Vaval, elle seule
 *
 * ⚠️ LES TROIS SONT SIGNÉS DU 6 JANVIER 2016 et publiés le 3 février. Le corpus porte DÉJÀ deux
 * décrets du 6 janvier 2016 (administration centrale) : cinq actes partageront cette date.
 * « Décret du 6 janvier 2016 » ne désigne donc rien — d'où le nom complet en titre ET en
 * référence, contrôlé pour unicité avant écriture.
 *
 * ⚠️ LE DÉCRET DSIS N'EST PAS UN TEXTE D'ÉNERGIE. Il crée une direction du service d'incendie
 * et de secours AU MINISTÈRE DE L'INTÉRIEUR. Il ne partage avec les deux autres que le
 * fascicule et la date de signature : il va sous « Intérieur & collectivités territoriales ».
 *
 * ⚠️ LE SOMMAIRE PORTE LA SEGMENTATION. `articleAnchorFromHeading` reconnaît volontairement les
 * têtes « Section N.- » (c'est dans la fonction ET dans son test) et leur donne l'ancre art-N.
 * Mesuré : SANS le sommaire, art-1×2 … art-4×2 sur l'énergie et art-1×2 … art-5×2 sur l'ANARSE ;
 * AVEC le sommaire, 84/11/33 blocs et aucune collision — les entrées de sommaire consomment la
 * ligne avant que la fonction d'ancre ne soit consultée. Corps et sommaire s'écrivent donc dans
 * la MÊME transaction ; verser le corps seul fabriquerait des ancres en double, silencieusement.
 *
 * ⚠️ AUCUNE PASTILLE. Les trois clauses finales sont des CLAUSES-BALAI (« toutes dispositions
 * contraires »), aucune ne nomme un texte. Seule abrogation nominative du lot : l'article 1er du
 * DSIS rapporte le décret créant le Corps Autonome des Pompiers — que le corpus ne détient qu'en
 * NOTICE DE CATALOGUE (LM1989-12A), d'où un renvoi par désignation, sans toId.
 *
 * ⚠️ LE DÉCRET CAP EST SIGNÉ DU 30 JANVIER 1989, non du 13 février. Le décret de 2016 le désigne
 * par sa date de PUBLICATION. Source indépendante : le titre du décret modificatif, entrée
 * LM1989-86A de l'Index du Moniteur — « … du Décret du 30 janvier 1989 créant le CAP ». Le corps
 * de 2016 n'est PAS corrigé (le Moniteur fait foi) ; c'est le renvoi qui se résout par identité.
 *
 * ⚠️ L'ABROGATION IMPLICITE DU MONOPOLE NE PEUT PAS ÊTRE MESURÉE. Le décret énergie contredit
 * manifestement la Loi du 18 juin 1948 (monopole d'État), qu'il vise. Mais ni cette loi, ni le
 * Décret du 7 septembre 1950 qui la modifie, ni le Décret du 20 août 1989 sur l'EDH ne sont au
 * corpus : mesuré, aucun texte d'énergie n'y figure. Et le décret qui REFONDE l'EDH, quatrième
 * pièce du même fascicule signée le même jour, n'a pas été fourni. On ne pose rien — mais la
 * question reste ouverte, elle n'est pas close.
 *
 * ⚠️ RETIRÉ DU CORPS, deux mentions du PRÉPARATEUR qui ne sont pas du Moniteur : la queue
 * « — N articles — pages A à B du Moniteur » de la ligne de mastic, et la note finale « Texte
 * transcrit à partir de l'exemplaire numérisé… ». bodyOriginal est le texte officiel (§02).
 *
 * ⚠️ 38 RENVOIS AU PRÉAMBULE n'ont pas d'ancre : ctRefs ne connaît que des ancres d'article, et le
 * préambule n'en a pas. Le LIEN est donc perdu — mais pas le SUJET : 13 emplacements de sujet
 * n'avaient QUE le préambule, dont deux sujets entiers (« Constitution », « Électricité d'Haïti
 * (EDH) ») ; ils sont conservés sans lien, suffixés « (préambule — visas) ». Le fondement
 * constitutionnel de chaque acte est le premier mot qu'on cherche dans un index.
 *
 * ⚠️ AUCUN RENVOI POUR LES CLAUSES-BALAI. Le rendu public affiche « ABROGE → … · cible non
 * importée » (doc/[id]/page.tsx l. 830-833) sans jamais lire la `note` : un renvoi qui ne nomme
 * rien ferait croire à un texte abrogé que la plateforme aurait omis de verser. La clause reste
 * lisible où elle est — dans le corps, aux articles 84, 11 et 33.
 */
import { prisma } from '../src/lib/db'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { audit } from '../src/lib/auth/audit'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated } from '../src/lib/legislation/annotated'
import { articleAnchorFromHeading } from '../src/lib/doc/anchors'

const APPLY = process.argv.includes('--apply')
const D = join(process.cwd(), 'scripts/data/energie-2016')
const lire = (f: string) => readFileSync(join(D, f), 'utf8').replace(/\n+$/, '')
const lireJson = <T>(f: string): T => JSON.parse(lire(f)) as T

const THEME = {
  slug: 'energie-electricite',
  labelFr: 'Énergie & électricité',
  labelEn: 'Energy & electricity',
  labelHt: 'Enèji ak elektrisite',
}
const MONITEUR = 'Le Moniteur · LM2016-23 · 171ᵉ année, n° 23 du mercredi 3 février 2016'
/** Note du sommaire analytique de la cliente : la frontière entre ce qui fait foi et ce qui aide
 *  à lire doit être portée par le DOCUMENT, pas par la mémoire du préparateur. */
const AVERTISSEMENT =
  'Sommaire analytique et index : les intitulés de titres, chapitres et sections sont ceux du ' +
  'texte officiel. Les libellés placés en regard de chaque article sont des rubriques analytiques ' +
  'ajoutées pour le repérage — le Décret ne comporte pas d’intitulés d’articles.'

type Toc = { level: number; label: string; anchor: string; kind: string }
type Rub = { tete: string; rubrique: string }
type Idx = { subject: string; ctRefs: number[]; autres: Record<string, number[]> }
type Entree = { subject: string; ctRefs: number[]; docRefs?: { label: string; id: string; anchor: string }[] }

const COURT: Record<string, string> = {
  energie: 'D. 6 janv. 2016 (énergie électrique)',
  dsis: 'D. 6 janv. 2016 (DSIS)',
  anarse: 'D. 6 janv. 2016 (ANARSE)',
}

/**
 * Index d'une fiche : ses propres renvois en `ctRefs`, ceux des décrets FRÈRES en `docRefs`
 * (forme de l'index multi-textes, cf. OBNL_LOI_FONDATIONS_1934/1953). ctRefs ne connaît que des
 * numéros d'article du document courant — sans docRefs, l'index maître perdrait ses 423 renvois
 * croisés, portés par 84 entrées. Fonction PURE, exercée en simulation avec des identifiants factices.
 */
function entreesIndex(index: Idx[], ids: Map<string, string>): Entree[] {
  return index.map((e) => {
    const docRefs = Object.entries(e.autres).flatMap(([slug, nums]) => {
      const id = ids.get(slug)
      if (!id) throw new Error(`renvoi croisé vers « ${slug} », inconnu des fiches versées. STOP`)
      return nums.map((n) => ({ label: `${COURT[slug]}, art. ${n}`, id, anchor: `art-${n}` }))
    })
    return docRefs.length ? { subject: e.subject, ctRefs: e.ctRefs, docRefs } : { subject: e.subject, ctRefs: e.ctRefs }
  })
}

type Noeud = { label: string; anchor: string; children: Noeud[] }

/**
 * Menu latéral : le corpus le veut HIÉRARCHIQUE (DECRET_MINIER_2026 : 17 groupes, 54 enfants).
 * TocPanel n'affiche QUE les groupes et leurs enfants — il ne lit jamais `toc`. Un navToc plat
 * ferait naviguer un décret de 84 articles par cinq lignes, en perdant 12 chapitres et 4 sections.
 */
function navDepuisToc(toc: Toc[]): Noeud[] {
  const racines: Noeud[] = []
  const pile: { level: number; noeud: Noeud }[] = []
  for (const t of toc) {
    const noeud: Noeud = { label: t.label, anchor: t.anchor, children: [] }
    while (pile.length && pile[pile.length - 1].level >= t.level) pile.pop()
    if (pile.length) pile[pile.length - 1].noeud.children.push(noeud)
    else racines.push(noeud)
    pile.push({ level: t.level, noeud })
  }
  return racines
}
const compterNoeuds = (n: Noeud[]): number => n.reduce((s, x) => s + 1 + compterNoeuds(x.children), 0)

/** « art-1 » → « Article 1er ». Le corps, le sommaire et le Moniteur écrivent tous l'ordinal ;
 *  labelFromAnchor, lui, ne le connaît pas — c'est pour cela que la carte `labels` est écrite. */
function libelleArticle(ancre: string): string {
  const n = ancre.replace('art-', '').replace(/-/g, '.')
  return `Article ${n === '1' ? '1er' : n}`
}

const FICHES = [
  {
    slug: 'energie', source: 'DECRET_ENERGIE_ELECTRIQUE_2016', articles: 84, toc: 21,
    titre: 'Décret du 6 janvier 2016 régissant le secteur de l’énergie électrique',
    theme: THEME.slug, pages: 'pages 1 à 18',
  },
  {
    slug: 'dsis', source: 'DECRET_DSIS_2016', articles: 11, toc: 6,
    titre:
      'Décret du 6 janvier 2016 créant au Ministère de l’Intérieur et des Collectivités Territoriales ' +
      'une Direction chargée du Service d’Incendie et de Secours',
    theme: 'interieur-collectivites', pages: 'pages 23 à 26',
  },
  {
    slug: 'anarse', source: 'DECRET_ANARSE_2016', articles: 33, toc: 9,
    titre: 'Décret du 6 janvier 2016 créant l’Autorité Nationale de Régulation du Secteur de l’Énergie (ANARSE)',
    theme: THEME.slug, pages: 'pages 30 à 37',
  },
] as const

async function main() {
  // ⚠️ L'IDEMPOTENCE SE TESTE EN PREMIER. Placée après un autre garde-fou, elle devient
  // INATTEIGNABLE et la seconde exécution échoue en accusant à tort (leçon BEL 1984).
  const deja = await prisma.document.findMany({
    where: { source: { in: FICHES.map((f) => f.source) } },
    select: { source: true },
  })
  if (deja.length === FICHES.length) {
    console.log('les trois décrets sont déjà versés — rien à faire.')
    await prisma.$disconnect(); return
  }
  if (deja.length) throw new Error(`versement PARTIEL : ${deja.map((d) => d.source).join(', ')} déjà en base. STOP`)

  const prep = FICHES.map((f) => {
    const corps = lire(`corps-${f.slug}.txt`)
    const toc = lireJson<Toc[]>(`toc-${f.slug}.json`)
    const rubriques = lireJson<Rub[]>(`rubriques-${f.slug}.json`)
    const index = lireJson<Idx[]>(`index-${f.slug}.json`)
    if (toc.length !== f.toc) throw new Error(`${f.source} : sommaire ${toc.length}, ${f.toc} attendues. STOP`)

    // 1. Le sommaire doit s'appuyer sur des lignes RÉELLES du corps, dans l'ordre.
    const lignes = corps.split('\n').map((x) => x.trim())
    const jeu = new Set(lignes)
    const orphelines = toc.filter((t) => !jeu.has(t.label))
    if (orphelines.length)
      throw new Error(`${f.source} : ${orphelines.length} libellé(s) de sommaire absent(s) du corps — « ${orphelines[0].label.slice(0, 60)} ». STOP`)

    // 2. Segmentation RÉELLE : c'est elle qui décide des ancres et des clés de commentaire.
    const blocs = segmentAnnotated(corps, toc) as { kind: string; anchor?: string | null; jurisKey?: string | null }[]
    const porteurs = blocs.filter((b) => b.kind === 'body' && b.anchor)
    const compte = new Map<string, number>()
    for (const b of porteurs) compte.set(b.anchor!, (compte.get(b.anchor!) ?? 0) + 1)
    const collisions = [...compte].filter(([, n]) => n > 1)
    if (collisions.length)
      throw new Error(`${f.source} : ancres en COLLISION — ${collisions.map(([a, n]) => `${a}×${n}`).join(', ')}. STOP`)
    if (porteurs.length !== f.articles)
      throw new Error(`${f.source} : ${porteurs.length} blocs à ancre, ${f.articles} articles attendus. STOP`)
    const sections = blocs.filter((b) => b.kind === 'section').length
    if (sections !== f.toc) throw new Error(`${f.source} : ${sections} sections rendues, ${f.toc} attendues. STOP`)

    // 3. Les rubriques du sommaire analytique se rattachent par la clé de la SEGMENTATION,
    //    jamais par un numéro reconstruit à la main.
    const cle = new Map<string, string>()
    for (const b of porteurs) cle.set(b.anchor!, b.jurisKey!)
    const commentaires: Record<string, string[]> = {}
    for (const r of rubriques) {
      const a = articleAnchorFromHeading(r.tete)
      if (!a) throw new Error(`${f.source} : tête de rubrique non reconnue « ${r.tete} ». STOP`)
      const k = cle.get(a)
      if (!k) throw new Error(`${f.source} : la rubrique « ${r.tete} » ne trouve pas son bloc (${a}). STOP`)
      if (commentaires[k]) throw new Error(`${f.source} : deux rubriques pour ${a}. STOP`)
      commentaires[k] = [`Rubrique du sommaire analytique : ${r.rubrique}`]
    }
    if (Object.keys(commentaires).length !== f.articles)
      throw new Error(`${f.source} : ${Object.keys(commentaires).length} rubriques, ${f.articles} articles. STOP`)

    // 4. Tout renvoi d'index doit viser une ancre QUI EXISTE (leçon : jamais une boucle 1..N).
    const ancres = new Set(porteurs.map((b) => b.anchor!))
    const morts = index.flatMap((e) => e.ctRefs.filter((n) => !ancres.has(`art-${n}`)).map((n) => `${e.subject.slice(0, 26)}→art-${n}`))
    if (morts.length) throw new Error(`${f.source} : ${morts.length} renvoi(s) mort(s) — ${morts.slice(0, 4).join(' · ')}. STOP`)

    const anc = [...ancres]
    const nav = navDepuisToc(toc)
    // ⚠️ Un nœud perdu au passage à l'arbre est invisible à l'écran : on recompte.
    if (compterNoeuds(nav) !== toc.length)
      throw new Error(`${f.source} : ${compterNoeuds(nav)} nœuds de menu pour ${toc.length} entrées de sommaire. STOP`)
    return { f, corps, toc, index, commentaires, anc, nav, renvois: index.reduce((n, e) => n + e.ctRefs.length, 0) }
  })

  // ── contrôles de CORPUS ───────────────────────────────────────────────────────────────
  const memeDate = await prisma.document.findMany({
    where: { OR: [{ adoptionDate: new Date('2016-01-06T00:00:00Z') }, { titleFr: { contains: '6 janvier 2016' } }] },
    select: { source: true, titleFr: true, type: true },
  })
  const titres = [...memeDate.map((d) => d.titleFr ?? ''), ...FICHES.map((f) => f.titre)]
  if (new Set(titres).size !== titres.length) throw new Error('deux actes du 6 janvier 2016 porteraient le même intitulé. STOP')

  // ⚠️ Les renvois croisés visent les ANCRES D'UN AUTRE document : ils se contrôlent contre les
  // ancres de ce document, jamais contre celles du document courant.
  const ancresPar = new Map<string, Set<string>>(prep.map((p) => [String(p.f.slug), new Set(p.anc)]))
  const faux = new Map<string, string>(prep.map((p) => [String(p.f.slug), `id-factice-${p.f.slug}`]))
  let croises = 0
  for (const p of prep) {
    for (const e of entreesIndex(p.index, faux))
      for (const r of e.docRefs ?? []) {
        croises++
        const cible = [...faux].find(([, v]) => v === r.id)?.[0]
        const ancres = cible ? ancresPar.get(cible) : undefined
        if (!ancres) throw new Error(`${p.f.source} : renvoi croisé vers une fiche inconnue (${r.id}). STOP`)
        if (!ancres.has(r.anchor))
          throw new Error(`${p.f.source} : renvoi croisé mort « ${e.subject.slice(0, 28)} » → ${cible} ${r.anchor}. STOP`)
      }
  }

  const codePenal = await prisma.document.findFirst({ where: { source: 'CODE_PENAL_ANNOTE' }, select: { id: true, titleFr: true } })
  if (!codePenal) throw new Error('CODE_PENAL_ANNOTE introuvable — l’article 72 y renvoie nommément. STOP')

  const parent = await prisma.theme.findFirst({ where: { slug: 'economique' }, select: { id: true, labelFr: true } })
  if (!parent) throw new Error('thème economique introuvable. STOP')
  const interieur = await prisma.theme.findFirst({ where: { slug: 'interieur-collectivites' }, select: { id: true, labelFr: true } })
  if (!interieur) throw new Error('thème interieur-collectivites introuvable. STOP')
  const themeExiste = await prisma.theme.findFirst({ where: { slug: THEME.slug }, select: { id: true } })

  // ⚠️ DEUX conditions, pas une. « Autonome des Pompiers » seul ramène quatre notices
  // (nominations, décret modificatif) ; « créant un Organisme Autonome » seul ramène un
  // décret de 1988 sans rapport. Il faut les deux — et le contrôle d'unicité qui suit.
  const capS = await prisma.document.findMany({
    where: { type: 'INDEX', AND: [{ titleFr: { contains: 'créant un Organisme Autonome' } }, { titleFr: { contains: 'Pompiers' } }] },
    select: { number: true, titleFr: true, publicationDate: true },
  })
  if (capS.length > 1) throw new Error(`${capS.length} notices concurrentes pour le décret CAP — ${capS.map((c) => c.number).join(', ')}. STOP`)
  const cap = capS[0] ?? null

  // ── rapport ───────────────────────────────────────────────────────────────────────────
  console.log(`Moniteur n° 23 du 3 février 2016 — TROIS DES QUATRE décrets, tous signés du 6 janvier 2016\n`)
  for (const p of prep) {
    const th = p.f.theme === THEME.slug ? `${THEME.labelFr} (à créer sous ${parent.labelFr})` : interieur.labelFr
    console.log(`  ${p.f.source.padEnd(30)} ${String(p.corps.split('\n').length).padStart(4)} l. · ${String(p.anc.length).padStart(3)} art. · sommaire ${String(p.toc.length).padStart(2)} · rubriques ${String(Object.keys(p.commentaires).length).padStart(3)} · index ${String(p.index.length).padStart(3)} (${p.renvois} renvois) · ${p.f.pages}`)
    console.log(`  ${' '.repeat(30)} → ${th}`)
  }
  const textes = memeDate.filter((d) => d.type !== 'INDEX')
  const notices = memeDate.filter((d) => d.type === 'INDEX')
  console.log(`\n  du 6 janvier 2016 déjà en base : ${textes.length} texte(s) intégral(aux) — ${textes.map((d) => d.source).join(', ')}`)
  console.log(`  ${' '.repeat(31)}${notices.length} notice(s) de l’Index du Moniteur (Résolution du Conseil des Ministres, arrêté rapportant)`)
  console.log(`  avec les trois présents : ${textes.length + 3} textes intégraux à cette date, tous d’intitulé distinct (contrôlé sur les ${memeDate.length + 3})`)
  console.log(`  décret CAP au corpus : ${cap ? `notice de catalogue [${cap.number}], publiée le ${cap.publicationDate?.toISOString().slice(0, 10)} — renvoi PAR DÉSIGNATION` : 'ABSENT'}`)
  console.log(`  sous-thème « ${THEME.labelFr} » : ${themeExiste ? 'existe déjà' : 'à créer'}`)
  console.log(`  ${croises} renvois croisés vers les décrets frères (docRefs), tous vérifiés sur les ancres de la CIBLE`)
  console.log(`  38 renvois au préambule sans ancre ; les ${prep.reduce((n, p) => n + p.index.filter((e) => !e.ctRefs.length).length, 0)} sujets qui n’avaient que lui sont conservés SANS LIEN`)
  console.log(`  aucune pastille : les trois clauses finales sont des clauses-balai, et AUCUN renvoi n’en est tiré`)
  console.log(`  renvois : énergie art. 22 → ANARSE · art. 72 → Code pénal · art. 14 → Code des investissements (désignation) · DSIS art. 1er → décret CAP (désignation)`)
  console.log(`\n  ⚠️ LE FASCICULE PORTE QUATRE DÉCRETS. Le quatrième — « Décret créant un Organisme Autonome`)
  console.log(`     à caractère industriel et commercial […] dénommée : Électricité d’Haïti (EDH) » — N’A PAS`)
  console.log(`     ÉTÉ FOURNI (pages 38 et suivantes, hors du fac-similé). Catalogué en base sous LM2016-23 :`)
  console.log(`     c’est la troisième pièce du triptyque marché / régulateur / opérateur, à réclamer.`)
  console.log(`  fac-similé : absent du fonds MONITEUR_PDF_2016 (n° 21 à 23 de 2016 manquants), mais la cliente`)
  console.log(`     en fournit un scan de 30 pages couvrant exactement les pages 1-18, 23-26 et 30-37 —`)
  console.log(`     « Energie - LM#23- merc. 3 fev.2016.pdf ». NON attaché par ce script.`)

  if (!APPLY) { console.log('\nSIMULATION — rien n’a été écrit.'); await prisma.$disconnect(); return }

  const max = await prisma.theme.aggregate({ where: { parentId: parent.id }, _max: { position: true } })
  const ids = new Map<string, string>()
  await prisma.$transaction(async (tx) => {
    const th = themeExiste ?? (await tx.theme.create({
      data: { ...THEME, parentId: parent.id, position: (max._max.position ?? -1) + 1 },
    }))
    if (!themeExiste) await audit({ action: 'THEME_CREATED', targetType: 'Theme', targetId: th.id, meta: { slug: THEME.slug, sous: 'economique' } }, tx)

    // 1ʳᵉ passe : les fiches. Les docRefs de l'index exigent des identifiants — ils n'existent
    // qu'après création, d'où la seconde passe.
    for (const p of prep) {
      const doc = await tx.document.create({
        data: {
          type: 'LEGISLATION', status: 'EN_VIGUEUR', titleFr: p.f.titre, number: p.f.titre,
          bodyOriginal: p.corps, originalLang: 'fr', source: p.f.source, category: 'LEGISLATION',
          moniteurRef: `${MONITEUR}, ${p.f.pages}`,
          adoptionDate: new Date('2016-01-06T00:00:00Z'),
          publicationDate: new Date('2016-02-03T00:00:00Z'),
          annotationsJson: JSON.stringify({ title: p.f.titre, annotationAuthor: AVERTISSEMENT, toc: p.toc, navToc: [], connexes: [], connexe: {}, jurisprudence: {}, indexEntries: [], commentaires: {}, labels: {} }),
        },
      })
      ids.set(p.f.slug, doc.id)
      const themeId = p.f.theme === THEME.slug ? th.id : interieur.id
      await tx.documentTheme.create({ data: { documentId: doc.id, themeId, isPrimary: true, assignedBy: 'IMPORT' } })
    }

    // 2ᵉ passe : annotations complètes, index à renvois croisés compris.
    const titrePar: Record<string, string> = Object.fromEntries(FICHES.map((f) => [f.slug, f.titre]))
    for (const p of prep) {
      const entries = entreesIndex(p.index, ids)
      await tx.document.update({
        where: { id: ids.get(p.f.slug)! },
        data: {
          annotationsJson: JSON.stringify({
            title: p.f.titre, annotationAuthor: AVERTISSEMENT, toc: p.toc,
            navToc: p.nav,
            connexes: [], connexe: {}, jurisprudence: {},
            indexEntries: entries, commentaires: p.commentaires,
            labels: Object.fromEntries(p.anc.map((a) => [a, libelleArticle(a)])),
          }),
        },
      })
      await audit({ action: 'DOC_PUBLISHED', targetType: 'Document', targetId: ids.get(p.f.slug)!, meta: { source: p.f.source, articles: p.anc.length, moniteur: MONITEUR } }, tx)
    }

    const idE = ids.get('energie')!, idD = ids.get('dsis')!, idA = ids.get('anarse')!
    await tx.crossRef.createMany({
      data: [
        { fromId: idE, toId: idA, toType: 'LEGISLATION', toAnchor: 'art-1', kind: 'CITE', position: 0, source: 'EDITORIAL',
          toLabel: titrePar.anarse,
          note: 'Article 22 du Décret énergie : « L’État organise, en partenariat avec les opérateurs du transport, à travers l’Autorité Nationale de Régulation du Secteur de l’Énergie… ». Seul renvoi NOMINATIF entre les deux décrets d’énergie ; le Décret ANARSE ne renvoie au premier que de façon générique (« les lois et règlements régissant le secteur de l’énergie électrique », art. 3), aucun renvoi n’est fabriqué en sens inverse.' },
        { fromId: idD, toType: 'LEGISLATION', kind: 'ABROGE', position: 0, source: 'EDITORIAL',
          toNumber: 'Décret du 30 janvier 1989 créant un Organisme Autonome dénommé « Corps Autonome des Pompiers » (CAP)',
          toLabel: 'Décret du 30 janvier 1989 créant le Corps Autonome des Pompiers (CAP)',
          note: 'Article 1er du Décret DSIS : « Le Décret du 13 février 1989 créant le Corps Autonome des Pompiers (CAP) est et demeure rapporté. » ⚠️ Le décret de 2016 le désigne par sa date de PUBLICATION ; sa date de SIGNATURE est le 30 janvier 1989, établie par une source indépendante — le titre du « Décret modifiant l’article 14 du Décret du 30 janvier 1989 créant le CAP », entrée LM1989-86A de l’Index du Moniteur. Le corps de 2016 n’est pas corrigé : le Moniteur fait foi. Renvoi PAR DÉSIGNATION, sans toId : le décret CAP n’existe au corpus qu’en notice de catalogue (LM1989-12A), pas en texte intégral — c’est lui qui manque pour poser la pastille « abrogé ».' },
        { fromId: idE, toId: codePenal.id, toType: 'LEGISLATION', kind: 'CITE', position: 1, source: 'EDITORIAL',
          toLabel: codePenal.titleFr ?? 'Code pénal d’Haïti',
          note: 'Article 72, alinéa 2, du Décret énergie : « Si cet acte cause la mort ou des blessures graves sans intention de les donner, son auteur est puni conformément au Code Pénal. » Le renvoi commande la peine applicable : il est nominatif et sa cible est au corpus.' },
        { fromId: idE, toType: 'LEGISLATION', kind: 'CITE', position: 2, source: 'EDITORIAL',
          toNumber: 'Loi du 9 septembre 2002 portant sur le Code des investissements modifiant le Décret du 30 octobre 1989',
          toLabel: 'Code des investissements (Loi du 9 septembre 2002)',
          note: 'Article 14, alinéa 2, du Décret énergie : « Le titulaire de la licence de production ne bénéficie d’aucune subvention de l’État en dehors des avantages incitatifs prévus dans le Code des investissements et toute autre loi en vigueur. » Renvoi PAR DÉSIGNATION : le texte intégral n’est pas au corpus, seule la notice de l’Index du Moniteur y figure.' },
      ],
    })

    await audit({
      action: 'DOC_PUBLISHED', targetType: 'Document', targetId: 'ENERGIE_MONITEUR_23_2016',
      meta: {
        motif:
          'Trois décrets du Moniteur n° 23 du 3 février 2016, tous signés du 6 janvier 2016, versés en ' +
          'Législation annotée : Décret régissant le secteur de l’énergie électrique (84 art., 5 titres, ' +
          '12 chapitres, 4 sections), Décret créant au MICT une Direction chargée du Service d’Incendie ' +
          'et de Secours (11 art.), Décret créant l’ANARSE (33 art.). Sous-thème « Énergie & électricité » ' +
          'créé sous Droit économique & des affaires (niveau 2, comme Droit minier : un niveau 3 sort du ' +
          'menu de domaine de la recherche). ⚠️ Le décret DSIS N’EST PAS un texte d’énergie — il ne ' +
          'partage que le fascicule et la date — et va sous Intérieur & collectivités territoriales. ' +
          '⚠️ Aucune pastille : les trois clauses finales sont des clauses-balai. Seule abrogation ' +
          'nominative, l’article 1er du DSIS rapporte le décret CAP, signé du 30 JANVIER 1989 et désigné ' +
          'par le décret de 2016 sous sa date de publication (13 février) : renvoi par désignation, le ' +
          'corps de 2016 n’est pas corrigé. ⚠️ LE FASCICULE PORTE QUATRE DÉCRETS : le quatrième, qui refonde ' +
          'l’Électricité d’Haïti (EDH), N’A PAS ÉTÉ FOURNI (pages 38 et suivantes) — il est catalogué sous ' +
          'LM2016-23 et reste à réclamer. ⚠️ L’abrogation implicite du monopole de la Loi du 18 juin 1948 ' +
          'ne peut pas être mesurée : aucun texte d’énergie n’est au corpus, et le décret EDH du même jour ' +
          'manque. 38 renvois au préambule n’ont pas d’ancre ; les 13 emplacements de sujet qui n’avaient ' +
          'que lui sont conservés sans lien, suffixés « (préambule — visas) ». AUCUN renvoi n’est tiré des ' +
          'clauses-balai — le rendu public afficherait « cible non importée ». Fac-similé absent du fonds ' +
          'PDF (n° 21 à 23 de 2016) ; la cliente en fournit un scan de 30 pages, non attaché par ce script.',
        verses: prep.map((p) => p.f.source), articles: prep.map((p) => p.anc.length),
        index: prep.map((p) => p.index.length), renvois: prep.reduce((n, p) => n + p.renvois, 0),
      },
    }, tx)
  }, { timeout: 180_000, maxWait: 30_000 })

  // ── contrôles de sortie : on RELIT la base (audit() avale ses erreurs) ─────────────────
  const journal = await prisma.auditLog.count({ where: { targetId: 'ENERGIE_MONITEUR_23_2016' } })
  for (const id of ids.values()) await reindexDocument(id)
  console.log(`\n✓ AuditLog ${journal} (recompté) · ${ids.size} documents réindexés`)
  const th = await prisma.theme.findFirst({ where: { slug: THEME.slug }, select: { position: true, parent: { select: { labelFr: true } }, _count: { select: { documents: true } } } })
  console.log(`  sous-thème : sous « ${th?.parent?.labelFr} », position ${th?.position}, ${th?._count.documents} document(s)`)
  for (const p of prep) {
    const d = await prisma.document.findUnique({
      where: { id: ids.get(p.f.slug)! },
      select: { bodyOriginal: true, annotationsJson: true, titleFr: true, number: true, adoptionDate: true, publicationDate: true, themes: { select: { isPrimary: true, theme: { select: { slug: true } } } } },
    })
    const a = JSON.parse(String(d?.annotationsJson ?? '{}'))
    const blocs = segmentAnnotated(d?.bodyOriginal ?? '', a.toc ?? []) as { kind: string; anchor?: string | null }[]
    const rendu = new Set(blocs.filter((b) => b.kind === 'body' && b.anchor).map((b) => b.anchor))
    const morts = (a.indexEntries ?? []).flatMap((e: Idx) => e.ctRefs.filter((n) => !rendu.has(`art-${n}`)))
    const prim = d?.themes.filter((t) => t.isPrimary) ?? []
    console.log(`  ${p.f.source.padEnd(30)} ${rendu.size} ancres · sommaire ${(a.toc ?? []).length} · rubriques ${Object.keys(a.commentaires ?? {}).length} · index ${(a.indexEntries ?? []).length} · renvois morts ${morts.length} · titre=réf ${d?.titleFr === d?.number ? 'oui' : 'NON'} · ${prim.length} primaire (${prim.map((t) => t.theme.slug).join(',')}) · adopté ${d?.adoptionDate?.toISOString().slice(0, 10)} publié ${d?.publicationDate?.toISOString().slice(0, 10)}`)
  }
  const xr = await prisma.crossRef.count({ where: { fromId: { in: [...ids.values()] } } })
  console.log(`  ${xr} renvois posés, tous NOMINATIFS (aucun tiré d’une clause-balai)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  const m = e instanceof Error ? e.message : String(e)
  console.error('ÉCHEC :', m.trim() ? m : e)
  await prisma.$disconnect(); process.exit(1)
})
