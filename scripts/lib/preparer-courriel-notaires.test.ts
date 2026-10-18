/**
 * Préparation du courriel aux notaires — le lien personnalisé et le BLOCAGE. Valeurs FICTIVES.
 */
import { describe, expect, it } from 'vitest'
import { lireCsvDestinataires, preparerEnvoi, verifierModele } from './preparer-courriel-notaires'
import type { NotaireRef } from './import-notaires-docx'

const N: NotaireRef[] = [
  { id: 'mjsp-2026-09-08-11', fullName: 'Jean EXEMPLE', displayName: null, active: true, communeName: 'Port-au-Prince' },
  { id: 'mjsp-2026-09-08-20', fullName: 'Marie MODELE', displayName: null, active: true, communeName: 'Jacmel' },
  { id: 'mjsp-2026-09-08-21', fullName: 'Marie MODELE', displayName: null, active: true, communeName: 'Léogâne' },
  { id: 'mjsp-2026-09-08-30', fullName: 'Paul FICTIF', displayName: 'Paul FICTIF-NOM', active: true, communeName: 'Cap-Haïtien' },
  { id: 'mjsp-2026-09-08-37', fullName: 'Ancien RETIRE', displayName: null, active: false, communeName: 'Hinche' },
]

describe('préparation du courriel — lien de LA fiche du destinataire', () => {
  it('rapprochement EXACT : le lien ouvre l’annuaire sur SA fiche, construit de l’identifiant en base ; le nom affiché sert à {{nom}}', () => {
    const { prets, bloques } = preparerEnvoi([
      { ligne: 1, courriel: 'etude@exemple.ht', nom: 'EXEMPLE Jean' },
      { ligne: 2, courriel: 'accueil@exemple.ht', nom: '', notaryId: 'mjsp-2026-09-08-30' },
    ], N)
    expect(bloques).toEqual([])
    expect(prets).toEqual([
      { courriel: 'etude@exemple.ht', nom: 'Jean EXEMPLE', notaryId: 'mjsp-2026-09-08-11', lien_fiche_notaire: 'https://agora.ht/fr/juridictions?vue=notaires&notaire=mjsp-2026-09-08-11' },
      { courriel: 'accueil@exemple.ht', nom: 'Paul FICTIF-NOM', notaryId: 'mjsp-2026-09-08-30', lien_fiche_notaire: 'https://agora.ht/fr/juridictions?vue=notaires&notaire=mjsp-2026-09-08-30' },
    ])
    // Aucune donnée privée dans le lien.
    for (const p of prets) expect(p.lien_fiche_notaire).not.toMatch(/@|%40|courriel|tel/)
  })
  it('AMBIGU (homonymes, inscriptions multiples) : bloqué, avec les candidats — aucune fusion, aucun choix d’office', () => {
    const { prets, bloques } = preparerEnvoi([{ ligne: 4, courriel: 'marie@exemple.ht', nom: 'Marie MODELE' }], N)
    expect(prets).toEqual([])
    expect(bloques[0]).toMatchObject({ ligne: 4, motif: expect.stringMatching(/AMBIGU : 2 inscriptions.*mjsp-2026-09-08-20.*mjsp-2026-09-08-21/) })
    // L'identifiant donné LÈVE l'ambiguïté.
    expect(preparerEnvoi([{ ligne: 4, courriel: 'marie@exemple.ht', nom: 'Marie MODELE', notaryId: 'mjsp-2026-09-08-21' }], N).bloques).toEqual([])
  })
  it('incertain, inconnu, retiré, nom contredisant l’identifiant, courriel illisible ou en double : bloqués', () => {
    const { bloques } = preparerEnvoi([
      { ligne: 1, courriel: 'a@exemple.ht', nom: 'Jean EXEMPL' },
      { ligne: 2, courriel: 'b@exemple.ht', nom: 'Personne INCONNUE' },
      { ligne: 3, courriel: 'c@exemple.ht', nom: '', notaryId: 'mjsp-2026-09-08-37' },
      { ligne: 4, courriel: 'd@exemple.ht', nom: 'Paul FICTIF-NOM', notaryId: 'mjsp-2026-09-08-11' },
      { ligne: 5, courriel: 'pas-un-courriel', nom: 'Jean EXEMPLE' },
      { ligne: 6, courriel: 'e@exemple.ht', nom: 'Jean EXEMPLE' },
      { ligne: 7, courriel: 'E@exemple.ht', nom: 'Jean EXEMPLE' },
      { ligne: 8, courriel: 'f@exemple.ht', nom: '' },
    ], N)
    expect(bloques.map((b) => b.ligne)).toEqual([1, 2, 3, 4, 5, 7, 8])
    expect(bloques.find((b) => b.ligne === 1)?.motif).toMatch(/rapprochement variante|rapprochement probable|rapprochement/)
    expect(bloques.find((b) => b.ligne === 3)?.motif).toMatch(/inconnu ou retiré/)
    expect(bloques.find((b) => b.ligne === 4)?.motif).toMatch(/ne correspond pas/)
    expect(bloques.find((b) => b.ligne === 7)?.motif).toMatch(/en double/)
  })
  it('le MODÈLE : {{lien_fiche_notaire}} et {{nom}} présents, le bouton pointe vers la variable — jamais un lien en dur', () => {
    const bon = '<p>Maître {{nom}},</p><a href="{{lien_fiche_notaire}}" style="x">Consulter mes informations &nbsp; →</a>'
    expect(verifierModele(bon)).toEqual([])
    expect(verifierModele(bon.replace('{{lien_fiche_notaire}}', 'https://agora.ht/fr/juridictions?vue=notaires'))).toEqual(expect.arrayContaining([
      'variable {{lien_fiche_notaire}} absente',
      expect.stringMatching(/pointe vers « https:\/\/agora\.ht/),
    ]))
    expect(verifierModele('<a href="{{lien_fiche_notaire}}">Voir</a>')).toEqual(expect.arrayContaining(['variable {{nom}} absente', 'bouton « Consulter mes informations » introuvable']))
  })
  it('CSV : `;` ou `,`, guillemets, en-tête reconnu', () => {
    expect(lireCsvDestinataires('courriel;nom;notaryId\n"a@exemple.ht";"EXEMPLE, Jean";\nb@exemple.ht;;mjsp-2026-09-08-30\n')).toEqual([
      { ligne: 1, courriel: 'a@exemple.ht', nom: 'EXEMPLE, Jean', notaryId: null },
      { ligne: 2, courriel: 'b@exemple.ht', nom: '', notaryId: 'mjsp-2026-09-08-30' },
    ])
    expect(() => lireCsvDestinataires('nom\nx')).toThrow(/courriel/)
  })
})
