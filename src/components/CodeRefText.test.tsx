import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AnnotatedText } from './AnnotatedText'
import { OfficialText } from './OfficialText'
import { CodeRefText } from './CodeRefText'
import type { Annotations } from '@/lib/legislation/annotated'

/**
 * Renvois du Code civil vers le Code de procédure civile, éprouvés par le CHEMIN DE
 * RENDU RÉEL (AnnotatedText → OfficialText), pas seulement par la grammaire : c'est
 * exactement là qu'un lecteur annoté peut rester inerte sans que rien n'échoue.
 */
const CPC = '/fr/doc/cms7u9239000212wwoddflgnu'

// Extrait authentique du recueil (articles 7 et 8 du Code civil d'Haïti).
const CORPS = [
  'Art. 7 Tout Haïtien jouira des droits civils.- C. civ., 16, 17, 155, 398.- C. p. c. 956.',
  'Art. 8 Il est défendu aux juges de prononcer par voie de disposition générale.- C. p. c. 268.- C. pén. 95.',
  "Art. 9 Le juge pourra être poursuivi comme coupable de déni de justice.- C. p. c. 464, et s ; C. pén. 146, 190-13.",
].join('\n')

const annotations = (extra: Partial<Annotations> = {}): Annotations => ({
  title: 'Code civil',
  annotationAuthor: '',
  navToc: [],
  toc: [],
  connexes: [],
  jurisprudence: {},
  indexEntries: [],
  crossRefs: [],
  oldVersions: {},
  status: {},
  labels: {},
  connexe: {},
  commentaires: {},
  ...extra,
})

const hrefs = (html: string) => [...html.matchAll(/href="([^"]*doc\/cms7u9239[^"]*)"/g)].map((m) => m[1])
/** Texte visible, balises retirées et entités ramenées — pour prouver que rien n'a bougé. */
const texte = (html: string) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')

describe('Code civil → Code de procédure civile (chemin de rendu)', () => {
  it('les renvois du CORPS deviennent des liens ancrés sur l’article', () => {
    const html = renderToStaticMarkup(<OfficialText text={CORPS} civRefs codeHrefs={{ cpc: CPC }} />)
    expect(hrefs(html)).toEqual([
      CPC, `${CPC}#art-956`,
      CPC, `${CPC}#art-268`,
      CPC, `${CPC}#art-464`,
    ])
  })

  it('sans cpcDocHref, le rendu est INCHANGÉ (aucun autre document n’est affecté)', () => {
    const html = renderToStaticMarkup(<OfficialText text={CORPS} civRefs />)
    expect(hrefs(html)).toEqual([])
    expect(html).not.toContain('procédure civile')
  })

  it('les renvois INTERNES « C. civ., 16 » restent des ancres du document courant', () => {
    const html = renderToStaticMarkup(<OfficialText text={CORPS} civRefs codeHrefs={{ cpc: CPC }} />)
    // « C. civ., 16, 17, 155, 398 » : quatre ancres internes, non préfixées par /fr/doc/
    for (const n of [16, 17, 155, 398]) expect(html).toContain(`href="#art-${n}"`)
  })

  it('« C. pén. » n’est jamais transformé', () => {
    const html = renderToStaticMarkup(<OfficialText text={CORPS} civRefs codeHrefs={{ cpc: CPC }} />)
    // Guillemet fermant obligatoire : sans lui, « #art-95 » est un PRÉFIXE de « #art-956 »
    // et l'assertion échouerait sur un lien pourtant légitime.
    expect(html).not.toContain(`${CPC}#art-95"`)
    expect(html).not.toContain(`${CPC}#art-146"`)
    expect(texte(html)).toContain('C. pén. 95.')
    expect(texte(html)).toContain('C. pén. 146, 190-13.')
  })

  it('le texte affiché est mot pour mot celui du recueil', () => {
    const html = renderToStaticMarkup(<OfficialText text={CORPS} civRefs codeHrefs={{ cpc: CPC }} />)
    for (const ligne of CORPS.split('\n')) expect(texte(html)).toContain(ligne.replace(/^Art\. \d+ /, ''))
  })

  it('le lecteur annoté propage le lien au corps de l’article', () => {
    const html = renderToStaticMarkup(
      <AnnotatedText
        text={'Art. 674 Le partage se fait en justice.- C. p. c. 949.'}
        annotations={annotations({
          jurisprudence: { 'art-674': [{ ref: '', excerpt: 'Réclamer le paiement.- C. p. c. 535.' }] },
          oldVersions: { 'art-674': 'Ancienne rédaction : renvoi à C. p. c. 536.' },
        })}
        linkCivRefs
        annotationsVariant="annotations"
        codeHrefs={{ cpc: CPC }}
      />,
    )
    expect(html).toContain(`${CPC}#art-949"`)
    // ⚠ Le pliable « Annotations » et celui de l'ancienne rédaction sont des composants
    // CLIENTS fermés par défaut : leur contenu n'existe pas dans le rendu serveur. Les
    // liens qu'ils portent sont donc éprouvés sur <CodeRefText> lui-même, ci-dessous.
    expect(html).not.toContain(`${CPC}#art-535"`)
  })

  describe('surfaces repliables (annotations, ancienne rédaction)', () => {
    it('CodeRefText transforme une note de jurisprudence', () => {
      const html = renderToStaticMarkup(
        <CodeRefText text="Réclamer le paiement de ses créances.- C. p. c. 949." codeHrefs={{ cpc: CPC }} />,
      )
      expect(html).toContain(`${CPC}#art-949"`)
      expect(texte(html)).toBe('Réclamer le paiement de ses créances.- C. p. c. 949.')
    })

    it('CodeRefText transforme « l’art. 930 du C. p. c. » d’un commentaire', () => {
      const html = renderToStaticMarkup(<CodeRefText text="Voir l'art. 930 du C. p. c." codeHrefs={{ cpc: CPC }} />)
      expect(html).toContain(`${CPC}#art-930"`)
    })

    it('CodeRefText laisse le texte intact sans cible', () => {
      const html = renderToStaticMarkup(<CodeRefText text="Renvoi à C. p. c. 535, 536." />)
      expect(html).not.toContain('href')
      expect(texte(html)).toBe('Renvoi à C. p. c. 535, 536.')
    })
  })
})
