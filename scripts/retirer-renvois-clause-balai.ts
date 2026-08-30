/**
 * CLAUSES-BALAIS — retrait des CrossRef qui ne visent AUCUN texte.
 *
 *     npx tsx scripts/retirer-renvois-clause-balai.ts            # simulation
 *     npx tsx scripts/retirer-renvois-clause-balai.ts --apply    # Me Vaval, elle seule
 *
 * LA RÈGLE. Un CrossRef est un renvoi VERS UN TEXTE. La clause finale par laquelle un acte
 * « abroge toutes Lois ou dispositions de Lois qui lui sont contraires » ne nomme personne :
 * elle n'a pas de cible, et l'inscrire en base fait affirmer à la plateforme quelque chose
 * que le Journal officiel ne dit pas. Elle reste lisible dans le CORPS du texte, à son
 * article final ; elle ne donne ni pastille, ni renvoi.
 *
 * LE DÉFAUT RÉPARÉ. Quatre imports ont posé ce renvoi avec une `note` qui disait pourtant
 * « ⚠️ Clause GÉNÉRALE ». Mais la note n'est lue NULLE PART : `ResolvedTarget`
 * (src/lib/legislation/refs.ts) ne la porte pas, la fiche publique
 * (src/app/[locale]/(app)/doc/[id]/page.tsx) affiche `kind → toLabel · cible non importée`,
 * et l'écran d'administration la jette aussi. Le lecteur lisait donc, sur quatre fiches :
 *   « ABROGE → Toutes lois et dispositions contraires (clause générale) · cible non importée »
 * — soit un texte abrogé que la plateforme aurait omis de verser, alors qu'il n'y a rien à
 * verser. Une mise en garde qui n'est affichée nulle part ne garde de rien.
 *
 * ⚠️ CES QUATRE LIGNES N'AURAIENT PAS PU NAÎTRE DU BACK-OFFICE. La route
 * src/app/api/admin/legislation/route.ts (cas `addRef`) refuse déjà `!toId && !(toType &&
 * toNumber)` : seul un script d'import pouvait les écrire. Les quatre importateurs sont
 * corrigés en même temps que ce retrait, sans quoi un ré-import les recréerait.
 *
 * CE QUI N'EST PAS TOUCHÉ. Un renvoi NOMINATIF reste en place même sans cible en base : cinq
 * autres ABROGE/MODIFIE sans `toId` nomment un texte précis (Loi du 16 septembre 1953,
 * Arrêté du 30 août 2017, Décret du 13 décembre 1982…). Le « · cible non importée » y est
 * VRAI et utile : il dit au lecteur qu'un texte existe et manque au corpus. C'est
 * exactement la distinction que garde `g5NeNommeAucunTexte` ci-dessous.
 */
import { prisma } from '../src/lib/db'
import { audit } from '../src/lib/auth/audit'

const APPLY = process.argv.includes('--apply')

/** Plafond de sûreté : au-delà, on s'arrête et on regarde, --apply ou non. */
const PLAFOND = 10

const KINDS_VISES = new Set(['ABROGE', 'MODIFIE'])

/**
 * ⚠️ NORMALISER AVANT DE COMPARER. `\b` de JavaScript ne connaît pas les lettres accentuées :
 * `/\barrêté\b/i.test('Arrêté du 30 août 2017')` vaut FALSE, parce que « é » n'est pas un
 * caractère de mot et que la frontière finale n'existe donc pas. Un garde-fou écrit avec `\b`
 * laisse passer « Arrêté », « Décret abrogé », « Loi promulguée ». On déplie les accents et on
 * ne teste jamais une frontière de mot après une lettre accentuée.
 */
const sansAccent = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** g4 — le libellé DÉCRIT une clause de style (il parle de textes « au pluriel indéfini »). */
const MOTIFS_CLAUSE = [
  /toutes? lois?/,
  /tous? decrets?/,
  /dispositions? contraires?/,
  /clause generale/,
]

/**
 * g5 — le libellé NOMME un texte. Dans ce corpus un texte désigné porte TOUJOURS sa date ou
 * son numéro : « Loi du 16 septembre 1953 », « Moniteur n° 8 », « article 85 ». La clause-balai
 * n'en porte aucun. C'est ce garde-fou, et non le motif lexical, qui protège les renvois
 * nominatifs : un libellé qui dirait « abroge toutes lois contraires, notamment la Loi du
 * 16 septembre 1953 » passe g4 et se fait arrêter ici.
 */
const MARQUES_DE_TEXTE: { nom: string; re: RegExp }[] = [
  { nom: 'millésime', re: /(?<![0-9])(1[5-9][0-9]{2}|20[0-9]{2})(?![0-9])/ },
  { nom: 'numéro', re: /n\s*[°o]\s*[0-9]/ },
  { nom: 'article chiffré', re: /article\s+[0-9]/ },
]

type Ligne = {
  id: string
  kind: string
  toId: string | null
  toType: string | null
  toNumber: string | null
  toAnchor: string | null
  toLabel: string | null
  note: string | null
  source: string
}

type Verdict = {
  g1SansCible: boolean
  g2SansDesignation: boolean
  g3KindVise: boolean
  g4DecritUneClause: boolean
  g5NeNommeAucunTexte: boolean
  g6LibelleNonVide: boolean
  marques: string[]
  retenu: boolean
  motifRejet: string | null
}

function juger(r: Ligne): Verdict {
  const lab = sansAccent(r.toLabel ?? '')
  const marques = MARQUES_DE_TEXTE.filter((m) => m.re.test(lab)).map((m) => m.nom)
  const v = {
    g1SansCible: r.toId === null,
    g2SansDesignation: r.toNumber === null && r.toAnchor === null,
    g3KindVise: KINDS_VISES.has(r.kind),
    g4DecritUneClause: MOTIFS_CLAUSE.some((re) => re.test(lab)),
    g5NeNommeAucunTexte: marques.length === 0,
    g6LibelleNonVide: (r.toLabel ?? '').trim().length > 0,
    marques,
  }
  const echecs: string[] = []
  if (!v.g1SansCible) echecs.push('g1 : la cible existe en base (toId)')
  if (!v.g2SansDesignation) echecs.push('g2 : désignation résoluble (toNumber/toAnchor)')
  if (!v.g3KindVise) echecs.push(`g3 : kind « ${r.kind} » hors ABROGE/MODIFIE`)
  if (!v.g4DecritUneClause) echecs.push('g4 : le libellé ne décrit pas une clause générale')
  if (!v.g5NeNommeAucunTexte) echecs.push(`g5 : le libellé NOMME un texte (${marques.join(', ')})`)
  if (!v.g6LibelleNonVide) echecs.push('g6 : libellé vide — on ne devine pas')
  return { ...v, retenu: echecs.length === 0, motifRejet: echecs.length ? echecs.join(' · ') : null }
}

/* ────────────────────────────────────────────────────────────────────────────────────────
 * SABOTAGE DES GARDE-FOUS. Chacun est mis en échec sur une ligne fabriquée pour lui : si le
 * filtre laisse passer un seul de ces cas, le script REFUSE de s'exécuter. Un garde-fou qu'on
 * n'a pas vu mordre n'est pas un garde-fou, c'est une intention.
 * ──────────────────────────────────────────────────────────────────────────────────────── */
const CLAUSE = 'Toutes lois et dispositions contraires (clause générale)'
const base: Ligne = {
  id: 'test', kind: 'ABROGE', toId: null, toType: 'LEGISLATION', toNumber: null,
  toAnchor: null, toLabel: CLAUSE, note: null, source: 'EDITORIAL',
}

const SABOTAGES: { nom: string; ligne: Ligne; attendu: boolean; garde?: keyof Verdict }[] = [
  { nom: 'TÉMOIN POSITIF — la clause-balai réelle doit être RETENUE', ligne: base, attendu: true },
  { nom: 'g1 sabotée — cible résolue en base', ligne: { ...base, toId: 'cm000doc' }, attendu: false, garde: 'g1SansCible' },
  { nom: 'g2 sabotée — désignation par toNumber', ligne: { ...base, toNumber: 'Décret du 30 janvier 1989' }, attendu: false, garde: 'g2SansDesignation' },
  { nom: 'g2 sabotée — ancre d’article', ligne: { ...base, toAnchor: 'art-284' }, attendu: false, garde: 'g2SansDesignation' },
  { nom: 'g3 sabotée — kind CITE', ligne: { ...base, kind: 'CITE' }, attendu: false, garde: 'g3KindVise' },
  { nom: 'g3 sabotée — kind APPLIQUE', ligne: { ...base, kind: 'APPLIQUE' }, attendu: false, garde: 'g3KindVise' },
  { nom: 'g4 sabotée — renvoi nominatif ordinaire', ligne: { ...base, toLabel: 'Décret du 30 janvier 1989 créant le Corps Autonome des Pompiers (CAP)' }, attendu: false, garde: 'g4DecritUneClause' },
  { nom: 'g5 sabotée — clause QUI NOMME (g4 passe, g5 seule doit mordre)', ligne: { ...base, toLabel: 'Abroge toutes lois contraires, notamment la Loi du 16 septembre 1953 sur l’adjudication' }, attendu: false, garde: 'g5NeNommeAucunTexte' },
  { nom: 'g5 sabotée — MOT ACCENTUÉ en tête (piège du \\b JavaScript)', ligne: { ...base, toLabel: 'Arrêté du 30 août 2017 abrogeant toutes dispositions contraires' }, attendu: false, garde: 'g5NeNommeAucunTexte' },
  { nom: 'g5 sabotée — numéro de Moniteur', ligne: { ...base, toLabel: 'Toutes dispositions contraires (Moniteur n° 8)' }, attendu: false, garde: 'g5NeNommeAucunTexte' },
  { nom: 'g5 sabotée — renvoi à un article chiffré', ligne: { ...base, toLabel: 'Toutes dispositions contraires à l’article 85' }, attendu: false, garde: 'g5NeNommeAucunTexte' },
  { nom: 'g6 sabotée — libellé nul', ligne: { ...base, toLabel: null }, attendu: false, garde: 'g6LibelleNonVide' },
  { nom: 'g6 sabotée — libellé blanc', ligne: { ...base, toLabel: '   ' }, attendu: false, garde: 'g6LibelleNonVide' },
]

function sabotage(): boolean {
  console.log('─── SABOTAGE DES GARDE-FOUS ───')
  let ok = true
  for (const s of SABOTAGES) {
    const v = juger(s.ligne)
    const conforme = v.retenu === s.attendu && (!s.garde || v[s.garde] === false)
    if (!conforme) ok = false
    console.log(`  ${conforme ? '✓' : '✗ ÉCHEC'} ${s.nom}`)
    if (!s.attendu) console.log(`      → ${v.motifRejet ?? 'RETENU alors qu’il fallait rejeter'}`)
  }
  // Contrôle du contrôle : la version naïve du garde-fou, écrite avec \b, laissait passer.
  const naif = /\b(loi|décret|arrêté)\b/i
  console.log(`  ${!naif.test('Arrêté du 30 août 2017') ? '✓' : '✗'} rappel : /\\barrêté\\b/ dit « ne nomme rien » sur « Arrêté du 30 août 2017 » — d’où sansAccent()`)
  console.log(ok ? '  Les treize sabotages mordent.\n' : '  ⚠️ UN GARDE-FOU NE MORD PAS — arrêt.\n')
  return ok
}

/* ──────────────────────────────────────────────────────────────────────────────────────── */

async function main() {
  if (!sabotage()) { await prisma.$disconnect(); process.exitCode = 1; return }

  const total = await prisma.crossRef.count()
  const sansCible = await prisma.crossRef.findMany({
    where: { toId: null },
    include: { from: { select: { id: true, source: true, titleFr: true, type: true } } },
    orderBy: [{ kind: 'asc' }, { position: 'asc' }],
  })
  console.log(`CrossRef en base : ${total} · sans cible résolue : ${sansCible.length}\n`)

  const juges = sansCible.map((r) => ({ r, v: juger(r) }))
  const retenus = juges.filter((j) => j.v.retenu)
  const ecartes = juges.filter((j) => !j.v.retenu)

  console.log(`─── ÉCARTÉS : ${ecartes.length} renvois sans cible qui RESTENT en place ───`)
  for (const { r, v } of ecartes)
    console.log(`  [${r.kind.padEnd(8)}] ${(r.from.source ?? '?').padEnd(34)} « ${(r.toLabel ?? '').slice(0, 62)}${(r.toLabel ?? '').length > 62 ? '…' : ''} »\n      ${v.motifRejet}`)

  console.log(`\n─── RETENUS : ${retenus.length} clauses-balais à retirer, une par une ───`)
  for (const { r } of retenus) {
    console.log(`\n  ● ${r.from.source ?? '(sans source)'}   [CrossRef ${r.id}]`)
    console.log(`    fiche   : ${r.from.titleFr}`)
    console.log(`    renvoi  : ${r.kind} → ${r.toLabel}`)
    console.log(`    affiché : « ${r.kind} → ${r.toLabel} · cible non importée »`)
    console.log(`    note    : ${r.note ?? '(aucune)'}`)
  }

  if (retenus.length === 0) { console.log('\nRien à retirer.'); await prisma.$disconnect(); return }
  if (retenus.length > PLAFOND) {
    console.log(`\n⚠️ ${retenus.length} retenus pour un plafond de ${PLAFOND} — arrêt. Relire le filtre avant d’écrire.`)
    await prisma.$disconnect(); process.exitCode = 1; return
  }
  if (!APPLY) {
    console.log(`\nSIMULATION — rien n’a été écrit. ${retenus.length} CrossRef seraient supprimés.`)
    await prisma.$disconnect(); return
  }

  const ids = retenus.map((j) => j.r.id)
  await prisma.$transaction(async (tx) => {
    // Suppression par identifiant explicite : jamais un deleteMany sur un `where` reconstruit,
    // qui pourrait mordre plus large que ce qui vient d'être listé au-dessus.
    await tx.crossRef.deleteMany({ where: { id: { in: ids } } })
    for (const { r } of retenus)
      await audit({
        action: 'CROSSREF_REMOVED',
        targetType: 'Document',
        targetId: r.fromId,
        meta: {
          refId: r.id,
          motif:
            'Clause-balai : renvoi sans cible retiré. Un CrossRef est un renvoi VERS UN TEXTE ; ' +
            'la clause finale « abroge toutes lois contraires » ne nomme aucun texte et n’a donc ' +
            'pas de cible. Elle reste lisible dans le corps du texte, à son article final ; elle ' +
            'ne donne ni pastille, ni renvoi. La fiche affichait « cible non importée », ce qui ' +
            'faisait croire à un texte abrogé manquant au corpus.',
          source: r.from.source, kind: r.kind, toLabel: r.toLabel, noteRetiree: r.note,
        },
      }, tx)
  }, { timeout: 120_000, maxWait: 30_000 })

  /* RECOMPTE EN RELISANT LA BASE. `audit()` avale ses erreurs dans un `catch {}` vide : une
   * transaction qui réussit ne prouve donc RIEN sur le journal. On relit tout. */
  const restants = await prisma.crossRef.count({ where: { id: { in: ids } } })
  const apres = await prisma.crossRef.count()
  const journal = await prisma.auditLog.findMany({
    where: { action: 'CROSSREF_REMOVED', OR: ids.map((id) => ({ metaJson: { contains: id } })) },
    select: { id: true, targetId: true, metaJson: true },
  })
  const orphelines = await prisma.crossRef.count({
    where: { toId: null, kind: { in: [...KINDS_VISES] }, toLabel: { contains: 'clause générale' } },
  })

  console.log('\n─── RECOMPTE (relecture de la base, après transaction) ───')
  console.log(`  CrossRef supprimés attendus : ${ids.length}`)
  console.log(`  ${restants === 0 ? '✓' : '✗'} lignes retenues encore présentes : ${restants} (attendu 0)`)
  console.log(`  ${apres === total - ids.length ? '✓' : '✗'} total CrossRef : ${total} → ${apres} (attendu ${total - ids.length})`)
  console.log(`  ${journal.length === ids.length ? '✓' : '✗'} AuditLog CROSSREF_REMOVED retrouvés : ${journal.length} (attendu ${ids.length})`)
  console.log(`  ${orphelines === 0 ? '✓' : '✗'} clauses « clause générale » subsistantes : ${orphelines} (attendu 0)`)
  for (const j of journal) console.log(`      journal ${j.id} · fiche ${j.targetId}`)
  if (restants !== 0 || apres !== total - ids.length || journal.length !== ids.length || orphelines !== 0) {
    console.log('\n⚠️ LE RECOMPTE NE TOMBE PAS JUSTE — ne pas conclure sans regarder.')
    process.exitCode = 1
  }
  await prisma.$disconnect()
}

main()
