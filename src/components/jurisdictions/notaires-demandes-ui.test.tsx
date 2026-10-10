/**
 * Les demandes des tiers côté public (chantier D) et les entrées ajoutées par la rédaction —
 * rendu serveur. Ce qui est protégé :
 *  - formulaire FERMÉ ⇒ aucun lien nulle part (la fonctionnalité n'existe pas pour le public) ;
 *  - ouvert ⇒ des liens DISCRETS, à trois endroits ;
 *  - le formulaire fonctionne sans JavaScript (POST classique), porte son champ piège invisible
 *    et l'heure d'affichage ; ses erreurs sont des phrases, jamais des codes ;
 *  - un notaire ajouté par la rédaction ne se fait pas passer pour une inscription du MJSP.
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { getDictionary } from '@/lib/i18n/dictionaries'
import type { NotaryDirectory, NotaryProfile, NotaryView } from '@/lib/jurisdictions/data'
import { NotaryRequestForm, NOTARY_REQUEST_ACTION } from './NotaryRequestForm'
import { libellesDemande } from './notary-request-labels'
import { NotaryProfileView } from './NotaryProfileView'
import { NotariesSection } from './NotariesSection'
import { NotaryDirectoryView } from './NotaryDirectoryView'

const t = getDictionary('fr')
const j = t.judicial
const PROFIL: NotaryProfile = {
  id: 'mjsp-2026-09-08-11', ordinal: 11, name: 'Patrick VICTOR', printedName: null, mention: null,
  commune: { id: 'commune-ouest-port-au-prince', name: 'Port-au-Prince', department: 'Ouest' },
  sourceCommune: 'PORT-AU-PRINCE', jurisdiction: { id: 'court-tpi-tpi-de-port-au-prince', label: 'Port-au-Prince' },
  contact: null, provenance: { consultations: ['2026-09-08'] }, addedByEditors: null,
}
const VUE = (o: Partial<NotaryView> = {}): NotaryView => ({ id: 'mjsp-2026-09-08-11', ordinal: 11, fullName: 'Patrick VICTOR', mention: null, hasContact: false, addedByEditors: false, ...o })
const DIR: NotaryDirectory = {
  totalEntries: 423, activeEntries: 422, addedEntries: 0, provenance: null, unmatched: [],
  tpis: [{ id: 'court-tpi-tpi-de-port-au-prince', name: 'TPI de Port-au-Prince', label: 'Port-au-Prince', total: 1, communes: [{ id: 'commune-ouest-port-au-prince', name: 'Port-au-Prince', department: 'Ouest', notaires: [{ ...VUE(), printedDepartment: null }] }] }],
}
const LIEN = '/fr/juridictions/notaires/demande'

describe('liens discrets vers le formulaire', () => {
  it('formulaire FERMÉ (défaut) : aucun lien sur la page du notaire, la fiche de commune ni la liste', () => {
    const html = [
      renderToStaticMarkup(<NotaryProfileView p={PROFIL} locale="fr" t={t} />),
      renderToStaticMarkup(<NotariesSection notaires={[VUE()]} provenance={null} tpiId={null} locale="fr" t={t} />),
      renderToStaticMarkup(<NotaryDirectoryView dir={DIR} locale="fr" t={t} />),
    ].join('')
    expect(html).not.toContain(LIEN)
  })
  it('ouvert : « Vous êtes ce notaire ? » sur sa page (notaire pré-choisi), « absent de la liste ? » ailleurs', () => {
    const profil = renderToStaticMarkup(<NotaryProfileView p={PROFIL} locale="fr" t={t} demandes />)
    expect(profil).toContain(`href="${LIEN}?notaire=mjsp-2026-09-08-11"`)
    expect(profil).toContain(j.notaryRequestLinkContact.replace('’', '’'))
    const section = renderToStaticMarkup(<NotariesSection notaires={[]} provenance={null} tpiId={null} locale="fr" t={t} demandes />)
    expect(section).toContain(`href="${LIEN}?type=inscription"`)
    const liste = renderToStaticMarkup(<NotaryDirectoryView dir={DIR} locale="fr" t={t} demandes />)
    expect(liste).toContain(`href="${LIEN}?type=inscription"`)
  })
})

describe('le formulaire', () => {
  const rendu = (o: Partial<Parameters<typeof NotaryRequestForm>[0]> = {}) => renderToStaticMarkup(
    <NotaryRequestForm
      locale="fr" l={libellesDemande(t)} renderedAt={1_760_000_000_000}
      verification={{ siteKey: '1x00000000000000000000AA', action: 'notary-request', langue: 'fr', nonce: 'n0nce' }} notary={null} erreurs={[]} type="coordonnees"
      communes={[{ id: 'commune-nord-port-margot', name: 'Port-Margot', department: 'Nord' }]}
      {...o}
    />,
  )
  it('POST classique vers la route publique, heure d’affichage et champ piège invisible hors tabulation', () => {
    const html = rendu()
    expect(html).toContain(`method="post" action="${NOTARY_REQUEST_ACTION}"`)
    expect(html).toContain('name="t" value="1760000000000"')
    expect(html).toMatch(/<div aria-hidden="true" class="absolute -left-\[10000px\][^"]*"><label>Site web<input type="text" name="site" tabindex="-1"[^>]*value=""\/>/)
    expect(html).toMatch(/name="consentement" required="" [^>]*value="oui"/)
    expect(html).toContain('<option value="commune-nord-port-margot">Port-Margot (Nord)</option>')
  })
  const VICTOR = { id: 'mjsp-2026-09-08-11', name: 'Patrick VICTOR', communeId: 'commune-ouest-port-au-prince' }
  const COMMUNES = [
    { id: 'commune-nord-port-margot', name: 'Port-Margot', department: 'Nord' },
    { id: 'commune-ouest-port-au-prince', name: 'Port-au-Prince', department: 'Ouest' },
  ]
  it('notaire pré-choisi : nom affiché UNE fois, identifiant et objet en champs cachés, plus de choix d’objet ni de « nom du notaire »', () => {
    const html = rendu({ notary: VICTOR, communes: COMMUNES })
    expect(html).toContain('name="notaire" value="mjsp-2026-09-08-11"')
    expect(html).toContain('<input type="hidden" name="type" value="coordonnees"/>')
    expect(html).not.toContain('type="radio" name="type"')
    expect(html.split('Patrick VICTOR').length - 1).toBe(1)
    expect(html).not.toContain('name="nomNotaire"')
  })
  it('notaire pré-choisi : sa commune de commission est PRÉREMPLIE, et reste modifiable', () => {
    const html = rendu({ notary: VICTOR, communes: COMMUNES })
    expect(html).toContain('<option value="commune-ouest-port-au-prince" selected="">Port-au-Prince (Ouest)</option>')
    expect(html).toContain('<option value="commune-nord-port-margot">Port-Margot (Nord)</option>')
  })
  it('sans notaire : le parcours d’origine garde le choix de l’objet et le nom à saisir, aucune commune présélectionnée', () => {
    const html = rendu()
    expect(html).toMatch(/type="radio" name="type"[^>]*value="coordonnees"/)
    expect(html).toMatch(/type="radio" name="type"[^>]*value="inscription"/)
    expect(html).toContain('name="nomNotaire"')
    expect(html).toContain('<option value="" selected="">')
  })
  it('trois blocs numérotés, titres en clair ; courriel PUBLIC de l’étude et courriel PRIVÉ du demandeur bien distincts', () => {
    const html = rendu({ notary: VICTOR, communes: COMMUNES })
    for (const [id, n, titre] of [['bloc-objet', 1, j.notaryRequestType], ['bloc-etude', 2, j.notaryRequestContactSection], ['bloc-vous', 3, j.notaryRequestYou]] as const) {
      expect(html).toMatch(new RegExp(`<h2 id="${id}"[^>]*><span aria-hidden="true"[^>]*>${n}</span>${titre.replace(/[’']/g, '.')}</h2>`))
    }
    expect(html).toContain(j.notaryRequestContactHint)
    expect(html).toContain(j.notaryRequestYouHint)
    expect(html).toMatch(new RegExp(`${j.notaryRequestOfficeEmail.replace(/[’']/g, '.')}<input name="courriel" type="email"`))
    expect(html).toMatch(new RegExp(`${j.notaryRequestReplyEmail}<input name="courrielContact" type="email"[^>]*aria-describedby="bloc-vous-note"`))
  })
  it('« Précisez votre qualité » n’apparaît que pour « Autre » (ou quand il faut le corriger)', () => {
    expect(rendu()).not.toContain('name="qualiteAutre"')
    expect(rendu({ erreurs: ['qualiteAutre'] })).toMatch(/<input name="qualiteAutre" required=""/)
  })
  it('bouton principal : bleu encre, pleine largeur, « Envoyer la demande »', () => {
    expect(rendu()).toMatch(new RegExp(`<button type="submit" class="[^"]*\\bw-full\\b[^"]*bg-wouj[^"]*text-white[^"]*">${j.notaryRequestSubmit}</button>`))
  })
  it('erreurs : des phrases, sans doublon ; un code inconnu (URL bricolée) est ignoré', () => {
    const html = rendu({ erreurs: ['telephones', 'telephones', '<script>', 'constructor'] })
    expect(html).toContain('Erreur —')
    // Une fois dans le résumé, une fois sous le champ — le doublon de l'URL ne compte pas.
    expect(html.split(j.notaryRequestErrTelephones).length - 1).toBe(2)
    expect(html).not.toContain('&lt;script&gt;')
    expect(html).not.toContain('constructor')
  })
  it('aucune erreur : pas de bandeau', () => {
    expect(rendu()).not.toContain('Erreur —')
  })
  it('chaque erreur s’affiche AUSSI sous son champ, reliée par aria-describedby, champ marqué invalide', () => {
    const html = rendu({ erreurs: ['telephones', 'consentement'] })
    expect(html).toMatch(/<input name="telephones"[^>]*aria-invalid="true"[^>]*aria-describedby="err-telephones aide-telephones"/)
    expect(html).toContain(`<span id="err-telephones" class="mt-1.5 block text-body-sm font-medium text-wouj">${j.notaryRequestErrTelephones}</span>`)
    expect(html).toMatch(/name="consentement"[^>]*aria-invalid="true"[^>]*aria-describedby="err-consentement"/)
    // Sans erreur : ni aria-invalid ni message.
    expect(rendu()).not.toContain('aria-invalid')
  })
  it('vérification humaine : intitulé, conteneur du widget, mention Cloudflare, UN SEUL lien vers la politique (celui du consentement), avis sans JavaScript', () => {
    const html = rendu()
    expect(html).toContain(`>${j.humanCheckTitle}</p>`)
    expect(html).toMatch(/<div class="mt-2 min-h-\[65px\]" aria-describedby="aide-verification"><\/div>/)
    expect(html).toContain(`>${j.humanCheckNotice}</p>`)
    expect(html.split('href="/fr/confidentialite"').length - 1).toBe(1)
    expect(html).toContain('<noscript>')
    // Le widget est AVANT le bouton d'envoi.
    expect(html.indexOf('aide-verification')).toBeLessThan(html.indexOf(j.notaryRequestSubmit))
  })
  it('échec de la vérification : message sous le widget, relié à lui, et dans le résumé', () => {
    const html = rendu({ erreurs: ['humain'] })
    expect(html).toContain('aria-describedby="aide-verification err-humain"')
    expect(html).toContain(`<span id="err-humain" class="mt-1.5 block text-body-sm font-medium text-wouj">${j.notaryRequestErrHumain}</span>`)
    expect(html.split(j.notaryRequestErrHumain).length - 1).toBe(2)
  })
  it('les trois langues ont tous les libellés', () => {
    for (const l of ['fr', 'en', 'ht'] as const) {
      const d = getDictionary(l).judicial
      for (const k of Object.keys(d).filter((x) => x.startsWith('notaryRequest'))) {
        expect((d as Record<string, string>)[k], `${l}.${k}`).toBeTruthy()
      }
    }
  })
})

describe('coordonnées issues de la demande d’un tiers', () => {
  it('la ligne de provenance dit qu’elles viennent de l’étude et ont été vérifiées', () => {
    const contact = { address: '14 rue Marcadieux', phones: [], email: null, upToDateOn: '2026-10-09' }
    const via = renderToStaticMarkup(<NotaryProfileView p={{ ...PROFIL, contact: { ...contact, viaRequest: true } }} locale="fr" t={t} />)
    expect(via).toContain('Coordonnées communiquées par l’étude, vérifiées par la rédaction d’Agora, à jour au 9 octobre 2026.')
    const directe = renderToStaticMarkup(<NotaryProfileView p={{ ...PROFIL, contact: { ...contact, viaRequest: false } }} locale="fr" t={t} />)
    expect(directe).toContain('Coordonnées communiquées à la rédaction d’Agora, à jour au 9 octobre 2026.')
  })
})

describe('notaire ajouté par la rédaction (hors liste du MJSP)', () => {
  it('sa page le dit, avec la date de vérification — pas de ligne « liste du MJSP »', () => {
    const html = renderToStaticMarkup(<NotaryProfileView p={{ ...PROFIL, id: 'tiers-20261009-1', provenance: null, addedByEditors: { verifiedOn: '2026-10-09' } }} locale="fr" t={t} />)
    expect(html).toContain('Notaire absent de la liste du MJSP, ajouté par la rédaction d’Agora après vérification, le 9 octobre 2026.')
    expect(html).not.toContain('Liste publiée par le ministère')
  })
  it('dans les listes : mention « ajouté par la rédaction » ; le compte de la liste reste celui du MJSP', () => {
    const section = renderToStaticMarkup(<NotariesSection notaires={[VUE({ id: 'tiers-20261009-1', addedByEditors: true })]} provenance={null} tpiId={null} locale="fr" t={t} />)
    expect(section).toContain(`· ${j.notaryAddedBadge}`)
    const liste = renderToStaticMarkup(<NotaryDirectoryView dir={{ ...DIR, addedEntries: 1 }} locale="fr" t={t} />)
    expect(liste).toContain('422 inscriptions affichées sur les 423 de la liste.')
    expect(liste).toContain('S’y ajoute 1 notaire absent de la liste, inscrit par la rédaction après vérification.')
  })
})
