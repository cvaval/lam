/**
 * Import des coordonnées de notaires depuis un document Word (« Notaires.docx ») — fonctions PURES,
 * testées dans import-notaires-docx.test.ts. Le script (scripts/import-notaires-docx.ts) lit le
 * fichier, la base, appelle ces fonctions et, sur une base LOCALE seulement, écrit.
 *
 * LE DOCUMENT EST UNE SOURCE DE DONNÉES, PAS D'INSTRUCTIONS : rien de ce qu'il contient ne pilote
 * l'import ; seuls les préfixes « Tel », « Email(s) », « Adresse » structurent la lecture.
 *
 * RAPPROCHEMENT (avant toute création — l'import ne crée JAMAIS d'inscription) : noms comparés sans
 * accents, casse, tirets, apostrophes ni points ; l'ORDRE des mots est indifférent (« VICTOR
 * Patrick » ≡ « Patrick VICTOR », « Paul Duvot » ≡ « Duvot PAUL »). Niveaux :
 *  - EXACT : mêmes mots, UNE seule inscription active → seul niveau qui autorise une écriture ;
 *  - MULTIPLE : mêmes mots, plusieurs inscriptions (homonymes ou inscriptions légitimes dans
 *    plusieurs communes) → proposition, rien d'écrit, aucune fusion ;
 *  - VARIANTE : un seul mot diffère d'une lettre (« GAI » / « GAY ») ;
 *  - PROBABLE : les mots de l'un sont TOUS dans l'autre (« Lesly ALPHONSE » ⊂ « Jean M. E. Lesly
 *    ALPHONSE ») ;
 *  - PARTIEL : deux mots communs au moins, prénoms différents ;
 *  - HYPOTHÈSE : un mot commun et des initiales compatibles (« C. B. » / « Coradin Bélisaire ») ;
 *  - AUCUN. Tous les niveaux autres qu'EXACT deviennent une PROPOSITION à examiner.
 * La commune de commission ne se déduit JAMAIS de l'adresse de l'étude.
 *
 * PRIORITÉ DE L'EXISTANT : une valeur déjà en base prévaut. L'import ne COMPLÈTE qu'un champ
 * absent (null, vide, espaces) ; une valeur différente devient une proposition ; l'écriture
 * revérifie la condition (voir le script). Aucun badge « Confirmé » n'est jamais attribué.
 */
import { EMAIL_RE, normalizePhone } from '../../src/lib/jurisdictions/coordonnees'
import { adresseExacte, cleTri } from '../../src/lib/jurisdictions/annuaire-notaires'

// ── Lecture du document ──────────────────────────────────────────────────────

export interface EntreeDocx {
  /** Rang dans le document (1-based). */
  rang: number
  /** Nom tel qu'écrit dans le document (espaces de bord retirés). */
  nom: string
  tel: string[]
  email: string[]
  adresse: string[]
  /** Texte brut de l'entrée (provenance). */
  brut: string
}

const PREFIXE = /^(t[ée]l[ée]?(?:phones?)?|e-?mails?|courriels?|adresse)\b\.?\s*:?\s*/i
/** Un champ COLLÉ à la ligne précédente (« …1299Email: x ») : on le remet sur sa propre ligne. */
const CHAMP_COLLE = /(?<=\S)\s*(?=(?:e-?mails?|courriels?|adresse|t[ée]l)\s*:)/gi

/**
 * Texte du document depuis le HTML de `mammoth.convertToHtml` : `<p>` = paragraphe, `<br>` = saut
 * de ligne. ⚠️ `mammoth.extractRawText` PERD les sauts de ligne internes à un paragraphe — les
 * numéros sur plusieurs lignes s'y collent (« 2000-0011+(509) 3000-0016 ») et une ligne « Email »
 * rejoint celle des téléphones (relu sur le document réel, 18 oct. 2026).
 */
export function texteDepuisHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

const champDe = (prefixe: string): 'tel' | 'email' | 'adresse' => {
  const p = prefixe.toLowerCase()
  if (p.startsWith('t')) return 'tel'
  if (p.startsWith('a')) return 'adresse'
  return 'email'
}

/**
 * Découpe le texte brut du document (paragraphes séparés par une ligne vide, sauts de ligne
 * internes conservés — sortie de `mammoth.extractRawText`) en entrées. Un paragraphe sans préfixe
 * ouvre une entrée (le nom) ; une ligne sans préfixe dans un paragraphe préfixé prolonge le champ
 * en cours (numéros sur plusieurs lignes). Rien n'est interprété au-delà.
 */
export function lireEntrees(texte: string): { entrees: EntreeDocx[]; orphelins: string[] } {
  const entrees: EntreeDocx[] = []
  const orphelins: string[] = []
  const paragraphes = texte.replace(/\r/g, '').split(/\n\s*\n/).map((p) => p.replace(/ /g, ' ').trim()).filter(Boolean)
  for (const p of paragraphes) {
    const lignes = p.replace(CHAMP_COLLE, '\n').split('\n').map((l) => l.trim()).filter(Boolean)
    if (!PREFIXE.test(lignes[0])) {
      entrees.push({ rang: entrees.length + 1, nom: lignes.join(' ').replace(/\s+/g, ' ').trim(), tel: [], email: [], adresse: [], brut: p })
      continue
    }
    const e = entrees.at(-1)
    if (!e) { orphelins.push(p); continue }
    e.brut += `\n${p}`
    let champ: 'tel' | 'email' | 'adresse' | null = null
    for (const l of lignes) {
      const m = PREFIXE.exec(l)
      if (m) {
        champ = champDe(m[1])
        const reste = l.slice(m[0].length).trim()
        if (reste) e[champ].push(reste)
      } else if (champ) e[champ].push(l)
    }
  }
  return { entrees, orphelins }
}

// ── Coordonnées ──────────────────────────────────────────────────────────────

export type StatutTel = 'BUREAU' | 'PERSONNEL' | 'ININTERPRETABLE' | 'DOUBLON'
export interface TelLu { brut: string; e164: string | null; statut: StatutTel; note?: string }

const ANNOTATION_PERSONNELLE = /\b(pers|perso|personnel|priv[ée]?|domicile|cell(?:ulaire)?)\b/i

/**
 * Numéros d'une entrée. Séparateurs « / ; , » ; numéros accolés à leur séparateur admis. Un
 * numéro ANNOTÉ (« (pers) A.Tiers ») n'est jamais publié : personnel ou attribué à un tiers.
 * Un fragment sans indicatif complet (« 1234 ») est écarté, jamais complété d'office.
 */
export function lireTelephones(lignes: string[]): TelLu[] {
  const sortie: TelLu[] = []
  const vus = new Set<string>()
  for (const ligne of lignes) {
    // Numéros collés sans séparateur (« 2000-0011+(509) 3000-0016 ») : coupés devant chaque « + ».
    for (const seg of ligne.split(/[/;,]|(?=\+\s*\(?\s*509)/).map((s) => s.trim()).filter(Boolean)) {
      const annotation = seg.replace(/\(\s*509\s*\)/g, '').replace(/[+\d\s().-]/g, ' ').replace(/\s+/g, ' ').trim()
      const e164 = normalizePhone(seg.replace(/\(\s*509\s*\)/g, '509'))
      if (annotation) {
        sortie.push({ brut: seg, e164, statut: 'PERSONNEL', note: ANNOTATION_PERSONNELLE.test(annotation) ? `annoté « ${annotation} » : personnel ou attribué à un tiers` : `annoté « ${annotation} »` })
        continue
      }
      if (!e164) { sortie.push({ brut: seg, e164: null, statut: 'ININTERPRETABLE', note: 'numéro incomplet ou abrégé' }); continue }
      if (vus.has(e164)) { sortie.push({ brut: seg, e164, statut: 'DOUBLON' }); continue }
      vus.add(e164)
      sortie.push({ brut: seg, e164, statut: 'BUREAU' })
    }
  }
  return sortie
}

export interface CourrielLu { brut: string; valeur: string | null; statut: 'VALIDE' | 'INVALIDE' | 'DOUBLON' }

export function lireCourriels(lignes: string[]): CourrielLu[] {
  const sortie: CourrielLu[] = []
  const vus = new Set<string>()
  for (const ligne of lignes) {
    for (const brut of ligne.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean)) {
      if (!EMAIL_RE.test(brut)) { sortie.push({ brut, valeur: null, statut: 'INVALIDE' }); continue }
      const k = brut.toLowerCase()
      if (vus.has(k)) { sortie.push({ brut, valeur: brut, statut: 'DOUBLON' }); continue }
      vus.add(k)
      sortie.push({ brut, valeur: brut, statut: 'VALIDE' })
    }
  }
  return sortie
}

const VALEUR_FACTICE = /d[ée]monstration|exemple|example|placeholder|lorem|à compl[ée]ter|a completer|inconnu|non communiqu|n\/a|\?\?|xxx/i

/**
 * Adresse de l'étude : lignes jointes, espaces normalisés, pays (« , Haïti ») retiré — il est
 * implicite, et les adresses déjà publiées ne le portent pas. Rien d'autre n'est réécrit
 * (« P.V. » reste « P.V. »).
 */
export function lireAdresse(lignes: string[]): { valeur: string | null; anomalie: string | null } {
  const brute = lignes.join(' ').replace(/\s+/g, ' ').trim()
  if (!brute) return { valeur: null, anomalie: null }
  const v = brute.replace(/,\s*Ha[iï]ti\b\.?(?=\s*(?:,|$))/gi, '').replace(/\s+,/g, ',').replace(/,\s*$/, '').trim()
  if (VALEUR_FACTICE.test(v)) return { valeur: null, anomalie: `valeur factice ou ambiguë : « ${brute} »` }
  if (!adresseExacte(v)) return { valeur: null, anomalie: `adresse imprécise (ni numéro ni voie) : « ${brute} »` }
  return { valeur: v, anomalie: null }
}

// ── Rapprochement ────────────────────────────────────────────────────────────

export interface NotaireRef {
  id: string
  fullName: string
  displayName: string | null
  active: boolean
  communeName: string | null
}

export type Niveau = 'EXACT' | 'MULTIPLE' | 'VARIANTE' | 'PROBABLE' | 'PARTIEL' | 'HYPOTHESE' | 'AUCUN'
export interface Candidat { id: string; nom: string; commune: string | null; niveau: Exclude<Niveau, 'AUCUN' | 'MULTIPLE'>; motif: string }
export interface Rapprochement { niveau: Niveau; notaryId: string | null; candidats: Candidat[] }

const mots = (nom: string) => cleTri(nom.replace(/\./g, ' ')).split(' ').filter(Boolean)
const pleins = (ms: string[]) => ms.filter((m) => m.length >= 2)
const initiales = (ms: string[]) => ms.filter((m) => m.length === 1)

/** Distance d'édition bornée à 1 (substitution, insertion ou suppression d'une lettre). */
function aUneLettre(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  let j = 0
  let ecarts = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++ecarts > 1) return false
    if (a.length > b.length) i++
    else if (a.length < b.length) j++
    else { i++; j++ }
  }
  return ecarts + (a.length - i) + (b.length - j) <= 1
}

/** Mots communs : égaux, ou (4 lettres et plus) à une lettre près — « Mrie » ≡ « Marie ». */
function communs(a: string[], b: string[]): { n: number; restesA: string[]; restesB: string[] } {
  const restesB = [...b]
  const restesA: string[] = []
  let n = 0
  for (const m of a) {
    let k = restesB.indexOf(m)
    if (k < 0) k = restesB.findIndex((x) => x.length >= 4 && m.length >= 4 && aUneLettre(x, m))
    if (k >= 0) { n++; restesB.splice(k, 1) } else restesA.push(m)
  }
  return { n, restesA, restesB }
}

const cle = (ms: string[]) => [...ms].sort().join(' ')

export function rapprocher(nomDoc: string, notaires: readonly NotaireRef[]): Rapprochement {
  const d = mots(nomDoc)
  const dp = pleins(d)
  const actifs = notaires.filter((n) => n.active)
  const nomDe = (n: NotaireRef) => n.displayName ?? n.fullName

  const exacts = actifs.filter((n) => cle(pleins(mots(nomDe(n)))) === cle(dp) || (n.displayName && cle(pleins(mots(n.fullName))) === cle(dp)))
  if (exacts.length === 1) {
    const n = exacts[0]
    return { niveau: 'EXACT', notaryId: n.id, candidats: [{ id: n.id, nom: nomDe(n), commune: n.communeName, niveau: 'EXACT', motif: 'mêmes mots (ordre, accents et tirets indifférents)' }] }
  }
  if (exacts.length > 1) {
    return {
      niveau: 'MULTIPLE', notaryId: null,
      candidats: exacts.map((n) => ({ id: n.id, nom: nomDe(n), commune: n.communeName, niveau: 'EXACT' as const, motif: 'même nom : homonyme ou inscription dans une autre commune — aucune fusion' })),
    }
  }

  const candidats: Candidat[] = []
  for (const n of actifs) {
    const c = mots(nomDe(n))
    const cp = pleins(c)
    const { n: nb, restesA, restesB } = communs(dp, cp)
    if (!nb) continue
    const motif = (txt: string) => `${txt} (fiche : « ${nomDe(n)} »)`
    // Un seul mot diffère, d'une lettre, et tous les autres sont identiques.
    if (dp.length === cp.length && restesA.length === 1 && restesB.length === 1 && dp.length >= 3 && aUneLettre(restesA[0], restesB[0])) {
      candidats.push({ id: n.id, nom: nomDe(n), commune: n.communeName, niveau: 'VARIANTE', motif: motif(`variante orthographique « ${restesA[0]} » / « ${restesB[0]} »`) })
    } else if (nb >= 2 && (restesA.length === 0 || restesB.length === 0)) {
      candidats.push({ id: n.id, nom: nomDe(n), commune: n.communeName, niveau: 'PROBABLE', motif: motif(restesA.length === 0 ? `tous les mots du document figurent dans la fiche (en plus : ${restesB.join(', ') || '—'})` : `tous les mots de la fiche figurent dans le document (en plus : ${restesA.join(', ')})`) })
    } else if (nb >= 2) {
      const ini = initiales(c)
      const compat = ini.length && ini.every((i) => restesA.some((m) => m[0] === i)) ? ` ; initiales ${ini.map((i) => i.toUpperCase() + '.').join(' ')} compatibles avec ${restesA.filter((m) => ini.includes(m[0])).join(' ')}` : ''
      candidats.push({ id: n.id, nom: nomDe(n), commune: n.communeName, niveau: 'PARTIEL', motif: motif(`${nb} mots communs ; diffèrent : ${restesA.join(', ')} / ${restesB.join(', ')}${compat}`) })
    } else {
      // Un mot commun : seulement si les initiales de la fiche répondent aux mots restants du document.
      const ini = initiales(c)
      const premieres = restesA.map((m) => m[0])
      if (ini.length && ini.every((i) => premieres.includes(i))) {
        candidats.push({ id: n.id, nom: nomDe(n), commune: n.communeName, niveau: 'HYPOTHESE', motif: motif(`initiales ${ini.map((i) => i.toUpperCase() + '.').join(' ')} compatibles avec ${restesA.filter((m) => ini.includes(m[0])).join(' ')} ; à vérifier`) })
      }
    }
  }
  const ordre: Candidat['niveau'][] = ['EXACT', 'VARIANTE', 'PROBABLE', 'PARTIEL', 'HYPOTHESE']
  candidats.sort((a, b) => ordre.indexOf(a.niveau) - ordre.indexOf(b.niveau) || a.id.localeCompare(b.id))
  return { niveau: candidats[0]?.niveau ?? 'AUCUN', notaryId: null, candidats }
}

// ── Plan ─────────────────────────────────────────────────────────────────────

export const MAX_TELEPHONES = 4

export interface Existant { address: string | null; phones: string[]; email: string | null; active: boolean }

export interface Proposition { champ: 'address' | 'phones' | 'email' | 'inscription'; existant: string | null; propose: string; motif: string }
export interface Anomalie { type: string; brut: string; note: string }
export interface Completion { champ: 'address' | 'phones' | 'email'; valeur: string | string[] }

export interface PlanEntree {
  rang: number
  nom: string
  rapprochement: Rapprochement
  existant: Existant | null
  propose: { address: string | null; phones: string[]; emails: string[] }
  /** Écritures permises (EXACT seulement, champ absent en base). */
  completions: Completion[]
  propositions: Proposition[]
  anomalies: Anomalie[]
  action: string
}

const vide = (s: string | null | undefined) => !s || !s.trim()

/**
 * Plan d'une entrée. N'écrit rien. `existant` : la fiche de coordonnées de l'inscription EXACTE
 * (null si aucune). Les valeurs déjà en base prévalent toujours.
 */
export function planifier(e: EntreeDocx, notaires: readonly NotaireRef[], existantDe: (notaryId: string) => Existant | null): PlanEntree {
  const r = rapprocher(e.nom, notaires)
  const tels = lireTelephones(e.tel)
  const courriels = lireCourriels(e.email)
  const adresse = lireAdresse(e.adresse)
  const anomalies: Anomalie[] = []
  for (const t of tels) if (t.statut !== 'BUREAU') anomalies.push({ type: `TELEPHONE_${t.statut}`, brut: t.brut, note: t.note ?? (t.statut === 'DOUBLON' ? 'répété dans le document' : '') })
  for (const c of courriels) if (c.statut !== 'VALIDE') anomalies.push({ type: `COURRIEL_${c.statut}`, brut: c.brut, note: c.statut === 'INVALIDE' ? 'forme invalide' : 'répété' })
  if (adresse.anomalie) anomalies.push({ type: 'ADRESSE', brut: e.adresse.join(' '), note: adresse.anomalie })

  const bureaux = tels.filter((t) => t.statut === 'BUREAU').map((t) => t.e164!)
  const emails = courriels.filter((c) => c.statut === 'VALIDE').map((c) => c.valeur!)
  const propose = { address: adresse.valeur, phones: bureaux, emails }
  const completions: Completion[] = []
  const propositions: Proposition[] = []

  if (r.niveau !== 'EXACT' || !r.notaryId) {
    const motif = r.niveau === 'AUCUN'
      ? 'aucune inscription de la liste ne correspond : rien n’est créé'
      : `rapprochement ${r.niveau.toLowerCase()} : à confirmer par le master admin`
    propositions.push({ champ: 'inscription', existant: null, propose: e.nom, motif })
    return { rang: e.rang, nom: e.nom, rapprochement: r, existant: null, propose, completions, propositions, anomalies, action: 'PROPOSITION (aucune écriture)' }
  }

  const ex = existantDe(r.notaryId)
  if (ex && !ex.active) {
    propositions.push({ champ: 'inscription', existant: 'fiche de coordonnées retirée', propose: e.nom, motif: 'la rédaction a retiré cette fiche : rien n’est complété d’office' })
    return { rang: e.rang, nom: e.nom, rapprochement: r, existant: ex, propose, completions, propositions, anomalies, action: 'PROPOSITION (fiche retirée)' }
  }

  // Adresse : complétée si absente ; une adresse différente reste une proposition.
  if (propose.address) {
    if (vide(ex?.address)) completions.push({ champ: 'address', valeur: propose.address })
    else if (cleTri(ex!.address!) !== cleTri(propose.address)) propositions.push({ champ: 'address', existant: ex!.address, propose: propose.address, motif: 'adresse différente : l’adresse publiée prévaut' })
  }

  // Téléphones : complétés si la fiche n'en a aucun (quatre au plus) ; sinon, les nouveaux sont proposés.
  if (bureaux.length) {
    if (!ex?.phones.length) {
      completions.push({ champ: 'phones', valeur: bureaux.slice(0, MAX_TELEPHONES) })
      for (const p of bureaux.slice(MAX_TELEPHONES)) {
        anomalies.push({ type: 'TELEPHONE_AU_DELA', brut: p, note: `au-delà de ${MAX_TELEPHONES} numéros publiés` })
        propositions.push({ champ: 'phones', existant: null, propose: p, motif: `numéro supplémentaire (au-delà de ${MAX_TELEPHONES})` })
      }
    } else {
      for (const p of bureaux.filter((x) => !ex.phones.includes(x))) propositions.push({ champ: 'phones', existant: ex.phones.join(' ; '), propose: p, motif: 'numéro absent de la fiche : les numéros publiés prévalent' })
    }
  }

  // Courriel : un seul champ publié. Complété si absent ET si le document n'en donne qu'un.
  if (emails.length) {
    if (vide(ex?.email)) {
      if (emails.length === 1) completions.push({ champ: 'email', valeur: emails[0] })
      else propositions.push({ champ: 'email', existant: null, propose: emails.join(' ; '), motif: 'plusieurs courriels : le choix revient au master admin' })
    } else {
      for (const m of emails.filter((x) => x.toLowerCase() !== ex!.email!.toLowerCase())) propositions.push({ champ: 'email', existant: ex!.email, propose: m, motif: 'courriel différent : le courriel publié prévaut' })
    }
  }

  const action = completions.length
    ? `COMPLÉTER ${completions.map((c) => c.champ).join(', ')}${propositions.length ? ' + PROPOSITION' : ''}`
    : propositions.length ? 'PROPOSITION (rien à compléter)' : 'RIEN (déjà à jour)'
  return { rang: e.rang, nom: e.nom, rapprochement: r, existant: ex, propose, completions, propositions, anomalies, action }
}

/** Clé d'idempotence d'une proposition : le fichier (empreinte) et le rang de l'entrée. */
export const cleProposition = (sha256: string, rang: number) => `notaires-docx:${sha256.slice(0, 16)}:${rang}`
