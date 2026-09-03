/**
 * COUCHE TEXTE D'UN PDF — lecture sans canvas natif.
 *
 * ⚠️ POURQUOI CE MODULE EXISTE. `pdf-parse` charge `pdfjs-dist`, dont le module évalue à
 * l'IMPORT la ligne `const SCALE_MATRIX = new DOMMatrix()` (legacy/build/pdf.mjs). `DOMMatrix`
 * est une API de navigateur : sous Node, pdfjs tente de l'emprunter à `@napi-rs/canvas`
 * (dépendance OPTIONNELLE, chargée par un `require()` calculé à l'exécution). Sur Vercel, le
 * traçage de fichiers de Next ne voit pas ce `require` et n'embarque pas le paquet dans la
 * fonction : `require("@napi-rs/canvas")` échoue, `DOMMatrix` reste indéfini, et l'évaluation
 * du module jette `ReferenceError: DOMMatrix is not defined`.
 *
 * L'erreur survient donc AU CHARGEMENT du module, pas à l'appel. Un `import` statique en tête
 * de route faisait échouer la route entière en 500 — AVANT que le `try/catch` du gestionnaire
 * ait la moindre chance de s'exécuter. C'est ce qui rendait l'écran de téléversement inutilisable
 * en production alors qu'il fonctionnait en local, où `@napi-rs/canvas` est bien installé pour
 * l'architecture de la machine (darwin-arm64).
 *
 * ⚠️ LE POLYFILL DOIT ÊTRE POSÉ AVANT L'IMPORT, ce qui impose un `import()` DYNAMIQUE : les
 * imports statiques sont hissés et s'évalueraient les premiers. Le verrou de pdfjs est
 * `if (!globalThis.DOMMatrix)` (pdf.mjs:14348) : un global déjà présent lui fait sauter tout le
 * chemin canvas — c'est exactement la branche qu'on emprunte ici, en local comme en production.
 *
 * ⚠️ CE SUBSTITUT SUFFIT PARCE QU'ON NE FAIT QUE LIRE DU TEXTE. Dans pdfjs, `SCALE_MATRIX` ne
 * sert qu'à `newPath.addPath(path, SCALE_MATRIX)` — du rendu graphique, jamais l'extraction de
 * texte. On ne cherche donc PAS à emprunter la vraie classe au canvas natif quand il est là :
 * ce chemin ne dessine rien, et aller la chercher exigerait un `require` calculé
 * (`createRequire(import.meta.url)`) dont la validité dépend de la compilation ESM/CJS retenue
 * par Next — une fragilité gratuite pour un gain nul. Les scripts d'import qui, eux, ont besoin
 * du rendu continuent d'utiliser `pdf-parse` directement, sur des postes où le binaire natif
 * est installé.
 */

/** Matrice affine minimale : identité, six coefficients mutables. Rien de plus n'est lu. */
class DOMMatrixMinimal {
  a = 1
  b = 0
  c = 0
  d = 1
  e = 0
  f = 0
  constructor(init?: number[] | string) {
    if (Array.isArray(init) && init.length === 6) [this.a, this.b, this.c, this.d, this.e, this.f] = init
  }
}

/** Renseigne `globalThis.DOMMatrix` s'il manque. Retourne la provenance, pour le journal. */
export function ensureDOMMatrix(): 'déjà présent' | 'substitut' {
  const g = globalThis as unknown as Record<string, unknown>
  if (g.DOMMatrix) return 'déjà présent'
  g.DOMMatrix = DOMMatrixMinimal
  return 'substitut'
}

export interface TextLayer {
  /** Texte intégral du document (vide sur un pur scan). */
  full: string
  /** Texte de la première page — sert à l'analyse d'en-tête. */
  firstPage: string
  /** Provenance de `DOMMatrix`, utile au diagnostic en production. */
  dommatrix: string
}

/**
 * Lit la couche texte d'un PDF. Ne jette JAMAIS : un PDF sans couche texte, chiffré ou
 * illisible rend une couche vide, que l'appelant traite comme un scan (`textLayer: false`).
 */
export async function pdfTextLayer(bytes: Uint8Array): Promise<TextLayer> {
  const dommatrix = ensureDOMMatrix()
  try {
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: bytes })
    try {
      const result = await parser.getText()
      return { full: result.text, firstPage: result.pages[0]?.text ?? '', dommatrix }
    } finally {
      await parser.destroy()
    }
  } catch {
    return { full: '', firstPage: '', dommatrix }
  }
}
