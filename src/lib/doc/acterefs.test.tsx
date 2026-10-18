import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { segmentActeRefs } from './acterefs'
import { OfficialText } from '@/components/OfficialText'
import { CodeRefText } from '@/components/CodeRefText'

/**
 * Actes nommés du Code civil (« Décret du 8 octobre 1982 ») liés à leur texte ou à leur Moniteur
 * — décision de Me Vaval, 18 oct. 2026. Extraits authentiques des annotations et du corps.
 */
const M75 = '/fr/doc/cmsxer4wd002114p5o4xre87u' // Le Moniteur n° 75 — Octobre 1982
const RM = '/fr/doc/cmrldw5ea0000u9drkn5uc7su' // Décret du 9 avril 2020 — régimes matrimoniaux
const SUR = '/fr/doc/cmrspgd9h0000yn8emki3dtw6' // Décret du 9 avril 2020 — sûretés
const ACTES = {
  'Décret du 8 octobre 1982': M75,
  'Décret du 9 avril 2020 portant réforme des régimes matrimoniaux': RM,
  'Décret du 9 avril 2020 réformant le droit des sûretés': SUR,
}
const CPC = '/fr/doc/cms7u9239000212wwoddflgnu'

const liens = (html: string) => [...html.matchAll(/href="(\/fr\/doc\/[^"]*)"/g)].map((m) => m[1])
const texte = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&')

describe('segmentActeRefs', () => {
  it('lie la désignation, rien d’autre', () => {
    const s = segmentActeRefs("V. l'art. 2 du Décret du 8 octobre 1982.", ACTES)!
    expect(s.map((x) => x.kind)).toEqual(['text', 'acte', 'text'])
    expect(s[1]).toMatchObject({ text: 'Décret du 8 octobre 1982', href: M75 })
    expect(s.map((x) => x.text).join('')).toBe("V. l'art. 2 du Décret du 8 octobre 1982.")
  })

  it('casse et espaces du recueil n’empêchent pas le lien', () => {
    const s = segmentActeRefs('Abrogé par le décret du  8 octobre\n1982', ACTES)!
    expect(s.find((x) => x.kind === 'acte')).toMatchObject({ href: M75, cle: 'Décret du 8 octobre 1982' })
  })

  it('⚠️ deux décrets du même jour : l’OBJET départage, la plus longue désignation l’emporte', () => {
    const rm = segmentActeRefs('Art. 1174 (Décret du 9 avril 2020 portant réforme des régimes matrimoniaux) Les époux…', ACTES)!
    const su = segmentActeRefs('Art. 1888 (Décret du 9 avril 2020 réformant le droit des sûretés) Les causes…', ACTES)!
    expect(rm.find((x) => x.kind === 'acte')!.href).toBe(RM)
    expect(su.find((x) => x.kind === 'acte')!.href).toBe(SUR)
    // La seule date ne désigne aucun des deux : pas de lien.
    expect(segmentActeRefs('le Décret du 9 avril 2020', ACTES)).toBeNull()
  })

  it('une autre année n’est pas l’acte (« 19821 », « 1983 »)', () => {
    expect(segmentActeRefs('Décret du 8 octobre 19821', ACTES)).toBeNull()
    expect(segmentActeRefs('Décret du 8 octobre 1983', ACTES)).toBeNull()
  })

  it('sans table, ou table vide : null (le texte suit son chemin habituel)', () => {
    expect(segmentActeRefs('Décret du 8 octobre 1982', undefined)).toBeNull()
    expect(segmentActeRefs('Décret du 8 octobre 1982', {})).toBeNull()
  })
})

describe('chemin de rendu', () => {
  it('le corps : l’acte se lie, « C. p. c. » aussi, et le texte reste mot pour mot', () => {
    const corps = "Art. 1361 Mais elle ne peut les aliéner. V. l'art. 2 du Décret du 8 octobre 1982.- C. p. c. 949."
    const html = renderToStaticMarkup(<OfficialText text={corps} civRefs codeHrefs={{ cpc: CPC, actes: ACTES }} />)
    expect(liens(html)).toEqual([M75, CPC, `${CPC}#art-949`])
    expect(texte(html)).toContain("Mais elle ne peut les aliéner. V. l'art. 2 du Décret du 8 octobre 1982.- C. p. c. 949.")
  })

  it('« art. 2 du Décret du … » n’est PAS l’article 2 du Code', () => {
    const html = renderToStaticMarkup(<OfficialText text={"Art. 199 V. l'art. 2 du Décret du 8 octobre 1982."} civRefs codeHrefs={{ actes: ACTES }} />)
    expect(html).not.toContain('href="#art-2"')
  })

  it('le marqueur « [Abrogé — …] » porte le lien de l’acte', () => {
    const html = renderToStaticMarkup(
      <OfficialText
        text={'Article 197.- [Abrogé — Décret du 8 octobre 1982 donnant à la femme un statut conforme à la Constitution (Le Moniteur n° 75 du 28 octobre 1982)]'}
        civRefs
        marqueurTete
        codeHrefs={{ actes: ACTES }}
      />,
    )
    expect(liens(html)).toEqual([M75])
    expect(texte(html)).toContain('[Abrogé — Décret du 8 octobre 1982 donnant à la femme')
  })

  it('annotations et anciennes rédactions (CodeRefText)', () => {
    const html = renderToStaticMarkup(<CodeRefText text="Abrogé par le Décret du 8 octobre 1982.- C. p. c. 535." codeHrefs={{ cpc: CPC, actes: ACTES }} />)
    expect(liens(html)).toEqual([M75, CPC, `${CPC}#art-535`])
    expect(texte(html)).toBe('Abrogé par le Décret du 8 octobre 1982.- C. p. c. 535.')
  })

  it('hors Code civil (CPC : renvois « article N », pas « C. civ. »), l’acte se lie aussi', () => {
    const D95 = '/fr/doc/cms8dvnw4000jqt1v7p43xsxk'
    const corps = 'Article 18 (Mod. L. 18 sept 1985 et Décret du 22 août 1995).- La compétence des juges de paix, prévue à l’article 19.'
    const html = renderToStaticMarkup(<OfficialText text={corps} artRefs={new Set(['art-19'])} codeHrefs={{ actes: { 'Décret du 22 août 1995': D95 } }} />)
    expect(liens(html)).toEqual([D95])
    expect(html).toContain('href="#art-19"')
    expect(texte(html)).toContain('(Mod. L. 18 sept 1985 et Décret du 22 août 1995).- La compétence')
  })

  it('sans table d’actes, aucun lien nouveau (les autres documents ne bougent pas)', () => {
    const html = renderToStaticMarkup(<CodeRefText text="Abrogé par le Décret du 8 octobre 1982." codeHrefs={{ cpc: CPC }} />)
    expect(html).not.toContain('href')
  })
})
