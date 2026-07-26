/**
 * LOI N° 002-2018 (statut du commerçant) → CODE DE COMMERCE annoté (Vandal).
 *
 * L'article 1er de la loi RECOMPOSE le Titre 1er du Livre premier :
 *   - le Titre est RE-TITRÉ « Des Commerçants, des Actes de Commerce et du Registre du
 *     Commerce » (ancre sec-2 conservée → clés de jurisprudence stables) ;
 *   - les ANCIENS articles 1er à 8 sont abrogés-remplacés — patron Loi Filiation (consigne
 *     cliente) : « [Abrogé — Loi N° 002-2018…] », pastille, ANCIENNE VERSION REPLIÉE avec la
 *     jurisprudence Vandal d'époque (arts 1 : 3 arrêts ; 2 : 12 arrêts), note connexe
 *     cliquable vers la loi ;
 *   - 65 articles NOUVEAUX insérés (1000-1 sous le Livre premier ; 1111-1 à 1137-2 sous
 *     3 chapitres / 9 sections dont les intitulés proviennent VERBATIM de la loi téléversée).
 *
 * Textes et intitulés extraits de scripts/data/loi-statut-commercant-2018/bodyOriginal.txt
 * (règle défaut-inclure jusqu'à borne + SENTINELLES anti-circularité).
 * Sauvegarde préalable backup-before-ccom.json. Idempotent.
 *   npx tsx scripts/_apply-loi-statut-commercant-ccom.ts
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { abrogateArticle } from '../src/lib/legislation/amendments'
import { splitArticles } from '../src/lib/legislation/segment'
import { segmentAnnotated, type Annotations, type TocEntry, type AnnBlock } from '../src/lib/legislation/annotated'
import { reindexDocument } from '../src/lib/search/reindex'

type BodyBlock = Extract<AnnBlock, { kind: 'body' }>
const DIR = 'scripts/data/loi-statut-commercant-2018'
const REF = 'Loi N° 002-2018 du 23 avril 2018 (Le Moniteur, Spécial n° 5 du 21 mai 2018)'
const REF_COURT = 'L. du 23 avril 2018'
const MONITEUR = 'Le Moniteur, Spécial n° 5 du 21 mai 2018'
const TITLE_LOI = 'Loi portant Réforme du statut du commerçant et des actes de commerce et organisant le registre du Commerce'
const OLD_ARTS = ['1', '2', '3', '4', '5', '6', '7', '8']
const SERIES: [string, number][] = [['1111', 4], ['1112', 9], ['1120', 13], ['1131', 2], ['1132', 4], ['1133', 9], ['1134', 3], ['1135', 3], ['1136', 15], ['1137', 2]]
const NEW_ARTS = ['1000-1', ...SERIES.flatMap(([p, n]) => Array.from({ length: n }, (_, i) => `${p}-${i + 1}`))]

async function main() {
  const ccom = await prisma.document.findFirst({ where: { source: 'CODE_COMMERCE_ANNOTE' } })
  const loi = await prisma.document.findFirst({ where: { source: 'LOI_STATUT_COMMERCANT_2018' }, select: { id: true } })
  if (!ccom?.bodyOriginal || !ccom.annotationsJson || !loi) throw new Error('Code de commerce ou Loi 002-2018 introuvable')
  const ann = JSON.parse(ccom.annotationsJson) as Annotations & Record<string, any>
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

  // ── Textes cités : extraits du corps de la LOI (défaut-inclure jusqu'à borne) ──
  const lLines = readFileSync(`${DIR}/bodyOriginal.txt`, 'utf8').split('\n')
  const BOUND = /^(?:Article\s|CHAPITRE\b|TITRE\b|SECTION\b|CODE DE COMMERCE\b|Donné\b|AU NOM\b|Par le Président)/
  const quoted = new Map<string, string[]>()
  for (let i = 0; i < lLines.length; i++) {
    const m = lLines[i].match(/^Article\s+(\d{4}(?:-\d{1,2})?)\s*\.\-\s*(.*)$/)
    if (!m || !NEW_ARTS.includes(m[1])) continue
    const buf = [m[2].trim()]
    for (let j = i + 1; j < lLines.length; j++) {
      const l = lLines[j].trim()
      if (!l || BOUND.test(l)) break
      buf.push(l)
    }
    quoted.set(m[1], buf)
  }
  const miss = NEW_ARTS.filter((n) => !quoted.get(n)?.join('').trim())
  if (miss.length) throw new Error(`textes introuvables/vides : ${miss.join(', ')}`)
  // SENTINELLES (choisies dans le Moniteur, indépendantes de l'extraction)
  const SENT: [string, string][] = [
    ['1111-2', 'en vue de leur revente'], ['1112-2', 'sauf s’il est émancipé'],
    ['1120-1', 'cinq (5) ans'], ['1135-2', 'quarante-huit (48) heures'],
    ['1137-2', 'articles 1332-1 et 1332-2'], ['1133-6', 'trois (3) mois'],
    ['1112-5', 'huissier, encanteur public, notaire'],
  ]
  for (const [n, s] of SENT) if (!quoted.get(n)!.join(' ').includes(s)) throw new Error(`sentinelle absente du bloc ${n} : « ${s} »`)
  console.log(`✓ ${quoted.size} textes extraits de la loi · ${SENT.length} sentinelles ✓`)

  // Intitulés des chapitres/sections : VERBATIM depuis la toc de la loi téléversée.
  const annLoi = JSON.parse(readFileSync(`${DIR}/annotations.json`, 'utf8'))
  const heads = (annLoi.toc as TocEntry[]).filter((t) => /^(CHAPITRE|SECTION)\s+[IVX]+ — /.test(t.label)).map((t) => t.label)
  if (heads.length !== 12) throw new Error(`12 intitulés attendus (3 chapitres + 9 sections) : ${heads.length}`)
  const chI = heads.find((h) => h.startsWith('CHAPITRE I — '))!
  const sDef = heads.find((h) => /^SECTION I — DE LA DÉFINITION/.test(h))!
  const sCap = heads.find((h) => h.startsWith('SECTION II — DE LA CAPACITÉ'))!
  const chII = heads.find((h) => h.startsWith('CHAPITRE II — '))!
  const chIII = heads.find((h) => h.startsWith('CHAPITRE III — '))!
  const sReg = ['SECTION I — DES MISSIONS', 'SECTION II — DE L’ORGANISATION', 'SECTION III — DES CONDITIONS', 'SECTION IV — DES EFFETS', 'SECTION V — DU FICHIER', 'SECTION VI — DE L’INFORMATION', 'SECTION VII — DU CONTENTIEUX']
    .map((p) => heads.find((h) => h.startsWith(p))!)
  if ([chI, sDef, sCap, chII, chIII, ...sReg].some((h) => !h)) throw new Error('intitulé manquant dans la toc de la loi')
  const NEW_TITRE = 'Titre Premier — Des Commerçants, des Actes de Commerce et du Registre du Commerce'

  // ── SAUVEGARDE ──
  if (!existsSync(`${DIR}/backup-before-ccom.json`)) {
    const avs0 = await prisma.articleVersion.findMany({ where: { documentId: ccom.id } })
    writeFileSync(`${DIR}/backup-before-ccom.json`, JSON.stringify({ id: ccom.id, bodyOriginal: ccom.bodyOriginal, annotationsJson: ccom.annotationsJson, articleVersions: avs0 }, null, 1))
    console.log('✓ sauvegarde écrite')
  } else console.log('✓ sauvegarde déjà présente (conservée)')

  // ── Snapshots des anciens articles (bornés par la toc actuelle) ──
  const tocLabels0 = new Set(ann.toc.map((t) => norm(t.label)))
  const orig = new Map<string, string>()
  for (const seg of splitArticles(ccom.bodyOriginal, (l) => tocLabels0.has(norm(l)))) if (seg.anchor && !orig.has(seg.anchor)) orig.set(seg.anchor, seg.lines.join('\n'))
  for (const n of OLD_ARTS) if (!orig.has(`art-${n}`)) throw new Error(`art. ${n} introuvable`)

  // ── ÉDITION DU CORPS ──
  let lines = ccom.bodyOriginal.split('\n')
  const already = lines.some((l) => l.startsWith('Art. 1000-1 '))
  const artBlock = (n: string): string[] => {
    const [h, ...r] = quoted.get(n)!
    return [`Art. ${n} (${REF_COURT}) ${h}`, ...r]
  }
  if (!already) {
    const lineOfToc = (anchor: string): number => {
      const label = ann.toc.find((t) => t.anchor === anchor)?.label
      const i = lines.findIndex((l) => norm(l) === norm(label ?? ' '))
      if (i < 0) throw new Error(`ligne toc ${anchor} introuvable`)
      return i
    }
    const i2 = lineOfToc('sec-2') // Titre Premier
    const i3 = lineOfToc('sec-3') // Titre II (borne de fin)
    lines[i2] = NEW_TITRE
    const series = (p: string, n: number) => Array.from({ length: n }, (_, i) => `${p}-${i + 1}`).flatMap(artBlock)
    const NEW_BODY = [
      chI, sDef, ...series('1111', 4), sCap, ...series('1112', 9),
      chII, ...series('1120', 13),
      chIII, sReg[0], ...series('1131', 2), sReg[1], ...series('1132', 4), sReg[2], ...series('1133', 9),
      sReg[3], ...series('1134', 3), sReg[4], ...series('1135', 3), sReg[5], ...series('1136', 15), sReg[6], ...series('1137', 2),
    ]
    // De bas en haut : structure avant Titre II, puis Art. 1000-1 avant le (nouveau) Titre Premier.
    lines.splice(i3, 0, ...NEW_BODY)
    lines.splice(i2, 0, ...artBlock('1000-1'))
    console.log(`✓ corps : Titre re-titré · Art. 1000-1 + ${NEW_BODY.length} lignes insérées`)
  } else console.log('✓ corps déjà édité (relance)')
  const newBody = lines.join('\n')

  // ── NOUVELLE TOC (ancres neuves sec-107+) ──
  const maxSec = Math.max(...ann.toc.map((t) => Number((t.anchor.match(/^sec-(\d+)$/) ?? [])[1] ?? 0)))
  let next = maxSec
  const existingNew = new Map((ann.toc as TocEntry[]).map((t) => [norm(t.label), t]))
  const mk = (label: string, level: number, kind: string): TocEntry => existingNew.get(norm(label)) ?? { label, level, anchor: `sec-${++next}`, kind }
  const mintedHere = (a: string) => { const m = a.match(/^sec-(\d+)$/); return !!m && Number(m[1]) > maxSecOriginal }
  const maxSecOriginal = 106
  const newToc: TocEntry[] = []
  for (const t of ann.toc as TocEntry[]) {
    if (mintedHere(t.anchor)) continue
    if (t.anchor === 'sec-2') {
      newToc.push({ ...t, label: NEW_TITRE },
        mk(chI, 3, 'chapitre'), mk(sDef, 4, 'section'), mk(sCap, 4, 'section'),
        mk(chII, 3, 'chapitre'),
        mk(chIII, 3, 'chapitre'), ...sReg.map((s) => mk(s, 4, 'section')))
      continue
    }
    newToc.push(t)
  }
  // ── Vérification de segmentation AVANT écriture ──
  const blocks = segmentAnnotated(newBody, newToc)
  const secs = blocks.filter((b) => b.kind === 'section').length
  const anchors = new Set(blocks.filter((b): b is BodyBlock => b.kind === 'body').filter((b) => b.anchor).map((b) => b.anchor as string))
  if (secs !== newToc.length) throw new Error(`segmentation ${secs}/${newToc.length} — ANNULÉ`)
  if (anchors.size !== 644 + 65) throw new Error(`ancres ${anchors.size} ≠ 709 — ANNULÉ`)
  for (const n of NEW_ARTS) if (!anchors.has(`art-${n}`)) throw new Error(`ancre art-${n} absente — ANNULÉ`)
  console.log(`✓ segmentation projetée : ${secs}/${newToc.length} en-têtes · 709 ancres (644 + 65)`)

  // ── navToc : nœud du Titre Premier reconstruit ──
  const patch = (items: any[]): boolean => {
    for (const it of items) {
      if (it.anchor === 'sec-2') {
        it.label = NEW_TITRE
        const secAnchor = (l: string) => newToc.find((t) => norm(t.label) === norm(l))!.anchor
        it.children = [
          { label: chI, anchor: secAnchor(chI), children: [sDef, sCap].map((s) => ({ label: s, anchor: secAnchor(s) })) },
          { label: chII, anchor: secAnchor(chII) },
          { label: chIII, anchor: secAnchor(chIII), children: sReg.map((s) => ({ label: s, anchor: secAnchor(s) })) },
        ]
        return true
      }
      if (it.children?.length && patch(it.children)) return true
    }
    return false
  }
  if (!patch(ann.navToc)) throw new Error('nœud sec-2 introuvable dans navToc')

  // ── Anciens articles 1-8 : abrogés-remplacés (patron Filiation) ──
  await prisma.articleVersion.deleteMany({ where: { documentId: ccom.id, anchor: { in: OLD_ARTS.map((n) => `art-${n}`) }, amendedByNumber: REF } })
  ann.status = ann.status ?? {}; ann.oldVersions = ann.oldVersions ?? {}; ann.labels = ann.labels ?? {}
  const connexe = (ann.connexe = ann.connexe ?? {}) as Record<string, { label?: string; text: string; docId?: string; anchor?: string }[]>
  const juris = (ann.jurisprudence ?? {}) as Record<string, { ref?: string; excerpt?: string }[]>
  const comms = (ann.commentaires ?? {}) as Record<string, string[]>
  const jurisText = (n: string): string => {
    const parts: string[] = []
    for (const k of Object.keys(juris)) if (k.endsWith(`|art-${n}`)) { for (const c of juris[k]) parts.push([c.ref, c.excerpt].filter(Boolean).join(' — ')); delete juris[k] }
    for (const k of Object.keys(comms)) if (k.endsWith(`|art-${n}`)) { parts.push(...comms[k]); delete comms[k] }
    return parts.length ? `\n\nJurisprudence et notes sous l’ancien texte :\n${parts.map((p) => `• ${p}`).join('\n')}` : ''
  }
  const setConnexe = (a: string, text: string, anchor: string) => {
    const arr = (connexe[a] = connexe[a] ?? [])
    const ex = arr.find((b) => b.docId === loi.id)
    if (ex) { ex.text = text; ex.anchor = anchor; ex.label = `${TITLE_LOI} (${MONITEUR})` }
    else arr.push({ label: `${TITLE_LOI} (${MONITEUR})`, text, docId: loi.id, anchor })
  }
  for (const n of OLD_ARTS) {
    const a = `art-${n}`
    await abrogateArticle({ documentId: ccom.id, anchor: a, label: ann.labels[a] ?? `Article ${n}`, originalBody: orig.get(a)!, amendedByDocId: loi.id, amendedByNumber: REF, effectiveDate: new Date('2018-05-21') })
    ann.status[a] = 'abrogé'
    if (!ann.oldVersions[a]) ann.oldVersions[a] = orig.get(a)! + jurisText(n)
    setConnexe(a, `Remplacé : le Titre premier du Livre premier a été recomposé par l’article 1er de la Loi N° 002-2018 (nouveaux articles 1000-1 et 1111-1 à 1137-2) — ${MONITEUR}.`, 'art-1')
  }
  console.log(`✓ ${OLD_ARTS.length} anciens articles abrogés-remplacés (pastille + ancienne version repliée + jurisprudence d'époque)`)
  for (const n of NEW_ARTS) {
    const a = `art-${n}`
    ann.labels[a] = `Article ${n}`
    ann.status[a] = 'nouveau'
    setConnexe(a, `Ajouté par l’article 1er de la Loi N° 002-2018 — ${MONITEUR}.`, a)
  }
  console.log(`✓ ${NEW_ARTS.length} articles nouveaux (pastille + note connexe cliquable)`)

  // ── Index maître : sujets de la réforme ──
  const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const idxLoi = JSON.parse(readFileSync(`${DIR}/annotations.json`, 'utf8')).indexEntries as { subject: string; ctRefs: (string | number)[] }[]
  let created = 0, merged = 0
  for (const e of idxLoi) {
    const ex = ann.indexEntries.find((x: any) => fold(x.subject) === fold(e.subject))
    if (ex) { ex.ctRefs = [...new Set([...(ex.ctRefs ?? []), ...e.ctRefs])]; merged++ }
    else { ann.indexEntries.push({ subject: e.subject, ctRefs: e.ctRefs }); created++ }
  }
  ann.indexEntries.sort((a: any, b: any) => fold(a.subject).localeCompare(fold(b.subject)))
  console.log(`✓ index maître : ${created} sujets créés, ${merged} enrichis`)

  ann.toc = newToc
  await prisma.document.update({ where: { id: ccom.id }, data: { bodyOriginal: newBody, annotationsJson: JSON.stringify(ann) } })
  await reindexDocument(ccom.id)
  console.log('✓ Code de commerce écrit + réindexé')
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
