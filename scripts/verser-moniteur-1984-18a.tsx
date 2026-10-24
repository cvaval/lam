/**
 * ÉDITIONS LE MONITEUR — verse le n° 18-A du lundi 5 mars 1984 (Code du travail : « Décret harmonisant le Code du
 * Travail voté le 12 septembre 1961 avec des normes établies par certaines conventions de l'Organisation
 * Internationale du Travail ») : le PDF du fascicule ET sa « version HTML ».
 *
 * Me Vaval, 24 oct. 2026 : « téléverser dans la section Éditions Le Moniteur la version pdf et html du texte sur code du
 * travail tel que publié dans 18-A de 1984 », puis « corriger la version html afin qu'elle reflète Le Moniteur tel que
 * dans le texte se trouvant dans Législation annotée ». Le fascicule manquait au fonds (seul le n° 18 ordinaire y est).
 *
 * Version HTML (`bodyClean`) :
 *   - le DÉCRET — des visas aux signatures — est le texte de la fiche « Code du travail » de Législation annotée
 *     (`CODE_TRAVAIL_ANNOTE`, aligné sur le J.O. n° 18-A le 24 oct. : 702 leçons, intitulés, préambule et signatures),
 *     ligne pour ligne, jusqu'à « ANNEXE I » exclue ;
 *   - SAUF les art. 109-111, que la fiche annotée donne dans leur rédaction en vigueur (abrogés en 1985, réécrit en
 *     1989) : le fascicule de 1984 porte leur rédaction d'origine, celle que la fiche garde en repli (`oldVersions`) ;
 *   - la manchette, le sommaire, « DECRET » et le pied de page des Presses Nationales viennent du Word relu par
 *     Me Vaval (passé par `wordToHtmlVersion`, le convertisseur de l'UploadStudio), à la typographie de la plateforme ;
 *     le titre de Salès (« CODE DU TRAVAIL / (DÉCRET DU 24 FÉVRIER 1984) ») n'est pas au J.O. et n'y figure pas.
 * `bodyOriginal` porte l'en-tête de provenance des fascicules (« [Fascicule scanné … Fichier : …] », lu par trois
 * scripts) suivi du même texte — c'est lui que lit la réindexation (`buildSearchText` ignore `bodyClean`), et un corps
 * non vide tient le fascicule hors de portée de l'OCR combiné et de `verser-texte-moniteur-dans-corps`.
 *
 * Le PDF est catalogué par son chemin local ; `migrate-pdfs-to-blob.ts --commit` le téléverse au Blob privé — APRÈS
 * le déploiement qui affiche la version HTML d'un fascicule (sinon la fiche présenterait ce texte comme une
 * « transcription automatique » de microfilm). Rejouable : crée la fiche, ou la met à jour (verrou sur `updatedAt`).
 *
 * Garde-fous (refus d'écrire si l'un échoue) : empreintes du Word et du PDF attendues ; 37 pages ; manchette « No. 18-A »
 * et « Lundi 5 mars 1984 » ; l'entrée de l'Index « LM1984-18A » existe ; les lignes de chaque article sont celles de
 * la fiche annotée (109-111 : celles du repli) ; 516 têtes d'article en séquence ; le lecteur rend 516 ancres et les
 * 5 lignes du barème de l'art. 45 séparées.
 *
 *     npx tsx --tsconfig <tsconfig jsx> scripts/verser-moniteur-1984-18a.tsx <Word.docx> <fascicule.pdf> [--commit]
 */
import { PrismaClient } from '@prisma/client'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, realpathSync } from 'node:fs'
import { basename } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { OfficialText } from '../src/components/OfficialText'
import { wordToHtmlVersion } from '../src/lib/doc/word'
import { parseAnnotations } from '../src/lib/legislation/annotated'
import { buildSearchText } from '../src/lib/search/normalize'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const args = process.argv.slice(2)
const [WORD, PDF] = args.filter((a) => !a.startsWith('--'))
const COMMIT = args.includes('--commit')
const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex')
const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
// Typographie de la plateforme (celle de la fiche annotée) : espace avant « ; » et « : » hors chiffres, apostrophe courbe.
const typo = (l: string) => l.replace(/'/g, '’').replace(/(?<=\S);/g, ' ;').replace(/(?<=\S):(?!\d)/g, ' :').replace(/ {2,}/g, ' ').trim()

const SHA_WORD = '9c43e75cb511400438245cb4cb5ed4af97f99f9acd10f7ad08f3460297a7b8f9'
const SOURCE = 'MONITEUR_PDF_1984'
const NUMBER = 'LM1984-18-A'
const TITRE = 'Le Moniteur n° 18-A — Mars 1984'
const REF = 'Le Moniteur n° 18-A de Mars 1984'
const ORIGINE = ['art-109', 'art-110', 'art-111']

async function main() {
  if (!WORD || !PDF) throw new Error('usage : verser-moniteur-1984-18a.tsx <Word.docx> <fascicule.pdf> [--commit]')
  const erreurs: string[] = []
  const word = readFileSync(WORD), pdf = readFileSync(PDF)
  if (sha(word) !== SHA_WORD) erreurs.push(`Word inattendu (${sha(word).slice(0, 12)}…) — ce n'est pas la version relue du 24 oct.`)
  const pages = Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [PDF], { encoding: 'utf8' }))?.[1])
  if (pages !== 37) erreurs.push(`PDF : ${pages} pages ≠ 37`)

  const existant = await prisma.$queryRaw<{ id: string; updatedAt: Date }[]>`
    SELECT id, "updatedAt" FROM "Document" WHERE source = ${SOURCE} AND upper(replace(number, '-', '')) = 'LM198418A'`
  if (existant.length > 1) erreurs.push(`${existant.length} fiches n° 18-A en base`)
  const index = await prisma.$queryRaw<{ id: string; titleFr: string }[]>`
    SELECT id, "titleFr" FROM "Document" WHERE type = 'INDEX' AND upper(replace(number, '-', '')) = 'LM198418A'`
  if (index.length !== 1) erreurs.push(`Index : ${index.length} entrée(s) LM1984-18A ≠ 1`)

  // ── Le journal (manchette, sommaire, pied de page) : le Word ──
  const W = (await wordToHtmlVersion(word)).bodyClean.split('\n')
  const iDecret = W.findIndex((l) => norm(l) === 'JEAN-CLAUDE DUVALIER')
  const pied = W.at(-1)!
  if (iDecret < 0 || norm(W[iDecret - 1]) !== 'DECRET') erreurs.push('Word : « DECRET / JEAN-CLAUDE DUVALIER » introuvable')
  if (!/^Presses Nationales d'Haïti/.test(pied)) erreurs.push('Word : pied de page inattendu')
  const tete = W.slice(0, iDecret).map(typo)
  if (tete[0] !== 'Le Moniteur' || !tete.some((l) => /No\. 18-A/.test(l) && /Lundi 5 mars 1984/.test(l))) erreurs.push('manchette inattendue')

  // ── Le décret : la fiche annotée ──
  const ct = await prisma.document.findFirstOrThrow({ where: { source: 'CODE_TRAVAIL_ANNOTE' }, select: { id: true, bodyOriginal: true, annotationsJson: true, updatedAt: true } })
  const a = parseAnnotations(ct.annotationsJson)!
  const table = a.toc.map((t) => norm(t.label))
  const annexe = norm(a.toc.find((t) => t.kind === 'connexe')!.label)
  const corps = ct.bodyOriginal.split('\n')
  const fin = corps.findIndex((l) => norm(l) === annexe)
  const debut = corps.findIndex((l) => norm(l) === 'JEAN-CLAUDE DUVALIER')
  if (debut < 0 || fin < debut) erreurs.push('fiche annotée : bornes du décret introuvables')
  // Découpage de corriger-ct-mot-a-mot : intitulés = libellés de la table, dans l'ordre ; têtes en séquence ; après un
  // intitulé, une ligne hors article (« LOI No. 1 », paragraphe d'une « Disposition générale ») n'a pas d'ancre.
  const decouper = (ls: string[], ptr0: number, n0: number) => {
    let ptr = ptr0, n = n0, ancre: string | null = null
    return ls.map((t) => {
      const s = norm(t)
      if (s && ptr < table.length && s === table[ptr]) { ptr++; ancre = null; return { t, ancre: null as string | null, titre: true } }
      const m = s.match(/^Article\s+(\d{1,3})\./)
      if (m && Number(m[1]) === n + 1) { n++; ancre = `art-${n}` }
      return { t, ancre, titre: false }
    })
  }
  const tout = decouper(corps.slice(0, fin), 0, 0)
  const ptr0 = tout.slice(0, debut).filter((l) => l.titre).length
  const lignes = tout.slice(debut)
  const n = new Set(tout.filter((l) => l.ancre).map((l) => l.ancre)).size
  if (n !== 516) erreurs.push(`fiche annotée : ${n} têtes ≠ 516`)
  const decret: string[] = []
  for (const l of lignes) {
    if (l.ancre && ORIGINE.includes(l.ancre) && !l.titre) {
      if (decret.at(-1) === `⟦${l.ancre}⟧`) continue
      decret.push(`⟦${l.ancre}⟧`)
      continue
    }
    decret.push(l.t)
  }
  for (const k of ORIGINE) {
    const v = a.oldVersions?.[k]
    if (!v || !v.startsWith(`Article ${k.slice(4)}.`)) { erreurs.push(`${k} : rédaction de 1984 absente du repli`); continue }
    const i = decret.indexOf(`⟦${k}⟧`)
    if (i < 0) erreurs.push(`${k} : article introuvable`)
    else decret.splice(i, 1, ...v.split('\n'))
  }
  const texte = [...tete, ...decret, typo(pied)].join('\n')
  if (/\t|⟦/.test(texte)) erreurs.push('tabulation ou marque résiduelle')

  // ── Contrôles : chaque article est celui de la fiche annotée (109-111 : celui du repli), découpé de la même façon ──
  const parArticle = (ls: { t: string; ancre: string | null; titre: boolean }[]) => {
    const m = new Map<string, string[]>()
    for (const l of ls) if (l.ancre && !l.titre && l.t.trim()) m.set(l.ancre, [...(m.get(l.ancre) ?? []), l.t])
    return m
  }
  const obtenu = parArticle(decouper(texte.split('\n').slice(tete.length, -1), ptr0, 0))
  const attendu = parArticle(lignes)
  for (const k of ORIGINE) attendu.set(k, a.oldVersions![k].split('\n').filter((l) => l.trim()))
  if (obtenu.size !== 516) erreurs.push(`têtes d'article en séquence : ${obtenu.size} ≠ 516`)
  const ecarts = [...attendu].filter(([k, v]) => (obtenu.get(k) ?? []).join('\n') !== v.join('\n'))
  if (ecarts.length) erreurs.push(`${ecarts.length} article(s) différent(s) de la fiche annotée : ${ecarts.slice(0, 5).map(([k]) => k).join(', ')}`)
  // Hors articles (intitulés, visas, lignes après un intitulé) : les mêmes lignes, dans le même ordre.
  const hors = (ls: { t: string; ancre: string | null; titre: boolean }[]) => ls.filter((l) => (l.titre || !l.ancre) && l.t.trim()).map((l) => l.t).join('\n')
  if (hors(decouper(texte.split('\n').slice(tete.length, -1), ptr0, 0)) !== hors(lignes)) erreurs.push('lignes hors article différentes de la fiche annotée')

  const h = renderToStaticMarkup(<OfficialText text={texte} hrefFor={() => null} rich={[]} locale="fr" />)
  const ancres = new Set([...h.matchAll(/id="art-(\d+)"/g)].map((m) => m[1])).size
  if (ancres < 516) erreurs.push(`ancres d'article au rendu : ${ancres} < 516`)
  const bareme = ['de 3 mois à 12 mois de service . . . 15 jours', 'et à partir de 10 ans de service . . . 4 mois']
  if (!bareme.every((b) => new RegExp(`>${b.replace(/[.]/g, '\\.')}<`).test(h))) erreurs.push("barème de l'art. 45 recousu au rendu")

  const nomPdf = basename(PDF)
  const entete = `[Fascicule scanné du journal officiel « Le Moniteur » — ${pages} page(s). Fichier : ${nomPdf}]`
  const metaJson = JSON.stringify({
    edition: { anneeParution: 1984 - 1845, directeurGeneral: null, issn: null, ville: 'Port-au-Prince' },
    pages,
    parts: 1,
    dateSource: 'manchette',
    pdf: { fichier: nomPdf, sha256: sha(pdf) },
    versionHtml: {
      decret: `fiche « Code du travail » de Législation annotée (${ct.id}, état du ${ct.updatedAt.toISOString()}) — art. 109-111 dans leur rédaction de 1984 (repli)`,
      journal: { fichier: basename(WORD), sha256: sha(word), revue: 'Me Vaval (24 oct. 2026)', convertisseur: 'src/lib/doc/word.ts', parties: 'manchette, sommaire, « DECRET », pied de page' },
      decision: 'Me Vaval, 24 oct. 2026 : « refléter Le Moniteur tel que dans le texte se trouvant dans Législation annotée »',
    },
  })
  const data = {
    type: 'LEGISLATION' as const,
    status: 'EN_VIGUEUR' as const,
    titleFr: TITRE,
    number: NUMBER,
    moniteurRef: REF,
    publicationDate: new Date(Date.UTC(1984, 2, 5)),
    editionType: 'REGULIERE' as const,
    source: SOURCE,
    sealed: true,
    bodyOriginal: `${entete}\n\n${texte}`,
    bodyClean: texte,
    metaJson,
  }

  console.log(`${TITRE} (${NUMBER}) — ${pages} p., PDF ${(pdf.length / 1e6).toFixed(1)} Mo — ${existant.length ? `mise à jour de ${existant[0].id}` : 'création'}`)
  console.log(`version HTML : ${texte.length} caractères, ${texte.split('\n').length} lignes (journal ${tete.length + 1}, décret ${decret.length}), ${obtenu.size} articles, ${ancres} ancres au rendu`)
  console.log(`Index : ${index[0]?.titleFr.slice(0, 110) ?? '—'}`)
  if (erreurs.length) { console.log(`⛔ refus : ${erreurs.join(' ; ')}`); process.exitCode = 1; return }
  console.log('✓ garde-fous : tous passés')
  if (!COMMIT) { console.log('(à blanc — --commit pour écrire)'); return }

  let id: string
  if (existant.length) {
    // La fiche peut déjà porter son PDF au Blob : on ne touche pas à `sourcePdfUrl`.
    const r = await prisma.document.updateMany({ where: { id: existant[0].id, updatedAt: existant[0].updatedAt }, data })
    if (r.count !== 1) throw new Error('la fiche a changé depuis la lecture : rien écrit')
    id = existant[0].id
  } else {
    const searchText = buildSearchText({ titleFr: TITRE, number: NUMBER, moniteurRef: REF, bodyOriginal: data.bodyOriginal } as any)
    id = (await prisma.document.create({ data: { ...data, sourcePdfUrl: realpathSync(PDF), searchText }, select: { id: true } })).id
  }
  await reindexDocument(id)
  await audit({ action: 'DOC_PUBLISHED', targetType: 'DOCUMENT', targetId: id, meta: { via: 'verser-moniteur-1984-18a', number: NUMBER, mise_a_jour: existant.length > 0, decision: 'Me Vaval, 24 oct. 2026 — PDF et version HTML du n° 18-A de 1984, au texte de Législation annotée' } })
  console.log(`✅ ${existant.length ? 'mis à jour' : 'créé'} ${id}, réindexé, journalisé`)
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
