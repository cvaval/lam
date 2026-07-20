/**
 * DÉCRET RÉFORMANT LE DROIT DES SÛRETÉS → Code civil annoté (TITRE PREMIER du décret).
 *
 * Opérations (textes VERBATIM extraits du décret téléversé, scripts/data/decret-suretes/) :
 *   - INSÈRE la LOI Nº 28-1 « Sur les sûretés en général » (2 chapitres, arts. 1774-1 à
 *     1774-10) entre les Lois 28 et 29 ;
 *   - LOI 29 re-titrée « Sur les sûretés personnelles » : chapitre Ier « Sur le
 *     cautionnement » (les 4 anciens chapitres deviennent ses sections, intitulés
 *     conservés — art. 5 du décret), arts. 1780 et 1782 RÉÉCRITS ; + chapitre II « Sur la
 *     garantie autonome » (1809-1 à 1809-9) et chapitre III « Sur la lettre de confort »
 *     (1809-10) NOUVEAUX ;
 *   - LOI 32 re-titrée « Sur les sûretés mobilières » : 1838, 1839 et 1840-1858 RÉÉCRITS
 *     (+ 1849-1, 1849-2, 1851-1 NOUVEAUX) ; l'ancien chapitre II « De l'antichrèse »
 *     disparaît au profit des chapitres II « Du nantissement de meubles incorporels »
 *     (1858-1 à 1858-12) et III « De la propriété retenue à titre de garantie »
 *     (1858-13 à 1858-21) NOUVEAUX ;
 *   - LOI 33 re-titrée « Sur les privilèges et les sûretés immobilières » : 1859-1 NOUVEAU
 *     (droit de rétention), sous-section « Du classement des privilèges » (1869-1 à 1869-3)
 *     NOUVELLE, chapitre XI « De l'antichrèse » (1970-1 à 1970-9) NOUVEAU ;
 *     chapitres III à X (1881-1970) INCHANGÉS (art. 15) — les effets du Décret régimes
 *     matrimoniaux sur 1902…1962 sont PRÉSERVÉS (« demeurent inchangés » ne restaure rien).
 *
 * Pastilles : « modifié » ×23 (ancienne version repliée + jurisprudence d'époque),
 * « nouveau » ×57. Notes connexes cliquables → décret, à l'ancre homonyme.
 * TITRE II (Code de commerce : 1611-1, 1611-2, 92 abrogé, 600) : consigné, à porter quand
 * le Code de commerce entrera sur la plateforme.
 *
 * Sauvegarde préalable : backup-before-suretes.json. Idempotent.
 *   npx tsx scripts/_apply-decret-suretes-cc.ts
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { amendArticle } from '../src/lib/legislation/amendments'
import { splitArticles } from '../src/lib/legislation/segment'
import { segmentAnnotated, type Annotations, type TocEntry, type AnnBlock } from '../src/lib/legislation/annotated'
import { reindexDocument } from '../src/lib/search/reindex'

type BodyBlock = Extract<AnnBlock, { kind: 'body' }>
const DIR = 'scripts/data/decret-suretes'
const REF = 'Décret réformant le Droit des Sûretés (Le Moniteur, Spécial n° 7 du 14 mai 2020)'
const REF_COURT = 'D. du 14 mai 2020'
const MONITEUR = 'Le Moniteur, Spécial n° 7 du 14 mai 2020'
const EFFECTIVE = new Date('2020-05-14')
const TITLE_DEC = 'Décret réformant le Droit des Sûretés'

// Article du décret portant chaque article du Code (pour la note connexe).
const DECRET_ART = (n: string): string => {
  if (/^1774-[123]$/.test(n)) return '2'
  if (/^1774-/.test(n)) return '3'
  if (n === '1780' || n === '1782') return '5'
  if (n === '1809-10') return '7'
  if (/^1809-/.test(n)) return '6'
  if (n === '1838' || n === '1839') return '8'
  if (/^1858-(1[3-9]|2[01])$/.test(n)) return '11'
  if (/^1858-/.test(n)) return '10'
  if (n === '1859-1') return '13'
  if (/^1869-/.test(n)) return '14'
  if (/^1970-/.test(n)) return '16'
  return '9' // 1840-1858 + 1849-x + 1851-1
}
const AMENDED = ['1780', '1782', '1838', '1839', ...Array.from({ length: 19 }, (_, i) => String(1840 + i))]
const NEW_ARTS = [
  ...Array.from({ length: 10 }, (_, i) => `1774-${i + 1}`),
  ...Array.from({ length: 10 }, (_, i) => `1809-${i + 1}`),
  '1849-1', '1849-2', '1851-1',
  ...Array.from({ length: 21 }, (_, i) => `1858-${i + 1}`),
  '1859-1', '1869-1', '1869-2', '1869-3',
  ...Array.from({ length: 9 }, (_, i) => `1970-${i + 1}`),
]

async function main() {
  const cc = await prisma.document.findFirst({ where: { source: 'CODE_CIVIL_ANNOTE' } })
  const dec = await prisma.document.findFirst({ where: { source: 'DECRET_SURETES' }, select: { id: true } })
  if (!cc?.bodyOriginal || !cc.annotationsJson || !dec) throw new Error('Code civil ou Décret sûretés introuvable')
  const ann = JSON.parse(cc.annotationsJson) as Annotations & Record<string, any>
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

  // ── Extraction des textes cités du décret (bloc = tête + lignes « … » / énumérations N)) ──
  const dLines = readFileSync(`${DIR}/bodyOriginal.txt`, 'utf8').split('\n')
  const quoted = new Map<string, string[]>()
  for (let i = 0; i < dLines.length; i++) {
    const m = dLines[i].match(/^Article\s+(\d{3,4}(?:-\d+)?)\s*\.\-\s*(.*)$/)
    if (!m) continue
    const n = m[1]
    if (!AMENDED.includes(n) && !NEW_ARTS.includes(n)) continue
    // Continuation par DÉFAUT-INCLURE jusqu'à une borne structurelle : les textes normatifs
    // contiennent des lignes « … », des énumérations 1) / a) ET des alinéas nus (constat
    // d'audit adversarial : l'ancienne règle « seulement « et N) » amputait 1809-2, 1809-9,
    // 1849-1, 1849-2 de 18 lignes, dont les mentions « à peine de nullité »).
    // Un item lettré n'est une NARRATION que s'il annonce un article/chapitre du dispositif
    // (« b) L'article 1839 ainsi rédigé ») — « i) L'impossibilité… » est du texte normatif.
    const BOUND = /^(?:«?\s*Article\s|CHAPITRE\b|TITRE\b|Section\s+[IVX]+\.-|[IVX]+[).-]\s|[a-z]\)\s+(?:L['’]article\b|L['’]actuel\b|Les articles\b|Un chapitre\b|La sous-section\b)|L['’]article\s|L['’]actuel\b|Les articles\s|Elle comprend\b|Elle comporte\b|Le chapitre\b|Dans le\b|La Loi\b|Donné\b|Par\s*:)/
    const buf = [m[2].trim()]
    for (let j = i + 1; j < dLines.length; j++) {
      const l = dLines[j].trim()
      if (!l || BOUND.test(l)) break
      buf.push(l.replace(/^«\s?/, ''))
    }
    // guillemet fermant du bloc (fin de citation) : retiré, ponctuation narrative comprise
    buf[buf.length - 1] = buf[buf.length - 1].replace(/\s*»\s*[;.]?\s*$/, '')
    quoted.set(n, buf.map((s) => s.replace(/\s*»\s*;?\s*$/, '')))
  }
  const missing = [...AMENDED, ...NEW_ARTS].filter((n) => !quoted.has(n) || !quoted.get(n)!.join('').trim())
  if (missing.length) throw new Error(`textes cités introuvables/vides : ${missing.join(', ')}`)
  console.log(`✓ ${quoted.size} textes extraits du décret (23 réécrits + 57 nouveaux)`)
  // Garde anti-narration : aucun bloc ne doit contenir les marqueurs du dispositif.
  for (const [n, ls] of quoted) if (ls.some((l) => /demeure(nt)? inchangé|ainsi rédigé|comporte\s*:$/.test(l))) throw new Error(`bloc ${n} pollué par la narration du décret`)
  // SENTINELLES anti-circularité (constat d'audit : la vérification comparait le corps à la
  // MÊME extraction — ces chaînes du décret DOIVENT être présentes dans les blocs extraits).
  const SENTINELS: [string, string][] = [
    ['1809-2', 'La dénomination de garantie à première demande'],
    ['1809-2', 'bénéficier des exceptions de la caution'],
    ['1809-9', 'Soit au jour calendaire'],
    ['1849-1', 'Lorsque le produit sous forme'],
    ['1849-2', 'produit fini'],
    ['1780', 'somme maximale garantie'],
    ['1853', 'huit jours après une simple'],
  ]
  for (const [n, s] of SENTINELS) if (!quoted.get(n)!.join(' ').includes(s)) throw new Error(`sentinelle absente du bloc ${n} : « ${s} »`)

  // ── SAUVEGARDE ──
  if (!existsSync(`${DIR}/backup-before-suretes.json`)) {
    const avs0 = await prisma.articleVersion.findMany({ where: { documentId: cc.id } })
    writeFileSync(`${DIR}/backup-before-suretes.json`, JSON.stringify({ id: cc.id, bodyOriginal: cc.bodyOriginal, annotationsJson: cc.annotationsJson, articleVersions: avs0 }, null, 1))
    console.log('✓ sauvegarde écrite')
  } else console.log('✓ sauvegarde déjà présente (conservée)')

  // ── Snapshots d'origine (pour les 23 réécrits), bornés par la toc ACTUELLE ──
  const tocLabels0 = new Set(ann.toc.map((t) => norm(t.label)))
  const orig = new Map<string, string>()
  for (const seg of splitArticles(cc.bodyOriginal, (l) => tocLabels0.has(norm(l)))) if (seg.anchor && !orig.has(seg.anchor)) orig.set(seg.anchor, seg.lines.join('\n'))
  for (const n of AMENDED) if (!orig.has(`art-${n}`)) throw new Error(`art. ${n} introuvable dans le corps`)

  // ── ÉDITION DU CORPS : libellés + insertions (indices calculés AVANT, appliqués de bas en haut) ──
  let lines = cc.bodyOriginal.split('\n')
  const already = lines.some((l) => l.startsWith('Art. 1774-1 '))
  const H = {
    loi281: 'LOI Nº 28-1 — Sur les sûretés en général',
    ch281a: 'CHAPITRE PREMIER — DES SÛRETÉS',
    ch281b: 'CHAPITRE II — DE L’AGENT DES SÛRETÉS',
    loi29: 'LOI Nº 29 — Sur les sûretés personnelles',
    ch29caut: 'CHAPITRE PREMIER — SUR LE CAUTIONNEMENT',
    s29_1: 'SECTION PREMIÈRE — De la nature et de l’étendue du cautionnement',
    s29_2: 'SECTION II — De l’effet du cautionnement',
    s29_3: 'SECTION III — De l’extinction du cautionnement',
    s29_4: 'SECTION IV — De la caution légale et de la caution judiciaire',
    ch29ga: 'CHAPITRE II — SUR LA GARANTIE AUTONOME',
    // Sections prescrites par l'article 6 du décret (constat d'audit : elles manquaient).
    s29ga1: 'SECTION PREMIÈRE — De la nature de la garantie autonome',
    s29ga2: 'SECTION II — De la formation de la garantie autonome',
    s29ga3: 'SECTION III — Des effets de la garantie autonome',
    ch29lc: 'CHAPITRE III — SUR LA LETTRE DE CONFORT',
    loi32: 'LOI Nº 32 — Sur les sûretés mobilières',
    ch32g: 'CHAPITRE PREMIER — DU GAGE DES MEUBLES CORPORELS',
    ch32n: 'CHAPITRE II — DU NANTISSEMENT DE MEUBLES INCORPORELS',
    ch32p: 'CHAPITRE III — DE LA PROPRIÉTÉ RETENUE À TITRE DE GARANTIE',
    loi33: 'LOI Nº 33 — Sur les privilèges et les sûretés immobilières',
    ss33cl: 'III — Du classement des privilèges',
    ch33ant: 'CHAPITRE XI — DE L’ANTICHRÈSE',
  }
  const artBlock = (n: string): string[] => {
    const [head, ...rest] = quoted.get(n)!
    return [`Art. ${n} (${REF_COURT}) ${head}`.replace(/'/g, '’'), ...rest.map((s) => s.replace(/'/g, '’'))]
  }
  const seq = (from: number, to: number, pref: string) => Array.from({ length: to - from + 1 }, (_, i) => `${pref}${from + i}`)
  if (!already) {
    const lineOfToc = (anchor: string): number => {
      const label = ann.toc.find((t) => t.anchor === anchor)?.label
      const i = lines.findIndex((l) => norm(l) === norm(label ?? ' '))
      if (i < 0) throw new Error(`ligne toc ${anchor} introuvable`)
      return i
    }
    const artLine = (n: string): number => {
      const i = lines.findIndex((l) => new RegExp(`^Art\\.?\\s*${n}\\b`).test(l.trim()))
      if (i < 0) throw new Error(`tête d'article ${n} introuvable`)
      return i
    }
    // Entrée toc qui SUIT sec-316 (fin de la LOI 33) — calculée, jamais supposée.
    const i316 = ann.toc.findIndex((t) => t.anchor === 'sec-316')
    const afterLoi33 = ann.toc[i316 + 1]?.anchor
    if (!afterLoi33 || !/^LOI/.test(ann.toc[i316 + 1].label)) throw new Error(`entrée après sec-316 inattendue : ${ann.toc[i316 + 1]?.label}`)
    // Phase 1 — REMPLACEMENTS (index-stables). Phase 2 — INSERTIONS/RETRAIT (de bas en haut).
    // Tous les indices sont capturés AVANT toute mutation.
    const REPL: [number, string][] = [
      [lineOfToc('sec-280'), H.loi29], [lineOfToc('sec-281'), H.s29_1], [lineOfToc('sec-282'), H.s29_2],
      [lineOfToc('sec-286'), H.s29_3], [lineOfToc('sec-287'), H.s29_4], [lineOfToc('sec-290'), H.loi32],
      [lineOfToc('sec-291'), H.ch32g], [lineOfToc('sec-293'), H.loi33],
    ]
    const INS: [number, string[]][] = [
      [lineOfToc('sec-280'), [H.loi281, H.ch281a, ...['1774-1', '1774-2', '1774-3'].flatMap(artBlock), H.ch281b, ...seq(4, 10, '1774-').flatMap(artBlock)]],
      [lineOfToc('sec-281'), [H.ch29caut]],
      [lineOfToc('sec-288'), [H.ch29ga, H.s29ga1, ...artBlock('1809-1'), H.s29ga2, ...artBlock('1809-2'), H.s29ga3, ...seq(3, 9, '1809-').flatMap(artBlock), H.ch29lc, ...artBlock('1809-10')]],
      [lineOfToc('sec-293'), [H.ch32n, ...seq(1, 12, '1858-').flatMap(artBlock), H.ch32p, ...seq(13, 21, '1858-').flatMap(artBlock)]],
      [artLine('1850'), [...artBlock('1849-1'), ...artBlock('1849-2')]], // intercalés dans le gage
      [artLine('1852'), artBlock('1851-1')],
      [artLine('1860'), artBlock('1859-1')],
      [lineOfToc('sec-299'), [H.ss33cl, ...['1869-1', '1869-2', '1869-3'].flatMap(artBlock)]],
      [lineOfToc(afterLoi33), [H.ch33ant, ...seq(1, 9, '1970-').flatMap(artBlock)]],
    ]
    // Retraits : la ligne toc de l'ancien chapitre antichrèse + 2 VESTIGES hors-toc
    // (doublons d'intitulé de l'édition source, constat d'audit — « DE L'ANTICHRÈSE »
    // entre 1855/1856 et « DE L'EXTINCTION DU CAUTIONNEMENT » entre 1794/1795), qui
    // n'ont plus d'objet dans la structure issue du décret. Journalisés en livraison.
    const fold = (s: string) => norm(s).replace(/[’']/g, "'")
    const strayLine = (txt: string): number => {
      const i = lines.findIndex((l) => fold(l) === fold(txt))
      if (i < 0) throw new Error(`vestige introuvable : ${txt}`)
      return i
    }
    const DELS = [lineOfToc('sec-292'), strayLine('DE L’ANTICHRÈSE'), strayLine('DE L’EXTINCTION DU CAUTIONNEMENT')]
    for (const [at, label] of REPL) lines[at] = label
    const edits: { at: number; del?: number; ins?: string[] }[] = [...INS.map(([at, ins]) => ({ at, ins })), ...DELS.map((at) => ({ at, del: 1 }))]
    edits.sort((a, b) => b.at - a.at)
    for (const e of edits) e.del ? lines.splice(e.at, e.del) : lines.splice(e.at, 0, ...e.ins!)
    console.log(`✓ corps : ${INS.length} insertions, ${REPL.length} libellés remplacés, 1 ligne retirée`)
  } else console.log('✓ corps déjà édité (relance)')
  const newBody = lines.join('\n')

  // ── NOUVELLE TOC (ordre du corps ; ancres neuves sec-343+) ──
  const maxSec = Math.max(...ann.toc.map((t) => Number((t.anchor.match(/^sec-(\d+)$/) ?? [])[1] ?? 0)))
  let next = maxSec
  const existingNew = new Map((ann.toc as TocEntry[]).map((t) => [norm(t.label), t]))
  const mk = (label: string, level: number): TocEntry => existingNew.get(norm(label)) ?? { label, level, anchor: `sec-${++next}`, kind: 'section' }
  const newToc: TocEntry[] = []
  // Relance : les entrées mintées par CE script (sec > 342) sont ré-émises par le switch —
  // on les saute dans l'itération pour ne pas les dupliquer. (RM = sec-334..342, conservées.)
  const mintedHere = (a: string) => { const m = a.match(/^sec-(\d+)$/); return !!m && Number(m[1]) > 342 }
  for (const t of ann.toc as TocEntry[]) {
    if (mintedHere(t.anchor)) continue
    switch (t.anchor) {
      case 'sec-280':
        newToc.push(mk(H.loi281, 1), mk(H.ch281a, 2), mk(H.ch281b, 2), { ...t, label: H.loi29 }, mk(H.ch29caut, 2))
        break
      case 'sec-281': newToc.push({ ...t, label: H.s29_1, level: 3 }); break
      case 'sec-282': newToc.push({ ...t, label: H.s29_2, level: 3 }); break
      case 'sec-283': case 'sec-284': case 'sec-285': newToc.push({ ...t, level: 4 }); break
      case 'sec-286': newToc.push({ ...t, label: H.s29_3, level: 3 }); break
      case 'sec-287': newToc.push({ ...t, label: H.s29_4, level: 3 }, mk(H.ch29ga, 2), mk(H.s29ga1, 3), mk(H.s29ga2, 3), mk(H.s29ga3, 3), mk(H.ch29lc, 2)); break
      case 'sec-290': newToc.push({ ...t, label: H.loi32 }); break
      case 'sec-291': newToc.push({ ...t, label: H.ch32g }); break
      case 'sec-292': newToc.push({ ...t, label: H.ch32n }, mk(H.ch32p, 2)); break
      case 'sec-293': newToc.push({ ...t, label: H.loi33 }); break
      case 'sec-298': newToc.push(t, mk(H.ss33cl, 3)); break
      case 'sec-316': newToc.push(t, mk(H.ch33ant, 2)); break
      default: newToc.push(t)
    }
  }
  // ── Vérification de segmentation AVANT écriture ──
  const blocks = segmentAnnotated(newBody, newToc)
  const secs = blocks.filter((b) => b.kind === 'section').length
  const anchors = new Set(blocks.filter((b): b is BodyBlock => b.kind === 'body').filter((b) => b.anchor).map((b) => b.anchor as string))
  if (secs !== newToc.length) throw new Error(`segmentation ${secs}/${newToc.length} — ANNULÉ`)
  if (anchors.size !== 2107) throw new Error(`ancres ${anchors.size} ≠ 2107 (2050 + 57) — ANNULÉ`)
  for (const n of NEW_ARTS) if (!anchors.has(`art-${n}`)) throw new Error(`ancre art-${n} absente — ANNULÉ`)
  console.log(`✓ segmentation projetée : ${secs}/${newToc.length} en-têtes · 2107 ancres`)

  // ── navToc : reconstruire les nœuds des Lois 28-1 à 33 depuis la nouvelle toc ──
  const l1idx = (a: string) => newToc.findIndex((t) => t.anchor === a)
  const buildLoiNode = (anchor: string) => {
    const i = l1idx(anchor)
    const end = newToc.findIndex((t, k) => k > i && t.level === 1)
    const slice = newToc.slice(i + 1, end < 0 ? undefined : end)
    const node: any = { label: newToc[i].label, anchor, children: [] }
    let cur: any = null
    for (const t of slice) {
      if (t.level === 2) { cur = { label: t.label, anchor: t.anchor, children: [] }; node.children.push(cur) }
      else if (cur) cur.children.push({ label: t.label, anchor: t.anchor })
      else node.children.push({ label: t.label, anchor: t.anchor })
    }
    for (const c of node.children) if (!c.children?.length) delete c.children
    return node
  }
  const root = (ann.navToc[0].children ?? []) as any[]
  const i29 = root.findIndex((n) => n.anchor === 'sec-280')
  if (i29 < 0) throw new Error('nœud LOI 29 introuvable dans navToc')
  const rebuilt = [buildLoiNode(newToc[l1idx('sec-280') - 3].anchor), buildLoiNode('sec-280')] // LOI 28-1 (3 entrées avant sec-280) + LOI 29
  root.splice(i29, 1, ...rebuilt)
  for (const a of ['sec-290', 'sec-293']) {
    const i = root.findIndex((n) => n.anchor === a)
    if (i < 0) throw new Error(`nœud ${a} introuvable`)
    root[i] = buildLoiNode(a)
  }

  // ── OVERLAY des 23 réécrits + annotations ──
  await prisma.articleVersion.deleteMany({ where: { documentId: cc.id, anchor: { in: [...AMENDED, ...NEW_ARTS].map((n) => `art-${n}`) }, amendedByNumber: REF } })
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
    const ex = arr.find((b) => b.docId === dec.id)
    if (ex) { ex.text = text; ex.anchor = anchor; ex.label = `${TITLE_DEC} (${MONITEUR})` }
    else arr.push({ label: `${TITLE_DEC} (${MONITEUR})`, text, docId: dec.id, anchor })
  }
  for (const n of AMENDED) {
    const a = `art-${n}`
    await amendArticle({
      documentId: cc.id, anchor: a, label: `Article ${n}`, originalBody: orig.get(a)!,
      newBody: artBlock(n).join('\n'), amendedByDocId: dec.id, amendedByNumber: REF, effectiveDate: EFFECTIVE, origin: 'MANUAL',
    })
    ann.status[a] = 'modifié'
    if (!ann.oldVersions[a]) ann.oldVersions[a] = orig.get(a)! + jurisText(n)
    setConnexe(a, `Réécrit par l’article ${DECRET_ART(n)} du Décret réformant le Droit des Sûretés — ${MONITEUR}.`, a)
  }
  console.log(`✓ ${AMENDED.length} articles réécrits (overlay + pastille + repliable)`)
  for (const n of NEW_ARTS) {
    const a = `art-${n}`
    ann.labels[a] = `Article ${n}`
    ann.status[a] = 'nouveau'
    setConnexe(a, `Ajouté par l’article ${DECRET_ART(n)} du Décret réformant le Droit des Sûretés — ${MONITEUR}.`, a)
  }
  console.log(`✓ ${NEW_ARTS.length} articles nouveaux (pastille + note connexe)`)

  // ── Index alphabétique : sujets sûretés ──
  const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const addIdx = (subject: string, refs: (string | number)[]) => {
    const ex = ann.indexEntries.find((e: any) => fold(e.subject) === fold(subject))
    if (ex) ex.ctRefs = [...new Set([...ex.ctRefs, ...refs])]
    else ann.indexEntries.push({ subject, ctRefs: refs })
  }
  addIdx('Sûretés (en général)', ['1774-1', '1774-2', '1774-3'])
  addIdx('Agent des sûretés', ['1774-4', '1774-5', '1774-6', '1774-7', '1774-8', '1774-9', '1774-10'])
  addIdx('Garantie autonome', ['1809-1', '1809-2', '1809-3', '1809-4', '1809-5', '1809-6', '1809-7', '1809-8', '1809-9'])
  addIdx('Lettre de confort', ['1809-10'])
  addIdx('Gage de meubles corporels', [1840, 1843, 1844, 1845, 1847, 1848, 1849, 1853, 1854, 1855])
  addIdx('Registre des Sûretés Mobilières', [1839, 1845])
  addIdx('Nantissement de créance', ['1858-1', '1858-2', '1858-7', '1858-8', '1858-9', '1858-11'])
  addIdx('Propriété retenue à titre de garantie (réserve de propriété)', ['1858-13', '1858-14', '1858-17', '1858-19'])
  addIdx('Droit de rétention', ['1859-1'])
  addIdx('Classement des privilèges', ['1869-1', '1869-2', '1869-3'])
  addIdx('Antichrèse', ['1970-1', '1970-2', '1970-4', '1970-5', '1970-7'])
  ann.indexEntries.sort((a: any, b: any) => fold(a.subject).localeCompare(fold(b.subject)))

  ann.toc = newToc
  await prisma.document.update({ where: { id: cc.id }, data: { bodyOriginal: newBody, annotationsJson: JSON.stringify(ann) } })
  await reindexDocument(cc.id)
  console.log('✓ document écrit + réindexé')
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
