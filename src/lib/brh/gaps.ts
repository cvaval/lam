import { prisma } from '../db'

/**
 * Détection des numéros manquants des Circulaires et Lettres-Circulaires BRH.
 *
 * Référentiel : Document.number aux formats canoniques « Circulaire n° {N}[-{M}] »
 * et « Lettre-Circulaire n° {N}[-{M}] » (type CIRCULAIRE_BRH). Les deux séries
 * sont indépendantes (pendant des séquences régulière/spéciale du Moniteur) et
 * UNIQUES sur toute l'histoire (pas de remise à zéro annuelle).
 *
 * Numéros composés N-M : M est l'indice de RÉVISION de la circulaire N — le
 * corpus montre 115-2 (2022) puis 115-5 et 115-6 (2024), révisions successives
 * de la n° 115. Un N-M rend donc le numéro de base N présent dans la série
 * principale et ouvre une sous-série dense 1..max(M) (pendant des suffixes
 * a..z du Moniteur, qui commencent toujours à « a »).
 *
 * Règles (pendant BRH de moniteur/gaps.ts, demandes du 12 juin 2026) :
 *  1. trous INTERNES uniquement sur chaque série principale — bases 110 et 114
 *     présentes ⇒ 111, 112, 113 manquantes ; on n'extrapole ni avant le premier
 *     ni après le dernier numéro de base connu ;
 *  2. révisions sautées — 115-2 et 115-5 présentes ⇒ 115-1, 115-3, 115-4
 *     manquantes : une révision M implique l'existence des révisions 1..M-1 ;
 *  3. originale absente — des révisions sans document plein (100-4 sans
 *     « Circulaire n° 100 ») ⇒ la version originale est signalée manquante ;
 *  4. doublons tolérés — deux documents « Circulaire n° 114-3 » (versions/notes
 *     additionnelles d'un même texte) comptent pour UNE référence présente ;
 *  5. références non standard ignorées — un sous-numéro à 2 chiffres et plus
 *     n'est pas une révision mais une référence annuelle numéro-année
 *     (« Circulaire n° 01-19 » = réf. BRH/DCC/CIRC # 01-19, 1ʳᵉ de 2019) ;
 *     idem libellés libres et références Moniteur (LM2018-126).
 */

export type BrhSerie = 'CIRCULAIRE' | 'LETTRE'

export interface ParsedCirculaireRef {
  serie: BrhSerie
  base: number
  /** indice de révision (numéro composé N-M) ; null pour le document plein */
  rev: number | null
}

/**
 * Analyse une référence ; null si non standard. Tolère n°/no/N°, la base
 * zéro-paddée des lettres (« 05 ») et « Lettre Circulaire » sans trait d'union.
 * La révision est un chiffre 1-9 : un sous-numéro à 2 chiffres (« 01-19 »)
 * est une référence annuelle hors séquence, pas une révision.
 */
export function parseCirculaireRef(ref: string | null | undefined): ParsedCirculaireRef | null {
  const m = (ref ?? '').trim().match(/^(lettre[-\s])?circulaire\s+n[°ºo]?\s*\.?\s*(\d+)(?:-([1-9]))?$/i)
  if (!m) return null
  return { serie: m[1] ? 'LETTRE' : 'CIRCULAIRE', base: Number(m[2]), rev: m[3] ? Number(m[3]) : null }
}

/**
 * Forme canonique d'une référence (celle du corpus et du CMS). Les bases des
 * Lettres-Circulaires sont zéro-paddées à 2 chiffres (« 05 », convention BRH).
 */
export function formatCirculaireRef(base: number, serie: BrhSerie = 'CIRCULAIRE', rev: number | null = null): string {
  const b = serie === 'LETTRE' ? String(base).padStart(2, '0') : String(base)
  return `${serie === 'LETTRE' ? 'Lettre-Circulaire' : 'Circulaire'} n° ${b}${rev ? `-${rev}` : ''}`
}

export interface MissingCirculaire {
  serie: BrhSerie
  base: number
  rev: number | null
  /** référence affichable, ex. « Circulaire n° 112 », « Lettre-Circulaire n° 03 » */
  ref: string
  /** 'numero' = base sautée ; 'revision' = révision sautée (1..max) ; 'originale' = révisions présentes sans le document plein */
  reason: 'numero' | 'revision' | 'originale'
}

export interface SerieGaps {
  serie: BrhSerie
  /** numéros de base distincts présents, triés */
  present: number[]
  missing: MissingCirculaire[]
}

export interface BrhGaps {
  circulaires: SerieGaps
  lettres: SerieGaps
  /** manquants des deux séries (circulaires puis lettres) */
  missing: MissingCirculaire[]
}

/**
 * Calcule les numéros manquants à partir d'une liste de références. Pure et
 * déterministe — la lecture de la base vit dans loadBrhGaps().
 */
export function findMissingCirculaires(refs: (string | null | undefined)[]): BrhGaps {
  // serie → base → { revs, plain (document plein présent) }
  const series: Record<BrhSerie, Map<number, { revs: Set<number>; plain: boolean }>> = {
    CIRCULAIRE: new Map(),
    LETTRE: new Map(),
  }
  for (const ref of refs) {
    const p = parseCirculaireRef(ref)
    if (!p) continue
    const entry = series[p.serie].get(p.base) ?? { revs: new Set<number>(), plain: false }
    if (p.rev === null) entry.plain = true
    else entry.revs.add(p.rev)
    series[p.serie].set(p.base, entry)
  }

  const bySerie = (serie: BrhSerie): SerieGaps => {
    const bases = series[serie]
    const present = [...bases.keys()].sort((a, b) => a - b)
    const missing: MissingCirculaire[] = []

    // 1) Numéros de base sautés (trous internes uniquement). On n'extrapole PAS à
    // travers un saut anormalement grand (> MAX_RUN) : c'est une frontière de série
    // ou un numéro hors-séquence (ex. « 187 » de 2008, série réelle ≈ 1-140), pas une
    // longue suite de numéros réellement manquants — sinon des dizaines de faux trous.
    const MAX_RUN = 15
    for (let i = 1; i < present.length; i++) {
      if (present[i] - present[i - 1] > MAX_RUN) continue
      for (let n = present[i - 1] + 1; n < present[i]; n++) {
        missing.push({ serie, base: n, rev: null, ref: formatCirculaireRef(n, serie), reason: 'numero' })
      }
    }

    // 2) Sous-série des révisions de chaque base : document plein puis 1..max(M).
    for (const base of present) {
      const { revs, plain } = bases.get(base)!
      if (!revs.size) continue
      if (!plain) {
        missing.push({ serie, base, rev: null, ref: formatCirculaireRef(base, serie), reason: 'originale' })
      }
      const max = Math.max(...revs)
      for (let r = 1; r < max; r++) {
        if (!revs.has(r)) {
          missing.push({ serie, base, rev: r, ref: formatCirculaireRef(base, serie, r), reason: 'revision' })
        }
      }
    }

    missing.sort((a, b) => a.base - b.base || (a.rev ?? 0) - (b.rev ?? 0))
    return { serie, present, missing }
  }

  const circulaires = bySerie('CIRCULAIRE')
  const lettres = bySerie('LETTRE')
  return { circulaires, lettres, missing: [...circulaires.missing, ...lettres.missing] }
}

/** Charge les références des circulaires du corpus et calcule les manquants. */
export async function loadBrhGaps(): Promise<BrhGaps> {
  const rows = await prisma.document.findMany({
    where: { type: 'CIRCULAIRE_BRH' },
    select: { number: true },
  })
  return findMissingCirculaires(rows.map((r) => r.number))
}
