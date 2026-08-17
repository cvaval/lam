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
import { DOC_TYPE_META } from '../brand'
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
  // La route a été renommée le 17 août : « legislation » dans le chemin d'une route qui
  // sert aussi les circulaires est précisément le genre de nom qui égare.
  const route = readFileSync('src/app/api/themes/docs/route.ts', 'utf8')

  it('documentsInTheme accepte un corpus', () => {
    expect(themes).toMatch(/corpus\?: readonly DocType\[\]/)
  })

  it('le corpus RESTREINT l’accès, il ne l’élargit jamais', () => {
    // L'intersection est la seule forme sûre : un corpus ne doit pas pouvoir ouvrir un type
    // que l'abonnement refuse. C'est pourquoi on filtre accessibleTypes PAR le corpus,
    // et non l'inverse.
    expect(themes).toMatch(/accessibleTypes\(user\)\.filter\(/)
  })

  it('la route résout le corpus de la rubrique qui interroge, et le passe', () => {
    expect(route).toContain('corpusForSlug')
    expect(route).toMatch(/documentsInTheme\([^)]*corpus/s)
  })

  it('une rubrique inconnue retombe sur le corpus le plus ÉTROIT, pas sur tous les types', () => {
    // Le repli d'une route qui ne reconnaît pas sa rubrique ne doit jamais être « tout ce
    // que l'utilisateur peut lire » : ce serait faire d'une faute de frappe une ouverture.
    expect(route).toContain('?? TYPES_LEGISLATION_ANNOTEE')
    expect(route).not.toMatch(/\?\?\s*accessibleTypes/)
  })

  it('l’ancien chemin reste servi — sinon un onglet ouvert lit « aucun texte »', () => {
    // Un 404 pendant le déploiement ferait afficher au navigateur « Aucun texte accessible
    // dans ce thème » : un mensonge là où il fallait une erreur.
    expect(readFileSync('src/app/api/legislation/theme-docs/route.ts', 'utf8')).toMatch(
      /export \{[^}]*GET[^}]*\} from '\.\.\/\.\.\/themes\/docs\/route'/,
    )
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


describe('Circulaires BRH : la rubrique a sa propre porte', () => {
  /**
   * La correction du 17 août a rendu à chaque rubrique son corpus — et, ce faisant, a coupé
   * le seul chemin qui menait à la taxonomie de la BRH : 22 thèmes portant 295 rattachements
   * n'étaient atteignables que par la Législation annotée, où ils n'avaient rien à faire.
   * Ces contrôles verrouillent la porte de remplacement, et surtout ce qui la rend juste.
   */
  const brh = DOC_TYPE_META.CIRCULAIRE_BRH
  const page = readFileSync('src/app/[locale]/(app)/circulaires/page.tsx', 'utf8')
  const themes = readFileSync('src/lib/legislation/themes.ts', 'utf8')

  it('la rubrique déclare son corpus ET les racines de sa taxonomie', () => {
    expect(brh.corpus).toEqual(['CIRCULAIRE_BRH'])
    expect(brh.racinesThemes).toEqual(['brh-matiere', 'brh-assujetti'])
  })

  it('le nœud parent MIXTE n’est pas une racine', () => {
    // « Banques & institutions financières » porte 27 textes de loi en plus de ses
    // circulaires. Le corpus les écarterait ; on ne fait pas reposer une frontière
    // éditoriale sur un filtre.
    expect(brh.racinesThemes).not.toContain('droit-bancaire')
  })

  it('la page borne ses DEUX requêtes au même corpus déclaré', () => {
    // Le compteur et la liste doivent sortir du même périmètre : c'est leur divergence,
    // puis sa rechute inversée, qui a coûté deux corrections le 17 août.
    expect(page).toContain('navigationThemes(user, { corpus: META.corpus, racines: META.racinesThemes })')
    expect(page).toContain('allThemedDocuments(user, { corpus: META.corpus })')
  })

  it('la page est gardée par le service, pas par le rôle (§03)', () => {
    expect(page).toMatch(/canReadService\(user, 'CIRCULAIRE_BRH'\)/)
  })

  it('les sous-totaux comptent des DOCUMENTS, pas des rattachements', () => {
    // Une circulaire classée sous deux matières était comptée deux fois : 143 annoncées
    // pour 142 réelles. On fusionne des ensembles, on ne somme pas des tailles.
    expect(themes).toMatch(/subtotals\[n\.id\] = s\.size/)
  })

  it('les nœuds vides pour ce corpus sont élagués, pas grisés', () => {
    // Grisés, ils affichaient « Aucun texte pour le moment » sous des rubriques qui en
    // portaient 285 : l'écran démentait la base.
    expect(themes).toMatch(/function elaguer/)
    expect(themes).toMatch(/\(sousTotal\.get\(n\.id\) \?\? 0\) > 0/)
  })

  it('chaque rubrique dédiée a un chemin depuis la tuile ET depuis la route générique', () => {
    expect(readFileSync('src/lib/nav.ts', 'utf8')).toMatch(/circulaires: 'circulaires'/)
    expect(readFileSync('src/app/[locale]/(app)/type/[type]/page.tsx', 'utf8')).toContain(
      "redirect(`/${locale}/circulaires`)",
    )
  })
})

describe('les trois pièges que l’audit adversarial a confirmés', () => {
  const themes = readFileSync('src/lib/legislation/themes.ts', 'utf8')
  const browser = readFileSync('src/components/ThemeBrowser.tsx', 'utf8')
  const redirect = readFileSync('src/lib/auth/redirect.ts', 'utf8')

  it('le CLIC ne descend pas dans les thèmes archivés, comme les compteurs', () => {
    // Archiver une rubrique la retirait de l'arbre ET de son compteur, mais ses documents
    // restaient listés au clic sur le parent : le badge annonçait moins que la liste. La
    // divergence du 17 août une troisième fois, par une autre porte. Aucun thème n'est
    // archivé aujourd'hui — le défaut était à un clic de back-office.
    expect(themes).toMatch(/const themes = await listThemes\(\{ activeOnly: true \}\)/)
    expect(themes).toMatch(/themes: \{ some: \{ themeId: \{ in: ids \}, theme: \{ active: true \} \} \}/)
  })

  it('un échec de chargement ne se rend pas comme une absence de documents', () => {
    // « Aucune circulaire dans cette rubrique » est une affirmation sur l'état du droit.
    // Un 401, un 429, un 500 ou une coupure réseau ne doivent jamais la produire.
    expect(browser).toContain("setDocs(res.ok && data?.ok ? (data.docs as DocRow[]) : 'erreur')")
    expect(browser).toMatch(/catch \{[\s\S]{0,120}setDocs\('erreur'\)/)
    expect(browser).toMatch(/docs === 'erreur' \?/)
  })

  it('la purge de changement de compte suit les clés du code, pas une liste à maintenir', () => {
    // Elle nommait deux clés que plus aucune ligne n'écrivait, et ignorait sessionStorage —
    // où vit précisément le thème ouvert. Poste partagé de cabinet : fuite entre confrères.
    expect(redirect).toMatch(/startsWith\('lv:'\)/)
    expect(redirect).toMatch(/\[localStorage, sessionStorage\]/)
    // On vise la LISTE, pas les noms : le commentaire cite encore les clés mortes, et c'est
    // bien — c'est le récit du défaut. Ce qui ne doit plus exister, c'est l'énumération.
    expect(redirect).not.toMatch(/const CLES_DE_COMPTE\b/)
  })
})

describe('une rubrique inconnue ne fait pas tomber la résolution', () => {
  it('les clés héritées d’Object ne sont pas des rubriques', () => {
    // `TYPE_SLUGS['__proto__']` rend Object.prototype, `['constructor']` rend Object : deux
    // valeurs VRAIES qui passaient la garde, puis faisaient lire `.corpus` sur un undefined.
    // Un simple ?type=__proto__ renvoyait 500, sur l'API de recherche comme sur celle des
    // thèmes — et le navigateur affichait alors « aucun document » pour un plantage.
    for (const hostile of ['__proto__', 'constructor', 'toString', 'valueOf', 'hasOwnProperty']) {
      expect(corpusForSlug(hostile)).toBeUndefined()
    }
  })

  it('les vraies rubriques résolvent toujours — slug, ancien slug et numéro', () => {
    expect(corpusForSlug('circulaires')).toEqual(['CIRCULAIRE_BRH'])
    expect(corpusForSlug('brh')).toEqual(['CIRCULAIRE_BRH'])
    expect(corpusForSlug('2')).toEqual(['CIRCULAIRE_BRH'])
  })
})
