/**
 * CORRECTION DU CODE CIVIL, MOT À MOT ET ALINÉA PAR ALINÉA — étape 6 de
 * docs/prompt-audit-code-civil-mot-a-mot.md. À BLANC par défaut ; `--commit` pour écrire.
 *
 * Entrée : un fichier de corrections VALIDÉES (JSON, hors du dépôt — il cite le texte du livre), produit
 * par la collation (`scripts/collationner-code-civil-*.py`) et relu sur l'image :
 *   { "operations": [ … ] }  — liste FERMÉE de types :
 *   - remplacer          { cible: 'corps'|'version'|'oldVersions', ancre, statutVersion?, avant, apres, nature, preuve }
 *                         `avant` doit figurer UNE fois dans l'article visé (lignes jointes par « \n »)
 *   - deplacer-commentaire { ancre, ligne }        ligne exacte du corps → annotations.commentaires[clé de l'article]
 *   - retirer-ligne      { ancre|null, ligne, motif }   intitulé en double, annexe de l'art. 2047 (liste blanche)
 *   - retirer-intitule   { anchor }                « Section II » nu : table + menu + ligne du corps, ensemble
 *   - supprimer-commentaire { cle, texte }         doublon de renvoi dans commentaires
 *   - abroger            { ancre, etendue: 'article'|'alineas'|'mots', acte, date|null, alineas?, mots?, commentaire?, preuve }
 *                        date null = acte sans date sûre (deux actes, ou acte non précisé) : la version n'en porte pas
 * et `--typographie` : la convention du § 4.1 (tête « Art. N » + espace, apostrophe droite, ni insécable
 * ni cadratin ni double espace, une espace avant « ; » et « : » hors chiffres) sur le texte des articles.
 *
 * Garde-fous (§ 8.5 du prompt) — le script REFUSE d'écrire si l'un échoue :
 *   l'état en base est celui de l'instantané ; les lignes d'en-tête sont inchangées (hors `retirer-intitule`) ;
 *   la suite des ancres de section ne perd que les intitulés retirés ; 0 clé de jurisprudence ou de commentaire
 *   orpheline ; menu = table ; mêmes 2 107 ancres d'article ; rien ne disparaît (mots ≥ 4 lettres, apostrophes
 *   et espaces normalisées) hors liste blanche ; mêmes liens rendus par le lecteur.
 *
 *     npx tsx --tsconfig <tsconfig jsx> scripts/corriger-code-civil-mot-a-mot.tsx <corrections.json> [--typographie] [--commit]
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

const ID = 'cmr4b6f3v0000iz56asjmwrlg'
const prisma = new PrismaClient()
const args = process.argv.slice(2)
const FICHIER = args.find((a) => !a.startsWith('--'))
const COMMIT = args.includes('--commit')
const TYPO = args.includes('--typographie')
const sha = (s: string) => createHash('sha256').update(s).digest('hex')

type Op =
  | { type: 'remplacer'; cible: 'corps' | 'version' | 'oldVersions'; ancre: string; statutVersion?: string; avant: string; apres: string; nature: string; motsRetires?: string[]; preuve?: string }
  | { type: 'ajouter-annotation'; ancre: string; destination: 'commentaires' | 'jurisprudence'; texte: string; dejaPresente?: boolean }
  | { type: 'deplacer-commentaire'; ancre: string; ligne: string; preuve?: string }
  | { type: 'deplacer-jurisprudence'; ancre: string; ligne: string; dejaPresente?: boolean; preuve?: string }
  | { type: 'retirer-ligne'; ancre: string | null; ligne: string; motif: string }
  | { type: 'retirer-intitule'; anchor: string }
  | { type: 'renommer-intitule'; anchor: string; label: string; preuve?: string }
  | { type: 'supprimer-commentaire'; cle: string; texte: string }
  | { type: 'abroger'; ancre: string; etendue: 'article' | 'alineas' | 'mots'; acte: string; date: string | null; alineas?: string[]; mots?: string; commentaire?: string; preuve?: string }

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

// ── Typographie (§ 4.1) ─────────────────────────────────────────────────────────────────────
function typo(ligne: string, estTete: boolean): string {
  let s = ligne.replace(/[     ]/g, ' ').replace(/[’‘]/g, "'")
  if (estTete) s = s.replace(/^(Art\.\s*(?:1er|\d{1,4}(?:-\d{1,2})?))\s*(?:\.\s*—\s*|\s+)/, '$1 ')
  // Exposant ordinal : « 1870-3o » (5 fois) → « 1870-3° », la forme de la base (161 fois) ; le livre imprime « 3º ».
  s = s.replace(/(?<=\d)[oº](?=[\s.,;:)\-–]|$)/g, '°')
  // Séparateur du renvoi : la forme du livre « .- C. civ. » (1 295 fois) ; « . – » (381) et « . - » (309)
  // y reviennent, comme « ;- C. p. c. » dans la liste.
  s = s.replace(/\.\s*[–—-]\s*(?=(?:C\.|c\.|Civ|Const|I\.|T\.))/g, '.- ').replace(/;\s*[–—-]\s*(?=C\.)/g, ';- ')
  // …et le tiret PERDU (267 fois, arts 1700-1999 : « caution. C. civ., 1037 » au lieu de « caution.- C. civ. ») :
  // seulement après un MOT du texte de loi — dans la liste, « 185; C. pén. » n'a pas de tiret au livre.
  s = s.replace(/(?<=[A-Za-zà-ÿœ»)]{2})([.;:])\s+(?=(?:C\.\s*(?:civ|p\.\s*c|pén|com|i\.\s*c)|Civ|Const)\b\.?,?\s*,?\s*\d)/g, '$1- ')
  // Une espace avant « ; » et « : » dans le TEXTE DE LOI seulement (hors chiffres) ; la liste de renvois garde
  // la composition du livre (« 969, 2046; C. pén. »).
  const m = /\.- (?=(?:C\.|c\.|Civ|Const|I\.|T\.))/.exec(s)
  let loi = m ? s.slice(0, m.index + 3) : s
  const renvoi = m ? s.slice(m.index + 3) : ''
  loi = loi.replace(/(?<=[^\s\d])\s*([;:])(?!\d)/g, ' $1')
  s = loi + renvoi
  return s.replace(/ {2,}/g, ' ').replace(/\s+$/, '')
}

// ── Découpage de la base comme le lecteur ────────────────────────────────────────────────────
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
    // Têtes « Art. N » (jusqu'au 19 oct. 2026) puis « Article N » (règle de corpus du 19 oct.) : les deux.
    const an = /^Art(?:\.|icle\s)/.test(s) ? articleAnchorFromHeading(s) : undefined
    if (an) ancre = an
    return { t, titre: false, ancre }
  })
}
const motsLongs = (s: string) => new Set(norm(s.replace(/[’‘]/g, "'")).toLowerCase().match(/[a-zà-ÿœ]{4,}/g) ?? [])

async function main() {
  if (!FICHIER) throw new Error('usage : corriger-code-civil-mot-a-mot.tsx <corrections.json> [--typographie] [--commit]')
  const { operations } = JSON.parse(readFileSync(FICHIER, 'utf8')) as { operations: Op[] }
  const dossier = dirname(FICHIER)
  const empreintes = JSON.parse(readFileSync(join(dossier, 'avant.sha256.json'), 'utf8'))

  const doc = await prisma.document.findUniqueOrThrow({ where: { id: ID }, select: { bodyOriginal: true, annotationsJson: true } })
  const versions = await prisma.articleVersion.findMany({ where: { documentId: ID }, orderBy: [{ anchor: 'asc' }, { seq: 'asc' }] })
  // ⚠️ La base doit être celle qu'on a collationnée : sinon les corrections visent un autre texte.
  if (sha(doc.bodyOriginal ?? '') !== empreintes.bodyOriginal || sha(doc.annotationsJson ?? '') !== empreintes.annotationsJson)
    throw new Error("⛔ la fiche a changé depuis l'instantané de l'audit — refaire la collation, rien n'est écrit")

  const avantBody = doc.bodyOriginal ?? ''
  const a0 = parseAnnotations(doc.annotationsJson)!
  const brut = JSON.parse(doc.annotationsJson!) as Record<string, any>
  let lignes = decouper(avantBody, a0)
  const vers = versions.map((v) => ({ ...v }))
  const journal: { op: string; ancre?: string | null; avant?: string; apres?: string }[] = []
  const listeBlanche = new Set<string>()
  const nouvellesVersions: any[] = []
  const tocRetires = new Set<string>()
  const renommes = new Map<string, string>() // ancien libellé normalisé → nouveau libellé

  const lignesArticle = (ancre: string) => lignes.map((l, i) => ({ ...l, i })).filter((l) => l.ancre === ancre && !l.titre)
  // ⚠️ 179 des 189 anciennes rédactions (MODIFIE, ABROGE) sont IDENTIQUES, au caractère près, au texte de
  // l'article dans le corps : leurs défauts sont communs. On corrige le corps, et la correction est REPORTÉE
  // sur les versions qui lui étaient identiques (fin de traitement) ; les autres se corrigent par `cible: version`.
  const jumelles = new Map<string, string[]>() // ancre → ids des versions identiques au corps
  for (const v of vers)
    if ((v.status === 'MODIFIE' || v.status === 'ABROGE') && v.body === lignesArticle(v.anchor).map((l) => l.t).join('\n'))
      jumelles.set(v.anchor, [...(jumelles.get(v.anchor) ?? []), v.id])

  for (const op of operations) {
    if (op.type === 'remplacer') {
      if (op.cible === 'corps') {
        const ls = lignesArticle(op.ancre)
        const texte = ls.map((l) => l.t).join('\n')
        const n = texte.split(op.avant).length - 1
        if (n !== 1) throw new Error(`⛔ ${op.ancre} : « ${op.avant.slice(0, 50)} » trouvé ${n} fois dans le corps`)
        const nouv = texte.replace(op.avant, op.apres).split('\n')
        const debut = ls[0].i
        lignes.splice(debut, ls.length, ...nouv.map((t) => ({ t, titre: false, ancre: op.ancre })))
      } else if (op.cible === 'version') {
        const v = vers.find((x) => x.anchor === op.ancre && x.status === op.statutVersion)
        if (!v) throw new Error(`⛔ ${op.ancre} : pas de version ${op.statutVersion}`)
        const n = v.body.split(op.avant).length - 1
        if (n !== 1) throw new Error(`⛔ ${op.ancre}/${op.statutVersion} : « ${op.avant.slice(0, 50)} » trouvé ${n} fois`)
        v.body = v.body.replace(op.avant, op.apres)
      } else {
        const t = brut.oldVersions?.[op.ancre] as string | undefined
        if (!t || t.split(op.avant).length - 1 !== 1) throw new Error(`⛔ ${op.ancre}/oldVersions : « ${op.avant.slice(0, 50)} » introuvable ou multiple`)
        brut.oldVersions[op.ancre] = t.replace(op.avant, op.apres)
      }
      if (['ocr', 'coquille-du-livre', 'cesure', 'renvoi', 'ponctuation', 'casse-accent'].includes(op.nature))
        for (const m of motsLongs(op.avant)) listeBlanche.add(m)
      // Collation sur l'image : seuls les mots retirés JUSTIFIÉS un à un par le convertisseur (faute de lecture
      // corrigée, intrus déplacé ou supprimé) entrent en liste blanche.
      if (op.nature === 'collation') for (const m of op.motsRetires ?? []) for (const x of motsLongs(m)) listeBlanche.add(x)
      journal.push({ op: `remplacer:${op.cible}:${op.nature}`, ancre: op.ancre, avant: op.avant, apres: op.apres })
    } else if (op.type === 'deplacer-commentaire' || op.type === 'retirer-ligne' || op.type === 'deplacer-jurisprudence') {
      const cands = lignes.map((l, i) => ({ ...l, i })).filter((l) => !l.titre && norm(l.t) === norm(op.ligne) && (op.ancre === null || l.ancre === op.ancre))
      if (cands.length !== 1) throw new Error(`⛔ ${op.type} ${op.ancre} : ligne trouvée ${cands.length} fois — « ${op.ligne.slice(0, 60)} »`)
      lignes.splice(cands[0].i, 1)
      if (op.type === 'deplacer-commentaire' || op.type === 'deplacer-jurisprudence') {
        const bloc = segmentAnnotated(avantBody, a0.toc, a0.pointAnchors, a0.repeatedHeads).find((b) => b.kind === 'body' && b.anchor === op.ancre && b.jurisKey)
        if (!bloc || bloc.kind !== 'body' || !bloc.jurisKey) throw new Error(`⛔ ${op.ancre} : clé d'annotation introuvable`)
        if (op.type === 'deplacer-commentaire') {
          brut.commentaires = brut.commentaires ?? {}
          brut.commentaires[bloc.jurisKey] = [...(brut.commentaires[bloc.jurisKey] ?? []), norm(op.ligne)]
        } else if (!op.dejaPresente) {
          // Note de jurisprudence lue dans le corps : elle rejoint l'appareil de l'article, sous sa clé.
          brut.jurisprudence = brut.jurisprudence ?? {}
          brut.jurisprudence[bloc.jurisKey] = [...(brut.jurisprudence[bloc.jurisKey] ?? []), { ref: '', excerpt: norm(op.ligne) }]
        } else for (const m of motsLongs(op.ligne)) listeBlanche.add(m) // déjà dans l'appareil : le doublon du corps part
      } else for (const m of motsLongs(op.ligne)) listeBlanche.add(m)
      journal.push({ op: op.type, ancre: op.ancre, avant: op.ligne })
    } else if (op.type === 'ajouter-annotation') {
      if (!op.dejaPresente) {
        const bloc = segmentAnnotated(avantBody, a0.toc, a0.pointAnchors, a0.repeatedHeads).find((b) => b.kind === 'body' && b.anchor === op.ancre && b.jurisKey)
        if (!bloc || bloc.kind !== 'body' || !bloc.jurisKey) throw new Error(`⛔ ${op.ancre} : clé d'annotation introuvable`)
        if (op.destination === 'commentaires') {
          brut.commentaires = brut.commentaires ?? {}
          brut.commentaires[bloc.jurisKey] = [...(brut.commentaires[bloc.jurisKey] ?? []), norm(op.texte)]
        } else {
          brut.jurisprudence = brut.jurisprudence ?? {}
          brut.jurisprudence[bloc.jurisKey] = [...(brut.jurisprudence[bloc.jurisKey] ?? []), { ref: '', excerpt: norm(op.texte) }]
        }
      }
      journal.push({ op: `ajouter-annotation:${op.destination}${op.dejaPresente ? ' (déjà présente)' : ''}`, ancre: op.ancre, apres: op.texte })
    } else if (op.type === 'renommer-intitule') {
      // Libellé d'intitulé faux (§ 6.4) : table, menu et ligne du corps changent ENSEMBLE, à l'identique,
      // sans changer d'ordre ni d'ancre — le lecteur reconnaît l'intitulé à l'égalité ligne = libellé.
      const t = brut.toc.find((x: any) => x.anchor === op.anchor)
      if (!t) throw new Error(`⛔ intitulé ${op.anchor} introuvable`)
      const ancien = t.label as string
      const li = lignes.findIndex((l) => l.titre && norm(l.t) === norm(ancien))
      if (li < 0) throw new Error(`⛔ ligne de l'intitulé ${op.anchor} introuvable`)
      lignes[li] = { ...lignes[li], t: op.label }
      t.label = op.label
      const renommer = (ns: any[]) => ns.forEach((x) => { if (x.anchor === op.anchor) x.label = op.label; renommer(x.children ?? []) })
      renommer(brut.navToc)
      renommes.set(norm(ancien), op.label)
      for (const m of motsLongs(ancien)) listeBlanche.add(m)
      journal.push({ op: 'renommer-intitule', ancre: op.anchor, avant: ancien, apres: op.label })
    } else if (op.type === 'retirer-intitule') {
      const i = brut.toc.findIndex((t: any) => t.anchor === op.anchor)
      if (i < 0) throw new Error(`⛔ intitulé ${op.anchor} introuvable`)
      const label = norm(brut.toc[i].label)
      const cles = [...Object.keys(brut.jurisprudence ?? {}), ...Object.keys(brut.commentaires ?? {})].filter((k) => k.startsWith(op.anchor + '|'))
      if (cles.length) throw new Error(`⛔ ${op.anchor} porte ${cles.length} clé(s) d'annotation — à migrer d'abord`)
      const li = lignes.findIndex((l) => l.titre && norm(l.t) === label)
      if (li < 0) throw new Error(`⛔ ligne de l'intitulé ${op.anchor} introuvable`)
      lignes.splice(li, 1)
      brut.toc.splice(i, 1)
      const purger = (ns: any[]): any[] => ns.filter((n) => n.anchor !== op.anchor).map((n) => ({ ...n, children: n.children ? purger(n.children) : n.children }))
      brut.navToc = purger(brut.navToc)
      tocRetires.add(op.anchor)
      for (const m of motsLongs(label)) listeBlanche.add(m)
      journal.push({ op: 'retirer-intitule', ancre: op.anchor, avant: label })
    } else if (op.type === 'supprimer-commentaire') {
      const arr = brut.commentaires?.[op.cle] as string[] | undefined
      const k = arr?.findIndex((x) => norm(x) === norm(op.texte)) ?? -1
      if (!arr || k < 0) throw new Error(`⛔ commentaire ${op.cle} introuvable`)
      arr.splice(k, 1)
      if (!arr.length) delete brut.commentaires[op.cle]
      journal.push({ op: 'supprimer-commentaire', ancre: op.cle, avant: op.texte })
    } else if (op.type === 'abroger') {
      if (brut.status?.[op.ancre]) throw new Error(`⛔ ${op.ancre} porte déjà un statut (« ${brut.status[op.ancre]} »)`)
      const texte = lignesArticle(op.ancre).map((l) => l.t).join('\n')
      if (!texte) throw new Error(`⛔ ${op.ancre} : article introuvable`)
      const label = 'Article ' + op.ancre.replace(/^art-/, '').replace('-', '-')
      const date = op.date ? new Date(op.date + 'T00:00:00Z') : null
      brut.status = brut.status ?? {}
      if (op.etendue === 'article') {
        nouvellesVersions.push({ documentId: ID, anchor: op.ancre, label, body: texte, status: 'ABROGE', effectiveDate: date, amendedByNumber: op.acte, origin: 'MANUAL', seq: 0, note: op.preuve ?? null })
        brut.status[op.ancre] = 'abrogé'
      } else if (op.etendue === 'alineas') {
        const garder = texte.split('\n').filter((l) => !(op.alineas ?? []).some((x) => norm(x) === norm(l)))
        if (garder.length !== texte.split('\n').length - (op.alineas ?? []).length) throw new Error(`⛔ ${op.ancre} : alinéa(s) abrogé(s) introuvable(s)`)
        // 1er alinéa abrogé : la rédaction en vigueur garde la tête « Art. N »
        const tete = /^Art\.\s*(?:1er|\d{1,4}(?:-\d{1,2})?)\s/.exec(texte)?.[0]
        if (tete && !garder[0].startsWith(tete.trim())) garder[0] = tete + garder[0]
        nouvellesVersions.push({ documentId: ID, anchor: op.ancre, label, body: texte, status: 'MODIFIE', origin: 'MANUAL', seq: 0 })
        nouvellesVersions.push({ documentId: ID, anchor: op.ancre, label, body: garder.join('\n'), status: 'EN_VIGUEUR', effectiveDate: date, amendedByNumber: op.acte, origin: 'MANUAL', seq: 1, note: op.preuve ?? null })
        brut.status[op.ancre] = 'partiellement abrogé'
      } else {
        brut.status[op.ancre] = 'partiellement abrogé'
        const bloc = segmentAnnotated(avantBody, a0.toc, a0.pointAnchors, a0.repeatedHeads).find((b) => b.kind === 'body' && b.anchor === op.ancre && b.jurisKey)
        if (!bloc || bloc.kind !== 'body' || !bloc.jurisKey) throw new Error(`⛔ ${op.ancre} : clé d'annotation introuvable`)
        brut.commentaires = brut.commentaires ?? {}
        brut.commentaires[bloc.jurisKey] = [...(brut.commentaires[bloc.jurisKey] ?? []), op.commentaire ?? `Abrogés par ${op.acte} : ${op.mots}.`]
      }
      journal.push({ op: `abroger:${op.etendue}`, ancre: op.ancre, apres: op.acte })
    }
  }

  if (TYPO) {
    let n = 0
    lignes = lignes.map((l) => {
      if (l.titre || !l.ancre) return l
      const t = typo(l.t, /^Art\./.test(l.t.trim()))
      if (t !== l.t) n++
      return { ...l, t }
    })
    for (const v of vers) {
      const b = v.body.split('\n').map((x, i) => typo(x, i === 0)).join('\n')
      if (b !== v.body) { v.body = b; n++ }
    }
    for (const nv of nouvellesVersions) nv.body = nv.body.split('\n').map((x: string, i: number) => typo(x, i === 0)).join('\n')
    for (const k of Object.keys(brut.oldVersions ?? {})) {
      const b = (brut.oldVersions[k] as string).split('\n').map((x) => typo(x, false)).join('\n')
      if (b !== brut.oldVersions[k]) { brut.oldVersions[k] = b; n++ }
    }
    journal.push({ op: 'typographie', apres: `${n} ligne(s) ou version(s)` })
  }

  // Report sur les anciennes rédactions jumelles du corps.
  let reportees = 0
  for (const [ancre, ids] of jumelles) {
    const texte = lignesArticle(ancre).map((l) => l.t).join('\n')
    for (const id of ids) {
      const v = vers.find((x) => x.id === id)!
      if (v.body !== texte) { v.body = texte; reportees++ }
    }
  }
  journal.push({ op: 'report-versions-jumelles', apres: `${reportees} version(s)` })
  const apresBody = lignes.map((l) => l.t).join('\n')
  const apresJson = JSON.stringify(brut)
  const a1 = parseAnnotations(apresJson)!

  // ── Garde-fous ──
  const erreurs: string[] = []
  const titresAvant = decouper(avantBody, a0).filter((l) => l.titre).map((l) => l.t)
  const titresApres = decouper(apresBody, a1).filter((l) => l.titre).map((l) => l.t)
  const retires = new Set([...tocRetires].map((an) => norm(a0.toc.find((t) => t.anchor === an)!.label)))
  const attendus = titresAvant.filter((t) => !retires.has(norm(t))).map((t) => renommes.get(norm(t)) ?? t)
  if (JSON.stringify(attendus) !== JSON.stringify(titresApres)) erreurs.push('lignes d’en-tête modifiées')
  const blocs = segmentAnnotated(apresBody, a1.toc, a1.pointAnchors, a1.repeatedHeads)
  const sections = blocs.filter((b) => b.kind === 'section').map((b) => b.anchor)
  const sectionsAttendues = segmentAnnotated(avantBody, a0.toc, a0.pointAnchors, a0.repeatedHeads).filter((b) => b.kind === 'section').map((b) => b.anchor).filter((x) => !tocRetires.has(x))
  if (JSON.stringify(sections) !== JSON.stringify(sectionsAttendues)) erreurs.push('suite des ancres de section modifiée')
  const cles = new Set(blocs.filter((b) => b.kind === 'body' && b.jurisKey).map((b: any) => b.jurisKey))
  const orph = [...Object.keys(a1.jurisprudence ?? {}), ...Object.keys(a1.commentaires ?? {})].filter((k) => !cles.has(k))
  if (orph.length) erreurs.push(`${orph.length} clé(s) d'annotation orpheline(s) : ${orph.slice(0, 5).join(', ')}`)
  const menu = new Set<string>()
  const parcourir = (ns: any[]) => ns.forEach((n) => { if (n.anchor) menu.add(n.anchor); parcourir(n.children ?? []) })
  parcourir(a1.navToc)
  const tocA = new Set(a1.toc.map((t) => t.anchor))
  if (menu.size !== tocA.size || [...menu].some((x) => !tocA.has(x))) erreurs.push('menu ≠ table')
  const ancres = (b: string) => b.split('\n').map((l) => (/^Art\./.test(l.trim()) ? articleAnchorFromHeading(norm(l)) : undefined)).filter(Boolean)
  const anc0 = ancres(avantBody), anc1 = ancres(apresBody)
  if (anc0.length !== anc1.length || anc0.some((x, i) => x !== anc1[i])) erreurs.push(`ancres d'article modifiées (${anc0.length} → ${anc1.length})`)
  const ailleurs = motsLongs(apresBody + ' ' + apresJson + ' ' + nouvellesVersions.map((v) => v.body).join(' '))
  const perdus = [...motsLongs(avantBody)].filter((m) => !ailleurs.has(m) && !listeBlanche.has(m))
  if (perdus.length) erreurs.push(`${perdus.length} mot(s) disparu(s) hors liste blanche : ${perdus.slice(0, 12).join(', ')}`)
  // Liens rendus par le lecteur : mêmes destinations avant et après (la typographie ne doit casser aucun renvoi).
  const liens = (body: string, a: Annotations) =>
    [...renderToStaticMarkup(<AnnotatedText text={body} annotations={a} locale="fr" linkCivRefs ownCode="civil" linkArtRefs hideInlineIndex />).matchAll(/href="([^"]+)"/g)]
      .map((m) => m[1]).filter((h) => !h.startsWith('#hist-') && !h.startsWith('#anc-')).sort()
  const l0 = liens(avantBody, a0), l1 = liens(apresBody, a1)
  const diffLiens = l0.length - l1.length
  if (diffLiens > 0) erreurs.push(`${diffLiens} lien(s) de renvoi perdu(s) au rendu (${l0.length} → ${l1.length})`)

  const rapport = { operations: operations.length, typographie: TYPO, journal, nouvellesVersions: nouvellesVersions.length, liens: [l0.length, l1.length], erreurs }
  writeFileSync(join(dossier, `correction-${COMMIT ? 'ecrite' : 'a-blanc'}.json`), JSON.stringify(rapport, null, 1))
  writeFileSync(join(dossier, 'apres-body.txt'), apresBody)
  console.log(`${operations.length} opération(s), typographie ${TYPO ? 'oui' : 'non'}, ${nouvellesVersions.length} version(s) créée(s), liens ${l0.length} → ${l1.length}`)
  if (erreurs.length) throw new Error('⛔ garde-fous :\n  ' + erreurs.join('\n  ') + '\nrien n’est écrit')
  console.log('✓ garde-fous : tous passés')
  if (!COMMIT) return console.log('(à blanc — --commit pour écrire)')

  await prisma.$transaction(async (tx) => {
    await tx.document.update({ where: { id: ID }, data: { bodyOriginal: apresBody, annotationsJson: apresJson } })
    for (const v of vers) {
      const orig = versions.find((x) => x.id === v.id)!
      if (orig.body !== v.body) await tx.articleVersion.update({ where: { id: v.id }, data: { body: v.body } })
    }
    for (const nv of nouvellesVersions) await tx.articleVersion.create({ data: nv })
  }, { timeout: 180_000 })
  await reindexDocument(ID)
  await audit({ action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: ID, meta: { via: 'corriger-code-civil-mot-a-mot', operations: operations.length, typographie: TYPO, versionsCreees: nouvellesVersions.length, decision: 'audit mot à mot — Me Vaval' } })
  const relu = await prisma.document.findUniqueOrThrow({ where: { id: ID }, select: { bodyOriginal: true, annotationsJson: true } })
  if (relu.bodyOriginal !== apresBody || relu.annotationsJson !== apresJson) throw new Error('⛔ recompte : la fiche ne porte pas ce qui a été écrit')
  console.log('✅ écrit, réindexé, recompté')
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
