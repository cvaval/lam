import localFont from 'next/font/local'

/**
 * LES TROIS FAMILLES NORMATIVES de la charte « Klinik » v3.0 — VENDORISÉES.
 *
 * ⚠️ Pourquoi des fichiers dans le dépôt plutôt que `next/font/google` : ce dernier
 * télécharge les fontes DEPUIS GOOGLE À CHAQUE COMPILATION. Rien n'en subsiste dans le
 * dépôt (les 32 woff2 ne vivaient que dans `.next/`, artefact de build) : une machine hors
 * ligne, un pare-feu ou une indisponibilité de fonts.gstatic.com fait échouer le build, et
 * la typographie est un élément de MARQUE — elle ne peut pas dépendre d'un tiers.
 *
 * ⚠️ Le sous-ensemble `latin-ext` est indispensable : sans lui, les diacritiques du français
 * et du créole (è, ò, à, î, ç) retombent sur une fonte de repli EN PLEIN MOT.
 * Les `unicode-range` sont ceux de Google Fonts : le navigateur ne charge le fichier
 * latin-ext que s'il rencontre un caractère qui l'exige.
 *
 * Graisses conformes à la charte :
 *   Libre Franklin  300–700 + italique 400   display, interface
 *   Source Serif 4  400/600 + italique 400   corpus juridique
 *   IBM Plex Mono   400/500                  codes de type, références, montants
 */

const LATIN =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,' +
  'U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
const LATIN_EXT =
  'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,' +
  'U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF'

/** Display et interface — titres en bas-de-casse, étiquettes en capitales espacées. */
export const franklin = localFont({
  variable: '--font-franklin',
  display: 'swap',
  src: [
    { path: './LibreFranklin-300-normal-latin.woff2', weight: '300', style: 'normal' },
    { path: './LibreFranklin-300-normal-latin-ext.woff2', weight: '300', style: 'normal' },
    { path: './LibreFranklin-400-normal-latin.woff2', weight: '400', style: 'normal' },
    { path: './LibreFranklin-400-normal-latin-ext.woff2', weight: '400', style: 'normal' },
    { path: './LibreFranklin-400-italic-latin.woff2', weight: '400', style: 'italic' },
    { path: './LibreFranklin-400-italic-latin-ext.woff2', weight: '400', style: 'italic' },
    { path: './LibreFranklin-500-normal-latin.woff2', weight: '500', style: 'normal' },
    { path: './LibreFranklin-500-normal-latin-ext.woff2', weight: '500', style: 'normal' },
    { path: './LibreFranklin-600-normal-latin.woff2', weight: '600', style: 'normal' },
    { path: './LibreFranklin-600-normal-latin-ext.woff2', weight: '600', style: 'normal' },
    { path: './LibreFranklin-700-normal-latin.woff2', weight: '700', style: 'normal' },
    { path: './LibreFranklin-700-normal-latin-ext.woff2', weight: '700', style: 'normal' },
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

export const FONT_VARS = `${franklin.variable} ${sourceSerif.variable} ${plexMono.variable}`

/** Plages Unicode, exportées pour documentation — `next/font/local` les déduit du fichier. */
export const UNICODE_RANGES = { latin: LATIN, latinExt: LATIN_EXT }
