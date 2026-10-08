import localFont from 'next/font/local'

/**
 * LES TROIS FAMILLES DE LA MARQUE — VENDORISÉES. Charte Agora v2 : Inter (interface),
 * Source Serif 4 (voix éditoriale, corpus) ; IBM Plex Mono est conservée pour les codes de
 * type et les références, que le kit ne couvre pas (D4 : Inter ne distingue pas assez
 * `l` / `1` / `I` dans une référence).
 *
 * ⚠️ Pourquoi des fichiers dans le dépôt plutôt que `next/font/google` : ce dernier
 * télécharge les fontes DEPUIS GOOGLE À CHAQUE COMPILATION. Une machine hors ligne, un
 * pare-feu ou une indisponibilité de fonts.gstatic.com fait échouer le build, et la
 * typographie est un élément de MARQUE — elle ne peut pas dépendre d'un tiers.
 *
 * ⚠️ Le sous-ensemble `latin-ext` est indispensable : sans lui, les diacritiques du français
 * et du créole (è, ò, à, î, ç) retombent sur une fonte de repli EN PLEIN MOT.
 * Les `unicode-range` sont ceux de Google Fonts : le navigateur ne charge le fichier
 * latin-ext que s'il rencontre un caractère qui l'exige.
 *
 * Inter vient du kit Agora v2 (`agora-font-7` = latin, `agora-font-6` = latin-ext, identifiés
 * par les `unicode-range` de son `fonts.css`) : fonte VARIABLE, graisses 400 à 700. Les
 * découpes cyrilliques, grecques et vietnamiennes du kit ne sont pas embarquées.
 *
 * Graisses :
 *   Inter           400–700 (variable)       interface, navigation, formulaires
 *   Source Serif 4  400/600 + italique 400   titres éditoriaux, corpus juridique
 *   IBM Plex Mono   400/500                  codes de type, références, montants
 */

const LATIN =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,' +
  'U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
const LATIN_EXT =
  'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,' +
  'U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF'

/** Interface — navigation, formulaires, boutons, métadonnées (charte Agora § 4). */
export const inter = localFont({
  variable: '--font-inter',
  display: 'swap',
  src: [
    { path: './Inter-var-normal-latin.woff2', weight: '400 700', style: 'normal' },
    { path: './Inter-var-normal-latin-ext.woff2', weight: '400 700', style: 'normal' },
  ],
})

/** Corpus juridique — sur Blan, en Ank, 17 px / 1,7. Remplace Georgia. */
export const sourceSerif = localFont({
  variable: '--font-source-serif',
  display: 'swap',
  src: [
    { path: './SourceSerif4-400-normal-latin.woff2', weight: '400', style: 'normal' },
    { path: './SourceSerif4-400-normal-latin-ext.woff2', weight: '400', style: 'normal' },
    { path: './SourceSerif4-400-italic-latin.woff2', weight: '400', style: 'italic' },
    { path: './SourceSerif4-400-italic-latin-ext.woff2', weight: '400', style: 'italic' },
    { path: './SourceSerif4-600-normal-latin.woff2', weight: '600', style: 'normal' },
    { path: './SourceSerif4-600-normal-latin-ext.woff2', weight: '600', style: 'normal' },
  ],
})

/** Codes de type des pastilles, références du Moniteur, montants, empreintes. */
export const plexMono = localFont({
  variable: '--font-plex-mono',
  display: 'swap',
  src: [
    { path: './IBMPlexMono-400-normal-latin.woff2', weight: '400', style: 'normal' },
    { path: './IBMPlexMono-400-normal-latin-ext.woff2', weight: '400', style: 'normal' },
    { path: './IBMPlexMono-500-normal-latin.woff2', weight: '500', style: 'normal' },
    { path: './IBMPlexMono-500-normal-latin-ext.woff2', weight: '500', style: 'normal' },
  ],
})

export const FONT_VARS = `${inter.variable} ${sourceSerif.variable} ${plexMono.variable}`

/** Plages Unicode, exportées pour documentation — `next/font/local` les déduit du fichier. */
export const UNICODE_RANGES = { latin: LATIN, latinExt: LATIN_EXT }
