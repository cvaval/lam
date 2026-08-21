/**
 * § 5.3 — **LA BRANCHE D'ÉCRITURE, EXERCÉE SANS BASE.**
 *
 * `--apply` ne se répète pas : il verse 393 entrées, 393 copies gelées, 21 lignes de
 * calendrier et 2 fenêtres dans une base de PRODUCTION, une fois. On ne peut donc pas
 * l'essayer « pour voir ». Ce fichier est la seule preuve disponible avant le passage réel :
 * il branche un Prisma SIMULÉ — qui enregistre l'ordre exact des appels — et vérifie les
 * cinq propriétés qui font la différence entre un versement et un dégât :
 *
 *   1. il n'y a qu'UNE transaction, et tout est dedans ;
 *   2. l'ordre est bon : les entrées avant leurs révisions, jamais l'inverse ;
 *   3. la révision 1 est la copie GELÉE de la ligne écrite, attachée au bon `id` ;
 *   4. `audit()` est appelé, dans la transaction, avec les comptes RÉELS ;
 *   5. un second passage s'arrête, et un contrôle en échec empêche toute écriture — jusqu'à
 *      la lecture de la base, qui n'a même pas lieu.
 */
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * ⚠️ **AUCUNE VRAIE CONNEXION, PAS MÊME À L'IMPORT.** `audit()` prend le singleton `prisma`
 * comme valeur par défaut de son second paramètre : sans ce faux module, le seul fait
 * d'importer ce fichier construirait un client pointant la base de **production**. La branche
 * d'écriture, elle, reçoit son client en paramètre — c'est précisément ce qui la rend
 * vérifiable sans base.
 */
vi.mock('../src/lib/db', () => ({ prisma: {} }))

import {
  MAXWAIT_TRANSACTION_MS,
  RAPPEL_DES_CONTROLES,
  TAILLE_LOT,
  TIMEOUT_TRANSACTION_MS,
  COLONNES_NON_GRAINEES_FENETRE,
  COLONNES_NON_GRAINEES_FERIE,
  compteRendu,
  ecrireGraine,
  versFenetreCreateInput,
  versFerieCreateInput,
} from './ecrire-graine-delais'
import type { ClientRacine } from './ecrire-graine-delais'
import { CALENDRIER_V1, VERSION_CALENDRIER_COURANTE } from '../src/lib/delais/feries'
import { FENETRES_V1, VERSION_FENETRES_COURANTE } from '../src/lib/delais/textes'
import { REPERTOIRE, construireEntrees } from '../src/lib/delais/repertoire'
import { versCreateInput, versRevisionPayload } from '../src/lib/delais/graine'

const ENTREES = construireEntrees(REPERTOIRE)

// ---------------------------------------------------------------------------
// Le Prisma simulé : il ENREGISTRE, il ne devine rien
// ---------------------------------------------------------------------------

type Appel = { nom: string; args?: unknown; dansTransaction: boolean }

type Faux = {
  client: ClientRacine
  appels: Appel[]
  /** Les lignes « écrites », par table. */
  tables: Record<string, Record<string, unknown>[]>
  transactions: number
  optionsTransaction: { maxWait?: number; timeout?: number } | undefined
  /** Les transactions qui ont été ANNULÉES (la fonction a jeté). */
  annulees: number
}

/**
 * @param etatInitial  comptes rendus par `count()` AVANT toute écriture (idempotence).
 * @param casse        nom d'une méthode qui doit échouer, pour éprouver le tout-ou-rien.
 */
function fauxPrisma(etatInitial: Partial<Record<string, number>> = {}, casse?: string): Faux {
  const f: Faux = {
    client: null as unknown as ClientRacine,
    appels: [],
    tables: {
      delaiEntry: [],
      delaiEntryRevision: [],
      delaiFerie: [],
      delaiFenetreSignification: [],
      auditLog: [],
    },
    transactions: 0,
    optionsTransaction: undefined,
    annulees: 0,
  }
  let dedans = false

  const journaliser = (nom: string, args?: unknown) => {
    f.appels.push({ nom, args, dansTransaction: dedans })
    if (casse === nom) throw new Error(`échec simulé : ${nom}`)
  }

  const table = (nom: string) => ({
    count: async (args?: unknown) => {
      journaliser(`${nom}.count`, args)
      // Avant l'écriture, `count()` rend l'état initial ; après, ce qui a été versé.
      return f.tables[nom].length > 0 ? f.tables[nom].length : (etatInitial[nom] ?? 0)
    },
    createMany: async ({ data }: { data: Record<string, unknown>[] }) => {
      journaliser(`${nom}.createMany`, data)
      f.tables[nom].push(...data)
      return { count: data.length }
    },
    findMany: async (args?: unknown) => {
      journaliser(`${nom}.findMany`, args)
      // Les `id` sont posés par la base : on en fabrique de faux, DANS UN ORDRE DIFFÉRENT de
      // celui du répertoire — c'est le seul moyen d'attraper un appariement par rang.
      return [...f.tables[nom]]
        .map((l, i) => ({ id: `id-${i}`, slug: String(l.slug) }))
        .reverse()
    },
  })

  f.client = {
    delaiEntry: table('delaiEntry'),
    delaiEntryRevision: table('delaiEntryRevision'),
    delaiFerie: table('delaiFerie'),
    delaiFenetreSignification: table('delaiFenetreSignification'),
    auditLog: {
      create: async (args: unknown) => {
        journaliser('auditLog.create', args)
        f.tables.auditLog.push((args as { data: Record<string, unknown> }).data)
        return {}
      },
      count: async (args?: unknown) => {
        journaliser('auditLog.count', args)
        return f.tables.auditLog.length
      },
    },
    $transaction: async <T,>(fn: (tx: never) => Promise<T>, options?: { maxWait?: number; timeout?: number }) => {
      f.transactions += 1
      f.optionsTransaction = options
      dedans = true
      // Une vraie transaction annule TOUT sur erreur : le faux fait de même, sinon le test
      // « rien n'a été écrit » passerait sur une base qui, elle, aurait gardé les lignes.
      const avant = JSON.parse(JSON.stringify(f.tables))
      try {
        return await fn(f.client as never)
      } catch (e) {
        f.tables = avant
        f.annulees += 1
        throw e
      } finally {
        dedans = false
      }
    },
  } as unknown as ClientRacine

  return f
}

function appel(opts: Partial<Parameters<typeof ecrireGraine>[0]> = {}) {
  const f = opts.client ? null : fauxPrisma()
  return {
    f,
    options: {
      client: (opts.client ?? f!.client) as ClientRacine,
      entrees: opts.entrees ?? ENTREES,
      calendrier: opts.calendrier ?? CALENDRIER_V1,
      fenetres: opts.fenetres ?? FENETRES_V1,
      versionCalendrier: opts.versionCalendrier ?? VERSION_CALENDRIER_COURANTE,
      versionFenetres: opts.versionFenetres ?? VERSION_FENETRES_COURANTE,
      anomalies: opts.anomalies ?? [],
      acteurId: opts.acteurId ?? null,
    },
  }
}

// ---------------------------------------------------------------------------
// 1. Une transaction, ou rien
// ---------------------------------------------------------------------------

describe('une transaction, ou rien', () => {
  it('tout passe dans UNE SEULE transaction, et rien n’est écrit en dehors', async () => {
    const { f, options } = appel()
    const r = await ecrireGraine(options)

    expect(r.ecrit).toBe(true)
    expect(f!.transactions).toBe(1)

    const ecritures = f!.appels.filter((a) => /createMany|auditLog\.create/.test(a.nom))
    expect(ecritures.length).toBeGreaterThan(0)
    expect(ecritures.filter((a) => !a.dansTransaction)).toEqual([])
  })

  it('le délai d’exécution est RÉGLÉ, jamais laissé au défaut de 5 s de Prisma', async () => {
    const { f, options } = appel()
    await ecrireGraine(options)
    expect(f!.optionsTransaction).toEqual({
      maxWait: MAXWAIT_TRANSACTION_MS,
      timeout: TIMEOUT_TRANSACTION_MS,
    })
    // 786 lignes sur une base distante ne tiennent pas dans le défaut : la valeur doit être
    // franchement au-dessus, pas cosmétiquement.
    expect(TIMEOUT_TRANSACTION_MS).toBeGreaterThanOrEqual(60_000)
    expect(MAXWAIT_TRANSACTION_MS).toBeGreaterThan(2_000)
  })

  it('un échec à mi-course ne laisse RIEN — pas une base à moitié peuplée', async () => {
    const f = fauxPrisma({}, 'delaiFerie.createMany')
    await expect(ecrireGraine(appel({ client: f.client }).options)).rejects.toThrow('échec simulé')
    expect(f.annulees).toBe(1)
    expect(f.tables.delaiEntry).toHaveLength(0)
    expect(f.tables.delaiEntryRevision).toHaveLength(0)
    expect(f.tables.delaiFerie).toHaveLength(0)
    expect(f.tables.delaiFenetreSignification).toHaveLength(0)
  })

  it('les lots ne rompent pas l’atomicité : 393 lignes, plusieurs `createMany`, une transaction', async () => {
    const { f, options } = appel()
    await ecrireGraine(options)
    const lotsEntrees = f!.appels.filter((a) => a.nom === 'delaiEntry.createMany')
    expect(lotsEntrees).toHaveLength(Math.ceil(ENTREES.length / TAILLE_LOT))
    expect(lotsEntrees.every((a) => (a.args as unknown[]).length <= TAILLE_LOT)).toBe(true)
    expect(f!.transactions).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// 2. L'ordre
// ---------------------------------------------------------------------------

describe('l’ordre des écritures', () => {
  it('les entrées, puis la relecture des id, puis les révisions, puis calendrier et fenêtres', async () => {
    const { f, options } = appel()
    await ecrireGraine(options)

    const rang = (nom: string) => f!.appels.findIndex((a) => a.nom === nom)
    const dernierRang = (nom: string) => f!.appels.map((a) => a.nom).lastIndexOf(nom)

    // Une révision écrite avant son entrée serait une clé étrangère orpheline.
    expect(dernierRang('delaiEntry.createMany')).toBeLessThan(rang('delaiEntry.findMany'))
    expect(rang('delaiEntry.findMany')).toBeLessThan(rang('delaiEntryRevision.createMany'))
    expect(dernierRang('delaiEntryRevision.createMany')).toBeLessThan(rang('delaiFerie.createMany'))
    expect(rang('delaiFerie.createMany')).toBeLessThan(rang('delaiFenetreSignification.createMany'))
    // Le journal vient EN DERNIER, avec les comptes réels : le compter avant serait annoncer
    // ce qu'on n'a pas encore fait.
    expect(rang('delaiFenetreSignification.createMany')).toBeLessThan(rang('auditLog.create'))
  })

  it('les comptes sont LUS avant la transaction, jamais dedans', async () => {
    const { f, options } = appel()
    await ecrireGraine(options)
    const comptesInitiaux = f!.appels.filter(
      (a) => a.nom.endsWith('.count') && a.nom !== 'auditLog.count',
    )
    expect(comptesInitiaux).toHaveLength(4)
    expect(comptesInitiaux.every((a) => !a.dansTransaction)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 3. La révision 1, gelée
// ---------------------------------------------------------------------------

describe('la révision 1 est une copie gelée', () => {
  it('393 révisions, toutes en révision 1, payload = la ligne telle qu’écrite', async () => {
    const { f, options } = appel()
    await ecrireGraine(options)

    const revisions = f!.tables.delaiEntryRevision
    expect(revisions).toHaveLength(ENTREES.length)
    expect(new Set(revisions.map((r) => r.revision))).toEqual(new Set([1]))

    for (const [i, e] of ENTREES.entries()) {
      expect(revisions[i].payloadJson, e.slug).toBe(versRevisionPayload(e))
      expect(JSON.parse(String(revisions[i].payloadJson)), e.slug).toEqual(versCreateInput(e))
    }
  })

  it('chaque révision est attachée à l’`id` de SON entrée — appariement par slug, pas par rang', async () => {
    const { f, options } = appel()
    await ecrireGraine(options)

    // Le faux `findMany` rend les lignes à l'envers : un appariement par rang collerait la
    // révision de l'entrée 0 sur l'identifiant de l'entrée 392.
    const idParSlug = new Map(
      f!.tables.delaiEntry.map((l, i) => [String(l.slug), `id-${i}`] as const),
    )
    for (const [i, e] of ENTREES.entries()) {
      expect(f!.tables.delaiEntryRevision[i].entryId, e.slug).toBe(idParSlug.get(e.slug))
    }
  })

  it('l’acteur nommé est recopié sur les 393 révisions ; sans lui, `null` et pas un id inventé', async () => {
    const nomme = appel({ acteurId: 'usr_christelle' })
    await ecrireGraine(nomme.options)
    expect(new Set(nomme.f!.tables.delaiEntryRevision.map((r) => r.actorId))).toEqual(
      new Set(['usr_christelle']),
    )

    const anonyme = appel()
    await ecrireGraine(anonyme.options)
    expect(new Set(anonyme.f!.tables.delaiEntryRevision.map((r) => r.actorId))).toEqual(
      new Set([null]),
    )
  })

  it('une entrée relue sous un slug inconnu annule TOUT plutôt que d’attacher au hasard', async () => {
    const f = fauxPrisma()
    const vrai = f.client.delaiEntry.findMany
    // La base rend un slug qui n'est pas celui du répertoire : c'est une incohérence, pas un
    // écart à rattraper en silence.
    f.client.delaiEntry.findMany = async (args?: unknown) => {
      const lignes = await vrai(args)
      return lignes.map((l, i) => (i === 0 ? { ...l, slug: 'slug-fantome' } : l))
    }
    await expect(ecrireGraine(appel({ client: f.client }).options)).rejects.toThrow(
      /slug écrit introuvable|slugs distincts relus/,
    )
    expect(f.annulees).toBe(1)
    expect(f.tables.delaiEntryRevision).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// 4. Le journal
// ---------------------------------------------------------------------------

describe('audit() est appelé, dans la transaction, avec les comptes réels', () => {
  it('trois lignes : le répertoire, le calendrier, les fenêtres', async () => {
    const { f, options } = appel()
    const r = await ecrireGraine(options)

    const journal = f!.tables.auditLog
    expect(journal).toHaveLength(3)
    expect(journal.map((l) => l.action)).toEqual([
      'DELAI_ENTRY_CREATED',
      'DELAI_CALENDAR_UPDATED',
      'DELAI_FENETRES_UPDATED',
    ])
    expect(f!.appels.filter((a) => a.nom === 'auditLog.create').every((a) => a.dansTransaction)).toBe(true)
    expect(r.ecrit && r.comptes.auditLog).toBe(3)
  })

  it('les métadonnées portent les comptes RÉELS, pas les comptes espérés', async () => {
    const { f, options } = appel()
    await ecrireGraine(options)
    const meta = (i: number) => JSON.parse(String(f!.tables.auditLog[i].metaJson))

    // `revision` a quitté les métadonnées : elle était codée en dur à 1 alors que
    // `DelaiEntry.revision` vient de la donnée. Une valeur qui ne peut pas suivre son objet ne
    // vaut rien au journal — les deux comptes, eux, sont mesurés.
    expect(meta(0)).toMatchObject({ entrees: 393, revisions: 393 })
    expect(meta(0)).not.toHaveProperty('revision')
    expect(meta(1)).toMatchObject({
      version: VERSION_CALENDRIER_COURANTE,
      lignes: CALENDRIER_V1.length,
      permanents: 16,
      aSurveiller: 5,
    })
    expect(meta(2)).toMatchObject({ version: VERSION_FENETRES_COURANTE, lignes: FENETRES_V1.length })
    for (const i of [0, 1, 2]) expect(meta(i).origine).toBe('scripts/seed-delais.ts --apply')
  })

  it('un journal qui portait DÉJÀ ces cibles ne fausse rien : on mesure la variation', async () => {
    const f = fauxPrisma()
    // Une version de calendrier publiée puis défaite au back-office a laissé sa trace : le
    // total n'est plus 3, mais l'écart dû à CE versement, lui, l'est.
    f.tables.auditLog.push({ action: 'DELAI_CALENDAR_UPDATED', targetId: 'calendrier-v1' })
    const r = await ecrireGraine(appel({ client: f.client }).options)
    expect(r.ecrit).toBe(true)
    expect(r.ecrit && r.comptes.auditLog).toBe(3)
    expect(f.tables.auditLog).toHaveLength(4)
  })

  it('un journal muet annule le versement — `audit()` avale ses erreurs, pas nous', async () => {
    const f = fauxPrisma()
    // `audit()` est enveloppé d'un try/catch : une écriture de journal qui échoue ne remonte
    // pas. Sans la relecture, on aurait 393 entrées en base et aucune trace de qui, quand, ni
    // pourquoi. Ici, la ligne est perdue en silence et le versement doit être annulé.
    f.client.auditLog.create = async () => ({})
    await expect(ecrireGraine(appel({ client: f.client }).options)).rejects.toThrow(
      /journal d’audit : 0 lignes écrites, 3 attendues/,
    )
    expect(f.annulees).toBe(1)
    expect(f.tables.delaiEntry).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// 5. Idempotence et contrôles
// ---------------------------------------------------------------------------

describe('un second passage s’arrête', () => {
  it('la base déjà peuplée : on dit ce qu’on aurait fait, on n’écrit rien', async () => {
    const f = fauxPrisma({ delaiEntry: 393, delaiEntryRevision: 393, delaiFerie: 21, delaiFenetreSignification: 2 })
    const r = await ecrireGraine(appel({ client: f.client }).options)

    expect(r).toMatchObject({
      ecrit: false,
      motif: 'DEJA_PEUPLEE',
      etat: { delaiEntry: 393, delaiEntryRevision: 393, delaiFerie: 21, delaiFenetreSignification: 2 },
      projet: { delaiEntry: 393, delaiEntryRevision: 393, delaiFerie: 21, delaiFenetreSignification: 2 },
    })
    expect(f.transactions).toBe(0)
    expect(f.appels.filter((a) => /createMany|create/.test(a.nom))).toEqual([])
  })

  it('UNE SEULE ligne quelque part suffit à tout arrêter — on ne complète pas un versement partiel', async () => {
    for (const table of ['delaiEntry', 'delaiEntryRevision', 'delaiFerie', 'delaiFenetreSignification']) {
      const f = fauxPrisma({ [table]: 1 })
      const r = await ecrireGraine(appel({ client: f.client }).options)
      expect(r.ecrit, table).toBe(false)
      expect(!r.ecrit && r.motif === 'DEJA_PEUPLEE' && r.peuplees, table).toEqual([table])
      expect(f.transactions, table).toBe(0)
    }
  })

  it('le premier passage écrit, le second refuse — sur le MÊME faux client', async () => {
    const f = fauxPrisma()
    const premier = await ecrireGraine(appel({ client: f.client }).options)
    expect(premier.ecrit).toBe(true)

    const second = await ecrireGraine(appel({ client: f.client }).options)
    expect(second.ecrit).toBe(false)
    expect(!second.ecrit && second.motif).toBe('DEJA_PEUPLEE')
    // Aucun doublon : le répertoire n'a pas été versé deux fois.
    expect(f.tables.delaiEntry).toHaveLength(393)
    expect(f.tables.delaiEntryRevision).toHaveLength(393)
    expect(f.tables.delaiFerie).toHaveLength(21)
    expect(f.transactions).toBe(1)
  })

  it('le refus ne recalcule AUCUN slug : la clé du permalien n’est pas retouchée (§ 5.2 bis)', async () => {
    const f = fauxPrisma()
    await ecrireGraine(appel({ client: f.client }).options)
    const slugsApresPremier = f.tables.delaiEntry.map((l) => l.slug)
    await ecrireGraine(appel({ client: f.client }).options)
    expect(f.tables.delaiEntry.map((l) => l.slug)).toEqual(slugsApresPremier)
  })
})

describe('un contrôle en échec empêche toute écriture', () => {
  it('la fonction rend la main AVANT même de lire la base', async () => {
    const f = fauxPrisma()
    const r = await ecrireGraine(
      appel({ client: f.client, anomalies: ['genre JOURS : 122 lignes, 123 attendues'] }).options,
    )

    expect(r).toMatchObject({ ecrit: false, motif: 'CONTROLES_EN_ECHEC' })
    expect(!r.ecrit && r.motif === 'CONTROLES_EN_ECHEC' && r.anomalies).toEqual([
      'genre JOURS : 122 lignes, 123 attendues',
    ])
    // Pas une lecture, pas une connexion : rien.
    expect(f.appels).toEqual([])
    expect(f.transactions).toBe(0)
  })

  it('même une seule anomalie, même la dernière de la liste', async () => {
    const f = fauxPrisma()
    const r = await ecrireGraine(
      appel({ client: f.client, anomalies: ['§ 4.5 bis — la phrase de contrôle est sous l’art. 172 (occ. 2)'] }).options,
    )
    expect(r.ecrit).toBe(false)
    expect(f.appels).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Les conversions du calendrier et des fenêtres, contre le SCHÉMA
// ---------------------------------------------------------------------------

/** Les champs scalaires d'un modèle, lus dans `prisma/schema.prisma` (cf. `graine.test.ts`). */
function colonnesDuModele(nom: string): string[] {
  const source = readFileSync('prisma/schema.prisma', 'utf8')
  const bloc = new RegExp(`^model ${nom} \\{$([\\s\\S]*?)^\\}$`, 'm').exec(source)
  if (!bloc) throw new Error(`model ${nom} introuvable dans prisma/schema.prisma`)
  return bloc[1]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('///') && !l.startsWith('//') && !l.startsWith('@@'))
    .map((l) => l.split(/\s+/))
    .filter(([, type]) => type && !/\[\]$/.test(type))
    .map(([nomChamp]) => nomChamp)
}

describe('le calendrier et les fenêtres se versent en entier', () => {
  it('DelaiFerie : aucune clé orpheline, aucune colonne oubliée', () => {
    const colonnes = colonnesDuModele('DelaiFerie')
    const produit = versFerieCreateInput(CALENDRIER_V1[0], 1)
    expect(Object.keys(produit).filter((k) => !colonnes.includes(k))).toEqual([])
    expect(
      colonnes.filter((c) => !(c in produit) && !COLONNES_NON_GRAINEES_FERIE.includes(c)),
    ).toEqual([])
  })

  it('DelaiFenetreSignification : idem', () => {
    const colonnes = colonnesDuModele('DelaiFenetreSignification')
    const produit = versFenetreCreateInput(FENETRES_V1[0], 1)
    expect(Object.keys(produit).filter((k) => !colonnes.includes(k))).toEqual([])
    expect(
      colonnes.filter((c) => !(c in produit) && !COLONNES_NON_GRAINEES_FENETRE.includes(c)),
    ).toEqual([])
  })

  it('16 PERMANENT + 5 A_SURVEILLER, et la version est celle qu’on lui donne', async () => {
    const { f, options } = appel()
    await ecrireGraine(options)
    const feries = f!.tables.delaiFerie
    expect(feries).toHaveLength(21)
    expect(feries.filter((l) => l.typeEntree === 'PERMANENT')).toHaveLength(16)
    expect(feries.filter((l) => l.typeEntree === 'A_SURVEILLER')).toHaveLength(5)
    expect(new Set(feries.map((l) => l.versionCalendrier))).toEqual(
      new Set([VERSION_CALENDRIER_COURANTE]),
    )
    expect(new Set(f!.tables.delaiFenetreSignification.map((l) => l.versionFenetres))).toEqual(
      new Set([VERSION_FENETRES_COURANTE]),
    )
  })

  it('aucun `undefined` ne part vers Prisma — il le lirait « ne touche pas à cette colonne »', async () => {
    const { f, options } = appel()
    await ecrireGraine(options)
    for (const nom of ['delaiEntry', 'delaiEntryRevision', 'delaiFerie', 'delaiFenetreSignification']) {
      for (const ligne of f!.tables[nom]) {
        const indefinis = Object.keys(ligne).filter((k) => ligne[k] === undefined)
        expect(indefinis, `${nom} ${String(ligne.slug ?? ligne.cle ?? ligne.matiere ?? '')}`).toEqual([])
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Le compte rendu
// ---------------------------------------------------------------------------

describe('le compte rendu final', () => {
  it('chiffre chaque table et rappelle les douze contrôles', async () => {
    const { options } = appel()
    const texte = compteRendu(await ecrireGraine(options)).join('\n')
    expect(texte).toContain('393 lignes')
    expect(texte).toContain('21 lignes')
    expect(texte).toContain('2 lignes')
    for (const c of RAPPEL_DES_CONTROLES) expect(texte).toContain(c)
  })

  it('un refus DIT ce qu’il aurait écrit, et pourquoi il ne l’écrit pas', () => {
    const texte = compteRendu({
      ecrit: false,
      motif: 'DEJA_PEUPLEE',
      etat: { delaiEntry: 12, delaiEntryRevision: 0, delaiFerie: 0, delaiFenetreSignification: 0 },
      peuplees: ['delaiEntry'],
      projet: { delaiEntry: 393, delaiEntryRevision: 393, delaiFerie: 21, delaiFenetreSignification: 2 },
    }).join('\n')
    expect(texte).toContain('RIEN N’A ÉTÉ ÉCRIT')
    expect(texte).toContain('12 en base')
    expect(texte).toContain('393')
    expect(texte).toMatch(/n’a été recalculé/)
  })

  it('les douze contrôles rappelés sont EXACTEMENT les douze sections de la simulation', () => {
    // Le rappel ne doit pas devenir un texte décoratif qui prend du retard sur le script.
    const seed = readFileSync('scripts/seed-delais.ts', 'utf8')
    const numeros = [...seed.matchAll(/titre\('(\d+)\.\s/g)].map((m) => Number(m[1]))
    expect(numeros).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(RAPPEL_DES_CONTROLES).toHaveLength(12)
    expect(RAPPEL_DES_CONTROLES.map((c) => Number(c.split('.')[0]))).toEqual(numeros)
  })
})

// ---------------------------------------------------------------------------
// La graine appelle bien cette branche — et rien d'autre
// ---------------------------------------------------------------------------

describe('scripts/seed-delais.ts', () => {
  const seed = readFileSync('scripts/seed-delais.ts', 'utf8')

  it('n’annonce plus une écriture non implémentée', () => {
    expect(seed).not.toContain('ÉCRITURE NON IMPLÉMENTÉE')
  })

  it('n’écrit pas en base par lui-même : la seule écriture passe par `ecrireGraine`', () => {
    expect(seed).toContain('ecrireGraine(')
    // Aucun appel direct de création/mise à jour/suppression dans le script de graine.
    expect(seed).not.toMatch(/prisma\.\w+\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/)
  })

  it('la simulation reste le défaut, et le refus sort en code d’erreur', () => {
    expect(seed).toContain("process.argv.includes('--apply')")
    expect(seed).toContain('if (!resultat.ecrit) process.exitCode = 1')
  })

  it('la simulation rend la main AVANT l’écriture — l’ordre du fichier le garantit', () => {
    // Sans `--apply`, `main()` sort sur un `return` placé plus haut que l'appel d'écriture.
    expect(seed.indexOf('if (!APPLIQUER) {')).toBeGreaterThan(0)
    expect(seed.indexOf('if (!APPLIQUER) {')).toBeLessThan(seed.indexOf('ecrireGraine('))
    // … et la garde des douze contrôles est, elle aussi, avant.
    expect(seed.indexOf('if (anomalies.length > 0) {')).toBeLessThan(seed.indexOf('ecrireGraine('))
  })

  it('une table absente se dit en clair, elle ne remonte pas en trace d’erreur', () => {
    expect(seed).toContain('estSchemaAbsent(e)')
    expect(seed).toContain('scripts/migrer-delais.ts --apply')
  })
})
