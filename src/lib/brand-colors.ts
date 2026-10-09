/**
 * SOURCE UNIQUE de la palette de marque — **AGORA** (kit de marque v2, octobre 2026).
 *
 * ─── CORRESPONDANCE · les noms créoles MENTENT désormais (D3, lot 2) ──────────────────
 * Les jetons gardent leurs noms Klinik : les renommer toucherait ~2 700 classes pour rien
 * (hors périmètre, § 7 du prompt). Seules leurs VALEURS sont ré-pointées :
 *
 *   jeton      rôle dans l'interface                    Agora
 *   chabon     sombre de référence, wordmark, bandeaux  encre        #152E38
 *   ank        texte juridique long                     encre        #152E38
 *   adwaz      héros, surfaces institutionnelles        surface sombre #1B3039
 *   grafit     texte d'interface secondaire             ardoise      #52656B
 *   koton      fond de page                             ivoire       #F7F5EF
 *   blan       cartes, lecture                          blanc        #FFFFFF
 *   pil        surfaces secondaires, pilules            sauge        #E7ECE7
 *   liy        filets décoratifs                        ligne        #D7DCD7
 *   wouj       ACCENT : lien actif, filet, bordure      terre cuite  #9B422C (« wouj » n'est plus rouge)
 *   fond wouj  BOUTON PRINCIPAL                          encre        #152E38 (charte § 6 : « bouton
 *              principal : bleu et texte blanc ») — surcharge `backgroundColor` de tailwind.config.ts
 *   sitwon     pastille « Abrogé », mention d'état      fond attention #FFF4DB, texte encre
 *   woujPal    sélection, surlignage étendu             terre cuite pâle #F1E2DA
 *   vet        succès                                   #23665D
 *   ble        gamme CARTOGRAPHIQUE seule (AV-02)       inchangé #00209F
 *   carteMer   mer de la carte judiciaire (cartographie) ardoise diluée #DCE5E8 (terre en blanc)
 *   carteRouge première instance sur la carte (cartographie) rouge du kit #B13D35
 *
 * Consommée par tailwind.config.ts, le sceau PDF et les annexes générées. Module-feuille SANS
 * import : utilisable partout, y compris par tailwind.config.ts (chargé hors du bundle).
 *
 * ⚠️ RÈGLES QUI SURVIVENT AU CHANGEMENT DE MARQUE :
 *  1. Aucune information portée par la couleur seule : tout état (succès, erreur, « Abrogé »)
 *     porte son libellé ou son pictogramme (charte Agora § 3, « États fonctionnels »).
 *  2. Noir pur #000000 interdit — la borne sombre est l'encre.
 *  3. La terre cuite ne sert ni de fond de page ni de grande surface ; sur bouton, c'est
 *     l'encre qui porte (blanc dessus : 14,19:1). Terre cuite sur ivoire : 6,00:1.
 *  4. Tout texte juridique se lit sur blanc.
 *
 * L'histoire Klinik (avenants AV-02 à AV-04, rationnement des accents) reste lisible dans
 * l'historique Git de ce fichier et dans `docs/analyse-pack-marque-v4.md`.
 */
export const BRAND_COLORS = {
  /** Sombre de référence · bandeaux · wordmark · boutons primaires */
  chabon: '#152E38',
  /** Héros · bannières · surfaces institutionnelles */
  adwaz: '#1B3039',
  /** Fond de page universel */
  koton: '#F7F5EF',
  /** Surfaces de lecture · cartes · modales */
  blan: '#FFFFFF',
  /** Texte d'interface */
  grafit: '#52656B',
  /** Couleur de l'ACTION — CTA (texte Blan), lien actif, focus, filet (AV-03, règle 1). */
  wouj: '#9B422C',
  /** Couleur de la VÉRIFICATION — badge « Dokiman verifye », surlignage attesté (règle 2). */
  sitwon: '#FFF4DB',
  /** Texte juridique long */
  ank: '#152E38',
  /** Filets · bordures · séparateurs */
  liy: '#D7DCD7',
  /** Pilules · contrôles secondaires */
  pil: '#E7ECE7',
  /** Seul dérivé admis (AV-02) — surlignage étendu et fond de sélection, texte Ank (8,41:1, AAA). */
  woujPal: '#F1E2DA',
  /** Succès — accent fonctionnel. Libellé ou pictogramme OBLIGATOIRE (règle 5). */
  vet: '#23665D',
  /**
   * Bleu du bicolore haïtien — frère du Wouj déjà inscrit à la palette (AV-02).
   * RÉSERVÉ à la gamme cartographique : ni CTA, ni lien, ni état. 10,1:1 sur Koton.
   */
  ble: '#00209F',
  /**
   * Mer de la carte judiciaire — gamme CARTOGRAPHIQUE seule (comme `ble`). Ardoise très diluée :
   * la terre (blanc) s'en détache (1,28:1, figure sur fond) et le trait de côte en encre la borde
   * à plus de 11:1. Depuis le passage à Agora, terre et mer étaient toutes deux en ivoire : l'île
   * n'existait que par ses filets.
   */
  carteMer: '#DCE5E8',
  /**
   * Rouge du kit Agora (état « erreur », #B13D35), employé ici en gamme CARTOGRAPHIQUE seule : il
   * code la première instance sur la carte judiciaire (5,9:1 sur la terre blanche). Avec `ble`
   * pour les tribunaux de paix, les deux couches les plus nombreuses portent le bicolore haïtien.
   */
  carteRouge: '#B13D35',
  /** Texte sur Chabon / Adwaz */
  inverse: '#F7F5EF',
  /** Fond du BOUTON PRINCIPAL (utilité de fond du jeton wouj) — encre, charte Agora § 6. */
  action: '#152E38',
  /** Bordure des pastilles de type */
  badgeBorder: '#C5CDC7',
} as const

/** Convertit un hex `#RRGGBB` en triplet 0–1 (pour pdf-lib `rgb()`). */
export function hexToRgb01(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
