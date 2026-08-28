/**
 * Porte les AMENDEMENTS et ABROGATIONS du corpus des jeux de hasard.
 *
 *   npx tsx scripts/amendements-jeux-hasard.ts            (à blanc)
 *   npx tsx scripts/amendements-jeux-hasard.ts --commit   (écrit)
 *
 * Deux strates, et elles ne se traitent PAS de la même façon :
 *
 * 1. LA RÉFORME DE SEPTEMBRE 1958 NOMME SES CIBLES. Elle réécrit dix articles de la loi
 *    organique et en abroge deux. La cause est certaine, le texte de remplacement est donné :
 *    `ArticleVersion` porte l'ancienne rédaction (MODIFIE) et la nouvelle (EN_VIGUEUR).
 *
 * 2. LES DÉCRETS DE 2026 NE NOMMENT PERSONNE. Leur clause est un balai — « abroge toutes
 *    Lois […] qui lui sont contraires ». L'abrogation est donc DÉDUITE, article par article,
 *    par la confrontation des textes (docs/analyse-abrogations-jeux-1958-1960-vs-2026.md).
 *    ⚠️ Une abrogation déduite DOIT dire par quoi : chaque article barré porte, dans sa note,
 *    le décret qui l'emporte et la raison. Un article barré sans cause est pire qu'un article
 *    intact — le lecteur ne peut ni s'y fier ni le vérifier.
 *
 * ⚠️ ON N'INVENTE AUCUNE RÉDACTION. Pour la strate 2, il n'y a pas de texte de remplacement :
 * le statut est ABROGE, jamais MODIFIE. Écrire une « nouvelle rédaction » là où le législateur
 * n'en a donné aucune serait fabriquer du droit.
 */
import { PrismaClient } from '@prisma/client'
import { audit } from '../src/lib/auth/audit'
import { articleAnchorFromHeading } from '../src/lib/doc/anchors'

const prisma = new PrismaClient()

/**
 * ⚠️ L'ANCRE VIENT DE L'APPLICATION, PAS D'UNE CHAÎNE BRICOLÉE. « Article 1er » ne produit
 * pas `art-1er` mais `art-1` : une première version écrivait `art-${numéro}` et l'abrogation
 * de l'article 1er du décret des casinos — la plus importante du corpus, celle du monopole —
 * ne s'appliquait à rien, en silence.
 */
function ancre(num: string): string {
  return articleAnchorFromHeading(`Article ${num}.- x`) ?? `art-${num}`
}

/** Réforme de septembre 1958 : article de la réforme → article réécrit de la loi organique. */
const REECRITS_1958: Record<string, string> = {
  '1er': '3', '2': '4', '3': '5', '4': '6', '5': '8',
  '6': '14', '7': '15', '9': '19', '10': '24', '11': '28',
}
/** Réforme de septembre 1958 : articles abrogés NOMMÉMENT. */
const ABROGES_1958 = [
  { article: '17', par: '8' },
  { article: '29', par: '12' },
]
/** ⚠️ DEUX RÉÉCRITURES SONT PARTIELLES — le dire, sinon la fiche ment sur leur portée. */
const PARTIELS: Record<string, string> = {
  '5': 'premier alinéa seulement',
  '8': 'son 1° seulement',
}

/** 2026 : abrogations DÉDUITES de la contradiction, avec leur motif. */
const ABROGES_2026 = [
  { source: 'LOI_LOTERIE_LEH_1958', article: '1er', motif: "réserve la loterie « sous toutes ses formes » à l'État seul, quand le Décret du 11 août 2026 portant règlementation (art. 5 et 7, 3°) délivre une licence d'exploitation de borlette à des Sociétés Anonymes privées" },
  { source: 'LOI_LOTERIE_LEH_1958', article: '2', motif: "ne reconnaît qu'une seule Loterie exploitée directement par l'État, quand le Décret du 11 août 2026 organise une pluralité d'opérateurs licenciés" },
  { source: 'DECRET_CASINOS_1960', article: '1er', motif: "réserve l'établissement et l'exploitation des casinos à l'État, quand le Décret du 11 août 2026 (art. 7, 1°) délivre une licence de maison de jeux de grand luxe à des Sociétés Anonymes" },
  { source: 'DECRET_CASINOS_1960', article: '2', motif: "subordonne tout jeu de hasard au transfert du droit à un concessionnaire, quand le Décret du 11 août 2026 institue un régime de licence" },
  { source: 'DECRET_CASINOS_1960', article: '3', motif: "réserve la concession à qui possède un hôtel d'au moins 200 chambres, condition que le dossier de licence du Décret du 11 août 2026 (art. 6) ne connaît pas" },
  { source: 'DECRET_CASINOS_1960', article: '4', motif: "arrête une liste fermée des jeux autorisés, quand le Décret du 11 août 2026 (art. 4, 4° et 63) définit les jeux par leur nature et en confie la règlementation à l'ANJHA" },
  { source: 'DECRET_CASINOS_1960', article: '5', motif: "plafonne les tables à sept et les machines à sous à cent, quand le Décret du 11 août 2026 (art. 8 et 63) confie ces critères à l'ANJHA" },
  { source: 'DECRET_CASINOS_1960', article: '6', motif: "fixe la licence annuelle à 5 000 Gourdes et un droit fixe de 40 % libératoire de tout autre impôt, quand le Décret du 11 août 2026 établissant le régime d'imposition fixe la licence à 10 000 000 Gourdes (art. 3) et un acompte de 5 % sur le Produit Brut des Jeux (art. 5)" },
  { source: 'DECRET_CASINOS_1960', article: '7', motif: "confie l'autorisation à la Secrétairerie d'État des Finances, quand le Décret du 11 août 2026 la confie à l'Autorité Nationale des Jeux de Hasard et d'Argent" },
  { source: 'DECRET_CASINOS_1960', article: '8', motif: "subordonne l'autorisation à la propriété d'un hôtel, quand le Décret du 11 août 2026 (art. 6, 7°) exige un dépôt de garantie de 5 000 000 Gourdes à la BRH" },
  { source: 'DECRET_CASINOS_1960', article: '10', motif: "confie le contrôle à l'Administration Générale des Contributions, quand le Décret du 11 août 2026 le confie à l'ANJHA et la perception à la Direction Générale des Impôts" },
]

const TETE = /^Article\s+(\d+(?:er)?(?:\.\d+)?)\s*\.?\s*[—–-]/

/** Le corps d'un article, de sa tête à la tête suivante. */
function corpsArticle(body: string, num: string): string | null {
  const L = body.split('\n')
  let d = -1
  for (let i = 0; i < L.length; i++) {
    const m = TETE.exec(L[i].trim())
    if (m && m[1] === num) { d = i; break }
  }
  if (d < 0) return null
  let f = L.length
  for (let i = d + 1; i < L.length; i++) if (TETE.test(L[i].trim())) { f = i; break }
  return L.slice(d, f).join('\n').trim()
}

/**
 * La RÉDACTION NOUVELLE que donne un article amendant — et elle seule.
 *
 * ⚠️ L'ARTICLE AMENDANT N'EST PAS LA RÉDACTION NOUVELLE. Il est en deux parties : une
 * INSTRUCTION (« L'article 3 de la loi du 14 Avril 1958 est modifié comme suit : ») puis la
 * rédaction, entre guillemets, sur les lignes suivantes. Une première version de ce script a
 * pris le tout : l'article 3 de la loi organique affichait « L'article 3 est modifié comme
 * suit : » à la place de son propre texte. La loi se citait elle-même au lieu de se dire.
 *
 * On rend donc l'article à sa forme d'article : tête renumérotée sur la CIBLE, source entre
 * parenthèses comme au Code civil, guillemets de citation retirés.
 */
function redactionNouvelle(bloc: string, cible: string, ancienArticle: string): string | null {
  const L = bloc.split('\n')
  // La première ligne porte l'instruction ; la rédaction commence à la suivante.
  const corps = L.slice(1).join('\n').trim()
  if (!corps) return null
  const neuf = corps.replace(/^[«"]\s*/, '').replace(/\s*[»"]\s*\.?$/, '').trim()

  /**
   * ⚠️ UNE RÉÉCRITURE PARTIELLE NE REMPLACE PAS L'ARTICLE ENTIER. La réforme ne touche que
   * le PREMIER ALINÉA de l'article 5 et le 1° de l'article 8 : substituer tout l'article
   * ferait disparaître ses sept autres points. Une première version l'a fait — l'article 5,
   * qui énumère huit attributions du Directeur, n'en affichait plus qu'une.
   *
   * On reconstruit donc l'article : sa tête, la ligne visée remplacée, le reste intact.
   */
  if (PARTIELS[cible]) {
    const AL = ancienArticle.split('\n')
    // La ligne visée est le 1°) — le premier alinéa numéroté après la tête.
    const i = AL.findIndex((l, k) => k > 0 && /^1\s*[°º]\s*\)/.test(l.trim()))
    if (i < 0) return null
    const refait = [...AL]
    refait[i] = `1º) ${neuf.replace(/^[A-ZÉÈ]/, (c) => c.toLowerCase())}`
    refait[0] = refait[0].replace(/^(Article\s+\S+\s*\.?\s*[—–-])/, '$1 (L. du 2 septembre 1958,\u00a0' + PARTIELS[cible] + ')')
    return refait.join('\n')
  }
  return `Article ${cible}.— (L. du 2 septembre 1958) ${neuf}`
}

async function main() {
  const commit = process.argv.includes('--commit')
  const docs = await prisma.document.findMany({
    where: { source: { in: ['LOI_LOTERIE_LEH_1958', 'LOI_LOTERIE_LEH_REFORME_1958', 'DECRET_CASINOS_1960'] } },
    select: { id: true, source: true, bodyOriginal: true },
  })
  const par = new Map(docs.map((d) => [d.source!, d]))
  const loi = par.get('LOI_LOTERIE_LEH_1958')!
  const reforme = par.get('LOI_LOTERIE_LEH_REFORME_1958')!
  const casinos = par.get('DECRET_CASINOS_1960')!

  const aEcrire: { documentId: string; anchor: string; status: string; body: string; note: string }[] = []

  // ── 1958 : dix réécritures, l'ancienne rédaction se replie ────────────────────────────
  for (const [artReforme, cible] of Object.entries(REECRITS_1958)) {
    const ancien = corpsArticle(loi.bodyOriginal ?? '', cible)
    const bloc = corpsArticle(reforme.bodyOriginal ?? '', artReforme)
    if (!ancien || !bloc) { console.log(`   ⚠ art. ${cible} : introuvable`); continue }
    const nouveau = redactionNouvelle(bloc, cible, ancien)
    if (!nouveau) { console.log(`   ⚠ art. ${cible} : rédaction nouvelle illisible`); continue }
    const portee = PARTIELS[cible] ? ` (${PARTIELS[cible]})` : ''
    aEcrire.push({
      documentId: loi.id, anchor: ancre(cible), status: 'MODIFIE', body: ancien,
      note: `Rédaction d'origine, remplacée par l'article ${artReforme} de la Loi du 2 septembre 1958${portee}.`,
    })
    aEcrire.push({
      documentId: loi.id, anchor: ancre(cible), status: 'EN_VIGUEUR', body: nouveau,
      note: `Rédaction issue de l'article ${artReforme} de la Loi du 2 septembre 1958${portee}.`,
    })
  }
  for (const { article, par: p } of ABROGES_1958) {
    const ancien = corpsArticle(loi.bodyOriginal ?? '', article)
    if (!ancien) { console.log(`   ⚠ art. ${article} : introuvable`); continue }
    aEcrire.push({
      documentId: loi.id, anchor: ancre(article), status: 'ABROGE', body: ancien,
      note: `Abrogé par l'article ${p} de la Loi du 2 septembre 1958, qui le nomme.`,
    })
  }

  // ── 2026 : abrogations DÉDUITES d'une clause balai ───────────────────────────────────
  for (const a of ABROGES_2026) {
    const d = a.source === 'LOI_LOTERIE_LEH_1958' ? loi : casinos
    const corps = corpsArticle(d.bodyOriginal ?? '', a.article)
    if (!corps) { console.log(`   ⚠ ${a.source} art. ${a.article} : introuvable`); continue }
    aEcrire.push({
      documentId: d.id, anchor: ancre(a.article), status: 'ABROGE', body: corps,
      // ⚠️ La note PORTE le raisonnement : aucun décret de 2026 ne nomme cet article.
      note: `Abrogé par la clause abrogatoire générale des Décrets du 11 août 2026 sur les jeux de hasard et d'argent : aucun de ces décrets ne le nomme, mais il leur est contraire en ce qu'il ${a.motif}.`,
    })
  }

  console.log(`AMENDEMENTS ET ABROGATIONS — ${aEcrire.length} versions d'article\n`)
  const parDoc = new Map<string, number>()
  for (const x of aEcrire) parDoc.set(x.documentId, (parDoc.get(x.documentId) ?? 0) + 1)
  for (const [id, n] of parDoc) console.log(`   ${docs.find((d) => d.id === id)!.source!.padEnd(30)} ${n}`)
  console.log(`\n   MODIFIE ${aEcrire.filter((x) => x.status === 'MODIFIE').length} · EN_VIGUEUR ${aEcrire.filter((x) => x.status === 'EN_VIGUEUR').length} · ABROGE ${aEcrire.filter((x) => x.status === 'ABROGE').length}`)
  console.log(`   dont abrogations NOMMÉES ${ABROGES_1958.length} · DÉDUITES ${ABROGES_2026.length}`)

  if (!commit) { console.log('\n(à blanc — ajouter --commit pour écrire)'); await prisma.$disconnect(); return }

  const deja = await prisma.articleVersion.count({ where: { documentId: { in: [...parDoc.keys()] } } })
  if (deja) { console.error(`\n⛔ ARRÊT — ${deja} versions existent déjà sur ces textes.`); process.exit(1) }
  for (const x of aEcrire) await prisma.articleVersion.create({ data: x })
  await audit({ action: 'DOC_PUBLISHED', targetType: 'DOCUMENT', meta: { via: 'amendements-jeux-hasard', versions: aEcrire.length } })
  console.log(`\n✅ ${aEcrire.length} versions d'article écrites.`)
  await prisma.$disconnect()
}

main()
