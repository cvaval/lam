/**
 * § 7 — LES ROUTES D'ADMINISTRATION DU RÉPERTOIRE : **trois verbes, trois comportements.**
 *
 * Ces tests sont COMPORTEMENTAUX : Prisma, les gardes et le journal sont simulés, la route est
 * exécutée pour de vrai. Ce qu'ils protègent n'est pas une syntaxe, c'est une promesse faite à
 * l'utilisatrice — « aucune action d'administration ne modifie, ne recalcule ni n'efface un
 * résultat déjà rendu » (§ 7.3) :
 *
 *  1. masquer **n'incrémente pas `revision`** → un permalien antérieur reste reproductible ;
 *  2. supprimer **n'appelle jamais `delete()`** → la ligne et ses copies gelées survivent ;
 *  3. supprimer exige le **master admin**, une **confirmation typée** et un **motif** ;
 *  4. créer écrit l'entrée ET sa copie gelée dans **une seule transaction**.
 */
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = {
  delaiEntry: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  delaiEntryRevision: { create: vi.fn(), findUnique: vi.fn() },
  delaiFerie: { findMany: vi.fn() },
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
const EDITEUR = { id: 'u-2', role: 'EDITEUR' }

const CHAMPS = {
  code: 'CPC',
  article: '999',
  tableau: 1,
  objetFr: 'Entrée d’essai',
  dureeTexte: '30 jours francs',
  kind: 'JOURS',
  jours: 30,
  regime: 'FRANC',
  regimeFondement:
    'C. pr. civ., art. 987 — « Tous les délais prévus au Code de procédure civile sont francs. »',
  prorogation991: 'OUI',
  prorogationFondement: 'C. pr. civ., art. 991 al. 3',
  pointDepartFr: 'Signification',
}

const LIGNE = {
  id: 'e-1',
  slug: 'cpc-999',
  code: 'CPC',
  article: '999',
  statut: 'visible',
  revision: 3,
  masqueMotif: null,
  updatedAt: new Date('2026-08-01T00:00:00Z'),
}

function req(methode: string, corps: unknown) {
  return new NextRequest('http://localhost/api/admin/delais', {
    method: methode,
    body: JSON.stringify(corps),
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  requireCapabilityApi.mockResolvedValue(ADMIN)
  requireAdminApi.mockResolvedValue(ADMIN)
  prisma.delaiEntry.findUnique.mockResolvedValue(null)
  prisma.delaiEntry.findMany.mockResolvedValue([])
  prisma.delaiFerie.findMany.mockResolvedValue([])
  prisma.delaiEntry.create.mockResolvedValue({ ...LIGNE, revision: 1 })
  prisma.delaiEntry.update.mockResolvedValue(LIGNE)
  // La transaction est exécutée pour de vrai, avec le client simulé : la route doit écrire
  // l'entrée ET sa copie gelée dedans, pas à côté.
  prisma.$transaction.mockImplementation(async (fn: unknown) =>
    typeof fn === 'function' ? (fn as (tx: unknown) => Promise<unknown>)(prisma) : fn,
  )
})

describe('la double garde', () => {
  it('sans capacité `corpus.manage`, les trois verbes refusent', async () => {
    requireCapabilityApi.mockResolvedValue(null)
    requireAdminApi.mockResolvedValue(null)
    expect((await POST(req('POST', CHAMPS))).status).toBe(403)
    expect((await PATCH(req('PATCH', { op: 'reafficher', id: 'e-1' }))).status).toBe(403)
    expect((await DELETE(req('DELETE', { id: 'e-1', motif: 'Doublon avéré', confirmation: '999' }))).status).toBe(403)
    expect(prisma.delaiEntry.create).not.toHaveBeenCalled()
    expect(prisma.delaiEntry.update).not.toHaveBeenCalled()
  })

  it('SUPPRIMER est plus étroit : un éditeur capable de curer ne supprime pas', async () => {
    requireCapabilityApi.mockResolvedValue(EDITEUR)
    requireAdminApi.mockResolvedValue(null) // c'est la garde master admin qui tranche
    const res = await DELETE(req('DELETE', { id: 'e-1', motif: 'Doublon avéré', confirmation: '999' }))
    expect(res.status).toBe(403)
    expect(prisma.delaiEntry.update).not.toHaveBeenCalled()
  })
})

describe('§ 7.1 — ajouter', () => {
  it('écrit l’entrée ET sa copie gelée dans UNE transaction, puis journalise', async () => {
    const res = await POST(req('POST', CHAMPS))
    expect(res.status).toBe(200)
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(prisma.delaiEntry.create).toHaveBeenCalledTimes(1)
    expect(prisma.delaiEntryRevision.create).toHaveBeenCalledTimes(1)
    const revision = prisma.delaiEntryRevision.create.mock.calls[0][0].data
    expect(revision.revision).toBe(1)
    expect(JSON.parse(revision.payloadJson).article).toBe('999')
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'DELAI_ENTRY_CREATED', targetType: 'DELAI' }))
  })

  it('dérive le slug de l’article — il ne se saisit pas (§ 5.2 bis)', async () => {
    await POST(req('POST', CHAMPS))
    expect(prisma.delaiEntry.create.mock.calls[0][0].data.slug).toBe('cpc-999')
  })

  it('REFUSE une saisie fautive, avec la liste des anomalies, et n’écrit rien', async () => {
    const res = await POST(req('POST', { ...CHAMPS, jours: null }))
    expect(res.status).toBe(400)
    const corps = (await res.json()) as { anomalies: { cle: string }[] }
    expect(corps.anomalies.map((a) => a.cle)).toContain('jours_absent_sur_kind_calculable')
    expect(prisma.delaiEntry.create).not.toHaveBeenCalled()
    expect(audit).not.toHaveBeenCalled()
  })

  it('refuse un corps que zod rejette, sans toucher à la base', async () => {
    const res = await POST(req('POST', { ...CHAMPS, code: 'FISCAL' }))
    expect(res.status).toBe(400)
    expect(prisma.delaiEntry.create).not.toHaveBeenCalled()
  })
})

describe('§ 7.2 — masquer et réafficher', () => {
  beforeEach(() => prisma.delaiEntry.findUnique.mockResolvedValue(LIGNE))

  it('masquer pose le statut, la date et le motif — et NE TOUCHE PAS à `revision`', async () => {
    const res = await PATCH(req('PATCH', { op: 'masquer', id: 'e-1', motif: 'Doublon de l’article 354.' }))
    expect(res.status).toBe(200)
    const data = prisma.delaiEntry.update.mock.calls[0][0].data
    expect(data.statut).toBe('masque')
    expect(data.masqueMotif).toBe('Doublon de l’article 354.')
    expect(data).not.toHaveProperty('revision')
    // Aucune copie gelée : masquer n'est pas une modification de fond.
    expect(prisma.delaiEntryRevision.create).not.toHaveBeenCalled()
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'DELAI_ENTRY_HIDDEN' }))
  })

  it('masquer SANS motif est refusé — le motif est affiché aux utilisateurs', async () => {
    const res = await PATCH(req('PATCH', { op: 'masquer', id: 'e-1', motif: '' }))
    expect(res.status).toBe(400)
    expect(prisma.delaiEntry.update).not.toHaveBeenCalled()
  })

  it('réafficher rétablit le statut et journalise DELAI_ENTRY_RESTORED', async () => {
    prisma.delaiEntry.findUnique.mockResolvedValue({ ...LIGNE, statut: 'masque', masqueMotif: 'Doublon.' })
    const res = await PATCH(req('PATCH', { op: 'reafficher', id: 'e-1' }))
    expect(res.status).toBe(200)
    expect(prisma.delaiEntry.update.mock.calls[0][0].data.statut).toBe('visible')
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELAI_ENTRY_RESTORED', meta: expect.objectContaining({ motifPrecedent: 'Doublon.' }) }),
    )
  })

  /**
   * ⚠️ LE DÉFAUT BLOQUANT. Un éditeur (`corpus.manage`, PAS master admin) remettait au menu
   * du calculateur une entrée SUPPRIMÉE : la branche `reafficher` ne regardait pas
   * `existante.statut` et écrivait `statut: 'visible'` quel que soit l'état de départ. Une
   * entrée retirée parce qu'elle était juridiquement fausse revenait au calculateur public,
   * sans passer par la garde qui protège la suppression.
   */
  describe('une entrée SUPPRIMÉE ne se réaffiche pas, et ne se masque pas', () => {
    beforeEach(() =>
      prisma.delaiEntry.findUnique.mockResolvedValue({
        ...LIGNE,
        statut: 'supprime',
        masqueMotif: 'Durée fausse : l’article n’en porte aucune.',
      }),
    )

    it('un ÉDITEUR qui ne peut pas supprimer ne peut pas défaire une suppression', async () => {
      requireCapabilityApi.mockResolvedValue(EDITEUR)
      requireAdminApi.mockResolvedValue(null)
      // Le chemin exact de la revue : DELETE → 403, puis PATCH reafficher → 200 avant correctif.
      expect((await DELETE(req('DELETE', { id: 'e-1', motif: 'Doublon avéré', confirmation: '999' }))).status).toBe(403)
      const res = await PATCH(req('PATCH', { op: 'reafficher', id: 'e-1' }))
      expect(res.status).toBe(409)
      expect((await res.json()).error).toBe('entreeSupprimee')
      expect(prisma.delaiEntry.update).not.toHaveBeenCalled()
    })

    it('« masquer » ne requalifie pas une suppression en simple masquage', async () => {
      const res = await PATCH(req('PATCH', { op: 'masquer', id: 'e-1', motif: 'Doublon de l’article 354.' }))
      expect(res.status).toBe(409)
      expect((await res.json()).error).toBe('entreeSupprimee')
      expect(prisma.delaiEntry.update).not.toHaveBeenCalled()
    })

    it('le verbe qui la rétablit exige le master admin, un motif ET la confirmation typée', async () => {
      requireCapabilityApi.mockResolvedValue(EDITEUR)
      requireAdminApi.mockResolvedValue(null)
      const refuse = await PATCH(
        req('PATCH', { op: 'restaurer-suppression', id: 'e-1', motif: 'La rédaction revient dessus.', confirmation: '999' }),
      )
      expect(refuse.status).toBe(403)
      expect(prisma.delaiEntry.update).not.toHaveBeenCalled()

      requireAdminApi.mockResolvedValue(ADMIN)
      const sansConfirmation = await PATCH(
        req('PATCH', { op: 'restaurer-suppression', id: 'e-1', motif: 'La rédaction revient dessus.', confirmation: '354' }),
      )
      expect(sansConfirmation.status).toBe(400)
      expect(prisma.delaiEntry.update).not.toHaveBeenCalled()

      const ok = await PATCH(
        req('PATCH', { op: 'restaurer-suppression', id: 'e-1', motif: 'La rédaction revient dessus.', confirmation: '999' }),
      )
      expect(ok.status).toBe(200)
      const data = prisma.delaiEntry.update.mock.calls[0][0].data
      expect(data.statut).toBe('visible')
      // La règle n'a pas changé : `revision` reste intacte, le permalien reste reproductible.
      expect(data).not.toHaveProperty('revision')
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELAI_ENTRY_UNDELETED', actorId: 'u-1' }),
      )
    })

    it('« restaurer-suppression » sur une entrée seulement masquée est refusé', async () => {
      prisma.delaiEntry.findUnique.mockResolvedValue({ ...LIGNE, statut: 'masque' })
      const res = await PATCH(
        req('PATCH', { op: 'restaurer-suppression', id: 'e-1', motif: 'Erreur de manipulation.', confirmation: '999' }),
      )
      expect(res.status).toBe(409)
      expect((await res.json()).error).toBe('entreeNonSupprimee')
    })
  })

  it('modifier incrémente `revision` et gèle la nouvelle — le slug, lui, ne bouge pas', async () => {
    const res = await PATCH(req('PATCH', { op: 'modifier', id: 'e-1', champs: { ...CHAMPS, jours: 15 } }))
    expect(res.status).toBe(200)
    expect(prisma.delaiEntry.update.mock.calls[0][0].data.revision).toBe(4)
    const gelee = prisma.delaiEntryRevision.create.mock.calls[0][0].data
    expect(gelee.revision).toBe(4)
    expect(JSON.parse(gelee.payloadJson).slug).toBe('cpc-999')
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELAI_ENTRY_UPDATED', meta: expect.objectContaining({ de: 3, vers: 4 }) }),
    )
  })
})

describe('§ 7.3 — supprimer', () => {
  beforeEach(() => prisma.delaiEntry.findUnique.mockResolvedValue(LIGNE))

  it('n’efface JAMAIS physiquement : statut « supprime », et aucun `delete()`', async () => {
    const res = await DELETE(req('DELETE', { id: 'e-1', motif: 'Ligne en double du répertoire.', confirmation: '999' }))
    expect(res.status).toBe(200)
    expect(prisma.delaiEntry.delete).not.toHaveBeenCalled()
    const data = prisma.delaiEntry.update.mock.calls[0][0].data
    expect(data.statut).toBe('supprime')
    expect(data.masqueMotif).toBe('Ligne en double du répertoire.')
    // La révision n'est pas touchée non plus : la règle n'a pas changé, elle a été retirée.
    expect(data).not.toHaveProperty('revision')
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'DELAI_ENTRY_DELETED' }))
  })

  it('exige la confirmation TYPÉE du numéro d’article', async () => {
    const res = await DELETE(req('DELETE', { id: 'e-1', motif: 'Ligne en double.', confirmation: '354' }))
    expect(res.status).toBe(400)
    expect(prisma.delaiEntry.update).not.toHaveBeenCalled()
  })

  /**
   * ⚠️ Le test d'origine simulait `findMany` pour qu'il rende `[{ slug: 'cpc-356' }]` : il
   * vérifiait le BRANCHEMENT, jamais la sémantique. Or la route cherchait le SLUG en
   * sous-chaîne dans quatre champs de prose juridique — où aucun des 393 slugs n'apparaît —,
   * et le 409 ne pouvait donc jamais se déclencher en production. Ces tests-ci exercent la
   * vraie prose : le filtre de Prisma est reproduit sur des lignes réalistes.
   */
  function lignesQuiCitent(...fondements: string[]) {
    return (args: { where: { OR?: Record<string, { contains: string }>[] } }) => {
      const motif = Object.values(args.where.OR?.[0] ?? {})[0]
      return Promise.resolve(
        fondements
          .filter((f) => f.includes(motif.contains))
          .map((f, i) => ({
            slug: `cpc-voisin-${i}`,
            regimeFondement: f,
            prorogationFondement: '',
            dureeFondementFr: null,
            supplementJson: null,
          })),
      )
    }
  }

  it('REFUSE quand un fondement CITE l’article — « C. pr. civ., art. 999 »', async () => {
    prisma.delaiEntry.findMany.mockImplementation(
      lignesQuiCitent(
        'La durée est celle de C. pr. civ., art. 999 — « trente jours francs ». Voir aussi l’art. 991.',
      ),
    )
    const res = await DELETE(req('DELETE', { id: 'e-1', motif: 'Ligne en double.', confirmation: '999' }))
    expect(res.status).toBe(409)
    expect((await res.json()).renvois[0]).toContain('C. pr. civ., art. 999')
    expect(prisma.delaiEntry.update).not.toHaveBeenCalled()
  })

  it('un article dont le NUMÉRO est un préfixe d’un autre ne bloque pas la suppression', async () => {
    // « art. 9990 » n'est pas un renvoi vers l'art. 999 : la frontière de mot le tranche.
    prisma.delaiEntry.findMany.mockImplementation(
      lignesQuiCitent('Durée fixée par C. pr. civ., art. 9990 — une autre ligne du répertoire.'),
    )
    const res = await DELETE(req('DELETE', { id: 'e-1', motif: 'Ligne en double.', confirmation: '999' }))
    expect(res.status).toBe(200)
    expect(prisma.delaiEntry.update.mock.calls[0][0].data.statut).toBe('supprime')
  })

  it('le motif cherché retire le préfixe déjà porté par `article` (« Art. 164 »)', async () => {
    prisma.delaiEntry.findUnique.mockResolvedValue({ ...LIGNE, code: 'TRAVAIL', article: 'Art. 164' })
    prisma.delaiEntry.findMany.mockImplementation(
      lignesQuiCitent('Le délai est celui de C. trav., art. 164, tel que la section le porte.'),
    )
    const res = await DELETE(req('DELETE', { id: 'e-1', motif: 'Ligne en double.', confirmation: 'Art. 164' }))
    expect(res.status).toBe(409)
    // Jamais « C. trav., art. Art. 164 » (défaut 13).
    expect((await res.json()).renvois[0]).toContain('C. trav., art. 164')
  })

  it('une entrée inconnue rend 404, sans écriture', async () => {
    prisma.delaiEntry.findUnique.mockResolvedValue(null)
    const res = await DELETE(req('DELETE', { id: 'inconnu', motif: 'Ligne en double.', confirmation: '999' }))
    expect(res.status).toBe(404)
    expect(prisma.delaiEntry.update).not.toHaveBeenCalled()
  })
})

describe('la table absente n’est pas un bug', () => {
  it('rend 503 avec un code explicite quand la migration n’est pas passée', async () => {
    const erreur = Object.assign(new Error('table does not exist'), { code: 'P2021' })
    prisma.delaiEntry.findUnique.mockRejectedValue(erreur)
    const res = await PATCH(req('PATCH', { op: 'reafficher', id: 'e-1' }))
    expect(res.status).toBe(503)
    expect((await res.json()).error).toBe('delaisSchemaAbsent')
  })
})
