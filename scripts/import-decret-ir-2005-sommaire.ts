/**
 * Décret du 29 septembre 2005 relatif à l'Impôt sur le Revenu — sommaire, préambule et
 * appareil (document `cms43ptub00008lo8tv3y25kk`, source `DECRET_IMPOT_REVENU_2005`).
 *
 *     npx tsx scripts/import-decret-ir-2005-sommaire.ts            # simulation, n'écrit rien
 *     npx tsx scripts/import-decret-ir-2005-sommaire.ts --apply    # lancé par Me Vaval, elle seule
 *
 * ─── CE QUE CE SCRIPT N'EST PAS ────────────────────────────────────────────────────────────
 * Ce n'est PAS un import : le décret est au corpus depuis le 28 juillet 2026, avec son corps
 * (749 lignes, 191 têtes d'article), son sommaire (32 entrées) et son index (369 sujets,
 * couverture 191/191). Le script fait un `update` sur la fiche existante, et **jamais** de
 * `document.create` : deux fiches au même titre, à la même référence de Moniteur et aux mêmes
 * numéros d'articles, dont l'une s'arrêterait à l'article 126, égareraient une lectrice sur deux.
 *
 * ─── LES DIX ÉTAPES DU § 7 ─────────────────────────────────────────────────────────────────
 *  7.1  Le préambule (27 lignes, 19 visas, 2 considérants) versé en tête du corps — il n'existe
 *       nulle part au corpus (« Vu » 0, « Considérant » 0, « DÉCRÈTE » 0). VERBATIM depuis le
 *       Journal officiel, « Loi du 26 août 1879 » comprise : le faisceau penche pour 1870, mais
 *       on n'amende pas le texte officiel sur une inférence — c'est la doctrine déjà appliquée à
 *       l'article 104, où le J.O. porte la coquille et où le corps ne la suit pas. Le dossier va
 *       en note, sous l'ancre du préambule (décision de Me Vaval du 25 août 2026).
 *  7.2  `adoptionDate = 2005-09-29`. Le champ est vide ; `publicationDate` (2005-10-05), `titleFr`
 *       et `number` ne bougent pas.
 *  7.3  La ligne 185 : le corps la coupe en deux (185 + 186). Les deux moitiés sont fondues, sans
 *       le point final que le J.O. ne porte pas. La sous-section III « Modalités d'imposition »
 *       (art. 92-96), que l'édition de 2018 ne reprend pas, ne revient PAS au corps — décision de
 *       Me Vaval ; une note sous l'article 92 le dit au lecteur, sans imputer d'intention.
 *  7.4  Les 20 sous-sections et les 3 lettres A)/B)/C) entrent au `toc` (niveau 4) et au `navToc`,
 *       INTERCALÉES dans l'ordre du corps ; le préambule prend une entrée de niveau 1. Puis les
 *       6 clés de `commentaires` sont re-clées.
 *  7.5  Les débris d'océrisation, et eux seuls — 7 corrections. Les deux propositions du prompt
 *       sur les articles 116 et 86 sont RÉFUTÉES et ne sont pas appliquées (voir plus bas).
 *  7.6  Les 4 rédactions de 2005 que la base a perdues, en annotation.
 *  7.7  L'annotation fautive de l'article 8 (phrase non sourcée) + purge du doublon de l'art. 49.
 *  7.8  L'appareil de l'édition Paillant sorti du dispositif, par UNION DE NUMÉROS DE LIGNE.
 *  7.9  Le tableau de l'article 29 : ligne coupée recollée, « d' » rendu ; les taux restent tels
 *       quels — le corps écrit « 12.5% » là où le J.O. écrit « 12,5% », et « préserver » en
 *       changeant serait faux.
 *  7.10 `CrossRef` vers la fiche d'Index du Moniteur, résolue par `number` ET `type`.
 *
 * ─── DEUX CORRECTIONS DU § 7.5 QUE CE SCRIPT N'APPLIQUE PAS ────────────────────────────────
 *  · art. 116 « retenue libératoire de 20% libératoire » : la couche texte du fac-similé ET la
 *    transcription intégrale de 2005 écrivent le doublon. Il est de 2005, pas de l'océrisation.
 *  · art. 86 « bordereau complémentaire DE l'impôt majoré » : le fac-similé, la transcription et
 *    l'article jumeau 147 lisent tous « de ». Et la chaîne paraît DEUX fois au corps (art. 86 et
 *    art. 147, hors plage contrôlée) : un remplacement littéral toucherait aussi le 147.
 *  Dans les deux cas, seule la transcription .docx de la cliente fait exception — et ce n'est pas
 *  un témoin indépendant du fac-similé, c'est une reprise nettoyée de sa couche texte.
 *
 * ─── LE PIÈGE QUI COMMANDE TOUT (§ 6) ──────────────────────────────────────────────────────
 * `segmentAnnotated` compose la clé d'annotation : `${curSection}|${artAnchor}`. Insérer un
 * en-tête entre une Section et ses articles change la clé de tous ces articles — 5 des 6
 * annotations existantes deviendraient orphelines, et les passages abrogés de l'édition Paillant,
 * seul appareil du document, disparaîtraient de l'affichage. Les clés sont donc LUES du résultat
 * de la fonction, jamais écrites à la main (interdit n° 7).
 *
 * ─── PIÈCES CONSOMMÉES ─────────────────────────────────────────────────────────────────────
 *   scripts/data/decret-ir-2005/toc-cible.json            (sim_toc.ts)
 *   scripts/data/decret-ir-2005/appareil-et-notes.json    (build_appareil.py)
 *   scripts/data/decret-ir-2005/oracle-index-cliente.json (oracle_index.py)
 *   scripts/data/decret-ir-2005/confrontation-191.json    (confronter_191.py)
 */
import { PrismaClient, type Prisma } from '@prisma/client'
import { createHash } from 'node:crypto'
import { accessSync, constants, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  parseAnnotations,
  segmentAnnotated,
  type CrossRefEntry,
  type IndexEntry,
  type NavGroup,
  type NavItem,
  type TocEntry,
} from '../src/lib/legislation/annotated'
import { articleAnchorFromHeading } from '../src/lib/doc/anchors'
import { buildSearchText } from '../src/lib/search/normalize'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')

const DIR = join(process.cwd(), 'scripts/data/decret-ir-2005')
const SOURCE = 'DECRET_IMPOT_REVENU_2005'
const DOC_ID = 'cms43ptub00008lo8tv3y25kk'
const ADOPTION = new Date('2005-09-29T00:00:00.000Z')
const INDEX_MONITEUR = { number: 'LM2005-SP10', type: 'INDEX' as const }
const INDEX_TITRE = 'Décret modifiant celui du 29 septembre 1986 relatif à l’Impôt sur le Revenu'

const md5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex')
const lire = <T>(f: string): T => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as T
const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
const apos = (s: string) => s.replace(/[’‘]/g, "'")
const plat = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// ══════════════════════════════════════════════════════════════════════════════════════════
// Types des pièces de préparation
// ══════════════════════════════════════════════════════════════════════════════════════════
type TocCible = {
  corpsAttendu: {
    premiereLigne: string
    preambuleNbLignes: number
    ligneTronqueeAvant: [string, string]
    ligneTronqueeApres: string
    lignesAvant: number
    lignesApres: number
    caracteresAvant: number
    caracteresApres: number
    md5Depart: string
    md5: string
  }
  toc: TocEntry[]
  navToc: NavGroup[]
  recle: { avant: string; apres: string; change: boolean; nbEntrees: number }[]
  jurisKeysArticles: Record<string, { actuelle: string; apres: string; change: boolean }>
  ancresNeuvesParAncre: Record<string, { role: string; ligneCorpsCible: number; libelle: string }>
  entreesNeuves: { anchor: string; level: number; role: string; ligneCorpsCible: number; label: string }[]
}
type BlocAppareil = {
  id: string
  famille: string
  article_hote: string
  portee: string
  lignes: number[]
  texte_exact?: string
  extrait?: string
  ligne_avant?: string
  ligne_apres?: string
  devenir: string
}
type Appareil = {
  preambule: {
    texte: string
    lignes: number
    note_a_porter_en_crossRefs: { ancre: string; note: string }
    toc: { label: string; anchor: string; level: number; kind: string }
    navToc: { label: string; anchor: string }
  }
  appareil: BlocAppareil[]
  commentaires: Record<string, { texte: string; origine: string; bloc?: string; devenir?: string }[]>
  correction_de_l_annotation_de_l_article_8: { avant: string; apres: string }[]
  purge_du_doublon: { cle_actuelle: string; entree_a_retirer: string; occurrences_apres: number }[]
  debris_ocr: { id: string; article: string; ligne: number; statut: string; avant: string; apres?: string }[]
  debris_candidats_hors_prompt: {
    id: string; article: string; ligne?: number; lignes?: number[]; avant: string; apres: string; statut: string
  }[]
}
type Oracle = {
  entrees: { ligne: number; sujet: string; queue: string; refs: number[]; preambule: boolean }[]
  mesures: { entrees: number; renvois: number }
}
type Annotations = {
  title: string
  annotationAuthor: string
  navToc: NavGroup[]
  toc: TocEntry[]
  connexes: unknown[]
  jurisprudence: Record<string, unknown>
  indexEntries: IndexEntry[]
  crossRefs: CrossRefEntry[]
  labels: Record<string, string>
  commentaires: Record<string, string[]>
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// Fabrique du corps cible — chaque mutation est une ACTION sur une ligne, jamais un
// rechercher-remplacer global. Motif : `filet-1` est un sous-ensemble strict de `filet-2` et
// se trouve DEUX fois dans le corps ; « bordereau complémentaire de l'impôt majoré » aussi
// (art. 86 et art. 147). Un `replace()` littéral amputerait un article hors plage contrôlée.
// ══════════════════════════════════════════════════════════════════════════════════════════
type Action =
  | { kind: 'retrait'; par: string; hote: string }
  | { kind: 'remplacement'; par: string; hote: string; texte: string[]; attendu?: string }

class Corps {
  readonly lignes: string[]
  private readonly actions = new Map<number, Action>()
  constructor(lignes: string[]) {
    this.lignes = lignes
  }
  /** Ligne n (1-indexée) du corps cible. */
  g(n: number): string {
    const l = this.lignes[n - 1]
    if (l === undefined) throw new Error(`ligne ${n} hors du corps (${this.lignes.length} lignes)`)
    return l
  }
  /** Retire la ligne n. Rend `false` si une TRONCATURE l'emporte — les lignes 68, 95, 398 et
   *  619 portent du DISPOSITIF avant l'appareil qui s'y est collé : les retirer entières
   *  amputerait le décret. */
  retirer(n: number, par: string, hote: string): boolean {
    const deja = this.actions.get(n)
    if (deja?.kind === 'remplacement') return false
    this.actions.set(n, { kind: 'retrait', par, hote })
    return true
  }
  remplacer(n: number, texte: string[], par: string, hote: string, attendu?: string) {
    const deja = this.actions.get(n)
    if (deja && deja.kind === 'remplacement')
      throw new Error(`ligne ${n} : deux remplacements concurrents (${deja.par} et ${par})`)
    this.actions.set(n, { kind: 'remplacement', par, hote, texte, attendu })
  }
  get nbActions() {
    return this.actions.size
  }
  parHote(): Map<string, Action[]> {
    const m = new Map<string, Action[]>()
    for (const a of this.actions.values()) {
      const l = m.get(a.hote) ?? []
      l.push(a)
      m.set(a.hote, l)
    }
    return m
  }
  /** Applique toutes les actions en UN passage, du haut vers le bas. */
  rendu(): string[] {
    const out: string[] = []
    for (let n = 1; n <= this.lignes.length; n++) {
      const a = this.actions.get(n)
      if (!a) {
        out.push(this.g(n))
        continue
      }
      if (a.kind === 'retrait') continue
      out.push(...a.texte)
    }
    return out
  }
}

async function main() {
  const tocCible = lire<TocCible>('toc-cible.json')
  const prep = lire<Appareil>('appareil-et-notes.json')
  const oracle = lire<Oracle>('oracle-index-cliente.json')

  // ════════════════════════════════════════════════════════════════════════════════════════
  // 0. LA FICHE, ET LA PREMIÈRE ASSERTION DE TOUTES
  // ════════════════════════════════════════════════════════════════════════════════════════
  const candidats = await prisma.document.findMany({ where: { source: SOURCE }, select: { id: true } })
  if (candidats.length !== 1)
    throw new Error(`§ 10.6 — ${candidats.length} document(s) de source ${SOURCE}, il en faut exactement 1`)
  if (candidats[0].id !== DOC_ID)
    throw new Error(`§ 10.6 — la fiche de source ${SOURCE} est ${candidats[0].id}, attendu ${DOC_ID}`)
  const doc = await prisma.document.findUniqueOrThrow({ where: { id: DOC_ID } })

  // ⚠️ AVANT TOUT LE RESTE. Un corps de 749 lignes commençant par « TITRE I » satisfait
  // n'importe quel contrat de forme ; seule l'empreinte dit que c'est bien CE corps-là, celui
  // contre lequel les quatre pièces de préparation ont été calibrées.
  const md5Depart = md5(doc.bodyOriginal)
  if (md5Depart !== tocCible.corpsAttendu.md5Depart)
    throw new Error(
      `§ 11.0 — corps de départ : md5 ${md5Depart}, attendu ${tocCible.corpsAttendu.md5Depart}. ` +
        'Le corps en base a changé depuis le relevé du 25 août 2026 : les numéros de ligne des ' +
        'pièces de préparation ne désignent plus les mêmes passages. Rejouer sim_toc.ts et ' +
        'build_appareil.py contre le corps courant avant d’aller plus loin.',
    )

  const garde = await prisma.document.count({
    where: {
      type: 'LEGISLATION',
      OR: [{ titleFr: { contains: 'Impôt sur le Revenu' } }, { number: { contains: '29 septembre 2005' } }],
    },
  })
  if (garde !== 1) throw new Error(`§ 10.6 — ${garde} fiches candidates, il en faut exactement 1`)

  const annAvant = parseAnnotations(doc.annotationsJson) as unknown as Annotations | null
  if (!annAvant) throw new Error('annotationsJson illisible')
  const brutAvant = JSON.parse(doc.annotationsJson!) as Annotations

  const lignesAvant = doc.bodyOriginal.split('\n')
  if (lignesAvant.length !== tocCible.corpsAttendu.lignesAvant)
    throw new Error(`corps : ${lignesAvant.length} lignes, attendu ${tocCible.corpsAttendu.lignesAvant}`)

  // ════════════════════════════════════════════════════════════════════════════════════════
  // § 7.1 + § 7.3 — préambule en tête, ligne 185 fondue. Contrat de corps du `toc`.
  // ════════════════════════════════════════════════════════════════════════════════════════
  const preambule = prep.preambule.texte.split('\n')
  if (preambule.length !== tocCible.corpsAttendu.preambuleNbLignes)
    throw new Error(`préambule : ${preambule.length} lignes, attendu ${tocCible.corpsAttendu.preambuleNbLignes}`)
  if (preambule[0] !== tocCible.corpsAttendu.premiereLigne)
    throw new Error(`préambule : 1ʳᵉ ligne « ${preambule[0]} », attendue « ${tocCible.corpsAttendu.premiereLigne} »`)
  if (!prep.preambule.texte.includes('26 août 1879'))
    throw new Error('§ 7.1 — le visa doit être versé VERBATIM depuis le J.O., avec « 1879 » (décision du 25 août)')
  for (const cle of ['Vu', 'Considérant', 'DÉCRÈTE', 'BONIFACE'])
    if (doc.bodyOriginal.includes(cle))
      throw new Error(`§ 7.1 — « ${cle} » figure déjà au corps : le préambule y serait en double`)

  const [t185, t186] = tocCible.corpsAttendu.ligneTronqueeAvant
  if (lignesAvant[184] !== t185 || lignesAvant[185] !== t186)
    throw new Error(`§ 7.3 — les lignes 185/186 ne sont pas celles attendues :\n  ${lignesAvant[184]}\n  ${lignesAvant[185]}`)
  const fusion = `${t185} ${t186.replace(/\.$/, '')}`
  if (fusion !== tocCible.corpsAttendu.ligneTronqueeApres)
    throw new Error(`§ 7.3 — la fusion produit « ${fusion} »`)

  const lignesCible = [...lignesAvant]
  lignesCible.splice(184, 2, fusion)
  const corpsAvecPreambule = [...preambule, ...lignesCible]
  const md5Contrat = md5(corpsAvecPreambule.join('\n'))
  if (md5Contrat !== tocCible.corpsAttendu.md5)
    throw new Error(
      `§ 11.0 bis — corps après §§ 7.1/7.3 : md5 ${md5Contrat}, attendu ${tocCible.corpsAttendu.md5}. ` +
        'C’est le seul état sous lequel le `toc` de toc-cible.json s’apparie.',
    )

  // DEUX décalages, pas un : le préambule seul avant la ligne 185 (+27), puis la fusion
  // (185+186 → une seule, la 212), puis +26 au-delà. Un offset unique décalerait d'une ligne
  // les neuf blocs d'appareil situés avant la 185.
  const O = preambule.length
  const map = (n: number) => (n <= 184 ? n + O : n <= 186 ? 184 + O + 1 : n + O - 1)
  if (map(184) !== 211 || map(185) !== 212 || map(186) !== 212 || map(187) !== 213)
    throw new Error('§ 7.3 — la table de décalage est fausse')

  const corps = new Corps(corpsAvecPreambule)

  // ════════════════════════════════════════════════════════════════════════════════════════
  // § 7.8 — l'appareil de Paillant, par UNION DE NUMÉROS DE LIGNE
  // ════════════════════════════════════════════════════════════════════════════════════════
  const RETIRE = /^retire_du_corps/
  const retenus = prep.appareil.filter((b) => RETIRE.test(b.devenir))
  const reportes = prep.appareil.filter((b) => !RETIRE.test(b.devenir))
  const tronques: number[] = []
  const retires = new Set<number>()

  for (const b of retenus) {
    // D12 — le bloc doit décrire CE corps-là : sa citation doit s'y retrouver aux lignes déclarées.
    if (b.texte_exact) {
      const source = b.lignes.map((n) => corps.g(map(n))).join('\n')
      if (!source.includes(b.texte_exact))
        throw new Error(`§ 7.8 — bloc ${b.id} : texte_exact introuvable aux lignes ${b.lignes.join(', ')}`)
    }
    if (b.ligne_avant !== undefined && b.ligne_apres !== undefined) {
      // Ligne mixte : dispositif AVANT l'appareil. On la tronque, on ne la retire pas.
      const n = map(b.lignes[0])
      if (corps.g(n) !== b.ligne_avant)
        throw new Error(`§ 7.8 — bloc ${b.id} : la ligne ${b.lignes[0]} n’est pas celle attendue`)
      corps.remplacer(n, [b.ligne_apres], b.id, `art-${b.article_hote}`, b.ligne_avant)
      tronques.push(b.lignes[0])
      continue
    }
    for (const n of b.lignes) if (corps.retirer(map(n), b.id, `art-${b.article_hote}`)) retires.add(n)
  }
  // Les quatre lignes mixtes doivent être exactement celles annoncées.
  const attenduTronques = [68, 95, 398, 619]
  if (JSON.stringify([...tronques].sort((a, b) => a - b)) !== JSON.stringify(attenduTronques))
    throw new Error(`§ 7.8 — lignes tronquées ${tronques.join(', ')}, attendu ${attenduTronques.join(', ')}`)

  // ════════════════════════════════════════════════════════════════════════════════════════
  // § 7.5 — les débris d'océrisation confirmés, et EUX SEULS
  // ════════════════════════════════════════════════════════════════════════════════════════
  const editionsLigne: { id: string; hote: string; ligne: number; avant: string; apres: string }[] = []
  for (const d of prep.debris_ocr) {
    if (d.statut !== 'CONFIRMÉ') continue // 86 et 116 sont RÉFUTÉS : mesurés contre trois pièces
    editionsLigne.push({ id: d.id, hote: `art-${d.article}`, ligne: d.ligne, avant: d.avant, apres: d.apres! })
  }
  // § 7.9 et candidats hors § 7.5 : mêmes gardes, même canal.
  for (const c of prep.debris_candidats_hors_prompt) {
    if (c.lignes) {
      // cand-29-tableau : deux lignes du barème de l'article 29 recollées en une.
      const [a, b] = c.lignes.map(map)
      const colle = `${corps.g(a)}\n${corps.g(b)}`
      if (colle !== c.avant) throw new Error(`§ 7.9 — ${c.id} : les lignes ${c.lignes.join('+')} ne sont pas celles attendues`)
      corps.remplacer(a, [c.apres], c.id, `art-${c.article}`, colle)
      corps.retirer(b, c.id, `art-${c.article}`)
      continue
    }
    editionsLigne.push({ id: c.id, hote: `art-${c.article}`, ligne: c.ligne!, avant: c.avant, apres: c.apres })
  }
  for (const e of editionsLigne) {
    const n = map(e.ligne)
    const l = corps.g(n)
    const occ = l.split(e.avant).length - 1
    if (occ !== 1)
      throw new Error(`§ 7.5 — ${e.id} : « ${e.avant.slice(0, 48)}… » apparaît ${occ} fois à la ligne ${e.ligne}`)
    corps.remplacer(n, l.replace(e.avant, e.apres).split('\n'), e.id, e.hote, l)
  }

  const lignesApres = corps.rendu()
  const corpsApres = lignesApres.join('\n')

  // ════════════════════════════════════════════════════════════════════════════════════════
  // § 7.4 — le sommaire. Les libellés sont RELUS DU CORPS QUE LE SCRIPT VIENT D'ÉCRIRE ;
  // toc-cible.json n'est qu'un oracle de comparaison (défaut D9 : la simulation lisait ses
  // libellés dans le corps qu'elle servait à contrôler, et ne pouvait donc pas échouer).
  // ════════════════════════════════════════════════════════════════════════════════════════
  const rangs: { ligne: number; entry: TocEntry }[] = []
  {
    // 1. Les 32 entrées existantes, appariées SÉQUENTIELLEMENT comme le fait segmentAnnotated.
    let p = 0
    const pos: number[] = []
    lignesApres.forEach((l, i) => {
      if (p < brutAvant.toc.length && norm(l.trim()) === norm(brutAvant.toc[p].label)) {
        pos.push(i)
        p++
      }
    })
    if (pos.length !== brutAvant.toc.length)
      throw new Error(`§ 7.4 — ${pos.length} des ${brutAvant.toc.length} entrées existantes appariées dans le corps`)
    pos.forEach((n, k) => rangs.push({ ligne: n, entry: brutAvant.toc[k] }))

    // 2. Les entrées NEUVES : leur libellé est la ligne du corps, pas une chaîne retapée.
    //    (Le corps porte 1 550 apostrophes COURBES et zéro droite ; `normLine` ne replie que
    //     les espaces — un libellé recopié à la main ne s'apparie pas.)
    const sousSections: number[] = []
    lignesApres.forEach((l, i) => {
      if (/^Sous Section /.test(l)) sousSections.push(i)
    })
    if (sousSections.length !== 20)
      throw new Error(`§ 7.4 — ${sousSections.length} lignes « Sous Section » dans le corps, attendu 20`)
    const lettres = tocCible.entreesNeuves
      .filter((e) => e.role === 'lettre')
      .map((e) => {
        const i = lignesApres.indexOf(e.label)
        if (i < 0) throw new Error(`§ 7.4 — lettre introuvable dans le corps : « ${e.label} »`)
        if (lignesApres.indexOf(e.label, i + 1) >= 0)
          throw new Error(`§ 7.4 — lettre en double dans le corps : « ${e.label} »`)
        return i
      })
    const ancreDe = (role: string, rang: number) => {
      const l = Object.entries(tocCible.ancresNeuvesParAncre)
        .filter(([, v]) => v.role === role)
        .sort((a, b) => a[1].ligneCorpsCible - b[1].ligneCorpsCible)
      if (!l[rang]) throw new Error(`§ 7.4 — pas d’ancre neuve pour ${role} n° ${rang + 1}`)
      return l[rang][0]
    }
    sousSections.forEach((n, k) =>
      rangs.push({ ligne: n, entry: { level: 4, label: lignesApres[n], anchor: ancreDe('sous-section', k), kind: 'code' } }),
    )
    lettres.forEach((n, k) =>
      rangs.push({ ligne: n, entry: { level: 4, label: lignesApres[n], anchor: ancreDe('lettre', k), kind: 'code' } }),
    )
    rangs.push({ ligne: 0, entry: { level: 1, label: lignesApres[0], anchor: ancreDe('préambule', 0), kind: 'code' } })
  }
  // ⚠️ Les entrées sont INTERCALÉES dans l'ordre du corps. Une entrée ajoutée à la fin du
  // tableau ne s'apparie jamais : `secs` reste à 32 et l'assertion § 11.1 part aussitôt.
  rangs.sort((a, b) => a.ligne - b.ligne)
  const toc: TocEntry[] = rangs.map((r) => r.entry)

  // Oracle de comparaison : le toc reconstruit doit être celui que la simulation avait produit.
  const attendu = tocCible.toc.map((t) => `${t.level}|${t.anchor}|${t.label}`).join('\n')
  const obtenu = toc.map((t) => `${t.level}|${t.anchor}|${t.label}`).join('\n')
  if (attendu !== obtenu) {
    const a = attendu.split('\n')
    const b = obtenu.split('\n')
    const i = a.findIndex((x, k) => x !== b[k])
    throw new Error(`§ 7.4 — le toc reconstruit diverge de toc-cible.json au rang ${i} :\n  oracle : ${a[i]}\n  obtenu : ${b[i] ?? '(rien)'}`)
  }

  // navToc : repris de la simulation (libellés en LECTURE rectifiée — « Sous-section I —
  // Définition »), après vérification que chacune de ses ancres existe bien dans le toc.
  const navToc = tocCible.navToc

  // ════════════════════════════════════════════════════════════════════════════════════════
  // § 6 + § 7.4 — les clés d'annotation, LUES du résultat de segmentAnnotated
  // ════════════════════════════════════════════════════════════════════════════════════════
  const blocs = segmentAnnotated(corpsApres, toc)
  const cleParArticle = new Map<string, string>()
  for (const b of blocs) {
    if (b.kind !== 'body' || !b.anchor) continue
    if (!cleParArticle.has(b.anchor) && b.jurisKey) cleParArticle.set(b.anchor, b.jurisKey)
  }
  const cleDe = (art: string) => {
    const k = cleParArticle.get(art)
    if (!k) throw new Error(`§ 6 — aucun bloc ancré ${art} dans le corps : impossible d’en lire la clé`)
    return k
  }

  // ── les 6 entrées existantes, re-clées ────────────────────────────────────────────────
  const commentaires: Record<string, string[]> = {}
  const recle: { avant: string; apres: string; change: boolean; n: number }[] = []
  const CORR_8 = prep.correction_de_l_annotation_de_l_article_8[0]
  const PURGE_49 = prep.purge_du_doublon[0]
  for (const [avant, entrees] of Object.entries(brutAvant.commentaires)) {
    const art = avant.split('|')[1]
    const apres = cleDe(art)
    let liste = [...entrees]
    // § 7.7 — l'annotation fautive de l'article 8 : la phrase « Tout contrat passé … » est
    // absente du J.O., de sa couche texte, de la transcription intégrale ET du corpus entier
    // (0 document). Elle n'est plus présentée comme du texte de 2005 ; elle est requalifiée
    // dans une note d'édition ajoutée sous le même article. Et « une retenue de 20% » devient
    // « une retenue libératoire de 20% », leçon des deux témoins.
    if (avant === 'sec-5|art-8') {
      const i = liste.indexOf(CORR_8.avant)
      if (i < 0) throw new Error('§ 7.7 — l’annotation de l’article 8 n’est pas celle attendue')
      liste[i] = CORR_8.apres
    }
    // § 7.7 bis — le doublon visible du lecteur : deux entrées rigoureusement identiques,
    // affichées l'une sous l'autre. Purgé PENDANT la re-clé, sinon il est reconduit tel quel.
    if (avant === PURGE_49.cle_actuelle) {
      const avantN = liste.length
      const i = liste.indexOf(PURGE_49.entree_a_retirer)
      if (i < 0) throw new Error('§ 7.7 — le doublon de l’article 49 est introuvable')
      if (liste.filter((x) => x === PURGE_49.entree_a_retirer).length !== 2)
        throw new Error('§ 7.7 — l’entrée de l’article 49 n’est pas en double : ne rien purger')
      liste.splice(i, 1)
      if (liste.length !== PURGE_49.occurrences_apres)
        throw new Error(`§ 7.7 — art. 49 : ${avantN} → ${liste.length}, attendu ${PURGE_49.occurrences_apres}`)
    }
    commentaires[apres] = [...(commentaires[apres] ?? []), ...liste]
    recle.push({ avant, apres, change: avant !== apres, n: entrees.length })
  }
  // Oracle de comparaison sur la re-clé.
  for (const r of tocCible.recle) {
    const m = recle.find((x) => x.avant === r.avant)
    if (!m || m.apres !== r.apres)
      throw new Error(`§ 6 — re-clé ${r.avant} : obtenu ${m?.apres}, oracle ${r.apres}`)
  }

  // ── §§ 7.3, 7.4, 7.5, 7.6, 7.7, 7.8 — les notes neuves, sous la clé RÉELLE ────────────
  // ⚠️ `appareil-et-notes.json` livre des OBJETS {texte, origine, …} indexés « art-N » ; la
  // base attend `string[]` indexé par `jurisKey`. On écrit `c.texte`, jamais l'objet, et
  // jamais sous « art-N » (interdit n° 7).
  let notesNeuves = 0
  for (const [art, entrees] of Object.entries(prep.commentaires)) {
    const cle = cleDe(art)
    for (const c of entrees) {
      if (typeof c.texte !== 'string' || !c.texte.trim()) throw new Error(`${art} : commentaire vide`)
      commentaires[cle] = [...(commentaires[cle] ?? []), c.texte]
      notesNeuves++
    }
  }

  // ── crossRefs : sec-1 conservé (interdit n° 6), + le dossier du visa sous le préambule ──
  // N9 — l'ancre est LUE d'un champ qui ne porte qu'elle, plus découpée dans une phrase.
  const ancrePreambule = prep.preambule.note_a_porter_en_crossRefs.ancre
  if (!/^sec-\d+$/.test(ancrePreambule)) {
    throw new Error(`ancre du préambule illisible : « ${ancrePreambule} » (attendu « sec-N »)`)
  }
  const crossRefs: CrossRefEntry[] = [
    ...brutAvant.crossRefs,
    { anchor: ancrePreambule, articles: [], note: prep.preambule.note_a_porter_en_crossRefs.note },
  ]

  const annotations: Annotations = {
    ...brutAvant,
    toc,
    navToc,
    crossRefs,
    commentaires,
  }
  const annotationsJson = JSON.stringify(annotations)

  // ════════════════════════════════════════════════════════════════════════════════════════
  // § 7.10 — la fiche d'Index du Moniteur. Résolue par `number` ET `type` : pas par le titre
  // (une recherche par titre ramène plusieurs documents), et surtout pas par la `source`
  // (`MONITEUR` en porte 27 234, discriminant nul).
  // ════════════════════════════════════════════════════════════════════════════════════════
  const ciblesIndex = await prisma.document.findMany({
    where: { number: INDEX_MONITEUR.number, type: INDEX_MONITEUR.type },
    select: { id: true, titleFr: true, source: true },
  })
  if (ciblesIndex.length !== 1)
    throw new Error(`§ 7.10 — ${ciblesIndex.length} fiches ${INDEX_MONITEUR.number}/${INDEX_MONITEUR.type}, il en faut 1`)
  const ficheIndex = ciblesIndex[0]
  if (apos(ficheIndex.titleFr) !== apos(INDEX_TITRE))
    throw new Error(`§ 7.10 — titre de la fiche d’Index inattendu : « ${ficheIndex.titleFr} »`)
  const xrefExistants = await prisma.crossRef.findMany({ where: { fromId: doc.id, toId: ficheIndex.id } })
  const xrefAEcrire =
    xrefExistants.length === 0
      ? {
          fromId: doc.id,
          toId: ficheIndex.id,
          toType: INDEX_MONITEUR.type,
          toNumber: INDEX_MONITEUR.number,
          // Titre ALTERNATIF — l'intitulé de sommaire du J.O. `titleFr` ne bouge pas (§ 5).
          toLabel: ficheIndex.titleFr,
          kind: 'VOIR',
          note: 'Entrée du texte au sommaire du Moniteur, Spécial n° 10 du 5 octobre 2005, sous son intitulé de publication.',
          source: 'EDITORIAL',
        }
      : null

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // § 11 — LES DOUZE VÉRIFICATIONS BLOQUANTES. Toutes en `throw`, dans l'ordre du prompt.
  // ══════════════════════════════════════════════════════════════════════════════════════════
  const echecs: string[] = []
  const exige = (n: string, ok: boolean, msg: string) => {
    if (!ok) echecs.push(`§ 11.${n} — ${msg}`)
  }

  // 11.1 — chaque en-tête déclaré est apparié dans le corps.
  const secs = blocs.filter((b) => b.kind === 'section')
  exige('1', secs.length === toc.length, `secs ${secs.length} pour toc.length ${toc.length}`)

  // 11.2 — aucun texte perdu à la segmentation.
  const recolle = blocs.map((b) => b.text).join('\n')
  exige('2', recolle === corpsApres, `la segmentation perd ${corpsApres.length - recolle.length} caractères`)

  // 11.3 — les 191 clés de `labels` ont un bloc ancré, et réciproquement.
  const ancresBlocs = new Set(blocs.flatMap((b) => (b.kind === 'body' && b.anchor ? [b.anchor] : [])))
  const labelsSansBloc = Object.keys(brutAvant.labels).filter((k) => !ancresBlocs.has(k))
  const blocsSansLabel = [...ancresBlocs].filter((a) => !(a in brutAvant.labels))
  exige('3', Object.keys(brutAvant.labels).length === 191, `labels : ${Object.keys(brutAvant.labels).length}, attendu 191`)
  exige('3', labelsSansBloc.length === 0, `labels sans bloc ancré : ${labelsSansBloc.join(', ')}`)
  exige('3', blocsSansLabel.length === 0, `blocs ancrés sans label : ${blocsSansLabel.join(', ')}`)

  // 11.4 — aucune clé de `commentaires` orpheline. ⚠️ SANS NOMBRE FIXE : le compte « 10 » du
  // prompt ignore les §§ 7.3, 7.4, 7.5 et 7.8, qui prescrivent chacun d'autres entrées.
  const jurisKeys = new Set(blocs.flatMap((b) => (b.kind === 'body' && b.jurisKey ? [b.jurisKey] : [])))
  const orphelines = Object.keys(commentaires).filter((k) => !jurisKeys.has(k))
  exige('4', orphelines.length === 0, `clés de commentaires orphelines : ${orphelines.join(', ')}`)
  const malFormees = Object.entries(commentaires).filter(([k, v]) => !/^sec-\d+\|art-/.test(k) || v.some((x) => typeof x !== 'string'))
  exige('4', malFormees.length === 0, `commentaires mal formés (clé ou type) : ${malFormees.map(([k]) => k).join(', ')}`)

  // 11.5 — aucun `ctRefs` vers un article inexistant : la couverture doit rester INTÉGRALE.
  const ctMorts = new Set<string>()
  let ctTotal = 0
  for (const e of annotations.indexEntries)
    for (const r of e.ctRefs) {
      ctTotal++
      if (!ancresBlocs.has(`art-${r}`)) ctMorts.add(String(r))
    }
  const couverts = new Set(annotations.indexEntries.flatMap((e) => e.ctRefs.map((r) => `art-${r}`)))
  exige('5', ctMorts.size === 0, `renvois d’index morts : ${[...ctMorts].join(', ')}`)
  exige('5', couverts.size === 191, `couverture d’index : ${couverts.size}/191 articles`)

  // 11.6 — les ancres de `crossRefs` figurent toutes dans le toc (sec-1 en particulier).
  const ancresToc = new Set(toc.map((t) => t.anchor))
  const xrefMortes = crossRefs.map((c) => c.anchor).filter((a) => !ancresToc.has(a))
  exige('6', xrefMortes.length === 0, `ancres de crossRefs absentes du toc : ${xrefMortes.join(', ')}`)
  exige('6', ancresToc.has('sec-1'), 'sec-1 a disparu du toc : la note de provenance perdrait sa cible')

  // 11.7 — aucune ancre du menu latéral sans cible dans la page.
  const ancresRendues = new Set(blocs.flatMap((b) => (b.kind === 'section' ? [b.anchor] : b.anchor ? [b.anchor] : [])))
  const ancresNav: string[] = []
  const collecte = (items: readonly (NavGroup | NavItem)[]) => {
    for (const it of items) {
      ancresNav.push(it.anchor)
      if (it.children) collecte(it.children)
    }
  }
  collecte(navToc)
  const navMortes = ancresNav.filter((a) => !ancresRendues.has(a))
  exige('7', navMortes.length === 0, `ancres du menu sans cible : ${navMortes.join(', ')}`)

  // 11.8 — aucune ancre dupliquée, ni entre sec-* et art-*, NI À L'INTÉRIEUR DE `toc`.
  // Le second volet est celui par lequel une collision sec-53/sec-53 serait passée.
  const ancresSec = new Set(secs.map((b) => (b as { anchor: string }).anchor))
  const collision = [...ancresSec].filter((a) => ancresBlocs.has(a))
  exige('8', collision.length === 0, `collision d’ancre sec-*/art-* : ${collision.join(', ')}`)
  exige(
    '8',
    new Set(toc.map((t) => t.anchor)).size === toc.length,
    `ancres dupliquées DANS le toc : ${toc.length - new Set(toc.map((t) => t.anchor)).size} doublon(s)`,
  )

  // 11.9 — les docId cités existent en base.
  const docIds = new Set<string>()
  for (const c of crossRefs) for (const d of c.docs ?? []) docIds.add(d.id)
  for (const e of annotations.indexEntries) for (const d of e.docRefs ?? []) docIds.add(d.id)
  if (xrefAEcrire) docIds.add(xrefAEcrire.toId)
  const trouves = docIds.size
    ? await prisma.document.findMany({ where: { id: { in: [...docIds] } }, select: { id: true } })
    : []
  const absents = [...docIds].filter((id) => !trouves.some((t) => t.id === id))
  exige('9', absents.length === 0, `docId cités et absents de la base : ${absents.join(', ')}`)

  // 11.10 — sentinelles verbatim, et interdits disparus. Regex INSENSIBLES À LA CASSE : le
  // corps porte « Réf. page », « Ref. page », « Ref. Pages » et « Réf. pages ». Et la portée
  // est BORNÉE au dispositif traité pour les deux interdits qui subsistent hors plage (les
  // articles 128 et suivants gardent leur encadré : interdit n° 14, retrait non prouvé).
  const SENTINELLES = [
    'Il est établi un Impôt sur le Revenu des personnes physiques et morales',
    'Vu les Articles 111-1, 111-2, 136, 159, 218 et 219 de la Constitution;',
    'Vu la Loi du 26 août 1879 sur la responsabilité des fonctionnaires',
    'Et après délibération en Conseil des Ministres :',
    'Sous Section IV : Impôt sur le revenu sur la base forfaitaire : Régime simplifié pour les petites entreprises',
    'a) Régime Simplifié pour Certaines Activités professionnelles',
    'Article 63-1.-',
    'Article 63-2.-',
    'Article 74.-',
    'Article 149.-',
    'Article 189.-',
  ]
  const manquantes = SENTINELLES.filter((s) => !corpsApres.includes(s))
  exige('10', manquantes.length === 0, `sentinelles disparues : ${manquantes.map((s) => `« ${s.slice(0, 40)}… »`).join(', ')}`)

  // Borne : du début du corps à la fin de l'article 126 — la seule plage que le fascicule contrôle.
  const iFin = lignesApres.findIndex((l) => articleAnchorFromHeading(l.trim()) === 'art-127')
  if (iFin < 0) throw new Error('§ 11.10 — article 127 introuvable : impossible de borner la plage contrôlée')
  const plage = lignesApres.slice(0, iFin).join('\n')
  const INTERDITS: [string, RegExp, string][] = [
    ['renvoi de pagination', /r[ée]f\.\s*pages?/i, 'corps entier'],
    ['encadré de loi de finances', /budget\s*20\d\d-20\d\d/i, 'plage 1-126'],
    ['filet de cadre', /-{10,}/, 'plage 1-126'],
    ['débris « te% »', /te%/, 'corps entier'],
    ['note d’éditeur du .docx', /\[le texte du fichier PDF fourni s’interrompt/i, 'corps entier'],
  ]
  for (const [nom, rx, ou] of INTERDITS) {
    const cible = ou === 'corps entier' ? corpsApres : plage
    const n = (cible.match(new RegExp(rx.source, rx.flags.includes('g') ? rx.flags : rx.flags + 'g')) ?? []).length
    exige('10', n === 0, `${nom} : ${n} occurrence(s) subsistante(s) (${ou})`)
  }

  // 11.11 — 191 têtes d'article, 1 → 189 sans trou ni doublon, plus 63-1 et 63-2.
  const tetes = lignesApres.map((l) => articleAnchorFromHeading(l.trim())).filter(Boolean) as string[]
  const attenduTetes = [
    ...Array.from({ length: 189 }, (_, i) => `art-${i + 1}`),
    'art-63-1',
    'art-63-2',
  ].sort()
  exige('11', tetes.length === 191, `${tetes.length} têtes d’article, attendu 191`)
  exige('11', new Set(tetes).size === 191, `${new Set(tetes).size} numéros distincts, attendu 191`)
  exige('11', JSON.stringify([...tetes].sort()) === JSON.stringify(attenduTetes), 'la numérotation 1→189 (+63-1, 63-2) est trouée ou doublée')

  // 11.12 — l'ORACLE : les 500 renvois de l'index de la cliente rejoués. Un renvoi qui tombait
  // juste AVANT et faux APRÈS signale qu'on a cassé quelque chose : c'est bloquant. L'inverse
  // est une coquille réparée. Faux des deux côtés = à examiner à la main.
  //
  // ⚠️ Le texte d'un article se découpe SUR LES LIGNES BRUTES, de sa tête à la tête suivante —
  // jamais par `segmentAnnotated`. Motif mesuré : les 20 lignes « Sous Section … » n'étaient
  // dans AUCUNE entrée de `toc`, si bien que chacune tombait dans le bloc de l'article qui la
  // précède. Les inscrire au sommaire les en retire, et onze renvois de l'oracle se mettaient à
  // « régresser » — « Acompte provisionnel → art. 67 » parce que la ligne 292 « Sous Section VI :
  // Acompte Provisionnel » avait quitté le bloc de l'article 67. Aucun mot du décret n'avait
  // bougé : c'était la mesure qui dépendait du `toc` qu'elle servait à contrôler. Découpé sur
  // les lignes, l'oracle mesure ce qu'on lui demande — l'effet des retraits et des corrections.
  const articlesBruts = (lignes: string[]) => {
    const m = new Map<string, string[]>()
    let cur: string | null = null
    for (const l of lignes) {
      const a = articleAnchorFromHeading(l.trim())
      if (a) {
        cur = a
        if (!m.has(a)) m.set(a, [])
      }
      if (cur) m.get(cur)!.push(l)
    }
    return new Map([...m].map(([k, v]) => [k, v.join('\n')]))
  }
  const texteAvantParArt = articlesBruts(lignesAvant)
  const texteParArticle = articlesBruts(lignesApres)
  // Radical : premier mot alphabétique du sujet, sans accents, en bas de casse, amputé de ses
  // deux dernières lettres au-delà de 5 caractères (flexions : « amende(s) », « société(s) »).
  const radical = (sujet: string) => {
    const m = plat(sujet).match(/[a-zà-ÿ]{3,}/)
    if (!m) return null
    const w = m[0]
    return w.length > 5 ? w.slice(0, w.length - 2) : w
  }
  let joueAvant = 0
  let joueApres = 0
  const regressions: string[] = []
  const reparations: string[] = []
  let renvoisTestes = 0
  for (const e of oracle.entrees) {
    const r = radical(e.sujet)
    if (!r) continue
    for (const n of e.refs) {
      const art = `art-${n}`
      const av = texteAvantParArt.get(art)
      const ap = texteParArticle.get(art)
      if (av === undefined || ap === undefined) continue
      renvoisTestes++
      const okAv = plat(av).includes(r)
      const okAp = plat(ap).includes(r)
      if (okAv) joueAvant++
      if (okAp) joueApres++
      if (okAv && !okAp) regressions.push(`« ${e.sujet} » → art. ${n}`)
      if (!okAv && okAp) reparations.push(`« ${e.sujet} » → art. ${n}`)
    }
  }
  exige('12', renvoisTestes === oracle.mesures.renvois, `${renvoisTestes} renvois rejoués, attendu ${oracle.mesures.renvois}`)
  exige('12', regressions.length === 0, `${regressions.length} renvoi(s) de l’oracle régressent : ${regressions.slice(0, 8).join(' · ')}`)

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // RAPPORT CHIFFRÉ — avant toute écriture
  // ══════════════════════════════════════════════════════════════════════════════════════════
  const p = (s = '') => console.log(s)
  p('══════════════════════════════════════════════════════════════════════════════════')
  p(`  Décret du 29 septembre 2005 relatif à l’Impôt sur le Revenu — ${doc.id}`)
  p(`  source ${SOURCE} · type ${doc.type} · statut ${doc.status}`)
  p('══════════════════════════════════════════════════════════════════════════════════')
  p()
  p('CORPS')
  p(`  avant  : ${lignesAvant.length} lignes · ${doc.bodyOriginal.length} caractères · md5 ${md5Depart}`)
  p(`  après  : ${lignesApres.length} lignes · ${corpsApres.length} caractères · md5 ${md5(corpsApres)}`)
  p(`  delta  : ${lignesApres.length - lignesAvant.length >= 0 ? '+' : ''}${lignesApres.length - lignesAvant.length} lignes · ` +
    `${corpsApres.length - doc.bodyOriginal.length >= 0 ? '+' : ''}${corpsApres.length - doc.bodyOriginal.length} caractères`)
  const bilan = preambule.length - 1 - retires.size + 1 - 1
  p(`  détail : +${preambule.length} (préambule) −1 (ligne 185 fondue) −${retires.size} (appareil retiré) ` +
    `+1 (art. 118, point d) rendu) −1 (art. 29, lignes recollées) = ${bilan >= 0 ? '+' : ''}${bilan}`)
  if (bilan !== lignesApres.length - lignesAvant.length)
    throw new Error(`le compte de lignes ne se recoupe pas : détail ${bilan}, mesuré ${lignesApres.length - lignesAvant.length}`)
  p(`  têtes d’article : ${tetes.length} (inchangé) · sous-sections au corps : 20 (inchangé)`)
  p()
  p('§ 7.1 — PRÉAMBULE')
  p(`  ${preambule.length} lignes · ${prep.preambule.texte.length} caractères · 19 visas · 2 considérants`)
  p(`  versé VERBATIM depuis le J.O., « Loi du 26 août 1879 » comprise (décision de Me Vaval du 25 août)`)
  p(`  le dossier 1870/1879 part en note sous ${ancrePreambule}, il n’amende pas le texte`)
  p(`  aucun « Vu » n’est inscrit au toc : un visa est un alinéa, pas une division`)
  p()
  p('§ 7.2 — DATE D’ADOPTION')
  p(`  adoptionDate    : ${doc.adoptionDate ?? 'NULL'} → ${ADOPTION.toISOString().slice(0, 10)}`)
  p(`  publicationDate : ${doc.publicationDate?.toISOString().slice(0, 10)} (inchangée)`)
  p(`  titleFr         : « ${doc.titleFr} » (inchangé)`)
  p(`  number          : « ${doc.number} » (inchangé)`)
  p()
  p('§ 7.3 — LIGNE 185')
  p(`  avant : « ${t185} »`)
  p(`        + « ${t186} »`)
  p(`  après : « ${fusion} »`)
  p(`  la sous-section III « Modalités d’imposition » (92-96) NE revient PAS au corps ; une note`)
  p(`  sous l’article 92 constate que l’édition de 2018 ne la reprend pas`)
  p()
  p('§ 7.4 — SOMMAIRE')
  p(`  toc    : ${brutAvant.toc.length} → ${toc.length} entrées (+${toc.length - brutAvant.toc.length})`)
  const niveaux = toc.reduce<Record<number, number>>((a, t) => ((a[t.level] = (a[t.level] ?? 0) + 1), a), {})
  p(`  niveaux : ${Object.entries(niveaux).map(([k, v]) => `${k}→${v}`).join(' · ')}`)
  p(`  neuves : 20 sous-sections (${tocCible.entreesNeuves.filter((e) => e.role === 'sous-section')[0].anchor}…) ` +
    `· 3 lettres A)/B)/C) · 1 préambule`)
  p(`  ancres sec-1…sec-32 : AUCUNE renumérotée · entrées intercalées dans l’ordre du corps`)
  p(`  navToc : ${brutAvant.navToc.length} → ${navToc.length} groupes · ${ancresNav.length} ancres, 0 morte`)
  p(`  ⚠ affichage : les 23 entrées de niveau 4 arrivent REPLIÉES (TreeNode n’ouvre que la`)
  p(`    profondeur 0) et s’affichent en CAPITALES. La 24ᵉ neuve, le préambule, est de niveau 1.`)
  p()
  p('§ 6 — RE-CLÉ DES ANNOTATIONS EXISTANTES (clés lues de segmentAnnotated)')
  for (const r of recle)
    p(`  ${r.avant.padEnd(16)} → ${r.apres.padEnd(16)} ${r.change ? 'CHANGE' : '(inchangée)'}  [${r.n} entrée(s)]`)
  p(`  ${recle.filter((r) => r.change).length} clés sur ${recle.length} changent — sans re-clé, autant d’annotations orphelines`)
  p()
  p('§ 7.5 — DÉBRIS D’OCÉRISATION')
  for (const e of editionsLigne) {
    const d = prep.debris_ocr.find((x) => x.id === e.id)
    p(`  ${e.id.padEnd(20)} ${d ? '§ 7.5' : 'hors § 7.5'}  art. ${e.hote.replace('art-', '').padEnd(4)}`)
    p(`      avant : …${e.avant.replace(/\n/g, ' ⏎ ')}…`)
    p(`      après : …${e.apres.replace(/\n/g, ' ⏎ ')}…`)
  }
  p(`  RÉFUTÉS, NON APPLIQUÉS : ${prep.debris_ocr.filter((d) => d.statut !== 'CONFIRMÉ').map((d) => `art. ${d.article}`).join(', ')}`)
  p(`    art. 116 « 20% libératoire » : le fac-similé ET la transcription de 2005 portent le doublon`)
  p(`    art. 86 « complémentaire de l’impôt » : 3 pièces lisent « de », et la chaîne paraît 2 fois`)
  p(`    au corps (art. 86 et art. 147) — un remplacement littéral toucherait le 147, hors plage`)
  p()
  p('§ 7.9 — TABLEAU DE L’ARTICLE 29')
  p(`  cand-29-tableau : « - Frais agencements, aménagements, » + « installations et… »`)
  p(`                  → « - Frais d’agencements, aménagements, installations et améliorations locatives : 20% »`)
  p(`  taux LAISSÉS TELS QUELS : le corps écrit « 12.5% » là où le J.O. écrit « 12,5% », et`)
  p(`  « 20 % » / « 5 % » avec une espace. Aucune normalisation : ce sont des données opposables.`)
  p(`  richBlocksJson reste NULL — la restitution en tableau est une question, pas une décision.`)
  p()
  p('§ 7.8 — APPAREIL DE L’ÉDITION PAILLANT')
  p(`  ${retenus.length} blocs retirés · ${reportes.length} blocs NON retirés`)
  p(`  lignes : ${retires.size} retirées entières + ${tronques.length} tronquées (elles portent du dispositif AVANT l’appareil)`)
  p(`  ⚠ retrait par UNION DE NUMÉROS DE LIGNE, jamais par recherche-remplacement :`)
  p(`    filet-1 est un sous-ensemble strict de filet-2 et se trouve DEUX fois au corps.`)
  for (const b of retenus) {
    const q = (b.texte_exact ?? b.extrait ?? '').replace(/\n/g, ' ⏎ ')
    p(`  · ${b.id.padEnd(16)} art. ${b.article_hote.padEnd(4)} l. ${b.lignes.join(',').padEnd(20)} ${b.ligne_apres !== undefined ? 'TRONQUE' : 'retire '} « ${q.slice(0, 62)}… »`)
  }
  p(`  NON RETIRÉS — et ce ne sont pas deux fois la même raison :`)
  p(`  a) hors de la plage 1-126, qu'aucune pièce faisant foi ne borne (interdit n° 14) — retrait`)
  p(`     PROPOSÉ, NON PROUVÉ, laissé à Me Vaval :`)
  for (const b of reportes.filter((x) => x.devenir === 'propose_non_prouve_a_arbitrer'))
    p(`  · ${b.id.padEnd(16)} art. ${b.article_hote.padEnd(4)} l. ${b.lignes.join(',').padEnd(20)}` +
      `${b.id === 'nb-149' ? ' (seul son « Réf. pages » part, par ref-5 — § 7.8 l’autorise nommément)' : ''}`)
  p(`  b) DANS la plage 1-126, mais ce n'est pas de l'appareil : ce sont des alinéas de`)
  p(`     consolidation, sans numéro d'article, qui appartiennent au dispositif :`)
  for (const b of reportes.filter((x) => x.devenir === 'laisse_au_corps_recommande'))
    p(`  · ${b.id.padEnd(16)} art. ${b.article_hote.padEnd(4)} l. ${b.lignes.join(',').padEnd(20)} laissé au corps`)
  p()
  p('DIFF PAR ARTICLE TOUCHÉ')
  const hotes = [...corps.parHote().entries()].sort((a, b) => Number(a[0].replace(/\D/g, '')) - Number(b[0].replace(/\D/g, '')))
  for (const [hote, acts] of hotes) {
    const av = texteAvantParArt.get(hote)
    const ap = texteParArticle.get(hote)
    const dl = (ap?.split('\n').length ?? 0) - (av?.split('\n').length ?? 0)
    p(`  ${hote} — ${acts.length} action(s) : ${acts.filter((a) => a.kind === 'retrait').length} retrait(s), ` +
      `${acts.filter((a) => a.kind === 'remplacement').length} remplacement(s) · ${dl >= 0 ? '+' : ''}${dl} ligne(s) · ` +
      `${(av?.length ?? 0)} → ${(ap?.length ?? 0)} car.`)
    for (const a of acts) {
      if (a.kind === 'retrait') continue
      const av = a.attendu ?? ''
      const ap = a.texte.join(' ⏎ ')
      // Fenêtre CENTRÉE sur la première divergence : sur une ligne de 1 300 caractères, les
      // 110 premiers sont identiques des deux côtés et ne montrent rien.
      let i = 0
      while (i < av.length && i < ap.length && av[i] === ap[i]) i++
      const d = Math.max(0, i - 40)
      const coupe = (s: string) => (d ? '…' : '') + s.slice(d, d + 130) + (d + 130 < s.length ? '…' : '')
      p(`      [${a.par}] avant : ${JSON.stringify(coupe(av))}`)
      p(`      [${a.par}] après : ${JSON.stringify(coupe(ap))}`)
    }
  }
  p()
  p('§§ 7.3-7.8 — ANNOTATIONS')
  p(`  commentaires : ${Object.keys(brutAvant.commentaires).length} clés / ` +
    `${Object.values(brutAvant.commentaires).flat().length} entrées` +
    `  →  ${Object.keys(commentaires).length} clés / ${Object.values(commentaires).flat().length} entrées`)
  p(`  dont ${notesNeuves} notes neuves · 1 annotation rectifiée (art. 8) · 1 doublon purgé (art. 49)`)
  p(`  ⚠ forme : la base attend string[] ; les objets du fichier de préparation ne sont JAMAIS écrits`)
  p(`  crossRefs : ${brutAvant.crossRefs.length} → ${crossRefs.length} (ajout du dossier du visa sous ${ancrePreambule})`)
  p()
  p('§ 7.10 — RENVOI VERS LA FICHE D’INDEX DU MONITEUR')
  p(`  cible résolue par number='${INDEX_MONITEUR.number}' ET type='${INDEX_MONITEUR.type}' : ${ciblesIndex.length} ligne`)
  p(`  ${ficheIndex.id} · source ${ficheIndex.source} · « ${ficheIndex.titleFr} »`)
  p(`  ${xrefAEcrire ? `CrossRef à créer : kind=VOIR, toLabel = l’intitulé de sommaire du J.O. (titre ALTERNATIF)` : `CrossRef déjà présent (${xrefExistants.length}) — rien à créer`}`)
  p()
  p('§ 8 — ORACLE (index de la cliente, pièce indépendante)')
  p(`  ${oracle.mesures.entrees} sujets · ${renvoisTestes} renvois rejoués`)
  p(`  radical trouvé dans l’article cité : ${joueAvant} avant → ${joueApres} après`)
  p(`  régressions (juste avant, faux après) : ${regressions.length}`)
  regressions.slice(0, 10).forEach((r) => p(`    ✗ ${r}`))
  p(`  réparations (faux avant, juste après) : ${reparations.length}`)
  reparations.slice(0, 10).forEach((r) => p(`    ✓ ${r}`))
  p(`  ⚠ l’oracle ne couvre PAS les articles 127 à 189 : aucune mesure n’y est possible.`)
  p()
  p('§ 11 — VÉRIFICATIONS BLOQUANTES')
  const lignesGardes = [
    `11.1  en-têtes appariés .................. ${secs.length}/${toc.length}`,
    `11.2  aucun texte perdu ................... ${recolle === corpsApres ? 'oui' : 'NON'}`,
    `11.3  labels ancrés ....................... ${Object.keys(brutAvant.labels).length - labelsSansBloc.length}/191 · blocs sans label ${blocsSansLabel.length}`,
    `11.4  clés de commentaires atteintes ...... ${Object.keys(commentaires).length - orphelines.length}/${Object.keys(commentaires).length}`,
    `11.5  couverture d’index ................. ${couverts.size}/191 · ${ctTotal} renvois · ${ctMorts.size} mort(s)`,
    `11.6  ancres de crossRefs dans le toc .... ${crossRefs.length - xrefMortes.length}/${crossRefs.length}`,
    `11.7  ancres du menu avec cible .......... ${ancresNav.length - navMortes.length}/${ancresNav.length}`,
    `11.8  collisions sec/art ................. ${collision.length} · doublons dans le toc ${toc.length - new Set(toc.map((t) => t.anchor)).size}`,
    `11.9  docId cités et présents ............ ${docIds.size - absents.length}/${docIds.size}`,
    `11.10 sentinelles ........................ ${SENTINELLES.length - manquantes.length}/${SENTINELLES.length} · interdits subsistants ${echecs.filter((e) => e.startsWith('§ 11.10') && !e.includes('sentinelles')).length}`,
    `11.11 têtes d’article ..................... ${tetes.length}/191, numérotation continue`,
    `11.12 renvois de l’oracle ................. ${renvoisTestes}/${oracle.mesures.renvois} · ${regressions.length} régression(s)`,
  ]
  lignesGardes.forEach((l) => p(`  ${l}`))
  p()

  if (echecs.length) {
    p('╔══════════════════════════════════════════════════════════════════════════════╗')
    p('║  ARRÊT — une vérification bloquante a parlé. On ne contourne pas une garde.   ║')
    p('╚══════════════════════════════════════════════════════════════════════════════╝')
    echecs.forEach((e) => p(`  ✗ ${e}`))
    throw new Error(`${echecs.length} vérification(s) du § 11 en échec`)
  }
  p('  ✓ les douze vérifications passent.')
  p()

  p('CE QUI N’EST PAS FAIT, ET POURQUOI')
  p('  · la sous-section III « Modalités d’imposition » (92-96) n’est pas rétablie — décision de Me Vaval')
  p('  · la rubrique « Obligations déclaratives, Livre-Journal et sanctions » du sommaire de la cliente')
  p('    n’est pas inscrite : aucun en-tête ne lui correspond dans le corps (interdit n° 4)')
  p('  · l’index de la cliente (52 sujets) ne remplace ni ne complète celui de la base (369) — interdit n° 2')
  p('  · le dispositif des articles 127 à 189 n’est pas touché, sauf le « Réf. pages » de l’art. 149,')
  p('    que le § 7.8 autorise nommément. L’encadré « Budget 2010-2011 » de l’art. 128, l’article 23 de')
  p('    la loi SFD de 1982 et la note N.B. entière de l’art. 149 restent au corps : leur retrait est')
  p('    PROPOSÉ, NON PROUVÉ — aucune pièce faisant foi ne borne ces articles.')
  p('  · titleFr, number et publicationDate ne bougent pas ; la désignation « Décret du 5 octobre 2005 »')
  p('    des pièces de la cliente n’est adoptée nulle part')
  p('  · aucune des trois listes de page.tsx n’est modifiée')
  p('  · les 28 divergences inexpliquées entre la base et la transcription de 2020, dont 15 au-delà de')
  p('    l’article 126, restent ouvertes : aucune pièce ne contrôle cette plage')
  p()

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // ÉCRITURE
  // ══════════════════════════════════════════════════════════════════════════════════════════
  const horodatage = new Date().toISOString().replace(/[:.]/g, '-')
  const fichierEtat = join(DIR, `etat-anterieur-${horodatage}.json`)
  const etatAnterieur = {
    _lisezMoi:
      'État de la fiche AVANT le passage de scripts/import-decret-ir-2005-sommaire.ts --apply. ' +
      'Le document n’avait AUCUNE entrée d’AuditLog et sealed = false : sans ce fichier, rien ne ' +
      'permettrait de revenir en arrière.',
    ecritLe: new Date().toISOString(),
    id: doc.id,
    source: SOURCE,
    md5BodyOriginal: md5Depart,
    adoptionDate: doc.adoptionDate,
    publicationDate: doc.publicationDate,
    titleFr: doc.titleFr,
    number: doc.number,
    bodyOriginal: doc.bodyOriginal,
    annotationsJson: doc.annotationsJson,
    crossRefs: xrefExistants,
  }
  const poids = Buffer.byteLength(JSON.stringify(etatAnterieur, null, 2), 'utf8')

  if (!APPLY) {
    accessSync(DIR, constants.W_OK) // le répertoire de sauvegarde doit être écrivable
    p(`ÉTAT ANTÉRIEUR — serait écrit dans ${fichierEtat}`)
    p(`  ${poids} octets · corps ${doc.bodyOriginal.length} car. · annotations ${doc.annotationsJson!.length} car. · ` +
      `${xrefExistants.length} CrossRef`)
    p()
    p('SIMULATION — rien n’a été écrit. Relancer avec --apply.')
    await prisma.$disconnect()
    return
  }

  // L'état antérieur est écrit AVANT la transaction : si l'écriture du fichier échoue, rien
  // n'a encore bougé en base.
  writeFileSync(fichierEtat, JSON.stringify(etatAnterieur, null, 2) + '\n', 'utf8')
  p(`état antérieur sauvegardé : ${fichierEtat} (${poids} octets)`)

  const searchText = buildSearchText({ ...doc, bodyOriginal: corpsApres, annotationsJson } as never)
  await prisma.$transaction(
    async (tx) => {
      await tx.document.update({
        where: { id: doc.id },
        data: {
          bodyOriginal: corpsApres,
          annotationsJson,
          adoptionDate: ADOPTION,
          searchText,
        },
      })
      if (xrefAEcrire) await tx.crossRef.create({ data: xrefAEcrire as Prisma.CrossRefUncheckedCreateInput })
      await audit(
        {
          action: 'ARTICLE_AMENDED',
          targetType: 'Document',
          targetId: doc.id,
          meta: {
            source: SOURCE,
            motif:
              'Décret IR 2005 : préambule versé (verbatim, « 1879 »), adoptionDate, ligne 185 fondue, ' +
              '20 sous-sections + 3 lettres au sommaire, 6 annotations re-clées, appareil de Paillant ' +
              'sorti du dispositif, débris d’océrisation, renvoi vers la fiche d’Index du Moniteur.',
            fichierEtatAnterieur: fichierEtat,
            avant: {
              md5BodyOriginal: md5Depart,
              lignes: lignesAvant.length,
              caracteres: doc.bodyOriginal.length,
              toc: brutAvant.toc.length,
              commentaires: Object.keys(brutAvant.commentaires).length,
              adoptionDate: null,
              // ⚠️ Ni `bodyOriginal` ni `annotationsJson` ici : c'étaient ≈ 210 Ko dans UNE
              // ligne d'AuditLog, en doublon du fichier d'état antérieur écrit avant la
              // transaction. On garde les empreintes, qui suffisent à prouver l'identité de
              // ce qui a été sauvegardé ; le texte est dans `fichierEtatAnterieur`.
              md5AnnotationsJson: md5(doc.annotationsJson ?? ''),
              octetsAnnotationsJson: (doc.annotationsJson ?? '').length,
            },
            apres: {
              md5BodyOriginal: md5(corpsApres),
              lignes: lignesApres.length,
              caracteres: corpsApres.length,
              toc: toc.length,
              commentaires: Object.keys(commentaires).length,
              adoptionDate: ADOPTION.toISOString().slice(0, 10),
            },
            appareil: { blocsRetires: retenus.length, lignesRetirees: retires.size, lignesTronquees: tronques },
            debris: editionsLigne.map((e) => e.id),
            refutes: prep.debris_ocr.filter((d) => d.statut !== 'CONFIRMÉ').map((d) => d.id),
            oracle: { renvois: renvoisTestes, regressions: regressions.length, reparations: reparations.length },
            crossRef: xrefAEcrire ? { toId: xrefAEcrire.toId, kind: xrefAEcrire.kind } : 'déjà présent',
          },
        },
        tx,
      )
    },
    { timeout: 120_000, maxWait: 30_000 },
  )

  // ⚠️ HORS TRANSACTION : `reindexDocument` prend le singleton Prisma, pas `tx`. Et
  // `buildSearchText` seul ne suffit pas — c'est `clearSearchCache()` qui empêche la recherche
  // de continuer à servir l'ancien corps depuis son cache de résultats.
  await reindexDocument(doc.id)

  // ⚠️ `audit()` ENVELOPPE SON `create` DANS UN `catch` VIDE (`src/lib/auth/audit.ts` l. 85-87) :
  // « le journal d'audit ne doit jamais bloquer le flux principal ». Sur ce document-ci, qui
  // n'avait AUCUNE entrée d'audit et dont `sealed` vaut false, une insertion perdue en silence
  // laisserait l'écriture sans trace. On ne peut pas empêcher l'échec — on refuse de l'ignorer.
  const journalise = await prisma.auditLog.count({
    where: { targetId: doc.id, action: 'ARTICLE_AMENDED' },
  })
  if (journalise === 0) {
    p()
    p('⛔ L’ÉCRITURE EST FAITE, MAIS ELLE N’EST PAS JOURNALISÉE.')
    p('   `audit()` avale ses erreurs ; l’entrée ARTICLE_AMENDED n’existe pas en base.')
    p(`   L’état antérieur reste récupérable : ${fichierEtat}`)
    p('   Écrivez l’entrée à la main, ou revenez en arrière depuis ce fichier.')
    process.exitCode = 1
  }

  p()
  p(`✓ Fiche mise à jour : ${doc.id}`)
  p(`  corps ${lignesAvant.length} → ${lignesApres.length} lignes · sommaire ${brutAvant.toc.length} → ${toc.length} entrées`)
  p(`  annotations ${Object.keys(brutAvant.commentaires).length} → ${Object.keys(commentaires).length} clés · adoptionDate ${ADOPTION.toISOString().slice(0, 10)}`)
  p(`  ${xrefAEcrire ? '1 CrossRef créé' : '0 CrossRef créé'} · ${journalise > 0 ? `journalisé (ARTICLE_AMENDED ×${journalise}, VÉRIFIÉ en base)` : 'NON JOURNALISÉ — voir ci-dessus'} · réindexé, cache de recherche vidé`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('\nÉCHEC :', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
