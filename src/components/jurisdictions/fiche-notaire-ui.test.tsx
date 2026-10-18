/**
 * La fiche d'un notaire en fenêtre modale — rendu (serveur) du contenu PARTAGÉ et de la modale :
 * identité, badge lié à une confirmation valide, coordonnées absentes ou multiples, liens `tel:` /
 * `mailto:`, copie, crayon discret, dialogue accessible, fermeture sans JavaScript, états.
 * Valeurs FICTIVES (dépôt public).
 */
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

let recherche = 'vue=notaires&q=port&page=2&notaire=mjsp-2026-09-08-11'
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/fr/juridictions',
  useSearchParams: () => new URLSearchParams(recherche),
}))
const { FicheNotaire } = await import('./FicheNotaire')
const { FicheNotaireModale } = await import('./FicheNotaireModale')
const { libellesFiche, libellesModale } = await import('./fiche-libelles')
const { getDictionary } = await import('@/lib/i18n/dictionaries')
import type { FicheNotairePublique } from '@/lib/jurisdictions/fiche-notaire'

const t = getDictionary('fr')
const FICHE: FicheNotairePublique = {
  id: 'mjsp-2026-09-08-11', name: 'Jean EXEMPLE', printedName: null, mention: null,
  commune: { id: 'commune-ouest-port-au-prince', name: 'Port-au-Prince', department: 'Ouest' },
  sourceCommune: 'PORT-AU-PRINCE', jurisdiction: { id: 'court-tpi-pap', label: 'Port-au-Prince' },
  contact: { address: '10, Rue Exemple, Port-au-Prince', phones: ['+50920000001', '+50930000002'], emails: ['etude@exemple.ht', 'accueil@exemple.ht'], upToDateOn: '2026-10-18' },
  confirmedOn: null,
}
const fiche = (o: Partial<FicheNotairePublique> = {}, demandes = true) =>
  renderToStaticMarkup(<FicheNotaire fiche={{ ...FICHE, ...o }} locale="fr" l={libellesFiche(t)} demandes={demandes} />)

describe('contenu de la fiche (partagé : fenêtre modale et page de repli)', () => {
  it('identité : le nom réel, la COMMUNE DE COMMISSION (ni l’adresse ni la juridiction)', () => {
    const html = fiche()
    expect(html).toMatch(/<h3 id="ag-fiche-nom"[^>]*><span[^>]*>Jean EXEMPLE<\/span>/)
    expect(html).toContain('Commune de commission : Port-au-Prince')
    expect(html).not.toContain('Juridiction')
  })
  it('SANS confirmation valide : ni coche, ni « Confirmé », ni date', () => {
    const html = fiche()
    expect(html).not.toContain(t.judicial.notaryConfirmedTooltip)
    expect(html).not.toContain('>Confirmé<')
    expect(html).not.toContain('Informations confirmées le')
  })
  it('AVEC confirmation valide : coche nommée juste après le nom, pastille « Confirmé », UNE ligne datée — pas d’encart', () => {
    const html = fiche({ confirmedOn: '2026-10-18' })
    expect(html).toMatch(/Jean EXEMPLE<\/span><span[^>]*><span class="relative[^"]*"><button type="button" aria-label="Informations confirmées par le notaire\."/)
    expect(html).toMatch(/bg-\[#E9EDE7\][^"]*">Confirmé<\/span>/)
    expect(html).toContain('Informations confirmées le 18 octobre 2026')
    // L'infobulle n'est pas affichée d'office (survol, focus, toucher seulement).
    expect((html.match(/Informations confirmées par le notaire\./g) ?? []).length).toBe(1)
    expect(html).not.toContain(t.judicial.notaryConfirmedOn.replace('{date}', '18 octobre 2026'))
  })
  it('coordonnées MULTIPLES : chaque numéro (`tel:`, « Appeler ») et chaque courriel (`mailto:`, « Écrire »), rien de tronqué', () => {
    const html = fiche()
    expect(html).toContain('href="tel:+50920000001"')
    expect(html).toContain('href="tel:+50930000002"')
    expect(html).toContain('aria-label="Appeler le +509 2000-0001"')
    expect(html).toContain('aria-label="Appeler le +509 3000-0002"')
    expect((html.match(/>Appeler<\/a>/g) ?? []).length).toBe(2)
    expect(html).toContain('href="mailto:etude@exemple.ht"')
    expect(html).toContain('href="mailto:accueil@exemple.ht"')
    expect(html).toContain('aria-label="Écrire à accueil@exemple.ht"')
    expect((html.match(/>Écrire<\/a>/g) ?? []).length).toBe(2)
    // Adresse : copie nommée, retour annoncé (région vivante).
    expect(html).toContain('aria-label="Copier l’adresse"')
    expect(html).toMatch(/role="status" aria-live="polite"/)
    expect(html).toContain('id="ag-fiche-adresse"')
  })
  it('lignes ABSENTES masquées ; aucune coordonnée : UNE seule phrase', () => {
    const sansTel = fiche({ contact: { address: null, phones: [], emails: ['etude@exemple.ht'], upToDateOn: null } })
    expect(sansTel).not.toContain('Téléphone')
    expect(sansTel).not.toContain('Adresse')
    expect(sansTel).toContain('Courriel')
    const rien = fiche({ contact: null })
    expect(rien).toContain('Aucune coordonnée disponible pour le moment.')
    expect(rien).not.toMatch(/tel:|mailto:|Copier/)
  })
  it('crayon DISCRET (formulaire ouvert) : 44 px, nommé, infobulle ; jamais de grand bouton ni de suivi de demande', () => {
    const html = fiche()
    expect(html).toMatch(/<a href="\/fr\/juridictions\/notaires\/demande\?notaire=mjsp-2026-09-08-11" aria-label="Demander une modification ou une confirmation" title="Demander une modification ou une confirmation" class="[^"]*h-11 w-11/)
    expect(html).not.toMatch(/Votre demande|En attente de validation|Voir ma demande|Maquette|données illustratives/)
    expect(fiche({}, false)).not.toContain('Demander une modification')
  })
})

const modale = (initial: Parameters<typeof FicheNotaireModale>[0]['initial'], contexte: 'onglet' | 'page' | 'juridictions' = 'onglet') =>
  renderToStaticMarkup(
    <FicheNotaireModale locale="fr" l={libellesModale(t)} demandes contexte={contexte} initial={initial} titres={{ page: 'Annuaire', fiche: '{name} — notaire' }} />,
  )

describe('fenêtre modale (rendu serveur : lien direct, sans JavaScript)', () => {
  it('dialogue accessible : nom = titre « Notaire », modal, focusable', () => {
    const html = modale({ statut: 'ok', id: FICHE.id, fiche: FICHE })
    expect(html).toMatch(/role="dialog" aria-modal="true" aria-labelledby="ag-fiche-titre"/)
    expect(html).toMatch(/<h2 id="ag-fiche-titre"[^>]*>Notaire<\/h2>/)
    expect(html).toContain('tabindex="-1"')
    expect(html).toContain('Jean EXEMPLE')
  })
  it('FERMER sans JavaScript : la croix et « Fermer » mènent à l’annuaire tel qu’il était (recherche et page gardées)', () => {
    const html = modale({ statut: 'ok', id: FICHE.id, fiche: FICHE })
    expect(html).toContain('href="/fr/juridictions?vue=notaires&amp;q=port&amp;page=2" aria-label="Fermer la fiche" title="Fermer la fiche"')
    expect(html).toMatch(/href="\/fr\/juridictions\?vue=notaires&amp;q=port&amp;page=2" class="[^"]*">Fermer<\/a>/)
  })
  it('action cartographique : « Voir la commune sur la carte → » (jamais « Localiser l’étude » : aucune étude n’est géolocalisée)', () => {
    const html = modale({ statut: 'ok', id: FICHE.id, fiche: FICHE })
    expect(html).toContain('href="/fr/juridictions?vue=notaires&amp;q=port&amp;commune=commune-ouest-port-au-prince&amp;carte=1#ag-carte-notaires-mobile"')
    expect(html).toContain('Voir la commune sur la carte <span aria-hidden="true">→</span>')
    expect(html).not.toContain('Localiser l’étude')
    expect(modale({ statut: 'ok', id: FICHE.id, fiche: { ...FICHE, commune: null } })).not.toContain('Voir la commune sur la carte')
  })
  it('états : chargement discret, fiche INTROUVABLE, PANNE distincte avec « Réessayer » — la fermeture toujours là', () => {
    const chargement = modale({ statut: 'chargement', id: FICHE.id })
    expect(chargement).toContain('Chargement de la fiche…')
    expect(chargement).toContain('aria-busy="true"')
    const introuvable = modale({ statut: 'introuvable', id: FICHE.id })
    expect(introuvable).toContain('Fiche introuvable')
    expect(introuvable).not.toContain('Réessayer')
    const erreur = modale({ statut: 'erreur', id: FICHE.id })
    expect(erreur).toContain('La fiche n’a pas pu être chargée.')
    expect(erreur).toContain('>Réessayer</button>')
    for (const h of [chargement, introuvable, erreur]) expect(h).toContain('aria-label="Fermer la fiche"')
  })
  it('aucune fiche demandée : rien d’affiché', () => {
    recherche = 'vue=notaires&q=port'
    expect(modale({ statut: 'fermee' })).toBe('<div hidden=""></div>')
    recherche = 'vue=notaires&q=port&page=2&notaire=mjsp-2026-09-08-11'
  })
  it('trois langues', () => {
    for (const lang of ['en', 'ht'] as const) {
      const d = getDictionary(lang)
      const html = renderToStaticMarkup(
        <FicheNotaireModale locale={lang} l={libellesModale(d)} demandes contexte="onglet" initial={{ statut: 'ok', id: FICHE.id, fiche: FICHE }} titres={{ page: 'x', fiche: '{name}' }} />,
      )
      expect(html).toContain(`>${d.judicial.notaryPageTitle}</h2>`)
      expect(html).toContain(`aria-label="${d.judicial.ficheCloseLabel}"`)
      expect(html).toContain(`>${d.judicial.ficheCall}</a>`)
    }
  })
})
