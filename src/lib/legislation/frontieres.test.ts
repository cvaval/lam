/**
 * Frontières entre rubriques dans l'arbre des thèmes.
 *
 * Défaut signalé par la rédaction le 15 sept. 2026 : la carte « Répertoire alphabétique
 * (Salès, 1963-1989) » — la racine des notions de la JURISPRUDENCE — s'affichait dans la
 * Législation annotée. La rubrique parcourt l'arbre entier et n'élague que les branches VIDES
 * pour son corpus ; le jour où treize textes de loi ont été rattachés aux notions qu'ils
 * portent, la branche n'était plus vide, et la frontière — qui n'avait jamais été déclarée,
 * seulement constatée — a cédé. « Le répertoire de Me Salès est uniquement pour la section
 * sur la jurisprudence. »
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { DOC_TYPE_META, racinesReserveesHors } from '../brand'
import { sansSousArbres, sousArbres, type ThemeNode } from './themes'

const noeud = (slug: string, children: ThemeNode[] = []): ThemeNode =>
  ({ id: slug, slug, labelFr: slug, labelEn: null, labelHt: null, parentId: null, position: 0, active: true, color: null, icon: null, children }) as unknown as ThemeNode

const arbre: ThemeNode[] = [
  noeud('droit-prive', [noeud('droit-civil', [noeud('procedure-civile')])]),
  noeud('economique', [noeud('droit-bancaire', [noeud('brh-matiere', [noeud('brh-reserves')]), noeud('brh-assujetti')])]),
  noeud('jurisprudence-sales', [noeud('jfs-lettre-a', [noeud('jfs-acquiescement')])]),
]

describe('une racine déclarée par une rubrique lui appartient', () => {
  it('la Législation annotée ne déclare rien : tout l’arbre, MOINS ce que les autres se sont réservé', () => {
    const reservees = racinesReserveesHors(DOC_TYPE_META.DOCTRINE.slug)
    expect(reservees).toContain('jurisprudence-sales')
    expect(reservees).toContain('brh-matiere')
    expect(reservees).toContain('brh-assujetti')
    expect(reservees).not.toContain('droit-prive')
  })
  it('la jurisprudence garde sa propre racine — elle n’est réservée qu’aux AUTRES', () => {
    expect(racinesReserveesHors(DOC_TYPE_META.JURISPRUDENCE.slug)).not.toContain('jurisprudence-sales')
    expect(racinesReserveesHors(DOC_TYPE_META.JURISPRUDENCE.slug)).toContain('brh-matiere')
  })
})

describe('sansSousArbres retire à N’IMPORTE QUELLE profondeur, et ne touche à rien d’autre', () => {
  const prive = sansSousArbres(arbre, racinesReserveesHors(DOC_TYPE_META.DOCTRINE.slug))
  const slugs = (nodes: ThemeNode[]): string[] => nodes.flatMap((n) => [n.slug, ...slugs(n.children)])
  it('la racine du Répertoire disparaît, avec ses lettres et ses notions', () => {
    expect(slugs(prive)).not.toContain('jurisprudence-sales')
    expect(slugs(prive)).not.toContain('jfs-lettre-a')
    expect(slugs(prive)).not.toContain('jfs-acquiescement')
  })
  it('les axes de la BRH, au TROISIÈME niveau, disparaissent aussi — leur parent reste', () => {
    expect(slugs(prive)).not.toContain('brh-matiere')
    expect(slugs(prive)).not.toContain('brh-reserves')
    expect(slugs(prive)).toContain('droit-bancaire')
  })
  it('Droit privé › Droit civil › Procédure civile est intact', () => {
    expect(slugs(prive)).toEqual(expect.arrayContaining(['droit-prive', 'droit-civil', 'procedure-civile']))
  })
  it('miroir de sousArbres : prendre puis retirer les mêmes racines ne laisse rien', () => {
    const pris = sousArbres(arbre, ['jurisprudence-sales'])
    expect(sansSousArbres(pris, ['jurisprudence-sales'])).toEqual([])
  })
  it('sans rien à retirer, l’arbre est rendu tel quel', () => {
    expect(slugs(sansSousArbres(arbre, []))).toEqual(slugs(arbre))
  })
})

describe('les deux parcours de l’arbre entier appliquent la règle', () => {
  it('la page de la Législation annotée passe les racines réservées à navigationThemes', () => {
    const page = readFileSync('src/app/[locale]/(app)/legislationannotee/page.tsx', 'utf8')
    expect(page).toMatch(/racinesExclues:\s*racinesReserveesHors\(META\.slug\)/)
  })
  it('le menu « Domaine » de la recherche les saute — « A », « B », « C » ne sont pas des matières', () => {
    const page = readFileSync('src/app/[locale]/(app)/search/page.tsx', 'utf8')
    expect(page).toMatch(/racinesReserveesHors\(DOC_TYPE_META\.DOCTRINE\.slug\)/)
    expect(page).toMatch(/if \(reserves\.has\(t\.slug\)\) continue/)
  })
  it('navigationThemes retire les racines exclues quand aucune racine n’est déclarée', () => {
    const src = readFileSync('src/lib/legislation/themes.ts', 'utf8')
    expect(src).toMatch(/sansSousArbres\(arbreComplet, opts\.racinesExclues \?\? \[\]\)/)
  })
})
