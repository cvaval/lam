/**
 * § 7.4 — LE CALENDRIER DES FÊTES : ce que ces tests protègent tient en une phrase — **on
 * n'édite jamais une version, on en publie une nouvelle.**
 *
 * Un `update` sur une ligne de calendrier changerait rétroactivement une date déjà rendue,
 * déjà imprimée, déjà citée devant un tribunal. Les tests vérifient donc, littéralement, qu'il
 * n'y a **ni `update`, ni `delete`** — seulement des `create` portant la version suivante.
 */
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CALENDRIER_V1 } from '@/lib/delais/feries'

const prisma = {
  delaiFerie: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  $transaction: vi.fn(),
}
const requireCapabilityApi = vi.fn()
const requireAdminApi = vi.fn()
const audit = vi.fn()

vi.mock('@/lib/db', () => ({ prisma }))
vi.mock('@/lib/auth/guard', () => ({ requireCapabilityApi, requireAdminApi }))
vi.mock('@/lib/auth/audit', () => ({ audit }))

const { POST, PATCH, DELETE } = await import('./route')

const ADMIN = { id: 'u-1', role: 'MASTER_ADMIN' }
const V1 = CALENDRIER_V1.map((e, i) => ({ ...e, id: `f-${i}`, versionCalendrier: 1 }))

/** Une ligne du calendrier telle que la base la rend (toutes les colonnes reportées). */
function enBase(l: Record<string, unknown>, version = 1) {
  return {
    sourceDocId: null,
    noteJourneeFr: null,
    traductionRelue: false,
    offsetPaques: null,
    libelleEn: '',
    libelleHt: '',
    ...l,
    id: `f-${String(l.cle)}`,
    versionCalendrier: version,
  }
}

const NOUVELLE = {
  cle: '18-mai-scolaire',
  typeEntree: 'A_SURVEILLER',
  libelleFr: 'Journée du drapeau — congé scolaire',
  categorie: 'CHOMAGE_PAR_ARRETE',
  autorite: 'OBSERVATION',
  journee: 'JOURNEE_ENTIERE',
  mobile: false,
  mois: 5,
  jour: 18,
  source: 'Observation du corpus : arrêtés relevés au Moniteur pour la journée du drapeau.',
  appliqueDepuis: '1989-06-22',
  observationsN: 3,
  observationsTexteFr: '3 arrêtés de chômage relevés au Moniteur pour le 18 mai.',
  observationsBorneFr: 'L’Index du Moniteur de Lam s’arrête au 20 juin 2023.',
  rechercheCorpusQ: 'drapeau',
}

/** La même clé, requalifiée en PERMANENT sans texte du corpus et sur une simple observation. */
const PERMANENT_SANS_TEXTE = {
  ...NOUVELLE,
  typeEntree: 'PERMANENT',
  observationsN: null,
  observationsTexteFr: null,
  observationsBorneFr: null,
  rechercheCorpusQ: null,
}

function req(methode: string, corps: unknown) {
  return new NextRequest('http://localhost/api/admin/delais/calendrier', {
    method: methode,
    body: JSON.stringify(corps),
    headers: { 'content-type': 'application/json' },
  })
}

/** L'histoire du calendrier, par clé : la version la PLUS RÉCENTE qui a porté la ligne. */
let historique: Record<string, Record<string, unknown> | null> = {}

beforeEach(() => {
  vi.clearAllMocks()
  historique = {}
  requireCapabilityApi.mockResolvedValue(ADMIN)
  requireAdminApi.mockResolvedValue(ADMIN)
  // `findFirst` sert DEUX lectures : la version courante (`select`) et l'histoire d'une clé
  // (`where.cle`). Un mock unique confondait les deux et rendait la bascule indétectable.
  prisma.delaiFerie.findFirst.mockImplementation(async (args: { where?: { cle?: string } }) =>
    args?.where?.cle ? historique[args.where.cle] ?? null : { versionCalendrier: 1 },
  )
  prisma.delaiFerie.findMany.mockResolvedValue(V1)
  prisma.delaiFerie.create.mockImplementation((args: unknown) => args)
  prisma.$transaction.mockImplementation(async (x: unknown) => (Array.isArray(x) ? x : x))
})

/** Les versions écrites par le dernier appel. */
function versionsEcrites() {
  return prisma.delaiFerie.create.mock.calls.map((c) => c[0].data)
}

describe('la double garde', () => {
  it('ajouter et masquer exigent `corpus.manage`', async () => {
    requireCapabilityApi.mockResolvedValue(null)
    expect((await POST(req('POST', { op: 'ajouter', ligne: NOUVELLE }))).status).toBe(403)
    expect((await PATCH(req('PATCH', { op: 'masquer', cle: '17-octobre', motif: 'Décision motivée.' }))).status).toBe(403)
    expect(prisma.delaiFerie.create).not.toHaveBeenCalled()
  })

  it('supprimer exige le master admin', async () => {
    requireAdminApi.mockResolvedValue(null)
    const res = await DELETE(req('DELETE', { cle: '17-octobre', motif: 'Décision motivée.', confirmation: '17-octobre' }))
    expect(res.status).toBe(403)
    expect(prisma.delaiFerie.create).not.toHaveBeenCalled()
  })
})

describe('ajouter — la version suivante est une COPIE COMPLÈTE, plus la ligne', () => {
  it('écrit les 21 lignes d’origine + la nouvelle, toutes en version 2', async () => {
    const res = await POST(req('POST', { op: 'ajouter', ligne: NOUVELLE }))
    expect(res.status).toBe(200)
    const ecrites = versionsEcrites()
    expect(ecrites.length).toBe(V1.length + 1)
    expect(new Set(ecrites.map((l) => l.versionCalendrier))).toEqual(new Set([2]))
    expect(ecrites.some((l) => l.cle === NOUVELLE.cle)).toBe(true)
    expect((await res.json()).version).toBe(2)
  })

  it('n’édite ni ne supprime AUCUNE ligne de la version antérieure', async () => {
    await POST(req('POST', { op: 'ajouter', ligne: NOUVELLE }))
    expect(prisma.delaiFerie.update).not.toHaveBeenCalled()
    expect(prisma.delaiFerie.updateMany).not.toHaveBeenCalled()
    expect(prisma.delaiFerie.delete).not.toHaveBeenCalled()
    expect(prisma.delaiFerie.deleteMany).not.toHaveBeenCalled()
  })

  it('journalise DELAI_CALENDAR_UPDATED avec le DIFF', async () => {
    await POST(req('POST', { op: 'ajouter', ligne: NOUVELLE }))
    const appel = audit.mock.calls[0][0]
    expect(appel.action).toBe('DELAI_CALENDAR_UPDATED')
    expect(appel.meta.diff.ajoutees).toEqual([NOUVELLE.cle])
    expect(appel.meta.diff.retirees).toEqual([])
    expect(appel.meta.versionPrecedente).toBe(1)
  })

  it('une clé déjà présente est refusée (409)', async () => {
    const res = await POST(req('POST', { op: 'ajouter', ligne: { ...NOUVELLE, cle: V1[0].cle } }))
    expect(res.status).toBe(409)
    expect(prisma.delaiFerie.create).not.toHaveBeenCalled()
  })
})

describe('les validations bloquantes du § 7.4', () => {
  it('SOURCE VIDE → refus, et rien n’est publié', async () => {
    const res = await POST(req('POST', { op: 'ajouter', ligne: { ...NOUVELLE, source: '' } }))
    expect(res.status).toBe(400)
    expect(prisma.delaiFerie.create).not.toHaveBeenCalled()
  })

  it('A_SURVEILLER sans observations, sans borne ou sans compte → refus détaillé', async () => {
    const res = await POST(
      req('POST', {
        op: 'ajouter',
        ligne: { ...NOUVELLE, observationsTexteFr: null, observationsBorneFr: null, observationsN: null },
      }),
    )
    expect(res.status).toBe(400)
    const cles = ((await res.json()).anomalies as { cle: string }[]).map((a) => a.cle)
    expect(cles).toEqual(
      expect.arrayContaining(['observations_texte_vide', 'observations_borne_vide', 'observations_n_invalide']),
    )
  })

  it('LA BASCULE A_SURVEILLER → PERMANENT est refusée sans texte du corpus', async () => {
    prisma.delaiFerie.findMany.mockResolvedValue([...V1, enBase(NOUVELLE)])
    historique[NOUVELLE.cle] = enBase(NOUVELLE)
    const res = await POST(req('POST', { op: 'modifier', ligne: PERMANENT_SANS_TEXTE }))
    expect(res.status).toBe(400)
    const cles = ((await res.json()).anomalies as { cle: string }[]).map((a) => a.cle)
    expect(cles).toContain('bascule_sans_document')
    expect(prisma.delaiFerie.create).not.toHaveBeenCalled()
  })

  /**
   * ⚠️ LE CONTOURNEMENT EN DEUX APPELS. Le verrou du § 7.4 ne regardait que la version
   * COURANTE : `masquer` publie une version d'où la ligne est absente, et l'`ajouter` suivant
   * ne trouvait plus de précédent. Un jour à surveiller repartait en PERMANENT, sans
   * `sourceDocId`, avec `autorite: OBSERVATION` — et il se mettait à RETARDER toutes les
   * dates limites, sans qu'aucun texte ne le fonde.
   */
  it('masquer puis rajouter la MÊME clé ne contourne pas la bascule', async () => {
    prisma.delaiFerie.findMany.mockResolvedValue([...V1, enBase(NOUVELLE)])
    historique[NOUVELLE.cle] = enBase(NOUVELLE)

    // 1er appel : la ligne quitte le calendrier courant (version 2 sans elle).
    const masque = await PATCH(req('PATCH', { op: 'masquer', cle: NOUVELLE.cle, motif: 'On la remet à plat.' }))
    expect(masque.status).toBe(200)
    prisma.delaiFerie.findMany.mockResolvedValue(V1)
    prisma.delaiFerie.create.mockClear()

    // 2e appel : la même clé revient en PERMANENT. Le précédent se lit sur l'HISTOIRE.
    const res = await POST(req('POST', { op: 'ajouter', ligne: PERMANENT_SANS_TEXTE }))
    expect(res.status).toBe(400)
    const cles = ((await res.json()).anomalies as { cle: string }[]).map((a) => a.cle)
    expect(cles).toContain('bascule_sans_document')
    expect(cles).toContain('permanent_sur_observation')
    expect(prisma.delaiFerie.create).not.toHaveBeenCalled()
  })

  it('une ligne PERMANENT ne peut pas naître avec l’autorité OBSERVATION, même sans passé', async () => {
    // Aucun historique : ce n'est pas une bascule, et l'invariant s'applique quand même.
    const res = await POST(
      req('POST', { op: 'ajouter', ligne: { ...PERMANENT_SANS_TEXTE, cle: 'jour-tout-neuf' } }),
    )
    expect(res.status).toBe(400)
    const cles = ((await res.json()).anomalies as { cle: string }[]).map((a) => a.cle)
    expect(cles).toContain('permanent_sur_observation')
    expect(prisma.delaiFerie.create).not.toHaveBeenCalled()
  })

  it('un P2002 concurrent rend 409 « versionConcurrente », jamais une 500 brute', async () => {
    prisma.$transaction.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }))
    const res = await PATCH(req('PATCH', { op: 'masquer', cle: V1[0].cle, motif: 'Doublon du 2 janvier.' }))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('versionConcurrente')
  })
})

describe('masquer et supprimer — la ligne n’est PAS reportée, l’ancienne version reste', () => {
  it('masquer publie une version SANS la ligne, et n’efface rien', async () => {
    const cible = V1[0].cle
    const res = await PATCH(req('PATCH', { op: 'masquer', cle: cible, motif: 'Doublon du 2 janvier.' }))
    expect(res.status).toBe(200)
    const ecrites = versionsEcrites()
    expect(ecrites.length).toBe(V1.length - 1)
    expect(ecrites.some((l) => l.cle === cible)).toBe(false)
    expect(prisma.delaiFerie.delete).not.toHaveBeenCalled()
    expect(audit.mock.calls[0][0].meta.diff.retirees).toEqual([cible])
  })

  it('masquer SANS motif est refusé', async () => {
    const res = await PATCH(req('PATCH', { op: 'masquer', cle: V1[0].cle, motif: '' }))
    expect(res.status).toBe(400)
    expect(prisma.delaiFerie.create).not.toHaveBeenCalled()
  })

  it('supprimer exige la confirmation typée de la CLÉ', async () => {
    const res = await DELETE(req('DELETE', { cle: V1[0].cle, motif: 'Décision motivée.', confirmation: 'autre-chose' }))
    expect(res.status).toBe(400)
    expect(prisma.delaiFerie.create).not.toHaveBeenCalled()
  })

  it('supprimer publie une version sans la ligne — jamais de `delete()` rétroactif', async () => {
    const cible = V1[0].cle
    const res = await DELETE(req('DELETE', { cle: cible, motif: 'Décision motivée de la rédaction.', confirmation: cible }))
    expect(res.status).toBe(200)
    expect(prisma.delaiFerie.delete).not.toHaveBeenCalled()
    expect(prisma.delaiFerie.deleteMany).not.toHaveBeenCalled()
    expect(versionsEcrites().some((l) => l.cle === cible)).toBe(false)
    expect(audit.mock.calls[0][0].meta.op).toBe('supprimer')
  })

  it('réafficher reprend la ligne dans la version la plus récente qui la portait', async () => {
    const cible = V1[0].cle
    prisma.delaiFerie.findMany.mockResolvedValue(V1.filter((l) => l.cle !== cible))
    prisma.delaiFerie.findFirst.mockImplementation(async (args: { where?: { cle?: string } }) =>
      args?.where?.cle ? V1[0] : { versionCalendrier: 1 },
    )
    const res = await PATCH(req('PATCH', { op: 'reafficher', cle: cible, motif: 'Retour au calendrier.' }))
    expect(res.status).toBe(200)
    expect(versionsEcrites().some((l) => l.cle === cible)).toBe(true)
  })
})
