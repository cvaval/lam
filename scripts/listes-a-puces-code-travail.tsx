/**
 * Code du travail annoté : énumérations rendues en liste à puces, à la demande de Me Vaval.
 *   - art. 110 (« Modifié par le Décret du 23 mai 1989 ») : les fêtes légales (20 oct. 2026 : « mettre la liste des
 *     jours en bullet points ») — chaque fête, ligne courte sans ponctuation finale, s'affichait en intertitre gras ;
 *   - art. 45 (barème du préavis) : 20 oct. 2026, « corriger les bullet points de l'article 45 », texte fourni par
 *     elle — les lignes commençant en minuscule (« de 3 mois… ») étaient recousues en un seul paragraphe ; « et » passe
 *     à la fin du 4ᵉ point, comme elle l'écrit ;
 *   - art. 41 et 42 (motifs de résiliation) : 20 oct. 2026, « corriger les bullets points des articles 41 et 42 »,
 *     texte fourni par elle — même recousage. À l'art. 42, ses points ne suivent pas les retours à la ligne de la
 *     base (« a provoqué… » devient un point ; l'absence et le refus des mesures de prévention en font un seul, de même
 *     l'inaptitude et la condamnation) : on suit SON découpage, mots inchangés (vérifié).
 *
 * « • » en tête de ligne : `parseOfficialText` (BULLET_RE) en fait une vraie liste. Les mots ne changent pas (vérifié).
 * Rejouable : une opération déjà appliquée est sautée.
 *
 * Garde-fous (refus d'écrire si l'un échoue) : chaque liste est exactement celle attendue, à sa place, une seule fois ;
 * mêmes mots ; même segmentation (ancres, clés d'annotation : la jurisprudence reste attachée) ; rendu : autant de
 * puces de plus que de points ajoutés, mêmes liens ; la fiche n'a pas changé depuis la lecture.
 * Instantané écrit AVANT (hors dépôt) : `<dossier>/<id>-<horodatage>.json`.
 *
 *     npx tsx --tsconfig <tsconfig jsx> scripts/listes-a-puces-code-travail.tsx <dossier instantanés> [--commit]
 */
import { PrismaClient } from '@prisma/client'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { AnnotatedText } from '../src/components/AnnotatedText'
import { parseAnnotations, segmentAnnotated, type Annotations } from '../src/lib/legislation/annotated'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const DOSSIER = process.argv.slice(2).find((a) => !a.startsWith('--'))
const COMMIT = process.argv.includes('--commit')
const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
const PUCE = '• '

type Op = { article: string; tete: string; avant: string[]; apres: string[] }
const FETES = [
  'Le Mardi Gras',
  'Le Vendredi Saint',
  'La Fête Dieu',
  'L’Assomption',
  'Le 17 Octobre, mort de Dessalines',
  'Le 2 Novembre, Fêtes des Morts',
  'Le 25 Décembre, Jour de Noël.',
]
const ART41 = [
  'lorsque l’employeur ne lui verse pas intégralement, sous réserve des déductions autorisées par la loi, aux dates et lieux convenus ou usuels, la rémunération qui lui revient;',
  'lorsque l’employeur, ou un membre de sa communauté domestique, ou une personne à son service agissant avec son consentement, exerce durant le travail des voies de fait ou se livre publiquement à des excès de langage, injures ou menaces contre le travailleur, rendant ainsi impossible l’harmonie des relations de travail;',
  'lorsque l’employeur ou son représentant cause intentionnellement des dégats à ses instruments ou outils de travail;',
  'lorsque l’employeur, un membre de sa famille, son représentant dans la direction des travaux ou un autre travailleur est atteint de maladie contagieuse, si le travailleur doit rester en contact immédiat avec la personne atteinte;',
  'lorsque la sécurité ou la santé du travailleur ou de sa famille est gravement menacée, soit en raison de l’absence de condition d’hygiène au lieu de travail ou de l’insalubrité excessive de la région, soit parce que l’employeur n’observe pas les mesures de prévention et de sécurité prescrites par la loi;',
  'lorsque l’employeur commet un manquement aux obligations que lui impose le contrat ou aux dispositions de l’article 31 du Code du Travail.',
]
const OPS: Op[] = [
  {
    article: 'art-110',
    tete: 'Article 1. Dès la publication du présent Décret, les Fêtes légales sont:',
    avant: FETES,
    apres: FETES.map((f) => PUCE + f),
  },
  {
    article: 'art-45',
    tete: 'Article 45. Ce préavis sera calculé de la manière suivante:',
    avant: [
      'de 3 mois à 12 mois de service . . . 15 jours',
      'de 1 an à 3 ans de service . . . 1 mois',
      'de 3 ans à 6 ans de service . . . 2 mois',
      'de 6 ans à 10 ans de service . . . 3 mois',
      'et à partir de 10 ans de service . . . 4 mois',
    ],
    apres: [
      PUCE + 'de 3 mois à 12 mois de service . . . 15 jours',
      PUCE + 'de 1 an à 3 ans de service . . . 1 mois',
      PUCE + 'de 3 ans à 6 ans de service . . . 2 mois',
      PUCE + 'de 6 ans à 10 ans de service . . . 3 mois et',
      PUCE + 'à partir de 10 ans de service . . . 4 mois',
    ],
  },
  {
    article: 'art-41',
    tete: 'Article 41. Le salarié qui désire mettre fin au contrat de travail conclu pour une durée déterminée ou non sans qu’il en résulte de responsabilité pour lui, en informera la Direction du Travail en invoquant l’un des motifs énumérés ci-dessous:',
    avant: ART41,
    apres: ART41.map((l) => PUCE + l),
  },
  {
    article: 'art-42',
    tete: 'Article 42. L’employeur qui désire mettre fin au contrat de travail du salarié conclu pour une durée déterminée ou non et sans qu’il résulte de responsabilité pour lui en ce qui concerne le préavis, en informera la Direction du Travail en invoquant l’un des motifs énumérés ci-dessous:',
    avant: [
      'lorsque le travailleur, durant son travail, s’est livré à des voies de faits contre son employeur ou contre un camarade; s’est livré publiquement à des excès de langage tels qu’injures ou menaces; a provoqué par sa conduite une grave perturbation à la discipline et une interruption du travail à l’établissement;',
      'lorsqu’il a commis un délit ou une contravention contre les biens au préjudice direct de l’employeur ou quand il a causé intentionnellement ou par négligence coupable des dégats aux machines, instruments, matières premières, produits et autres objets ayant une relation immédiate avec le travail ou a compromis la sécurité du lieu où sont exécutés les travaux et des personnes qui s’y trouvent;',
      'lorsque le travailleur s’abstient sans l’autorisation de l’employeur et sans motif valable de se présenter à son travail trois jours consécutifs ou quatre fois au cours du même mois;',
      'lorsque le travailleur après avertissement écrit, ou donné en présence de deux témoins, aura refusé d’observer les mesures de prévention des accidents ou de se conformer aux règlements intérieurs de l’établissement;',
      'lorsqu’à la conclusion du contrat de travail, le travailleur a induit l’employeur en erreur, en feignant de posséder des qualités ou connaissances qu’il ne possède manifestement pas ou en présentant des références ou attestations personnelles dont, par la suite, l’employeur constate la fausseté, ou lorsqu’il exécute son travail d’une manière qui démontre clairement son inaptitude aux travaux pour lesquels il a été engagé. Les dispositions de cet alinéa ne sont pas applicables aux travailleurs ayant plus de quatre (4) mois de service consécutifs;',
      'lorsque le travailleur a été condamné à la peine d’emprisonnement de plus d’un mois par une sentence passée en force de chose jugée;',
      'lorsque le travailleur commet un manquement aux obligations que lui impose son contrat ou aux dispositions de l’article 30 du Code du Travail.',
    ],
    apres: [
      PUCE + 'lorsque le travailleur, durant son travail, s’est livré à des voies de faits contre son employeur ou contre un camarade; s’est livré publiquement à des excès de langage tels qu’injures ou menaces;',
      PUCE + 'a provoqué par sa conduite une grave perturbation à la discipline et une interruption du travail à l’établissement;',
      PUCE + 'lorsqu’il a commis un délit ou une contravention contre les biens au préjudice direct de l’employeur ou quand il a causé intentionnellement ou par négligence coupable des dégats aux machines, instruments, matières premières, produits et autres objets ayant une relation immédiate avec le travail ou a compromis la sécurité du lieu où sont exécutés les travaux et des personnes qui s’y trouvent;',
      PUCE + 'lorsque le travailleur s’abstient sans l’autorisation de l’employeur et sans motif valable de se présenter à son travail trois jours consécutifs ou quatre fois au cours du même mois; lorsque le travailleur après avertissement écrit, ou donné en présence de deux témoins, aura refusé d’observer les mesures de prévention des accidents ou de se conformer aux règlements intérieurs de l’établissement;',
      PUCE + 'lorsqu’à la conclusion du contrat de travail, le travailleur a induit l’employeur en erreur, en feignant de posséder des qualités ou connaissances qu’il ne possède manifestement pas ou en présentant des références ou attestations personnelles dont, par la suite, l’employeur constate la fausseté, ou',
      PUCE + 'lorsqu’il exécute son travail d’une manière qui démontre clairement son inaptitude aux travaux pour lesquels il a été engagé. Les dispositions de cet alinéa ne sont pas applicables aux travailleurs ayant plus de quatre (4) mois de service consécutifs; lorsque le travailleur a été condamné à la peine d’emprisonnement de plus d’un mois par une sentence passée en force de chose jugée;',
      PUCE + 'lorsque le travailleur commet un manquement aux obligations que lui impose son contrat ou aux dispositions de l’article 30 du Code du Travail.',
    ],
  },
]

async function main() {
  if (!DOSSIER) throw new Error('usage : listes-a-puces-code-travail.tsx <dossier instantanés> [--commit]')
  const d = await prisma.document.findFirstOrThrow({
    where: { source: 'CODE_TRAVAIL_ANNOTE' },
    select: { id: true, bodyOriginal: true, annotationsJson: true, updatedAt: true },
  })
  const a = parseAnnotations(d.annotationsJson)! as Annotations
  let L = d.bodyOriginal.split('\n')
  const faites: string[] = []
  let ajoutees = 0
  for (const op of OPS) {
    const ts = L.flatMap((l, i) => (norm(l) === op.tete ? [i] : []))
    if (ts.length !== 1) throw new Error(`${op.article} : tête « ${op.tete} » trouvée ${ts.length} fois`)
    const t = ts[0]
    const suite = (n: number) => L.slice(t + 1, t + 1 + n).map(norm)
    if (suite(op.apres.length).join('|') === op.apres.join('|')) { console.log(`= ${op.article} : déjà en liste à puces`); continue }
    if (suite(op.avant.length).join('|') !== op.avant.join('|')) throw new Error(`${op.article} : liste inattendue ${JSON.stringify(suite(op.avant.length))}`)
    const sansPuce = (s: string) => (s.startsWith(PUCE) ? s.slice(PUCE.length) : s)
    if (norm(op.avant.join(' ')) !== norm(op.apres.map(sansPuce).join(' '))) throw new Error(`${op.article} : les mots changeraient`)
    L = [...L.slice(0, t + 1), ...op.apres, ...L.slice(t + 1 + op.avant.length)]
    faites.push(op.article)
    ajoutees += op.apres.filter((l) => l.startsWith(PUCE)).length - op.avant.filter((l) => l.startsWith(PUCE)).length
    console.log(`→ ${op.article}`); for (const l of L.slice(t, t + 1 + op.apres.length)) console.log('    ' + l)
  }
  if (!faites.length) { console.log('Rien à écrire.'); return }
  const body1 = L.join('\n')

  // ── Garde-fous ──
  const erreurs: string[] = []
  const sig = (b: string) => segmentAnnotated(b, a.toc, a.pointAnchors, a.repeatedHeads).map((x: any) => `${x.kind}:${x.anchor ?? ''}:${x.jurisKey ?? ''}:${x.noAnchors ?? ''}`).join('|')
  if (sig(d.bodyOriginal) !== sig(body1)) erreurs.push('segmentation (ancres, clés)')
  const rendu = (b: string) => renderToStaticMarkup(<AnnotatedText text={b} annotations={a} locale="fr" linkArtRefs hideInlineIndex />)
  const h0 = rendu(d.bodyOriginal), h1 = rendu(body1)
  const n = (h: string, re: RegExp) => (h.match(re) ?? []).length
  if (n(h1, /href="/g) !== n(h0, /href="/g)) erreurs.push(`liens ${n(h0, /href="/g)} → ${n(h1, /href="/g)}`)
  if (n(h1, /<li/g) - n(h0, /<li/g) !== ajoutees) erreurs.push(`puces ${n(h0, /<li/g)} → ${n(h1, /<li/g)} (attendu +${ajoutees})`)
  for (const op of OPS.filter((o) => faites.includes(o.article))) {
    for (const l of op.apres) if (!h1.includes(`<span>${l.slice(PUCE.length)}</span>`)) erreurs.push(`${op.article} : « ${l} » n'est pas une puce au rendu`)
  }
  console.log(`puces ${n(h0, /<li/g)} → ${n(h1, /<li/g)} ; liens ${n(h0, /href="/g)} → ${n(h1, /href="/g)}`)
  if (erreurs.length) { console.log(`⛔ refus : ${erreurs.join(', ')}`); process.exitCode = 1; return }
  if (!COMMIT) { console.log('(à blanc — --commit pour écrire)'); return }

  mkdirSync(DOSSIER, { recursive: true })
  writeFileSync(join(DOSSIER, `${d.id}-${Date.now()}.json`), JSON.stringify({ id: d.id, updatedAt: d.updatedAt, bodyOriginal: d.bodyOriginal }))
  // La fiche ne doit pas avoir changé depuis la lecture (autre session, éditeur du CMS).
  const r = await prisma.document.updateMany({ where: { id: d.id, updatedAt: d.updatedAt }, data: { bodyOriginal: body1 } })
  if (r.count !== 1) throw new Error('la fiche a changé depuis la lecture : rien écrit')
  await reindexDocument(d.id)
  await audit({ action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: d.id, meta: { via: 'listes-a-puces-code-travail', articles: faites, puces: ajoutees, decision: 'listes à puces — Me Vaval, 20 oct. 2026' } })
  console.log(`✓ écrit (${faites.join(', ')}), réindexé, journalisé`)
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
