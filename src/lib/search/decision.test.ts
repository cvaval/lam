import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { motsDe, motsMagistratSql, nomMagistrat, rolesDe, ROLES_PRESIDENCE, ROLES_SIEGE } from './decision'

const src = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

describe('rolesDe — les ventilations sont DISJOINTES', () => {
  it('« présidées » et « a siégé » ne se recouvrent jamais', () => {
    // La rédaction demande deux listes distinctes. Si un rôle tombait dans les deux, un
    // arrêt serait compté deux fois et les totaux mentiraient.
    const presidence = new Set(rolesDe('PRESIDENCE'))
    const siege = rolesDe('SIEGE')
    expect(siege.some((r) => presidence.has(r))).toBe(false)
  })

  it('la présidence comprend le vice-président et le faisant fonction', () => {
    // La Deuxième Section est présidée par un VICE-président : l'omettre viderait la
    // ventilation « présidées » de 46 décisions sur 80.
    expect(rolesDe('PRESIDENCE')).toEqual(expect.arrayContaining(['PRESIDENT', 'VICE_PRESIDENT', 'PRESIDENT_FF']))
  })

  it('le siège n’inclut NI le ministère public NI le greffe', () => {
    // Un substitut n'a pas jugé : le ramener sous « magistrat » lui attribuerait des
    // décisions qu'il n'a pas rendues.
    expect(ROLES_SIEGE).not.toContain('MINISTERE_PUBLIC')
    expect(ROLES_SIEGE).not.toContain('GREFFE')
    expect(rolesDe('MINISTERE_PUBLIC')).toEqual(['MINISTERE_PUBLIC'])
  })

  it('toute la présidence est au siège', () => {
    expect(ROLES_PRESIDENCE.every((r) => (ROLES_SIEGE as readonly string[]).includes(r))).toBe(true)
  })
})

describe('motsDe — les parties', () => {
  it('sépare les parties et écarte le « c. » de l’intitulé', () => {
    expect(motsDe('CESAR c. LALANNE')).toEqual(['cesar', 'lalanne'])
  })

  it('dédoublonne et borne le nombre de mots', () => {
    expect(motsDe('CESAR cesar CESAR lalanne')).toEqual(['cesar', 'lalanne'])
    // Six mots suffisent à désigner des parties ; au-delà, la requête s'alourdirait sans
    // rien préciser.
    expect(motsDe('un deux trois quatre cinq six sept huit')).toHaveLength(6)
  })

  it('ne rend rien d’un critère vide', () => {
    expect(motsDe('   ')).toEqual([])
    expect(motsDe('c. et')).toEqual([])
  })
})

describe('nomMagistrat — chercher « Noel » doit trouver « NOËL »', () => {
  it('normalise accents, casse et abréviations comme la clé stockée', () => {
    // La clé en base est déjà normalisée ; le critère doit l'être IDENTIQUEMENT, sans quoi
    // un magistrat devient introuvable sans que rien ne le signale.
    const f = nomMagistrat('Noël') as { judge: { AND: { matchKey: { contains: string } }[] } }
    expect(f.judge.AND.map((c) => c.matchKey.contains)).toEqual(['noel'])
    const st = nomMagistrat('St Julien') as { judge: { AND: { matchKey: { contains: string } }[] } }
    expect(st.judge.AND.map((c) => c.matchKey.contains)).toEqual(['saint', 'julien'])
  })

  it('écarte les initiales, qui n’apparieraient rien', () => {
    const f = nomMagistrat('Louis B. VILGRAIN') as { judge: { AND: { matchKey: { contains: string } }[] } }
    expect(f.judge.AND.map((c) => c.matchKey.contains)).toEqual(['louis', 'vilgrain'])
  })

  it('ne filtre RIEN quand le critère ne porte aucun mot exploitable', () => {
    // Un objet de filtre vide vaut « pas de contrainte » : mieux qu'une contrainte
    // impossible, qui rendrait une page vide sans expliquer pourquoi.
    expect(nomMagistrat('B.')).toEqual({})
  })

  it('AUCUN joker SQL ne survit au critère', () => {
    // « % » apparierait tout le corpus. La normalisation le retire déjà — elle ne garde
    // que des lettres — et l'échappement reste en second rideau : ce test vérifie la
    // GARANTIE (pas de joker en sortie), non le chemin par lequel elle est obtenue.
    for (const brut of ['rous%eau', 'rousseau_', '%', 'a%b_c']) {
      expect(motsMagistratSql(brut).join(' ')).not.toMatch(/(?<!\\)[%_]/)
    }
    expect(motsMagistratSql('rous%eau')).toEqual(['rous', 'eau'])
  })
})

/**
 * ⚠️ UN CRITÈRE CÂBLÉ DANS DEUX COUCHES SUR TROIS EST PIRE QU'UN CRITÈRE ABSENT : il
 * filtre en navigation et cesse de filtrer dès qu'on tape un mot — un défaut qui ne se
 * voit qu'au second geste. Les trois moteurs doivent porter les mêmes critères.
 */
describe('les critères de décision existent dans TOUTES les couches', () => {
  const couches = {
    'fts.ts (navigation Prisma)': src('src/lib/search/fts.ts'),
    'ftsql.ts (recherche texte SQL)': src('src/lib/search/ftsql.ts'),
    'opensearch.ts (miroir)': src('src/lib/search/opensearch.ts'),
  }

  for (const [nom, s] of Object.entries(couches)) {
    it(`${nom} filtre parties, domaine, magistrat, ministère public et identifiant`, () => {
      expect(s).toMatch(/parties/)
      expect(s).toMatch(/domaineIds/)
      expect(s).toMatch(/\bjudge\b/)
      expect(s).toMatch(/\bmp\b/)
      expect(s).toMatch(/judgeId/)
    })

    it(`${nom} borne le magistrat par son RÔLE`, () => {
      // Sans le rôle, le filtre « magistrat » ramènerait aussi les arrêts où l'intéressé
      // n'était que le substitut — des décisions qu'il n'a pas rendues.
      expect(s).toMatch(/ROLES_SIEGE|judgeRoles|rolesDe/)
      expect(s).toMatch(/MINISTERE_PUBLIC/)
    })
  }

  it('la clé de cache porte les nouveaux critères', () => {
    // Sans eux, deux recherches différentes partageraient une entrée de cache et la
    // seconde afficherait les résultats de la première.
    const s = src('src/lib/search/index.ts')
    for (const k of ['parties', 'domaine', 'domaineIds', 'judge', 'mp', 'judgeId', 'judgeRole']) {
      expect(s).toContain(`${k}: query.${k} ??`)
    }
  })

  it('le domaine est résolu en SOUS-ARBRE, une seule fois pour les trois moteurs', () => {
    // ⚠️ CHERCHER « DROIT PRIVÉ » DOIT RAMENER LE DROIT CIVIL. Un thème de tête ne porte
    // presque aucun document en propre : filtrer sur son seul id rendrait une page vide,
    // et le lecteur en conclurait qu'il n'y a rien à lire. Résoudre le sous-arbre dans
    // chaque moteur, à l'inverse, les laisserait diverger au premier oubli.
    const s = src('src/lib/search/index.ts')
    expect(s).toContain('sousArbreDuTheme')
    expect(s).toMatch(/domaineIds: await sousArbreDuTheme/)
    for (const f of ['src/lib/search/fts.ts', 'src/lib/search/ftsql.ts', 'src/lib/search/opensearch.ts']) {
      expect(src(f)).not.toContain('sousArbreDuTheme')
    }
  })

  it('le domaine ne cherche plus dans la phrase du recueil', () => {
    // `matiere` reste la formule du rédacteur ; le domaine est le thème. Les confondre
    // rendait « procédure civile » et « Procédure civile (voies de recours) » distincts.
    expect(src('src/lib/search/fts.ts')).not.toMatch(/domaine[^I]*matiere/)
    expect(src('src/lib/search/ftsql.ts')).not.toMatch(/domaine[^I]*matiere/)
  })
})

describe('tri « nouveautés » — l’arrivée sur la plateforme, pas la date du texte', () => {
  it('trie sur createdAt dans les trois couches', () => {
    // Un arrêt de 1964 versé hier est la nouveauté du jour et le plus ancien du corpus :
    // trier sur `publicationDate` ferait passer un versement pour une actualité juridique.
    expect(src('src/lib/search/fts.ts')).toContain("[{ createdAt: 'desc' }, { id: 'asc' }]")
    expect(src('src/lib/search/ftsql.ts')).toContain('d."createdAt" DESC, d.id')
    expect(src('src/lib/search/opensearch.ts')).toContain("'recent' ? 'createdAt'")
  })

  it('départage par id — sinon la pagination perd et répète des lignes', () => {
    expect(src('src/lib/search/fts.ts')).toContain("[{ createdAt: 'desc' }, { id: 'asc' }]")
    expect(src('src/lib/search/ftsql.ts')).toContain('d."createdAt" DESC, d.id')
  })

  it('le miroir indexe createdAt, sans quoi son tri serait muet', () => {
    expect(src('src/lib/search/mappings.ts')).toContain('createdAt:')
    expect(src('src/lib/search/serialize.ts')).toContain('createdAt: d.createdAt')
  })
})
