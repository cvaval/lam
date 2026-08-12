/**
 * SOURCE UNIQUE de la palette de marque Lam — système « Klinik » v3.0, CHARTE GELÉE.
 * Réf. LAM-BRAND-2026-08-V3 · remplace Klinik v2.x et « Lam Veritab » v1.0.
 * Toute modification ultérieure par avenant numéroté uniquement.
 *
 * Consommée par tailwind.config.ts, le logotype, le sceau PDF et les annexes générées :
 * l'audit de juin avait constaté que la palette était recopiée en trois endroits.
 *
 * Module-feuille SANS import : utilisable partout, y compris par tailwind.config.ts
 * (chargé hors du bundle applicatif).
 *
 * ─── AVENANT AV-03 · 12 août 2026 — LES DEUX ACCENTS SONT ÉCHANGÉS ─────────────────
 * Le récit de la v3.0 faisait du rouge le trait du CERTIFICATEUR et du jaune la couleur
 * de l'USAGE. Le site inverse les deux rôles :
 *
 *   WOUJ   conduit l'ACTION — CTA, bouton Connexion, bouton de recherche, lien actif,
 *          indicateur actif, soulignement éditorial, anneau de focus.
 *   SITWON atteste la VÉRIFICATION — badge « Dokiman verifye », marque de document
 *          vérifié, surlignage d'une information vérifiée.
 *
 * Ce que l'échange emporte, et qu'il ne faut pas manquer :
 *  - le RATIONNEMENT du Wouj tombe. Une couleur d'action ne peut pas être rationnée à une
 *    occurrence par écran : elle doit être là où l'on agit, partout et de la même façon.
 *    Ce qui demeure, c'est qu'elle ne serve jamais de fond de page ni de grande surface.
 *  - le Wouj devient une couleur de TEXTE et de FOND DE BOUTON, ce que la v3.0 interdisait.
 *    Sur bouton, le texte passe donc en BLAN : Blan sur Wouj vaut 5,43:1, quand Chabon sur
 *    Wouj ne vaut que 2,76:1 — sous le seuil, illisible.
 *  - le Sitwon quitte les boutons. Il reste interdit comme couleur de TEXTE (1,2:1 sur
 *    Koton) et garde son texte Chabon sur fond jaune (7,08:1).
 *
 * ⚠️ RÈGLES NON NÉGOCIABLES :
 *  1. WOUJ conduit l'action. Fond de bouton avec texte BLAN, ou trait (lien actif,
 *     soulignement, anneau de focus, filet éditorial). Jamais en fond de page ni en
 *     grande surface. Le logotype garde son filet Wouj.
 *  2. SITWON atteste. Badge « Dokiman verifye » et surlignage d'une information vérifiée,
 *     fond Sitwon et texte Chabon — jamais l'inverse. Jamais en fond de page, JAMAIS
 *     comme couleur de texte. Absent du logotype.
 *  3. Tout texte juridique se lit sur BLAN. Koton n'accueille jamais plus de deux lignes
 *     de texte continu.
 *  4. Noir pur #000000 INTERDIT — les bornes sombres sont Chabon et Ank.
 *  5. CRITÈRE BLOQUANT : aucune information portée par la couleur seule. Tout état succès
 *     (Vèt) ou erreur (Wouj) porte son libellé textuel ou son pictogramme — la luminance
 *     Vèt/Wouj est de 1,05:1, indiscernable en daltonisme rouge-vert.
 *
 * ─── AVENANT AV-02 · 11 août 2026 — GAMME CARTOGRAPHIQUE ────────────────────────────
 * Ajoute BLE et admet une gamme catégorielle Wouj / Sitwon / Vèt / Ble POUR LE SEUL CADRE
 * CARTOGRAPHIQUE : toile de la carte judiciaire, sa légende, ses filtres de couche et les
 * fiches de tribunaux qui en reprennent le codage (`COURT_STYLE`). Hors de ce cadre, les
 * règles 1 et 2 s'appliquent inchangées.
 *
 * Pourquoi une exception plutôt qu'un contournement : une carte thématique n'est pas de
 * la chromatique d'interface, c'est un ENCODAGE DE DONNÉE. Quatre ordres de juridiction
 * exigent quatre teintes séparables ; avant cet avenant, TPI et Cassation portaient tous
 * deux #414042 et seule la forme les distinguait. Le rationnement du Wouj vise l'état
 * d'interface (« Abrogé », erreur) — pas la légende d'une carte.
 *
 * La règle 5 reste PLEINEMENT en vigueur et c'est elle qui rend l'avenant admissible :
 * chaque ordre porte AUSSI une forme propre (cercle / triangle / carré / losange) et son
 * libellé en légende. La couleur ne porte jamais seule. Contrôles menés :
 *   Ble  sur Koton  10,1:1   ·  Wouj sur Koton  4,5:1   ·  Vèt sur Koton  4,8:1
 *   Sitwon sur Koton 1,2:1 — INSUFFISANT SEUL : le contour Chabon de 2,5 px porte la
 *   forme (Sitwon/Chabon = 7,1:1). Aucun marqueur ne doit être dessiné sans ce contour.
 */
export const BRAND_COLORS = {
  /** Sombre de référence · bandeaux · wordmark · boutons primaires */
  chabon: '#414042',
  /** Héros · bannières · surfaces institutionnelles */
  adwaz: '#3E4A4D',
  /** Fond de page universel */
  koton: '#EAE9E5',
  /** Surfaces de lecture · cartes · modales */
  blan: '#FFFFFF',
  /** Texte d'interface */
  grafit: '#55565A',
  /** Couleur de l'ACTION — CTA (texte Blan), lien actif, focus, filet (AV-03, règle 1). */
  wouj: '#D21034',
  /** Couleur de la VÉRIFICATION — badge « Dokiman verifye », surlignage attesté (règle 2). */
  sitwon: '#FDD228',
  /** Texte juridique long */
  ank: '#3F4043',
  /** Filets · bordures · séparateurs */
  liy: '#D8D7D2',
  /** Pilules · contrôles secondaires */
  pil: '#F2F1EE',
  /** Seul dérivé admis de Sitwon — passage vérifié étendu, fond de sélection (texte Ank). */
  sitwonPal: '#FFF3C6',
  /** Succès — accent fonctionnel. Libellé ou pictogramme OBLIGATOIRE (règle 5). */
  vet: '#347436',
  /**
   * Bleu du bicolore haïtien — frère du Wouj déjà inscrit à la palette (AV-02).
   * RÉSERVÉ à la gamme cartographique : ni CTA, ni lien, ni état. 10,1:1 sur Koton.
   */
  ble: '#00209F',
  /** Texte sur Chabon / Adwaz */
  inverse: '#EDEDEB',
  /** Bordure des pastilles de type */
  badgeBorder: '#C7C6C1',
} as const

/** Convertit un hex `#RRGGBB` en triplet 0–1 (pour pdf-lib `rgb()`). */
export function hexToRgb01(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
