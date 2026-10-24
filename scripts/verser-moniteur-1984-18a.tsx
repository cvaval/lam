/**
 * ÉDITIONS LE MONITEUR — verse le n° 18-A du lundi 5 mars 1984 (Code du travail : « Décret harmonisant le Code du
 * Travail voté le 12 septembre 1961 avec des normes établies par certaines conventions de l'Organisation
 * Internationale du Travail ») : le PDF du fascicule ET sa « version HTML ».
 *
 * Me Vaval, 24 oct. 2026 : « téléverser dans la section Éditions Le Moniteur la version pdf et html du texte sur code du
 * travail tel que publié dans 18-A de 1984 ». Le fascicule manquait au fonds (seul le n° 18 ordinaire, 8 p., y est).
 *
 * Version HTML = le Word fourni (transcription du J.O. relue par Me Vaval — dernière main 24 oct., 01 h 37 UTC), passé
 * par le convertisseur de la plateforme (`wordToHtmlVersion`, celui de l'UploadStudio) : `bodyClean` ; `bodyOriginal`
 * porte l'en-tête de provenance des fascicules (« [Fascicule scanné … Fichier : …] », lu par trois scripts) suivi du
 * même texte — c'est lui que lit la réindexation (`buildSearchText` ignore `bodyClean`), et un corps non vide tient
 * le fascicule hors de portée de l'OCR combiné et de `verser-texte-moniteur-dans-corps`.
 *
 * ⚠️ LES 7 TABULATIONS DU WORD (barème de l'art. 45, composition de l'art. 39) deviennent « . . . » : le navigateur
 * les réduirait à une espace, et les lignes du barème, en minuscule, seraient recousues en un paragraphe. C'est la
 * forme de la fiche annotée (règle du barème, `officiel.ts`).
 *
 * Le PDF est catalogué par son chemin local ; `migrate-pdfs-to-blob.ts --commit` le téléverse au Blob privé — APRÈS
 * le déploiement qui affiche la version HTML d'un fascicule (sinon la fiche présenterait ce texte comme une
 * « transcription automatique » de microfilm).
 *
 * Garde-fous (refus d'écrire si l'un échoue) : aucun n° 18-A de 1984 en base ; empreintes du Word et du PDF attendues ;
 * 37 pages ; manchette « No. 18-A » et « Lundi 5 mars 1984 » ; 516 têtes d'article en séquence ; 7 tabulations, toutes
 * rendues ; aucune tabulation restante ; l'entrée de l'Index « LM1984-18A » existe (renvoi Index ⇄ Éditions) ; le
 * lecteur rend 516 ancres d'article et les 5 lignes du barème séparées.
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
import { buildSearchText } from '../src/lib/search/normalize'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const args = process.argv.slice(2)
const [WORD, PDF] = args.filter((a) => !a.startsWith('--'))
const COMMIT = args.includes('--commit')
const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex')

const SHA_WORD = '9c43e75cb511400438245cb4cb5ed4af97f99f9acd10f7ad08f3460297a7b8f9'
const SOURCE = 'MONITEUR_PDF_1984'
const NUMBER = 'LM1984-18-A'
const TITRE = 'Le Moniteur n° 18-A — Mars 1984'
const REF = 'Le Moniteur n° 18-A de Mars 1984'

async function main() {
  if (!WORD || !PDF) throw new Error('usage : verser-moniteur-1984-18a.tsx <Word.docx> <fascicule.pdf> [--commit]')
  const erreurs: string[] = []
  const word = readFileSync(WORD), pdf = readFileSync(PDF)
  if (sha(word) !== SHA_WORD) erreurs.push(`Word inattendu (${sha(word).slice(0, 12)}…) — ce n'est pas la version relue du 24 oct.`)
  const pages = Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [PDF], { encoding: 'utf8' }))?.[1])
  if (pages !== 37) erreurs.push(`PDF : ${pages} pages ≠ 37`)

  const dejaLa = await prisma.$queryRaw<{ id: string; number: string }[]>`
    SELECT id, number FROM "Document" WHERE source = ${SOURCE} AND upper(replace(number, '-', '')) = 'LM198418A'`
  if (dejaLa.length) erreurs.push(`le n° 18-A est déjà en base : ${dejaLa.map((d) => d.id).join(', ')}`)
  const index = await prisma.$queryRaw<{ id: string; titleFr: string }[]>`
    SELECT id, "titleFr" FROM "Document" WHERE type = 'INDEX' AND upper(replace(number, '-', '')) = 'LM198418A'`
  if (index.length !== 1) erreurs.push(`Index : ${index.length} entrée(s) LM1984-18A ≠ 1`)

  // ── Version HTML ──
  const v = await wordToHtmlVersion(word)
  if (v.richBlocks.length) erreurs.push(`${v.richBlocks.length} tableau(x) inattendu(s)`)
  const tabs = (v.bodyClean.match(/\t/g) ?? []).length
  if (tabs !== 7) erreurs.push(`${tabs} tabulation(s) ≠ 7`)
  const texte = v.bodyClean.replace(/[ ]*\t[ ]*/g, ' . . . ')
  if (/\t/.test(texte)) erreurs.push('tabulation restante')
  const L = texte.split('\n')
  if (L[0] !== 'Le Moniteur' || !L.slice(0, 6).some((l) => /No\. 18-A/.test(l) && /Lundi 5 mars 1984/.test(l))) erreurs.push('manchette inattendue')
  let n = 0
  for (const l of L) {
    const m = /^Article (\d{1,3})\s?\./.exec(l)
    if (m && Number(m[1]) === n + 1) n++
  }
  if (n !== 516) erreurs.push(`têtes d'article en séquence : ${n} ≠ 516`)

  const h = renderToStaticMarkup(<OfficialText text={texte} hrefFor={() => null} rich={[]} locale="fr" />)
  const ancres = new Set([...h.matchAll(/id="art-(\d+)"/g)].map((m) => m[1])).size
  if (ancres < 516) erreurs.push(`ancres d'article au rendu : ${ancres} < 516`)
  const bareme = ['de 3 mois à 12 mois de service . . . 15 jours', 'et à partir de 10 ans de service . . . 4 mois']
  if (!bareme.every((b) => new RegExp(`>${b.replace(/[.]/g, '\\.')}<`).test(h))) erreurs.push("barème de l'art. 45 recousu au rendu")

  const nomPdf = basename(PDF)
  const entete = `[Fascicule scanné du journal officiel « Le Moniteur » — ${pages} page(s). Fichier : ${nomPdf}]`
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
    sourcePdfUrl: realpathSync(PDF),
    bodyOriginal: `${entete}\n\n${texte}`,
    bodyClean: texte,
    metaJson: JSON.stringify({
      edition: { anneeParution: 1984 - 1845, directeurGeneral: null, issn: null, ville: 'Port-au-Prince' },
      pages,
      parts: 1,
      dateSource: 'manchette',
      pdf: { fichier: nomPdf, sha256: sha(pdf) },
      versionHtml: {
        fichier: basename(WORD),
        sha256: sha(word),
        revue: 'transcription du J.O. relue par Me Vaval (24 oct. 2026)',
        convertisseur: 'src/lib/doc/word.ts',
        tabulations: '7 tabulations rendues par « . . . » (art. 39 et 45)',
      },
    }),
  }
  const searchText = buildSearchText({ titleFr: TITRE, number: NUMBER, moniteurRef: REF, bodyOriginal: data.bodyOriginal } as any)

  console.log(`${TITRE} (${NUMBER}) — ${pages} p., PDF ${(pdf.length / 1e6).toFixed(1)} Mo`)
  console.log(`version HTML : ${texte.length} caractères, ${L.length} lignes, ${n} têtes d'article, ${ancres} ancres au rendu ; 7 tabulations → « . . . »`)
  console.log(`Index : ${index[0]?.titleFr.slice(0, 110) ?? '—'}`)
  if (erreurs.length) { console.log(`⛔ refus : ${erreurs.join(' ; ')}`); process.exitCode = 1; return }
  console.log('✓ garde-fous : tous passés')
  if (!COMMIT) { console.log('(à blanc — --commit pour écrire)'); return }

  const doc = await prisma.document.create({ data: { ...data, searchText }, select: { id: true } })
  await reindexDocument(doc.id)
  await audit({ action: 'DOC_PUBLISHED', targetType: 'DOCUMENT', targetId: doc.id, meta: { via: 'verser-moniteur-1984-18a', number: NUMBER, decision: 'Me Vaval, 24 oct. 2026 — PDF et version HTML du n° 18-A de 1984' } })
  console.log(`✅ créé ${doc.id}, réindexé, journalisé — PDF à téléverser au Blob après déploiement (migrate-pdfs-to-blob.ts --commit)`)
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
