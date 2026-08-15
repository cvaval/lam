/**
 * Range les DÉCISIONS dans la taxonomie de la Législation annotée.
 *
 * Le « domaine du droit » d'une décision était jusqu'ici une PHRASE libre, propre au
 * recueil (« Procédure civile (voies de recours — recevabilité du pourvoi) »). Celui de la
 * Législation annotée est un THÈME de l'arbre. Deux vocabulaires pour une même question :
 * un lecteur qui cherche « procédure civile » ne pouvait pas obtenir d'un même geste les
 * textes et les arrêts. Ce script rattache les décisions à l'arbre, sans toucher à leur
 * `matiere`, qui reste la formule du recueil.
 *
 * ⚠️ EXÉCUTION À BLANC PAR DÉFAUT. `--apply` pour écrire.
 *
 * ⚠️ LE CLASSEMENT SE PROPOSE, IL NE SE DEVINE PAS. Les règles ci-dessous sont EXPLICITES
 * et se lisent : aucune n'est tirée d'un modèle. Toute décision qu'aucune règle n'atteint
 * est SIGNALÉE et laissée sans thème — une classification par défaut (« Droit civil » faute
 * de mieux) rangerait un arrêt là où il n'est pas, et rien à l'écran ne le montrerait.
 *
 *   npx tsx scripts/classer-jurisprudence-themes.ts
 *   npx tsx scripts/classer-jurisprudence-themes.ts --apply
 */
import { prisma } from '../src/lib/db'
import { audit } from '../src/lib/auth/audit'
import { reindexDocument } from '../src/lib/search/reindex'

/**
 * Règles de rattachement, dans l'ordre de lecture. Chaque décision reçoit TOUS les thèmes
 * dont la règle apparie sa `matiere` ; le PREMIER apparié devient le thème de tête.
 *
 * ⚠️ L'ORDRE PORTE LE SENS. « Droit du travail — procédure devant le tribunal de travail »
 * est d'abord du droit du travail : ranger la procédure civile en tête en ferait un arrêt
 * de procédure, ce qu'il n'est pas. Du plus spécifique au plus général, donc.
 */
const REGLES: { motif: RegExp; slug: string; pourquoi: string }[] = [
  { motif: /droit du travail|tribunal de travail|contrat de travail/i, slug: 'droit-du-travail', pourquoi: 'droit du travail' },
  { motif: /proc[ée]dure p[ée]nale/i, slug: 'procedure-penale', pourquoi: 'procédure pénale' },
  { motif: /droit p[ée]nal|infraction|d[ée]lit p[ée]nal/i, slug: 'penal-general', pourquoi: 'droit pénal' },
  { motif: /organisation judiciaire|responsabilit[ée] des magistrats|prise à partie/i, slug: 'justice', pourquoi: 'organisation judiciaire' },
  { motif: /proc[ée]dure civile|voies? de recours|voies? d.ex[ée]cution/i, slug: 'procedure-civile', pourquoi: 'procédure civile' },
  { motif: /droit commercial|commer[çc]ant|soci[ée]t[ée] commerciale|faillite/i, slug: 'droit-commercial', pourquoi: 'droit commercial' },
  { motif: /droit rural|bail à cheptel|agricole/i, slug: 'agriculture-rural', pourquoi: 'droit rural' },
  { motif: /droit de la famille|filiation|mariage|divorce|succession/i, slug: 'personne-famille', pourquoi: 'personne et famille' },
  {
    motif: /responsabilit[ée] civile|obligations|contrats?|droit des biens|possessoire|droit foncier|cadastr|bail|pr[êe]t|sûret[ée]|servitude/i,
    slug: 'obligations-biens-suretes',
    pourquoi: 'obligations, biens & sûretés',
  },
  { motif: /droit civil/i, slug: 'droit-civil', pourquoi: 'droit civil' },
]

async function main() {
  const apply = process.argv.includes('--apply')

  const themes = await prisma.theme.findMany({ where: { active: true }, select: { id: true, slug: true, labelFr: true } })
  const parSlug = new Map(themes.map((t) => [t.slug, t]))
  const manquants = REGLES.filter((r) => !parSlug.has(r.slug))
  if (manquants.length) {
    // Une règle qui vise un thème inexistant classerait dans le vide, en silence.
    console.error(`THÈMES INTROUVABLES : ${manquants.map((r) => r.slug).join(', ')}`)
    process.exit(1)
  }

  const docs = await prisma.document.findMany({
    where: { type: 'JURISPRUDENCE' },
    select: { id: true, number: true, chambre: true, titleFr: true, matiere: true },
    orderBy: [{ chambre: 'asc' }, { number: 'asc' }],
  })

  const plan: { id: string; etiquette: string; slugs: string[] }[] = []
  const orphelines: string[] = []
  for (const d of docs) {
    const m = d.matiere ?? ''
    // ⚠️ LE DOMAINE EST EN TÊTE DE PHRASE ; LE RESTE EST DU DÉTAIL. Le rédacteur écrit
    // « Droit du travail (procédure devant le tribunal de travail ; en toile de fond :
    // droit des obligations) » : appliquer les règles à la phrase ENTIÈRE rangeait cet
    // arrêt en procédure civile ET en obligations à égalité avec le droit du travail —
    // mesuré, 61 décisions sur 80 se retrouvaient dans deux domaines ou plus, et
    // « Procédure civile » en happait 63, parce que toute matière mentionne le pourvoi.
    //
    // On lit donc la tête pour le domaine, et l'on n'ajoute un domaine secondaire que
    // lorsque le rédacteur le nomme LUI-MÊME (« en toile de fond », « et »).
    const tete = m.split(/[(;.]|—/)[0]
    const fond = /en toile de fond\s*:?(.*)/i.exec(m)?.[1] ?? ''
    const principaux = REGLES.filter((r) => r.motif.test(tete)).map((r) => r.slug)
    const secondaires = REGLES.filter((r) => r.motif.test(fond)).map((r) => r.slug)
    const slugs = [...new Set([...principaux, ...secondaires])]
    const etiquette = `${(d.chambre ?? '').slice(0, 8)} n° ${String(d.number).padStart(2)} · ${(d.titleFr ?? '').slice(0, 40)}`
    if (!slugs.length) {
      orphelines.push(`${etiquette} — « ${m.slice(0, 70)} »`)
      continue
    }
    plan.push({ id: d.id, etiquette, slugs })
  }

  const parTheme = new Map<string, number>()
  for (const p of plan) for (const s of p.slugs) parTheme.set(s, (parTheme.get(s) ?? 0) + 1)
  console.log(`RÉPARTITION PROPOSÉE — ${plan.length} décisions sur ${docs.length}\n`)
  for (const [slug, n] of [...parTheme].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${parSlug.get(slug)!.labelFr}`)
  }
  const multi = plan.filter((p) => p.slugs.length > 1)
  console.log(`\n${multi.length} décisions relèvent de PLUSIEURS domaines (le premier fait tête) :`)
  for (const p of multi.slice(0, 12)) {
    console.log(`  ${p.etiquette}\n      ${p.slugs.map((s) => parSlug.get(s)!.labelFr).join(' + ')}`)
  }
  if (orphelines.length) {
    console.log(`\n⚠️ SANS DOMAINE — aucune règle ne les atteint, elles restent NON classées (${orphelines.length}) :`)
    for (const o of orphelines) console.log(`  ${o}`)
  }

  if (!apply) {
    console.log('\n(exécution à blanc — ajouter --apply pour écrire)')
    await prisma.$disconnect()
    return
  }

  let ecrits = 0
  for (const p of plan) {
    // Idempotence : on remplace le classement de CETTE décision, on ne l'empile pas.
    await prisma.documentTheme.deleteMany({ where: { documentId: p.id, theme: { active: true } } })
    for (const [i, slug] of p.slugs.entries()) {
      await prisma.documentTheme.create({
        data: {
          documentId: p.id,
          themeId: parSlug.get(slug)!.id,
          // ⚠️ UN SEUL THÈME DE TÊTE PAR DOCUMENT (index partiel DocumentTheme_one_primary).
          isPrimary: i === 0,
          assignedBy: 'ADMIN',
        },
      })
      ecrits++
    }
    // `themeLabels` est un cache dénormalisé : sans réindexation, la recherche par thème
    // ignorerait le rattachement qu'on vient d'écrire.
    await reindexDocument(p.id)
  }
  await audit({
    action: 'DOC_PUBLISHED', targetType: 'Document', targetId: 'CASSATION_1964_1965',
    meta: { via: 'classer-jurisprudence-themes', decisions: plan.length, rattachements: ecrits },
  })
  console.log(`\n${plan.length} décisions classées · ${ecrits} rattachements écrits · ${orphelines.length} laissées sans domaine`)
  await prisma.$disconnect()
}

main()
