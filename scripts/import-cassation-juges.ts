/**
 * Verse la COMPOSITION DE LA FORMATION des 80 décisions du recueil 1964-1965.
 *
 * Les sommaires portent une ligne « Composition » déjà ponctuée et qualifiée : le
 * président avant le point-virgule, les juges après, le ministère public et le greffe
 * ensuite. On la lit — et non la prose de l'arrêt, qui donnerait les mêmes noms pour un
 * résultat moins sûr.
 *
 * ⚠️ EXÉCUTION À BLANC PAR DÉFAUT. `--apply` pour écrire.
 *
 * ⚠️ LE RAPPROCHEMENT DES GRAPHIES SE SIGNALE, IL NE SE FAIT PAS EN SILENCE. Deux
 * graphies qui partagent une clé sont réunies sous un seul magistrat — c'est l'office de
 * la clé — mais chaque regroupement est IMPRIMÉ, pour que la rédaction puisse le défaire.
 * Fondre « Louis BANATTE » et « Louis J. BANATTE » sans que rien ne le montre reviendrait
 * à attribuer des arrêts à quelqu'un qui ne les a pas rendus.
 *
 *   npx tsx scripts/import-cassation-juges.ts
 *   npx tsx scripts/import-cassation-juges.ts --apply
 */
import { readFileSync } from 'node:fs'
import mammoth from 'mammoth'
import { prisma } from '../src/lib/db'
import { audit } from '../src/lib/auth/audit'
import { cleMagistrat, lireComposition, type Membre } from '../src/lib/jurisprudence/composition'

const F_SOMMAIRES = [
  '/Users/cvaval/Downloads/Sommaire_Analytique_Arrets_1964-1965_full.docx',
  '/Users/cvaval/Downloads/Sommaire_Analytique_2e_Section_Arrets_30-47.docx',
  '/Users/cvaval/Downloads/Sommaire_Analytique_2e_Section_Arrets_2-15.docx',
]
/** Gabarit « étiquette seule sur sa ligne, valeur en dessous » — Première Section 2 à 16. */
const F_SOMMAIRE_1RE_2_16 = '/Users/cvaval/Downloads/Sommaire_Analytique_Arrets_2-16_1964-1965_1.docx'
const SOURCE = 'CASSATION_1964_1965'

const lignes = (t: string) => t.split('\n').map((x) => x.replace(/\s+/g, ' ').trim())
const lire = async (f: string) => lignes((await mammoth.extractRawText({ buffer: readFileSync(f) })).value)

interface Releve { section: string; numero: string; ligne: string }

/** Gabarits A et B : « Composition : … » sur la ligne même. */
async function releverSurLigne(fichier: string): Promise<Releve[]> {
  const l = await lire(fichier)
  const est = (x: string) =>
    /^(?:Arr[êe]t\s+)?(?:(Deuxi[èe]me|Premi[èe]re)\s+Section,\s*)?N[o°]s?\.?\s*(\d{1,3})\s*[—–-]\s*(.+)$/i.exec(x)
  const debuts = l.map((x, i) => ({ m: est(x), i })).filter((d) => d.m)
  const out: Releve[] = []
  for (let k = 0; k < debuts.length; k++) {
    const { m, i } = debuts[k]
    const bloc = l.slice(i + 1, k + 1 < debuts.length ? debuts[k + 1].i : l.length)
    const comp = bloc.find((x) => /^composition(\s+du\s+si[èe]ge)?\s*:/i.test(x))
    const jur = bloc.find((x) => /^juridiction\s*:/i.test(x)) ?? ''
    if (!comp) continue
    out.push({
      section: /deuxi/i.test(m![1] ?? '') || /deuxi/i.test(jur) ? 'Deuxième Section' : 'Première Section',
      numero: m![2],
      ligne: comp,
    })
  }
  return out
}

/** Gabarit C : l'étiquette « Composition » occupe sa ligne, la valeur suit. */
async function releverLigneAlignee(): Promise<Releve[]> {
  const l = await lire(F_SOMMAIRE_1RE_2_16)
  const debuts = l.map((x, i) => ({ m: /^ARR[ÊE]T\s+N[O°]s?\.?\s*(\d{1,3})\s*$/i.exec(x), i })).filter((d) => d.m)
  const out: Releve[] = []
  for (let k = 0; k < debuts.length; k++) {
    const { m, i } = debuts[k]
    const bloc = l.slice(i + 1, k + 1 < debuts.length ? debuts[k + 1].i : l.length).filter(Boolean)
    const j = bloc.findIndex((x) => /^composition(\s+du\s+si[èe]ge)?\s*$/i.test(x))
    if (j < 0 || !bloc[j + 1]) continue
    out.push({ section: 'Première Section', numero: m![1], ligne: bloc[j + 1] })
  }
  return out
}

async function main() {
  const apply = process.argv.includes('--apply')

  const releves = [
    ...(await Promise.all(F_SOMMAIRES.map(releverSurLigne))).flat(),
    ...(await releverLigneAlignee()),
  ]
  // ⚠️ LE NUMÉRO SEUL N'IDENTIFIE PAS UN ARRÊT : chaque section tient sa propre série.
  const parCle = new Map<string, Releve>()
  for (const r of releves) parCle.set(`${r.section}|${r.numero}`, r)
  console.log(`${releves.length} lignes « Composition » relevées → ${parCle.size} après dédoublonnage (section, numéro)\n`)

  const docs = await prisma.document.findMany({
    where: { type: 'JURISPRUDENCE', source: SOURCE },
    select: { id: true, number: true, chambre: true, titleFr: true },
  })
  const parDoc = new Map(docs.map((d) => [`${d.chambre}|${d.number}`, d]))

  // --- Les magistrats, regroupés par clé — et le regroupement est imprimé --------------
  const graphies = new Map<string, Set<string>>()
  const compositions = new Map<string, { membres: Membre[]; note: string | null }>()
  let sansMembre = 0
  const alertes: string[] = []
  for (const [cle, r] of parCle) {
    const c = lireComposition(r.ligne)
    if (!c.membres.length) { sansMembre++; alertes.push(`${cle} — aucune composition lue`); continue }
    compositions.set(cle, { membres: c.membres, note: c.note })
    for (const a of c.avertissements) alertes.push(`${cle} — ${a}`)
    for (const m of c.membres) {
      const k = cleMagistrat(m.nameAsWritten)
      if (!graphies.has(k)) graphies.set(k, new Set())
      graphies.get(k)!.add(m.nameAsWritten)
    }
  }

  console.log(`MAGISTRATS — ${graphies.size} fiches pour ${[...graphies.values()].reduce((a, g) => a + g.size, 0)} graphies`)
  for (const [k, g] of [...graphies].sort()) {
    const liste = [...g].sort()
    // Le nom retenu : la graphie la plus complète, celle qui perd le moins d'information.
    const retenu = liste.slice().sort((a, b) => b.length - a.length)[0]
    console.log(
      `  ${retenu.padEnd(28)} ${liste.length > 1 ? `⚠ ${liste.length} graphies réunies : ${liste.join(' | ')}` : ''}`,
    )
    void k
  }

  // --- Les rapprochements que la clé N'A PAS faits, et qu'il faut peut-être faire -------
  // ⚠️ ILS NE SONT PAS APPLIQUÉS. « Antony » pour « Anthony », « Duplessis » pour
  // « Duplessy » : une lettre sépare deux fiches, et une lettre peut aussi séparer deux
  // hommes. Le script les signale ; la rédaction tranche.
  const dist = (a: string, b: string) => {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
    for (let j = 0; j <= b.length; j++) d[0][j] = j
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++)
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    return d[a.length][b.length]
  }
  const cles = [...graphies.keys()]
  const proches: string[] = []
  for (let i = 0; i < cles.length; i++)
    for (let j = i + 1; j < cles.length; j++) {
      const [a, b] = [cles[i], cles[j]]
      const ta = new Set(a.split(' ')), tb = new Set(b.split(' '))
      const inclus = [...ta].every((x) => tb.has(x)) || [...tb].every((x) => ta.has(x))
      if (inclus || dist(a, b) <= 2) {
        const nom = (k: string) => [...graphies.get(k)!].sort((x, y) => y.length - x.length)[0]
        proches.push(`${nom(a)}  ↔  ${nom(b)}${inclus ? '  (l’un est contenu dans l’autre)' : `  (${dist(a, b)} lettre(s) d’écart)`}`)
      }
    }
  if (proches.length) {
    console.log(`\nRAPPROCHEMENTS POSSIBLES — NON APPLIQUÉS, à trancher par la rédaction (${proches.length}) :`)
    for (const x of proches) console.log(`  ${x}`)
  }

  if (alertes.length) {
    console.log(`\nÀ RELIRE (${alertes.length}) :`)
    for (const a of alertes) console.log(`  ${a}`)
  }

  // --- Écriture ------------------------------------------------------------------------
  let rattaches = 0, orphelins = 0, membresEcrits = 0
  const manquants: string[] = []
  for (const [cle] of compositions) if (!parDoc.has(cle)) { orphelins++; manquants.push(cle) }
  const sansComposition = [...parDoc.keys()].filter((k) => !compositions.has(k))

  if (apply) {
    // Une fiche Judge par clé de rapprochement, réutilisée si elle existe déjà.
    const idParCle = new Map<string, string>()
    for (const [k, g] of graphies) {
      const retenu = [...g].sort((a, b) => b.length - a.length)[0]
      const exist = await prisma.judge.findFirst({ where: { matchKey: k } })
      idParCle.set(k, exist ? exist.id : (await prisma.judge.create({ data: { displayName: retenu, matchKey: k } })).id)
    }
    for (const [cle, c] of compositions) {
      const doc = parDoc.get(cle)
      if (!doc) continue
      // Idempotence : la composition d'une décision est REMPLACÉE, jamais accumulée.
      await prisma.decisionJudge.deleteMany({ where: { documentId: doc.id } })
      for (const m of c.membres) {
        await prisma.decisionJudge.create({
          data: {
            documentId: doc.id,
            judgeId: idParCle.get(cleMagistrat(m.nameAsWritten))!,
            nameAsWritten: m.nameAsWritten,
            role: m.role,
            qualite: m.qualite,
            position: m.position,
          },
        })
        membresEcrits++
      }
      await prisma.document.update({ where: { id: doc.id }, data: { compositionNote: c.note } })
      rattaches++
    }
    await audit({
      action: 'DOC_PUBLISHED', targetType: 'Document', targetId: SOURCE,
      meta: { via: 'import-cassation-juges', magistrats: graphies.size, decisions: rattaches, membres: membresEcrits },
    })
  } else {
    rattaches = [...compositions.keys()].filter((k) => parDoc.has(k)).length
    membresEcrits = [...compositions.values()].reduce((a, c) => a + c.membres.length, 0)
  }

  console.log(`\nDÉCISIONS — ${rattaches} rattachées sur ${docs.length} · ${membresEcrits} participations`)
  if (sansComposition.length) {
    console.log(`\nSANS COMPOSITION (${sansComposition.length}) — le sommaire n'en porte pas :`)
    console.log(`  ${sansComposition.sort().join(' · ')}`)
  }
  if (orphelins) {
    console.log(`\nCOMPOSITIONS SANS DÉCISION EN BASE (${orphelins}) :`)
    console.log(`  ${manquants.sort().join(' · ')}`)
  }
  if (sansMembre) console.log(`\nlignes illisibles : ${sansMembre}`)
  if (!apply) console.log('\n(exécution à blanc — ajouter --apply pour écrire)')
  await prisma.$disconnect()
}

main()
