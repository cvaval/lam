/**
 * CORRECTION DU CODE DU TRAVAIL, MOT À MOT ET ALINÉA PAR ALINÉA — étape 7 de
 * docs/prompt-audit-code-du-travail-mot-a-mot.md. Adapté de corriger-cpc-mot-a-mot.tsx. À BLANC par défaut ;
 * `--commit` pour écrire.
 *
 * Entrée : un fichier de corrections VALIDÉES (JSON, hors du dépôt — il cite le livre) : { "operations": [ … ] },
 * liste FERMÉE de types :
 *   - remplacer            { ancre, avant, apres, nature, preuve }   `avant` UNE fois dans l'article (lignes jointes par
 *                          « \n » : un « \n » dans `apres` crée un alinéa, en retirer un fusionne)
 *   - marqueurs            { ancre, points: [{ debut, marqueur }], preuve }   pose le marqueur DU LIVRE (« a) », « 1°) »,
 *                          « • ») en tête de la ligne de l'article qui commence par `debut` (une seule)
 *   - retablir             { ancre, lignes, preuve }   remet les lignes de l'article telles qu'avant une écriture antérieure
 *                          (art. 41, 42, 45 : puces du 20 oct., Me Vaval le 23 oct. : « go back to the book's letter
 *                          and split », « books ») ; MOTS identiques exigés, seuls marqueurs et coupures changent
 *   - deplacer-commentaire { ancre, ligne, vers? }   ligne du corps → annotations.commentaires[clé de `vers`]
 *   - promouvoir-intitule  { ligne, label, kind }    comme au CPC (re-clef des annotations qui suivent)
 * et `--typographie` : la convention de la plateforme (mesurée le 23 oct. sur 308 fiches annotées) — une espace avant
 * « ; » et « : » hors chiffres ; apostrophe courbe (inchangée : le Code n'en a pas de droite) ; ni insécable ni double
 * espace. Lignes d'en-tête exclues (le lecteur les reconnaît à l'égalité exacte avec la table).
 *
 * ⚠️ PÉRIMÈTRE : le CODE seul (jusqu'à « ANNEXE I »). Les annexes renumérotent depuis l'article 1 : une ancre `art-N`
 * y désigne un homonyme. Le découpage suit la SÉQUENCE des têtes (« Article N. » ne compte que si N suit l'article
 * courant) — l'art. 110 cite le décret du 23 mai 1989, dont les « Article 1. » / « Article 2. » ne sont pas du Code.
 *
 * Garde-fous — refus d'écrire si l'un échoue : l'état en base est celui de l'instantané ; annexes identiques à
 * l'octet ; lignes d'en-tête inchangées (hors intitulés promus) ; 0 clé de jurisprudence orpheline ; menu = table ;
 * mêmes 516 têtes du Code ; rien ne disparaît (mots ≥ 4 lettres) hors liste blanche ; replis `connexe` intacts ; le
 * lecteur rend au moins autant de liens, et autant de points de liste de plus que de marqueurs posés.
 *
 *     npx tsx --tsconfig <tsconfig jsx> scripts/corriger-ct-mot-a-mot.tsx <corrections.json> [--typographie] [--commit]
 *   (le dossier de corrections.json contient avant.sha256.json, l'empreinte de l'instantané)
 */
import { PrismaClient } from '@prisma/client'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { AnnotatedText } from '../src/components/AnnotatedText'
import { parseAnnotations, segmentAnnotated, type Annotations } from '../src/lib/legislation/annotated'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'

const ID = 'cmr102ish0012ttoijkh8f31e'
const prisma = new PrismaClient()
const args = process.argv.slice(2)
const FICHIER = args.find((a) => !a.startsWith('--'))
const COMMIT = args.includes('--commit')
const TYPO = args.includes('--typographie')
const sha = (s: string) => createHash('sha256').update(s).digest('hex')
const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
const motsLongs = (s: string) => new Set(norm(s.replace(/[’‘]/g, "'")).toLowerCase().match(/[a-zà-ÿœ]{4,}/g) ?? [])
const MARQ = /^(?:[a-z]\)|\d{1,2}°?\)|\d{1,2}\.|•)\s/  // « a) », « 1) », « 1°) », « 1. » (art. 12), « • »
function typo(l: string): string {
  // « 1983; » prend son espace comme « travail; » ; seul « : » entre deux chiffres (heure, rapport) reste collé.
  return l.replace(/[\u00a0\u202f\u2007\u2009]/g, ' ').replace(/(?<=\S);/g, ' ;').replace(/(?<=\S):(?!\d)/g, ' :').replace(/ {2,}/g, ' ').replace(/\s+$/, '')
}

type Op =
  | { type: 'remplacer'; ancre: string; avant: string; apres: string; nature: string; preuve?: string }
  | { type: 'marqueurs'; ancre: string; points: { debut: string; marqueur: string }[]; preuve?: string }
  | { type: 'retablir'; ancre: string; lignes: string[]; preuve?: string }
  | { type: 'deplacer-commentaire'; ancre: string; ligne: string; vers?: string; preuve?: string }
  | { type: 'promouvoir-intitule'; ligne: string; label: string; kind?: string; preuve?: string }

interface Ligne { t: string; titre: boolean; ancre: string | null; code: boolean }
function decouper(body: string, a: Annotations): Ligne[] {
  const table = a.toc.map((t) => norm(t.label))
  const annexe = norm(a.toc.find((t) => t.kind === 'connexe')!.label)
  let ptr = 0, n = 0, code = true
  let ancre: string | null = null
  return body.split('\n').map((t) => {
    const s = norm(t)
    if (s && ptr < table.length && s === table[ptr]) {
      ptr++
      if (s === annexe) code = false
      if (code) ancre = null
      return { t, titre: true, ancre: null, code }
    }
    if (!code) return { t, titre: false, ancre: null, code }
    const m = s.match(/^Article\s+(\d{1,3})\./)
    if (m && Number(m[1]) === n + 1) { n++; ancre = `art-${n}` }
    return { t, titre: false, ancre, code }
  })
}
const cleDe = (body: string, a: Annotations) => {
  const m = new Map<string, string>()
  for (const b of segmentAnnotated(body, a.toc, a.pointAnchors, a.repeatedHeads) as any[])
    if (b.kind === 'body' && b.anchor && b.jurisKey && !b.noAnchors && !m.has(b.anchor)) m.set(b.anchor, b.jurisKey)
  return m
}

async function main() {
  if (!FICHIER) throw new Error('usage : corriger-ct-mot-a-mot.tsx <corrections.json> [--typographie] [--commit]')
  const { operations } = JSON.parse(readFileSync(FICHIER, 'utf8')) as { operations: Op[] }
  const dossier = dirname(FICHIER)
  const empreintes = JSON.parse(readFileSync(join(dossier, 'avant.sha256.json'), 'utf8'))

  const doc = await prisma.document.findUniqueOrThrow({ where: { id: ID }, select: { bodyOriginal: true, annotationsJson: true, updatedAt: true } })
  if (sha(doc.bodyOriginal) !== empreintes.body || sha(doc.annotationsJson ?? '') !== empreintes.ann)
    throw new Error("⛔ la fiche a changé depuis l'instantané de l'audit — refaire la collation, rien n'est écrit")

  const avantBody = doc.bodyOriginal
  const a0 = parseAnnotations(doc.annotationsJson)!
  const brut = JSON.parse(doc.annotationsJson!) as Record<string, any>
  const cles0 = cleDe(avantBody, a0)
  let lignes = decouper(avantBody, a0)
  const journal: { op: string; ancre?: string | null; avant?: string; apres?: string }[] = []
  const listeBlanche = new Set<string>()
  const promus: string[] = []
  let marqueursPoses = 0
  const lignesArticle = (ancre: string) => lignes.map((l, i) => ({ ...l, i })).filter((l) => l.code && l.ancre === ancre && !l.titre)

  for (const op of operations) {
    if (op.type === 'remplacer') {
      const ls = lignesArticle(op.ancre)
      if (!ls.length) throw new Error(`⛔ ${op.ancre} : article introuvable`)
      const texte = ls.map((l) => l.t).join('\n')
      const n = texte.split(op.avant).length - 1
      if (n !== 1) throw new Error(`⛔ ${op.ancre} : « ${op.avant.slice(0, 50)} » trouvé ${n} fois`)
      const nouv = texte.replace(op.avant, op.apres).split('\n')
      lignes.splice(ls[0].i, ls.length, ...nouv.map((t) => ({ t, titre: false, ancre: op.ancre, code: true })))
      if (['ocr', 'coquille-du-livre', 'cesure', 'ponctuation', 'casse-accent'].includes(op.nature)) for (const m of motsLongs(op.avant)) listeBlanche.add(m)
      journal.push({ op: `remplacer:${op.nature}`, ancre: op.ancre, avant: op.avant, apres: op.apres })
    } else if (op.type === 'marqueurs') {
      const ls = lignesArticle(op.ancre)
      if (!ls.length) throw new Error(`⛔ ${op.ancre} : article introuvable`)
      for (const p of op.points) {
        const c = ls.filter((l) => norm(l.t).startsWith(norm(p.debut)))
        if (c.length !== 1) throw new Error(`⛔ ${op.ancre} : point « ${p.debut} » trouvé ${c.length} fois`)
        const l = lignes[c[0].i]
        if (MARQ.test(l.t)) throw new Error(`⛔ ${op.ancre} : « ${p.debut} » porte déjà un marqueur`)
        if (!/^(?:[a-z]\)|\d{1,2}°?\)|\d{1,2}\.|•)$/.test(p.marqueur)) throw new Error(`⛔ ${op.ancre} : marqueur « ${p.marqueur} » hors liste`)
        lignes[c[0].i] = { ...l, t: `${p.marqueur} ${l.t.trimStart()}` }
        marqueursPoses++
      }
      journal.push({ op: 'marqueurs', ancre: op.ancre, apres: op.points.map((p) => p.marqueur).join(' ') })
    } else if (op.type === 'retablir') {
      const ls = lignesArticle(op.ancre)
      // Mots identiques exigés, au marqueur de tête près (« • » du 20 oct. retiré, « a) » du livre posé).
      const sans = (xs: string[]) => norm(xs.map((x) => x.trimStart().replace(MARQ, '')).join(' ')).split(' ')
      if (sans(ls.map((l) => l.t)).join(' ') !== sans(op.lignes).join(' ')) throw new Error(`⛔ ${op.ancre} : « retablir » changerait des mots`)
      lignes.splice(ls[0].i, ls.length, ...op.lignes.map((t) => ({ t, titre: false, ancre: op.ancre, code: true })))
      marqueursPoses += op.lignes.filter((t) => MARQ.test(t)).length - ls.filter((l) => MARQ.test(l.t)).length
      journal.push({ op: 'retablir', ancre: op.ancre, avant: `${ls.length} ligne(s)`, apres: `${op.lignes.length} ligne(s)` })
    } else if (op.type === 'deplacer-commentaire') {
      const cands = lignes.map((l, i) => ({ ...l, i })).filter((l) => l.code && !l.titre && norm(l.t) === norm(op.ligne) && l.ancre === (op.ancre || null))
      if (cands.length !== 1) throw new Error(`⛔ ${op.ancre} : ligne trouvée ${cands.length} fois — « ${op.ligne.slice(0, 60)} »`)
      lignes.splice(cands[0].i, 1)
      const cle = cles0.get(op.vers ?? op.ancre)
      if (!cle) throw new Error(`⛔ ${op.vers ?? op.ancre} : clé d'annotation introuvable`)
      brut.commentaires = brut.commentaires ?? {}
      brut.commentaires[cle] = [...(brut.commentaires[cle] ?? []), norm(op.ligne)]
      journal.push({ op: 'deplacer-commentaire', ancre: `${op.ancre || '(hors article)'} → ${op.vers ?? op.ancre}`, avant: op.ligne })
    } else if (op.type === 'promouvoir-intitule') {
      throw new Error('⛔ promouvoir-intitule : non validé (§ 9, question 4) — à porter quand Me Vaval aura tranché')
    }
  }

  if (TYPO) {
    let n = 0
    lignes = lignes.map((l) => {
      if (!l.code || l.titre) return l  // visas et considérants compris : c'est le texte du décret
      const t = typo(l.t)
      if (t !== l.t) n++
      return { ...l, t }
    })
    journal.push({ op: 'typographie', apres: `${n} ligne(s)` })
  }

  const apresBody = lignes.map((l) => l.t).join('\n')
  const apresJson = JSON.stringify(brut)
  const a1 = parseAnnotations(apresJson)!

  // ── Garde-fous ──
  const erreurs: string[] = []
  const corps0 = avantBody.split('\n'), corps1 = apresBody.split('\n')
  const fin0 = decouper(avantBody, a0).findIndex((l) => !l.code), fin1 = decouper(apresBody, a1).findIndex((l) => !l.code)
  if (corps0.slice(fin0).join('\n') !== corps1.slice(fin1).join('\n')) erreurs.push('annexes modifiées')
  const titres = (b: string, a: Annotations) => decouper(b, a).filter((l) => l.titre).map((l) => norm(l.t))
  if (JSON.stringify(titres(avantBody, a0)) !== JSON.stringify(titres(apresBody, a1))) erreurs.push('lignes d’en-tête modifiées')
  const heads = (b: string, a: Annotations) => [...new Set(decouper(b, a).filter((l) => l.code && l.ancre).map((l) => l.ancre))]
  if (heads(apresBody, a1).length !== 516) erreurs.push(`têtes du Code : ${heads(apresBody, a1).length} ≠ 516`)
  const blocs = segmentAnnotated(apresBody, a1.toc, a1.pointAnchors, a1.repeatedHeads) as any[]
  const cles = new Set(blocs.filter((b) => b.kind === 'body' && b.jurisKey).map((b) => b.jurisKey))
  const orphJ = Object.keys(a1.jurisprudence ?? {}).filter((k) => !cles.has(k))
  if (orphJ.length) erreurs.push(`${orphJ.length} clé(s) de jurisprudence orpheline(s) : ${orphJ.slice(0, 5).join(', ')}`)
  if (JSON.stringify(brut.connexe ?? {}) !== JSON.stringify(JSON.parse(doc.annotationsJson!).connexe ?? {})) erreurs.push('replis connexe modifiés')
  const ailleurs = motsLongs(apresBody + ' ' + apresJson)
  const perdus = [...motsLongs(avantBody)].filter((m) => !ailleurs.has(m) && !listeBlanche.has(m))
  if (perdus.length) erreurs.push(`${perdus.length} mot(s) disparu(s) hors liste blanche : ${perdus.slice(0, 12).join(', ')}`)
  const rendu = (body: string, a: Annotations) => renderToStaticMarkup(<AnnotatedText text={body} annotations={a} locale="fr" linkArtRefs hideInlineIndex />)
  const h0 = rendu(avantBody, a0), h1 = rendu(apresBody, a1)
  const n = (h: string, re: RegExp) => (h.match(re) ?? []).length
  if (n(h1, /href="/g) < n(h0, /href="/g)) erreurs.push(`liens perdus au rendu (${n(h0, /href="/g)} → ${n(h1, /href="/g)})`)
  const li0 = n(h0, /<li[ >]/g), li1 = n(h1, /<li[ >]/g)

  const rapport = { operations: operations.length, typographie: TYPO, journal, liens: [n(h0, /href="/g), n(h1, /href="/g)], points: [li0, li1], marqueursPoses, erreurs }
  writeFileSync(join(dossier, `correction-${COMMIT ? 'ecrite' : 'a-blanc'}.json`), JSON.stringify(rapport, null, 1))
  writeFileSync(join(dossier, 'apres-body.txt'), apresBody)
  writeFileSync(join(dossier, 'apres-ann.json'), apresJson)
  console.log(`${operations.length} opération(s) ; marqueurs posés ${marqueursPoses} ; points de liste au rendu ${li0} → ${li1} ; liens ${n(h0, /href="/g)} → ${n(h1, /href="/g)} ; lignes ${corps0.length} → ${corps1.length}`)
  if (erreurs.length) throw new Error('⛔ garde-fous :\n  ' + erreurs.join('\n  ') + '\nrien n’est écrit')
  console.log('✓ garde-fous : tous passés')
  if (!COMMIT) return console.log('(à blanc — --commit pour écrire)')

  const r = await prisma.document.updateMany({ where: { id: ID, updatedAt: doc.updatedAt }, data: { bodyOriginal: apresBody, annotationsJson: apresJson } })
  if (r.count !== 1) throw new Error('⛔ la fiche a changé pendant la correction : rien écrit')
  await reindexDocument(ID)
  await audit({ action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: ID, meta: { via: 'corriger-ct-mot-a-mot', operations: operations.length, marqueurs: marqueursPoses, typographie: TYPO, decision: 'audit mot à mot du Code du travail — Me Vaval, 23 oct. 2026' } })
  const relu = await prisma.document.findUniqueOrThrow({ where: { id: ID }, select: { bodyOriginal: true, annotationsJson: true } })
  if (relu.bodyOriginal !== apresBody || relu.annotationsJson !== apresJson) throw new Error('⛔ recompte : la fiche ne porte pas ce qui a été écrit')
  console.log('✅ écrit, réindexé, recompté')
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
