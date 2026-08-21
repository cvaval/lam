/**
 * § 5.1, § 5.3, § 5.4 et § 5.4 bis — **L'ÉCRITURE DE LA GRAINE, EN UNE TRANSACTION.**
 *
 * Ce fichier est la branche `--apply` que `scripts/seed-delais.ts` annonçait sans l'écrire.
 * Il vit à part pour UNE raison : `seed-delais.ts` appelle `main()` au chargement du module —
 * l'importer depuis un test rejouerait toute la simulation, base comprise. Ici, rien ne
 * s'exécute à l'import, le client Prisma est un PARAMÈTRE, et la branche d'écriture se teste
 * donc sur un client simulé, sans jamais toucher la production.
 *
 * QUATRE RÈGLES, et elles ne sont pas négociables :
 *
 *  1. **Une transaction, ou rien.** Les 393 entrées, leurs 393 révisions gelées, les
 *     21 lignes de calendrier et les 2 fenêtres passent dans un seul `$transaction`. Une base
 *     à moitié peuplée serait pire que vide : l'écran servirait un répertoire amputé sans que
 *     rien ne le signale, et un délai manquant se lit comme un délai qui n'existe pas.
 *  2. **Les douze contrôles d'abord.** La liste d'anomalies est un PARAMÈTRE : si elle n'est
 *     pas vide, la fonction rend la main AVANT la moindre lecture de la base. Les contrôles ne
 *     sont pas réécrits ici — ils sont ceux de `controler()` et des deux contrôles qui lisent
 *     (§ 5.2 ter et § 4.5 bis), tels que la simulation les a déjà exécutés.
 *  3. **Idempotence par REFUS.** Si l'une des quatre tables porte déjà une ligne, on dit ce
 *     qu'on aurait écrit et on s'arrête. On n'écrase pas : une entrée en base a pu être
 *     corrigée, masquée ou supprimée par la rédaction depuis le premier versement, et un
 *     second passage qui « remet en ordre » effacerait ce travail. **Aucun slug déjà écrit
 *     n'est recalculé** — c'est la clé du permalien (§ 5.2 bis), elle ne bouge jamais.
 *  4. **Le journal fait partie de l'écriture.** `audit()` est appelé DANS la transaction, avec
 *     les comptes réels. Comme `audit()` avale ses propres erreurs pour ne jamais bloquer le
 *     flux d'une requête HTTP, on RELIT le journal avant de sortir : un versement dont la
 *     trace manque n'est pas un versement, et il est annulé.
 *
 * ⚠️ LE DÉLAI D'EXÉCUTION EST RÉGLÉ EXPLICITEMENT. La base est distante (Supabase, pooler
 * pgbouncer, `connection_limit=1`) et le défaut de Prisma pour une transaction interactive est
 * de **5 secondes** : 786 lignes ne tiennent pas dedans. On ne le découvre pas en production,
 * on le fixe ici — et on limite le nombre d'allers-retours en écrivant par lots.
 *
 * ⚠️ `createMany` ET LES DÉFAUTS. En production, `DelaiEntry.id` et `DelaiEntry.updatedAt` sont
 * NOT NULL **sans défaut côté base** (relevé le 20 août 2026 dans `information_schema`) : c'est
 * le moteur Prisma qui produit le `cuid()` et l'horodatage, pas PostgreSQL. Un `createMany` qui
 * ne les remplirait pas casserait sur une violation NOT NULL — au moment du `--apply`, sur la
 * production. Vérifié plutôt que supposé, sur une base SQLite isolée pilotée par le MÊME client
 * Prisma 5.22 (ces valeurs sont produites par le cœur du moteur, pas par le connecteur) :
 * `createMany` de deux lignes rend deux `id` cuid distincts, un `createdAt` et un `updatedAt`.
 */
import type { PrismaClient } from '@prisma/client'
import { audit } from '../src/lib/auth/audit'
import { versCreateInput, versRevisionPayload } from '../src/lib/delais/graine'
import type { EntreeCalendrier } from '../src/lib/delais/feries'
import type { EntreeGrainee } from '../src/lib/delais/repertoire'
import type { FenetreSignification } from '../src/lib/delais/textes'

// ---------------------------------------------------------------------------
// Les réglages du passage en base
// ---------------------------------------------------------------------------

/**
 * Le temps maximal accordé à LA transaction. 120 s : le versement complet tient largement
 * dedans (une quinzaine d'instructions), et une base qui met plus de deux minutes à l'avaler
 * a un problème qu'il vaut mieux voir échouer que traîner.
 */
export const TIMEOUT_TRANSACTION_MS = 120_000

/**
 * Le temps maximal d'ATTENTE d'une connexion avant que la transaction ne commence. Le défaut
 * est de 2 s ; avec `connection_limit=1`, une requête en cours suffit à le dépasser, et
 * l'échec serait alors « impossible d'obtenir une connexion », jamais « l'écriture a raté ».
 */
export const MAXWAIT_TRANSACTION_MS = 30_000

/**
 * Taille d'un lot d'`createMany`. PostgreSQL plafonne à 65 535 paramètres liés par
 * instruction ; `DelaiEntry` en porte une quarantaine par ligne. 100 lignes = ~4 000
 * paramètres : dix fois sous le plafond, et l'instruction reste lisible au journal des
 * requêtes lentes. Le découpage ne rompt PAS l'atomicité : tous les lots sont dans la même
 * transaction.
 */
export const TAILLE_LOT = 100

/** L'action de journal et la cible, par table. La cible suit la convention du back-office. */
export const CIBLE_REPERTOIRE = 'graine-repertoire-v1'
export const cibleCalendrier = (version: number) => `calendrier-v${version}`
export const cibleFenetres = (version: number) => `fenetres-v${version}`

// ---------------------------------------------------------------------------
// Le client attendu — décrit par sa FORME, pour qu'un client simulé le satisfasse
// ---------------------------------------------------------------------------

type Ligne = Record<string, unknown>
type CreerLot = (args: { data: Ligne[] }) => Promise<{ count: number }>
type Compter = (args?: unknown) => Promise<number>

/** Ce dont l'écriture a besoin, et rien de plus. Vaut pour `prisma` comme pour `tx`. */
export type ClientDelais = {
  delaiEntry: {
    count: Compter
    createMany: CreerLot
    findMany: (args?: unknown) => Promise<{ id: string; slug: string }[]>
  }
  delaiEntryRevision: { count: Compter; createMany: CreerLot }
  delaiFerie: { count: Compter; createMany: CreerLot }
  delaiFenetreSignification: { count: Compter; createMany: CreerLot }
  auditLog: { create: (args: unknown) => Promise<unknown>; count: Compter }
}

export type ClientRacine = ClientDelais & {
  $transaction: <T>(
    fn: (tx: ClientDelais) => Promise<T>,
    options?: { maxWait?: number; timeout?: number },
  ) => Promise<T>
}

// ---------------------------------------------------------------------------
// Les conversions du calendrier et des fenêtres (celle des entrées est dans graine.ts)
// ---------------------------------------------------------------------------

/**
 * Les colonnes que la graine laisse à la base sur `DelaiFerie` et
 * `DelaiFenetreSignification`. Comme pour `DelaiEntry`, la liste est TESTÉE contre
 * `prisma/schema.prisma` : une colonne ajoutée au modèle sans être versée rougit au test, pas
 * le jour du `--apply`.
 */
export const COLONNES_NON_GRAINEES_FERIE: readonly string[] = ['id', 'createdAt']
export const COLONNES_NON_GRAINEES_FENETRE: readonly string[] = ['id', 'createdAt']

function ouNull<T>(v: T | null | undefined): T | null {
  return v ?? null
}

/** Une entrée du calendrier, telle qu'elle serait ÉCRITE. Aucune valeur inventée. */
export function versFerieCreateInput(e: EntreeCalendrier, versionCalendrier: number) {
  return {
    versionCalendrier,
    cle: e.cle,
    typeEntree: e.typeEntree,
    libelleFr: e.libelleFr,
    libelleEn: e.libelleEn,
    libelleHt: e.libelleHt,
    categorie: e.categorie,
    autorite: e.autorite,
    journee: e.journee,
    noteJourneeFr: ouNull(e.noteJourneeFr),
    noteJourneeEn: ouNull(e.noteJourneeEn),
    noteJourneeHt: ouNull(e.noteJourneeHt),
    traductionRelue: e.traductionRelue,
    mobile: e.mobile,
    offsetPaques: ouNull(e.offsetPaques),
    mois: ouNull(e.mois),
    jour: ouNull(e.jour),
    source: e.source,
    sourceDocId: ouNull(e.sourceDocId),
    appliqueDepuis: e.appliqueDepuis,
    observationsN: ouNull(e.observationsN),
    observationsTexteFr: ouNull(e.observationsTexteFr),
    observationsTexteEn: ouNull(e.observationsTexteEn),
    observationsTexteHt: ouNull(e.observationsTexteHt),
    observationsBorneFr: ouNull(e.observationsBorneFr),
    observationsBorneEn: ouNull(e.observationsBorneEn),
    observationsBorneHt: ouNull(e.observationsBorneHt),
    rechercheCorpusQ: ouNull(e.rechercheCorpusQ),
  }
}

/** Une fenêtre de signification, telle qu'elle serait ÉCRITE. */
export function versFenetreCreateInput(f: FenetreSignification, versionFenetres: number) {
  return {
    versionFenetres,
    matiere: f.matiere,
    heureDebut: f.heureDebut,
    heureFin: f.heureFin,
    source: f.source,
    sourceDocId: ouNull(f.sourceDocId),
    nullite: f.nullite,
    nulliteTexteFr: ouNull(f.nulliteTexteFr),
  }
}

// ---------------------------------------------------------------------------
// L'état des quatre tables, et ce que la graine y verserait
// ---------------------------------------------------------------------------

export type EtatTables = {
  delaiEntry: number
  delaiEntryRevision: number
  delaiFerie: number
  delaiFenetreSignification: number
}

export type ProjetEcriture = EtatTables

export async function lireEtat(client: ClientDelais): Promise<EtatTables> {
  return {
    delaiEntry: await client.delaiEntry.count(),
    delaiEntryRevision: await client.delaiEntryRevision.count(),
    delaiFerie: await client.delaiFerie.count(),
    delaiFenetreSignification: await client.delaiFenetreSignification.count(),
  }
}

/** Une table déjà peuplée suffit à tout arrêter : on ne complète pas un versement partiel. */
export function tablesPeuplees(etat: EtatTables): string[] {
  return (Object.keys(etat) as (keyof EtatTables)[]).filter((t) => etat[t] > 0)
}

export type ResultatEcriture =
  | { ecrit: false; motif: 'CONTROLES_EN_ECHEC'; anomalies: string[]; projet: ProjetEcriture }
  | {
      ecrit: false
      motif: 'DEJA_PEUPLEE'
      etat: EtatTables
      peuplees: string[]
      projet: ProjetEcriture
    }
  | {
      ecrit: true
      comptes: ProjetEcriture & { auditLog: number }
      versionCalendrier: number
      versionFenetres: number
    }

export type OptionsEcriture = {
  client: ClientRacine
  entrees: readonly EntreeGrainee[]
  calendrier: readonly EntreeCalendrier[]
  fenetres: readonly FenetreSignification[]
  versionCalendrier: number
  versionFenetres: number
  /** Les anomalies des douze contrôles, TELLES QUE LA SIMULATION LES A CALCULÉES. */
  anomalies: readonly string[]
  /** L'humain qui a lancé `--apply`, s'il s'est nommé (`--acteur=<id>`). */
  acteurId?: string | null
}

function lots<T>(xs: readonly T[], taille: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < xs.length; i += taille) out.push(xs.slice(i, i + taille))
  return out
}

// ---------------------------------------------------------------------------
// L'écriture
// ---------------------------------------------------------------------------

export async function ecrireGraine(opts: OptionsEcriture): Promise<ResultatEcriture> {
  const { client, entrees, calendrier, fenetres, versionCalendrier, versionFenetres } = opts
  const acteurId = opts.acteurId ?? null

  const projet: ProjetEcriture = {
    delaiEntry: entrees.length,
    delaiEntryRevision: entrees.length,
    delaiFerie: calendrier.length,
    delaiFenetreSignification: fenetres.length,
  }

  // 1. LES DOUZE CONTRÔLES D'ABORD — avant même d'ouvrir une connexion. Un écart d'une seule
  //    ligne est un signal humain (§ 5.3) : on ne le recale pas, on s'arrête.
  if (opts.anomalies.length > 0) {
    return { ecrit: false, motif: 'CONTROLES_EN_ECHEC', anomalies: [...opts.anomalies], projet }
  }

  // 2. IDEMPOTENCE PAR REFUS. On lit avant d'écrire, et une seule ligne suffit à tout arrêter.
  const etat = await lireEtat(client)
  const peuplees = tablesPeuplees(etat)
  if (peuplees.length > 0) {
    return { ecrit: false, motif: 'DEJA_PEUPLEE', etat, peuplees, projet }
  }

  // 3. UNE TRANSACTION, OU RIEN.
  const comptes = await client.$transaction(
    async (tx) => {
      // -- a. les 393 entrées ------------------------------------------------
      const rangees = entrees.map(versCreateInput)
      let entreesEcrites = 0
      for (const lot of lots(rangees, TAILLE_LOT)) {
        entreesEcrites += (await tx.delaiEntry.createMany({ data: lot })).count
      }
      if (entreesEcrites !== entrees.length) {
        throw new Error(
          `DelaiEntry : ${entreesEcrites} lignes écrites, ${entrees.length} attendues — transaction annulée`,
        )
      }

      // -- b. les identifiants, RELUS ---------------------------------------
      // Les `id` sont posés par la base (`@default(cuid())`) : la révision les relit plutôt
      // que de les deviner. On apparie par SLUG, jamais par rang : rien ne garantit l'ordre
      // d'un `findMany`, et une révision attachée à la mauvaise entrée serait une copie gelée
      // qui ment.
      const ecrites = await tx.delaiEntry.findMany({ select: { id: true, slug: true } })
      const parSlug = new Map(ecrites.map((l) => [l.slug, l.id]))
      if (parSlug.size !== entrees.length) {
        throw new Error(
          `DelaiEntry : ${parSlug.size} slugs distincts relus, ${entrees.length} attendus — transaction annulée`,
        )
      }

      // -- c. les 393 révisions, copie GELÉE de la révision 1 ----------------
      const revisions = entrees.map((e) => {
        const entryId = parSlug.get(e.slug)
        // ⚠️ § 5.2 bis — LE SLUG NE SE RECALCULE PAS. Celui de la base est celui qui vient
        // d'être écrit ; s'il ne correspond pas à celui du répertoire, ce n'est pas un écart à
        // corriger en silence, c'est une transaction à annuler.
        if (!entryId) throw new Error(`slug écrit introuvable en relecture : ${e.slug}`)
        return {
          entryId,
          revision: versCreateInput(e).revision,
          payloadJson: versRevisionPayload(e),
          actorId: acteurId,
        }
      })
      let revisionsEcrites = 0
      for (const lot of lots(revisions, TAILLE_LOT)) {
        revisionsEcrites += (await tx.delaiEntryRevision.createMany({ data: lot })).count
      }
      if (revisionsEcrites !== entrees.length) {
        throw new Error(
          `DelaiEntryRevision : ${revisionsEcrites} lignes écrites, ${entrees.length} attendues — transaction annulée`,
        )
      }

      // -- d. le calendrier : 16 PERMANENT + 5 A_SURVEILLER ------------------
      const feries = calendrier.map((e) => versFerieCreateInput(e, versionCalendrier))
      const feriesEcrites = (await tx.delaiFerie.createMany({ data: feries })).count
      // Symétrie avec les deux gardes précédentes : un écart annule, il ne se rapporte pas.
      if (feriesEcrites !== calendrier.length) {
        throw new Error(
          `DelaiFerie : ${feriesEcrites} lignes écrites, ${calendrier.length} attendues — transaction annulée`,
        )
      }
      const permanents = calendrier.filter((e) => e.typeEntree === 'PERMANENT').length
      const surveiller = calendrier.filter((e) => e.typeEntree === 'A_SURVEILLER').length

      // -- e. les fenêtres de signification ----------------------------------
      const fenetresEcrites = (
        await tx.delaiFenetreSignification.createMany({
          data: fenetres.map((f) => versFenetreCreateInput(f, versionFenetres)),
        })
      ).count
      if (fenetresEcrites !== fenetres.length) {
        throw new Error(
          `DelaiFenetreSignification : ${fenetresEcrites} lignes écrites, ${fenetres.length} attendues — transaction annulée`,
        )
      }

      // -- f. le journal, DANS la transaction, avec les comptes RÉELS --------
      // Trois lignes et non une : le répertoire, le calendrier et les fenêtres sont trois
      // objets d'administration distincts, avec trois actions distinctes au journal. Les
      // confondre rendrait l'origine de `calendrier-v1` illisible à qui consulte l'historique
      // du seul calendrier.
      const journal = tx as unknown as Pick<PrismaClient, 'auditLog'>
      const meta = { origine: 'scripts/seed-delais.ts --apply', acteurId }
      const cibles = [
        CIBLE_REPERTOIRE,
        cibleCalendrier(versionCalendrier),
        cibleFenetres(versionFenetres),
      ]
      // On compte AVANT : le journal peut déjà porter ces cibles (une version de calendrier
      // publiée puis défaite au back-office, par exemple). Ce qu'on vérifie est la VARIATION
      // due à ce versement — pas un total, qui dirait faux dans les deux sens.
      const ouCibles = { where: { targetType: 'DELAI', targetId: { in: cibles } } }
      const journalAvant = await tx.auditLog.count(ouCibles)
      await audit(
        {
          action: 'DELAI_ENTRY_CREATED',
          actorId: acteurId,
          targetType: 'DELAI',
          targetId: CIBLE_REPERTOIRE,
          meta: { ...meta, entrees: entreesEcrites, revisions: revisionsEcrites },
        },
        journal,
      )
      await audit(
        {
          action: 'DELAI_CALENDAR_UPDATED',
          actorId: acteurId,
          targetType: 'DELAI',
          targetId: cibleCalendrier(versionCalendrier),
          meta: {
            ...meta,
            op: 'graine',
            version: versionCalendrier,
            versionPrecedente: null,
            lignes: feriesEcrites,
            permanents,
            aSurveiller: surveiller,
          },
        },
        journal,
      )
      await audit(
        {
          action: 'DELAI_FENETRES_UPDATED',
          actorId: acteurId,
          targetType: 'DELAI',
          targetId: cibleFenetres(versionFenetres),
          meta: {
            ...meta,
            op: 'graine',
            version: versionFenetres,
            versionPrecedente: null,
            lignes: fenetresEcrites,
          },
        },
        journal,
      )

      // ⚠️ `audit()` AVALE SES ERREURS — c'est voulu pour une requête HTTP, où le journal ne
      // doit jamais faire échouer la réponse. Ici, un versement sans trace au journal n'est
      // pas un versement : on relit, et on annule tout si le compte n'y est pas.
      const journalisees = (await tx.auditLog.count(ouCibles)) - journalAvant
      if (journalisees !== 3) {
        throw new Error(
          `journal d’audit : ${journalisees} lignes écrites, 3 attendues — transaction annulée`,
        )
      }

      return {
        delaiEntry: entreesEcrites,
        delaiEntryRevision: revisionsEcrites,
        delaiFerie: feriesEcrites,
        delaiFenetreSignification: fenetresEcrites,
        auditLog: journalisees,
      }
    },
    { maxWait: MAXWAIT_TRANSACTION_MS, timeout: TIMEOUT_TRANSACTION_MS },
  )

  return { ecrit: true, comptes, versionCalendrier, versionFenetres }
}

// ---------------------------------------------------------------------------
// Le compte rendu
// ---------------------------------------------------------------------------

/**
 * Le rappel des douze contrôles du § 5.3, dans l'ordre où la simulation les imprime. Ce n'est
 * pas une redite décorative : le compte rendu d'un versement en production doit dire CE QUI A
 * ÉTÉ VÉRIFIÉ avant l'écriture, sans quoi « 393 lignes écrites » ne prouve rien.
 *
 * La concordance de cette liste avec les douze sections de `scripts/seed-delais.ts` est
 * TESTÉE : ajouter un contrôle sans l'inscrire ici fait rougir le test.
 */
export const RAPPEL_DES_CONTROLES: readonly string[] = [
  '1.  les sept genres, AVANT les six surcharges (§ 4.4)',
  '2.  les sept genres, APRÈS les six surcharges (§ 4.5)',
  '3.  la répartition par code (CPC 232 · CIVIL 114 · TRAVAIL 47)',
  '4.  les entrées CIVIL en régime FRANC portent leur citation (§ 4.7, garde-fou 1)',
  '5.  les délais TRAVAIL au régime douteux (§ 4.7, garde-fou 2)',
  '6.  les entrées déterminées portant une distance (§ 4.4)',
  '7.  aucun fondement ni motif de refus vide',
  '8.  les 393 slugs : distincts, conformes, 26 groupes désambiguïsés (§ 5.2 bis)',
  '9.  la ventilation par tableau, REJOUÉE depuis les trois sources (§ 5.2 ter)',
  '10. les lignes « régime à vérifier » ne calculent pas (§ 4.7, garde-fou 3)',
  '11. les 8 entrées TRAVAIL homonymes, phrase de contrôle LUE EN BASE (§ 4.5 bis)',
  '12. le calendrier et les fenêtres de signification (§ 5.4, § 5.4 bis, § 4.11)',
]

/** Le compte rendu final, chiffré. Rendu en lignes pour que l'appelant choisisse l'indentation. */
export function compteRendu(r: ResultatEcriture): string[] {
  if (!r.ecrit && r.motif === 'CONTROLES_EN_ECHEC') {
    return [
      '✗ RIEN N’A ÉTÉ ÉCRIT — les contrôles du § 5.3 échouent avant toute connexion :',
      ...r.anomalies.map((a) => `   - ${a}`),
    ]
  }
  if (!r.ecrit) {
    return [
      '● RIEN N’A ÉTÉ ÉCRIT — la base porte déjà des lignes, et on n’écrase pas un travail',
      '  éditorial. Voici l’état constaté, et ce que la graine aurait versé :',
      '',
      `    DelaiEntry                 : ${String(r.etat.delaiEntry).padStart(4)} en base   (la graine en verserait ${r.projet.delaiEntry})`,
      `    DelaiEntryRevision         : ${String(r.etat.delaiEntryRevision).padStart(4)} en base   (la graine en verserait ${r.projet.delaiEntryRevision})`,
      `    DelaiFerie                 : ${String(r.etat.delaiFerie).padStart(4)} en base   (la graine en verserait ${r.projet.delaiFerie})`,
      `    DelaiFenetreSignification  : ${String(r.etat.delaiFenetreSignification).padStart(4)} en base   (la graine en verserait ${r.projet.delaiFenetreSignification})`,
      '',
      `  Table(s) déjà peuplée(s) : ${r.peuplees.join(', ')}.`,
      '  Aucun slug déjà écrit n’a été recalculé : le permalien d’une entrée versée ne change',
      '  jamais (§ 5.2 bis). Repartir de zéro suppose de vider ces tables À LA MAIN — ce que ce',
      '  script ne fait pas, et ne fera pas.',
    ]
  }
  return [
    '✓ ÉCRIT — une seule transaction, validée.',
    '',
    `    DelaiEntry                 : ${String(r.comptes.delaiEntry).padStart(4)} lignes`,
    `    DelaiEntryRevision         : ${String(r.comptes.delaiEntryRevision).padStart(4)} lignes (révision 1, copie gelée)`,
    `    DelaiFerie                 : ${String(r.comptes.delaiFerie).padStart(4)} lignes (versionCalendrier ${r.versionCalendrier})`,
    `    DelaiFenetreSignification  : ${String(r.comptes.delaiFenetreSignification).padStart(4)} lignes (versionFenetres ${r.versionFenetres})`,
    `    AuditLog                   : ${String(r.comptes.auditLog).padStart(4)} lignes (répertoire, calendrier, fenêtres)`,
    '',
    '  Contrôles passés AVANT l’écriture — les douze du § 5.3, sources et base comprises :',
    ...RAPPEL_DES_CONTROLES.map((c) => `    ✓ ${c}`),
  ]
}
