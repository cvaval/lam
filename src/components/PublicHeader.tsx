import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'

/**
 * En-tête des pages PUBLIQUES — accueil, publications, pages légales.
 *
 * Il était recopié dans quatre fichiers, avec quatre apparences : blanc translucide sur
 * l'accueil, bandeau Chabon sur les publications et les pages légales. Une seule
 * définition, désormais : le visiteur retrouve la même barre où qu'il entre.
 *
 * Blanc translucide + `backdrop-blur` : au défilement, le contenu passe DERRIÈRE l'en-tête
 * sans le rendre illisible. `sticky` et non `fixed` — le contenu ne passe pas dessous au
 * chargement et aucune compensation de hauteur n'est nécessaire.
 *
 * ⚠️ TENUE À 320 px : sous 360 px l'écart et le rembourrage se resserrent, faute de quoi
 * l'ensemble « langues + Connexion » débordait de 16 px et faisait défiler la page
 * horizontalement. Le bouton porte `whitespace-nowrap` pour ne jamais se couper en deux.
 */
export function PublicHeader({
  locale,
  t,
  width = 'max-w-6xl',
  back,
}: {
  locale: Locale
  t: Dictionary
  /** Largeur du contenu — alignée sur celle de la page hôte. */
  width?: string
  /** Lien de retour facultatif, à la place du bouton Connexion (pages de lecture). */
  back?: { href: string; label: string }
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-liy bg-white/95 backdrop-blur">
      <div className={`mx-auto flex ${width} items-center justify-between px-4 py-4`}>
 <Link href={`/${locale}`} aria-label="Lam"className="inline-flex min-h-[44px] items-center rounded-lg transition hover:opacity-80">
          <Logo size={30} />
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <LocaleSwitcher current={locale} />
          {back ? (
            <Link
              href={back.href}
 className="inline-flex min-h-[44px] items-center whitespace-nowrap rounded-full border border-liy px-4 text-sm font-semibold text-ank transition hover:border-chabon hover:text-chabon sm:px-5"
            >
              ← {back.label}
            </Link>
          ) : (
            <Link
              href={`/${locale}/login`}
 className="inline-flex min-h-[44px] items-center whitespace-nowrap rounded-full bg-wouj px-4 text-sm font-semibold text-white transition hover:brightness-95 sm:px-5"
            >
              {t.nav.login}
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
