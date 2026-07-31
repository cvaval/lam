import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

/**
 * tsconfig.json porte `"jsx": "preserve"` (Next transpile lui-même) : vitest s'y conforme et
 * refusait alors tout fichier `.tsx`. Aucun test ne pouvait donc RENDRE un composant — c'est
 * par ce trou que les tableaux de la circulaire 105-2 se sont retrouvés rendus 22 fois sans
 * qu'aucune vérification ne s'en aperçoive. On force ici la transformation JSX pour les
 * tests, sans toucher à la configuration de build.
 */
export default defineConfig({
  // Vite transpile via oxc et LIT le `jsx` du tsconfig : on le surcharge pour les seuls
  // tests, la configuration de build restant intacte.
  oxc: { jsx: { runtime: 'automatic' } } as never,
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
})
