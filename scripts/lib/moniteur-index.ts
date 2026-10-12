/**
 * Index du Moniteur — fonctions PURES partagées par `indexer-sommaires-moniteur.ts` et
 * testées à part (`moniteur-index.test.ts`).
 */
import { extractCompanies } from '../../src/lib/moniteur/companies'
import { fold } from '../../src/lib/search/normalize'
import type { IndexCategory } from '../../src/lib/types'

/**
 * Catégorie d'une entrée d'Index d'après son titre.
 *
 * ⚠️ COPIE CONFORME de `classify()` dans `scripts/import-moniteur.ts` — c'est elle qui a classé les
 * 27 000 entrées existantes, et `Document.category` est un texte libre : la cohérence du corpus ne
 * tient qu'à ce classifieur commun. On la copie au lieu de l'importer parce que CHARGER
 * `import-moniteur.ts` est dangereux : son exécution autonome PURGE l'Index entier.
 */
export function classify(text: string): { category: IndexCategory; company?: 'STATUTS' | 'MODIF_CAPITAL' | 'MARQUE' } {
  const t = fold(text)
  const isMarque = t.includes('marque') && (t.includes('fabrique') || t.includes('commerce') || t.includes('registre des marques'))
  const isSociete =
    t.includes('societe anonyme') ||
    t.includes('societes anonymes') ||
    t.includes('acte constitutif') ||
    t.includes('acte de constitution') ||
    (t.includes('statuts') && !isMarque) ||
    t.includes('fonctionnement des soci')
  if (isMarque) return { category: 'MARQUE', company: 'MARQUE' }
  if (isSociete) {
    const kind = t.includes('augmentation') || t.includes('modification du capital') ? 'MODIF_CAPITAL' : 'STATUTS'
    return { category: 'SOCIETE', company: kind }
  }
  if (t.includes('circulaire')) return { category: 'CIRCULAIRE' }
  if (t.startsWith('loi') || t.includes('decret-loi')) return { category: 'LOI' }
  if (t.startsWith('decret')) return { category: 'DECRET' }
  if (t.startsWith('arrete') || t.startsWith('aret')) return { category: 'ARRETE' }
  if (t.startsWith('avis') || t.startsWith('avi ')) return { category: 'AVIS' }
  return { category: 'AUTRE' }
}

/** Clé de fascicule comparable quelle que soit l'écriture : « LM2020-99-A » = « LM2020-99A » = « lm2020-99a ». */
export function cleFascicule(ref: string): string {
  return ref.toUpperCase().replace(/-/g, '')
}

/**
 * Titre réduit à ses mots : sans accents, casse, ponctuation ni guillemets.
 * ⚠️ « œ » et « æ » ne se décomposent pas : sans ce remplacement, « Cœur » ≠ « Coeur » et
 * « Bœufs » ≠ « Boeufs » — le même acte, écrit par l'IA et par l'ancien Index, se dédoublait.
 */
export function titreNormalise(titre: string): string {
  return fold(titre)
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Formules qui ouvrent ou ferment des centaines de titres et n'en distinguent aucun. Comparées
 * telles quelles, « Avis autorisant le fonctionnement de la société anonyme dénommée « A » … » et
 * la même phrase pour « B » se ressemblent à 90 % : le nom propre, seul distinctif, pèse trop peu.
 */
const FORMULES = [
  /avis (?:autorisant|approuvant) (?:le fonctionnement|les modifications apportees aux statuts) (?:de la|des) societes? anonymes? (?:denommees?)?/g,
  /societes? anonymes? denommees?/g,
  /actes? constitutifs? et statuts? y annexes?/g,
  /proces verbal y annexe/g,
  /extraits? du registre des marques de fabrique et de commerce/g,
  /arretes? autorisant l adoption (?:des |du |de la |de l |d )?(?:mineure?s?\b ?)?(?:suivante?s?\b ?)?(?:de |d )?/g,
]

/** Le titre sans ses formules — chaîne vide s'il n'en reste presque rien (« Extraits du registre… »). */
export function noyau(titre: string): string {
  let r = titreNormalise(titre)
  for (const f of FORMULES) r = r.replace(f, ' ')
  r = r.replace(/\s+/g, ' ').trim()
  return r.length >= 4 ? r : ''
}

/** Mots qui n'identifient rien : on ne les compte pas pour dire qu'un acte est « dans » une entrée groupée. */
const MOTS_VIDES = new Set(
  ('le la les de du des d l et a au aux en un une pour par sur dans avec ou suivant suivants suivante suivantes ' +
    'arrete arretes avis decret decrets loi lois nommant nomme autorisant approuvant portant relatif relative ' +
    'mineur mineure mineurs mineures adoption citoyen citoyenne madame monsieur societe societes anonyme anonymes ' +
    'denommee denommees sa s haiti haitien republique commune departement arrondissement').split(' '),
)

/** Mots distinctifs d'un titre : les noms (propres, de lieux, de sociétés), hors mots vides. */
function motsDistinctifs(titre: string): string[] {
  return [...new Set(noyau(titre).split(' '))].filter((m) => m.length >= 3 && !MOTS_VIDES.has(m) && !/^\d+$/.test(m))
}

function trigrammes(s: string): Set<string> {
  const t = `  ${s} `
  const out = new Set<string>()
  for (let i = 0; i < t.length - 2; i++) out.add(t.slice(i, i + 3))
  return out
}

/**
 * Ressemblance de deux titres, de 0 à 1 (Dice sur trigrammes). On prend le MAXIMUM de deux
 * mesures : Dice classique, et le recouvrement du plus court par le plus long — une entrée
 * existante est souvent l'abrégé du titre du sommaire (« Extraits du registre des marques »).
 */
export function ressemblance(a: string, b: string): number {
  // Une formule seule (« Extraits du registre des marques… ») n'a pas de noyau : on compare alors
  // les titres ENTIERS des deux côtés — sinon l'un serait réduit et l'autre non.
  const na = noyau(a)
  const nb2 = noyau(b)
  const [ta, tb] = na && nb2 ? [na, nb2] : [titreNormalise(a), titreNormalise(b)]
  const A = trigrammes(ta)
  const B = trigrammes(tb)
  if (!A.size || !B.size) return 0
  let commun = 0
  for (const x of A) if (B.has(x)) commun++
  const dice = (2 * commun) / (A.size + B.size)
  const recouvrement = commun / Math.min(A.size, B.size)
  // Le recouvrement seul ferait d'un titre de trois mots le « double » de tout titre qui le
  // contient : on ne le retient que si le plus court a une longueur raisonnable.
  const score = Math.min(A.size, B.size) >= 25 ? Math.max(dice, recouvrement * 0.9) : dice
  // Les sociétés NOMMÉES tranchent, quelle que soit la phrase : distinctes, ce n'est jamais le
  // même acte ; toutes celles de `a` présentes dans `b`, c'est le même avis — y compris quand
  // l'Index existant les a groupées en une entrée (« … dénommées : 1) « A » ; 2) « B » »).
  const sa = societes(a)
  const sb = societes(b)
  if (sa.length && sb.length) return sa.every((k) => sb.some((l) => memeSociete(k, l))) ? Math.max(score, 0.95) : Math.min(score, 0.3)
  // Entrée GROUPÉE de l'ancien Index (« Arrêtés autorisant l'adoption des mineurs suivants : A ;
  // B ; C … ») : un acte individuel y figure si tous ses noms distinctifs s'y trouvent.
  const da = motsDistinctifs(a)
  if (da.length >= 2) {
    const motsB = new Set(titreNormalise(b).split(' '))
    if (da.filter((m) => motsB.has(m)).length / da.length >= 0.85) return Math.max(score, 0.9)
  }
  return score
}

/** Deux clés lâches de société désignent la même si l'une contient l'autre (sigle, « Services »…) ou presque. */
function memeSociete(k: string, l: string): boolean {
  if (k === l) return true
  const [court, long] = k.length <= l.length ? [k, l] : [l, k]
  if (court.length >= 6 && long.includes(court)) return true
  const K = trigrammes(k)
  const L = trigrammes(l)
  let commun = 0
  for (const x of K) if (L.has(x)) commun++
  return (2 * commun) / (K.size + L.size) >= 0.8
}

/**
 * Clés de sociétés d'un titre, LÂCHES : sans ponctuation, espaces ni forme sociale —
 * « GLOBAL ASIA MOTORS, S.A. » = « Global Asia Motors S.A. ». (`companyKey` garde la
 * ponctuation à dessein, pour l'identité des fiches Société ; ici on ne fait que comparer.)
 */
export function societes(titre: string): string[] {
  return extractCompanies(titre)
    .map((n) => titreNormalise(n).replace(/\b(s a r l|sarl|s a|sa|s a s|sas|inc|ltd|llc)\b/g, ' ').replace(/\s+/g, ''))
    .filter((k) => k.length >= 3)
}

/**
 * Un intitulé de RUBRIQUE sans contenu (« Arrêtés autorisant l'adoption des mineurs suivants »,
 * « Avis divers ») : l'écrire ferait une entrée qui ne désigne aucun acte. Toujours à relire.
 */
export function enTeteSeul(titre: string): boolean {
  return /\b(suivante?s?|divers(es)?)\s*:?\s*$/i.test(titre.trim()) && !noyau(titre)
}

export type Statut = 'deja-a-l-index' | 'a-creer' | 'a-relire'

export const SEUIL_DEJA = 0.72
export const SEUIL_RELIRE = 0.45

/**
 * Rapproche un acte lu au sommaire des entrées déjà à l'Index pour ce fascicule.
 * - ressemblance ≥ SEUIL_DEJA avec une entrée → déjà à l'Index (rien à écrire) ;
 * - entre SEUIL_RELIRE et SEUIL_DEJA → à relire (jamais écrit d'office) ;
 * - en dessous → à créer.
 */
export function rapprocher(titre: string, existantes: string[]): { statut: Statut; score: number; proche: string | null } {
  let meilleur = 0
  let proche: string | null = null
  for (const e of existantes) {
    const s = ressemblance(titre, e)
    if (s > meilleur) {
      meilleur = s
      proche = e
    }
  }
  const statut: Statut = meilleur >= SEUIL_DEJA ? 'deja-a-l-index' : meilleur >= SEUIL_RELIRE ? 'a-relire' : 'a-creer'
  return { statut, score: Math.round(meilleur * 100) / 100, proche }
}

/** CSV RFC 4180 : guillemets doublés, champs entre guillemets s'ils contiennent , " ou fin de ligne. */
export function versCsv(lignes: (string | number | null)[][]): string {
  const champ = (v: string | number | null) => {
    const s = v == null ? '' : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return lignes.map((l) => l.map(champ).join(',')).join('\n') + '\n'
}

export function lireCsv(texte: string): string[][] {
  const out: string[][] = []
  let ligne: string[] = []
  let champ = ''
  let guillemets = false
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i]
    if (guillemets) {
      if (c === '"' && texte[i + 1] === '"') {
        champ += '"'
        i++
      } else if (c === '"') guillemets = false
      else champ += c
    } else if (c === '"') guillemets = true
    else if (c === ',') {
      ligne.push(champ)
      champ = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texte[i + 1] === '\n') i++
      ligne.push(champ)
      out.push(ligne)
      ligne = []
      champ = ''
    } else champ += c
  }
  if (champ || ligne.length) {
    ligne.push(champ)
    out.push(ligne)
  }
  return out
}
