/**
 * Index du Moniteur — propositions d'entrées lues au SOMMAIRE de chaque fascicule des Éditions,
 * rapprochées de l'Index existant. On AJOUTE, on ne retire ni ne réécrit rien.
 *
 *   # 1. Propositions (lecture seule en base ; appels IA) :
 *   npx tsx scripts/indexer-sommaires-moniteur.ts --sortie <dossier> --lot <nom>
 *       [--annees 2013,2017] [--refs LM2021-SP22,…] [--sans-entree] [--limit N] [--concurrence 6]
 *       [--locaux <dossier d'inventaires>]   (PDF lus au Bureau plutôt que retéléchargés de Blob)
 *   # 2. Écriture des seules lignes validées (colonne « decision » = « créer ») :
 *   npx tsx scripts/indexer-sommaires-moniteur.ts --commit --valide <dossier>/<lot>.csv
 *
 * Pour chaque fascicule (source MONITEUR_PDF_*) :
 *  1. le SOMMAIRE est lu par l'IA (Claude, `LV_AI_MODEL`, défaut claude-haiku-5-5) : sur la
 *     transcription quand elle existe (texte, aucune image), sinon sur l'IMAGE des pages 1-2 ;
 *  2. chaque acte annoncé devient une proposition : titre rétabli en français correct, catégorie
 *     par `classify()` (le classifieur de l'Index existant), langue, indice de confiance ;
 *  3. rapprochement avec les entrées déjà à l'Index pour ce fascicule (`rapprocher`) :
 *     « déjà à l'Index » · « à créer » · « à relire » ; une entrée existante qu'aucun acte du
 *     sommaire ne retrouve est SIGNALÉE (« à l'Index, introuvable au sommaire »), jamais supprimée.
 *
 * Sortie : <lot>.json (tout) et <lot>.csv (une ligne par acte, colonne « decision » pré-remplie :
 * « créer » pour un acte à créer lu avec une confiance haute, « relire » sinon, vide pour ce qui est
 * déjà à l'Index). Me Vaval valide le lot ; `--commit` n'écrit que « créer ».
 *
 * ⚠️ UN TITRE ILLISIBLE N'EST PAS DEVINÉ : l'IA le marque en confiance « basse » → « relire ».
 * ⚠️ PAS DE `scripts/reindex.ts` : en production, le vecteur plein-texte suit par déclencheur.
 * ⚠️ Écriture idempotente : (fascicule, titre normalisé) déjà présent → sauté.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod/v4'
import { PrismaClient } from '@prisma/client'
import { buildSearchText, fold } from '../src/lib/search/normalize'
import { companyId, extractCompanies } from '../src/lib/moniteur/companies'
import { getPrivateBlob, isBlobUrl } from '../src/lib/storage/blob'
import { audit } from '../src/lib/auth/audit'
import { classify, cleFascicule, lireCsv, rapprocher, titreNormalise, versCsv } from './lib/moniteur-index'

const prisma = new PrismaClient()
const MODELE = process.env.LV_AI_MODEL || 'claude-haiku-5-5'
const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

const CONSIGNE = `Tu prépares l'INDEX du journal officiel haïtien « Le Moniteur ». On te donne le début d'un fascicule (sa première page, parfois la deuxième, ou leur transcription par OCR, souvent fautive).
Liste les ACTES PUBLIÉS dans ce fascicule, tels que le SOMMAIRE les annonce (encadré « SOMMAIRE » de la première page). Sans sommaire, prends les intitulés des actes qui ouvrent les rubriques (« LOI », « DÉCRET », « ARRÊTÉ », « AVIS »…).
Règles :
- Un acte = une entrée. Un avis qui autorise le fonctionnement de PLUSIEURS sociétés donne une entrée PAR société.
- Rétablis chaque titre en français correct (accents, casse de phrase, guillemets « »), en corrigeant les fautes d'OCR évidentes (« D£CRET » ⇒ « Décret », « Soci&t& » ⇒ « Société »). Garde la formule du sommaire (« Avis autorisant le fonctionnement de la société anonyme dénommée « X S.A. » — Acte constitutif et statuts y annexés »), les noms propres en capitales s'ils le sont.
- Les extraits du registre des marques s'écrivent exactement : « Extraits du registre des marques de fabrique et de commerce » (une seule entrée, quel que soit le nombre de marques).
- Ignore : la manchette, « SOMMAIRE », « NUMÉRO SPÉCIAL », « LIBERTÉ ÉGALITÉ FRATERNITÉ », les noms des signataires, les numéros de page, le corps des textes.
- Un titre doublé en créole haïtien (« Arete ki… », « Lwa… ») est une entrée distincte, langue « ht ». En anglais ou en espagnol : « en » ou « es ».
- N'INVENTE RIEN. Un mot illisible que tu ne peux pas rétablir avec certitude : mets la confiance à « basse ». Confiance « haute » seulement si le titre est entièrement lisible.
- Si la page n'est pas le début d'un fascicule du Moniteur, ou si aucun sommaire ni intitulé n'est lisible, renvoie une liste vide et sommaireLisible = false.`

const Lecture = z.object({
  sommaireLisible: z.boolean(),
  actes: z.array(
    z.object({
      titre: z.string(),
      langue: z.enum(['fr', 'ht', 'en', 'es']),
      confiance: z.enum(['haute', 'moyenne', 'basse']),
    }),
  ),
})

interface Fascicule {
  id: string
  number: string
  publicationDate: Date
  bodyOriginal: string
  sommaireOcr: string | null
  sourcePdfUrl: string | null
  metaJson: string | null
}

interface Proposition {
  ref: string
  date: string
  titre: string
  langue: string
  confiance: string
  categorie: string
  statut: string
  score: number
  proche: string | null
  decision: string
}

async function appel<T>(fn: () => Promise<T>): Promise<T> {
  for (let essai = 1; ; essai++) {
    try {
      return await fn()
    } catch (e) {
      const status = (e as { status?: number }).status
      if (essai >= 5 || !(status === 429 || status === 500 || status === 529 || status === undefined)) throw e
      await new Promise((r) => setTimeout(r, 2000 * 2 ** (essai - 1)))
    }
  }
}

/** Transcription utilisable : le corps privé de son en-tête « [Fascicule scanné …] ». */
function transcription(f: Fascicule): string | null {
  const corps = f.bodyOriginal.startsWith('[Fascicule scanné') ? f.bodyOriginal.slice(f.bodyOriginal.indexOf(']') + 1) : f.bodyOriginal
  if (corps.trim().length > 2000) return corps.trim().slice(0, 6000)
  if (f.sommaireOcr && f.sommaireOcr.trim().length > 200) return f.sommaireOcr.trim().slice(0, 6000)
  return null
}

async function octetsPdf(url: string): Promise<Buffer> {
  if (!isBlobUrl(url)) return readFileSync(url)
  const b = await getPrivateBlob(url)
  if (!b?.stream) throw new Error('blob introuvable')
  return Buffer.from(await new Response(b.stream).arrayBuffer())
}

/**
 * Pages 1-2 en JPEG gris (≈ 1 400 px de haut : le sommaire est en petits caractères).
 * `local` : la 1re partie du fascicule au Bureau (même fichier que sur Blob) — 5 000 fascicules
 * retéléchargés de Blob pèseraient ≈ 40 Go de sortie pour en lire deux pages chacun.
 */
async function imagesDebut(url: string, local: string | undefined): Promise<string[]> {
  const tmp = mkdtempSync(join(tmpdir(), 'sommaire-'))
  try {
    const pdf = local ?? join(tmp, 'f.pdf')
    if (!local) writeFileSync(pdf, await octetsPdf(url))
    const n = Number(/^Pages:\s+(\d+)/m.exec(execFileSync('pdfinfo', [pdf], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))?.[1] ?? 1)
    const out: string[] = []
    for (let p = 1; p <= Math.min(2, n); p++) {
      execFileSync('pdftoppm', ['-f', String(p), '-l', String(p), '-scale-to', '1400', '-gray', '-jpeg', '-singlefile', pdf, join(tmp, `p${p}`)], { stdio: 'ignore' })
      out.push(readFileSync(join(tmp, `p${p}.jpg`)).toString('base64'))
    }
    return out
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

function moniteurRef(number: string, d: Date): string {
  return `Le Moniteur · ${number} · ${JOURS[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

async function proposer(args: string[], opt: (n: string) => string | undefined) {
  const sortie = opt('--sortie')
  const lot = opt('--lot')
  if (!sortie || !lot) throw new Error('--sortie <dossier> et --lot <nom> requis')
  const annees = opt('--annees')?.split(',')
  const refs = opt('--refs')?.split(',')
  const limit = Number(opt('--limit') ?? Infinity)
  const concurrence = Number(opt('--concurrence') ?? 6)
  const locaux = new Map<string, string>()
  const dossierLocaux = opt('--locaux')
  if (dossierLocaux) {
    for (const f of readdirSync(dossierLocaux).filter((x) => /^\d{4}\.json$/.test(x))) {
      for (const x of (JSON.parse(readFileSync(join(dossierLocaux, f), 'utf8')) as { fascicules: { ref: string; fichiers: string[] }[] }).fascicules) {
        if (existsSync(x.fichiers[0])) locaux.set(cleFascicule(x.ref), x.fichiers[0])
      }
    }
  }

  const fascicules = (await prisma.document.findMany({
    where: {
      type: 'LEGISLATION',
      source: annees ? { in: annees.map((a) => `MONITEUR_PDF_${a}`) } : { startsWith: 'MONITEUR_PDF_' },
      ...(refs ? { number: { in: refs } } : {}),
    },
    select: { id: true, number: true, publicationDate: true, bodyOriginal: true, sommaireOcr: true, sourcePdfUrl: true, metaJson: true },
    orderBy: { publicationDate: 'asc' },
  })) as Fascicule[]

  // L'Index existant, par fascicule (clé sans tirets).
  const annesIndex = [...new Set(fascicules.map((f) => f.number.slice(2, 6)))]
  const index = await prisma.document.findMany({
    where: { type: 'INDEX', OR: annesIndex.map((a) => ({ number: { startsWith: `LM${a}` } })) },
    select: { number: true, titleFr: true },
  })
  const parFascicule = new Map<string, string[]>()
  for (const e of index) {
    if (!e.number) continue
    const k = cleFascicule(e.number)
    parFascicule.set(k, [...(parFascicule.get(k) ?? []), e.titleFr])
  }

  let selection = fascicules
  if (args.includes('--sans-entree')) selection = selection.filter((f) => !parFascicule.get(cleFascicule(f.number))?.length)
  selection = selection.slice(0, limit)
  const parTexte = selection.filter((f) => transcription(f)).length
  console.log(`${selection.length} fascicule(s) · ${parTexte} lus sur transcription, ${selection.length - parTexte} sur image (pages 1-2) · modèle ${MODELE}`)

  const client = new Anthropic()
  const propositions: Proposition[] = []
  const signalees: { ref: string; titre: string }[] = []
  const illisibles: string[] = []
  let jetons = 0
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(concurrence, selection.length) }, async () => {
      while (i < selection.length) {
        const f = selection[i++]
        const date = f.publicationDate.toISOString().slice(0, 10)
        try {
          const texte = transcription(f)
          const contenu: Anthropic.ContentBlockParam[] = texte
            ? [{ type: 'text', text: `Transcription OCR du début du fascicule ${f.number} :\n\n${texte}` }]
            : (await imagesDebut(f.sourcePdfUrl!, locaux.get(cleFascicule(f.number)))).map((data) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data } }))
          const r = await appel(() =>
            client.messages.parse({
              model: MODELE,
              max_tokens: 4000,
              messages: [{ role: 'user', content: [...contenu, { type: 'text', text: CONSIGNE }] }],
              output_config: { format: zodOutputFormat(Lecture) },
            }),
          )
          jetons += r.usage.input_tokens + r.usage.output_tokens
          const l = r.parsed_output!
          if (!l.sommaireLisible || !l.actes.length) illisibles.push(f.number)
          const existantes = parFascicule.get(cleFascicule(f.number)) ?? []
          const retrouvees = new Set<string>()
          const vus = new Set<string>()
          for (const a of l.actes) {
            const titre = a.titre.replace(/\s+/g, ' ').trim()
            if (!titre || vus.has(titreNormalise(titre))) continue
            vus.add(titreNormalise(titre))
            const rap = rapprocher(titre, existantes)
            if (rap.proche && rap.statut !== 'a-creer') retrouvees.add(rap.proche)
            const decision = rap.statut === 'a-creer' && a.confiance === 'haute' ? 'créer' : rap.statut === 'deja-a-l-index' ? '' : 'relire'
            propositions.push({ ref: f.number, date, titre, langue: a.langue, confiance: a.confiance, categorie: classify(titre).category, statut: rap.statut, score: rap.score, proche: rap.proche, decision })
          }
          for (const e of existantes) if (!retrouvees.has(e) && l.actes.length) signalees.push({ ref: f.number, titre: e })
        } catch (e) {
          illisibles.push(f.number)
          console.log(`✗ ${f.number} : ${(e as Error).message.slice(0, 140)}`)
        }
      }
    }),
  )

  const ordre = (p: Proposition) => (p.decision === 'relire' ? 0 : p.decision === 'créer' ? 1 : 2)
  propositions.sort((a, b) => a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref, 'fr', { numeric: true }) || ordre(a) - ordre(b))
  mkdirSync(sortie, { recursive: true })
  writeFileSync(join(sortie, `${lot}.json`), JSON.stringify({ lot, modele: MODELE, jetons, fascicules: selection.map((f) => f.number), propositions, signalees, illisibles }, null, 1))
  writeFileSync(
    join(sortie, `${lot}.csv`),
    versCsv([
      ['decision', 'reference', 'date', 'categorie', 'titre', 'langue', 'confiance', 'statut', 'score', 'entree_proche'],
      ...propositions.map((p) => [p.decision, p.ref, p.date, p.categorie, p.titre, p.langue, p.confiance, p.statut, p.score, p.proche]),
    ]),
  )
  const n = (s: string) => propositions.filter((p) => p.statut === s).length
  console.log(
    `\n${propositions.length} actes lus · ${n('a-creer')} à créer (${propositions.filter((p) => p.decision === 'créer').length} en confiance haute) · ` +
      `${n('a-relire')} à relire · ${n('deja-a-l-index')} déjà à l'Index · ${signalees.length} entrée(s) existante(s) introuvable(s) au sommaire · ` +
      `${illisibles.length} fascicule(s) sans sommaire lisible · ${jetons.toLocaleString('fr-FR')} jetons → ${join(sortie, lot)}.{csv,json}`,
  )
}

async function ecrire(opt: (n: string) => string | undefined) {
  const valide = opt('--valide')
  if (!valide) throw new Error('--valide <fichier.csv> requis avec --commit')
  const [tete, ...lignes] = lireCsv(readFileSync(valide, 'utf8'))
  const col = (nom: string) => tete.indexOf(nom)
  const aEcrire = lignes.filter((l) => l[col('decision')]?.trim() === 'créer')
  console.log(`${aEcrire.length} ligne(s) « créer » dans ${valide}`)

  const editions = await prisma.document.findMany({
    where: { type: 'LEGISLATION', source: { startsWith: 'MONITEUR_PDF_' }, number: { in: [...new Set(aEcrire.map((l) => l[col('reference')]))] } },
    select: { number: true, publicationDate: true },
  })
  const dateDe = new Map(editions.map((e) => [e.number!, e.publicationDate!]))
  const avant = await prisma.document.count({ where: { type: 'INDEX' } })

  let crees = 0
  let sautes = 0
  const refsEcrites = new Set<string>()
  for (const l of aEcrire) {
    const number = l[col('reference')]
    const titre = l[col('titre')].trim()
    const d = dateDe.get(number)
    // ⚠️ L'entrée doit renvoyer à un fascicule des Éditions — une référence morte est pire que rien.
    if (!d) {
      console.log(`⛔ ${number} absent des Éditions — ligne sautée`)
      sautes++
      continue
    }
    const deja = await prisma.document.findMany({ where: { type: 'INDEX', OR: [{ number }, { number: number.replace(/-(?=[A-Z]\d?$)/, '') }] }, select: { titleFr: true } })
    if (deja.some((x) => titreNormalise(x.titleFr) === titreNormalise(titre))) {
      sautes++
      continue
    }
    const { category, company } = classify(titre)
    const ref = moniteurRef(number, d)
    const ht = l[col('langue')] === 'ht'
    const id = randomUUID()
    await prisma.document.create({
      data: {
        id,
        type: 'INDEX',
        source: 'MONITEUR',
        status: 'PUBLIE',
        sealed: false,
        number,
        titleFr: titre.slice(0, 400),
        titleHt: ht ? titre.slice(0, 400) : null,
        originalLang: ht ? 'ht' : 'fr',
        bodyOriginal: titre,
        moniteurRef: ref,
        category,
        editionType: /-SP/i.test(number) ? 'SPECIALE' : 'REGULIERE',
        publicationDate: d,
        metaJson: JSON.stringify({ category, reference: number, year: d.getUTCFullYear(), via: 'indexer-sommaires-moniteur' }),
        searchText: buildSearchText({ titleFr: titre, number, moniteurRef: ref, bodyOriginal: titre }),
      },
    })
    if (company) {
      for (const name of extractCompanies(titre)) {
        const cid = companyId(name)
        await prisma.company.upsert({ where: { id: cid }, update: {}, create: { id: cid, name, searchName: fold(name) } })
        await prisma.companyPublication.create({ data: { id: `idx-p-${randomUUID()}`, companyId: cid, documentId: id, kind: company, label: titre.slice(0, 160), date: d, moniteurRef: ref } })
      }
    }
    refsEcrites.add(number)
    crees++
  }
  await audit({ action: 'DOC_PUBLISHED', targetType: 'DOCUMENT', meta: { via: 'indexer-sommaires-moniteur', lot: valide, entrees: crees, fascicules: refsEcrites.size } })
  const apres = await prisma.document.count({ where: { type: 'INDEX' } })
  console.log(`\n✅ ${crees} entrée(s) créée(s), ${sautes} sautée(s) · Index : ${avant} → ${apres}${apres - avant !== crees ? ' ⚠️ ÉCART' : ''}`)
}

async function main() {
  const args = process.argv.slice(2)
  const opt = (nom: string) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : undefined)
  if (args.includes('--commit')) await ecrire(opt)
  else await proposer(args, opt)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
