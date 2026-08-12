import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { can } from '../rbac'

/**
 * PÉRIMÈTRE DU RÔLE ÉDITEUR — curation du corpus d'un côté, gouvernance de l'autre.
 *
 * ⚠️ CE FICHIER PROTÈGE UN DÉFAUT QUI NE SE VOIT PAS À L'ÉCRAN : ouvrir une page sans
 * ouvrir sa route d'API donne un formulaire qui s'affiche, accepte la saisie, puis échoue.
 * Du point de vue de l'utilisateur ce n'est pas un refus de droits, c'est un travail perdu.
 * Le test de matrice ci-dessous relit les fichiers et refuse que les deux gardes divergent.
 */

const R = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

/** Écrans ouverts à la CURATION : page et route doivent porter la même garde. */
const CURATION: { nom: string; page: string; routes: string[] }[] = [
  { nom: 'Le Moniteur', page: 'src/app/[locale]/admin/moniteur/page.tsx', routes: ['src/app/api/admin/moniteur/gaps/route.ts'] },
  { nom: 'Moniteur — manquants', page: 'src/app/[locale]/admin/moniteur/manquants/page.tsx', routes: [] },
  { nom: 'Index du Moniteur', page: 'src/app/[locale]/admin/index-moniteur/page.tsx', routes: ['src/app/api/admin/index-moniteur/route.ts'] },
  { nom: 'Marques', page: 'src/app/[locale]/admin/marques/page.tsx', routes: ['src/app/api/admin/marques/route.ts', 'src/app/api/admin/marques/[id]/file/route.ts'] },
  { nom: 'Circulaires BRH', page: 'src/app/[locale]/admin/brh/page.tsx', routes: ['src/app/api/admin/brh/gaps/route.ts'] },
  { nom: 'Tarifs douaniers', page: 'src/app/[locale]/admin/tarifs/page.tsx', routes: ['src/app/api/admin/tarifs/route.ts'] },
  { nom: 'Carte judiciaire', page: 'src/app/[locale]/admin/juridictions/page.tsx', routes: ['src/app/api/admin/jurisdictions/route.ts'] },
  { nom: 'Thèmes', page: 'src/app/[locale]/admin/themes/page.tsx', routes: ['src/app/api/admin/themes/route.ts'] },
  { nom: 'Outils éditoriaux', page: 'src/app/[locale]/admin/document/[id]/page.tsx', routes: ['src/app/api/admin/legislation/route.ts'] },
]

/** Écrans de GOUVERNANCE : ils doivent rester au master admin. */
const GOUVERNANCE: { nom: string; page: string; routes: string[] }[] = [
  { nom: 'Vue d’ensemble', page: 'src/app/[locale]/admin/page.tsx', routes: [] },
  { nom: 'Utilisateurs', page: 'src/app/[locale]/admin/users/page.tsx', routes: ['src/app/api/admin/users/route.ts', 'src/app/api/admin/users/create/route.ts'] },
  { nom: 'Codes promo', page: 'src/app/[locale]/admin/promo/page.tsx', routes: ['src/app/api/admin/promo/route.ts', 'src/app/api/admin/promo/assign/route.ts'] },
  { nom: 'Logs de sécurité', page: 'src/app/[locale]/admin/logs/page.tsx', routes: [] },
]

describe('matrice d’accès du rôle Éditeur', () => {
  it('l’Éditeur peut curer le corpus, les lecteurs non', () => {
    expect(can('EDITEUR', 'corpus.manage')).toBe(true)
    expect(can('MASTER_ADMIN', 'corpus.manage')).toBe(true)
    for (const r of ['SITWAYEN', 'PWOFESYONEL', 'ENSTITISYON'] as const) {
      expect(can(r, 'corpus.manage')).toBe(false)
    }
  })

  it('l’Éditeur n’administre JAMAIS les comptes', () => {
    // La garantie du périmètre : l'écran Utilisateurs permettrait de se donner les droits
    // qu'on n'a pas.
    expect(can('EDITEUR', 'admin.accounts')).toBe(false)
  })
})

describe('page et route bougent ensemble', () => {
  it.each(CURATION)('$nom — ouvert à la curation des deux côtés', ({ page, routes }) => {
    const p = R(page)
    expect(p).toContain("requireCapability(locale, 'corpus.manage')")
    expect(p).not.toMatch(/requireAdmin\(/)
    for (const route of routes) {
      const s = R(route)
      // Soit la garde partagée, soit le test de capacité écrit à la main — mais jamais un
      // test de rôle « MASTER_ADMIN » qui refermerait la route sur le master admin.
      expect(s).toMatch(/requireCapabilityApi\('corpus\.manage'\)|can\(user\.role, 'corpus\.manage'\)/)
      expect(s).not.toContain('requireAdminApi')
    }
  })

  it.each(GOUVERNANCE)('$nom — reste au master admin des deux côtés', ({ page, routes }) => {
    const p = R(page)
    expect(p).toMatch(/requireAdmin\(locale\)|user\.role !== 'MASTER_ADMIN'/)
    for (const route of routes) {
      expect(R(route)).toContain('requireAdminApi')
    }
  })
})

describe('les suppressions restent au master admin', () => {
  it('Index du Moniteur refuse `deletedIds` à un éditeur', () => {
    expect(R('src/app/api/admin/index-moniteur/route.ts')).toContain(
      "if ((deletedIds ?? []).length && user.role !== 'MASTER_ADMIN') return apiError('forbidden', 403)",
    )
  })

  it('la suppression d’une marque reste au master admin', () => {
    const s = R('src/app/api/admin/marques/route.ts')
    const del = s.slice(s.indexOf('export async function DELETE'))
    expect(del).toContain("user.role !== 'MASTER_ADMIN'")
  })

  it('le bouton de suppression est DÉSACTIVÉ, pas caché ni actif-mais-voué-à-l’échec', () => {
    const s = R('src/components/MarqueEditor.tsx')
    expect(s).toContain('disabled={!peutSupprimer}')
    expect(s).toContain('MOTIF_SUPPRESSION')
  })
})
