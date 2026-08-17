/**
 * Formations de jugement de l'exercice 1965-1966 — rattachement des magistrats.
 *
 *   npx tsx scripts/import-cassation-juges-1965-1966.ts            (à blanc)
 *   npx tsx scripts/import-cassation-juges-1965-1966.ts --apply    (écrit)
 *
 * ⚠️ LA COMPOSITION N'EST PAS DANS UN SOMMAIRE, ELLE EST DANS L'ARRÊT. Le recueil
 * 1964-1965 portait une ligne « Composition : … » ; celui-ci n'a pas de sommaire du tout.
 * La formation se lit dans la formule de clôture — « Ainsi jugé et prononcé par Nous,
 * Frédéric ROBINSON, Président, …, Juges, … » —, que `ligneCompositionDeLArret` isole et
 * que `lireComposition` sait déjà lire : c'est le gabarit D, celui qui n'étiquette rien.
 *
 * ⚠️ LES FICHES EXISTANTES SONT RÉUTILISÉES, JAMAIS DOUBLÉES. Vingt-et-un magistrats sont
 * déjà en base pour 1964-1965, et ce sont largement les mêmes hommes : le rapprochement se
 * fait sur `matchKey`. Créer une seconde fiche « André ROUSSEAU » couperait son œuvre en
 * deux sans que rien ne le signale.
 *
 * ⚠️ LES RAPPROCHEMENTS APPROCHANTS NE SONT PAS APPLIQUÉS. « Felix » pour « Félix »,
 * « DAIMBOIS » pour « DIAMBOIS » : une lettre sépare deux fiches, et une lettre peut aussi
 * séparer deux hommes. Le script les signale ; la rédaction tranche.
 */
import { prisma } from '../src/lib/db'
import { audit } from '../src/lib/auth/audit'
import {
  ligneCompositionDeLArret, lireComposition, cleMagistrat, type Membre,
} from '../src/lib/jurisprudence/composition'

const SOURCE = 'CASSATION_1965_1966'

/** Distance d'édition — pour SIGNALER des graphies voisines, jamais pour les fusionner. */
function distance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}

async function main() {
  const apply = process.argv.includes('--apply')
  const docs = await prisma.document.findMany({
    where: { type: 'JURISPRUDENCE', source: SOURCE },
    select: { id: true, number: true, chambre: true, bodyOriginal: true },
  })
  console.log(`${docs.length} arrêts de l'exercice 1965-1966\n`)

  const compositions = new Map<string, { id: string; membres: Membre[]; note: string | null }>()
  const graphies = new Map<string, Set<string>>()
  const alertes: string[] = []
  const sansFormation: string[] = []

  for (const d of docs) {
    const cle = `${d.chambre} n° ${d.number}`
    const ligne = ligneCompositionDeLArret(d.bodyOriginal ?? '')
    if (!ligne) { sansFormation.push(`${cle} (pas de formule de clôture)`); continue }
    const c = lireComposition(ligne)
    if (!c.membres.length) { sansFormation.push(`${cle} (formule illisible)`); continue }
    compositions.set(cle, { id: d.id, membres: c.membres, note: c.note })
    for (const a of c.avertissements) alertes.push(`${cle} — ${a}`)
    for (const m of c.membres) {
      const k = cleMagistrat(m.nameAsWritten)
      if (!graphies.has(k)) graphies.set(k, new Set())
      graphies.get(k)!.add(m.nameAsWritten)
    }
  }

  const participations = [...compositions.values()].reduce((n, c) => n + c.membres.length, 0)
  const roles: Record<string, number> = {}
  for (const c of compositions.values()) for (const m of c.membres) roles[m.role] = (roles[m.role] ?? 0) + 1
  console.log(`formations lues : ${compositions.size}/${docs.length} · ${participations} participations`)
  console.log(`rôles : ${Object.entries(roles).map(([r, n]) => `${r} ${n}`).join(' · ')}\n`)

  // ── Qui existe déjà, qui est nouveau ──────────────────────────────────────
  const existantes = await prisma.judge.findMany({ select: { id: true, matchKey: true, displayName: true } })
  const parCle = new Map(existantes.map((j) => [j.matchKey, j]))
  const nouveaux: string[] = []
  console.log(`MAGISTRATS — ${graphies.size} clés relevées dans ce recueil (${existantes.length} fiches déjà en base)`)
  for (const [k, g] of [...graphies].sort()) {
    const liste = [...g].sort()
    const retenu = liste.slice().sort((a, b) => b.length - a.length)[0]
    const dejaLa = parCle.get(k)
    if (!dejaLa) nouveaux.push(retenu)
    console.log(
      `  ${retenu.padEnd(26)} ${dejaLa ? `↩ fiche existante « ${dejaLa.displayName} »` : '＋ NOUVELLE FICHE'}` +
      (liste.length > 1 ? `  · ${liste.length} graphies : ${liste.join(' | ')}` : ''),
    )
  }
  console.log(`\n  → ${graphies.size - nouveaux.length} réutilisées · ${nouveaux.length} à créer`)

  // ── Graphies voisines : signalées, JAMAIS fusionnées ──────────────────────
  const toutes = [...new Set([...graphies.keys(), ...existantes.map((j) => j.matchKey)])]
  const proches: string[] = []
  for (let i = 0; i < toutes.length; i++)
    for (let j = i + 1; j < toutes.length; j++) {
      const [a, b] = [toutes[i], toutes[j]]
      const ta = new Set(a.split(' ')), tb = new Set(b.split(' '))
      const inclus = [...ta].every((x) => tb.has(x)) || [...tb].every((x) => ta.has(x))
      const d = distance(a, b)
      if (inclus || d <= 2) {
        const nom = (k: string) =>
          [...(graphies.get(k) ?? new Set([parCle.get(k)?.displayName ?? k]))].sort((x, y) => y.length - x.length)[0]
        proches.push(`${nom(a)}  ↔  ${nom(b)}${inclus ? '  (l’un contient l’autre)' : `  (${d} lettre(s) d’écart)`}`)
      }
    }
  if (proches.length) {
    console.log(`\nRAPPROCHEMENTS POSSIBLES — NON APPLIQUÉS, à trancher par la rédaction (${proches.length}) :`)
    for (const x of proches) console.log(`  ${x}`)
  }
  if (sansFormation.length) {
    console.log(`\nSANS FORMATION LISIBLE (${sansFormation.length}) :`)
    for (const x of sansFormation) console.log(`  ${x}`)
  }
  if (alertes.length) {
    console.log(`\nÀ RELIRE (${alertes.length}) — versés quand même, mais à vérifier sur le recueil :`)
    for (const a of alertes) console.log(`  ${a}`)
  }

  if (!apply) {
    console.log('\n(exécution à blanc — ajouter --apply pour écrire)')
    await prisma.$disconnect()
    return
  }

  // ── Écriture ──────────────────────────────────────────────────────────────
  const idParCle = new Map<string, string>()
  for (const [k, g] of graphies) {
    const retenu = [...g].sort((a, b) => b.length - a.length)[0]
    const deja = parCle.get(k)
    idParCle.set(k, deja ? deja.id : (await prisma.judge.create({ data: { displayName: retenu, matchKey: k } })).id)
  }
  let rattaches = 0, membresEcrits = 0
  for (const [, c] of compositions) {
    // Idempotence : la composition d'une décision est REMPLACÉE, jamais accumulée.
    await prisma.decisionJudge.deleteMany({ where: { documentId: c.id } })
    for (const m of c.membres) {
      await prisma.decisionJudge.create({
        data: {
          documentId: c.id,
          judgeId: idParCle.get(cleMagistrat(m.nameAsWritten))!,
          nameAsWritten: m.nameAsWritten,
          role: m.role,
          qualite: m.qualite,
          position: m.position,
        },
      })
      membresEcrits++
    }
    await prisma.document.update({ where: { id: c.id }, data: { compositionNote: c.note } })
    rattaches++
  }
  await audit({
    action: 'DOC_PUBLISHED', targetType: 'Document', targetId: SOURCE,
    meta: { via: 'import-cassation-juges-1965-1966', magistrats: graphies.size,
            nouveaux: nouveaux.length, decisions: rattaches, membres: membresEcrits },
  })
  console.log(`\n${rattaches} décisions rattachées · ${membresEcrits} participations · ${nouveaux.length} fiches créées`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('ÉCHEC :', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
