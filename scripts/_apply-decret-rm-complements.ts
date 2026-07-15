/**
 * COMPLÉMENTS du Décret régimes matrimoniaux sur le Code civil — décisions cliente du 14 juil. 2026 :
 *
 *  1) INSÉRER les articles créés par l'article 1er du Décret : 1181-1, 1184-1, 1184-2
 *     (pastille « nouveau », texte verbatim du décret, note connexe cliquable → décret).
 *  2) ABROGER en entier 1907 et 1911 (article 7 al. 2 du Décret : « Sont abrogés les
 *     articles 1907 et 1911 du Code Civil. ») — pastille « abrogé », ancien texte replié.
 *  3) ABROGATION PARTIELLE (article 7 al. 1er) pour 1902, 1903, 1905, 1906, 1909, 1912,
 *     1920, 1960, 1961, 1962 : « appliquer ce que dit le décret, replier uniquement la
 *     partie abrogée » — le texte EN VIGUEUR reste affiché SANS les dispositions relatives
 *     à l'hypothèque légale de la femme mariée ; la partie retranchée est repliée
 *     (pastille « partiellement abrogé »). Chaque retranchement est CODÉ EXPLICITEMENT
 *     ci-dessous (EXCISIONS) — aucune heuristique. Les renvois d'époque suivent leur
 *     fragment ; scories historiques conservées ; seuls accords grammaticaux rendus
 *     nécessaires par un retranchement sont ajustés (journalisés).
 *
 * Idempotent. Réversibilité : ArticleVersion MODIFIE porte le texte intégral d'origine.
 *   npx tsx scripts/_apply-decret-rm-complements.ts
 */
import { prisma } from '../src/lib/db'
import { amendArticle, abrogateArticle } from '../src/lib/legislation/amendments'
import { splitArticles } from '../src/lib/legislation/segment'
import { segmentAnnotated, type Annotations, type AnnBlock } from '../src/lib/legislation/annotated'
import { reindexDocument } from '../src/lib/search/reindex'

type BodyBlock = Extract<AnnBlock, { kind: 'body' }>
const REF = 'Décret sur les régimes matrimoniaux (Le Moniteur, Spécial n° 6 du 13 mai 2020)'
const REF_COURT = 'D. du 13 mai 2020'
const MONITEUR = 'Le Moniteur, Spécial n° 6 du 13 mai 2020'
const EFFECTIVE = new Date('2020-05-13')
const TITLE_DEC = 'Décret portant réforme des régimes matrimoniaux'
const ap = (s: string) => s.replace(/'/g, '’') // §10 : apostrophe typographique (textes affichés)

// ── 1) Nouveaux articles (texte VERBATIM du décret, art. 1er) ──
const NEW_ARTS: { n: string; after: 'art' | 'toc'; anchorLine: string; lines: string[] }[] = [
  {
    n: '1181-1', after: 'art', anchorLine: 'Art. 1182',
    lines: [
      `Art. 1181-1 (${REF_COURT}) ${ap("Les dispositions de l'article précédent ne sont pas applicables aux conventions qui sont passées par les époux divorcés, séparés de corps ou de biens en vue de liquider leur régime matrimonial.")}`,
    ],
  },
  {
    n: '1184-1', after: 'toc', anchorLine: 'CHAPITRE II — DU RÉGIME EN COMMUNAUTÉ',
    lines: [
      `Art. 1184-1 (${REF_COURT}) ${ap("Il est institué, quel que soit le régime matrimonial choisi par les époux, en cas de dissolution du mariage par le décès de l'un des époux, un usufruit au bénéfice du conjoint survivant, lorsque le domicile conjugal est établi dans un immeuble commun ou appartenant en propre au conjoint prédécédé. L'époux survivant ne sera point inquiété par les héritiers de l'époux prédécédé. Cet usufruit s'étend au domicile proprement dit, à ses accessoires, ses meubles meublants et ses dépendances. Cet usufruit est personnel et intransmissible ; il s'éteint de plein droit par le décès, le remariage ou le concubinage notoire de l'époux survivant.")}`,
      ap("Au sens du présent article, le domicile conjugal s'entend de l'immeuble dans lequel les époux ont établi leur résidence principale."),
      ap("L'usufruit légal ainsi constitué est d'ordre public et d'application immédiate."),
    ],
  },
  {
    n: '1184-2', after: 'toc', anchorLine: 'CHAPITRE II — DU RÉGIME EN COMMUNAUTÉ',
    lines: [
      `Art. 1184-2 (${REF_COURT}) ${ap("En cas de dissolution du mariage par le décès de l'un des époux signataire d'un bail à usage d'habitation, le survivant aura la faculté de conserver pour son compte personnel le droit au bail des lieux qui auront servi effectivement à l'habitation des deux époux au jour du décès du prémourant, à charge de payer les loyers et d'exécuter les conditions dudit bail.")}`,
    ],
  },
]

// ── 3) Abrogations partielles : excisions EXPLICITES par article ──
// mode 'lines' : lignes entières retranchées (indices dans le bloc d'origine, tête = ligne 0).
// mode 'cuts'  : membres de phrase retranchés (recherche/remplacement EXACTS, ordre d'application).
const EXCISIONS: Record<string, { dropLines?: number[]; cuts?: [string, string][]; note?: string }> = {
  '1902': { dropLines: [2, 3, 4] }, // « Au profit des femmes… », « La femme n'a d'hypothèque… », « Elle n'a d'hypothèque… »
  '1903': {
    cuts: [
      ['Sont toutefois les maris et les tuteurs tenus', 'Sont toutefois les tuteurs tenus'],
      ['Les maris et les tuteurs qui, ayant manqué', 'Les tuteurs qui, ayant manqué'],
      ['affectés à l’hypothèque légale des femmes et des mineurs', 'affectés à l’hypothèque légale des mineurs'],
    ],
  },
  '1905': {
    cuts: [
      ['A défaut par les maris, tuteurs, subrogés-tuteurs', 'A défaut par les tuteurs, subrogés-tuteurs'],
      ['du domicile des maris et tuteurs', 'du domicile des tuteurs'],
    ],
  },
  '1906': {
    cuts: [
      ['Pourront les parents, soit du mari soit de la femme, et les parents du mineur', 'Pourront les parents du mineur'],
      ['requises par la femme et par les mineurs', 'requises par les mineurs'],
    ],
  },
  '1909': { cuts: [['le mari, le tuteur et le subrogé-tuteur', 'le tuteur et le subrogé-tuteur']] },
  '1912': { cuts: [['les demandes des maris et des tuteurs', 'les demandes des tuteurs']] },
  '1920': { cuts: [['sur les biens des tuteurs; ceux des femmes mariées sur les biens de leurs époux, seront inscrits', 'sur les biens des tuteurs, seront inscrits']] },
  '1960': {
    cuts: [
      ['appartenant à des maris ou à des tuteurs', 'appartenant à des tuteurs'],
      ['à raison de la gestion du tuteur, ou des dots, reprises et conventions matrimoniales de la femme, purger', 'à raison de la gestion du tuteur, purger'],
    ],
  },
  '1961': {
    cuts: [
      ['signifié, tant à la femme ou au subrogé-tuteur, qu’au commissaire', 'signifié, tant au subrogé-tuteur qu’au commissaire'],
      ['les femmes, les maris, tuteurs, subrogés-tuteurs, mineurs', 'les tuteurs, subrogés-tuteurs, mineurs'],
      ['le jour du contrat de mariage, ou le jour de l’entrée en gestion du tuteur', 'le jour de l’entrée en gestion du tuteur'],
      ['contre les maris et les tuteurs, ainsi qu’il a été dit', 'contre les tuteurs, ainsi qu’il a été dit'],
      ['en raison du mariage ou de la tutelle', 'en raison de la tutelle'],
    ],
  },
  '1962': {
    cuts: [
      ['d’inscription du chef des femmes, mineurs ou interdits, sur les immeubles vendus', 'd’inscription du chef des mineurs ou interdits, sur les immeubles vendus'],
      ['à raison des dots, reprises et conventions matrimoniales de la femme, ou de la gestion du tuteur', 'à raison de la gestion du tuteur'],
      ['contre le mari ou le tuteur', 'contre le tuteur'],
      ['du chef desdites femmes, mineurs ou interdits', 'du chef desdits mineurs ou interdits'], // accord ajusté (journalisé)
      ['et les inscriptions du chef des femmes, mineurs ou interdits, seront rayées', 'et les inscriptions du chef des mineurs ou interdits, seront rayées'],
      ['Si les inscriptions du chef des femmes, mineurs ou interdits, sont les plus anciennes', 'Si les inscriptions du chef des mineurs ou interdits, sont les plus anciennes'],
      ['la date du contrat de mariage, ou de l’entrée en gestion du tuteur', 'la date de l’entrée en gestion du tuteur'],
    ],
    note: 'accord « desdits » ajusté après retranchement de « femmes »',
  },
}
const PARTIAL = Object.keys(EXCISIONS)
const FULL_ABROG = ['1907', '1911']

async function main() {
  const cc = await prisma.document.findFirst({ where: { source: 'CODE_CIVIL_ANNOTE' } })
  const dec = await prisma.document.findFirst({ where: { source: 'DECRET_REGIMES_MATRIMONIAUX' }, select: { id: true } })
  if (!cc?.bodyOriginal || !cc.annotationsJson || !dec) throw new Error('Code civil ou Décret introuvable')
  const ann = JSON.parse(cc.annotationsJson) as Annotations & Record<string, any>
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
  const tocLabels = new Set(ann.toc.map((t) => norm(t.label)))

  // Textes d'origine intégraux (bornés par le sommaire).
  const orig = new Map<string, string>()
  for (const seg of splitArticles(cc.bodyOriginal, (l) => tocLabels.has(norm(l)))) if (seg.anchor && !orig.has(seg.anchor)) orig.set(seg.anchor, seg.lines.join('\n'))

  // ── 1) INSERTIONS dans le corps ──
  let lines = cc.bodyOriginal.split('\n')
  if (!lines.some((l) => l.startsWith('Art. 1181-1'))) {
    const insertBefore = (needle: (l: string) => boolean, ins: string[]) => {
      const i = lines.findIndex(needle)
      if (i < 0) throw new Error('point d’insertion introuvable')
      lines = [...lines.slice(0, i), ...ins, ...lines.slice(i)]
    }
    insertBefore((l) => /^Art\.\s*1182\b/.test(l.trim()), NEW_ARTS[0].lines)
    insertBefore((l) => norm(l) === norm('CHAPITRE II — DU RÉGIME EN COMMUNAUTÉ'), [...NEW_ARTS[1].lines, ...NEW_ARTS[2].lines])
    console.log('✓ corps : 1181-1, 1184-1, 1184-2 insérés')
  } else console.log('✓ corps : insertions déjà en place (relance)')
  const newBody = lines.join('\n')

  // Vérif segmentation AVANT écriture : mêmes en-têtes, 2050 ancres.
  const blocks = segmentAnnotated(newBody, ann.toc)
  const secs = blocks.filter((b) => b.kind === 'section').length
  const anchors = new Set(blocks.filter((b): b is BodyBlock => b.kind === 'body').filter((b) => b.anchor).map((b) => b.anchor as string))
  if (secs !== ann.toc.length) throw new Error(`segmentation ${secs}/${ann.toc.length} — annulé`)
  if (anchors.size !== 2050) throw new Error(`ancres ${anchors.size} ≠ 2050 — annulé`)
  for (const na of NEW_ARTS) if (!anchors.has(`art-${na.n}`)) throw new Error(`ancre art-${na.n} absente — annulé`)
  console.log(`✓ segmentation projetée : ${secs}/${ann.toc.length} · 2050 ancres (2047 + 3 nouveaux)`)

  ann.status = ann.status ?? {}; ann.oldVersions = ann.oldVersions ?? {}; ann.labels = ann.labels ?? {}
  const connexe = (ann.connexe = ann.connexe ?? {}) as Record<string, { label?: string; text: string; docId?: string; anchor?: string }[]>
  const setConnexe = (a: string, text: string, anchor: string) => {
    const arr = (connexe[a] = connexe[a] ?? [])
    const ex = arr.find((b) => b.docId === dec.id || (b.text ?? '').includes('régimes matrimoniaux'))
    if (ex) { ex.text = text; ex.docId = dec.id; ex.anchor = anchor; ex.label = `${TITLE_DEC} (${MONITEUR})` }
    else arr.push({ label: `${TITLE_DEC} (${MONITEUR})`, text, docId: dec.id, anchor })
  }

  // ── 1bis) Annotations des nouveaux articles ──
  for (const na of NEW_ARTS) {
    const a = `art-${na.n}`
    ann.labels[a] = `Article ${na.n}`
    ann.status[a] = 'nouveau'
    setConnexe(a, `Ajouté par l’article 1er du Décret portant réforme des régimes matrimoniaux — ${MONITEUR}.`, a)
  }
  // Index : rattacher les nouveaux articles.
  const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const addIdx = (subject: string, refs: (string | number)[]) => {
    const ex = ann.indexEntries.find((e: any) => fold(e.subject) === fold(subject))
    if (ex) ex.ctRefs = [...new Set([...ex.ctRefs, ...refs])]
    else ann.indexEntries.push({ subject, ctRefs: refs })
  }
  addIdx('Changement de régime matrimonial', ['1181-1'])
  addIdx('Logement familial', ['1184-1', '1184-2'])
  addIdx('Usufruit légal du conjoint survivant', ['1184-1'])
  addIdx('Bail à usage d’habitation (décès d’un époux)', ['1184-2'])
  ann.indexEntries.sort((a: any, b: any) => fold(a.subject).localeCompare(fold(b.subject)))

  // ── 2) 1907 et 1911 : abrogation totale ──
  await prisma.articleVersion.deleteMany({ where: { documentId: cc.id, anchor: { in: FULL_ABROG.map((n) => `art-${n}`) }, amendedByNumber: REF } })
  for (const n of FULL_ABROG) {
    const a = `art-${n}`
    await abrogateArticle({ documentId: cc.id, anchor: a, label: `Article ${n}`, originalBody: orig.get(a)!, amendedByDocId: dec.id, amendedByNumber: REF, effectiveDate: EFFECTIVE })
    ann.status[a] = 'abrogé'
    ann.oldVersions[a] = orig.get(a)!
    setConnexe(a, `Abrogé par l’article 7 du Décret portant réforme des régimes matrimoniaux (« Sont abrogés les articles 1907 et 1911 du Code Civil. ») — ${MONITEUR}.`, 'art-7')
    console.log(`  abrogé (entier) : art. ${n}`)
  }

  // ── 3) Abrogations partielles : texte en vigueur = origine SANS les retranchements ──
  await prisma.articleVersion.deleteMany({ where: { documentId: cc.id, anchor: { in: PARTIAL.map((n) => `art-${n}`) }, amendedByNumber: REF } })
  for (const n of PARTIAL) {
    const a = `art-${n}`
    const full = orig.get(a)!
    const spec = EXCISIONS[n]
    const removed: string[] = []
    let kept = full
    if (spec.dropLines?.length) {
      const ls = full.split('\n')
      for (const i of spec.dropLines) { if (!ls[i]) throw new Error(`art ${n} : ligne ${i} absente`); removed.push(ls[i]) }
      kept = ls.filter((_, i) => !spec.dropLines!.includes(i)).join('\n')
    }
    for (const [from, to] of spec.cuts ?? []) {
      // Le corps mélange apostrophes droites et typographiques : recherche tolérante aux deux.
      const re = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[’']/g, "[’']"))
      const m = kept.match(re)
      if (!m) throw new Error(`art ${n} : membre introuvable « ${from.slice(0, 60)} »`)
      kept = kept.replace(re, to)
      removed.push(`« ${m[0]} » → « ${to} »`)
    }
    // Tête « Art. N … » : retirée du texte stocké, re-préfixée au format overlay.
    const bodyNoHead = kept.replace(/^Art\.\s*\d+\s*/, '')
    await amendArticle({
      documentId: cc.id, anchor: a, label: `Article ${n}`,
      originalBody: full, newBody: `Art. ${n} (${REF_COURT}) ${bodyNoHead}`,
      amendedByDocId: dec.id, amendedByNumber: REF, effectiveDate: EFFECTIVE, origin: 'MANUAL',
    })
    ann.status[a] = 'partiellement abrogé'
    // Repli = UNIQUEMENT la partie abrogée (+ queue jurisprudence préservée le cas échéant).
    const oldTail = (ann.oldVersions[a] ?? '').split('\n\nJurisprudence et notes sous l’ancien texte :')[1]
    ann.oldVersions[a] =
      `Dispositions abrogées par l’article 7 du Décret (hypothèque légale de la femme mariée) :\n` +
      removed.map((r) => `• ${r}`).join('\n') +
      (spec.note ? `\n(${spec.note})` : '') +
      (oldTail ? `\n\nJurisprudence et notes sous l’ancien texte :${oldTail}` : '')
    setConnexe(a, `Abrogation PARTIELLE par l’article 7 du Décret portant réforme des régimes matrimoniaux : « Sont abrogées toutes les dispositions se rapportant à l’hypothèque légale de la femme mariée se trouvant dans les articles 1902, 1903, 1905, 1906, 1909, 1912, 1920, 1960, 1961 et 1962 du Code Civil. » Le texte affiché est le texte demeuré en vigueur ; la partie retranchée est repliée ci-dessus. — ${MONITEUR}.`, 'art-7')
    console.log(`  partiellement abrogé : art. ${n} (${removed.length} retranchement(s))`)
  }

  await prisma.document.update({ where: { id: cc.id }, data: { bodyOriginal: newBody, annotationsJson: JSON.stringify(ann) } })
  await reindexDocument(cc.id)
  console.log('✓ document écrit + réindexé')
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
