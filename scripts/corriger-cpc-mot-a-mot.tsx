/**
 * CORRECTION DU CODE DE PROCÉDURE CIVILE, MOT À MOT ET ALINÉA PAR ALINÉA — étape 6 de
 * docs/prompt-audit-code-procedure-civile-mot-a-mot.md. À BLANC par défaut ; `--commit` pour écrire.
 *
 * Entrée : un fichier de corrections VALIDÉES (JSON, hors du dépôt — il cite le livre) : { "operations": [ … ] },
 * liste FERMÉE de types :
 *   - remplacer            { ancre, avant, apres, nature, motsRetires?, preuve }   `avant` UNE fois dans l'article
 *                          (lignes jointes par « \n » : un « \n » dans `apres` crée un alinéa, en retirer en fusionne)
 *   - deplacer-commentaire { ancre, ligne, vers? }  ligne exacte du corps → annotations.commentaires[clé de l'article
 *                          `vers` (par défaut le même)] — art. 997 : les notes de l'éditeur appartiennent à l'art. 987
 *   - retirer-ligne        { ancre, ligne, motif }  débris de mise en page (« Anc » sous l'art. 692) — liste blanche
 *   - actes-lies           { table }               annotations.actesLies (désignation → fiche), § 6.6 du prompt
 *   - promouvoir-intitule  { ligne, label, kind }  intertitre composé comme du texte → intitulé de la table (toc +
 *                          navToc, ancre neuve, niveau = celui du parent + 1) ; les annotations des articles qui le
 *                          suivent sont RE-CLEFÉES (`sec-K|art-N` → `sec-K'|art-N`)
 *   - ancienne-numerotation { ancre, numeros }     fixe le texte « Ancienne numérotation : article N. » de l'article
 *   - reclef-commentaires  {}                      les commentaires rangés sous `art-N` passent sous la clé que le
 *                          lecteur lit (`jurisKeyFor`) — sans quoi ils sont invisibles (0/771 le 18 oct. 2026)
 * et `--espaces` : ni insécable, ni cadratin, ni double espace dans le texte des articles.
 *
 * Garde-fous — le script REFUSE d'écrire si l'un échoue : l'état en base est celui de l'instantané ; les lignes
 * d'en-tête sont inchangées (hors intitulés promus) ; la suite des ancres de section ne gagne que les intitulés
 * promus ; 0 clé de jurisprudence ou de commentaire orpheline ; menu = table ; mêmes 1 040 ancres d'article ; rien ne
 * disparaît (mots ≥ 4 lettres) hors liste blanche ; le lecteur rend au moins autant de liens.
 *
 *     npx tsx --tsconfig <tsconfig jsx> scripts/corriger-cpc-mot-a-mot.tsx <corrections.json> [--espaces] [--commit]
 */
import { PrismaClient } from '@prisma/client'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { AnnotatedText } from '../src/components/AnnotatedText'
import { parseAnnotations, segmentAnnotated, type Annotations } from '../src/lib/legislation/annotated'
import { articleAnchorFromHeading } from '../src/lib/doc/anchors'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'

const ID = 'cms7u9239000212wwoddflgnu'
const prisma = new PrismaClient()
const args = process.argv.slice(2)
const FICHIER = args.find((a) => !a.startsWith('--'))
const COMMIT = args.includes('--commit')
const ESPACES = args.includes('--espaces')
const sha = (s: string) => createHash('sha256').update(s).digest('hex')

type Op =
  | { type: 'remplacer'; ancre: string; avant: string; apres: string; nature: string; motsRetires?: string[]; preuve?: string }
  | { type: 'deplacer-commentaire'; ancre: string; ligne: string; vers?: string; preuve?: string }
  | { type: 'retirer-ligne'; ancre: string; ligne: string; motif: string }
  | { type: 'actes-lies'; table: Record<string, string> }
  | { type: 'promouvoir-intitule'; ligne: string; label: string; kind?: string; preuve?: string }
  | { type: 'ancienne-numerotation'; ancre: string; numeros: string[]; preuve?: string }
  | { type: 'reclef-commentaires' }

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
const TETE = /^Article\s/
const motsLongs = (s: string) => new Set(norm(s.replace(/[’‘]/g, "'")).toLowerCase().match(/[a-zà-ÿœ]{4,}/g) ?? [])

interface Ligne { t: string; titre: boolean; ancre: string | null }
function decouper(body: string, a: Annotations): Ligne[] {
  const table = a.toc.map((t) => norm(t.label))
  let ptr = 0
  let ancre: string | null = null
  return body.split('\n').map((t) => {
    const s = norm(t)
    if (s && ptr < table.length && s === table[ptr]) {
      ptr++
      ancre = null
      return { t, titre: true, ancre: null }
    }
    const an = TETE.test(s) ? articleAnchorFromHeading(s) : undefined
    if (an) ancre = an
    return { t, titre: false, ancre }
  })
}
const cleDe = (body: string, a: Annotations) => {
  const m = new Map<string, string>()
  for (const b of segmentAnnotated(body, a.toc, a.pointAnchors, a.repeatedHeads) as any[])
    if (b.kind === 'body' && b.anchor && b.jurisKey && !m.has(b.anchor)) m.set(b.anchor, b.jurisKey)
  return m
}

async function main() {
  if (!FICHIER) throw new Error('usage : corriger-cpc-mot-a-mot.tsx <corrections.json> [--espaces] [--commit]')
  const { operations } = JSON.parse(readFileSync(FICHIER, 'utf8')) as { operations: Op[] }
  const dossier = dirname(FICHIER)
  const empreintes = JSON.parse(readFileSync(join(dossier, 'avant.sha256.json'), 'utf8'))

  const doc = await prisma.document.findUniqueOrThrow({ where: { id: ID }, select: { bodyOriginal: true, annotationsJson: true } })
  if (sha(doc.bodyOriginal ?? '') !== empreintes.bodyOriginal || sha(doc.annotationsJson ?? '') !== empreintes.annotationsJson)
    throw new Error("⛔ la fiche a changé depuis l'instantané de l'audit — refaire la collation, rien n'est écrit")

  const avantBody = doc.bodyOriginal ?? ''
  const a0 = parseAnnotations(doc.annotationsJson)!
  const brut = JSON.parse(doc.annotationsJson!) as Record<string, any>
  const cles0 = cleDe(avantBody, a0)
  let lignes = decouper(avantBody, a0)
  const journal: { op: string; ancre?: string | null; avant?: string; apres?: string }[] = []
  const listeBlanche = new Set<string>()
  const promus: string[] = []
  let reclef = false
  const lignesArticle = (ancre: string) => lignes.map((l, i) => ({ ...l, i })).filter((l) => l.ancre === ancre && !l.titre)

  for (const op of operations) {
    if (op.type === 'remplacer') {
      const ls = lignesArticle(op.ancre)
      if (!ls.length) throw new Error(`⛔ ${op.ancre} : article introuvable`)
      const texte = ls.map((l) => l.t).join('\n')
      const n = texte.split(op.avant).length - 1
      if (n !== 1) throw new Error(`⛔ ${op.ancre} : « ${op.avant.slice(0, 50)} » trouvé ${n} fois`)
      const nouv = texte.replace(op.avant, op.apres).split('\n')
      lignes.splice(ls[0].i, ls.length, ...nouv.map((t) => ({ t, titre: false, ancre: op.ancre })))
      if (['ocr', 'coquille-du-livre', 'cesure', 'ponctuation', 'casse-accent'].includes(op.nature)) for (const m of motsLongs(op.avant)) listeBlanche.add(m)
      for (const m of op.motsRetires ?? []) for (const x of motsLongs(m)) listeBlanche.add(x)
      journal.push({ op: `remplacer:${op.nature}`, ancre: op.ancre, avant: op.avant, apres: op.apres })
    } else if (op.type === 'deplacer-commentaire') {
      const cands = lignes.map((l, i) => ({ ...l, i })).filter((l) => !l.titre && norm(l.t) === norm(op.ligne) && l.ancre === op.ancre)
      if (cands.length !== 1) throw new Error(`⛔ ${op.ancre} : ligne trouvée ${cands.length} fois — « ${op.ligne.slice(0, 60)} »`)
      lignes.splice(cands[0].i, 1)
      const cle = cles0.get(op.vers ?? op.ancre)
      if (!cle) throw new Error(`⛔ ${op.vers ?? op.ancre} : clé d'annotation introuvable`)
      brut.commentaires = brut.commentaires ?? {}
      brut.commentaires[cle] = [...(brut.commentaires[cle] ?? []), norm(op.ligne)]
      journal.push({ op: 'deplacer-commentaire', ancre: `${op.ancre} → ${op.vers ?? op.ancre}`, avant: op.ligne })
    } else if (op.type === 'retirer-ligne') {
      const cands = lignes.map((l, i) => ({ ...l, i })).filter((l) => !l.titre && norm(l.t) === norm(op.ligne) && l.ancre === op.ancre)
      if (cands.length !== 1) throw new Error(`⛔ ${op.ancre} : ligne à retirer trouvée ${cands.length} fois`)
      lignes.splice(cands[0].i, 1)
      for (const m of motsLongs(op.ligne)) listeBlanche.add(m)
      journal.push({ op: 'retirer-ligne', ancre: op.ancre, avant: op.ligne, apres: op.motif })
    } else if (op.type === 'actes-lies') {
      brut.actesLies = { ...(brut.actesLies ?? {}), ...op.table }
      journal.push({ op: 'actes-lies', apres: Object.keys(op.table).join(' · ') })
    } else if (op.type === 'promouvoir-intitule') {
      const cands = lignes.map((l, i) => ({ ...l, i })).filter((l) => !l.titre && norm(l.t) === norm(op.ligne))
      if (cands.length !== 1) throw new Error(`⛔ intertitre trouvé ${cands.length} fois — « ${op.ligne.slice(0, 60)} »`)
      const i = cands[0].i
      // Rang dans la table = nombre d'intitulés qui le précèdent dans le corps.
      const rang = lignes.slice(0, i).filter((l) => l.titre).length
      const precedents = brut.toc.slice(0, rang) as any[]
      const parent = [...precedents].reverse().find((t) => (t.kind ?? '') !== 'paragraphe') ?? precedents[precedents.length - 1]
      const niveau = (parent?.level ?? 0) + 1
      const max = Math.max(...brut.toc.map((t: any) => Number(String(t.anchor).replace('sec-', '')) || 0))
      const anchor = `sec-${max + 1}`
      brut.toc.splice(rang, 0, { level: niveau, label: op.label, anchor, kind: op.kind ?? 'paragraphe' })
      // navToc : enfant du parent, après ses enfants déjà placés avant lui dans la table.
      const ordre = new Map(brut.toc.map((t: any, k: number) => [t.anchor, k]))
      const trouver = (ns: any[]): any => { for (const x of ns) { if (x.anchor === parent.anchor && x.label === parent.label) return x; const r = trouver(x.children ?? []); if (r) return r } return null }
      const p = trouver(brut.navToc)
      if (!p) throw new Error(`⛔ parent ${parent?.anchor} introuvable au menu`)
      p.children = p.children ?? []
      // Le menu du CPC porte aussi les ARTICLES (feuilles `art-N`) : le nouvel intitulé prend place après le dernier
      // enfant qui le précède dans le corps, et emmène les articles qui le suivent jusqu'à l'intitulé suivant.
      const posCorps = (an: string) => String(an).startsWith('art-')
        ? lignes.findIndex((l) => l.ancre === an)
        : (() => { const k = ordre.get(an) ?? -1; let c = -1; return lignes.findIndex((l) => l.titre && ++c === k) })()
      const kids = p.children as any[]
      const pos = kids.filter((c) => posCorps(c.anchor) < i).length
      // Les articles du corps entre l'intertitre et l'intitulé suivant le rejoignent, où qu'ils soient au menu
      // (sous le parent, ou sous l'intertitre précédent de la même série « II.- », « III.- »…).
      const fin = lignes.findIndex((l, k) => k > i && l.titre)
      const arts = new Set(lignes.slice(i + 1, fin < 0 ? undefined : fin).filter((l) => l.ancre).map((l) => l.ancre as string))
      const pris: any[] = []
      const retirer = (ns: any[]) => { for (let k = ns.length - 1; k >= 0; k--) { if (arts.has(ns[k].anchor)) pris.unshift(...ns.splice(k, 1)); else retirer(ns[k].children ?? []) } }
      retirer(brut.navToc)
      pris.sort((x, y) => posCorps(x.anchor) - posCorps(y.anchor))
      kids.splice(Math.min(pos, kids.length), 0, { label: op.label, anchor, children: pris })
      lignes[i] = { t: op.label, titre: true, ancre: null }
      // les lignes qui suivaient restent à leur article (l'intertitre était EN FIN d'article ou hors article)
      promus.push(anchor)
      journal.push({ op: 'promouvoir-intitule', ancre: anchor, avant: op.ligne, apres: `${op.label} (niveau ${niveau}, sous ${parent?.anchor})` })
    } else if (op.type === 'ancienne-numerotation') {
      brut.commentaires = brut.commentaires ?? {}
      // Aucun numéro : le livre n'imprime pas de note pour cet article (la base lui prêtait celle du voisin).
      const texte = !op.numeros.length ? null : op.numeros.length === 1 ? `Ancienne numérotation : article ${op.numeros[0]}.` : `Ancienne numérotation : articles ${op.numeros.slice(0, -1).join(', ')} et ${op.numeros[op.numeros.length - 1]}.`
      const avant = (brut.commentaires[op.ancre] as string[] | undefined) ?? []
      const autres = avant.filter((x) => !/^Ancienne numérotation/.test(x))
      const nouveau = texte ? [...autres, texte] : autres
      if (nouveau.length) brut.commentaires[op.ancre] = nouveau
      else delete brut.commentaires[op.ancre]
      journal.push({ op: 'ancienne-numerotation', ancre: op.ancre, avant: avant.join(' | '), apres: texte ?? '(aucune)' })
    } else if (op.type === 'reclef-commentaires') {
      reclef = true
    }
  }

  if (ESPACES) {
    let n = 0
    lignes = lignes.map((l) => {
      if (l.titre || !l.ancre) return l
      const t = l.t.replace(/[     ]/g, ' ').replace(/ {2,}/g, ' ').replace(/\s+$/, '')
      if (t !== l.t) n++
      return { ...l, t }
    })
    journal.push({ op: 'espaces', apres: `${n} ligne(s)` })
  }

  const apresBody = lignes.map((l) => l.t).join('\n')
  // RE-CLEF : la clé d'un article a changé (intitulé promu avant lui dans sa section) → ses annotations suivent.
  const a1p = parseAnnotations(JSON.stringify(brut))!
  const cles1 = cleDe(apresBody, a1p)
  let reclefees = 0
  for (const champ of ['jurisprudence', 'commentaires']) {
    const src = (brut[champ] ?? {}) as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(src)) {
      const art = k.includes('|') ? k.split('|')[1] : k
      const vieille = k.includes('|') ? k : null
      let nk = k
      if (vieille && cles0.get(art) === vieille && cles1.get(art) && cles1.get(art) !== vieille) nk = cles1.get(art)!
      if (!vieille && reclef && champ === 'commentaires' && cles1.get(art)) nk = cles1.get(art)!
      if (nk !== k) reclefees++
      if (out[nk]) out[nk] = [...(out[nk] as unknown[]), ...(v as unknown[])]
      else out[nk] = v
    }
    brut[champ] = out
  }
  journal.push({ op: 're-clef', apres: `${reclefees} clé(s)` })
  const apresJson = JSON.stringify(brut)
  const a1 = parseAnnotations(apresJson)!

  // ── Garde-fous ──
  const erreurs: string[] = []
  const titresAvant = decouper(avantBody, a0).filter((l) => l.titre).map((l) => norm(l.t))
  const titresApres = decouper(apresBody, a1).filter((l) => l.titre).map((l) => norm(l.t))
  const libPromus = new Set(a1.toc.filter((t) => promus.includes(t.anchor)).map((t) => norm(t.label)))
  if (JSON.stringify(titresAvant) !== JSON.stringify(titresApres.filter((t) => !libPromus.has(t)))) erreurs.push('lignes d’en-tête modifiées')
  if (titresApres.length !== a1.toc.length) erreurs.push(`intitulés reconnus ${titresApres.length} ≠ table ${a1.toc.length}`)
  const blocs = segmentAnnotated(apresBody, a1.toc, a1.pointAnchors, a1.repeatedHeads)
  const sections = blocs.filter((b) => b.kind === 'section').map((b) => b.anchor)
  const sections0 = segmentAnnotated(avantBody, a0.toc, a0.pointAnchors, a0.repeatedHeads).filter((b) => b.kind === 'section').map((b) => b.anchor)
  if (JSON.stringify(sections.filter((x) => !promus.includes(x as string))) !== JSON.stringify(sections0)) erreurs.push('suite des ancres de section modifiée')
  const cles = new Set(blocs.filter((b) => b.kind === 'body' && b.jurisKey).map((b: any) => b.jurisKey))
  const orphJ = Object.keys(a1.jurisprudence ?? {}).filter((k) => !cles.has(k))
  const orphC = Object.keys(a1.commentaires ?? {}).filter((k) => !cles.has(k))
  const orphC0 = Object.keys(a0.commentaires ?? {}).filter((k) => !new Set(cles0.values()).has(k)).length
  if (orphJ.length) erreurs.push(`${orphJ.length} clé(s) de jurisprudence orpheline(s) : ${orphJ.slice(0, 5).join(', ')}`)
  if (orphC.length && (reclef || orphC.length > orphC0)) erreurs.push(`${orphC.length} clé(s) de commentaire orpheline(s) : ${orphC.slice(0, 5).join(', ')}`)
  const menu = new Set<string>()  // intitulés seulement : le menu du CPC porte aussi les articles
  const parcourir = (ns: any[]) => ns.forEach((n) => { if (n.anchor && String(n.anchor).startsWith('sec-')) menu.add(n.anchor); parcourir(n.children ?? []) })
  parcourir(a1.navToc)
  const tocA = new Set(a1.toc.map((t) => t.anchor))
  if (menu.size !== tocA.size || [...menu].some((x) => !tocA.has(x))) erreurs.push('menu ≠ table')
  const ancres = (b: string) => b.split('\n').map((l) => (TETE.test(l.trim()) ? articleAnchorFromHeading(norm(l)) : undefined)).filter(Boolean)
  const anc0 = ancres(avantBody), anc1 = ancres(apresBody)
  if (anc0.length !== anc1.length || anc0.some((x, i) => x !== anc1[i])) erreurs.push(`ancres d'article modifiées (${anc0.length} → ${anc1.length})`)
  const ailleurs = motsLongs(apresBody + ' ' + apresJson)
  const perdus = [...motsLongs(avantBody)].filter((m) => !ailleurs.has(m) && !listeBlanche.has(m))
  if (perdus.length) erreurs.push(`${perdus.length} mot(s) disparu(s) hors liste blanche : ${perdus.slice(0, 12).join(', ')}`)
  const liens = (body: string, a: Annotations) =>
    [...renderToStaticMarkup(<AnnotatedText text={body} annotations={a} locale="fr" linkArtRefs hideInlineIndex />).matchAll(/href="([^"]+)"/g)].map((m) => m[1])
  const l0 = liens(avantBody, a0), l1 = liens(apresBody, a1)
  if (l1.length < l0.length) erreurs.push(`${l0.length - l1.length} lien(s) perdu(s) au rendu (${l0.length} → ${l1.length})`)

  const rapport = { operations: operations.length, espaces: ESPACES, journal, liens: [l0.length, l1.length], commentairesOrphelins: [orphC0, orphC.length], erreurs }
  writeFileSync(join(dossier, `correction-${COMMIT ? 'ecrite' : 'a-blanc'}.json`), JSON.stringify(rapport, null, 1))
  writeFileSync(join(dossier, 'apres-body.txt'), apresBody)
  writeFileSync(join(dossier, 'apres-ann.json'), apresJson)
  console.log(`${operations.length} opération(s), intitulés promus ${promus.length}, clés re-clefées ${reclefees}, commentaires orphelins ${orphC0} → ${orphC.length}, liens ${l0.length} → ${l1.length}`)
  if (erreurs.length) throw new Error('⛔ garde-fous :\n  ' + erreurs.join('\n  ') + '\nrien n’est écrit')
  console.log('✓ garde-fous : tous passés')
  if (!COMMIT) return console.log('(à blanc — --commit pour écrire)')

  await prisma.$transaction(async (tx) => {
    await tx.document.update({ where: { id: ID }, data: { bodyOriginal: apresBody, annotationsJson: apresJson } })
  }, { timeout: 180_000, maxWait: 30_000 })
  await reindexDocument(ID)
  await audit({ action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: ID, meta: { via: 'corriger-cpc-mot-a-mot', operations: operations.length, promus: promus.length, decision: 'audit mot à mot du CPC — Me Vaval' } })
  const relu = await prisma.document.findUniqueOrThrow({ where: { id: ID }, select: { bodyOriginal: true, annotationsJson: true } })
  if (relu.bodyOriginal !== apresBody || relu.annotationsJson !== apresJson) throw new Error('⛔ recompte : la fiche ne porte pas ce qui a été écrit')
  console.log('✅ écrit, réindexé, recompté')
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
