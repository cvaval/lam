import type { Config } from 'tailwindcss'
import { BRAND_COLORS as C } from './src/lib/brand-colors'

/**
 * Lam — système chromatique « Klinik » v3.0, CHARTE GELÉE (LAM-BRAND-2026-08-V3).
 *
 * Le codage des types par la TEINTE, qui traversait la v1.0, a été remplacé par un codage
 * TYPOGRAPHIQUE : pastilles uniformes portant un code en IBM Plex Mono (LÉG · BRH · JUR ·
 * DOC · FIN · MRK · IDX · TAR) — voir src/lib/brand.ts.
 *
 * ⚠️ DEUX ACCENTS, DEUX RÉCITS — ne pas les intervertir :
 *   WOUJ   le trait du CERTIFICATEUR — logotype (hors quota), statut « Abrogé », erreur,
 *          alerte de certification. Rationné à UNE occurrence d'interface par écran.
 *   SITWON la couleur de l'USAGE — CTA principal, badge « Dokiman verifye », surligneur du
 *          terme exact, soulignement de navigation active. JAMAIS en couleur de texte.
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
        // ── Accent fonctionnel, HORS marque : succès uniquement ──
        vet: C.vet,
        // ── Gamme cartographique (AV-02) : carte judiciaire uniquement, jamais un CTA ──
        ble: C.ble,
        // Texte sur fond sombre (Chabon / Adwaz).
        inverse: C.inverse,
      },
      // Trois familles NORMATIVES, toutes embarquées (variables posées au layout racine).
      // Aucune police système : la typographie est un élément de marque.
      fontFamily: {
        sans: ['var(--font-franklin)', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
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
