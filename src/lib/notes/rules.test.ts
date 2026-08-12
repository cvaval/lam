import { describe, it, expect } from 'vitest'
import { peutEtreAnonyme, peutModerer, estRedaction, signature } from './rules'

describe('règles des notes de lecteurs', () => {
  it('un ÉDITEUR ou le MASTER ADMIN ne peut jamais être anonyme', () => {
    // Consigne cliente explicite : la parole de la rédaction engage la plateforme.
    expect(peutEtreAnonyme('EDITEUR')).toBe(false)
    expect(peutEtreAnonyme('MASTER_ADMIN')).toBe(false)
  })

  it('un lecteur peut l’être, quel que soit son palier', () => {
    for (const r of ['SITWAYEN', 'PWOFESYONEL', 'ENSTITISYON']) {
      expect(peutEtreAnonyme(r)).toBe(true)
    }
  })

  it('seule la rédaction modère', () => {
    expect(peutModerer('MASTER_ADMIN')).toBe(true)
    expect(peutModerer('EDITEUR')).toBe(true)
    expect(peutModerer('PWOFESYONEL')).toBe(false)
    expect(estRedaction('ENSTITISYON')).toBe(false)
  })

  it('une note anonyme ne laisse filtrer NI nom NI adresse', () => {
    const s = signature({ anonymous: true, author: { name: 'Me Jean DUPONT', email: 'jd@cabinet.ht' } })
    expect(s).toBe('Contribution anonyme')
    expect(s).not.toContain('DUPONT')
    expect(s).not.toContain('@')
  })

  it('une note signée porte le nom, à défaut l’adresse', () => {
    expect(signature({ anonymous: false, author: { name: 'Me Jean DUPONT', email: 'jd@cabinet.ht' } })).toBe('Me Jean DUPONT')
    expect(signature({ anonymous: false, author: { name: '   ', email: 'jd@cabinet.ht' } })).toBe('jd@cabinet.ht')
  })
})
