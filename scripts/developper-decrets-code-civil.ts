/**
 * Code civil — « D. » veut dire DÉCRET (Me Vaval, 18 oct. 2026) : « Remplacer par Décret et, quand le
 * texte ou le moniteur est en base, faire la cross-reference. »
 *
 * 1. « D. du … » → « Décret du … », « D. L. / D.L. / D.-L. du … » → « Décret-loi du … », partout où le
 *    lecteur les montre : corps, rédactions (`ArticleVersion`), annotations (connexe, commentaires,
 *    jurisprudence, anciennes rédactions). Les notes de preuve des versions (`note`, non affichées)
 *    citent le livre entre guillemets : elles ne bougent pas.
 * 2. Les quatre mentions fautives du livre, corrigées sans note (décision du 18 oct.) : 202 « 1892 »,
 *    204 « 8 août », 1334 année omise → 8 octobre 1982 ; 286 « 6 juin 2006 » → 6 juillet 2005 (art. 9).
 * 3. ⚠️ « (D. du 13 mai 2020) » / « (D. du 14 mai 2020) » en tête des rédactions de 2020 datent l'acte
 *    de sa PUBLICATION : les deux décrets sont du 9 avril 2020 et se distinguent par leur OBJET — ils
 *    deviennent « (Décret du 9 avril 2020 portant réforme des régimes matrimoniaux) » et « (Décret du
 *    9 avril 2020 réformant le droit des sûretés) ».
 * 4. Le décret du 6 juin 1968 se nomme comme l'imprime l'encadré du livre (art. 254) : « réglementant
 *    l'introduction de la demande en divorce (Le Moniteur n° 40 du 6 juin 1968) ». La fiche
 *    « Appendice IV.5 » qui le disait « du 20 juin, n° 51 » ne reproduit pas son texte.
 * 5. `annotations.actesLies` : désignation → fiche, pour les décrets dont le texte ou le Moniteur est
 *    en base. Le lecteur lie chaque occurrence (src/lib/doc/acterefs.ts).
 *
 *     npx tsx scripts/developper-decrets-code-civil.ts            # à blanc
 *     npx tsx scripts/developper-decrets-code-civil.ts --commit   # écrit
 */
import { PrismaClient } from '@prisma/client'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'

const ID = 'cmr4b6f3v0000iz56asjmwrlg'
const COMMIT = process.argv.includes('--commit')
const prisma = new PrismaClient()

/** « D. », « D. L. », « D.L. », « D.-L. », « D-L. » devant « du / No / N° ». */
const D_RE = /(?<![\p{L}])D\s*(?:\.\s*-?\s*L\s*\.|-\s*L\s*\.|\.)\s*(?=(?:du|No\.?|N°|n°)\s)/gu
const developper = (s: string) => s.replace(D_RE, (m) => (/L/.test(m) ? 'Décret-loi ' : 'Décret '))

const COQUILLES: [string, string, string][] = [
  ['art-202', 'V. le D. du 8 octobre 1892.', 'V. le Décret du 8 octobre 1982.'],
  ['art-204', 'V. le D. du 8 août 1982.', 'V. le Décret du 8 octobre 1982.'],
  ['art-286', "V. l'art. 9 du D. du 6 juin 2006.", "V. l'art. 9 du Décret du 6 juillet 2005."],
  ['art-1334', "V. l'art. 8 du D. du 8 octobre.", "V. l'art. 8 du Décret du 8 octobre 1982."],
]
const MARQUES_2020: [string, string][] = [
  ['(D. du 13 mai 2020)', '(Décret du 9 avril 2020 portant réforme des régimes matrimoniaux)'],
  ['(D. du 14 mai 2020)', '(Décret du 9 avril 2020 réformant le droit des sûretés)'],
]
const NOMS_1968: [string, string][] = [
  ['Décret du 6 juin 1968 réglementant la procédure du divorce (Le Moniteur n° 51 du 20 juin 1968)', "Décret du 6 juin 1968 réglementant l'introduction de la demande en divorce (Le Moniteur n° 40 du 6 juin 1968)"],
  [
    'Loi du 29 avril 1949 modifiant certaines dispositions relatives au divorce et Décret du 6 juin 1968 réglementant la procédure du divorce',
    "Loi du 29 avril 1949 modifiant certaines dispositions relatives au divorce et Décret du 6 juin 1968 réglementant l'introduction de la demande en divorce",
  ],
]
const RM = 'cmrldw5ea0000u9drkn5uc7su'
const SURETES = 'cmrspgd9h0000yn8emki3dtw6'
const ACTES_LIES: Record<string, string> = {
  'Décret du 8 octobre 1982': 'cmsxer4wd002114p5o4xre87u', // Le Moniteur n° 75 — Octobre 1982
  'Décret du 30 août 1988': 'cmsw65a3m001ef80vu277zpnk', // Le Moniteur n° 78-A — Septembre 1988
  'Décret du 14 septembre 1983': 'cmsxebxky002413upaav23ev4', // Le Moniteur n° 74 — Octobre 1983
  'Décret du 6 juillet 2005': 'cmri3mf9q0000pnzrmnabdj4z', // fiche du décret
  'Décret du 9 avril 2020 portant réforme des régimes matrimoniaux': RM,
  'Décret portant réforme des régimes matrimoniaux': RM,
  'Décret sur les régimes matrimoniaux': RM,
  'Décret du 9 avril 2020 réformant le droit des sûretés': SURETES,
  'Décret réformant le droit des sûretés': SURETES,
}
const CHAMPS = ['connexe', 'commentaires', 'jurisprudence', 'oldVersions'] as const

function* feuilles(o: unknown): Generator<string> {
  if (typeof o === 'string') yield o
  else if (Array.isArray(o)) for (const v of o) yield* feuilles(v)
  else if (o && typeof o === 'object') for (const v of Object.values(o)) yield* feuilles(v)
}
function remplacerFeuilles(o: unknown, f: (s: string) => string): unknown {
  if (typeof o === 'string') return f(o)
  if (Array.isArray(o)) return o.map((v) => remplacerFeuilles(v, f))
  if (o && typeof o === 'object') return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, remplacerFeuilles(v, f)]))
  return o
}
const compter = (s: string) => (s.match(D_RE) ?? []).length

async function main() {
  const doc = await prisma.document.findUniqueOrThrow({ where: { id: ID }, select: { bodyOriginal: true, annotationsJson: true } })
  const versions = await prisma.articleVersion.findMany({ where: { documentId: ID }, select: { id: true, anchor: true, status: true, body: true, amendedByNumber: true, effectiveDate: true } })
  const brut = JSON.parse(doc.annotationsJson!) as Record<string, any>

  // Garde : aucun intitulé ne porte « D. » (le corps se segmente sur l'égalité exacte avec la table).
  const titres = [...feuilles(brut.toc), ...feuilles(brut.navToc)].filter((t) => compter(t))
  if (titres.length) throw new Error(`⛔ intitulé(s) portant « D. » : ${titres.join(' | ')}`)

  // 1-2. Mentions fautives du livre : chacune trouvée UNE fois, au bon article.
  for (const [ancre, avant, apres] of COQUILLES) {
    const blocs = (brut.connexe?.[ancre] ?? []) as { text: string }[]
    const k = blocs.filter((b) => b.text === avant).length
    if (k !== 1) throw new Error(`⛔ ${ancre} : « ${avant} » trouvé ${k} fois`)
    for (const b of blocs) if (b.text === avant) b.text = apres
  }
  // 3. Marques de 2020 (avant la règle générale : elles changent aussi de date).
  const marques = (s: string) => MARQUES_2020.reduce((t, [a, b]) => t.split(a).join(b), s)
  const f = (s: string) => developper(marques(s))

  const avantCorps = compter(doc.bodyOriginal)
  const corps = f(doc.bodyOriginal)
  if (corps.split('\n').length !== doc.bodyOriginal.split('\n').length) throw new Error('⛔ le corps a changé de nombre de lignes')
  const avantAnn = CHAMPS.reduce((n, c) => n + [...feuilles(brut[c])].reduce((m, s) => m + compter(s), 0), 0)
  for (const c of CHAMPS) if (brut[c]) brut[c] = remplacerFeuilles(brut[c], f)
  brut.actesLies = { ...(brut.actesLies ?? {}), ...ACTES_LIES }

  const parVersion: { id: string; body?: string; amendedByNumber?: string; effectiveDate?: Date }[] = []
  let marques2020 = 0
  for (const v of versions) {
    const u: (typeof parVersion)[number] = { id: v.id }
    const b = f(v.body)
    if (b !== v.body) {
      u.body = b
      marques2020 += MARQUES_2020.reduce((n, [a]) => n + v.body.split(a).length - 1, 0)
    }
    const nom = NOMS_1968.find(([a]) => a === v.amendedByNumber)
    if (nom) {
      u.amendedByNumber = nom[1]
      if (v.effectiveDate?.toISOString().slice(0, 10) === '1968-06-20') u.effectiveDate = new Date('1968-06-06T00:00:00Z')
    }
    if (Object.keys(u).length > 1) parVersion.push(u)
  }
  const avantVers = versions.reduce((n, v) => n + compter(v.body), 0)

  // Recompte : plus aucun « D. » d'acte là où le lecteur affiche.
  const reste = compter(corps) + CHAMPS.reduce((n, c) => n + [...feuilles(brut[c])].reduce((m, s) => m + compter(s), 0), 0) + versions.reduce((n, v) => n + compter(parVersion.find((p) => p.id === v.id)?.body ?? v.body), 0)
  console.log(`corps : ${avantCorps} « D. » ; annotations : ${avantAnn} ; versions : ${avantVers} (dont ${marques2020} marques de 2020 redatées)`)
  console.log(`mentions fautives corrigées : ${COQUILLES.length} ; versions touchées : ${parVersion.length} (dont ${parVersion.filter((p) => p.amendedByNumber).length} noms du décret de 1968)`)
  console.log(`actes liés : ${Object.keys(ACTES_LIES).length} désignations → ${new Set(Object.values(ACTES_LIES)).size} fiches`)
  console.log(`« D. » restants à l'écran : ${reste}`)
  if (reste) throw new Error('⛔ des « D. » subsistent')
  const cibles = await prisma.document.findMany({ where: { id: { in: [...new Set(Object.values(ACTES_LIES))] } }, select: { id: true, titleFr: true } })
  for (const c of cibles) console.log(`  → ${c.id} « ${c.titleFr} »`)
  if (cibles.length !== new Set(Object.values(ACTES_LIES)).size) throw new Error('⛔ une fiche cible est absente')
  if (!COMMIT) return console.log('(à blanc — --commit pour écrire)')

  await prisma.$transaction(
    async (tx) => {
      await tx.document.update({ where: { id: ID }, data: { bodyOriginal: corps, annotationsJson: JSON.stringify(brut) } })
      for (const { id, ...data } of parVersion) await tx.articleVersion.update({ where: { id }, data })
    },
    { timeout: 180_000, maxWait: 30_000 },
  )
  await reindexDocument(ID)
  await audit({
    action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: ID,
    meta: { via: 'developper-decrets-code-civil', corps: avantCorps, annotations: avantAnn, versions: parVersion.length, actesLies: Object.keys(ACTES_LIES).length, decision: '« D. » = Décret, cross-reference — Me Vaval, 18 oct. 2026' },
  })
  // ⚠️ `audit()` avale ses erreurs : on recompte après la transaction.
  const apres = await prisma.document.findUniqueOrThrow({ where: { id: ID }, select: { bodyOriginal: true, annotationsJson: true } })
  const v2 = await prisma.articleVersion.findMany({ where: { documentId: ID }, select: { body: true } })
  const a2 = JSON.parse(apres.annotationsJson!) as Record<string, unknown>
  const n = compter(apres.bodyOriginal) + CHAMPS.reduce((k, c) => k + [...feuilles(a2[c])].reduce((m, s) => m + compter(s), 0), 0) + v2.reduce((k, v) => k + compter(v.body), 0)
  console.log(`✅ écrit — « D. » restants : ${n} ; actesLies : ${Object.keys((a2.actesLies as object) ?? {}).length}`)
}

main().finally(() => prisma.$disconnect())
