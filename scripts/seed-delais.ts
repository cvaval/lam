/**
 * GRAINE DU CALCULATEUR DE DÉLAIS — § 5.3, § 5.4 et § 5.4 bis.
 *
 *   npx tsx scripts/seed-delais.ts                     → SIMULATION (défaut). N'écrit rien.
 *   npx tsx scripts/seed-delais.ts --apply             → écrit en base. À N'EXÉCUTER QUE SUR
 *                                                        INSTRUCTION HUMAINE EXPLICITE.
 *   npx tsx scripts/seed-delais.ts --apply --acteur=<id>  → … en nommant qui l'a décidé.
 *
 * ⚠️ LA BASE POINTÉE PAR `.env` EST CELLE DE **PRODUCTION** (Supabase). La simulation est le
 * défaut, et elle affiche l'intégralité de ce qu'elle écrirait. `--apply` refuse de démarrer
 * si l'un des douze contrôles du § 5.3 échoue : un écart d'une seule ligne est un signal
 * humain, jamais un chiffre à recaler.
 *
 * L'écriture est **une seule transaction** (`scripts/ecrire-graine-delais.ts`) : les quatre
 * tables passent ensemble ou pas du tout. Elle est **idempotente par refus** — une table déjà
 * peuplée arrête tout, plutôt que d'écraser un travail éditorial —, et **aucun slug déjà écrit
 * n'y est recalculé** (§ 5.2 bis : le slug est la clé du permalien, il ne change jamais).
 *
 * Le script n'écrit RIEN au titre d'un calcul (interdit n° 11) et n'appelle jamais
 * `runSearch()`.
 */
import { prisma } from '../src/lib/db'
// ⚠️ **`CALENDRIER_COURANT`, ET NON `CALENDRIER_V1`** (20 août 2026). Ce script écrivait
// `CALENDRIER_V1` SOUS `VERSION_CALENDRIER_COURANTE` : le jour où la version courante est
// passée à 2 (décret du 11 décembre 2024), il aurait versé les 21 lignes de la version 1
// sous le numéro 2 — un calendrier étiqueté d'une version qui n'est pas la sienne. Les deux
// constantes se lisent désormais au même endroit, elles ne peuvent plus se désaccorder.
import { CALENDRIER_COURANT, VERSION_CALENDRIER_COURANTE } from '../src/lib/delais/feries'
import { FENETRES_V1, VERSION_FENETRES_COURANTE } from '../src/lib/delais/textes'
import { kindCalcule } from '../src/lib/delais/calcul'
import { versCreateInput, versRevisionPayload } from '../src/lib/delais/graine'
import { imprimerHomonymes } from '../src/lib/delais/homonymes'
import { comparerAuFichier, deriverTableaux } from './deriver-tableaux-delais'
import { verifierTravail } from './verify-delais-travail'
import { compteRendu, ecrireGraine, lireEtat, tablesPeuplees } from './ecrire-graine-delais'
import type { ClientRacine } from './ecrire-graine-delais'
import type { EntreeGrainee } from '../src/lib/delais/repertoire'
import {
  DESAMBIGUISATION_TRAVAIL,
  KINDS_ATTENDUS_APRES,
  KINDS_ATTENDUS_AVANT,
  REPERTOIRE,
  SURCHARGES_ART_74,
  VENTILATION_ATTENDUE,
  construireEntrees,
  controler,
  deriverKind,
} from '../src/lib/delais/repertoire'
import { citationDeFranc } from '../src/lib/delais/regimes'
import { estDelegueAbsent, estSchemaAbsent } from '../src/lib/delais/service-base'

const APPLIQUER = process.argv.includes('--apply') || process.argv.includes('--commit')

/**
 * `--acteur=<id d'utilisateur>` — QUI a décidé du versement. Facultatif, et volontairement
 * non deviné : le journal préfère `null` (« un script, sans acteur nommé ») à un identifiant
 * inventé. Il est recopié dans `DelaiEntryRevision.actorId` et dans les trois lignes d'audit.
 */
// ⚠️ `|| null`, PAS `?? null` : `--acteur=` sans valeur donne la chaîne VIDE, que `??` laisse
// passer. Elle irait ensuite se heurter à la clé étrangère `AuditLog_actorId_fkey`.
const ACTEUR = process.argv.find((a) => a.startsWith('--acteur='))?.slice('--acteur='.length) || null

const titre = (s: string) => console.log(`\n${'─'.repeat(78)}\n${s}\n${'─'.repeat(78)}`)
const ligne = (s: string) => console.log(`  ${s}`)

function tableauDeComptes(compte: Record<string, number>, attendus: Record<string, number>) {
  for (const cle of Object.keys(attendus)) {
    const obtenu = compte[cle] ?? 0
    const attendu = attendus[cle]
    const marque = obtenu === attendu ? '✓' : '✗'
    ligne(`${marque} ${cle.padEnd(28)} ${String(obtenu).padStart(4)}   (attendu ${attendu})`)
  }
}

function compter<T>(xs: readonly T[], cle: (x: T) => string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const x of xs) {
    const k = cle(x)
    out[k] = (out[k] ?? 0) + 1
  }
  return out
}

async function main() {
  console.log(
    APPLIQUER
      ? '\n⚠️  MODE --apply : ce passage ÉCRIRA en base.'
      : '\n● SIMULATION (défaut). Aucune écriture. Ajoutez --apply pour écrire — décision humaine.',
  )

  const entrees = construireEntrees(REPERTOIRE)
  /** Les anomalies des contrôles qui LISENT (sources de la rédaction, base). Bloquent `--apply`. */
  const anomaliesExternes: string[] = []

  // ---- 1. les sept genres AVANT surcharges -------------------------------
  titre('1. Les sept genres — AVANT les six surcharges (§ 4.4)')
  tableauDeComptes(compter(REPERTOIRE, (l) => deriverKind(l)), KINDS_ATTENDUS_AVANT)

  // ---- 2. les sept genres APRÈS surcharges -------------------------------
  titre('2. Les sept genres — APRÈS les six surcharges (§ 4.5)')
  tableauDeComptes(compter(entrees, (e) => e.kind), KINDS_ATTENDUS_APRES)
  const calculables = entrees.filter((e) => kindCalcule(e.kind)).length
  ligne('')
  ligne(`total calculable : ${calculables}   (attendu 123)`)
  ligne(`total refusé     : ${entrees.length - calculables}   (attendu 270)`)

  // ---- 3. la répartition par code ----------------------------------------
  titre('3. La répartition par code')
  tableauDeComptes(compter(entrees, (e) => e.code), { CPC: 232, CIVIL: 114, TRAVAIL: 47 })

  // ---- 4. les entrées CIVIL en régime FRANC ------------------------------
  titre('4. Les entrées CIVIL en régime FRANC, avec leur citation (§ 4.7, garde-fou 1)')
  const civilFranc = entrees.filter((e) => e.code === 'CIVIL' && e.regime === 'FRANC')
  ligne(`${civilFranc.length} entrées (attendu 6)`)
  for (const e of civilFranc) {
    const { citation } = citationDeFranc(e.regimeFondement)
    ligne('')
    ligne(`• ${e.article} — ${e.objetFr.slice(0, 60)}`)
    if (citation) {
      ligne(`  ✓ citation : « ${citation.slice(0, 110)}… »`)
    } else {
      ligne(`  ✗ AUCUNE CITATION → regimeIncertain: ${e.regimeIncertain}`)
      ligne(`    ${e.regimeFondement.slice(0, 200)}…`)
    }
  }

  // ---- 5. les entrées TRAVAIL en regimeIncertain --------------------------
  titre('5. Les délais du Code du travail au régime DOUTEUX (§ 4.7, garde-fou 2)')
  const douteux = entrees.filter((e) => e.code === 'TRAVAIL' && e.regimeIncertain)
  ligne(`${douteux.length} entrées (attendu 6) — tête d’affiche en ORDINAIRE, franc en lecture nommée`)
  for (const e of douteux) ligne(`• ${e.article.padEnd(26)} ${e.jours} j — ${e.objetFr.slice(0, 60)}`)
  ligne('→ À FAIRE TRANCHER PAR LA RÉDACTION : lesquels sont des « délais de procédure » ?')

  // ---- 6. les 19 entrées déterminées portant une distance ------------------
  titre('6. Les entrées déterminées portant une distance (§ 4.4)')
  const avecDistance = REPERTOIRE.filter((l) => l.determine && l.distance)
  ligne(`${avecDistance.length} entrées (attendu 19), ventilées :`)
  tableauDeComptes(
    compter(avecDistance, (l) => `${l.code}/${l.unite}`),
    { 'CPC/jour': 14, 'CIVIL/jour': 4, 'CPC/heure': 1 },
  )
  ligne('  (l’entrée en heures — art. 516 — est refusée par son genre : sa distance est sans objet)')
  const a5 = entrees.filter((e) => e.avisDistance === 'A5')
  const a5bis = entrees.filter((e) => e.avisDistance === 'A5_BIS')
  ligne('')
  ligne(`A5     (« un jour par cinq lieues ») : ${a5.map((e) => e.article).join(', ')}`)
  ligne(`A5-bis (renvoi non chiffré)          : ${a5bis.map((e) => e.article).join(', ')}`)

  // ---- 7. les fondements vides -------------------------------------------
  titre('7. Fondements et motifs vides')
  const vides = entrees.filter(
    (e) =>
      !e.regimeFondement.trim() ||
      !e.prorogationFondement.trim() ||
      (!kindCalcule(e.kind) && !e.motifRefusFr?.trim()),
  )
  ligne(vides.length === 0 ? '✓ aucun' : `✗ ${vides.length} : ${vides.map((e) => e.slug).join(', ')}`)

  // ---- 8. les 393 slugs ---------------------------------------------------
  titre('8. Les 393 slugs (§ 5.2 bis)')
  const parSlug = compter(entrees, (e) => e.slug)
  const doublons = Object.entries(parSlug).filter(([, n]) => n > 1)
  ligne(`${entrees.length} slugs, ${Object.keys(parSlug).length} distincts, ${doublons.length} doublon(s)`)
  ligne(`longueur maximale : ${Math.max(...entrees.map((e) => e.slug.length))} caractères`)
  const bases = compter(entrees, (e) => `${e.code}|${e.article}`)
  const groupes = Object.entries(bases).filter(([, n]) => n > 1)
  ligne(`${groupes.length} groupes désambiguïsés (attendu 26), couvrant ${groupes.reduce((s, [, n]) => s + n, 0)} lignes (attendu 56)`)
  // ⚠️ CORRECTIF (défaut 16 c). Le § 5.3 exige « la liste des 26 groupes désambiguïsés » ;
  // le script n'en imprimait que QUATRE, choisis en dur. Un contrôle humain ne peut pas
  // porter sur un échantillon que le script a choisi lui-même.
  for (const [cle] of groupes.sort(([a], [b]) => a.localeCompare(b, 'fr'))) {
    const membres = entrees.filter((e) => `${e.code}|${e.article}` === cle)
    ligne(`  ${cle.padEnd(34)} → ${membres.map((e) => e.slug).join(' · ')}`)
  }

  // ---- 9. la ventilation par tableau --------------------------------------
  titre('9. La ventilation par tableau (§ 5.2 ter)')

  // ⚠️ CORRECTIF (défaut 13). Le § 5.2 ter impose que « le script de graine RELIT les trois
  // sources, assigne `tableau`, `ordre` et `tableauTitreFr`, PUIS vérifie que la ligne
  // appariée porte le même `objet` que le catalogue », avec « un écart d'une seule ligne =
  // arrêt ». Les trois champs étaient déjà CUITS dans `data/delais-repertoire.json` et ce
  // contrôle comparait cette dérivation pré-cuite à des effectifs écrits en dur : il
  // vérifiait le fichier contre lui-même. La dérivation est maintenant REJOUÉE ici, à partir
  // des trois sources de la rédaction versées dans `scripts/sources/delais/`.
  const derivation = deriverTableaux(REPERTOIRE)
  if (derivation.erreurs.length > 0) {
    ligne(`✗ APPARIEMENT ROMPU — ${derivation.erreurs.length} écart(s) source ↔ catalogue :`)
    for (const e of derivation.erreurs.slice(0, 20)) ligne(`   - ${e}`)
    anomaliesExternes.push(
      `§ 5.2 ter — l’appariement aux trois sources échoue sur ${derivation.erreurs.length} ligne(s)`,
    )
  } else {
    const ecarts = comparerAuFichier(REPERTOIRE, derivation.lignes)
    ligne(
      ecarts.length === 0
        ? `✓ ${derivation.lignes.length} lignes rejouées depuis les trois sources : tableau, ordre ` +
            `et titre concordent LIGNE À LIGNE avec le catalogue (appariés sur l’« objet »).`
        : `✗ ${ecarts.length} écart(s) entre le catalogue et les trois sources :`,
    )
    for (const e of ecarts) ligne(`   - ${e}`)
    if (ecarts.length > 0) {
      anomaliesExternes.push(`§ 5.2 ter — ${ecarts[0]}`)
    }
  }
  ligne('')

  for (const [code, attendus] of Object.entries(VENTILATION_ATTENDUE)) {
    const obtenus = compter(
      entrees.filter((e) => e.code === code),
      (e) => String(e.tableau),
    )
    const total = Object.values(obtenus).reduce((s, n) => s + n, 0)
    const conforme = Object.entries(attendus).every(([t, n]) => (obtenus[t] ?? 0) === n)
    ligne(
      `${conforme ? '✓' : '✗'} ${code.padEnd(8)} ${Object.keys(attendus).length} tableaux, ${total} lignes — ` +
        Object.entries(attendus)
          .map(([t, n]) => `${t}:${obtenus[t] ?? 0}/${n}`)
          .join(' '),
    )
  }
  const titresManquants = entrees.filter((e) => e.code !== 'CPC' && !e.tableauTitreFr).length
  ligne(`titres de tableau absents hors C. pr. civ. : ${titresManquants} (attendu 0)`)
  ligne('(les 10 tableaux du C. pr. civ. n’ont pas de titre d’origine — n’en invente pas)')

  // ---- 10. les lignes A_VERIFIER ------------------------------------------
  titre('10. Les lignes « régime à vérifier » (§ 4.7, garde-fou 3)')
  const aVerifier = entrees.filter((e) => e.regime === 'A_VERIFIER')
  ligne(`${aVerifier.length} lignes (attendu 4) — aucune conversion en FRANC ni en ORDINAIRE`)
  for (const e of aVerifier) {
    ligne(
      `• ${e.code} ${e.article.padEnd(28)} ${e.kind.padEnd(12)} ${kindCalcule(e.kind) ? '✗ CALCULE — ARRÊT' : '✓ refusée par le genre'}`,
    )
  }

  // ---- 11. les 8 entrées TRAVAIL homonymes --------------------------------
  titre('11. Les entrées du Code du travail à numéro HOMONYME (§ 4.5 bis)')
  const homonymes = entrees.filter((e) => e.code === 'TRAVAIL' && e.articleContexte)
  ligne(`${homonymes.length} entrées (attendu ${DESAMBIGUISATION_TRAVAIL.length})`)
  for (const e of homonymes) {
    const d = DESAMBIGUISATION_TRAVAIL.find(
      (x) => x.article === e.article && e.objetFr.startsWith(x.objetDebut),
    )
    ligne(
      `• ${e.article.padEnd(26)} occ. ${e.articleOccurrence} — ${e.jours} j — « ${d?.phraseDeControle} »`,
    )
    ligne(`    section : ${e.articleContexte?.slice(0, 90)}`)
  }
  ligne('')
  ligne('⚠️ Le lien profond de ces 8 entrées ne peut PAS être #art-N : il pointe l’ancre de')
  ligne('   section, et l’écran nomme la section en toutes lettres. « C. trav., art. 172 » nue')
  ligne('   est ambiguë — le Code du travail porte 207 numéros en double.')
  ligne('')

  // ⚠️ CORRECTIF (défaut 4). Ce contrôle-ci était le seul à ne rien contrôler : la
  // `phraseDeControle` n'était qu'IMPRIMÉE. Le corps du Code du travail est maintenant LU en
  // base et découpé par en-têtes ; on exige la phrase DANS le bloc de l'occurrence désignée
  // et la concordance du chapitre avec `articleContexte` (§ 4.5 bis).
  ligne('11 bis. La phrase de contrôle est-elle sous LE BON article ? (lecture en base)')
  ligne('')
  try {
    const r = await verifierTravail()
    imprimerHomonymes(r, ligne)
    anomaliesExternes.push(...r.anomalies)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    ligne(`✗ CONTRÔLE IMPOSSIBLE — le Code du travail n’a pas pu être lu : ${message}`)
    anomaliesExternes.push(
      '§ 4.5 bis — le contrôle des 8 entrées homonymes n’a pas pu être exécuté (base illisible)',
    )
  }

  // ---- 12. le calendrier ---------------------------------------------------
  titre('12. Le calendrier (§ 5.4 et § 5.4 bis)')
  const permanents = CALENDRIER_COURANT.filter((e) => e.typeEntree === 'PERMANENT')
  const surveiller = CALENDRIER_COURANT.filter((e) => e.typeEntree === 'A_SURVEILLER')
  ligne(`version ${VERSION_CALENDRIER_COURANTE} : ${permanents.length} PERMANENT (attendu 16) + ${surveiller.length} A_SURVEILLER (attendu 5) = ${CALENDRIER_COURANT.length} lignes (attendu 21)`)
  ligne('')
  for (const e of permanents) {
    const quand = e.mobile ? `Pâques ${e.offsetPaques! > 0 ? '+' : ''}${e.offsetPaques}` : `${e.jour}/${e.mois}`
    ligne(
      `  ${e.cle.padEnd(22)} ${e.categorie.padEnd(15)} ${e.autorite.padEnd(10)} ${quand.padEnd(12)} ${e.journee === 'JOURNEE_ENTIERE' ? '' : 'demi-journée'}`,
    )
  }
  ligne('')
  for (const e of surveiller) {
    ligne(`  ${e.cle.padEnd(22)} A_SURVEILLER   observations: ${e.observationsN}   recherche: « ${e.rechercheCorpusQ} »`)
    ligne(`    borne : ${e.observationsBorneFr?.slice(0, 70)}…`)
  }
  const surveillerFautives = surveiller.filter(
    (e) =>
      e.typeEntree !== 'A_SURVEILLER' ||
      !e.observationsTexteFr ||
      !e.observationsBorneFr ||
      typeof e.observationsN !== 'number' ||
      e.journee !== 'JOURNEE_ENTIERE',
  )
  ligne('')
  ligne(
    surveillerFautives.length === 0
      ? '✓ aucune entrée A_SURVEILLER incomplète, aucune en demi-journée, aucune en PERMANENT'
      : `✗ ${surveillerFautives.length} entrées A_SURVEILLER fautives`,
  )
  // ⚠️ CE CONTRÔLE BLOQUE. Il se contentait d'imprimer, tandis que le compte rendu final
  // affirmait « les douze contrôles sont passés » : un certificat faux au bas d'une écriture à
  // sens unique. Les constats partent désormais dans `anomaliesExternes`, la seule liste qui
  // interdise l'écriture.
  if (surveillerFautives.length) {
    anomaliesExternes.push(
      `§ 5.4 bis — ${surveillerFautives.length} entrée(s) A_SURVEILLER incomplète(s) : ` +
        surveillerFautives.map((e) => e.cle).join(', '),
    )
  }
  if (CALENDRIER_COURANT.length !== 21) {
    anomaliesExternes.push(`§ 5.4 — ${CALENDRIER_COURANT.length} lignes de calendrier, 21 attendues`)
  }
  if (permanents.length !== 16) {
    anomaliesExternes.push(`§ 5.4 — ${permanents.length} jours PERMANENT, 16 attendus`)
  }
  if (surveiller.length !== 5) {
    anomaliesExternes.push(`§ 5.4 bis — ${surveiller.length} jours A_SURVEILLER, 5 attendus`)
  }

  titre('12 bis. Les fenêtres de signification (§ 4.11)')
  for (const f of FENETRES_V1) {
    ligne(
      `  version ${VERSION_FENETRES_COURANTE} · ${f.matiere.padEnd(8)} ${f.heureDebut} h – ${f.heureFin} h · ${f.source}${f.nullite ? ' · NULLITÉ expresse' : ''}`,
    )
  }
  // ⚠️ Contrôle, pas décor : deux matières attendues, et des bornes qui se tiennent.
  if (FENETRES_V1.length !== 2) {
    anomaliesExternes.push(`§ 4.11 — ${FENETRES_V1.length} fenêtres de signification, 2 attendues`)
  }
  for (const f of FENETRES_V1) {
    if (!(f.heureDebut < f.heureFin)) {
      anomaliesExternes.push(
        `§ 4.11 — ${f.matiere} : fenêtre ${f.heureDebut} h – ${f.heureFin} h, bornes incohérentes`,
      )
    }
    if (!f.source?.trim()) {
      anomaliesExternes.push(`§ 4.11 — ${f.matiere} : la fenêtre ne cite aucune source`)
    }
  }

  // ---- Les six surcharges, en clair ---------------------------------------
  titre('Les six surcharges de l’article 74, nominativement (§ 4.5)')
  for (const s of SURCHARGES_ART_74) {
    const e = entrees.find((x) => x.article === s.article && x.objetFr.startsWith(s.objetDebut))
    ligne(
      `• art. ${s.article.padEnd(6)} base ${String(s.jours).padStart(2)} j · options ${e?.supplement?.options.length} · ${e?.slug}`,
    )
    ligne(`    ${s.justification.slice(0, 150)}`)
  }

  // ---- Le verdict ----------------------------------------------------------
  titre('VERDICT')
  // Les anomalies des contrôles hors-ligne (§ 5.3) ET celles des deux contrôles qui LISENT :
  // l'appariement aux trois sources (§ 5.2 ter) et les 8 homonymes du Code du travail
  // (§ 4.5 bis). Les trois catégories bloquent `--apply` de la même façon.
  const anomalies = [...controler(entrees), ...anomaliesExternes]
  if (anomalies.length === 0) {
    console.log('  ✓ Les douze contrôles du § 5.3 passent, sources et base comprises.')
  } else {
    console.log(`  ✗ ${anomalies.length} anomalie(s) — ARRÊT, sans écriture :`)
    for (const a of anomalies) console.log(`     - ${a}`)
  }

  titre('CE QUI SERAIT ÉCRIT')
  ligne(`DelaiEntry                 : ${entrees.length} lignes`)
  ligne(`DelaiEntryRevision         : ${entrees.length} lignes (révision 1, copie gelée)`)
  ligne(`DelaiFerie                 : ${CALENDRIER_COURANT.length} lignes (versionCalendrier ${VERSION_CALENDRIER_COURANTE})`)
  ligne(`DelaiFenetreSignification  : ${FENETRES_V1.length} lignes (versionFenetres ${VERSION_FENETRES_COURANTE})`)
  ligne('')

  // ⚠️ L'ÉTAT RÉEL DES QUATRE TABLES, LU (jamais écrit). Sans lui, la simulation annonçait
  // « 393 lignes seraient écrites » y compris quand la base en portait déjà 393 : elle
  // décrivait une intention, pas un résultat. L'écriture est idempotente PAR REFUS — une
  // seule ligne quelque part l'arrête —, et il faut pouvoir le savoir AVANT de lancer
  // `--apply`, pas après.
  try {
    const etat = await lireEtat(prisma as unknown as ClientRacine)
    const occupees = tablesPeuplees(etat)
    ligne('État actuel de la base (lecture seule) :')
    for (const [table, n] of Object.entries(etat)) {
      ligne(`  ${n === 0 ? '·' : '⚠'} ${table.padEnd(26)} ${String(n).padStart(4)} ligne(s)`)
    }
    ligne(
      occupees.length === 0
        ? '  → les quatre tables sont vides : `--apply` écrirait.'
        : `  → ${occupees.join(', ')} porte(nt) déjà des lignes : \`--apply\` REFUSERAIT d’écrire,` +
            ' pour ne pas écraser un travail éditorial.',
    )
  } catch (e) {
    ligne(
      estSchemaAbsent(e)
        ? 'État de la base : les quatre tables `Delai*` n’existent pas encore (voir scripts/migrer-delais.ts).'
        : `État de la base : illisible — ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`,
    )
  }
  ligne('')
  ligne('Le SQL de la migration, produit sans toucher à la base : prisma/sql/2026-08-delais.sql')
  ligne('(§ 5.1 et § 11.5 — l’appliquer est une décision humaine ; rien ici ne l’exécute.)')
  ligne('')
  // ⚠️ CORRECTIF (défaut 14 b). La simulation imprimait la forme INTERMÉDIAIRE
  // `EntreeGrainee`, qui ne s'applique pas telle quelle sur `DelaiEntry` : `supplement` y est
  // un OBJET là où la colonne est `supplementJson`. Elle imprime désormais le résultat de
  // `versCreateInput`, c'est-à-dire LA LIGNE, exactement comme la transaction l'écrirait.
  ligne('Exemple de ligne, telle qu’elle serait écrite (après `versCreateInput`) :')
  const exemple = entrees.find((e) => e.slug === 'cpc-354-appel-parties-demeurant-haiti')!
  console.log(
    JSON.stringify(versCreateInput(exemple), null, 2)
      .split('\n')
      .map((l) => `    ${l}`)
      .join('\n'),
  )
  ligne('')
  ligne('… et sa révision 1, copie gelée (`versRevisionPayload`) :')
  ligne(`    ${versRevisionPayload(exemple).slice(0, 150)}…`)
  ligne('')
  // La conversion est exercée sur les 393 lignes, pas seulement sur l'exemple : c'est le
  // seul moyen de savoir AVANT le `--apply` qu'aucune ne casse.
  const converties = entrees.map(versCreateInput)
  const avecSupplement = converties.filter((r) => r.supplementJson).length
  ligne(
    `Conversion exercée sur les ${converties.length} lignes : ${avecSupplement} portent un ` +
      `supplementJson, ${converties.filter((r) => r.dureeFondementFr).length} un ` +
      `dureeFondementFr, ${converties.filter((r) => r.citationArticle).length} une citation ` +
      `d’article, ${converties.filter((r) => r.surchargeAppliquee).length} une surcharge.`,
  )
  ligne('')
  ligne('⚠️ TRADUCTIONS : `objetEn`, `objetHt`, `pointDepart*`, `sanction*` et `motifRefus*`')
  ligne('   reprennent LE FRANÇAIS, et `traductionRelue` reste `false` — l’affichage retombe')
  ligne('   donc sur le français (§ 5.2). Aucune traduction n’a été inventée : faire passer')
  ligne('   ~780 libellés juridiques pour traduits serait pire que de ne pas les traduire.')

  if (!APPLIQUER) {
    console.log(
      '\n● SIMULATION terminée. Rien n’a été écrit. Le passage en base est une décision humaine :\n' +
        '  npx tsx scripts/seed-delais.ts --apply\n',
    )
    return
  }

  if (anomalies.length > 0) {
    console.error('\n✗ --apply refusé : des contrôles échouent. Rien n’a été écrit.\n')
    process.exitCode = 1
    return
  }

  // ------------------------------------------------------------------------
  // Écriture — n'est atteinte que sur `--apply` ET tous contrôles au vert.
  //
  // La migration du § 5.1 est passée (les quatre tables existent, `prisma.delaiEntry` est
  // dans le client généré) : la branche annoncée est donc écrite. Elle vit dans
  // `scripts/ecrire-graine-delais.ts` — pas ici — pour une raison de vérifiabilité : ce
  // fichier-ci exécute `main()` au chargement, donc un test qui l'importerait rejouerait
  // toute la simulation. Là-bas, le client Prisma est un paramètre, et la transaction
  // s'exerce sur un client simulé (`ecrire-graine-delais.test.ts`) sans jamais toucher la
  // production.
  //
  // La liste `anomalies` est passée telle quelle : les douze contrôles ne sont pas rejoués,
  // ils sont OPPOSÉS à l'écriture. Vide, elle autorise ; non vide, elle interdit — avant même
  // qu'une connexion ne s'ouvre.
  // ------------------------------------------------------------------------
  // ⚠️ L'ACTEUR EST VÉRIFIÉ AVANT LA TRANSACTION, ET NON DÉCOUVERT DEDANS. `AuditLog.actorId`
  // porte une clé étrangère vers `User(id)` ; un identifiant inconnu fait échouer le premier
  // `auditLog.create`. Or `audit()` avale ses erreurs — et une erreur avalée EMPOISONNE la
  // transaction PostgreSQL : l'instruction suivante rend « 25P02, current transaction is
  // aborted ». Les 809 lignes seraient annulées (le tout-ou-rien tient), mais après quinze
  // secondes et sur un message qui ne dit pas la cause. On échoue donc tôt, et en clair.
  if (ACTEUR) {
    const connu = await prisma.user.count({ where: { id: ACTEUR } })
    if (connu === 0) {
      ligne('')
      ligne(`✗ --apply REFUSÉ : aucun utilisateur ne porte l’identifiant « ${ACTEUR} ».`)
      ligne('  `--acteur` attend un User.id, pas une adresse de courriel. Sans lui, le journal')
      ligne('  portera `null` — « un script, sans acteur nommé » —, ce qui est prévu.')
      ligne('  RIEN n’a été écrit.')
      await prisma.$disconnect()
      process.exitCode = 1
      return
    }
  }

  titre('ÉCRITURE')
  let resultat
  try {
    resultat = await ecrireGraine({
      client: prisma as unknown as ClientRacine,
      entrees,
      calendrier: CALENDRIER_COURANT,
      fenetres: FENETRES_V1,
      versionCalendrier: VERSION_CALENDRIER_COURANTE,
      versionFenetres: VERSION_FENETRES_COURANTE,
      anomalies,
      acteurId: ACTEUR,
    })
  } catch (e) {
    // « La table n'existe pas encore » est une information ; « Internal Server Error » n'en
    // est pas une. Le même discernement que celui des deux routes publiques (§ 5.1).
    if (estDelegueAbsent(e)) {
      ligne('✗ Le client Prisma est ANTÉRIEUR aux modèles `Delai*` — RIEN n’a été écrit.')
      ligne('  Les tables peuvent très bien exister : c’est le client qui les ignore.')
      ligne('     npx prisma generate')
      await prisma.$disconnect()
      process.exitCode = 1
      return
    }
    if (estSchemaAbsent(e)) {
      ligne('✗ Les quatre tables `Delai*` n’existent pas dans cette base — RIEN n’a été écrit.')
      ligne('  Appliquer le schéma est une décision humaine, et un script à part :')
      ligne('     npx tsx scripts/migrer-delais.ts            (à blanc)')
      ligne('     npx tsx scripts/migrer-delais.ts --apply    (écrit le DDL)')
      console.log('')
      process.exitCode = 1
      return
    }
    throw e
  }
  for (const l of compteRendu(resultat)) ligne(l)
  console.log('')
  // Un refus n'est pas un succès : le code de sortie le dit, pour qu'un enchaînement de
  // commandes ne prenne pas « la base était déjà peuplée » pour « la base a été peuplée ».
  if (!resultat.ecrit) process.exitCode = 1
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  // Le contrôle 11 bis LIT le Code du travail en base : sans cette fermeture, le processus
  // resterait suspendu sur la connexion Prisma après la simulation.
  .finally(() => prisma.$disconnect())

/** Exporté pour le bloc 15 des tests : la graine doit être rejouable sans écrire. */
export type { EntreeGrainee }
