/**
 * Loi CEC 2002 — mesures et vérifications PARTAGÉES du lot maj2026 (feuille de route du
 * 27 août 2026, §§ 7.1, 7.4, 7.6, 11). Module PUR : aucun accès base, aucune écriture.
 *
 * Importé par maj2026-prevol.ts (l'état témoin, § 7.1) et maj2026-lot-corps.ts (les mêmes
 * vérifications rejouées sur l'état SIMULÉ puis sur l'état écrit, § 11) — c'est le même
 * code qui mesure avant et après, jamais deux implémentations.
 *
 * Règle § 10.10 : AUCUN nombre fixe dans une assertion. Tout se compare ensemble à
 * ensemble, produit à produit ; les comptes s'impriment pour l'humain.
 */
import { segmentAnnotated, type AnnBlock, type TocEntry } from '../../../src/lib/legislation/annotated'

export const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

/**
 * Sentinelles verbatim (§ 9.6, § 11.7) — les sics du J.O. que la base conserve à bon droit.
 * Chaque chaîne a été VÉRIFIÉE au corps en base le 27 août 2026 (présence exacte, apostrophes
 * COURBES U+2019, capitales non accentuées « COOPERATIVE D’EPARGNE ») — elle est la lettre du
 * corps, pas une retape de la feuille de route. Un correcteur zélé qui en « répare » une
 * casse la fidélité au J.O. : leur présence est bloquante.
 */
export const SENTINELLES: readonly string[] = [
  'qu’il a lieu',
  'dont opérations activités',
  'les type et montant',
  'composée deux catégories',
  'comité surveillance',
  'assemblées généralement ordinaires',
  'autorisation de fonctionnent',
  'aux alinéas 7',
  'économique général',
  'leurs engagements',
  'amendes prévues à l’article 146',
  'COOPERATIVE D’EPARGNE',
]

export interface Segmentation {
  blocks: AnnBlock[]
  /** Blocs de corps SANS ancre situés APRÈS le premier en-tête (lignes orphelines, § 7.4). */
  orphelins: { index: number; apresSection: string; avantSection: string | null; texte: string }[]
}

/**
 * Rejoue la segmentation du lecteur annoté (le MÊME `segmentAnnotated` que le rendu,
 * vérifié au pré-vol : `doc/[id]/page.tsx` → `AnnotatedText` → `segmentAnnotated`) et
 * vérifie les invariants § 11.2-11.4. Toute violation → throw.
 */
export function verifierSegmentation(
  body: string,
  toc: TocEntry[],
  labels: Record<string, string>,
  commentaires: Record<string, string[]> | undefined,
): Segmentation {
  const blocks = segmentAnnotated(body, toc)

  // § 11.2 — chaque en-tête déclaré apparié, dans l'ordre.
  const sections = blocks.filter((b) => b.kind === 'section')
  if (sections.length !== toc.length) {
    const appariees = new Set(sections.map((s) => (s.kind === 'section' ? s.anchor : '')))
    const manquantes = toc.filter((e) => !appariees.has(e.anchor)).map((e) => `${e.anchor} « ${e.label} »`)
    throw new Error(
      `§ 11.2 — ${sections.length} en-têtes appariés pour ${toc.length} entrées de toc. ` +
        `Non appariées : ${manquantes.join(' ; ')}`,
    )
  }
  sections.forEach((s, i) => {
    if (s.kind === 'section' && s.anchor !== toc[i].anchor)
      throw new Error(`§ 11.2 — ordre rompu : ${i + 1}ᵉ en-tête apparié = ${s.anchor}, attendu ${toc[i].anchor}`)
  })

  // § 11.3 — aucun texte perdu à la segmentation.
  if (blocks.map((b) => b.text).join('\n') !== body)
    throw new Error('§ 11.3 — la segmentation ne restitue pas le corps (join !== corps)')

  // § 11.4 — labels ↔ blocs ancrés, ensembles égaux ; aucune ancre dupliquée sec-*/art-*.
  const ancresArt = new Set<string>()
  for (const b of blocks) if (b.kind === 'body' && b.anchor) ancresArt.add(b.anchor)
  const clesLabels = new Set(Object.keys(labels))
  const sansBloc = [...clesLabels].filter((k) => !ancresArt.has(k))
  const sansLabel = [...ancresArt].filter((a) => !clesLabels.has(a))
  if (sansBloc.length || sansLabel.length)
    throw new Error(
      `§ 11.4 — labels sans bloc ancré : [${sansBloc.join(', ')}] ; blocs ancrés sans label : [${sansLabel.join(', ')}]`,
    )
  const ancresSec = new Set(sections.map((s) => (s.kind === 'section' ? s.anchor : '')))
  const dupliquees = [...ancresArt].filter((a) => ancresSec.has(a))
  if (dupliquees.length) throw new Error(`§ 11.4 — ancres dupliquées sec-*/art-* : ${dupliquees.join(', ')}`)

  // § 11.4 (suite, § 6.2) — TOUTE clé de `commentaires` atteinte par une jurisKey de la
  // segmentation. Aujourd'hui le champ est absent (0 clé) : l'assertion se pose quand même.
  const jurisKeys = new Set(blocks.filter((b) => b.kind === 'body' && b.jurisKey).map((b) => (b.kind === 'body' ? b.jurisKey : '')))
  const orphelinesComm = Object.keys(commentaires ?? {}).filter((k) => !jurisKeys.has(k))
  if (orphelinesComm.length)
    throw new Error(`§ 11.4 — clés de commentaires non atteintes par la segmentation : ${orphelinesComm.join(' ; ')}`)

  // Lignes orphelines (§ 7.4) : blocs de corps sans ancre APRÈS le premier en-tête.
  const orphelins: Segmentation['orphelins'] = []
  let premierEnTeteVu = false
  blocks.forEach((b, i) => {
    if (b.kind === 'section') {
      premierEnTeteVu = true
      return
    }
    if (!premierEnTeteVu || b.anchor !== null) return
    const avant = blocks[i - 1]
    const apres = blocks[i + 1]
    orphelins.push({
      index: i,
      apresSection: avant?.kind === 'section' ? avant.anchor : '(bloc de corps)',
      avantSection: apres?.kind === 'section' ? apres.anchor : null,
      texte: b.text,
    })
  })

  return { blocks, orphelins }
}

export interface Plage {
  ordre: number // 1-indexé, ordre du toc
  anchor: string
  level: number
  from: number
  to: number
}

/**
 * Mesure les plages d'articles de chaque division (§ 7.6) : pour l'entrée i du toc,
 * premier/dernier article entre son en-tête et le prochain en-tête de niveau ≤ le sien
 * (un TITRE court jusqu'au TITRE suivant, ses chapitres et sections compris).
 */
export function mesurerPlages(blocks: AnnBlock[], toc: TocEntry[]): Plage[] {
  const idxSections: number[] = []
  blocks.forEach((b, i) => {
    if (b.kind === 'section') idxSections.push(i)
  })
  if (idxSections.length !== toc.length)
    throw new Error(`mesurerPlages : ${idxSections.length} en-têtes pour ${toc.length} entrées de toc`)
  return toc.map((e, i) => {
    let fin = blocks.length
    for (let j = i + 1; j < toc.length; j++)
      if (toc[j].level <= e.level) {
        fin = idxSections[j]
        break
      }
    const nums: number[] = []
    for (let k = idxSections[i] + 1; k < fin; k++) {
      const b = blocks[k]
      if (b.kind !== 'body' || !b.anchor) continue
      const m = /^art-(\d+)$/.exec(b.anchor)
      if (m) nums.push(Number(m[1]))
    }
    if (!nums.length) throw new Error(`mesurerPlages : aucune tête d'article sous ${e.anchor} « ${e.label} »`)
    return { ordre: i + 1, anchor: e.anchor, level: e.level, from: Math.min(...nums), to: Math.max(...nums) }
  })
}

/**
 * Compare les plages MESURÉES au fichier de référence (§ 7.6) — jointure par ORDRE et
 * ANCRE, jamais par libellé (les libellés changent au § 7.4). Bloquant.
 */
export function comparerPlages(mesurees: Plage[], reference: Plage[]): void {
  if (mesurees.length !== reference.length)
    throw new Error(`§ 11.5 — ${mesurees.length} plages mesurées pour ${reference.length} au fichier de référence`)
  const ecarts: string[] = []
  mesurees.forEach((m, i) => {
    const r = reference[i]
    if (m.ordre !== r.ordre || m.anchor !== r.anchor)
      ecarts.push(`ordre ${m.ordre} : jointure rompue (mesuré ${m.anchor}, référence ${r.anchor})`)
    else if (m.level !== r.level || m.from !== r.from || m.to !== r.to)
      ecarts.push(`${m.anchor} : mesuré niv.${m.level} arts ${m.from}-${m.to}, référence niv.${r.level} arts ${r.from}-${r.to}`)
  })
  if (ecarts.length) throw new Error(`§ 11.5 — plages divergentes :\n  ${ecarts.join('\n  ')}`)
}

export interface EntreeIndex {
  subject: string
  ctRefs: unknown[]
}

/**
 * § 11.6 — l'index : chaque renvoi vise un article de `labels` (aucun renvoi mort), chaque
 * article de `labels` est cité par au moins un sujet (couverture INTÉGRALE), et la
 * convention de type mesurée (ctRefs = chaînes) est respectée.
 */
export function verifierIndex(indexEntries: EntreeIndex[], labels: Record<string, string>): void {
  const clesLabels = new Set(Object.keys(labels))
  const morts: string[] = []
  const nonChaines: string[] = []
  const cites = new Set<string>()
  for (const e of indexEntries) {
    for (const r of e.ctRefs) {
      if (typeof r !== 'string') {
        nonChaines.push(`« ${e.subject} » → ${String(r)} (${typeof r})`)
        continue
      }
      const ancre = `art-${r}`
      if (!clesLabels.has(ancre)) morts.push(`« ${e.subject} » → ${r}`)
      cites.add(ancre)
    }
  }
  if (nonChaines.length) throw new Error(`§ 11.6 — ctRefs hors convention (chaîne attendue) : ${nonChaines.join(' ; ')}`)
  if (morts.length) throw new Error(`§ 11.6 — renvois morts : ${morts.join(' ; ')}`)
  const nonCites = [...clesLabels].filter((k) => !cites.has(k))
  if (nonCites.length) throw new Error(`§ 11.6 — couverture non intégrale, articles sans sujet : ${nonCites.join(', ')}`)
}

/** § 11.7 — les sentinelles des sics subsistent mot pour mot dans le corps. */
export function verifierSentinelles(body: string): void {
  const absentes = SENTINELLES.filter((s) => !body.includes(s))
  if (absentes.length)
    throw new Error(`§ 11.7 — sentinelles absentes du corps (sic du J.O. « corrigé » ?) : ${absentes.map((s) => `« ${s} »`).join(' ; ')}`)
}
