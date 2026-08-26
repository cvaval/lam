/**
 * Décret du 29 septembre 2005 relatif à l'Impôt sur le Revenu — REPRISE du 25 août 2026.
 *
 *     npx tsx scripts/reprise-ir-2005.ts                    # simulation, n'écrit rien
 *     npx tsx scripts/reprise-ir-2005.ts --apply            # lancé par Me Vaval, elle seule
 *
 * Ce script reprend là où `scripts/import-decret-ir-2005-sommaire.ts --apply` s'est arrêté à
 * 11 h 04. Il ne le rejoue pas : le corps de départ qu'il exige est l'ÉTAT PRODUIT par ce
 * passage-là (md5 da6b03f3df2032c1dc265ae0cca79315, 743 lignes). Les deux ne se composent pas.
 *
 * ─── LES QUATRE VOLETS ─────────────────────────────────────────────────────────────────────
 *  1. `summaryFr` du décret de 2005 : « 189 articles » → « 191 articles ». UN SEUL chiffre
 *     change ; le reste du résumé est relu en base et réécrit à l'identique.
 *  2. Les articles 128 et 149 : retrait des 10 lignes d'appareil que le passage de 11 h 04
 *     avait laissées faute de preuve, PLUS 3 notes qui disent ce qui a été retiré et pourquoi,
 *     PLUS la rectification d'une entrée de ce matin que le retrait rendrait fausse.
 *     La preuve ne vient PAS de la transcription de 2020 : elle vient de DEUX textes du corpus.
 *  3. Les 21 corrections de rédaction que les 28 divergences appellent — et elles seules.
 *     Les 6 divergences inexpliquées et les 6 où le fac-similé donne raison à la base ne sont
 *     PAS touchées ; la formule de clôture manquante de l'article 189 n'est PAS versée.
 *  4. Le décret du 29 septembre 1986 : renvois et statut.
 *
 * ─── LE VOLET 4 EST LE SEUL QUI PORTE UN ARBITRAGE, ET IL EST SORTI DU DÉFAUT ───────────────
 * L'abrogation du décret de 1986 par celui de 2005 repose sur DEUX appuis convergents mais
 * indirects : un CONSIDÉRANT qui la nomme sans la prononcer (« qu'il y a lieu d'abroger… »,
 * un motif, placé avant le mot DÉCRÈTE), et un article 189 qui la prononce sans la nommer
 * (clause balai). Aucun des deux ne fait à lui seul ce que la pastille « Abrogé » affirmerait.
 * S'y ajoute une contradiction MESURÉE dans le Journal officiel lui-même : le sommaire du
 * Moniteur Spécial n° 10 intitule le texte de 2005 « Décret MODIFIANT celui du 29 septembre
 * 1986 ». La réponse est de droit, pas de mesure — elle n'appartient donc pas au script.
 *
 * ⚠️ **LE `kind` D'UN RENVOI EST UNE AFFIRMATION, PAS UN POINTEUR.** Un `kind='ABROGE'` porte
 * le rétrolien et DIT l'abrogation. Écrire quatre renvois « ABROGE » tout en refusant
 * `status='ABROGE'`, c'est affirmer dans un champ ce qu'on refuse dans l'autre. La préparation
 * le dit en toutes lettres : « si le considérant ne suffit pas à statuer, il ne suffit pas non
 * plus à poser un renvoi ABROGE — il faudrait alors le kind CITE et une note. »
 *
 * ⚠️ MAIS LES QUATRE RENVOIS NE SE VALENT PAS, et les confondre serait l'erreur inverse.
 * Les renvois 1, 2 et 3 ne reposent que sur le considérant. **Le renvoi n° 4 repose sur
 * l'ARTICLE 188**, qui est du dispositif et qui NOMME le texte : « La loi du 5 Février 1995
 * instituant un acompte provisionnel […] sont et demeurent rapportées. » Là, le décret ne
 * suggère pas : il rapporte. Ce renvoi-là garde `ABROGE` dans tous les modes.
 *
 *     --1986=cite      (DÉFAUT) renvois 1-3 en kind CITE, renvoi 4 en kind ABROGE (art. 188),
 *                      le résumé qui expose le dossier ; STATUT INCHANGÉ. La question est
 *                      posée au lecteur, elle n'est pas tranchée — et aucun champ ne la
 *                      tranche à sa place.
 *     --1986=abroge    les 4 CrossRef en ABROGE + status EN_VIGUEUR → ABROGE + le résumé
 *                      « SUPPLANTÉ… ».
 *                      `abrogatedByNumber` reste à NULL : renseigné, la fiche afficherait
 *                      « Ce texte est abrogé par la Décret du 29 septembre 2005 », sans lien
 *                      (le bandeau ne résout la cible que parmi les circulaires BRH).
 *     --1986=rien      volet 4 entièrement sauté.
 *
 * ─── PIÈCES CONSOMMÉES (toutes produites le 25 août, toutes rejouables) ────────────────────
 *   scripts/data/decret-ir-2005/reprise-128-149.json      (retrait par union de n° de ligne)
 *   scripts/data/decret-ir-2005/reprise-divergences.json  (21 corrections, chacune sourcée)
 *   scripts/data/decret-ir-2005/reprise-1986.json         (renvois, statut, dormants)
 *   scripts/data/decret-ir-2005/oracle-index-cliente.json (500 renvois, art. 1-126)
 */
import { PrismaClient, type Prisma } from '@prisma/client'
import { createHash } from 'node:crypto'
import { accessSync, constants, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  parseAnnotations,
  segmentAnnotated,
  type Annotations as AnnotationsLues,
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

const MODES_1986 = ['cite', 'abroge', 'rien'] as const
type Mode1986 = (typeof MODES_1986)[number]
const drapeau1986 = process.argv.find((a) => a.startsWith('--1986='))?.slice('--1986='.length) ?? 'cite'
if (!(MODES_1986 as readonly string[]).includes(drapeau1986))
  throw new Error(`--1986=${drapeau1986} inconnu — valeurs admises : ${MODES_1986.join(' | ')}`)
const MODE_1986 = drapeau1986 as Mode1986

const DIR = join(process.cwd(), 'scripts/data/decret-ir-2005')
const SOURCE = 'DECRET_IMPOT_REVENU_2005'
const DOC_2005 = 'cms43ptub00008lo8tv3y25kk'
const DOC_1986 = 'cmrtixuf400061267rrhh6a36'
/** Corps produit par le passage du 25 août 2026 à 11 h 04. Première assertion de toutes. */
const MD5_DEPART = 'da6b03f3df2032c1dc265ae0cca79315'

const md5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex')
const lire = <T>(f: string): T => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as T
const plat = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const compte = (h: string, a: string) => (a === '' ? 0 : h.split(a).length - 1)

// ══════════════════════════════════════════════════════════════════════════════════════════
// Types des pièces de préparation
// ══════════════════════════════════════════════════════════════════════════════════════════
type Reprise128 = {
  corps: { avant: { lignes: number; caracteres: number; md5: string }; apres: { lignes: number; caracteres: number; md5: string }; garde: string }
  retrait: {
    lignes_entieres: number[]
    lignes_retirees_verbatim: Record<string, string>
    caracteres_retires: number
    md5_attendu_apres: string
  }
  commentaires: {
    ajouts: Record<string, string[]>
    rectification: { cle: string; motif: string; avant: string; apres: string }
    etat_attendu: { avant: { cles: number; entrees: number }; apres: { cles: number; entrees: number } }
  }
  consequences_a_arbitrer: { objet: string; constat: string; options?: string[]; decision: string }[]
}
type Correction = {
  article: string
  avant: string
  apres: string
  categorie: string
  piece: string
  appui: string
  portee: string
  lignes: number[]
  unique: boolean
  note?: string
  remplacement_multiligne?: boolean
}
type RepriseDiv = {
  etat_du_corps_travaille: { lignes: number; caracteres: number; md5: string }
  comptes: { divergences_reprises: number; au_dela_de_126: number; appellent_une_correction: number; corrections_prêtes: number }
  divergences: {
    article: string
    au_dela_de_126: boolean
    categorie: string
    verdict: string
    appelle_une_correction_du_corps: boolean
  }[]
  corrections: Correction[]
}
type RenvoiACreer = {
  n: number
  priorite: string
  fromId: string
  toId: string
  to: string
  kind: string
  toType?: string | null
  toNumber?: string | null
  toAnchor?: string | null
  toLabel: string
  source: string
  position: number
  note: string
  reserve?: string
}
type Reprise1986 = {
  renvois: { aCreer: RenvoiACreer[]; aNePASCreer: string[]; precedentDuCorpus: { crossRefId: string; noteExistante: string } }
  changementDeStatutPropose: {
    optionRecommandee: { valeurActuelle: string; valeurProposee: string; champAEcrireEnPlus: { formulationLaPlusPrudente: string } }
    optionDeRepli: { nom: string; verdict: string }
    optionEcartee: { nom: string; raison: string }
    cequiResteUneQuestion: string[]
  }
  autresDormants: {
    listeDesDormants: {
      n: number | string
      cible: { id: string; source?: string; statut?: string; titre: string }
      abrogePar?: unknown
      appui?: unknown
    }[]
  }
}
type Oracle = { entrees: { sujet: string; refs: number[] }[]; mesures: { entrees: number; renvois: number } }
type AnnotationsBrutes = {
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
// Fabrique du corps cible.
//
// ⚠️ TOUT passe par des NUMÉROS DE LIGNE, jamais par un rechercher-remplacer global. Motif
// mesuré le 25 août : « bordereau complémentaire de l'impôt » paraît DEUX fois au corps
// (art. 86 et art. 147) ; un `replace()` littéral amputerait un article hors plage contrôlée.
// Les 21 chaînes « avant » ont été vérifiées uniques — la garde le revérifie quand même, car
// c'est le corps EN BASE qui fait foi, pas le relevé.
// ══════════════════════════════════════════════════════════════════════════════════════════
type Substitution = { avant: string; apres: string; par: string; hote: string }

class Corps {
  private readonly lignes: string[]
  private readonly subs = new Map<number, Substitution[]>()
  private readonly fusions: { debut: number; fin: number; s: Substitution }[] = []
  private readonly retraits = new Map<number, string>()
  constructor(corps: string) {
    this.lignes = corps.split('\n')
  }
  get nbLignes() {
    return this.lignes.length
  }
  g(n: number): string {
    const l = this.lignes[n - 1]
    if (l === undefined) throw new Error(`ligne ${n} hors du corps (${this.lignes.length} lignes)`)
    return l
  }
  private reserver(n: number, par: string) {
    if (this.retraits.has(n)) throw new Error(`ligne ${n} : ${par} porte sur une ligne déjà retirée par ${this.retraits.get(n)}`)
  }
  retirer(n: number, par: string) {
    if (this.subs.has(n) || this.fusions.some((f) => n >= f.debut && n <= f.fin))
      throw new Error(`ligne ${n} : ${par} retirerait une ligne déjà corrigée`)
    if (this.retraits.has(n)) throw new Error(`ligne ${n} : retrait en double (${this.retraits.get(n)} et ${par})`)
    this.retraits.set(n, par)
  }
  substituer(n: number, s: Substitution) {
    this.reserver(n, s.par)
    const l = this.subs.get(n) ?? []
    l.push(s)
    this.subs.set(n, l)
  }
  fusionner(debut: number, fin: number, s: Substitution) {
    for (let n = debut; n <= fin; n++) this.reserver(n, s.par)
    this.fusions.push({ debut, fin, s })
  }
  get nbActions() {
    return this.retraits.size + [...this.subs.values()].reduce((a, l) => a + l.length, 0) + this.fusions.length
  }
  /** Les articles hôtes touchés, dans l'ordre du corps. */
  hotes(): string[] {
    const h = new Set<string>()
    for (const l of this.subs.values()) for (const s of l) h.add(s.hote)
    for (const f of this.fusions) h.add(f.s.hote)
    for (const par of this.retraits.values()) h.add(par.split('#')[1] ?? par)
    return [...h]
  }
  /**
   * Applique tout en UN passage : d'abord les fusions (elles suppriment des lignes), puis les
   * substitutions, puis les retraits. Chaque étape revérifie que sa chaîne « avant » est
   * bien là — un décalage d'une ligne s'arrête ici, il ne s'écrit pas.
   */
  rendu(): string {
    const out: (string | null)[] = this.lignes.slice()
    for (const { debut, fin, s } of this.fusions) {
      const seg = out.slice(debut - 1, fin).join('\n')
      if (!seg.includes(s.avant)) throw new Error(`${s.par} — « ${s.avant.slice(0, 50)}… » introuvable aux lignes ${debut}-${fin}`)
      const res = seg.replace(s.avant, s.apres)
      if (res.includes('\n')) throw new Error(`${s.par} — la fusion des lignes ${debut}-${fin} laisse un saut de ligne`)
      out[debut - 1] = res
      for (let i = debut; i < fin; i++) out[i] = null
    }
    for (const [n, liste] of this.subs) {
      let t = out[n - 1]
      if (t === null) throw new Error(`ligne ${n} : substitution sur une ligne supprimée`)
      for (const s of liste) {
        if (!t!.includes(s.avant)) throw new Error(`${s.par} — « ${s.avant.slice(0, 50)}… » introuvable à la ligne ${n}`)
        t = t!.replace(s.avant, s.apres)
      }
      out[n - 1] = t
    }
    for (const n of this.retraits.keys()) out[n - 1] = null
    return out.filter((l): l is string => l !== null).join('\n')
  }
  /** Le corps avec les SEULS retraits appliqués — sert de point de contrôle intermédiaire. */
  renduRetraitsSeuls(): string {
    return this.lignes.filter((_, i) => !this.retraits.has(i + 1)).join('\n')
  }
}

/** Découpe le corps en articles SUR LES LIGNES BRUTES (jamais par segmentAnnotated : le
 *  découpage servirait alors de juge à un `toc` qu'il faut justement contrôler). */
function articlesBruts(lignes: string[]): Map<string, string> {
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

/** Radical d'un sujet d'index : premier mot alphabétique, sans accents, amputé de ses deux
 *  dernières lettres au-delà de 5 caractères (flexions « amende(s) », « société(s) »). */
function radical(sujet: string): string | null {
  const m = plat(sujet).match(/[a-z]{3,}/)
  if (!m) return null
  const w = m[0]
  return w.length > 5 ? w.slice(0, w.length - 2) : w
}

// ══════════════════════════════════════════════════════════════════════════════════════════

async function main() {
  const r128 = lire<Reprise128>('reprise-128-149.json')
  const rdiv = lire<RepriseDiv>('reprise-divergences.json')
  const r86 = lire<Reprise1986>('reprise-1986.json')
  const oracle = lire<Oracle>('oracle-index-cliente.json')
  const p = (s = '') => console.log(s)

  // ════════════════════════════════════════════════════════════════════════════════════════
  // 0. LES FICHES, ET LA PREMIÈRE ASSERTION DE TOUTES
  // ════════════════════════════════════════════════════════════════════════════════════════
  const candidats = await prisma.document.findMany({ where: { source: SOURCE }, select: { id: true } })
  if (candidats.length !== 1) throw new Error(`§ 10.6 — ${candidats.length} document(s) de source ${SOURCE}, il en faut exactement 1`)
  if (candidats[0].id !== DOC_2005) throw new Error(`§ 10.6 — la fiche de source ${SOURCE} est ${candidats[0].id}, attendu ${DOC_2005}`)
  const garde = await prisma.document.count({
    where: { type: 'LEGISLATION', OR: [{ titleFr: { contains: 'Impôt sur le Revenu' } }, { number: { contains: '29 septembre 2005' } }] },
  })
  if (garde !== 1) throw new Error(`§ 10.6 — ${garde} fiches candidates, il en faut exactement 1`)

  const doc = await prisma.document.findUniqueOrThrow({ where: { id: DOC_2005 } })

  // ⚠️ AVANT TOUT LE RESTE. Les trois pièces de préparation désignent des NUMÉROS DE LIGNE :
  // si le corps n'est plus celui contre lequel elles ont été calibrées, ces numéros ne
  // désignent plus les mêmes passages et le retrait amputerait le décret.
  const md5Depart = md5(doc.bodyOriginal)
  if (md5Depart !== MD5_DEPART)
    throw new Error(
      `§ 11.0 — corps de départ : md5 ${md5Depart}, attendu ${MD5_DEPART}. ` +
        'Quelqu’un est passé après le 25 août 2026 11 h 04. Les numéros de ligne de ' +
        'reprise-128-149.json et de reprise-divergences.json ne désignent plus les mêmes lignes : ' +
        'recalculer les deux pièces contre le corps courant avant d’aller plus loin.',
    )
  for (const [nom, attendu] of [
    ['reprise-128-149.json', r128.corps.avant.md5],
    ['reprise-divergences.json', rdiv.etat_du_corps_travaille.md5],
  ] as const)
    if (attendu !== MD5_DEPART) throw new Error(`§ 11.0 — ${nom} a été calibré sur ${attendu}, pas sur ${MD5_DEPART}`)

  const annLues = parseAnnotations(doc.annotationsJson) as AnnotationsLues | null
  if (!annLues) throw new Error('annotationsJson illisible')
  const brutAvant = JSON.parse(doc.annotationsJson!) as AnnotationsBrutes
  const lignesAvant = doc.bodyOriginal.split('\n')
  if (lignesAvant.length !== r128.corps.avant.lignes)
    throw new Error(`corps : ${lignesAvant.length} lignes, attendu ${r128.corps.avant.lignes}`)

  // ════════════════════════════════════════════════════════════════════════════════════════
  // VOLET 1 — `summaryFr` : « 189 articles » → « 191 articles », et RIEN d'autre
  // ════════════════════════════════════════════════════════════════════════════════════════
  const sumAvant = doc.summaryFr ?? ''
  const occ189 = compte(sumAvant, '189 articles')
  const dejaFait = compte(sumAvant, '191 articles') === 1 && occ189 === 0
  if (!dejaFait && occ189 !== 1)
    throw new Error(`volet 1 — « 189 articles » paraît ${occ189} fois dans summaryFr : le remplacement n’est pas sûr`)
  const sumApres = dejaFait ? sumAvant : sumAvant.replace('189 articles', '191 articles')
  // Contrôle de non-débordement : un seul caractère doit changer, et le reste mot pour mot.
  if (!dejaFait && (sumApres.length !== sumAvant.length || sumApres.replace('191 articles', '189 articles') !== sumAvant))
    throw new Error('volet 1 — le remplacement a débordé : le résumé ne serait pas réécrit à l’identique')

  // ════════════════════════════════════════════════════════════════════════════════════════
  // VOLET 2 — LES ARTICLES 128 ET 149, par UNION DE NUMÉROS DE LIGNE
  // ════════════════════════════════════════════════════════════════════════════════════════
  const corps = new Corps(doc.bodyOriginal)
  const lignes128 = r128.retrait.lignes_entieres
  for (const n of lignes128) {
    const attendu = r128.retrait.lignes_retirees_verbatim[String(n)]
    if (attendu === undefined) throw new Error(`volet 2 — la ligne ${n} est à retirer mais son verbatim n’est pas au fichier`)
    if (corps.g(n) !== attendu)
      throw new Error(
        `volet 2 — ligne ${n} : le corps porte « ${corps.g(n).slice(0, 70)}… », le fichier attend « ${attendu.slice(0, 70)}… ». ` +
          'Aucun retrait ne se fait sur une ligne qui n’est pas celle qu’on croit.',
      )
    const hote = n === 613 ? 'art-149' : 'art-128'
    corps.retirer(n, `retrait-128-149#${hote}`)
  }
  const carRetires = lignes128.reduce((a, n) => a + corps.g(n).length + 1, 0)
  if (carRetires !== r128.retrait.caracteres_retires)
    throw new Error(`volet 2 — ${carRetires} caractères retirés, le fichier en annonce ${r128.retrait.caracteres_retires}`)
  const corpsRetraitsSeuls = corps.renduRetraitsSeuls()
  if (md5(corpsRetraitsSeuls) !== r128.retrait.md5_attendu_apres)
    throw new Error(
      `volet 2 — corps après les seuls retraits : md5 ${md5(corpsRetraitsSeuls)}, attendu ${r128.retrait.md5_attendu_apres}`,
    )

  // ════════════════════════════════════════════════════════════════════════════════════════
  // VOLET 3 — LES 21 CORRECTIONS, ET ELLES SEULES
  // ════════════════════════════════════════════════════════════════════════════════════════
  if (rdiv.corrections.length !== rdiv.comptes.corrections_prêtes)
    throw new Error(`volet 3 — ${rdiv.corrections.length} corrections au fichier, ${rdiv.comptes.corrections_prêtes} annoncées`)
  for (const c of rdiv.corrections) {
    if (c.avant === c.apres) throw new Error(`volet 3 — art. ${c.article} : « avant » et « après » identiques`)
    // ⚠️ La garde d'unicité se rejoue sur le CORPS EN BASE, pas sur le relevé.
    const n = compte(doc.bodyOriginal, c.avant)
    if (n !== 1)
      throw new Error(
        `volet 3 — art. ${c.article} : « ${c.avant.slice(0, 55)}… » paraît ${n} fois au corps. ` +
          'Un remplacement littéral déborderait — c’est le piège relevé sur « bordereau complémentaire de l’impôt ».',
      )
    const s: Substitution = { avant: c.avant, apres: c.apres, par: `corr-${c.article}#${c.lignes.join('-')}`, hote: `art-${c.article}` }
    if (c.remplacement_multiligne) corps.fusionner(c.lignes[0], c.lignes[c.lignes.length - 1], s)
    else corps.substituer(c.lignes[0], s)
  }

  const corpsApres = corps.rendu()
  const lignesApres = corpsApres.split('\n')

  // Recollage : le corps d'arrivée et les lignes retirées reforment exactement le corps de
  // départ. Sans ce contrôle, une substitution silencieuse passerait.
  {
    const gardees = new Set(lignes128)
    const temoin = lignesAvant.filter((_, i) => !gardees.has(i + 1)).length
    if (temoin !== lignesAvant.length - lignes128.length) throw new Error('volet 2 — le recollage des lignes retirées ne se referme pas')
  }

  // ════════════════════════════════════════════════════════════════════════════════════════
  // ANNOTATIONS — 3 notes neuves + 1 rectification. Les clés sont LUES du résultat de
  // segmentAnnotated (interdit n° 7 : jamais écrites à la main).
  // ════════════════════════════════════════════════════════════════════════════════════════
  const blocs = segmentAnnotated(corpsApres, brutAvant.toc)
  const jurisKeys = new Set(blocs.flatMap((b) => (b.kind === 'body' && b.jurisKey ? [b.jurisKey] : [])))

  const commentaires: Record<string, string[]> = Object.fromEntries(
    Object.entries(brutAvant.commentaires).map(([k, v]) => [k, [...v]]),
  )
  let notesNeuves = 0
  for (const [cle, textes] of Object.entries(r128.commentaires.ajouts)) {
    if (!jurisKeys.has(cle))
      throw new Error(
        `annotations — la clé « ${cle} » n’est produite par aucun bloc de segmentAnnotated. ` +
          'Elle serait orpheline : la note n’apparaîtrait nulle part.',
      )
    const dejaLa = commentaires[cle] ?? []
    for (const t of textes) {
      if (typeof t !== 'string') throw new Error(`annotations — « ${cle} » : la base attend string[], pas des objets`)
      if (!dejaLa.includes(t)) {
        dejaLa.push(t)
        notesNeuves++
      }
    }
    commentaires[cle] = dejaLa
  }
  const rect = r128.commentaires.rectification
  if (!jurisKeys.has(rect.cle)) throw new Error(`annotations — la clé rectifiée « ${rect.cle} » n’est atteinte par aucun bloc`)
  const listeRect = commentaires[rect.cle] ?? []
  const iRect = listeRect.indexOf(rect.avant)
  let rectifiee = false
  if (iRect >= 0) {
    listeRect[iRect] = rect.apres
    rectifiee = true
  } else if (!listeRect.includes(rect.apres)) {
    throw new Error(
      `annotations — l’entrée à rectifier sous « ${rect.cle} » n’est PAS celle du fichier. ` +
        'Le texte « avant » avait été vérifié identique au caractère près à celui de la base : il a changé depuis.',
    )
  }
  commentaires[rect.cle] = listeRect

  // ══════════════════════════════════════════════════════════════════════════════════════
  // D3 — « LAISSER LA BASE ET LE SIGNALER EN NOTE » VAUT AUSSI QUAND ON NE CORRIGE PAS.
  //
  // La feuille de route (§ 7.5, interdit n° 13) pose la doctrine : là où la base et le J.O.
  // divergent sans qu'on touche au dispositif, le lecteur doit l'apprendre. L'article 104
  // porte bien cette note ; treize autres divergences non corrigées n'en portaient AUCUNE.
  // Les deux qui suivent sont celles qui se voient : un texte qui s'arrête sans sa formule
  // de promulgation, et une faute de nombre qui est celle du Journal officiel.
  //
  // ⚠️ Les clés sont LUES de `segmentAnnotated`, jamais écrites à la main.
  const cleDeLArticle = (ancre: string): string => {
    for (const b of blocs) {
      if (b.kind === 'body' && b.anchor === ancre && b.jurisKey) return b.jurisKey
    }
    throw new Error(`D3 — aucun bloc ancré « ${ancre} » : la note serait orpheline`)
  }
  const NOTES_D3: { ancre: string; texte: string }[] = [
    {
      ancre: 'art-189',
      texte:
        'Le texte s’arrête ici. La formule de promulgation du décret — « Donné au Palais National, ' +
        'à Port-au-Prince, le 29 septembre 2005 », la signature du Président et celles des ministres — ' +
        'ne figure ni dans l’édition consolidée de 2018 reproduite ici, ni dans le fac-similé du ' +
        'Journal officiel, qui s’interrompt à l’article 126. Une transcription intégrale du décret, ' +
        'datée de 2020, la porte ; elle en est le seul témoin dont la rédaction dispose, et le texte ' +
        'n’est pas versé sur ce seul appui.',
    },
    {
      ancre: 'art-103',
      texte:
        'Deux leçons de cet article surprennent à la lecture : « de 20% de la plus-values à court ' +
        'terme » et, au point d), « la plus value sera calculée » sans trait d’union. Le fac-similé ' +
        'du Journal officiel les porte l’une et l’autre : ce sont les leçons du texte publié, non ' +
        'des fautes de saisie, et le dispositif est reproduit tel qu’il a paru.',
    },
  ]
  let notesD3 = 0
  for (const nd of NOTES_D3) {
    const cle = cleDeLArticle(nd.ancre)
    const liste = commentaires[cle] ?? []
    if (!liste.includes(nd.texte)) {
      liste.push(nd.texte)
      notesD3++
    }
    commentaires[cle] = liste
  }

  const nbClesApres = Object.keys(commentaires).length
  const nbEntreesApres = Object.values(commentaires).flat().length
  // Le fichier de préparation ne connaît pas les deux notes du D3 : on ajoute leur compte
  // plutôt que d'assouplir la garde, qui reste exacte au chiffre près.
  const clesAttendues = r128.commentaires.etat_attendu.apres.cles + NOTES_D3.length
  const entreesAttendues = r128.commentaires.etat_attendu.apres.entrees + NOTES_D3.length
  if (nbClesApres !== clesAttendues || nbEntreesApres !== entreesAttendues)
    throw new Error(
      `annotations — ${nbClesApres} clés / ${nbEntreesApres} entrées, attendu ` +
        `${clesAttendues} / ${entreesAttendues} (${r128.commentaires.etat_attendu.apres.cles} du fichier ` +
        `+ ${NOTES_D3.length} notes D3)`,
    )

  // ══════════════════════════════════════════════════════════════════════════════════════
  // D2 — LA FICHE DE 2005 SE CONTREDIRAIT SUR ELLE-MÊME, ET RIEN NE LE DIRAIT.
  //
  // Sa note de provenance (crossRefs, ancre `sec-1`) ouvre par « Texte CONSOLIDÉ : Décret du
  // 29 septembre 2005 …, MODIFIANT celui du 29 septembre 1986 ». Après le volet 4, la MÊME
  // fiche portera à quelques centimètres des renvois vers ce décret de 1986. L'explication
  // qui réconcilie les deux n'était écrite que sur la fiche de 1986 — que le lecteur de la
  // fiche de 2005 ne voit jamais. On la porte ici aussi, une fois, en toutes lettres.
  const PHRASE_D2 =
    ' Le sommaire du Moniteur intitule ce texte « Décret modifiant celui du 29 septembre 1986 », ' +
    'et la mention « modifiant » ci-dessus le reprend. Le préambule du même décret énonce au ' +
    'contraire « qu’il y a lieu d’abroger le Décret du 29 septembre 1986 » ; son article 189 abroge ' +
    'les dispositions contraires sans le désigner, et aucun de ses articles ne le nomme. La ' +
    'divergence est dans le Journal officiel lui-même : la fiche la porte sans la trancher. Voir ' +
    'les renvois de cette fiche et celle du décret du 29 septembre 1986.'
  const crossRefsApres = brutAvant.crossRefs.map((c) => ({ ...c }))
  let phraseD2Ajoutee = false
  if (MODE_1986 !== 'rien') {
    const i1 = crossRefsApres.findIndex((c) => c.anchor === 'sec-1')
    if (i1 < 0)
      throw new Error('D2 — la note de provenance (crossRefs, ancre sec-1) a disparu : rien où accrocher la mention')
    const avant = crossRefsApres[i1].note ?? ''
    if (!avant.includes('La divergence est dans le Journal officiel lui-même')) {
      crossRefsApres[i1] = { ...crossRefsApres[i1], note: avant + PHRASE_D2 }
      phraseD2Ajoutee = true
    }
  }

  const annotations = JSON.stringify({ ...brutAvant, commentaires, crossRefs: crossRefsApres })
  const annApres = parseAnnotations(annotations)
  if (!annApres) throw new Error('annotations — le JSON produit n’est pas relisible par parseAnnotations')

  // ════════════════════════════════════════════════════════════════════════════════════════
  // VOLET 4 — LE DÉCRET DE 1986
  // ════════════════════════════════════════════════════════════════════════════════════════
  const doc86 = await prisma.document.findUniqueOrThrow({ where: { id: DOC_1986 } })
  const SUM86_ORIGINE =
    'Texte de l’édition Vandal du Code de commerce — partie VII (Réglementation fiscale). ' +
    'Publié dans le thème « Droit commercial » au même niveau que le Code de commerce et les autres textes de l’édition.'
  const SUFFIXE86 =
    'Publié dans le thème « Droit commercial » au même niveau que le Code de commerce et les autres textes de l’édition.'
  // ⚠️ « 191 articles » et non « 189 » — même correction qu'au volet 1 : le texte de 2005
  // porte 191 têtes d'article (1 → 189, plus 63-1 et 63-2).
  const SUM86_ABROGE =
    r86.changementDeStatutPropose.optionRecommandee.champAEcrireEnPlus.formulationLaPlusPrudente
      .replace('en 189 articles', 'en 191 articles')
      // Apostrophes courbes : le fichier de préparation les écrit droites, le reste des
      // résumés du corpus les écrit courbes. Une seule convention par champ.
      .replace(/'/g, '\u2019') +
    ' ' +
    SUFFIXE86
  const SUM86_CONSTAT =
    'Le Décret du 29 septembre 2005 relatif à l’Impôt sur le Revenu reprend la même matière et la refond ' +
    'en 191 articles. Son préambule énonce « qu’il y a lieu d’abroger le Décret du 29 septembre 1986, le Décret ' +
    'du 27 septembre 1988 et la Loi du 5 février 1995 » : c’est un considérant, un motif placé avant le mot ' +
    'DÉCRÈTE, non une disposition. Aucun article du décret de 2005 ne nomme le présent texte ; son article 189 ' +
    'abroge « toutes lois ou dispositions de lois […] qui lui sont contraires », sans le désigner. Le sommaire du ' +
    'Moniteur, Spécial n° 10 du 5 octobre 2005, intitule au contraire le texte de 2005 « Décret modifiant celui du ' +
    '29 septembre 1986 relatif à l’Impôt sur le Revenu ». Le statut du présent texte n’est donc pas tranché sur ' +
    'cette fiche : le renvoi porté sur la fiche de 2005 dit ce que ce décret-là entend en faire, et la question de ' +
    'droit reste ouverte. Le présent texte porte, inline, les modifications du décret du 27 septembre 1988 et de la ' +
    'loi du 5 février 1995. ' +
    SUFFIXE86
  // ⚠️ Comparaison APOSTROPHE-INSENSIBLE : la fiche de 1986 vient de l'édition Vandal et porte
  // l'apostroph droite ('), le reste du corpus la courbe (’). Le texte écrit ici est en courbe.
  const apos = (s: string) => s.replace(/[’‘]/g, "'")
  const sum86Connus = [SUM86_ORIGINE, SUM86_ABROGE, SUM86_CONSTAT].map(apos)
  if (MODE_1986 !== 'rien' && !sum86Connus.includes(apos(doc86.summaryFr ?? '')))
    throw new Error(
      'volet 4 — le résumé de la fiche de 1986 n’est aucun de ceux que ce script connaît. ' +
        'Quelqu’un l’a réécrit depuis le relevé : le relire avant d’écraser.\n  en base : ' +
        JSON.stringify(doc86.summaryFr),
    )
  const sum86Apres = MODE_1986 === 'abroge' ? SUM86_ABROGE : MODE_1986 === 'cite' ? SUM86_CONSTAT : (doc86.summaryFr ?? null)
  const statut86Apres = MODE_1986 === 'abroge' ? 'ABROGE' : doc86.status
  if (MODE_1986 === 'abroge' && doc86.status !== 'EN_VIGUEUR' && doc86.status !== 'ABROGE')
    throw new Error(`volet 4 — statut de départ inattendu sur la fiche de 1986 : ${doc86.status}`)
  if (doc86.abrogatedByNumber !== null)
    throw new Error(`volet 4 — abrogatedByNumber vaut déjà « ${doc86.abrogatedByNumber} » : ce script le laisse à null, il ne l’écrase pas`)

  // Les CrossRef 1 à 4 (le n° 5, facultatif, N'EST PAS posé : l'entrée d'index LM1986-79 est
  // datée du 28 septembre 1986 alors que la fiche porte « n° 79 du 29 septembre 1986 », et
  // aucune pièce disponible ne tranche. C'est une question, pas une écriture.)
  const renvois = (MODE_1986 === 'rien' ? [] : r86.renvois.aCreer.filter((x) => x.n <= 4)).map((x) => ({
    ...x,
    // ⚠️ D1 — le `kind` affirme. En mode « cite », les renvois 1-3 (fondés sur le seul
    // considérant) descendent à CITE ; le n° 4 garde ABROGE, parce que l'article 188 du
    // dispositif nomme la loi de 1995 et la rapporte. Le mode « abroge » les aligne tous.
    kind: MODE_1986 === 'cite' && x.n <= 3 ? 'CITE' : x.kind,
  }))
  const xrefExistants = await prisma.crossRef.findMany({ where: { fromId: DOC_2005 }, orderBy: { position: 'asc' } })
  const xrefACreer: Prisma.CrossRefUncheckedCreateInput[] = []
  const xrefDejaLa: RenvoiACreer[] = []
  for (const x of renvois) {
    if (x.fromId !== DOC_2005) throw new Error(`volet 4 — renvoi n° ${x.n} : fromId ${x.fromId} inattendu`)
    if (!['CITE', 'COMMENTE', 'MODIFIE', 'ABROGE', 'APPLIQUE', 'VOIR'].includes(x.kind))
      throw new Error(`volet 4 — renvoi n° ${x.n} : kind « ${x.kind} » hors de la liste du schéma`)
    const cible = await prisma.document.findUnique({ where: { id: x.toId }, select: { id: true, type: true, titleFr: true } })
    if (!cible) throw new Error(`volet 4 — renvoi n° ${x.n} : la cible ${x.toId} n’existe pas en base`)
    if (xrefExistants.some((e) => e.toId === x.toId)) {
      xrefDejaLa.push(x)
      continue
    }
    if (xrefExistants.some((e) => e.position === x.position))
      throw new Error(`volet 4 — renvoi n° ${x.n} : la position ${x.position} est déjà prise sur la fiche de 2005`)
    xrefACreer.push({
      fromId: x.fromId,
      toId: x.toId,
      toType: x.toType ?? null,
      toNumber: x.toNumber ?? null,
      toAnchor: x.toAnchor ?? null,
      toLabel: x.toLabel,
      kind: x.kind,
      note: x.note,
      source: 'EDITORIAL',
      position: x.position,
    })
  }
  if (new Set(xrefACreer.map((x) => x.position)).size !== xrefACreer.length)
    throw new Error('volet 4 — deux renvois à créer partagent la même position')

  // ════════════════════════════════════════════════════════════════════════════════════════
  // § 11 — LES DOUZE VÉRIFICATIONS BLOQUANTES, sur le corps résultant
  // ════════════════════════════════════════════════════════════════════════════════════════
  const echecs: string[] = []
  const exige = (n: string, ok: boolean, msg: string) => {
    if (!ok) echecs.push(`§ 11.${n} — ${msg}`)
  }

  // 11.1 — chaque en-tête déclaré est apparié dans le corps. Le `toc` ne bouge pas (56) : la
  // garde vérifie que le retrait n'a pas emporté d'en-tête de section.
  const secs = blocs.filter((b) => b.kind === 'section')
  exige('1', secs.length === brutAvant.toc.length, `en-têtes appariés ${secs.length} pour toc ${brutAvant.toc.length}`)
  exige('1', brutAvant.toc.length === 56, `toc : ${brutAvant.toc.length} entrées, attendu 56 (il ne doit pas bouger)`)

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

  // 11.4 — aucune clé de `commentaires` orpheline, AUCUNE exception. Sans nombre fixe.
  const orphelines = Object.keys(commentaires).filter((k) => !jurisKeys.has(k))
  exige('4', orphelines.length === 0, `clés de commentaires orphelines : ${orphelines.join(', ')}`)
  const malFormees = Object.entries(commentaires).filter(([k, v]) => !/^sec-\d+\|art-/.test(k) || v.some((x) => typeof x !== 'string'))
  exige('4', malFormees.length === 0, `commentaires mal formés : ${malFormees.map(([k]) => k).join(', ')}`)

  // 11.5 — couverture d'index INTÉGRALE, aucun renvoi mort.
  const ctMorts = new Set<string>()
  let ctTotal = 0
  for (const e of brutAvant.indexEntries)
    for (const ref of e.ctRefs) {
      ctTotal++
      if (!ancresBlocs.has(`art-${ref}`)) ctMorts.add(String(ref))
    }
  const couverts = new Set(brutAvant.indexEntries.flatMap((e) => e.ctRefs.map((ref) => `art-${ref}`)))
  exige('5', ctMorts.size === 0, `renvois d’index morts : ${[...ctMorts].join(', ')}`)
  exige('5', couverts.size === 191, `couverture d’index : ${couverts.size}/191 articles`)

  // 11.6 — les ancres de `crossRefs` figurent toutes dans le toc.
  const ancresToc = new Set(brutAvant.toc.map((t) => t.anchor))
  const xrefMortes = brutAvant.crossRefs.map((c) => c.anchor).filter((a) => !ancresToc.has(a))
  exige('6', xrefMortes.length === 0, `ancres de crossRefs absentes du toc : ${xrefMortes.join(', ')}`)

  // 11.7 — aucune ancre du menu sans cible.
  const ancresRendues = new Set(blocs.flatMap((b) => (b.anchor ? [b.anchor] : [])))
  const ancresNav: string[] = []
  const collecte = (items: readonly (NavGroup | NavItem)[]) => {
    for (const it of items) {
      ancresNav.push(it.anchor)
      if (it.children) collecte(it.children)
    }
  }
  collecte(brutAvant.navToc)
  const navMortes = ancresNav.filter((a) => !ancresRendues.has(a))
  exige('7', navMortes.length === 0, `ancres du menu sans cible : ${navMortes.join(', ')}`)

  // 11.8 — aucune ancre dupliquée entre sec-* et art-*, ni à l'intérieur du toc.
  const ancresSec = new Set(secs.map((b) => (b as { anchor: string }).anchor))
  const collision = [...ancresSec].filter((a) => ancresBlocs.has(a))
  exige('8', collision.length === 0, `collision d’ancre sec-*/art-* : ${collision.join(', ')}`)
  exige('8', new Set(brutAvant.toc.map((t) => t.anchor)).size === brutAvant.toc.length, 'ancres dupliquées DANS le toc')

  // 11.9 — les docId cités existent en base (annotations + CrossRef à créer).
  const docIds = new Set<string>()
  for (const c of brutAvant.crossRefs) for (const d of c.docs ?? []) docIds.add(d.id)
  for (const e of brutAvant.indexEntries) for (const d of e.docRefs ?? []) docIds.add(d.id)
  for (const x of xrefACreer) if (x.toId) docIds.add(x.toId)
  const trouves = docIds.size ? await prisma.document.findMany({ where: { id: { in: [...docIds] } }, select: { id: true } }) : []
  const absents = [...docIds].filter((id) => !trouves.some((t) => t.id === id))
  exige('9', absents.length === 0, `docId cités et absents de la base : ${absents.join(', ')}`)

  // 11.10 — sentinelles verbatim, et interdits disparus. ⚠️ LA BORNE 1-126 EST LEVÉE : les
  // deux interdits que le script de ce matin bornait à la plage contrôlée l'étaient parce que
  // l'encadré de l'article 128 y restait. Il part ici : la garde porte sur le CORPS ENTIER.
  const SENTINELLES = [
    'Il est établi un Impôt sur le Revenu des personnes physiques et morales',
    'Vu la Loi du 26 août 1879 sur la responsabilité des fonctionnaires',
    'Et après délibération en Conseil des Ministres :',
    'Article 63-1.-',
    'Article 63-2.-',
    'Article 128.-',
    'Article 149.-',
    'Article 189.-',
    'A. Personnes physiques',
    'B. Personnes morales',
    'À partir de 1.000.001,00',
    'le cas échéant.',
  ]
  const manquantes = SENTINELLES.filter((s) => !corpsApres.includes(s))
  exige('10', manquantes.length === 0, `sentinelles disparues : ${manquantes.map((s) => `« ${s.slice(0, 40)}… »`).join(', ')}`)
  const INTERDITS: [string, RegExp][] = [
    ['renvoi de pagination', /r[ée]f\.\s*pages?/i],
    ['encadré de loi de finances', /budget\s*20\d\d-20\d\d/i],
    ['filet de cadre', /-{10,}/],
    ['débris « te% »', /te%/],
    ['note d’éditeur du .docx', /\[le texte du fichier PDF fourni s’interrompt/i],
    ['note de lecture « N.B. »', /→\s*N\.B\./],
    ['Moniteur Spécial #1 du 14 janvier 2011', /Moniteur Spécial #1 du 14 janvier 2011/i],
  ]
  const interditsRestants: string[] = []
  for (const [nom, rx] of INTERDITS) {
    const n = (corpsApres.match(new RegExp(rx.source, rx.flags.includes('g') ? rx.flags : rx.flags + 'g')) ?? []).length
    if (n !== 0) interditsRestants.push(`${nom} ×${n}`)
    exige('10', n === 0, `${nom} : ${n} occurrence(s) subsistante(s) dans le corps entier`)
  }
  // Le marqueur « → » ne peut PAS servir de critère de retrait : il ouvre aussi l'alinéa de
  // crédit-bail de l'article 29, du dispositif consolidé, qui reste au corps. Après retrait il
  // doit en subsister EXACTEMENT UN — s'il en reste zéro, on a emporté cet alinéa-là.
  const flechesApres = compte(corpsApres, '→')
  exige('10', flechesApres === 1, `marqueur « → » : ${flechesApres} occurrence(s), attendu 1 (l’alinéa de crédit-bail de l’art. 29)`)

  // 11.11 — 191 têtes d'article, 1 → 189 sans trou ni doublon, plus 63-1 et 63-2.
  const tetes = lignesApres.map((l) => articleAnchorFromHeading(l.trim())).filter(Boolean) as string[]
  const attenduTetes = [...Array.from({ length: 189 }, (_, i) => `art-${i + 1}`), 'art-63-1', 'art-63-2'].sort()
  exige('11', tetes.length === 191, `${tetes.length} têtes d’article, attendu 191`)
  exige('11', new Set(tetes).size === 191, `${new Set(tetes).size} numéros distincts, attendu 191`)
  exige('11', JSON.stringify([...tetes].sort()) === JSON.stringify(attenduTetes), 'la numérotation 1→189 (+63-1, 63-2) est trouée ou doublée')

  // 11.12 — l'ORACLE : les 500 renvois de l'index de la cliente rejoués. Il ne couvre que les
  // articles 1 à 126 : il mesure 8 des corrections de cette plage, et RIEN au-delà. Ce silence
  // est attendu, ce n'est pas un résultat.
  const texteAvantParArt = articlesBruts(lignesAvant)
  const texteApresParArt = articlesBruts(lignesApres)
  let joueAvant = 0
  let joueApres = 0
  let renvoisTestes = 0
  const regressions: string[] = []
  const reparations: string[] = []
  for (const e of oracle.entrees) {
    const rad = radical(e.sujet)
    if (!rad) continue
    for (const n of e.refs) {
      const av = texteAvantParArt.get(`art-${n}`)
      const ap = texteApresParArt.get(`art-${n}`)
      if (av === undefined || ap === undefined) continue
      renvoisTestes++
      const okAv = plat(av).includes(rad)
      const okAp = plat(ap).includes(rad)
      if (okAv) joueAvant++
      if (okAp) joueApres++
      if (okAv && !okAp) regressions.push(`« ${e.sujet} » → art. ${n}`)
      if (!okAv && okAp) reparations.push(`« ${e.sujet} » → art. ${n}`)
    }
  }
  exige('12', renvoisTestes === oracle.mesures.renvois, `${renvoisTestes} renvois rejoués, attendu ${oracle.mesures.renvois}`)
  exige('12', regressions.length === 0, `${regressions.length} renvoi(s) de l’oracle régressent : ${regressions.slice(0, 8).join(' · ')}`)

  // MESURE NON BLOQUANTE — l'index EN BASE (369 sujets) sur les articles touchés. Un sujet
  // dont le radical quittait l'article n'est pas un renvoi mort (l'article existe toujours) :
  // c'est un renvoi qui promet un contenu que l'article ne porte plus. C'est la « conséquence
  // à arbitrer » n° 1, et elle se chiffre plutôt que de se supposer.
  const promessesVides: { sujet: string; art: string }[] = []
  for (const e of brutAvant.indexEntries) {
    const rad = radical(e.subject)
    if (!rad) continue
    for (const ref of e.ctRefs) {
      const av = texteAvantParArt.get(`art-${ref}`)
      const ap = texteApresParArt.get(`art-${ref}`)
      if (av === undefined || ap === undefined) continue
      if (plat(av).includes(rad) && !plat(ap).includes(rad)) promessesVides.push({ sujet: e.subject, art: String(ref) })
    }
  }

  // ════════════════════════════════════════════════════════════════════════════════════════
  // RAPPORT CHIFFRÉ — avant toute écriture
  // ════════════════════════════════════════════════════════════════════════════════════════
  p('══════════════════════════════════════════════════════════════════════════════════')
  p(`  REPRISE — Décret du 29 septembre 2005 relatif à l’Impôt sur le Revenu`)
  p(`  ${doc.id} · source ${SOURCE} · type ${doc.type} · statut ${doc.status}`)
  p(`  mode volet 4 : --1986=${MODE_1986}${MODE_1986 === 'cite' ? '  (défaut — le statut de 1986 n’est PAS touché)' : ''}`)
  p('══════════════════════════════════════════════════════════════════════════════════')
  p()
  p('CORPS')
  p(`  avant : ${lignesAvant.length} lignes · ${doc.bodyOriginal.length} caractères · md5 ${md5Depart}`)
  p(`  après : ${lignesApres.length} lignes · ${corpsApres.length} caractères · md5 ${md5(corpsApres)}`)
  p(`  delta : ${lignesApres.length - lignesAvant.length} lignes · ${corpsApres.length - doc.bodyOriginal.length} caractères`)
  p(`  détail : −${lignes128.length} (appareil des art. 128 et 149) −1 (art. 157, phrase recollée) = ${-lignes128.length - 1} lignes`)
  if (-lignes128.length - 1 !== lignesApres.length - lignesAvant.length)
    throw new Error(`le compte de lignes ne se recoupe pas : détail ${-lignes128.length - 1}, mesuré ${lignesApres.length - lignesAvant.length}`)
  p(`  point de contrôle intermédiaire (retraits SEULS) : md5 ${md5(corpsRetraitsSeuls)} = celui du fichier ✓`)
  p(`  têtes d’article : ${tetes.length} (inchangé) · toc ${brutAvant.toc.length} (intact) · navToc ${brutAvant.navToc.length} (intact)`)
  p()
  p('─── VOLET 1 — LE RÉSUMÉ DE LA FICHE ───────────────────────────────────────────────')
  if (dejaFait) p('  déjà à « 191 articles » — rien à faire')
  else {
    p(`  « 189 articles » → « 191 articles » (1 occurrence, vérifiée unique)`)
    p(`  le texte porte 191 têtes : 1 → 189 sans trou, plus 63-1 et 63-2`)
    p(`  longueur du résumé : ${sumAvant.length} → ${sumApres.length} caractères — aucun autre mot ne change`)
  }
  p()
  p('─── VOLET 2 — LES ARTICLES 128 ET 149 ─────────────────────────────────────────────')
  p(`  retrait par UNION DE NUMÉROS DE LIGNE : ${lignes128.join(', ')}`)
  p(`  ${lignes128.length} lignes entières · 0 troncature · ${carRetires} caractères`)
  p()
  p('  art. 128 — l. 529-530 : phrase « → Les apports de tous actionnaires… (Article 23 de la')
  p('             Loi du 30 août 1982 sur les SFD) » + le filet de cadre qui la fermait.')
  p('             PREUVE : la Loi du 30 août 1982 est AU CORPUS (cmrtiwjvz000due7e312y6gnd) et')
  p('             elle est ANTÉRIEURE DE 23 ANS au décret — aucune loi postérieure n’a pu y')
  p('             insérer une disposition de 1982. La phrase du corps n’en est même pas la')
  p('             reprise exacte (« ou » pour « et », six mots ajoutés).')
  p('  art. 128 — l. 531-537 : encadré « Budget 2010-2011 (Moniteur Spécial #1 du 14 janvier 2011) ».')
  p('             PREUVE : c’était l’hypothèse sérieuse — le texte reproduit est réel ET postérieur.')
  p('             C’est l’article 2, vi) de la Loi de finances 2010-2011, AU CORPUS')
  p('             (cmqcmxq0k00081342ebse7j3d). Elle NE MODIFIE PAS l’article 128 : elle le cite de')
  p('             l’EXTÉRIEUR, sous le titre entier de son décret, et borne sa mesure à l’exercice.')
  p('             La phrase d’introduction de l’encadré ne figure NULLE PART dans la loi de finances')
  p('             (4 sondes à 0 occurrence), et l’encadré omet la condition « au 30 septembre 2010 ».')
  p('  art. 149 — l. 613 : note « → N.B. : Les articles 35 et 185 des lois sur les Banques… ».')
  p('             PREUVE : l’article 185 cité est celui de la Loi du 14 mai 2012, AU CORPUS')
  p('             (cms18kwzl0002pt2kbk9kv39y) — POSTÉRIEURE DE SEPT ANS. Une note de 2005 ne peut')
  p('             pas décrire une loi de 2012. La note n’édicte rien : elle rapporte.')
  p()
  p('  ⚠ CE QUI A TRANCHÉ N’EST PAS LA TRANSCRIPTION DE 2020, mais deux textes du corpus.')
  p('    Le motif retenu à 11 h 04 — « aucune pièce faisant foi ne borne ces articles » — était')
  p('    exact sur le fascicule et faux sur le corpus : la plateforme hébergeait déjà les arbitres.')
  p()
  p(`  notes portées à l’appareil : ${notesNeuves} neuve(s) · rectification de « ${rect.cle} » : ${rectifiee ? 'faite' : 'déjà à jour'}`)
  p(`    motif de la rectification : ${rect.motif.slice(0, 150)}…`)
  p(`  commentaires : ${Object.keys(brutAvant.commentaires).length} clés / ${Object.values(brutAvant.commentaires).flat().length} entrées` +
    `  →  ${nbClesApres} clés / ${nbEntreesApres} entrées`)
  p()
  p('  LAISSÉ AU CORPS, à dessein : l’alinéa de crédit-bail de l’art. 29 et l’alinéa d’acompte')
  p('  de l’art. 19 — alinéas de CONSOLIDATION, sans numéro d’article propre, donnés comme venant')
  p('  d’une loi de finances POSTÉRIEURE et modifiant l’article qui les héberge. C’est la ligne de')
  p(`  partage ; elle interdit d’utiliser « → » comme critère (il en reste ${flechesApres}, celui de l’art. 29).`)
  p()
  p('─── VOLET 3 — LES CORRECTIONS DE RÉDACTION ────────────────────────────────────────')
  // ⚠️ D4 — `appellent_une_correction` compte des DIVERGENCES, pas des articles. Les
  // 21 corrections portent sur 16 articles distincts. On compte les articles ici même,
  // plutôt que de relire un champ pour ce qu'il ne dit pas.
  const artsCorriges = new Set(rdiv.corrections.map((c) => c.article)).size
  p(`  ${rdiv.comptes.divergences_reprises} divergences reprises · ${rdiv.comptes.appellent_une_correction} divergences appellent une correction, sur ${artsCorriges} articles · ${rdiv.corrections.length} corrections`)
  p(`  toutes les chaînes « avant » revérifiées UNIQUES dans le corps en base ✓`)
  p()
  for (const c of rdiv.corrections) {
    p(`  art. ${c.article.padEnd(5)} l. ${c.lignes.join('-').padEnd(9)} [${c.categorie}${c.portee === 'typographique' ? ', typo' : ''}]`)
    p(`      avant : ${JSON.stringify(c.avant.replace(/\n/g, ' ⏎ '))}`)
    p(`      après : ${JSON.stringify(c.apres.replace(/\n/g, ' ⏎ '))}`)
    p(`      pièce : ${c.piece}`)
  }
  p()
  p('  NON CORRIGÉ, ET IL FAUT LE DIRE :')
  for (const d of rdiv.divergences.filter((x) => !x.appelle_une_correction_du_corps))
    p(`  · art. ${d.article.padEnd(5)} [${d.categorie}] ${d.verdict.slice(0, 96)}`)
  p()
  p('  · les 6 « toujours inexpliqué » (art. 160, 171, 174, 178, 186, 189) : l’argument y est')
  p('    purement grammatical, sur TÉMOIN UNIQUE. C’est exactement le raisonnement qui aurait fait')
  p('    corriger à tort les sept verrues du J.O. de 2005 que la base reproduit fidèlement.')
  p('  · la FORMULE DE CLÔTURE de l’art. 189 — « Donné au Palais National… » + 17 ministres,')
  p('    207 mots — n’est PAS versée : la transcription de 2020 en est le SEUL témoin')
  p('    (« Palais National », « LATORTUE », « BAZIN », « 202 » : 0 occurrence au fac-similé et')
  p('    dans sp10, qui s’arrêtent tous deux à l’article 126).')
  p('  · la lettre c) manquante de l’énumération de l’art. 168 est introuvable PAR CONSTRUCTION :')
  p('    la transcription supprime tous les marqueurs de liste, le fac-similé ne couvre pas l’article.')
  p()
  p('─── VOLET 4 — LE DÉCRET DU 29 SEPTEMBRE 1986 ──────────────────────────────────────')
  p(`  fiche ${doc86.id} · source ${doc86.source} · ${doc86.bodyOriginal.split('\n').length} lignes · 173 articles`)
  p(`  statut : ${doc86.status}${statut86Apres !== doc86.status ? ` → ${statut86Apres}` : '  (INCHANGÉ)'}`)
  p(`  abrogatedByNumber : ${doc86.abrogatedByNumber ?? 'null'} → null (jamais renseigné par ce script)`)
  p()
  p('  CE QUE LA MESURE ÉTABLIT :')
  p('  · le considérant, verbatim, concordant sur QUATRE pièces indépendantes :')
  p('    « Considérant qu’il y a lieu d’abroger le Décret du 29 septembre 1986, le Décret du')
  p('      27 septembre 1988 et la Loi du 5 février 1995; »')
  p('  · c’est un CONSIDÉRANT — un motif, placé avant le mot DÉCRÈTE. Il nomme sans prononcer.')
  p('  · balayage /abrog/i sur les 743 lignes du corps ET sur les 1 037 de la transcription :')
  p('    AUCUN article ne nomme le décret de 1986 ni celui de 1988. L’article 189 prononce sans')
  p('    nommer (clause balai). L’article 188 est le seul qui nomme — et il vise la loi de 1995.')
  p('  · ⚠️ le J.O. SE CONTREDIT : le sommaire du Moniteur Spécial n° 10 intitule le texte de 2005')
  p('    « Décret MODIFIANT celui du 29 septembre 1986 » (entrée d’index 0e86f9e7, déjà pointée par')
  p('    le renvoi VOIR posé ce matin). Cela se signale ; cela ne s’arbitre pas en silence.')
  p()
  p('  CE QUE LA MESURE N’ÉTABLIT PAS : que le décret de 1986 soit abrogé. C’est une réponse')
  p('  DE DROIT, pas de mesure — elle n’appartient pas au script. D’où le défaut --1986=cite.')
  p()
  if (MODE_1986 === 'rien') p('  volet 4 SAUTÉ (--1986=rien) : ni renvoi, ni résumé, ni statut.')
  else {
    p(`  RENVOIS (sens : DU TEXTE NOUVEAU VERS L’ANCIEN — un seul suffit, backlinks() fait le rétrolien)`)
    for (const x of renvois) {
      const etat = xrefDejaLa.some((d) => d.n === x.n) ? 'DÉJÀ EN BASE' : 'à créer'
      p(`  ${x.n}. [${etat}] kind=${x.kind} position=${x.position} → ${x.toId}`)
      p(`     ${x.to.slice(0, 108)}`)
      p(`     note : ${x.note.slice(0, 150)}…`)
      if (x.reserve) p(`     ⚠ réserve : ${x.reserve}`)
    }
    p(`  patron suivi : le SEUL CrossRef kind='ABROGE' du corpus (${r86.renvois.precedentDuCorpus.crossRefId}, Fêtes Légales 2024),`)
    p(`  dont la note dit en toutes lettres « la qualification est éditoriale ». Ce n’est pas une innovation.`)
    p(`  NON POSÉ : le renvoi n° 5 (1986 → index LM1986-79). L’index date l’entrée du 28 septembre 1986,`)
    p(`  la fiche porte « n° 79 du 29 septembre 1986 » : aucune pièce disponible ne tranche. C’est une question.`)
    p(`  NON POSÉ : le réciproque 1986 → 2005 — il doublerait la ligne sur les deux fiches.`)
    p()
    p(`  RÉSUMÉ DE LA FICHE DE 1986 : ${(doc86.summaryFr ?? '').length} → ${(sum86Apres ?? '').length} caractères`)
    p(`  « ${(sum86Apres ?? '').slice(0, 220)}… »`)
  }
  p()
  if (MODE_1986 === 'cite') {
    p('  ⚠ POURQUOI LES RENVOIS 1-3 SONT EN kind=CITE ET NON EN kind=ABROGE.')
    p('    Le verdict de la préparation (option B), CITÉ EN ENTIER — sa fin commande le kind :')
    p('    « cela ne supprime pas la contradiction, cela la déplace. Si le considérant ne suffit')
    p('     pas à statuer, il ne suffit pas non plus à poser un renvoi ABROGE — il faudrait alors')
    p('     le kind CITE et une note. »')
    p('    Un kind=ABROGE n’est pas un pointeur neutre : il porte le rétrolien, et il EST')
    p('    l’affirmation. Le poser tout en refusant status=ABROGE, ce serait affirmer dans un')
    p('    champ ce qu’on refuse dans l’autre — la fiche de 1986 afficherait « En vigueur » ET')
    p('    « ← ABROGE ». Les notes citent le considérant comme citation, pas comme qualification.')
    p()
    p('    ⚠ LE RENVOI N° 4 FAIT EXCEPTION, et garde kind=ABROGE dans ce mode : il ne repose pas')
    p('    sur le considérant mais sur l’ARTICLE 188, du dispositif, qui NOMME le texte —')
    p('    « La loi du 5 Février 1995 instituant un acompte provisionnel […] sont et demeurent')
    p('    rapportées. » Là, le décret ne suggère pas : il rapporte.')
    p()
    p('    Pour trancher l’abrogation des trois autres : relancer avec --1986=abroge, qui aligne')
    p('    le statut ET les kinds. C’est la décision de Me Vaval, pas la mienne.')
  }
  p()
  p('─── MESURE NON BLOQUANTE — L’INDEX EN BASE APRÈS RETRAIT ──────────────────────────')
  p(`  ${brutAvant.indexEntries.length} sujets · ${ctTotal} renvois · couverture ${couverts.size}/191 · ${ctMorts.size} renvoi mort`)
  p(`  sujets dont le radical quitte l’article visé : ${promessesVides.length}`)
  for (const v of promessesVides) p(`  · « ${v.sujet} » → art. ${v.art}`)
  p('  ⚠ CE N’EST PAS un renvoi mort : l’article existe toujours. C’est un renvoi qui promet un')
  p('    contenu que l’article ne porte plus. L’entrée voisine « Séisme du 12 janvier 2010 (mesures')
  p('    d’allègement fiscal) » → art. 17 et 21 est DÉJÀ dans cet état depuis 11 h 04 : la question')
  p('    porte sur DEUX entrées et TROIS renvois. Rien ne se perd pour la recherche — buildSearchText')
  p('    verse les commentaires dans le texte cherchable. AUCUNE entrée d’index n’est modifiée ici.')
  p()
  p('─── § 11 — VÉRIFICATIONS BLOQUANTES ───────────────────────────────────────────────')
  const tableau = [
    `11.1  en-têtes appariés ................. ${secs.length}/${brutAvant.toc.length}`,
    `11.2  aucun texte perdu .................. ${recolle === corpsApres ? 'oui' : 'NON'}`,
    `11.3  labels ancrés ...................... ${Object.keys(brutAvant.labels).length - labelsSansBloc.length}/191 · blocs sans label ${blocsSansLabel.length}`,
    `11.4  clés de commentaires atteintes ..... ${nbClesApres - orphelines.length}/${nbClesApres}`,
    `11.5  couverture d’index ................ ${couverts.size}/191 · ${ctTotal} renvois · ${ctMorts.size} mort(s)`,
    `11.6  ancres de crossRefs dans le toc ... ${brutAvant.crossRefs.length - xrefMortes.length}/${brutAvant.crossRefs.length}`,
    `11.7  ancres du menu avec cible ......... ${ancresNav.length - navMortes.length}/${ancresNav.length}`,
    `11.8  collisions sec/art ................ ${collision.length}`,
    `11.9  docId cités et présents ........... ${docIds.size - absents.length}/${docIds.size}`,
    `11.10 sentinelles ....................... ${SENTINELLES.length - manquantes.length}/${SENTINELLES.length} · interdits (corps ENTIER) ${interditsRestants.length ? interditsRestants.join(', ') : '0'} · « → » ${flechesApres}`,
    `11.11 têtes d’article .................... ${tetes.length}/191, numérotation continue`,
    `11.12 renvois de l’oracle ................ ${renvoisTestes}/${oracle.mesures.renvois} · ${regressions.length} régression(s) · ${reparations.length} réparation(s)`,
  ]
  tableau.forEach((l) => p(`  ${l}`))
  p(`  oracle : radical trouvé dans l’article cité — ${joueAvant} avant → ${joueApres} après`)
  reparations.slice(0, 10).forEach((x) => p(`    ✓ réparé : ${x}`))
  p('  ⚠ l’oracle ne couvre PAS les articles 127 à 189 : son silence sur les 13 corrections de')
  p('    cette plage est attendu, ce n’est pas un résultat.')
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
  p('─── CE QUI RESTE À ME VAVAL, ET QUE CE SCRIPT NE TRANCHE PAS ──────────────────────')
  for (const c of r128.consequences_a_arbitrer) p(`  · ${c.objet}`)
  for (const q of r86.changementDeStatutPropose.cequiResteUneQuestion) p(`  · ${q.slice(0, 150)}`)
  p('  · LE DORMANT LE PLUS NET DU CORPUS N’EST PAS CELUI-CI :')
  for (const d of r86.autresDormants.listeDesDormants)
    if (String(d.n) !== '1') p(`    ${String(d.n).padEnd(5)} ${d.cible.id.padEnd(26)} ${d.cible.titre.slice(0, 86)}`)
  p('    le n° 3 (agents de change, 1989) est abrogé NOMMÉMENT par l’article 57 du décret du')
  p('    25 novembre 2020 : abrogation nommée, dans un dispositif, cible sans ambiguïté. Il ne')
  p('    demande AUCUNE décision éditoriale — seulement d’être enregistré. Il n’est PAS traité ici.')
  p()

  // ════════════════════════════════════════════════════════════════════════════════════════
  // ÉCRITURE
  // ════════════════════════════════════════════════════════════════════════════════════════
  const horodatage = new Date().toISOString().replace(/[:.]/g, '-')
  const fichierEtat = join(DIR, `etat-anterieur-reprise-${horodatage}.json`)
  const etatAnterieur = {
    _lisezMoi:
      'État des DEUX fiches AVANT le passage de scripts/reprise-ir-2005.ts --apply. ' +
      'Sans ce fichier, le retrait des 10 lignes d’appareil et les 21 corrections ne seraient pas réversibles.',
    ecritLe: new Date().toISOString(),
    mode1986: MODE_1986,
    decret2005: {
      id: doc.id,
      source: SOURCE,
      md5BodyOriginal: md5Depart,
      summaryFr: doc.summaryFr,
      bodyOriginal: doc.bodyOriginal,
      annotationsJson: doc.annotationsJson,
      crossRefs: xrefExistants,
    },
    decret1986: {
      id: doc86.id,
      source: doc86.source,
      status: doc86.status,
      abrogatedByNumber: doc86.abrogatedByNumber,
      summaryFr: doc86.summaryFr,
      md5BodyOriginal: md5(doc86.bodyOriginal),
    },
  }
  const poids = Buffer.byteLength(JSON.stringify(etatAnterieur, null, 2), 'utf8')

  if (!APPLY) {
    accessSync(DIR, constants.W_OK)
    p(`ÉTAT ANTÉRIEUR — serait écrit dans ${fichierEtat}`)
    p(`  ${poids} octets · corps 2005 ${doc.bodyOriginal.length} car. · annotations ${doc.annotationsJson!.length} car. · ${xrefExistants.length} CrossRef`)
    p()
    p('CE QUI SERAIT ÉCRIT')
    p(`  Document ${DOC_2005} : bodyOriginal, annotationsJson, summaryFr, searchText`)
    if (MODE_1986 !== 'rien') {
      p(`  Document ${DOC_1986} : summaryFr${MODE_1986 === 'abroge' ? ', status' : ''}, searchText`)
      p(`  CrossRef : ${xrefACreer.length} créé(s)${xrefDejaLa.length ? `, ${xrefDejaLa.length} déjà en base` : ''}`)
    }
    p(`  AuditLog : 1 ARTICLE_AMENDED (2005)${MODE_1986 !== 'rien' ? ` + ${xrefACreer.length} CROSSREF_ADDED` : ''}` +
      `${MODE_1986 !== 'rien' ? ' + 1 ARTICLE_AMENDED (1986)' : ''}`)
    p(`  reindexDocument : ${MODE_1986 === 'rien' ? '1 document' : '2 documents'}, HORS transaction`)
    p()
    p('SIMULATION — rien n’a été écrit.')
    await prisma.$disconnect()
    return
  }

  // L'état antérieur est écrit AVANT la transaction : si le fichier ne s'écrit pas, rien n'a bougé.
  writeFileSync(fichierEtat, JSON.stringify(etatAnterieur, null, 2) + '\n', 'utf8')
  p(`état antérieur sauvegardé : ${fichierEtat} (${poids} octets)`)

  const searchText2005 = buildSearchText({ ...doc, bodyOriginal: corpsApres, annotationsJson: annotations, summaryFr: sumApres } as never)
  const searchText1986 = buildSearchText({ ...doc86, summaryFr: sum86Apres } as never)

  await prisma.$transaction(
    async (tx) => {
      await tx.document.update({
        where: { id: DOC_2005 },
        data: { bodyOriginal: corpsApres, annotationsJson: annotations, summaryFr: sumApres, searchText: searchText2005 },
      })
      await audit(
        {
          action: 'ARTICLE_AMENDED',
          targetType: 'Document',
          targetId: DOC_2005,
          meta: {
            source: SOURCE,
            motif:
              'Reprise du 25 août 2026 : résumé 189→191 articles ; appareil des articles 128 et 149 retiré ' +
              '(10 lignes, preuve par la Loi du 30 août 1982, la Loi de finances 2010-2011 et la Loi du 14 mai 2012, ' +
              'toutes au corpus) ; 21 corrections de rédaction sur 16 articles ; 5 notes et 1 rectification.',
            fichierEtatAnterieur: fichierEtat,
            // Ni le corps ni les annotations dans le meta : des EMPREINTES. Le texte est au fichier.
            avant: {
              md5BodyOriginal: md5Depart,
              lignes: lignesAvant.length,
              caracteres: doc.bodyOriginal.length,
              md5AnnotationsJson: md5(doc.annotationsJson ?? ''),
              commentairesCles: Object.keys(brutAvant.commentaires).length,
              summaryFrLongueur: sumAvant.length,
            },
            apres: {
              md5BodyOriginal: md5(corpsApres),
              lignes: lignesApres.length,
              caracteres: corpsApres.length,
              md5AnnotationsJson: md5(annotations),
              commentairesCles: nbClesApres,
              summaryFrLongueur: sumApres.length,
            },
            retrait: { lignes: lignes128, caracteres: carRetires, md5Intermediaire: md5(corpsRetraitsSeuls) },
            corrections: rdiv.corrections.map((c) => `art. ${c.article} l. ${c.lignes.join('-')}`),
            oracle: { renvois: renvoisTestes, regressions: regressions.length, reparations: reparations.length },
            indexPromessesVides: promessesVides.map((v) => `${v.sujet} → art. ${v.art}`),
          },
        },
        tx,
      )

      if (MODE_1986 !== 'rien') {
        for (const x of xrefACreer) {
          const cree = await tx.crossRef.create({ data: x })
          await audit(
            {
              action: 'CROSSREF_ADDED',
              targetType: 'Document',
              targetId: DOC_2005,
              meta: { refId: cree.id, kind: x.kind, toId: x.toId, position: x.position, motif: 'reprise 1986 — chaîne d’abrogation' },
            },
            tx,
          )
        }
        await tx.document.update({
          where: { id: DOC_1986 },
          data: { summaryFr: sum86Apres, status: statut86Apres, searchText: searchText1986 },
        })
        await audit(
          {
            action: 'ARTICLE_AMENDED',
            targetType: 'Document',
            targetId: DOC_1986,
            meta: {
              // ⚠️ L'énumération d'AuditAction n'a PAS d'action « statut de document changé » :
              // ARTICLE_AMENDED est le plus proche, et le meta dit ce qui a bougé.
              champs: MODE_1986 === 'abroge' ? ['status', 'summaryFr'] : ['summaryFr'],
              statutAvant: doc86.status,
              statutApres: statut86Apres,
              abrogatedByNumber: null,
              motif:
                MODE_1986 === 'abroge'
                  ? 'Décret de 2005 : considérant « qu’il y a lieu d’abroger » + clause balai de l’art. 189. ' +
                    'Aucun article ne nomme ce texte — la qualification est éditoriale.'
                  : 'Résumé exposant le dossier d’abrogation. STATUT VOLONTAIREMENT INCHANGÉ : la question est de droit.',
              fichierEtatAnterieur: fichierEtat,
            },
          },
          tx,
        )
      }
    },
    { timeout: 120_000, maxWait: 30_000 },
  )

  // ⚠️ HORS TRANSACTION : reindexDocument prend le singleton Prisma, pas `tx`. Et
  // buildSearchText seul ne suffit pas — c'est clearSearchCache() qui empêche la recherche de
  // continuer à servir l'ancien corps depuis son cache de résultats.
  await reindexDocument(DOC_2005)
  if (MODE_1986 !== 'rien') await reindexDocument(DOC_1986)

  // ⚠️ audit() ENVELOPPE SON `create` DANS UN `catch` VIDE (src/lib/auth/audit.ts l. 85-87).
  // « Journalisé » ne s'annonce donc jamais sans être RELU en base.
  const jr2005 = await prisma.auditLog.count({ where: { targetId: DOC_2005, action: 'ARTICLE_AMENDED' } })
  const jrXref = await prisma.auditLog.count({ where: { targetId: DOC_2005, action: 'CROSSREF_ADDED' } })
  const jr1986 = await prisma.auditLog.count({ where: { targetId: DOC_1986 } })
  const attenduXref = MODE_1986 === 'rien' ? 0 : xrefACreer.length
  const manque: string[] = []
  if (jr2005 < 2) manque.push(`ARTICLE_AMENDED sur 2005 : ${jr2005} (attendu ≥ 2, dont celle de 11 h 04)`)
  if (jrXref < attenduXref) manque.push(`CROSSREF_ADDED : ${jrXref} (attendu ${attenduXref})`)
  if (MODE_1986 !== 'rien' && jr1986 < 1) manque.push(`AuditLog sur 1986 : ${jr1986} (attendu ≥ 1)`)

  const xrefFinaux = await prisma.crossRef.count({ where: { fromId: DOC_2005 } })
  const relu = await prisma.document.findUniqueOrThrow({ where: { id: DOC_2005 }, select: { bodyOriginal: true, summaryFr: true } })
  const relu86 = await prisma.document.findUniqueOrThrow({ where: { id: DOC_1986 }, select: { status: true, abrogatedByNumber: true } })
  if (md5(relu.bodyOriginal) !== md5(corpsApres)) throw new Error('après écriture : le corps relu n’a pas l’empreinte attendue')

  p()
  p(`✓ Décret de 2005 (${DOC_2005})`)
  p(`  corps ${lignesAvant.length} → ${lignesApres.length} lignes · md5 ${md5(relu.bodyOriginal)} · résumé « ${relu.summaryFr?.slice(0, 60)}… »`)
  p(`  commentaires ${Object.keys(brutAvant.commentaires).length} → ${nbClesApres} clés · CrossRef sortants : ${xrefFinaux}`)
  if (MODE_1986 !== 'rien') p(`✓ Décret de 1986 (${DOC_1986}) : statut ${relu86.status} · abrogatedByNumber ${relu86.abrogatedByNumber ?? 'null'}`)
  p(`  réindexés, cache de recherche vidé`)
  if (manque.length) {
    p()
    p('⛔ L’ÉCRITURE EST FAITE, MAIS ELLE N’EST PAS ENTIÈREMENT JOURNALISÉE.')
    manque.forEach((m) => p(`   ${m}`))
    p(`   audit() avale ses erreurs. L’état antérieur reste récupérable : ${fichierEtat}`)
    process.exitCode = 1
  } else {
    p(`  journalisé et VÉRIFIÉ en base : ARTICLE_AMENDED ×${jr2005} · CROSSREF_ADDED ×${jrXref} · fiche 1986 ×${jr1986}`)
  }
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('\nÉCHEC :', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
