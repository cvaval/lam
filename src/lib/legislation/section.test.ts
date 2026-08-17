/**
 * Périmètre de la section « Législation annotée ».
 *
 * Défaut signalé par la rédaction le 17 août 2026 : des ARRÊTS s'affichaient dans la
 * navigation par thèmes de la Législation annotée. Le filtre ne portait que sur l'ACCÈS de
 * l'utilisateur — or l'accès dit ce qu'on a le DROIT de lire, jamais ce qu'une section DOIT
 * montrer. Un membre du personnel, qui a droit à tout, voyait donc tout.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { corpusForSlug, corpusForType } from '../types'
import { typesDeLaSection, TYPES_LEGISLATION_ANNOTEE } from './themes'

const staff = { role: 'MASTER_ADMIN', services: [] } as never
const avocat = { role: 'PRO', services: ['LEGISLATION', 'JURISPRUDENCE'] } as never

describe('périmètre de la Législation annotée', () => {
  it('la jurisprudence n’y figure pas — elle a sa propre rubrique', () => {
    expect(TYPES_LEGISLATION_ANNOTEE).not.toContain('JURISPRUDENCE')
    expect(typesDeLaSection(staff)).not.toContain('JURISPRUDENCE')
  })

  it('le personnel, qui a droit à TOUT, ne voit ici que le corpus de la section', () => {
    // C'est le cœur du défaut : avoir le droit de tout lire ne fait pas tout apparaître ici.
    expect(typesDeLaSection(staff).sort()).toEqual(['DOCTRINE', 'LEGISLATION'])
  })

  it('les circulaires de la BRH n’y figurent pas non plus — elles ont leur rubrique', () => {
    // Retirées le 17 août 2026 sur décision de la rédaction, par la même raison que la
    // jurisprudence. Leur classement thématique reste atteignable depuis la recherche.
    expect(TYPES_LEGISLATION_ANNOTEE).not.toContain('CIRCULAIRE_BRH')
  })

  it('un abonné ne voit que l’intersection de son accès et du périmètre', () => {
    // Il a droit à la jurisprudence, mais pas ICI : la section ne la porte pas.
    expect(typesDeLaSection(avocat)).toEqual(['LEGISLATION'])
  })

  it('la législation et la doctrine sont le cœur de la section', () => {
    expect(TYPES_LEGISLATION_ANNOTEE).toContain('LEGISLATION')
    expect(TYPES_LEGISLATION_ANNOTEE).toContain('DOCTRINE')
  })
})

describe('le corpus s’applique au chemin du CLIC, pas seulement aux compteurs', () => {
  /**
   * La première correction du 17 août avait aligné les compteurs et les vues à plat, mais
   * PAS `documentsInTheme` — qui est pourtant la fonction appelée quand on clique un thème,
   * c'est-à-dire exactement la vue où le défaut avait été signalé. Les arrêts continuaient
   * de s'afficher, et le badge annonçait désormais MOINS que la liste : la divergence
   * s'était inversée. Rien ne l'a vu, parce qu'aucun test ne portait sur cette fonction.
   *
   * Ce contrôle est structurel — il lit la source — parce que l'alternative exigerait une
   * base de données. Il vérifie le point précis qui a manqué : que la fonction sache
   * restreindre au corpus, et que la route de la rubrique le lui demande.
   */
  const themes = readFileSync('src/lib/legislation/themes.ts', 'utf8')
  const route = readFileSync('src/app/api/legislation/theme-docs/route.ts', 'utf8')

  it('documentsInTheme accepte un corpus', () => {
    expect(themes).toMatch(/corpus\?: readonly DocType\[\]/)
  })

  it('le corpus RESTREINT l’accès, il ne l’élargit jamais', () => {
    // L'intersection est la seule forme sûre : un corpus ne doit pas pouvoir ouvrir un type
    // que l'abonnement refuse. C'est pourquoi on filtre accessibleTypes PAR le corpus,
    // et non l'inverse.
    expect(themes).toMatch(/accessibleTypes\(user\)\.filter\(/)
  })

  it('la route de la rubrique passe le corpus de la Législation annotée', () => {
    expect(route).toContain('TYPES_LEGISLATION_ANNOTEE')
    expect(route).toMatch(/documentsInTheme\([^)]*corpus:/s)
  })
})

describe('un nom de rubrique se résout en son CORPUS, jamais en un seul type', () => {
  /**
   * Défaut mesuré le 17 août 2026 : le lien « Rechercher dans toute la législation annotée »
   * portait ?type=legislationannotee, résolu en l'unique DocType DOCTRINE — soit une recherche
   * dans 2 documents sur 3 136. La page répondait, et répondait à côté : une page presque vide
   * ressemble à une absence de résultats, jamais à une panne.
   *
   * Même racine que le défaut des thèmes : une rubrique n'est pas un type.
   */
  it('« legislationannotee » ouvre sur la législation ET la doctrine', () => {
    expect(corpusForSlug('legislationannotee')?.sort()).toEqual(['DOCTRINE', 'LEGISLATION'])
  })

  it('l’ancien slug et le numéro de rubrique donnent le MÊME corpus', () => {
    // Les favoris et les liens anciens (?type=doctrine) ne doivent pas chercher ailleurs
    // que la rubrique d'aujourd'hui.
    expect(corpusForSlug('doctrine')).toEqual(corpusForSlug('legislationannotee'))
  })

  it('un DocType en clair suit la MÊME règle — pas d’exception subtile', () => {
    // Une règle qui ne vaudrait que pour le slug ferait diverger la page (qui résout le
    // slug avant d'interroger), l'API (qui reçoit le slug) et les alertes (qui stockent
    // le type) : ce serait refabriquer ailleurs le défaut qu'on corrige.
    expect(corpusForType('DOCTRINE')).toEqual(corpusForSlug('legislationannotee'))
  })

  it('une rubrique sans corpus déclaré ne liste que son propre type', () => {
    // Repli ÉTROIT : on affiche trop peu, ce qui se voit, plutôt que trop, ce qui ne se voit pas.
    expect(corpusForType('JURISPRUDENCE')).toEqual(['JURISPRUDENCE'])
    expect(corpusForType('CIRCULAIRE_BRH')).toEqual(['CIRCULAIRE_BRH'])
  })

  it('un slug inconnu ne se résout pas — l’appelant retombe sur les services accordés', () => {
    expect(corpusForSlug('rubrique-qui-nexiste-pas')).toBeUndefined()
  })

  it('les trois appelants intersectent le corpus avec les droits, sans jamais l’unir', () => {
    // Le corpus RESTREINT, il n'ouvre pas : une rubrique ne doit pas donner accès à un
    // service que l'abonnement refuse (§03). Contrôle structurel sur les trois points.
    for (const f of [
      'src/app/api/search/route.ts',
      'src/app/[locale]/(app)/search/page.tsx',
      'src/lib/alerts.ts',
    ]) {
      expect(readFileSync(f, 'utf8')).toMatch(/(allowed|accessibleTypes\(user\))[\s\S]{0,80}\.(includes|filter)\(/)
    }
  })
})
