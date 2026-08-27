/**
 * TITRE II DU DÉCRET RÉFORMANT LE DROIT DES SÛRETÉS → CODE DE COMMERCE (§ 7.8-7.9).
 *
 * Le décret (arts 17-18, TITRE II) réécrit le gage commercial :
 *   - le Titre VI du Livre Ier (« Du gage et des commissionnaires ») comporte désormais
 *     DEUX CHAPITRES (art. 17) : « Du gage et du nantissement » (arts 1611-1 et 1611-2)
 *     et « Des commissionnaires » (les sections II à IV existantes) ;
 *   - l'article 1611-1 REMPLACE l'article 91 ; l'article 1611-2 REMPLACE les articles
 *     93 à 95 ; « L'actuel article 92 est abrogé » (art. 17 in fine) ;
 *   - les alinéas 3, 4 et 5 de l'article 600 sont rédigés par l'art. 18 (l'article n'en
 *     avait que deux : ils s'AJOUTENT).
 *
 * La SOURCE DE VÉRITÉ des textes est le corps de la fiche du décret (DECRET_SURETES),
 * lu en base à l'exécution — jamais retapé. Les anciens articles 91-95 restent au corps
 * avec pastille + ancienne version repliée + note connexe (patron Loi Statut du
 * commerçant 2018, arts 1-8 du même Code). Les marques Vandal (status «modifié» nus sur
 * 92/93/94) sont REMPLACÉES par l'appareil complet, jamais empilées.
 *
 * ⚠️ § 13.11 TRANCHÉE le 26 août 2026 (« amendé » avec replis) — CE BROUILLON EST OBSOLÈTE, ne lancer QUE scripts/porter-titre-ii-code-commerce.ts : le statut des arts 91/93/94/95 (« remplacés ») n'existe pas
 * au vocabulaire (modifié/nouveau/abrogé). DEUX VARIANTES préparées :
 *   --variante=abroge  → status «abrogé»  + ArticleVersion ABROGE (note « Remplacé par… »)
 *   --variante=modifie → status «modifié» + AUCUNE ArticleVersion propre (le texte en
 *                        vigueur vit sous 1611-1/1611-2) — note connexe identique.
 * SANS le drapeau : la simulation présente les deux plans ; --apply REFUSE (le choix
 * appartient à Me Vaval).
 *
 * SIMULATION PAR DÉFAUT — aucune écriture sans --apply, que Me Vaval seule exécute :
 *   npx tsx scripts/data/decret-suretes/maj2026-ccom-apply.ts
 *   npx tsx scripts/data/decret-suretes/maj2026-ccom-apply.ts --variante=abroge --apply
 *
 * Clés d'annotation : le placement des chapitres (entre l'en-tête du Titre VI et ses
 * sections) laisse TOUTES les clés `sec-K|art-N` existantes inchangées — vérifié par
 * re-clé LUE de segmentAnnotated (jamais écrite à la main), avec CONTRE-ÉPREUVE (toc
 * volontairement faux → la garde secs===toc.length parle).
 */
import { createHash } from 'node:crypto'
import { writeFileSync, existsSync } from 'node:fs'
import { prisma } from '../../../src/lib/db'
import { segmentAnnotated, type Annotations, type TocEntry, type AnnBlock } from '../../../src/lib/legislation/annotated'
import { reindexDocument } from '../../../src/lib/search/reindex'
import { audit } from '../../../src/lib/auth/audit'

type BodyBlock = Extract<AnnBlock, { kind: 'body' }>
const md5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex')
const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

const APPLY = process.argv.includes('--apply')
const VAR_RAW = process.argv.find((a) => a.startsWith('--variante='))?.split('=')[1]
if (VAR_RAW && VAR_RAW !== 'abroge' && VAR_RAW !== 'modifie') throw new Error(`--variante=${VAR_RAW} inconnu (abroge|modifie)`)
const VAR_ARG = VAR_RAW as 'abroge' | 'modifie' | undefined

const DIR = 'scripts/data/decret-suretes'
const REF = 'Décret réformant le Droit des Sûretés (Le Moniteur, Spécial n° 7 du 14 mai 2020)'
const REF_COURT = 'D. du 14 mai 2020'
const MONITEUR = 'Le Moniteur, Spécial n° 7 du 14 mai 2020'
const TITLE_DEC = 'Décret réformant le Droit des Sûretés'
const EFFECTIVE = new Date('2020-05-14') // même hypothèse éditoriale que l'overlay CC (§ 13.1)

/** Empreinte du corps du Code de commerce MESURÉE le 26 août 2026 (maj2026-ccom-avant.json).
 *  PREMIÈRE assertion : on n'écrit pas sur un état qu'on n'a pas mesuré. */
const CCOM_BODY_MD5_MESURE = '9835702df9400242dc8bc2fb7d27e471'

const OLD_REPLACED = ['91', '93', '94', '95'] // remplacés par 1611-1 / 1611-2 — statut § 13.11
const PAIRS_CONNEXE: [string, string][] = [
  // [ancre C.com, ancre décret] — bijection § 7.9, vérifiée machine dans les deux sens
  ['art-1611-1', 'art-1611-1'],
  ['art-1611-2', 'art-1611-2'],
  ['art-600', 'art-600'],
  ['art-91', 'art-17'],
  ['art-92', 'art-17'],
  ['art-93', 'art-17'],
  ['art-94', 'art-17'],
  ['art-95', 'art-17'],
]

async function main() {
  // ── Gardes d'unicité (§ 10.6) — résolution PAR SOURCE, jamais par titre ni par date ──
  for (const src of ['CODE_COMMERCE_ANNOTE', 'DECRET_SURETES', 'CODE_CIVIL_ANNOTE']) {
    const n = await prisma.document.count({ where: { source: src } })
    if (n !== 1) throw new Error(`${n} documents pour source=${src} — il en faut exactement 1`)
  }
  const ccom = await prisma.document.findFirst({ where: { source: 'CODE_COMMERCE_ANNOTE' } })
  const dec = await prisma.document.findFirst({ where: { source: 'DECRET_SURETES' } })
  const ccivAvant = await prisma.document.findFirst({
    where: { source: 'CODE_CIVIL_ANNOTE' },
    select: { id: true, bodyOriginal: true, annotationsJson: true },
  })
  if (!ccom?.bodyOriginal || !ccom.annotationsJson) throw new Error('Code de commerce sans corps/annotations')
  if (!dec?.bodyOriginal || !dec.annotationsJson) throw new Error('Décret sûretés sans corps/annotations')
  if (!ccivAvant?.bodyOriginal || !ccivAvant.annotationsJson) throw new Error('Code civil introuvable')
  console.log(`✓ cibles relues : Code de commerce « ${ccom.titleFr} » (${ccom.id}) · Décret « ${dec.titleFr} » (${dec.id})`)
  // § 11.2 — le Code civil n'est JAMAIS visé : empreintes capturées, re-vérifiées en fin.
  const ccivHash = { body: md5(ccivAvant.bodyOriginal), ann: md5(ccivAvant.annotationsJson) }

  // ── PREMIÈRE ASSERTION : empreinte du corps de départ (ou relance détectée) ──
  const dejaApplique = ccom.bodyOriginal.includes('\nArt. 1611-1 (')
  if (!dejaApplique && md5(ccom.bodyOriginal) !== CCOM_BODY_MD5_MESURE)
    throw new Error(
      `corps du Code de commerce ≠ état mesuré le 26 août (${md5(ccom.bodyOriginal)} ≠ ${CCOM_BODY_MD5_MESURE}) — re-mesurer avant d'écrire`,
    )
  console.log(dejaApplique ? '✓ relance détectée (Art. 1611-1 déjà au corps)' : `✓ empreinte du corps de départ conforme (${CCOM_BODY_MD5_MESURE})`)

  const ann = JSON.parse(ccom.annotationsJson) as Annotations & Record<string, any>
  const annDec = JSON.parse(dec.annotationsJson) as Annotations & Record<string, any>

  // ── LECTURE DU DÉCRET (source de vérité § 7.8) : blocs segmentés de la fiche ──
  const decBlocks = segmentAnnotated(dec.bodyOriginal, annDec.toc)
  const decBody = decBlocks.filter((b): b is BodyBlock => b.kind === 'body' && !!b.anchor)
  const decAnchors = new Set(decBody.map((b) => b.anchor as string))
  const decBloc = (a: string): string => {
    const b = decBody.find((x) => x.anchor === a)
    if (!b) throw new Error(`ancre ${a} introuvable sur la fiche du décret`)
    return b.text
  }
  // Narration de l'art. 17 avalée par la segmentation en QUEUE des blocs cités — retirée.
  const NARRATION = /^(?:[a-z]\)\s|L[’']actuel\b|Le chapitre\b|–\s|Les? articles?\b.*ainsi rédigé)/
  const texteCite = (anchor: string, headRe: RegExp): string[] => {
    const lines = decBloc(anchor).split('\n')
    if (!headRe.test(lines[0])) throw new Error(`tête inattendue pour ${anchor} : « ${lines[0].slice(0, 60)} »`)
    lines[0] = lines[0].replace(headRe, '')
    while (lines.length && NARRATION.test(lines[lines.length - 1].trim())) lines.pop()
    const kept = lines.map((l) => l.trim()).filter(Boolean)
    if (!kept.length) throw new Error(`texte cité vide pour ${anchor}`)
    for (const l of kept) if (/ainsi rédigé|est abrogé\s*\.|intitulé\s*:|comporte\s*(?:deux|:)/.test(l)) throw new Error(`bloc ${anchor} pollué par la narration : « ${l.slice(0, 60)} »`)
    return kept
  }
  const t1611_1 = texteCite('art-1611-1', /^Article\s+1611-1\s*\.\-\s*/)
  const t1611_2 = texteCite('art-1611-2', /^Article\s+1611-2\s*\.\-\s*/)
  // Tolère la tête actuelle « Article 600.- » ET la tête rétablie « Article 600 alinéas 3, 4 et 5.- » (§ 7.3).
  const t600 = texteCite('art-600', /^Article\s+600(?:\s+alinéas\s+3\s*,\s*4\s+et\s+5)?\s*\.\-\s*/)
  // Sentinelles anti-circularité — fragments LUS du corps de la fiche le 26 août 2026.
  const SENTINELS: [string[], string][] = [
    [t1611_1, 'se faire payer par préférence à ses autres créanciers'],
    [t1611_1, 'Les effets de commerce donnés en nantissement sont recouvrables'],
    [t1611_2, 'application des nouveaux articles 1853, 1854 et 1855'],
    [t600, 'clause de réserve de propriété'],
    [t600, 'publiée au Registre des Sûretés Mobilières'],
    [t600, 'l’indemnité d’assurance subrogée au bien'],
  ]
  for (const [ls, s] of SENTINELS) if (!ls.join(' ').includes(s)) throw new Error(`sentinelle absente : « ${s} »`)
  if (t600.length !== 3) throw new Error(`art. 600 : ${t600.length} alinéas cités (3 attendus — art. 18 du décret)`)
  // Intitulés des chapitres : VERBATIM de l'article 17 du décret.
  const a17 = decBloc('art-17')
  const mCh1 = a17.match(/chapitre Ier intitulé\s*:\s*«\s*(.+?)\s*»/)
  const mCh2 = a17.match(/chapitre II intitulé\s*:\s*«\s*(.+?)\s*»/)
  if (!mCh1 || !mCh2) throw new Error('intitulés des chapitres introuvables dans l’article 17 du décret')
  const CH1 = `Chapitre Premier — ${mCh1[1]}`
  const CH2 = `Chapitre II — ${mCh2[1]}`
  console.log(`✓ décret lu : art. 1611-1 (${t1611_1.length} al.), art. 1611-2 (${t1611_2.length} al.), art. 600 al. 3-5 (${t600.length} al.), chapitres « ${mCh1[1]} » / « ${mCh2[1]} »`)

  // ── SEGMENTATION AVANT (référence de la re-clé et du no-collatéral) ──
  const segAvant = segmentAnnotated(ccom.bodyOriginal, ann.toc)
  const avantBody = segAvant.filter((b): b is BodyBlock => b.kind === 'body' && !!b.anchor)
  const avantTexte = new Map<string, string>()
  const avantCle = new Map<string, string>()
  for (const b of avantBody) {
    if (!avantTexte.has(b.anchor!)) avantTexte.set(b.anchor!, b.text)
    if (b.jurisKey && !avantCle.has(b.anchor!)) avantCle.set(b.anchor!, b.jurisKey)
  }
  const avantSecs = segAvant.filter((b) => b.kind === 'section').length
  if (avantSecs !== ann.toc.length) throw new Error(`état AVANT incohérent : ${avantSecs} en-têtes ≠ toc ${ann.toc.length}`)
  const clesProduitesAvant = new Set(avantBody.map((b) => b.jurisKey).filter(Boolean) as string[])
  const clesExistantes = [...Object.keys(ann.commentaires ?? {}), ...Object.keys(ann.jurisprudence ?? {})]
  const inatteignablesAvant = clesExistantes.filter((k) => !clesProduitesAvant.has(k))
  for (const n of ['91', '92', '93', '94', '95', '600']) if (!avantTexte.has(`art-${n}`)) throw new Error(`art. ${n} introuvable au corps du Code de commerce`)
  const snapshot = (n: string) => avantTexte.get(`art-${n}`)!

  // ── ÉDITION DU CORPS (indices calculés AVANT, splices de bas en haut) ──
  let lines = ccom.bodyOriginal.split('\n')
  const art1611_1 = [`Art. 1611-1 (${REF_COURT}) ${t1611_1[0]}`, ...t1611_1.slice(1)]
  const art1611_2 = [`Art. 1611-2 (${REF_COURT}) ${t1611_2[0]}`, ...t1611_2.slice(1)]
  if (!dejaApplique) {
    const lineOf = (label: string, apres = 0): number => {
      const i = lines.findIndex((l, k) => k >= apres && norm(l) === norm(label))
      if (i < 0) throw new Error(`ligne « ${label} » introuvable`)
      return i
    }
    for (const lbl of [CH1, CH2]) if (lines.some((l) => norm(l) === norm(lbl))) throw new Error(`« ${lbl} » déjà présent au corps`)
    const iTitreVI = lineOf('Titre VI — Du gage et des commissionnaires')
    const iSec12 = lineOf('Section Première — Du gage', iTitreVI)
    const iSec13 = lineOf('Section II — Des commissionnaires en général', iSec12)
    if (!(iTitreVI < iSec12 && iSec12 < iSec13)) throw new Error('ordre Titre VI / sections inattendu')
    const heads600 = lines.filter((l) => /^Article\s+600\.\-/.test(l.trim())).length
    if (heads600 !== 1) throw new Error(`${heads600} têtes « Article 600.- » (1 attendue)`)
    const i600 = lines.findIndex((l) => /^Article\s+600\.\-/.test(l.trim()))
    const l600 = snapshot('600').split('\n').length
    if (lines.slice(i600, i600 + l600).join('\n') !== snapshot('600')) throw new Error('bloc de l’article 600 non aligné sur la segmentation')
    // De bas en haut : art. 600 (+3 alinéas), Chapitre II, puis Chapitre Ier + 1611-1/1611-2.
    lines.splice(i600 + l600, 0, ...t600)
    lines.splice(iSec13, 0, CH2)
    lines.splice(iSec12, 0, CH1, ...art1611_1, ...art1611_2)
    console.log(`✓ corps édité : ${CH1} + art. 1611-1 (${art1611_1.length} l.) + art. 1611-2 (${art1611_2.length} l.) · ${CH2} · art. 600 +${t600.length} alinéas`)
  } else console.log('✓ corps déjà édité (relance) — aucune ligne touchée')
  const newBody = lines.join('\n')

  // ── NOUVELLE TOC : 2 chapitres (ancres NEUVES au-delà du max — jamais renumérotées) ──
  const maxSec = Math.max(...ann.toc.map((t: TocEntry) => Number((t.anchor.match(/^sec-(\d+)$/) ?? [])[1] ?? 0)))
  let next = maxSec
  const parLabel = new Map((ann.toc as TocEntry[]).map((t) => [norm(t.label), t]))
  const mk = (label: string): TocEntry => parLabel.get(norm(label)) ?? { level: 4, label, anchor: `sec-${++next}`, kind: 'chapitre' }
  const eCH1 = mk(CH1)
  const eCH2 = mk(CH2)
  const newToc: TocEntry[] = (ann.toc as TocEntry[]).filter((t) => t.anchor !== eCH1.anchor && t.anchor !== eCH2.anchor).map((t) => ({ ...t }))
  const idx12 = newToc.findIndex((t) => t.anchor === 'sec-12')
  const idx13 = newToc.findIndex((t) => t.anchor === 'sec-13')
  if (idx12 < 0 || idx13 < 0 || idx12 >= idx13) throw new Error('sec-12/sec-13 introuvables ou désordonnés dans la toc')
  newToc.splice(idx13, 0, eCH2) // de bas en haut
  newToc.splice(idx12, 0, eCH1)
  for (const t of newToc) if (['sec-12', 'sec-13', 'sec-14', 'sec-15', 'sec-16'].includes(t.anchor)) t.level = 5 // sections sous leurs chapitres

  // ── SIMULATION (§ 6.3, § 6.5) : segmentation projetée + re-clé LUE ──
  const segApres = segmentAnnotated(newBody, newToc)
  const apresBody = segApres.filter((b): b is BodyBlock => b.kind === 'body' && !!b.anchor)
  const secsApres = segApres.filter((b) => b.kind === 'section').length
  if (secsApres !== newToc.length) throw new Error(`segmentation ${secsApres}/${newToc.length} — ANNULÉ`)
  if (segApres.map((b) => b.text).join('\n') !== newBody) throw new Error('join ≠ corps (texte perdu) — ANNULÉ')
  const apresTexte = new Map<string, string>()
  const apresCle = new Map<string, string>()
  let doublons = 0
  for (const b of apresBody) {
    if (apresTexte.has(b.anchor!)) { doublons++; continue }
    apresTexte.set(b.anchor!, b.text)
    if (b.jurisKey) apresCle.set(b.anchor!, b.jurisKey)
  }
  if (doublons > 0) throw new Error(`${doublons} ancre(s) émise(s) deux fois — ANNULÉ`)
  // Ensemble d'ancres : AVANT ∪ {1611-1, 1611-2}, rien de plus, rien de moins.
  const attendues = new Set([...avantTexte.keys(), 'art-1611-1', 'art-1611-2'])
  for (const a of attendues) if (!apresTexte.has(a)) throw new Error(`ancre ${a} absente après édition — ANNULÉ`)
  for (const a of apresTexte.keys()) if (!attendues.has(a)) throw new Error(`ancre inattendue ${a} — ANNULÉ`)
  // NO-COLLATÉRAL : tout bloc hors périmètre est BYTE-IDENTIQUE ; l'art. 600 = ancien + 3 alinéas.
  // (En relance, le corps n'a pas été réédité : l'art. 600 porte DÉJÀ ses 5 alinéas.)
  const texte600Attendu = dejaApplique ? snapshot('600') : `${snapshot('600')}\n${t600.join('\n')}`
  if (dejaApplique && !snapshot('600').endsWith(t600.join('\n'))) throw new Error('relance : l’art. 600 ne finit pas par les alinéas 3-5 — état incohérent')
  for (const [a, t] of avantTexte) {
    if (a === 'art-600') {
      if (apresTexte.get(a) !== texte600Attendu) throw new Error('art. 600 ≠ ancien texte + 3 alinéas — ANNULÉ')
    } else if (apresTexte.get(a) !== t) throw new Error(`article ${a} modifié hors périmètre — ANNULÉ`)
  }
  // RE-CLÉ, LUE de segmentAnnotated : quelles clés bougent ? (attendu : AUCUNE — les
  // chapitres s'insèrent entre l'en-tête du Titre VI et ses sections.)
  const recle: [string, string][] = []
  for (const [a, k] of avantCle) if (apresCle.get(a) !== k) recle.push([k, apresCle.get(a) ?? '∅'])
  const clesProduitesApres = new Set(apresBody.map((b) => b.jurisKey).filter(Boolean) as string[])
  const mouvements = new Map<string, string>()
  for (const [vieux, neuf] of recle) mouvements.set(vieux, neuf)
  const perduesRaw = clesExistantes.filter((k) => !clesProduitesApres.has(mouvements.get(k) ?? k))
  const perdues = perduesRaw.filter((k) => !inatteignablesAvant.includes(k))
  if (perdues.length) throw new Error(`clés d'annotation perdues : ${perdues.join(', ')} — ANNULÉ`)
  // Application de la re-clé (no-op si aucune clé ne bouge) — jamais écrite à la main.
  for (const champ of ['commentaires', 'jurisprudence'] as const) {
    const rec = (ann[champ] ?? {}) as Record<string, unknown>
    for (const [vieux, neuf] of recle) if (rec[vieux] !== undefined) { rec[neuf] = rec[vieux]; delete rec[vieux] }
  }
  console.log(`✓ simulation : ${secsApres}/${newToc.length} en-têtes · ${apresTexte.size} ancres (${avantTexte.size}+2) · join OK · re-clé : ${recle.length} mouvement(s) · clés atteintes ${clesExistantes.length - inatteignablesAvant.length}/${clesExistantes.length}`)
  if (inatteignablesAvant.length) console.log(`  ⚠️ inatteignables AVANT (préexistant, non aggravé, signalé) : ${inatteignablesAvant.join(', ')}`)
  console.log(`  clés du périmètre : ${['art-91', 'art-92', 'art-93', 'art-94', 'art-95', 'art-600'].map((a) => `${a}→${apresCle.get(a)}`).join(' · ')}`)
  console.log(`  nouvelles clés : art-1611-1→${apresCle.get('art-1611-1')} · art-1611-2→${apresCle.get('art-1611-2')}`)

  // ── CONTRE-ÉPREUVE : simulation VOLONTAIREMENT fausse (entrées en FIN de toc) ──
  const tocFaux: TocEntry[] = [...(ann.toc as TocEntry[]), eCH1, eCH2]
  const segFaux = segmentAnnotated(newBody, tocFaux)
  const secsFaux = segFaux.filter((b) => b.kind === 'section').length
  if (secsFaux === tocFaux.length) throw new Error('CONTRE-ÉPREUVE MUETTE : la garde secs===toc.length ne détecte plus un toc faux')
  const fauxBody = segFaux.filter((b): b is BodyBlock => b.kind === 'body' && !!b.anchor)
  const cle1611Faux = fauxBody.find((b) => b.anchor === 'art-1611-1')?.jurisKey
  const art95Faux = fauxBody.find((b) => b.anchor === 'art-95')?.text ?? ''
  console.log(`✓ contre-épreuve : toc faux (entrées en fin) → ${secsFaux}/${tocFaux.length} — LA GARDE PARLE (secs ≠ toc.length)`)
  console.log(`  symptômes lus : jurisKey art-1611-1 = ${cle1611Faux} (au lieu de ${apresCle.get('art-1611-1')}) ; « ${CH2} » avalé par l'art. 95 : ${art95Faux.includes(CH2)}`)

  // ── navToc : le nœud Titre VI reçoit ses deux chapitres ──
  const patchNav = (items: any[]): boolean => {
    for (const it of items) {
      if (it.anchor === 'sec-11') {
        const enfants: any[] = it.children ?? []
        if (enfants[0]?.anchor === eCH1.anchor) return true // relance : nœud déjà recomposé
        const s12 = enfants.filter((c) => c.anchor === 'sec-12')
        const reste = enfants.filter((c) => c.anchor !== 'sec-12' && c.anchor !== eCH1.anchor && c.anchor !== eCH2.anchor)
        if (s12.length !== 1 || reste.length < 1) throw new Error(`nœud Titre VI inattendu (${enfants.length} enfants) — annulé`)
        it.children = [
          { label: CH1, anchor: eCH1.anchor, children: s12 },
          { label: CH2, anchor: eCH2.anchor, children: reste },
        ]
        return true
      }
      if (it.children?.length && patchNav(it.children)) return true
    }
    return false
  }
  if (!patchNav(ann.navToc)) throw new Error('nœud sec-11 (Titre VI) introuvable dans navToc')

  // ── Labels, statuts, anciennes versions, connexes C.com (les marques Vandal se REMPLACENT) ──
  const labelsCcom = (ann.labels = ann.labels ?? {}) as Record<string, string>
  const labelsAvantCount = Object.keys(labelsCcom).length
  ann.status = ann.status ?? {}
  ann.oldVersions = ann.oldVersions ?? {}
  const connexe = (ann.connexe = ann.connexe ?? {}) as Record<string, { label?: string; text: string; docId?: string; anchor?: string }[]>
  const vandalAvant = { 'art-92': ann.status['art-92'], 'art-93': ann.status['art-93'], 'art-94': ann.status['art-94'] }
  labelsCcom['art-1611-1'] = 'Article 1611-1'
  labelsCcom['art-1611-2'] = 'Article 1611-2'
  ann.status['art-1611-1'] = 'nouveau'
  ann.status['art-1611-2'] = 'nouveau'
  ann.status['art-92'] = 'abrogé'
  ann.status['art-600'] = 'modifié'
  const statutRemplaces = (v: 'abroge' | 'modifie') => (v === 'abroge' ? 'abrogé' : 'modifié')
  if (VAR_ARG) for (const n of OLD_REPLACED) ann.status[`art-${n}`] = statutRemplaces(VAR_ARG)
  for (const n of ['91', '92', '93', '94', '95', '600']) if (!ann.oldVersions[`art-${n}`]) ann.oldVersions[`art-${n}`] = snapshot(n)
  const setConnexe = (a: string, text: string, anchor: string) => {
    const arr = (connexe[a] = (connexe[a] ?? []).filter((b) => b.docId !== dec.id))
    arr.push({ label: `${TITLE_DEC} (${MONITEUR})`, text, docId: dec.id, anchor })
  }
  setConnexe('art-1611-1', `Inséré par l’article 17 du Décret réformant le Droit des Sûretés (remplace l’article 91) — ${MONITEUR}.`, 'art-1611-1')
  setConnexe('art-1611-2', `Inséré par l’article 17 du Décret réformant le Droit des Sûretés (remplace les articles 93 à 95) — ${MONITEUR}.`, 'art-1611-2')
  setConnexe('art-91', `Remplacé par l’article 1611-1, créé par l’article 17 du Décret réformant le Droit des Sûretés — ${MONITEUR}.`, 'art-17')
  setConnexe('art-92', `Abrogé par l’article 17 du Décret réformant le Droit des Sûretés (« L’actuel article 92 est abrogé ») — ${MONITEUR}.`, 'art-17')
  for (const n of ['93', '94', '95']) setConnexe(`art-${n}`, `Remplacé par l’article 1611-2, créé par l’article 17 du Décret réformant le Droit des Sûretés — ${MONITEUR}.`, 'art-17')
  setConnexe('art-600', `Alinéas 3, 4 et 5 rédigés par l’article 18 du Décret réformant le Droit des Sûretés — ${MONITEUR}.`, 'art-600')

  // ── Connexes DÉCRET → C.com (§ 7.9, miroir exact des paires) ──
  const LABEL_CCOM = `${ccom.titleFr} (texte à jour)`
  const cxDec = (annDec.connexe = annDec.connexe ?? {}) as Record<string, { label?: string; text: string; docId?: string; anchor?: string }[]>
  const texteDec: Record<string, string> = {
    'art-1611-1': 'Texte porté au Code de commerce : article 1611-1 (remplace l’article 91).',
    'art-1611-2': 'Texte porté au Code de commerce : article 1611-2 (remplace les articles 93 à 95).',
    'art-600': 'Article 600 du Code de commerce, texte à jour (alinéas 3 à 5).',
    'art-91': 'Article 91 du Code de commerce — remplacé par l’article 1611-1.',
    'art-92': 'Article 92 du Code de commerce — abrogé.',
    'art-93': 'Article 93 du Code de commerce — remplacé par l’article 1611-2.',
    'art-94': 'Article 94 du Code de commerce — remplacé par l’article 1611-2.',
    'art-95': 'Article 95 du Code de commerce — remplacé par l’article 1611-2.',
  }
  for (const d of new Set(PAIRS_CONNEXE.map(([, dAnchor]) => dAnchor))) cxDec[d] = (cxDec[d] ?? []).filter((b) => b.docId !== ccom.id)
  for (const [cAnchor, dAnchor] of PAIRS_CONNEXE) cxDec[dAnchor].push({ label: LABEL_CCOM, text: texteDec[cAnchor], docId: ccom.id, anchor: cAnchor })

  // ── BIJECTION § 7.9 (machine, les deux sens, 0 lien mort) ──
  const pairesCcom = new Set<string>()
  for (const [a, blocs] of Object.entries(connexe)) for (const b of blocs) if (b.docId === dec.id) pairesCcom.add(`${a}|${b.anchor}`)
  const pairesDec = new Set<string>()
  for (const [d, blocs] of Object.entries(cxDec)) for (const b of blocs) if (b.docId === ccom.id) pairesDec.add(`${b.anchor}|${d}`)
  for (const p of pairesCcom) if (!pairesDec.has(p)) throw new Error(`bijection rompue (C.com→décret sans réciproque) : ${p}`)
  for (const p of pairesDec) if (!pairesCcom.has(p)) throw new Error(`bijection rompue (décret→C.com sans original) : ${p}`)
  for (const p of pairesCcom) {
    const [cA, dA] = p.split('|')
    if (!apresTexte.has(cA)) throw new Error(`lien mort : ancre C.com ${cA}`)
    if (!decAnchors.has(dA)) throw new Error(`lien mort : ancre décret ${dA}`)
  }
  console.log(`✓ bijection connexes C.com↔décret : ${pairesCcom.size} paires, réciprocité complète, 0 lien mort`)

  // ── Plans d'ArticleVersion (les DEUX variantes § 13.11 — préparées, PAS tranchées) ──
  type PlanAV = { anchor: string; mode: 'amende' | 'abroge'; note?: string }
  const plan600: PlanAV = { anchor: 'art-600', mode: 'amende' }
  const plan92: PlanAV = { anchor: 'art-92', mode: 'abroge', note: `Abrogé par l’article 17 du Décret réformant le Droit des Sûretés — ${MONITEUR}.` }
  const planRemplaces: PlanAV[] = OLD_REPLACED.map((n) => ({
    anchor: `art-${n}`,
    mode: 'abroge',
    note: `Remplacé par l’article ${n === '91' ? '1611-1' : '1611-2'} du Code de commerce (article 17 du Décret réformant le Droit des Sûretés — ${MONITEUR}).`,
  }))
  const planA: PlanAV[] = [plan600, plan92, ...planRemplaces] // --variante=abroge
  const planB: PlanAV[] = [plan600, plan92] // --variante=modifie : pas d'AV propre pour 91/93-95
  const plan = VAR_ARG === 'modifie' ? planB : planA
  const newBody600 = texte600Attendu // texte à jour de l'art. 600 (ancien + alinéas 3-5)

  // ── RAPPORT ──
  console.log('\n──────── RAPPORT (avant écriture) ────────')
  console.log(`Corps : ${ccom.bodyOriginal.split('\n').length} → ${lines.length} lignes (+${lines.length - ccom.bodyOriginal.split('\n').length})`)
  console.log(`Toc : ${ann.toc.length} → ${newToc.length} (+ « ${CH1} » ${eCH1.anchor}, « ${CH2} » ${eCH2.anchor} ; sections sec-12..16 au niveau 5)`)
  console.log(`Labels : ${labelsAvantCount} → ${Object.keys(labelsCcom).length} (art-1611-1, art-1611-2)`)
  console.log(`Marques Vandal remplacées (jamais empilées) : ${JSON.stringify(vandalAvant)} → 92=abrogé, 93/94=variante § 13.11`)
  console.log(`Statuts posés : 1611-1/1611-2=nouveau · 92=abrogé · 600=modifié · 91/93/94/95=${VAR_ARG ? statutRemplaces(VAR_ARG) : 'NON TRANCHÉ (§ 13.11)'}`)
  console.log(`oldVersions : art-91/92/93/94/95/600 (texte Vandal verbatim, lignes « Nouveau » d'édition comprises)`)
  console.log(`Connexes C.com : 8 blocs · Connexes décret : ${PAIRS_CONNEXE.length} blocs (art-17 ×5, art-1611-1, art-1611-2, art-600)`)
  console.log(`Variante A (--variante=abroge)  : ${planA.length} ArticleVersion (600 amendé + 92/91/93/94/95 ABROGE avec note)`)
  console.log(`Variante B (--variante=modifie) : ${planB.length} ArticleVersion (600 amendé + 92 ABROGE) — 91/93-95 sans AV propre (le texte en vigueur vit sous 1611-1/1611-2)`)

  if (!APPLY) {
    console.log('\nSIMULATION — rien n’a été écrit (base comme fichiers). Relancer avec --variante=… --apply (Me Vaval).')
    await prisma.$disconnect()
    return
  }
  if (!VAR_ARG) throw new Error('--apply exige --variante=abroge|modifie — le statut des arts 91/93-95 est la question § 13.11, tranchée par Me Vaval seule')

  // ── SAUVEGARDE HORODATÉE AVANT TRANSACTION (§ 10.7) ──
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = `${DIR}/maj2026-ccom-backup-${stamp}.json`
  if (existsSync(backupPath)) throw new Error(`${backupPath} existe déjà`)
  const avs0 = await prisma.articleVersion.findMany({ where: { documentId: ccom.id } })
  writeFileSync(
    backupPath,
    JSON.stringify(
      {
        codeCommerce: { id: ccom.id, bodyOriginal: ccom.bodyOriginal, annotationsJson: ccom.annotationsJson, articleVersions: avs0 },
        decret: { id: dec.id, annotationsJson: dec.annotationsJson },
      },
      null,
      1,
    ),
  )
  console.log(`✓ sauvegarde écrite : ${backupPath}`)

  // ── TRANSACTION UNIQUE (§ 10.4) — audit compté avant/après (audit() avale ses erreurs) ──
  const auditAvant = await prisma.auditLog.count()
  await prisma.$transaction(
    async (tx) => {
      // Idempotence : retirer les versions écrites par CE décret avant de les recréer.
      await tx.articleVersion.deleteMany({
        where: { documentId: ccom.id, anchor: { in: ['art-600', 'art-92', ...OLD_REPLACED.map((n) => `art-${n}`)] }, amendedByNumber: REF },
      })
      for (const p of plan) {
        const rows = await tx.articleVersion.findMany({ where: { documentId: ccom.id, anchor: p.anchor }, select: { seq: true } })
        let seq = rows.length ? Math.max(...rows.map((r) => r.seq)) : -1
        if (p.mode === 'amende') {
          if (rows.length === 0)
            await tx.articleVersion.create({
              data: { documentId: ccom.id, anchor: p.anchor, label: labelsCcom[p.anchor] ?? null, body: snapshot(p.anchor.slice(4)), status: 'MODIFIE', seq: ++seq, origin: 'MANUAL' },
            })
          await tx.articleVersion.updateMany({ where: { documentId: ccom.id, anchor: p.anchor, status: 'EN_VIGUEUR' }, data: { status: 'MODIFIE' } })
          await tx.articleVersion.create({
            data: {
              documentId: ccom.id, anchor: p.anchor, label: labelsCcom[p.anchor] ?? null, body: newBody600,
              status: 'EN_VIGUEUR', effectiveDate: EFFECTIVE, amendedByDocId: dec.id, amendedByNumber: REF, origin: 'MANUAL', seq: ++seq,
            },
          })
        } else if (rows.length === 0) {
          await tx.articleVersion.create({
            data: {
              documentId: ccom.id, anchor: p.anchor, label: labelsCcom[p.anchor] ?? null, body: snapshot(p.anchor.slice(4)),
              status: 'ABROGE', effectiveDate: EFFECTIVE, amendedByDocId: dec.id, amendedByNumber: REF, note: p.note ?? null, seq: 0,
            },
          })
        } else {
          await tx.articleVersion.updateMany({
            where: { documentId: ccom.id, anchor: p.anchor, status: 'EN_VIGUEUR' },
            data: { status: 'ABROGE', effectiveDate: EFFECTIVE, amendedByDocId: dec.id, amendedByNumber: REF, note: p.note ?? null },
          })
        }
      }
      ann.toc = newToc
      await tx.document.update({ where: { id: ccom.id }, data: { bodyOriginal: newBody, annotationsJson: JSON.stringify(ann) } })
      await tx.document.update({ where: { id: dec.id }, data: { annotationsJson: JSON.stringify(annDec) } })
      await audit(
        { action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: ccom.id,
          meta: { source: 'CODE_COMMERCE_ANNOTE', motif: `TITRE II du Décret sûretés porté (arts 1611-1/1611-2 créés, 92 abrogé, 91/93-95 ${statutRemplaces(VAR_ARG)}, 600 al. 3-5) — variante=${VAR_ARG}`, articleVersions: plan.length } },
        tx,
      )
      await audit(
        { action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: dec.id,
          meta: { source: 'DECRET_SURETES', motif: `blocs connexes décret→Code de commerce (§ 7.9) : ${PAIRS_CONNEXE.length} paires` } },
        tx,
      )
    },
    { timeout: 120_000, maxWait: 30_000 },
  )
  const auditApres = await prisma.auditLog.count()
  console.log(`✓ transaction commise · journal d'audit : ${auditAvant} → ${auditApres} (+${auditApres - auditAvant} ; 2 attendues — audit() avale ses erreurs, le compte fait foi)`)

  // ── RECOMPTES APRÈS TRANSACTION (§ 10.4) ──
  // Chaque entrée du plan écrit EXACTEMENT une ligne portant amendedByNumber=REF (le cliché
  // MODIFIE de l'art. 600, lui, n'en porte pas — il photographie l'état d'avant le décret).
  const avRef = await prisma.articleVersion.count({ where: { documentId: ccom.id, amendedByNumber: REF } })
  if (avRef !== plan.length) throw new Error(`ArticleVersion recomptées : ${avRef} ≠ ${plan.length} attendues`)
  const snap600 = await prisma.articleVersion.count({ where: { documentId: ccom.id, anchor: 'art-600', status: 'MODIFIE' } })
  if (snap600 < 1) throw new Error('cliché MODIFIE de l’art. 600 absent')
  const relu = await prisma.document.findFirst({ where: { source: 'CODE_COMMERCE_ANNOTE' }, select: { bodyOriginal: true, annotationsJson: true } })
  const annRelu = JSON.parse(relu!.annotationsJson!)
  const segRelu = segmentAnnotated(relu!.bodyOriginal!, annRelu.toc)
  const secsRelu = segRelu.filter((b) => b.kind === 'section').length
  if (secsRelu !== annRelu.toc.length) throw new Error(`relecture : ${secsRelu}/${annRelu.toc.length} en-têtes`)
  if (segRelu.map((b) => b.text).join('\n') !== relu!.bodyOriginal) throw new Error('relecture : join ≠ corps')
  const ancresRelu = new Set(segRelu.filter((b): b is BodyBlock => b.kind === 'body' && !!b.anchor).map((b) => b.anchor as string))
  if (!ancresRelu.has('art-1611-1') || !ancresRelu.has('art-1611-2')) throw new Error('relecture : ancres 1611-1/1611-2 absentes')
  // § 11.2 — le Code civil est byte-identique (JAMAIS visé par cette séance).
  const ccivApres = await prisma.document.findFirst({ where: { source: 'CODE_CIVIL_ANNOTE' }, select: { bodyOriginal: true, annotationsJson: true } })
  if (md5(ccivApres!.bodyOriginal!) !== ccivHash.body || md5(ccivApres!.annotationsJson!) !== ccivHash.ann)
    throw new Error('LE CODE CIVIL A BOUGÉ PENDANT LA SÉANCE — vérifier immédiatement (aucune écriture de ce script ne le vise)')
  console.log(`✓ recomptes : ${avRef} ArticleVersion du décret · ${ancresRelu.size} ancres · Code civil byte-identique (${ccivHash.body})`)

  // ── HORS transaction : réindexation (buildSearchText + clearSearchCache) ──
  await reindexDocument(ccom.id)
  await reindexDocument(dec.id)
  console.log('✓ reindexDocument : Code de commerce + décret (cache de recherche purgé)')
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error('ÉCHEC :', e instanceof Error ? e.message : e); await prisma.$disconnect(); process.exit(1) })
