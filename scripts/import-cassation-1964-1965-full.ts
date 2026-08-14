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

const F_SOMMAIRE = '/Users/cvaval/Downloads/Sommaire_Analytique_Arrets_1964-1965_full.docx'
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
  'decision attaquee': 'attaquee',
  composition: 'composition', 'composition du siege': 'composition',
  'domaines du droit': 'domaines', 'domaine s du droit': 'domaines', matiere: 'domaines',
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

async function lireSommaire(): Promise<Fiche[]> {
  const l = lignes((await mammoth.extractRawText({ buffer: readFileSync(F_SOMMAIRE) })).value)
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

async function lireArrets(): Promise<Map<string, string>> {
  const l = lignes((await mammoth.extractRawText({ buffer: readFileSync(F_ARRETS) })).value)
  // ⚠️ DEUX TRANSCRIPTIONS DU MÊME RECUEIL COHABITENT, ET C'EST LA PREMIÈRE QUI FAIT FOI
  // (décision de la rédaction). Elle écrit « No.35).- » seul sur sa ligne ; la seconde
  // « No 35).— [Mention manuscrite : 31 Mars 1965] ».
  //
  // Les en-têtes de la SECONDE servent malgré tout de BORNES : sans elles, les 1 900 lignes
  // de cette seconde transcription tombent dans l'arrêt qui la précède — mesuré, 228 455
  // caractères au lieu de 6 000. On les repère donc pour couper, sans en faire des arrêts.
  // TROIS graphies d'en-tête, deux sens :
  //   « No.35).- »                      → arrêt (première transcription)
  //   « No. 44).— 29 juillet 1965 »     → arrêt (première transcription, date en ligne)
  //   « No 35).— [Mention manuscrite… ] » → SECONDE transcription : borne, pas un arrêt
  // La distinction tient au CROCHET, pas au tiret : s'en remettre au tiret ferait perdre
  // les arrêts n° 44 et suivants de la Deuxième Section.
  const borne = (x: string) => /^N[o°]s?\.?\s*\d{1,3}\s*\)?\.?[-—–]\s*\[.*\]\s*$/.test(x)
  const retenu = (x: string) =>
    borne(x) ? null : /^N[o°]s?\.?\s*(\d{1,3})\s*\)?\.?[-—–]?\s*(?:\d{1,2}\s+\p{L}+\s+\d{4})?\s*$/u.exec(x)
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
  const fiches = await lireSommaire()
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
      select: { id: true },
    })
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
