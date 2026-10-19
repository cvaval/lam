/**
 * Enrichissement des arrêts n° 1-15 de la Première Section, exercice 1965-1966, par le
 * sommaire analytique de la rédaction (notices à dix rubriques, livrées le 19 oct. 2026).
 *
 *   npx tsx scripts/enrichir-cassation-1965-1966-1re-1-15.ts                 # simulation
 *   npx tsx scripts/enrichir-cassation-1965-1966-1re-1-15.ts --apply         # écrit
 *   npx tsx scripts/enrichir-cassation-1965-1966-1re-1-15.ts --apply --titres  # + intitulés « X c. Y »
 *   npx tsx scripts/enrichir-cassation-1965-1966-1re-1-15.ts --collation <transcription.docx>  # rapport seul
 *
 * ⚠️ SIMULATION PAR DÉFAUT — la base est celle de PRODUCTION.
 *
 * Ce que le script écrit (et rien d'autre) :
 *   Domaines du droit → matiere · Analyse → summaryFr · Décision attaquée → decisionAttaquee ·
 *   Règle de droit → regleDroit · Question de droit → questionDroit ·
 *   Solution et motifs → motifs (sans la sous-mention « Dispositif »), → dispositif, → solution
 *   (deduireSolution, null gardé) · Composition hors siège → compositionNote ·
 *   dates/mention marginale/juridiction/composition/anomalies → metaJson.sommaireAnalytique.
 *   Avec --titres : titleFr ← parties de la tête « No N — X c. Y » (ancien titre dans l'audit).
 *
 * Ce qu'il ne touche JAMAIS : bodyOriginal (la parole de la Cour), la formation
 * (DecisionJudge), juridiction (lot D en attente), traitement/portee (décision éditoriale).
 *
 * Garde-fous : 15 notices exactement, dix rubriques chacune ; la date du prononcé ET la
 * date portée sur l'extrait doivent coïncider avec publicationDate ; aucun champ cible
 * non nul n'est écrasé (sauf valeur identique : idempotent) ; écriture par updateMany
 * conditionnelle (updatedAt vu + champs nuls) dans une transaction avec son audit ;
 * recomptage des entrées d'audit après coup (audit() avale ses erreurs).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

const env = Object.fromEntries(readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))
for (const k of ['DATABASE_URL', 'DIRECT_URL']) if (env[k]) process.env[k] = env[k]
// Prod = moteur FTS intégré ; OpenSearch n'existe qu'en local. On ne l'appelle pas d'ici.
process.env.SEARCH_PROVIDER = process.env.SEARCH_PROVIDER ?? 'fts'

import { prisma } from '../src/lib/db'
import { audit } from '../src/lib/auth/audit'
import { reindexDocument } from '../src/lib/search/reindex'
import { paragraphesDuDocx } from '../src/lib/jurisprudence/docx'
import { analyserNotices, separerDispositif, dateDeLaNotice, mentionMarginale, mentionHorsSiege, cleNotice, type Notice } from '../src/lib/jurisprudence/notices'
import { deduireSolution } from '../src/lib/jurisprudence/constants'
import { motsMagistrat } from '../src/lib/jurisprudence/composition'

const SOURCE = 'CASSATION_1965_1966'
const CHAMBRE = 'Première Section'
const NUMEROS = Array.from({ length: 15 }, (_, i) => String(i + 1))
const DOSSIER = 'scripts/data/cassation-1965-1966'
const FICHIER = `${DOSSIER}/sommaire-1re-section-1-15.docx`
const VIA = 'enrichir-cassation-1965-1966-1re-1-15'

const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const TITRES = argv.includes('--titres')
const COLLATION = argv.includes('--collation') ? argv[argv.indexOf('--collation') + 1] : null

type Cible = {
  id: string; number: string | null; titleFr: string; publicationDate: Date | null; updatedAt: Date
  matiere: string | null; summaryFr: string | null; decisionAttaquee: string | null; regleDroit: string | null
  questionDroit: string | null; motifs: string | null; dispositif: string | null; solution: string | null
  compositionNote: string | null; metaJson: string | null; bodyOriginal: string
  judges: { nameAsWritten: string; role: string | null }[]
}
const CHAMPS = ['matiere', 'summaryFr', 'decisionAttaquee', 'regleDroit', 'questionDroit', 'motifs', 'dispositif', 'solution', 'compositionNote', 'metaJson'] as const
type Champ = (typeof CHAMPS)[number]

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex')

/** Les mots de chaque membre de la formation doivent tous figurer dans la rubrique Composition. */
function verifierComposition(c: Cible, composition: string): string[] {
  const mots = new Set(cleNotice(composition).replace(/[^a-z\s-]/g, ' ').replace(/-/g, ' ').split(/\s+/))
  const ecarts: string[] = []
  for (const j of c.judges) {
    const absents = motsMagistrat(j.nameAsWritten).filter((m) => !mots.has(m))
    if (absents.length) ecarts.push(`${j.role ?? '?'} ${j.nameAsWritten} : « ${absents.join(' ')} » absent de la notice`)
  }
  if (/Greffe\s*:/u.test(composition) && !c.judges.some((j) => j.role === 'GREFFE')) ecarts.push('la notice nomme un greffier, la formation en base n\'en a pas')
  if (/Minist[èe]re\s+Public\s*:/u.test(composition) && !c.judges.some((j) => j.role === 'MINISTERE_PUBLIC')) ecarts.push('la notice nomme le Ministère Public, la formation en base ne le porte pas')
  return ecarts
}

function preparer(n: Notice, c: Cible, empreinte: string) {
  const r = n.rubriques as Record<string, string>
  const s = separerDispositif(r['Solution et motifs (Holding and Reasoning)'])
  if (s.defaut) throw new Error(`n° ${n.numero} : ${s.defaut} — on ne tranche pas pour la rédaction. STOP`)
  const motifs = s.anomalies ? `${s.motifs}\n\n${s.libelleAnomalies} : ${s.anomalies}` : s.motifs
  const meta = {
    sommaireAnalytique: {
      fichier: FICHIER.split('/').pop(), sha256: empreinte, versionNotice: '2026-10-19',
      datePrononce: dateDeLaNotice(r['Date du prononcé']),
      dateExtrait: dateDeLaNotice(r["Date portée sur l'extrait"]),
      mentionMarginale: mentionMarginale(r["Date portée sur l'extrait"]),
      juridiction: r.Juridiction, composition: r.Composition,
      anomaliesSource: s.anomalies,
    },
  }
  const valeurs: Record<Champ, string | null> = {
    matiere: r['Domaines du droit'],
    summaryFr: r.Analyse,
    decisionAttaquee: r['Décision attaquée / objet de la saisine'],
    regleDroit: r['Règle de droit (Rule of Law)'],
    questionDroit: r['Question de droit (Issue)'],
    motifs,
    dispositif: s.dispositif,
    solution: s.dispositif ? deduireSolution(s.dispositif) : null,
    compositionNote: mentionHorsSiege(r.Composition),
    metaJson: JSON.stringify(meta),
  }
  return { valeurs, meta, s }
}

async function collationner(fichier: string, cibles: Cible[]) {
  const p = await paragraphesDuDocx(readFileSync(fichier))
  // Les têtes « Arrêt No N — date » figurent deux fois : table des arrêts, puis texte. On
  // garde la DERNIÈRE occurrence de chaque numéro.
  const tetes = new Map<string, number>()
  p.forEach((t, i) => { const m = t.match(/^Arr[êe]t\s+No\s+(\d+)\s+[—–-]\s+/u); if (m && t.length < 80) tetes.set(m[1], i) })
  const ordre = [...tetes.entries()].sort((a, b) => a[1] - b[1])
  const shingles = (t: string) => { const w = cleNotice(t).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean); const s = new Set<string>(); for (let i = 0; i + 6 <= w.length; i++) s.add(w.slice(i, i + 6).join(' ')); return s }
  console.log(`\nCOLLATION — ${fichier.split('/').pop()} (${sha(readFileSync(fichier)).slice(0, 16)}…) : ${ordre.length} arrêts dans la transcription`)
  console.log('  n°   transcription   en base   écart     shingles-6 communs  (lecture : la base reste le texte ; la transcription ne fait que témoigner)')
  for (let k = 0; k < ordre.length; k++) {
    const [num, debut] = ordre[k]
    const fin = k + 1 < ordre.length ? ordre[k + 1][1] : p.length
    const texte = p.slice(debut + 1, fin).join('\n')
    const c = cibles.find((x) => x.number === num)
    if (!c) { console.log(`  ${num.padStart(2)}   ${String(texte.length).padStart(13)}   — absent de la base`); continue }
    const a = shingles(texte), b = shingles(c.bodyOriginal)
    let communs = 0; for (const x of a) if (b.has(x)) communs++
    const sim = communs / Math.max(1, Math.max(a.size, b.size))
    console.log(`  ${num.padStart(2)}   ${String(texte.length).padStart(13)}   ${String(c.bodyOriginal.length).padStart(7)}   ${String(texte.length - c.bodyOriginal.length).padStart(5)}     ${(sim * 100).toFixed(1).padStart(5)} %`)
  }
}

async function main() {
  const buf = readFileSync(FICHIER)
  const empreinte = sha(buf)
  const { notices, avertissements } = analyserNotices(await paragraphesDuDocx(buf))
  console.log(`Sommaire — ${FICHIER} · sha256 ${empreinte.slice(0, 16)}… · ${notices.length} notice(s)`)
  for (const a of avertissements) console.log(`  ⚠ ${a}`)
  if (notices.map((n) => n.numero).join(',') !== NUMEROS.join(',')) throw new Error(`numéros lus : ${notices.map((n) => n.numero).join(',')} — attendu 1..15. STOP`)
  const incompl = notices.filter((n) => n.manquantes.length)
  if (incompl.length) throw new Error(`notices incomplètes : ${incompl.map((n) => `n° ${n.numero} (${n.manquantes.join(', ')})`).join(' ; ')}. STOP`)
  writeFileSync(`${DOSSIER}/notices-1re-section-1-15.json`, JSON.stringify(notices, null, 2) + '\n')

  const cibles = (await prisma.document.findMany({
    where: { type: 'JURISPRUDENCE', source: SOURCE, chambre: CHAMBRE, number: { in: NUMEROS } },
    select: { id: true, number: true, titleFr: true, publicationDate: true, updatedAt: true, matiere: true, summaryFr: true, decisionAttaquee: true, regleDroit: true, questionDroit: true, motifs: true, dispositif: true, solution: true, compositionNote: true, metaJson: true, bodyOriginal: true, judges: { select: { nameAsWritten: true, role: true }, orderBy: { position: 'asc' } } },
  })) as Cible[]
  if (cibles.length !== 15) throw new Error(`${cibles.length} cible(s) en base pour ${SOURCE} / ${CHAMBRE} n° 1-15 — attendu 15. STOP`)

  if (COLLATION) { await collationner(resolve(COLLATION), cibles); await prisma.$disconnect(); return }

  console.log(`\n${APPLY ? 'APPLICATION' : 'SIMULATION'}${TITRES ? ' + intitulés' : ''} · ${SOURCE} · ${CHAMBRE} · n° 1-15\n`)
  const plan: { n: Notice; c: Cible; valeurs: Record<Champ, string | null>; aFaire: boolean; titre: string | null }[] = []
  const alertes: string[] = []
  for (const n of notices) {
    const c = cibles.find((x) => x.number === n.numero)!
    const r = n.rubriques as Record<string, string>
    const dP = dateDeLaNotice(r['Date du prononcé']), dE = dateDeLaNotice(r["Date portée sur l'extrait"]), dB = iso(c.publicationDate)
    if (!dP || dP !== dB) throw new Error(`n° ${n.numero} : date du prononcé ${dP} ≠ publicationDate ${dB}. STOP`)
    if (dE && dE !== dB) throw new Error(`n° ${n.numero} : date portée sur l'extrait ${dE} ≠ publicationDate ${dB}. STOP`)
    if (!/Premi[èe]re\s+Section/u.test(r.Juridiction)) throw new Error(`n° ${n.numero} : juridiction « ${r.Juridiction} » n'est pas la Première Section. STOP`)

    const { valeurs, s } = preparer(n, c, empreinte)
    // Idempotence : identique → rien à faire ; non nul et différent → refus d'écraser.
    const differents = CHAMPS.filter((f) => c[f] !== null && c[f] !== valeurs[f])
    if (differents.length) throw new Error(`n° ${n.numero} : champ(s) déjà renseigné(s) autrement en base — ${differents.join(', ')} — refus d'écraser. STOP`)
    const aEcrire = CHAMPS.filter((f) => c[f] !== valeurs[f])
    const titre = TITRES && c.titleFr !== n.parties ? n.parties : null
    const aFaire = aEcrire.length > 0 || titre !== null
    plan.push({ n, c, valeurs, aFaire, titre })

    for (const e of verifierComposition(c, r.Composition)) alertes.push(`n° ${n.numero} · composition : ${e}`)
    if (!s.dispositif) alertes.push(`n° ${n.numero} : la notice ne porte pas de sous-mention « Dispositif » → dispositif et solution restent vides`)
    else if (!valeurs.solution) alertes.push(`n° ${n.numero} : deduireSolution ne classe pas « ${s.dispositif.slice(0, 80)}… » → solution vide`)

    console.log(`n° ${n.numero.padStart(2)} ${c.id} ${dB} ${aFaire ? (aEcrire.length ? `écrit ${aEcrire.length} champ(s)` : 'titre seul') : 'déjà à jour'}`)
    console.log(`      ${n.parties}${titre ? `   ← remplace « ${c.titleFr} »` : ''}`)
    console.log(`      matiere ${valeurs.matiere!.length} c. · analyse ${valeurs.summaryFr!.length} c. · attaquée ${valeurs.decisionAttaquee!.length} c. · règle ${valeurs.regleDroit!.length} c. · question ${valeurs.questionDroit!.length} c. · motifs ${valeurs.motifs!.length} c. · mention ${valeurs.compositionNote!.length} c.`)
    console.log(`      dispositif ${s.dispositif ? `${s.dispositif.length} c.` : '∅'} → solution ${valeurs.solution ?? '∅'}${s.anomalies ? ` · anomalies ${s.anomalies.length} c.` : ''}`)
  }
  if (alertes.length) { console.log('\nÀ SIGNALER (rien n\'est écrit pour ces points) :'); for (const a of alertes) console.log(`  ⚠ ${a}`) }

  const aFaire = plan.filter((p) => p.aFaire)
  console.log(`\n${aFaire.length}/15 fiche(s) à écrire${APPLY ? '' : '  (simulation — rien écrit)'}`)
  if (!APPLY || !aFaire.length) { await prisma.$disconnect(); return }

  const debut = new Date()
  let ecrits = 0
  for (const p of aFaire) {
    const where = { id: p.c.id, updatedAt: p.c.updatedAt, matiere: p.c.matiere, summaryFr: p.c.summaryFr, regleDroit: p.c.regleDroit, questionDroit: p.c.questionDroit, motifs: p.c.motifs, dispositif: p.c.dispositif, solution: p.c.solution, decisionAttaquee: p.c.decisionAttaquee, compositionNote: p.c.compositionNote, metaJson: p.c.metaJson }
    const data = { ...p.valeurs, ...(p.titre ? { titleFr: p.titre } : {}) }
    await prisma.$transaction(async (tx) => {
      const r = await tx.document.updateMany({ where, data })
      if (r.count !== 1) throw new Error(`n° ${p.n.numero} : la fiche a changé entre la lecture et l'écriture (${r.count} ligne). STOP`)
      await audit({
        action: 'DOC_PUBLISHED', targetType: 'Document', targetId: p.c.id,
        meta: { via: VIA, motif: `ENRICHISSEMENT par le sommaire analytique de la rédaction — ${SOURCE}, ${CHAMBRE}, n° ${p.n.numero} ; corps (bodyOriginal) intact`, champs: Object.keys(data), ancienTitre: p.titre ? p.c.titleFr : undefined, sha256: empreinte },
      }, tx)
    })
    await reindexDocument(p.c.id)
    ecrits++
    console.log(`  ✓ n° ${p.n.numero.padStart(2)} écrit et réindexé`)
  }
  // audit() avale ses erreurs : on recompte.
  const traces = await prisma.auditLog.count({ where: { createdAt: { gte: debut }, metaJson: { contains: `"via":"${VIA}"` } } })
  console.log(`\n${ecrits} fiche(s) écrite(s) · ${traces} entrée(s) d'audit${traces !== ecrits ? '  ⚠ ÉCART — vérifier AuditLog' : ''}`)

  // Relecture : les champs sont là, le corps n'a pas bougé.
  const apres = await prisma.document.findMany({ where: { id: { in: aFaire.map((p) => p.c.id) } }, select: { id: true, number: true, titleFr: true, matiere: true, summaryFr: true, decisionAttaquee: true, regleDroit: true, questionDroit: true, motifs: true, dispositif: true, solution: true, compositionNote: true, metaJson: true, bodyOriginal: true, searchText: true } })
  let corpsIntacts = 0, pleins = 0
  for (const a of apres) {
    const p = aFaire.find((x) => x.c.id === a.id)!
    if (a.bodyOriginal === p.c.bodyOriginal) corpsIntacts++
    if (CHAMPS.every((f) => a[f] === p.valeurs[f]) && (!p.titre || a.titleFr === p.titre)) pleins++
    if (!a.searchText || !a.searchText.includes(cleNotice(p.valeurs.matiere!).slice(0, 20))) console.log(`  ⚠ n° ${a.number} : searchText ne reflète pas la matière`)
  }
  console.log(`relecture : ${pleins}/${apres.length} conformes · ${corpsIntacts}/${apres.length} corps intacts`)
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error('✗', e.message); await prisma.$disconnect(); process.exit(1) })
