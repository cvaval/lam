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
 * ⚠️ LE RÉCIT DE LA MARQUE, dont découlent toutes les règles :
 *   « Le trait rouge est la marque du CERTIFICATEUR ; le jaune Sitwon est la couleur de
 *     l'USAGE. »
 *   WOUJ ne paraît que là où Lam engage sa rigueur — logotype, statut d'un texte, alerte de
 *   certification. SITWON est l'action du lecteur — le bouton, le terme trouvé, le document
 *   vérifié.
 *
 * ⚠️ RÈGLES NON NÉGOCIABLES :
 *  1. WOUJ est rationné à UNE occurrence d'INTERFACE par écran (montant critique, statut
 *     « Abrogé », erreur, alerte de certification). Le LOGOTYPE en est EXEMPT.
 *     Jamais en fond, jamais en texte courant.
 *  2. SITWON : CTA principal (fond Sitwon, texte Chabon — jamais l'inverse), badge
 *     « Dokiman verifye », surlignage du terme exact, soulignement de navigation active.
 *     Jamais en fond de page ni en grande surface, JAMAIS comme couleur de texte.
 *     Absent du logotype.
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
  /** Trait du CERTIFICATEUR — rouge du bicolore haïtien. Rationné hors logotype (règle 1). */
  wouj: '#D21034',
  /** Couleur de l'USAGE — CTA, badge vérifié, surligneur. Absent du logotype (règle 2). */
  sitwon: '#FDD228',
  /** Texte juridique long */
  ank: '#3F4043',
  /** Filets · bordures · séparateurs */
  liy: '#D8D7D2',
  /** Pilules · contrôles secondaires */
  pil: '#F2F1EE',
  /** Seul dérivé admis de Sitwon — surlignage étendu, fonds de sélection (texte Ank). */
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
