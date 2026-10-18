import { describe, expect, it, vi } from 'vitest'
import { badgeAffichable, champsModifies, confirmationPublique, empreinte, instantane, invaliderSiModifie } from './notaires-confirmation'

const N = { fullName: 'Jean EXEMPLE', displayName: null, communeId: 'commune-ouest-port-au-prince' }
const C = { address: '10 rue Exemple, Quartier, Port-au-Prince', phonesJson: '["+50920000001"]', email: 'etude@exemple.ht', emailsJson: '["etude@exemple.ht"]', active: true }

describe('instantané et empreinte — la version confirmée', () => {
  it('même information, même empreinte ; espaces normalisés', () => {
    const a = empreinte(instantane(N, C))
    expect(empreinte(instantane(N, { ...C, address: '  10 rue Exemple,   Quartier, Port-au-Prince ' }))).toBe(a)
  })

  it('toute modification substantielle change l’empreinte', () => {
    const a = empreinte(instantane(N, C))
    for (const autre of [
      instantane(N, { ...C, address: '20, Route Exemple' }),
      instantane(N, { ...C, phonesJson: '["+50920000001","+50930000002"]' }),
      instantane(N, { ...C, email: 'autre@exemple.ht', emailsJson: '["autre@exemple.ht"]' }),
      instantane(N, { ...C, emailsJson: '["etude@exemple.ht","accueil@exemple.ht"]' }),
      instantane({ ...N, displayName: 'Jean J. EXEMPLE' }, C),
      instantane({ ...N, communeId: 'commune-ouest-delmas' }, C),
      instantane(N, { ...C, active: false }),
    ]) expect(empreinte(autre)).not.toBe(a)
  })

  it('une fiche inactive ne publie rien', () => {
    expect(instantane(N, { ...C, active: false })).toMatchObject({ adresse: null, telephones: [], courriels: [] })
  })

  it('champsModifies nomme les champs touchés', () => {
    expect(champsModifies(instantane(N, C), instantane(N, { ...C, emailsJson: '["x@exemple.ht"]' }))).toEqual(['courriels'])
  })

  it('tous les courriels publiés comptent, dans leur ordre ; une fiche d’avant la liste (seul `email`) garde SA version', () => {
    expect(instantane(N, { ...C, email: 'a@exemple.ht', emailsJson: '["a@exemple.ht","b@exemple.ht"]' }).courriels).toEqual(['a@exemple.ht', 'b@exemple.ht'])
    // La reprise (email → emailsJson) ne change pas l'empreinte : aucune confirmation n'en serait invalidée.
    expect(empreinte(instantane(N, { ...C, emailsJson: '[]' }))).toBe(empreinte(instantane(N, C)))
  })
})

describe('badge — affiché seulement si ACTIVE et version inchangée', () => {
  const h = empreinte(instantane(N, C))
  it.each([
    [{ status: 'ACTIVE', snapshotHash: h }, true],
    [{ status: 'ACTIVE', snapshotHash: 'autre' }, false],
    [{ status: 'RETIREE', snapshotHash: h }, false],
    [{ status: 'INVALIDEE', snapshotHash: h }, false],
    [null, false],
  ])('%o → %s', (conf, attendu) => expect(badgeAffichable(conf, h)).toBe(attendu))

  it('le public ne reçoit que la date de confirmation', () => {
    const pub = confirmationPublique({ status: 'ACTIVE', snapshotHash: h, confirmedOn: new Date('2026-10-18T00:00:00Z') }, h)
    expect(pub).toEqual({ on: '2026-10-18' })
  })
})

describe('invaliderSiModifie — dans la transaction de l’écriture', () => {
  const tx = (contact: typeof C | null, actives: Array<{ id: string; snapshotHash: string }>) => ({
    notary: { findUnique: vi.fn().mockResolvedValue({ ...N, contact }) },
    notaryConfirmation: { findMany: vi.fn().mockResolvedValue(actives), update: vi.fn().mockResolvedValue({}) },
  })

  it('version inchangée : rien n’est invalidé', async () => {
    const t = tx(C, [{ id: 'c1', snapshotHash: empreinte(instantane(N, C)) }])
    expect(await invaliderSiModifie(t, 'n', 'u', 'm')).toEqual([])
    expect(t.notaryConfirmation.update).not.toHaveBeenCalled()
  })

  it('adresse modifiée : la confirmation passe INVALIDÉE, motif et auteur consignés', async () => {
    const t = tx({ ...C, address: '20, Route Exemple' }, [{ id: 'c1', snapshotHash: empreinte(instantane(N, C)) }])
    expect(await invaliderSiModifie(t, 'n', 'u-1', 'Modification substantielle')).toEqual(['c1'])
    expect(t.notaryConfirmation.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'c1' }, data: expect.objectContaining({ status: 'INVALIDEE', endedById: 'u-1', endReason: 'Modification substantielle' }),
    }))
  })
})
