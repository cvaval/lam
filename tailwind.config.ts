import type { Config } from 'tailwindcss'
import { BRAND_COLORS } from './src/lib/brand-colors'

/**
 * Lam Veritab — design tokens (§01 du plan).
 *
 * Le système de couleurs traverse toute la plateforme : pastilles, badges,
 * filtres, badges de résultats, admin. Chaque type de document (1–6) reçoit
 * une couleur unique.
 *
 *   Lank   — Légistation (type 1) · couleur de marque, fond admin, texte profond
 *   Solèy  — Circulaires BRH (type 2) · couleur de marque
 *   Brim   — Jurisprudence (type 3) · couleur de marque
 *   Lagon  — Doctrine (type 4) · accent fonctionnel  #9ADCDC  (valeur exacte du plan)
 *   Fèy    — Lois de finances (type 5) · accent fonctionnel  #3a5505 (valeur exacte du plan)
 *   Sitwon — Marques (type 6) · couleur de marque, anneau de focus, surlignage des termes
 *
 * Lagon (#9ADCDC) et Fèy (#3a5505) sont fixés par le plan. Lank/Solèy/Brim/Sitwon
 * sont des valeurs de travail cohérentes, à réconcilier avec le Brand Book v1.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // — Couleurs de marque officielles (Brand Book : navy profond + vert lime) —
        // DEFAULT/700 dérivés de BRAND_COLORS (source unique, src/lib/brand-colors.ts).
        lank: { DEFAULT: BRAND_COLORS.lank, 50: '#eceef4', 100: '#c9cdde', 600: '#2c3360', 700: BRAND_COLORS.lank, 900: '#10132a' },
        // Accents fonctionnels par type — distincts de Sitwon, jamais hors badges —
        soley: { DEFAULT: '#F4A823', 50: '#fef6e7', 100: '#fde7bd', 600: '#d98c0c', 700: '#a96a08' },
        brim: { DEFAULT: '#5E7488', 50: '#eef1f4', 100: '#d4dbe2', 600: '#4b5e70', 700: '#3a4a58' },
        lagon: { DEFAULT: '#9ADCDC', 50: '#effafa', 100: '#cdeeee', 600: '#5fb9b9', 700: '#3f9696' },
        fey: { DEFAULT: '#3A5505', 50: '#f0f4e6', 100: '#d8e3b8', 600: '#3a5505', 700: '#2b3f04' },
        // Sitwon = le vert lime de la marque (fruit, anneau de focus, surlignage) —
        sitwon: { DEFAULT: BRAND_COLORS.sitwon, 50: '#f1fae1', 100: '#dcf2b9', 600: '#7cb23a', 700: '#5e8a2a' },
        // Endèks = mauve de l'Index du Moniteur (7ᵉ service, références) —
        endeks: { DEFAULT: '#7C6F9B', 50: '#f1eff6', 100: '#dcd6e8', 600: '#5f5379', 700: '#473e5c' },
        // — Surfaces neutres —
        paper: '#FBFAF7', // fond crème « papier juridique »
        cream: BRAND_COLORS.cream, // crème du logotype sur fond navy
        ink: BRAND_COLORS.lank,
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(27,31,61,0.04), 0 8px 24px rgba(27,31,61,0.06)',
        // L'anneau de focus Sitwon (accessibilité §06) et le shimmer des squelettes
        // vivent dans globals.css (*:focus-visible et .skeleton) — pas de token ici.
      },
    },
  },
  plugins: [],
}

export default config
