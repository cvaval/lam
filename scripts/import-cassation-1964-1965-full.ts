/**
 * Recueil complet 1964-1965 : sommaire analytique + arrêts, versés en jurisprudence.
 *
 *   npx tsx scripts/import-cassation-1964-1965-full.ts           (à blanc)
 *   npx tsx scripts/import-cassation-1964-1965-full.ts --apply   (écrit)
 *
 * ⚠️ LE NUMÉRO SEUL N'IDENTIFIE PAS UN ARRÊT. Chaque section tient sa propre série : les
 * numéros 35 à 43 existent DANS LES DEUX, et le n° 16 de la Deuxième Section n'est pas
 * celui de la Première, déjà en ligne. La clé est (source, SECTION, numéro) — s'en tenir au
 * numéro écraserait des arrêts sans un mot.
 *
 * ⚠️ TROIS GABARITS DE SOMMAIRE COEXISTENT. Les étiquettes changent d'ordre et de langue
 * (« Règle de droit (Rule of Law) », « Rule of law (règle de droit) », « Règle de droit »).
 * On reconnaît sur la clé NORMALISÉE — sans accents, sans casse, sans parenthèse anglaise —
 * et toute étiquette inconnue remonte en avertissement.
 *
 * ⚠️ ON NE VERSE QUE CE QU'ON A. Un arrêt sans sommaire n'a pas d'intitulé fiable : le
 * dériver de la prose produirait des titres d'une autre facture que les autres. Ces
 * arrêts-là sont COMPTÉS ET NOMMÉS, pas versés au jugé.
 */
import { readFileSync } from 'node:fs'
import mammoth from 'mammoth'
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'
import { deduireSolution } from '../src/lib/jurisprudence/constants'
import { dateFrVersISO } from '../src/lib/jurisprudence/parse'

const F_SOMMAIRES = [
  '/Users/cvaval/Downloads/Sommaire_Analytique_Arrets_1964-1965_full.docx',
  // Deuxième Section n° 30 à 47 — gabarit propre et homogène, reçu séparément.
  '/Users/cvaval/Downloads/Sommaire_Analytique_2e_Section_Arrets_30-47.docx',
  // Deuxième Section n° 2 à 15 — même gabarit que le précédent, reçu le 15 août.
  '/Users/cvaval/Downloads/Sommaire_Analytique_2e_Section_Arrets_2-15.docx',
]
/**
 * QUATRIÈME GABARIT — Première Section n° 2 à 16.
 *
 * ⚠️ IL NE MET PAS SES VALEURS SUR LA LIGNE DE L'ÉTIQUETTE. Le libellé occupe sa propre
 * ligne, la valeur suit sur la suivante ; et les trois rubriques d'analyse sont regroupées
 * sous un intertitre « Règle de droit · Question · Motifs », chacune introduite par son nom
 * suivi d'un POINT — « Règle de droit. Tout pourvoyant doit… ». Un analyseur qui cherche
 * « étiquette : valeur » ne voit rien de ce fichier.
 */
const F_SOMMAIRE_1RE_2_16 = '/Users/cvaval/Downloads/Sommaire_Analytique_Arrets_2-16_1964-1965_1.docx'
const F_ARRETS = '/Users/cvaval/Downloads/Cour_de_Cassation_Arrets_1964-1965_full.docx'
const SOURCE = 'CASSATION_1964_1965'
const RECUEIL = 'Cour de Cassation — exercice 1964-1965 (recueil complet)'

/** Clé d'étiquette : sans accents, sans casse, sans la glose anglaise entre parenthèses. */
function cleEtiquette(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\([^)]*\)/g, ' ').replace(/[^a-z]+/g, ' ').trim()
}
/** Les trois gabarits ramenés à un vocabulaire unique. */
const RUBRIQUES: Record<string, string> = {
  'date de l arret': 'date', date: 'date', 'date du prononce': 'date',
  juridiction: 'juridiction', 'juridiction ayant rendu la decision': 'juridiction',
  'decision attaquee': 'attaquee', 'decision attaquee objet de la saisine': 'attaquee',
  // ⚠️ DEUX DATES, ET ELLES DIVERGENT. « Date du prononcé » est celle de l'arrêt ; « Date
  // portée sur l'extrait » est une mention manuscrite d'archive, que le sommaire signale
  // lui-même comme discordante (n° 30 : prononcé le 11 mai 1965, extrait daté du
  // 10 décembre 1964). C'est le PRONONCÉ qui fait la date de la décision.
  'date portee sur l extrait': 'dateExtrait',
  composition: 'composition', 'composition du siege': 'composition',
  'domaines du droit': 'domaines', 'domaine du droit': 'domaines', matiere: 'domaines',
  'regle de droit': 'regle', 'rule of law': 'regle',
  'question de droit': 'question', issue: 'question',
  'solution et motifs': 'motifs', 'holding and reasoning': 'motifs',
  solution: 'solution', resume: 'resume', analyse: 'resume',
  'ministere public': 'ministerePublic', greffe: 'greffe',
}

interface Fiche {
  section: string
  numero: string
  intitule: string
  champs: Record<string, string>
  inconnues: string[]
}

function lignes(t: string) { return t.split('\n').map((x) => x.replace(/\s+/g, ' ').trim()) }

async function lireSommaire(fichier: string): Promise<Fiche[]> {
  const l = lignes((await mammoth.extractRawText({ buffer: readFileSync(fichier) })).value)
  const est = (x: string) => /^(?:Arr[êe]t\s+)?(?:(Deuxi[èe]me|Premi[èe]re)\s+Section,\s*)?N[o°]s?\.?\s*(\d{1,3})\s*[—–-]\s*(.+)$/i.exec(x)
  const debuts = l.map((x, i) => ({ m: est(x), i })).filter((d) => d.m)
  const fiches: Fiche[] = []
  for (let k = 0; k < debuts.length; k++) {
    const { m, i } = debuts[k]
    const fin = k + 1 < debuts.length ? debuts[k + 1].i : l.length
    const champs: Record<string, string> = {}
    const inconnues: string[] = []
    for (const x of l.slice(i + 1, fin)) {
      const c = x.indexOf(':')
      if (c < 4 || c > 70) continue
      const k2 = RUBRIQUES[cleEtiquette(x.slice(0, c))]
      const v = x.slice(c + 1).trim()
      if (!v) continue
      if (k2) champs[k2] = champs[k2] ? `${champs[k2]}\n${v}` : v
      else inconnues.push(x.slice(0, c).trim())
    }
    fiches.push({
      // La section n'est écrite que pour la Deuxième ; à défaut, elle se lit dans la
      // juridiction (« Cour de Cassation d'Haïti, Deuxième Section »).
      section: /deuxi/i.test(m![1] ?? '') || /deuxi/i.test(champs.juridiction ?? '') ? 'Deuxième Section' : 'Première Section',
      numero: m![2], intitule: m![3].trim(), champs, inconnues,
    })
  }
  return fiches
}

/** Gabarit « étiquette seule sur sa ligne, valeur en dessous » (Première Section 2-16). */
async function lireSommaireLigneAligne(): Promise<Fiche[]> {
  const l = lignes((await mammoth.extractRawText({ buffer: readFileSync(F_SOMMAIRE_1RE_2_16) })).value)
  const ETIQ: Record<string, string> = {
    'domaine du droit': 'domaines', 'resume editorial': 'resume', 'decision attaquee': 'attaquee',
    dispositif: 'solution', 'issue codee': 'issue', composition: 'composition',
  }
  const debuts = l.map((x, i) => ({ m: /^ARR[ÊE]T\s+N[O°]s?\.?\s*(\d{1,3})\s*$/i.exec(x), i })).filter((d) => d.m)
  const fiches: Fiche[] = []
  for (let k = 0; k < debuts.length; k++) {
    const { m, i } = debuts[k]
    const fin = k + 1 < debuts.length ? debuts[k + 1].i : l.length
    const bloc = l.slice(i + 1, fin).filter(Boolean)
    const champs: Record<string, string> = {}
    // Ligne 1 = intitulé, ligne 2 = juridiction — date.
    const intitule = bloc[0] ?? ''
    if (bloc[1]) champs.juridiction = bloc[1].split('—')[0].trim()
    const dte = bloc[1]?.match(/—\s*(.+)$/)?.[1]
    if (dte) champs.date = dte.trim()
    for (let j = 2; j < bloc.length; j++) {
      const e = ETIQ[cleEtiquette(bloc[j])]
      if (e && bloc[j + 1]) { champs[e] = bloc[j + 1]; j++; continue }
      // Les trois rubriques d'analyse : « Règle de droit. … », « Question. … », « Motifs. … »
      const r = /^(R[èe]gle de droit|Question|Motifs)\s*\.\s*(.+)$/i.exec(bloc[j])
      if (r) {
        const c = cleEtiquette(r[1])
        champs[c === 'regle de droit' ? 'regle' : c === 'question' ? 'question' : 'motifs'] = r[2].trim()
      }
    }
    fiches.push({ section: 'Première Section', numero: m![1], intitule, champs, inconnues: [] })
  }
  return fiches
}

async function lireArrets(): Promise<Map<string, string>> {
  const l = lignes((await mammoth.extractRawText({ buffer: readFileSync(F_ARRETS) })).value)
  // ⚠️ DEUX TRANSCRIPTIONS DU MÊME RECUEIL COHABITENT, ET C'EST LA PREMIÈRE QUI FAIT FOI
  // (décision de la rédaction). Elle écrit « No.35).- » seul sur sa ligne ; la seconde
  // « No 35).— [Mention manuscrite : 31 Mars 1965] ».
  //
  // Les en-têtes de la SECONDE servent malgré tout de BORNES : sans elles, les 1 900 lignes
  // de cette seconde transcription tombent dans l'arrêt qui la précède — mesuré, 228 455
  // caractères au lieu de 6 000. On les repère donc pour couper, sans en faire des arrêts.
  // SEPT graphies d'en-tête relevées, trois sens. Recensées exhaustivement après trois
  // surprises successives — chacune avait fait disparaître des arrêts :
  //   « No.35).- » · « No. 30.- »                     → arrêt
  //   « No. 44).— 29 juillet 1965 »                   → arrêt (date en ligne)
  //   « No. 2).- [Comm.] 20 Octobre 1964 »            → arrêt (MATIÈRE + date)
  //   « No. 11).- [Prise à Partie] 3 Décembre 1964 »  → arrêt (matière + date)
  //   « No 35).— [Mention manuscrite : …] »           → SECONDE transcription : borne
  //   « No 16 — Solange LACROIX c. Joseph ROC »       → intertitre de sommaire : à ignorer
  //
  // ⚠️ LE DISCRIMINANT EST LE CONTENU DU CROCHET, PAS LE CROCHET. S'en tenir au crochet
  // classait « [Comm.] » et « [Prise à Partie] » comme seconde transcription : les QUATORZE
  // arrêts de la Deuxième Section n° 2 à 15 devenaient invisibles, et leurs fiches sont
  // parties en base avec leur seul sommaire.
  const borne = (x: string) => /^N[o°]s?\.?\s*\d{1,3}\s*\)?\.?[-—–]\s*\[\s*Mention manuscrite/i.test(x)
  const intertitre = (x: string) => /^N[o°]s?\.?\s*\d{1,3}\s*[—–]\s*\p{L}.*\sc\.\s/u.test(x)
  const retenu = (x: string) =>
    borne(x) || intertitre(x)
      ? null
      : /^N[o°]s?\.?\s*(\d{1,3})\s*\)?\.?[-—–]?\s*(?:\[[^\]]*\])?\s*(?:\d{1,2}\s+\p{L}+\s+\d{4})?\s*$/u.exec(x)
  const idx: { n: string | null; i: number; s: string }[] = []
  let sect = 'Première Section'
  for (let i = 0; i < l.length; i++) {
    if (/^PREMI[ÈE]RE SECTION$/i.test(l[i])) sect = 'Première Section'
    else if (/^DEUXI[ÈE]ME SECTION$/i.test(l[i])) sect = 'Deuxième Section'
    const m = retenu(l[i])
    if (m) idx.push({ n: m[1], i, s: sect })
    else if (borne(l[i])) idx.push({ n: null, i, s: sect })
  }
  const out = new Map<string, string>()
  for (let k = 0; k < idx.length; k++) {
    if (idx[k].n === null) continue // borne de la seconde transcription — pas un arrêt
    let fin = k + 1 < idx.length ? idx[k + 1].i : l.length
    // L'en-tête d'archive du suivant (exercice, section, mention marginale) lui appartient.
    while (fin - 1 > idx[k].i && /^(EXERCICE|EX\s*:|PREMI[ÈE]RE SECTION|DEUXI[ÈE]ME SECTION|C\.T\.|\[)/i.test(l[fin - 1])) fin--
    out.set(`${idx[k].s}|${idx[k].n!}`, l.slice(idx[k].i + 1, fin).join('\n').replace(/\n{3,}/g, '\n\n').trim())
  }
  return out
}

async function main() {
  const apply = process.argv.includes('--apply')
  const parFichier = await Promise.all(F_SOMMAIRES.map(lireSommaire))
  parFichier.push(await lireSommaireLigneAligne())
  // ⚠️ ON FUSIONNE LES GÉNÉRATIONS, ON N'EN CHOISIT PAS UNE. Les sommaires successifs ne
  // portent pas les mêmes rubriques : le premier donne un « Résumé », les derniers donnent
  // règle, question et motifs. Garder « la fiche la plus complète » faisait perdre les
  // rubriques que l'autre était seule à porter — mesuré, quatorze résumés effacés.
  // Première valeur rencontrée gagne ; les fichiers sont listés du plus ancien au plus récent
  // et une rubrique déjà remplie n'est pas remplacée.
  const parCle = new Map<string, Fiche>()
  for (const f of parFichier.flat()) {
    const k = `${f.section}|${f.numero}`
    const a = parCle.get(k)
    if (!a) { parCle.set(k, { ...f, champs: { ...f.champs } }); continue }
    for (const [c, v] of Object.entries(f.champs)) if (!a.champs[c]?.trim()) a.champs[c] = v
    if (!a.intitule && f.intitule) a.intitule = f.intitule
  }
  const fiches = [...parCle.values()].sort((a, b) => a.section.localeCompare(b.section) || Number(a.numero) - Number(b.numero))
  console.log(`fiches lues ${parFichier.flat().length} → ${fiches.length} après dédoublonnage (section, numéro)`)
  const arrets = await lireArrets()
  console.log(`sommaire : ${fiches.length} fiches · arrêts : ${arrets.size} textes\n`)

  const inconnues = new Set(fiches.flatMap((f) => f.inconnues))
  if (inconnues.size) console.warn(`⚠ étiquettes non reconnues (${inconnues.size}) : ${[...inconnues].slice(0, 12).join(' · ')}\n`)

  let crees = 0, majs = 0, sansTexte = 0
  for (const f of fiches) {
    const cle = `${f.section}|${f.numero}`
    const texte = arrets.get(cle)
    const dateISO = dateFrVersISO(f.champs.date ?? '')
    const dispositif = f.champs.solution ?? null
    const manque = [!dateISO && 'date', !texte && 'texte intégral'].filter(Boolean)
    if (!texte) sansTexte++
    console.log(`${f.section.slice(0, 8)} n° ${f.numero.padStart(2)} · ${f.intitule.slice(0, 46).padEnd(46)} ${dateISO ?? '??????????'} · ${texte ? `${texte.length}c` : 'SANS TEXTE'}${manque.length ? ` ⚠ ${manque.join(', ')}` : ''}`)
    if (!apply || !dateISO) continue

    const donnees = {
      type: 'JURISPRUDENCE', status: 'PUBLIE', originalLang: 'fr', source: SOURCE,
      titleFr: f.intitule, number: f.numero, chambre: f.section,
      juridiction: f.champs.juridiction ?? `Cour de Cassation de la République d'Haïti, ${f.section}`,
      publicationDate: new Date(`${dateISO}T00:00:00Z`),
      decisionAttaquee: f.champs.attaquee ?? null,
      dispositif, solution: dispositif ? deduireSolution(dispositif) : null,
      summaryFr: f.champs.resume ?? null,
      matiere: f.champs.domaines ?? null,
      regleDroit: f.champs.regle ?? null,
      questionDroit: f.champs.question ?? null,
      motifs: f.champs.motifs ?? null,
      recueilRef: RECUEIL, exerciceDebut: 1964, exerciceFin: 1965,
      moniteurRef: `Cour de Cassation · ${f.section} · n° ${f.numero} · 1964-1965`,
      bodyOriginal: texte ?? [f.champs.resume, f.champs.motifs].filter(Boolean).join('\n\n'),
    }
    if (!donnees.bodyOriginal.trim()) { console.warn('   ⚠ corps vide — non versée'); continue }

    // ⚠️ CLÉ (source, SECTION, numéro) — le numéro seul écraserait un autre arrêt.
    const existant = await prisma.document.findFirst({
      where: { type: 'JURISPRUDENCE', source: SOURCE, number: f.numero, chambre: f.section },
      select: { id: true, bodyOriginal: true, summaryFr: true, decisionAttaquee: true, dispositif: true, solution: true, regleDroit: true, questionDroit: true, motifs: true, matiere: true },
    })
    // ⚠️ NE JAMAIS REMPLACER UN TEXTE INTÉGRAL PAR UN REPLI. Le sommaire de la Première
    // Section n° 2 à 16 arrive sans les arrêts — ils sont en base depuis le premier
    // versement. Sans cette garde, quinze textes de 3 600 à 12 000 caractères seraient
    // écrasés par la composition résumé + motifs, et rien ne l'aurait signalé.
    if (!texte && existant && (existant.bodyOriginal?.length ?? 0) > donnees.bodyOriginal.length) {
      donnees.bodyOriginal = existant.bodyOriginal!
    }
    // ⚠️ UN SOMMAIRE QUI SE TAIT N'EFFACE RIEN. Écrire `null` parce que la rubrique est
    // absente du fichier courant revient à faire dire à un recueil ce qu'un autre disait —
    // mesuré, quatorze résumés perdus au versement des sommaires 30-47 et 2-15.
    if (existant) {
      for (const c of ['summaryFr', 'decisionAttaquee', 'dispositif', 'solution', 'regleDroit', 'questionDroit', 'motifs', 'matiere'] as const) {
        if (donnees[c] == null && existant[c] != null) (donnees as Record<string, unknown>)[c] = existant[c]
      }
    }
    const doc = existant
      ? await prisma.document.update({ where: { id: existant.id }, data: donnees })
      : await prisma.document.create({ data: donnees })
    await reindexDocument(doc.id)
    existant ? majs++ : crees++
  }

  const orphelins = [...arrets.keys()].filter((k) => !fiches.some((f) => `${f.section}|${f.numero}` === k))
  console.log(`\nARRÊTS SANS SOMMAIRE — non versés (${orphelins.length}) :`)
  console.log(`   ${orphelins.join(' · ')}`)
  console.log(`\nfiches ${fiches.length} · créées ${crees} · mises à jour ${majs} · sans texte intégral ${sansTexte}`)
  if (apply) await audit({ action: 'DOC_PUBLISHED', targetType: 'Document', targetId: SOURCE, meta: { via: 'import-cassation-full', crees, majs } })
  else console.log('(exécution à blanc — ajouter --apply pour écrire)')
  await prisma.$disconnect()
}
main()
