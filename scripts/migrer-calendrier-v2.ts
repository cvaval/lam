/**
 * § 4.3 et § 5.4 — **LA BASCULE DU CALENDRIER DES FÊTES EN VERSION 2.**
 *
 *   npx tsx scripts/migrer-calendrier-v2.ts                    → SIMULATION (défaut). N'écrit rien.
 *   npx tsx scripts/migrer-calendrier-v2.ts --apply            → écrit en base.
 *   npx tsx scripts/migrer-calendrier-v2.ts --apply --acteur=<User.id>   → … en nommant qui l'a décidé.
 *
 * ⚠️ **À LANCER AVANT TOUTE ÉDITION DU CALENDRIER AU BACK-OFFICE — UNE MODIFICATION Y PUBLIE
 * D'ELLE-MÊME UNE VERSION 2, DÉRIVÉE DE LA V1, QUI CONDAMNE CETTE BASCULE.** L'ordre des
 * opérations n'est pas indifférent : `publierVersion(lignes, base)`
 * (`src/app/api/admin/delais/calendrier/route.ts`) publie « version courante + 1 ». Si une
 * seule ligne est éditée à l'écran avant `--apply`, le back-office fabrique une version 2 de
 * 21 lignes dérivée de la V1 — dont les 4 sans texte —, le moteur la sert aussitôt comme
 * courante, et ce script refuse ensuite définitivement (« la version 2 porte DÉJÀ 21
 * ligne(s) »). L'échec est propre et rien n'est corrompu, mais le décret n'a plus de chemin
 * pour entrer : il faudrait alors viser la version SUIVANTE (voir `VERSION_CIBLE`, lue de
 * `VERSION_CALENDRIER_COURANTE` et non figée à 2), après avoir décidé du sort de la version
 * 2 publiée par mégarde — ce qui est une décision humaine, pas un rattrapage de script.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * CE QU'IL FAIT, ET CE QU'IL NE FAIT PAS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Il **INSÈRE** les 21 lignes de `CALENDRIER_V2` dans `DelaiFerie`, sous
 * `versionCalendrier: 2`. C'est tout. Il n'écrit rien d'autre, ne lit aucune autre table en
 * écriture, et **ne touche PAS À UNE SEULE LIGNE DE LA VERSION 1** :
 *
 *  - une version du calendrier est IMMUABLE (§ 4.3). Des permaliens déjà émis portent `c=1`,
 *    et le § 6.3 exige qu'ils rendent, dans dix ans, la date qu'ils rendaient le jour où ils
 *    ont été copiés dans une écriture. Modifier la v1 « pour la corriger » changerait
 *    rétroactivement un calcul déjà cité — c'est exactement ce que le versionnage empêche ;
 *  - le script REFUSE de démarrer si le fascicule de la v1 n'est pas intact en base (21
 *    lignes, dont les 4 entrées `autorite: 'REDACTION'`). Une v1 déjà amputée est un signal
 *    humain, jamais quelque chose à rattraper au passage.
 *
 * ⚠️ **LA BASE POINTÉE PAR `.env` EST CELLE DE PRODUCTION** (Supabase). La simulation est le
 * DÉFAUT et affiche l'intégralité de ce qui serait écrit, ligne par ligne. `--apply` n'est
 * lancé que par la rédaction, jamais par un agent.
 *
 * ⚠️ **IDEMPOTENT PAR REFUS.** Si `versionCalendrier: 2` porte déjà la moindre ligne, on dit
 * ce qu'on aurait écrit et on s'arrête. On n'écrase pas : la version 2 a pu être amendée
 * depuis le back-office (§ 7.4), et un second passage qui « remet en ordre » effacerait ce
 * travail éditorial.
 *
 * ⚠️ **UNE SEULE TRANSACTION**, avec son `audit()` DEDANS et le journal RELU avant de sortir :
 * `audit()` avale ses erreurs pour ne jamais bloquer une requête HTTP, si bien qu'un versement
 * dont la trace manque passerait pour un versement réussi. Il est annulé.
 *
 * ⚠️ **CE QUE LA BASCULE CHANGE POUR L'UTILISATRICE**, et il faut l'avoir lu avant de taper
 * `--apply` : `versionCalendrierCourante()` rend le MAXIMUM des versions présentes. Dès que
 * les 21 lignes de la v2 sont écrites, tout NOUVEAU calcul se fait sous le décret du
 * 11 décembre 2024 — onze fêtes légales au lieu de sept. Mesuré sur 1 826 départs
 * (`franc-pur.test.ts`) : 18 dates limites se rapprochent d'un jour de la lecture publique,
 * 1 808 ne bougent pas, aucune ne s'éloigne, et aucune date ne devient PLUS TARDIVE au
 * portail — la prorogation ne peut qu'ajouter des jours à l'échéance, jamais en retrancher.
 *
 * ⚠️ **CETTE FENÊTRE DE MESURE S'ARRÊTE APRÈS LE DÉCRET, ET ELLE CACHAIT DEUX CHOSES** —
 * toutes deux désormais écrites dans le bloc 4, en toutes lettres, avant `--apply` :
 *
 *  1. **avant le 11 décembre 2024**, les quatre ajouts ne s'appliquent pas (`appliqueDepuis`,
 *     qui est le bon choix juridique) : la date PUBLIQUE devient plus PRÉCOCE — 19 départs de
 *     2015-2019, 21 de 2020-2024, et 6 par fenêtre vont dans l'autre sens, imputables au seul
 *     `2-novembre`, que la v1 porte en demi-journée et la v2 en journée entière. Un dossier de
 *     2019 recalculé ne rend plus la date qu'il rendait la veille ;
 *  2. **le Lundi Gras**, chômé « à partir de midi » par le texte, prorogeait d'un JOUR ENTIER
 *     en tête d'affiche — une décision prise sous la v1, où la ligne était `REDACTION` et ne
 *     déplaçait donc rien. ⚠️ **TRANCHÉ LE 20 AOÛT 2026 (SOIR)** : `entreeProroge` lit
 *     désormais `journee` sous le drapeau `demiJournee` de la version de règles, la matinée
 *     reste ouvrable, et la date tardive est NOMMÉE (lecture `DEMI_JOURNEE`) au lieu d'être
 *     imposée. 40 dates limites sur 7 304 calculs cessent d'être retardées d'un jour.
 *
 * Les mesures sont GELÉES en oracle dans `franc-pur.test.ts` : elles ne bougeront pas
 * sans décision.
 */
import { prisma } from '../src/lib/db'
import { audit } from '../src/lib/auth/audit'
import {
  CALENDRIER_V2,
  VERSION_CALENDRIER_COURANTE,
  calendrier,
} from '../src/lib/delais/feries'
import type { EntreeCalendrier } from '../src/lib/delais/feries'
import { versFerieCreateInput } from './ecrire-graine-delais'
import { estDelegueAbsent, estSchemaAbsent } from '../src/lib/delais/service-base'

/**
 * ⚠️ **LUE DE `VERSION_CALENDRIER_COURANTE`, ET NON FIGÉE À 2.** Le script reste jouable en
 * version 3 : le jour où le code passe à une version suivante, la cible suit, et le contrôle
 * du bloc 2 (« le code et la base ne diraient pas la même chose ») garde tout son sens sans
 * qu'on ait à éditer deux nombres qui peuvent se désaccorder.
 */
const VERSION_CIBLE = VERSION_CALENDRIER_COURANTE
const VERSION_SOURCE = VERSION_CIBLE - 1

/**
 * Le calendrier de la version PRÉCÉDENTE, lu de `CALENDRIERS` et non nommé en dur : c'est lui
 * qui doit être intact en base avant qu'on écrive par-dessus. `calendrier()` lève si la
 * version n'existe pas — un refus franc vaut mieux qu'une comparaison contre la mauvaise liste.
 */
const CALENDRIER_SOURCE = calendrier(VERSION_SOURCE)

const APPLIQUER = process.argv.includes('--apply')

/**
 * `--acteur=<User.id>` — QUI a décidé de la bascule. Facultatif et volontairement non deviné :
 * le journal préfère `null` (« un script, sans acteur nommé ») à un identifiant inventé.
 *
 * ⚠️ `|| null`, PAS `?? null` : `--acteur=` sans valeur donne la chaîne VIDE, que `??` laisse
 * passer — elle irait ensuite se heurter à la clé étrangère `AuditLog_actorId_fkey`.
 */
const ACTEUR =
  process.argv.find((a) => a.startsWith('--acteur='))?.slice('--acteur='.length) || null

const titre = (s: string) => console.log(`\n${'─'.repeat(78)}\n${s}\n${'─'.repeat(78)}`)
const ligne = (s = '') => console.log(`  ${s}`)

/** Le temps accordé à LA transaction. La base est distante ; 5 s (défaut Prisma) est trop court. */
const TIMEOUT_TRANSACTION_MS = 120_000

type LigneFerie = {
  cle: string
  typeEntree: string
  categorie: string
  autorite: string
  journee: string
  appliqueDepuis: string
  source: string
}

/** Ce que la ligne montre en simulation : tout ce qui décide d'une date. */
function resume(e: EntreeCalendrier): string {
  const quand = e.mobile
    ? `Pâques ${e.offsetPaques! > 0 ? '+' : ''}${e.offsetPaques}`
    : `${String(e.jour).padStart(2, '0')}/${String(e.mois).padStart(2, '0')}`
  const demi = e.journee === 'DEMI_JOURNEE_APRES_MIDI' ? ' · demi-journée' : ''
  return (
    `${e.cle.padEnd(22)} ${e.typeEntree.padEnd(13)} ${e.categorie.padEnd(18)} ` +
    `${e.autorite.padEnd(11)} ${quand.padEnd(12)} depuis ${e.appliqueDepuis}${demi}`
  )
}

/**
 * Les contrôles OPPOSÉS à l'écriture. Ils ne sont pas rejoués dans la transaction : une liste
 * non vide interdit `--apply` avant même qu'une connexion d'écriture ne s'ouvre.
 */
function controlerLeCode(): string[] {
  const a: string[] = []
  if (CALENDRIER_V2.length !== 21) {
    a.push(`§ 5.4 — ${CALENDRIER_V2.length} lignes en v2, 21 attendues`)
  }
  const permanents = CALENDRIER_V2.filter((e) => e.typeEntree === 'PERMANENT')
  const surveiller = CALENDRIER_V2.filter((e) => e.typeEntree === 'A_SURVEILLER')
  if (permanents.length !== 16) a.push(`§ 5.4 — ${permanents.length} PERMANENT, 16 attendus`)
  if (surveiller.length !== 5) a.push(`§ 5.4 bis — ${surveiller.length} A_SURVEILLER, 5 attendus`)

  const legales = CALENDRIER_V2.filter(
    (e) => e.typeEntree === 'PERMANENT' && e.categorie === 'FETE_LEGALE',
  )
  if (legales.length !== 11) {
    a.push(`§ 5.4 — ${legales.length} fêtes légales, 11 attendues (décret du 11 décembre 2024)`)
  }
  // ⚠️ LE CRITÈRE DE LA COMMANDE : plus une seule entrée sans texte instituant.
  const sansTexte = CALENDRIER_V2.filter((e) => e.autorite === 'REDACTION')
  if (sansTexte.length > 0) {
    a.push(`§ 5.4 — ${sansTexte.length} entrée(s) encore \`REDACTION\` : ${sansTexte.map((e) => e.cle).join(', ')}`)
  }
  for (const e of CALENDRIER_V2) {
    if (e.source.trim().length < 30) a.push(`§ 5.4 — source trop courte : ${e.cle}`)
    if (e.source.includes('instruction de la rédaction')) {
      a.push(`§ 5.4 — la formule « instruction de la rédaction » subsiste : ${e.cle}`)
    }
  }
  // Les onze fêtes légales citent le fascicule assez précisément pour qu'on le retrouve (§ 8).
  for (const e of legales) {
    for (const attendu of ['Spécial n° 66-A', '11 décembre 2024', 'Énuméré à l’art. 2']) {
      if (!e.source.includes(attendu)) a.push(`§ 8 — « ${attendu} » absent de la source : ${e.cle}`)
    }
  }
  const cles = CALENDRIER_V2.map((e) => e.cle)
  if (new Set(cles).size !== cles.length) a.push('§ 5.4 — clés en double dans la v2')

  if (VERSION_CALENDRIER_COURANTE !== VERSION_CIBLE) {
    a.push(
      `§ 4.3 — \`VERSION_CALENDRIER_COURANTE\` vaut ${VERSION_CALENDRIER_COURANTE}, ` +
        `${VERSION_CIBLE} attendue : le code et la base ne diraient pas la même chose`,
    )
  }
  // Les cinq jours à surveiller sont RECONDUITS TELS QUELS : on le vérifie ici aussi, parce
  // que c'est ce qui serait ÉCRIT, et non seulement ce que le test lit.
  const v1S = CALENDRIER_SOURCE.filter((e) => e.typeEntree === 'A_SURVEILLER')
  const v2S = CALENDRIER_V2.filter((e) => e.typeEntree === 'A_SURVEILLER')
  for (let i = 0; i < Math.min(v1S.length, v2S.length); i++) {
    if (JSON.stringify(v1S[i]) !== JSON.stringify(v2S[i])) {
      a.push(`§ 5.4 bis — le jour à surveiller « ${v2S[i].cle} » n’est pas reconduit tel quel`)
    }
  }
  return a
}

async function main() {
  titre('BASCULE DU CALENDRIER DES FÊTES — VERSION 2 (décret du 11 décembre 2024)')
  ligne(APPLIQUER ? '⚠️  MODE --apply : la base sera ÉCRITE.' : 'Simulation (défaut) : RIEN ne sera écrit.')
  ligne(`Acteur journalisé : ${ACTEUR ?? 'null (un script, sans acteur nommé)'}`)

  // ---- 1. Ce qui serait écrit --------------------------------------------
  titre(`1. LES ${CALENDRIER_V2.length} LIGNES DE LA VERSION 2`)
  ligne(
    'Source commune des onze fêtes légales : Décret du 11 décembre 2024 déterminant les Fêtes',
  )
  ligne('Légales — Le Moniteur, Spécial n° 66-A, mercredi 11 décembre 2024, art. 2.')
  ligne()
  for (const e of CALENDRIER_V2) ligne(resume(e))
  ligne()
  ligne(
    `${CALENDRIER_V2.filter((e) => e.categorie === 'FETE_LEGALE').length} fêtes légales · ` +
      `${CALENDRIER_V2.filter((e) => e.categorie === 'FETE_NATIONALE').length} fêtes nationales · ` +
      `${CALENDRIER_V2.filter((e) => e.typeEntree === 'A_SURVEILLER').length} jours à surveiller`,
  )

  // ---- 2. Les contrôles du code ------------------------------------------
  titre('2. CONTRÔLES SUR LE CODE')
  const anomalies = controlerLeCode()
  if (anomalies.length === 0) {
    ligne('✓ 21 lignes · 16 PERMANENT · 5 A_SURVEILLER · 11 fêtes légales · 0 entrée sans texte')
    ligne('✓ chaque fête légale cite le Moniteur Spécial n° 66-A et son rang à l’article 2')
    ligne('✓ les 5 jours à surveiller sont reconduits tels quels depuis la version 1')
  } else {
    for (const a of anomalies) ligne(`✗ ${a}`)
  }

  // ---- 3. L'état de la base (LECTURE SEULE) -------------------------------
  titre('3. L’ÉTAT DE LA BASE (lecture seule)')
  let v1EnBase: LigneFerie[]
  let v2EnBase: LigneFerie[]
  try {
    const champs = {
      cle: true,
      typeEntree: true,
      categorie: true,
      autorite: true,
      journee: true,
      appliqueDepuis: true,
      source: true,
    } as const
    v1EnBase = (await prisma.delaiFerie.findMany({
      where: { versionCalendrier: VERSION_SOURCE },
      select: champs,
      orderBy: { cle: 'asc' },
    })) as LigneFerie[]
    v2EnBase = (await prisma.delaiFerie.findMany({
      where: { versionCalendrier: VERSION_CIBLE },
      select: champs,
      orderBy: { cle: 'asc' },
    })) as LigneFerie[]
  } catch (e) {
    if (estDelegueAbsent(e)) {
      ligne('✗ Le client Prisma est ANTÉRIEUR aux modèles `Delai*` — RIEN n’a été lu.')
      ligne('     npx prisma generate')
      await prisma.$disconnect()
      process.exitCode = 1
      return
    }
    if (estSchemaAbsent(e)) {
      ligne('✗ La table `DelaiFerie` n’existe pas dans cette base — RIEN n’a été lu.')
      ligne('     npx tsx scripts/migrer-delais.ts --apply    (le DDL, décision humaine)')
      await prisma.$disconnect()
      process.exitCode = 1
      return
    }
    throw e
  }

  ligne(`version ${VERSION_SOURCE} : ${v1EnBase.length} lignes`)
  ligne(`version ${VERSION_CIBLE} : ${v2EnBase.length} lignes`)

  /**
   * ⚠️ **LA V1 DOIT ÊTRE INTACTE, ET ON LE VÉRIFIE AVANT D'ÉCRIRE.** Ce script ne la touche
   * pas — mais s'il la trouve déjà amputée, l'écrire par-dessus une base incohérente ne
   * ferait qu'enterrer le problème sous une version de plus.
   */
  const gardes: string[] = []
  if (v1EnBase.length !== CALENDRIER_SOURCE.length) {
    gardes.push(
      `la version ${VERSION_SOURCE} porte ${v1EnBase.length} lignes en base, ` +
        `${CALENDRIER_SOURCE.length} attendues`,
    )
  }
  // Le compte attendu vient du CODE de la version source, jamais d'un 4 écrit en dur : la v1
  // en porte quatre, une version ultérieure pourrait n'en porter aucune.
  const redactionAttendue = CALENDRIER_SOURCE.filter((e) => e.autorite === 'REDACTION').length
  const redactionV1 = v1EnBase.filter((l) => l.autorite === 'REDACTION').length
  if (v1EnBase.length > 0 && redactionV1 !== redactionAttendue) {
    gardes.push(
      `la version ${VERSION_SOURCE} porte ${redactionV1} entrées \`REDACTION\` en base, ` +
        `${redactionAttendue} attendues`,
    )
  }
  if (v2EnBase.length > 0) {
    gardes.push(
      `la version ${VERSION_CIBLE} porte DÉJÀ ${v2EnBase.length} ligne(s) : ` +
        v2EnBase.map((l) => l.cle).join(', ') +
        ` — si elles viennent du back-office (une édition y publie « version courante + 1 »), ` +
        `ce script ne peut plus rien verser sous ${VERSION_CIBLE} : la sortie est une décision ` +
        `humaine sur le sort de cette version, puis une bascule vers la version suivante`,
    )
  }
  if (gardes.length === 0) {
    ligne(
      `✓ la version ${VERSION_SOURCE} est intacte (${CALENDRIER_SOURCE.length} lignes, dont ` +
        `${redactionAttendue} sans texte instituant) — non touchée`,
    )
    ligne(`✓ la version ${VERSION_CIBLE} est vide : le versement est possible`)
  } else {
    for (const g of gardes) ligne(`✗ ${g}`)
  }

  // ---- 4. Ce que la bascule change ---------------------------------------
  titre('4. CE QUE LA BASCULE CHANGE')
  ligne('Les quatre jours que la version 1 portait SANS TEXTE — Lundi Gras, 14 août,')
  ligne('20 septembre, 1er novembre — sont énumérés par le décret du 11 décembre 2024 :')
  ligne('ils prorogent désormais la date en TÊTE D’AFFICHE, au portail comme en public.')
  ligne()
  ligne('Mesuré sur 1 826 départs (1er janv. 2025 → 31 déc. 2029), 30 jours francs,')
  ligne('sous les RÈGLES DE LECTURE COURANTES (version 2) :')
  ligne('  · 16 dates limites du portail rejoignent la date publique')
  ligne('  · 1 810 ne bougent pas · AUCUNE ne s’éloigne')
  ligne('  · écart entre les deux surfaces : 16 départs / 25 jours cumulés → ZÉRO')
  ligne()

  // ⚠️ LE POINT QUI DEMANDE UNE DÉCISION, ET QUI NE FIGURAIT NULLE PART. Le Lundi Gras est la
  // seule des onze que le texte ne chôme qu'« à partir de midi » ; la rédaction a décidé de
  // compter la demi-journée pour un jour plein. Cette décision a été prise sous la v1, où la
  // ligne était `REDACTION` et ne prorogeait donc PAS en tête d'affiche : elle ne déplaçait
  // rien. En v2 elle devient `TEXTE`, et la décision acquiert un effet — vers le PLUS TARD.
  ligne('✓  LE LUNDI GRAS — TRANCHÉ LE 20 AOÛT 2026 (SOIR), À FAIRE CONFIRMER PAR ÉCRIT :')
  ligne('    Le décret ne le chôme qu’« à partir de midi » (art. 2, 1°) : c’est la seule')
  ligne('    restriction d’horaire de la liste. La plateforme comptait la demi-journée pour')
  ligne('    un JOUR ENTIER, et cela RETARDAIT 40 dates limites sur 7 304 calculs — toujours')
  ligne('    vers le plus tard, donc vers le risque de forclusion (§ 0, règle 4).')
  ligne('    La variante a été retenue : `entreeProroge` (src/lib/delais/lectures.ts) lit')
  ligne('    `journee` sous le drapeau `demiJournee` des règles de lecture — version 1 : la')
  ligne('    demi-journée proroge (permaliens `rl=1`) ; version 2 : elle ne proroge plus, et')
  ligne('    la lecture nommée `DEMI_JOURNEE` porte la date tardive au lieu de l’imposer.')
  ligne('    ⚠️  La question de FOND reste à confirmer par écrit ; la voie retenue est celle')
  ligne('    qui ne peut pas forclore.')
  ligne()

  // ⚠️ LA FENÊTRE DE MESURE CI-DESSUS S'ARRÊTE APRÈS LE DÉCRET. Ce qu'elle ne montre pas :
  // avant le 11 décembre 2024, les quatre ajouts ne s'appliquent pas (`appliqueDepuis`), et
  // c'est la tête PUBLIQUE — qui les prorogeait déjà sous la v1 — qui devient plus précoce.
  ligne('⚠️  ET AVANT LE 11 DÉCEMBRE 2024, C’EST L’INVERSE QUI SE PRODUIT :')
  ligne('    Pour les départs ANTÉRIEURS au 11 décembre 2024, les quatre ajouts ne s’appliquent')
  ligne('    pas : la date publique devient PLUS PRÉCOCE sur 19 départs de 2015-2019 et 21 de')
  ligne('    2020-2024 (30 j francs). Un dossier de 2019 recalculé sur la page publique ne')
  ligne('    rendra donc plus la date qu’il rendait la veille.')
  ligne('    ⚠️  6 départs par fenêtre vont dans l’AUTRE sens, et ils demandent une décision :')
  ligne('    la v1 porte le 2 novembre chômé « à partir de midi » depuis 1989 (décrets de 1982')
  ligne('    et 1985), la v2 le porte en JOURNÉE ENTIÈRE — elle aussi depuis 1989. Les deux')
  ligne('    versions affirment donc deux choses différentes de la période 1989-2024. Depuis')
  ligne('    que la demi-journée ne proroge plus, ce désaccord a un effet mesurable.')
  ligne('    Les permaliens `c=1` ne sont pas concernés.')
  ligne()

  // ⚠️ LES RENVOIS AU CORPUS. La v2 rattache SES ONZE fêtes au fascicule du décret de 2024
  // (`DOC_DECRET_2024`, vérifié en base) : aucun des sept renvois que la v1 portait vers le
  // décret de 1989 n'est perdu, ils changent de pièce pour celle qui institue la v2.
  const sansRenvoi = CALENDRIER_V2.filter(
    (e) => e.typeEntree === 'PERMANENT' && !e.sourceDocId,
  )
  ligne('Renvois au corpus (`sourceDocId`) :')
  ligne(
    `    · ${CALENDRIER_V2.filter((e) => e.categorie === 'FETE_LEGALE' && e.sourceDocId).length}` +
      '/11 fêtes légales renvoient au fascicule du décret de 2024 (Moniteur Spécial n° 66-A) ;',
  )
  ligne(
    `    · ${CALENDRIER_V2.filter((e) => e.categorie === 'FETE_NATIONALE' && e.sourceDocId).length}` +
      '/5 fêtes nationales renvoient à la Constitution de 1987 ;',
  )
  ligne(
    sansRenvoi.length === 0
      ? '    · AUCUNE entrée permanente ne perd le renvoi qu’elle avait en version 1.'
      : `    · ⚠️ ${sansRenvoi.length} entrée(s) permanente(s) SANS renvoi : ${sansRenvoi.map((e) => e.cle).join(', ')}`,
  )
  ligne()
  ligne(`Les permaliens qui portent \`c=${VERSION_SOURCE}\` continuent de rendre la date de la version ${VERSION_SOURCE}.`)

  // ---- 5. L'écriture ------------------------------------------------------
  if (!APPLIQUER) {
    titre('SIMULATION TERMINÉE — RIEN N’A ÉTÉ ÉCRIT')
    ligne('Pour écrire :  npx tsx scripts/migrer-calendrier-v2.ts --apply')
    if (anomalies.length > 0 || gardes.length > 0) {
      ligne('⚠️  … mais `--apply` REFUSERAIT de démarrer en l’état (voir les ✗ ci-dessus).')
      process.exitCode = 1
    }
    console.log('')
    await prisma.$disconnect()
    return
  }

  if (anomalies.length > 0 || gardes.length > 0) {
    titre('✗ --apply REFUSÉ — RIEN N’A ÉTÉ ÉCRIT')
    for (const a of [...anomalies, ...gardes]) ligne(`✗ ${a}`)
    console.log('')
    await prisma.$disconnect()
    process.exitCode = 1
    return
  }

  // ⚠️ L'ACTEUR EST VÉRIFIÉ AVANT LA TRANSACTION, ET NON DÉCOUVERT DEDANS. `AuditLog.actorId`
  // porte une clé étrangère vers `User(id)` ; un identifiant inconnu fait échouer le
  // `auditLog.create`. Or `audit()` avale ses erreurs — et une erreur avalée EMPOISONNE la
  // transaction PostgreSQL : l'instruction suivante rend « 25P02, current transaction is
  // aborted », et les 21 lignes seraient annulées sur un message qui ne dit pas la cause.
  if (ACTEUR) {
    const connu = await prisma.user.count({ where: { id: ACTEUR } })
    if (connu === 0) {
      titre('✗ --apply REFUSÉ — RIEN N’A ÉTÉ ÉCRIT')
      ligne(`Aucun utilisateur ne porte l’identifiant « ${ACTEUR} ».`)
      ligne('`--acteur` attend un User.id, pas une adresse de courriel.')
      console.log('')
      await prisma.$disconnect()
      process.exitCode = 1
      return
    }
  }

  titre('5. ÉCRITURE (une seule transaction)')
  const cible = `calendrier-v${VERSION_CIBLE}`
  const resultat = await prisma.$transaction(
    async (tx) => {
      // Relecture DANS la transaction : entre la lecture du bloc 3 et ici, une autre session
      // a pu publier la version 2 depuis le back-office (§ 7.4). La contrainte
      // `@@unique([versionCalendrier, cle])` protégerait la base, mais sur un P2002 nu.
      const dejaLa = await tx.delaiFerie.count({ where: { versionCalendrier: VERSION_CIBLE } })
      if (dejaLa > 0) {
        throw new Error(
          `la version ${VERSION_CIBLE} porte déjà ${dejaLa} ligne(s) — transaction annulée`,
        )
      }
      const v1Toujours = await tx.delaiFerie.count({ where: { versionCalendrier: VERSION_SOURCE } })
      if (v1Toujours !== CALENDRIER_SOURCE.length) {
        throw new Error(
          `la version ${VERSION_SOURCE} porte ${v1Toujours} lignes, ${CALENDRIER_SOURCE.length} attendues — transaction annulée`,
        )
      }

      const ecrites = (
        await tx.delaiFerie.createMany({
          data: CALENDRIER_V2.map((e) => versFerieCreateInput(e, VERSION_CIBLE)),
        })
      ).count
      // Un écart d'une seule ligne ANNULE : il ne se rapporte pas.
      if (ecrites !== CALENDRIER_V2.length) {
        throw new Error(
          `DelaiFerie : ${ecrites} lignes écrites, ${CALENDRIER_V2.length} attendues — transaction annulée`,
        )
      }
      // Et la v1 n'a pas bougé d'une ligne : c'est la promesse du script, elle se vérifie.
      const v1Apres = await tx.delaiFerie.count({ where: { versionCalendrier: VERSION_SOURCE } })
      if (v1Apres !== v1Toujours) {
        throw new Error(`la version ${VERSION_SOURCE} a changé — transaction annulée`)
      }

      const journalAvant = await tx.auditLog.count({
        where: { targetType: 'DELAI', targetId: cible },
      })
      await audit(
        {
          action: 'DELAI_CALENDAR_UPDATED',
          actorId: ACTEUR,
          targetType: 'DELAI',
          targetId: cible,
          meta: {
            op: 'bascule-v2',
            version: VERSION_CIBLE,
            versionPrecedente: VERSION_SOURCE,
            lignes: ecrites,
            permanents: CALENDRIER_V2.filter((e) => e.typeEntree === 'PERMANENT').length,
            aSurveiller: CALENDRIER_V2.filter((e) => e.typeEntree === 'A_SURVEILLER').length,
            feteslegales: CALENDRIER_V2.filter((e) => e.categorie === 'FETE_LEGALE').length,
            texte:
              'Décret du 11 décembre 2024 déterminant les Fêtes Légales — Le Moniteur, ' +
              'Spécial n° 66-A, mercredi 11 décembre 2024, art. 2',
            v1Intacte: v1Apres,
          },
        },
        tx as unknown as Parameters<typeof audit>[1],
      )
      // ⚠️ `audit()` AVALE SES ERREURS pour ne jamais bloquer une requête HTTP. Un versement
      // dont la trace manque n'est pas un versement : on RELIT le journal, et on annule.
      const journalApres = await tx.auditLog.count({
        where: { targetType: 'DELAI', targetId: cible },
      })
      if (journalApres !== journalAvant + 1) {
        throw new Error('le journal d’audit n’a pas enregistré la bascule — transaction annulée')
      }
      return { ecrites, v1Apres }
    },
    { timeout: TIMEOUT_TRANSACTION_MS },
  )

  ligne(`✓ ${resultat.ecrites} lignes écrites en versionCalendrier ${VERSION_CIBLE}`)
  ligne(`✓ version 1 intacte : ${resultat.v1Apres} lignes, aucune touchée`)
  ligne(`✓ journal : DELAI_CALENDAR_UPDATED sur ${cible}`)
  ligne()
  ligne('La version 2 est désormais la version COURANTE : tout nouveau calcul se fait sous le')
  ligne('décret du 11 décembre 2024. Les permaliens `c=1` rendent toujours la version 1.')
  console.log('')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(
    '\nÉCHEC — rien n’a été appliqué (transaction annulée) :',
    e instanceof Error ? e.message : e,
  )
  await prisma.$disconnect()
  process.exit(1)
})
