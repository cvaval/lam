import type { Config } from 'tailwindcss'
import { BRAND_COLORS as C } from './src/lib/brand-colors'

/**
 * Agora — palette du kit de marque v2, posée sur les jetons Klinik (voir la table de
 * correspondance en tête de src/lib/brand-colors.ts : les noms créoles ne disent plus la
 * teinte).
 *
 * ⚠️ `wouj` A DEUX VALEURS, ET C'EST VOULU. La charte Agora sépare ce que Klinik confondait :
 * le BOUTON PRINCIPAL est bleu encre, texte blanc ; la TERRE CUITE est l'accent (lien actif,
 * filet, bordure, focus). `bg-wouj` (50 boutons, tous texte blanc — brand-accents.test.ts)
 * se résout donc en encre via `backgroundColor`, et toutes les autres utilités `*-wouj` en
 * terre cuite via `colors`.
 *
 * Le codage des types reste TYPOGRAPHIQUE : pastilles uniformes portant un code en IBM Plex
 * Mono (LÉG · BRH · JUR · DOC · FIN · MRK · IDX · TAR) — voir src/lib/brand.ts.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // ── Couleurs de marque ──
        chabon: C.chabon,
        adwaz: C.adwaz,
        koton: C.koton,
        blan: C.blan,
        grafit: C.grafit,
        wouj: C.wouj,
        sitwon: C.sitwon,
        // ── Couleurs de soutien ──
        ank: C.ank,
        liy: C.liy,
        pil: C.pil,
        'wouj-pal': C.woujPal,
        // Filet appuyé des pastilles de type. Il vivait dans brand-colors.ts sans être
        // enregistré ici : aucune classe ne le résolvait, d'où deux littéraux en dur.
        'liy-fonse': C.badgeBorder,
        // ── Accent fonctionnel, HORS marque : succès uniquement ──
        vet: C.vet,
        // ── Gamme cartographique (AV-02) : carte judiciaire uniquement, jamais un CTA ──
        ble: C.ble,
        // Texte sur fond sombre (Chabon / Adwaz).
        inverse: C.inverse,
      },
      backgroundColor: {
        // Bouton principal = encre (charte Agora § 6). Voir l'en-tête.
        wouj: C.action,
      },
      // Trois familles NORMATIVES, toutes embarquées (variables posées au layout racine).
      // Aucune police système : la typographie est un élément de marque.
      fontFamily: {
        sans: ['var(--font-inter)', 'Arial', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        // Corpus juridique — Source Serif 4, axe optique. Remplace Georgia.
        serif: ['var(--font-source-serif)', 'Georgia', 'Cambria', 'serif'],
        // Codes de type des pastilles, références du Moniteur, montants, empreintes.
        mono: ['var(--font-plex-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      // Échelle NORMATIVE de la charte — aucune taille improvisée hors de celle-ci.
      fontSize: {
        'display-1': ['44px', { lineHeight: '1.08', letterSpacing: '-0.02em', fontWeight: '500' }],
        'display-2': ['36px', { lineHeight: '1.10', letterSpacing: '-0.02em', fontWeight: '500' }],
        'display-3': ['28px', { lineHeight: '1.15', letterSpacing: '-0.015em', fontWeight: '500' }],
        body: ['16px', { lineHeight: '1.6' }],
        'body-sm': ['14px', { lineHeight: '1.55' }],
        label: ['12px', { lineHeight: '1.3', letterSpacing: '0.14em', fontWeight: '600' }],
        'label-sm': ['11px', { lineHeight: '1.3', letterSpacing: '0.14em', fontWeight: '600' }],
        legal: ['17px', { lineHeight: '1.7' }],
        meta: ['12px', { lineHeight: '1.6' }],
      },
      boxShadow: {
        // ⚠️ ÉLÉVATION ZÉRO (charte v3.0) : la hiérarchie se fait par les fonds et les
        // bordures Liy, jamais par l'ombre. `card` est conservé comme ALIAS NEUTRE le temps
        // de la purge ; l'ombre douce n'est admise que sur modales et menus flottants.
        card: 'none',
        flottant: '0 4px 16px rgba(65,64,66,0.10)',
      },
    },
  },
  plugins: [],
}

export default config
