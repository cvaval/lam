import Link from 'next/link'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'
import { BRAND_COLORS as C } from '@/lib/brand-colors'
import { HeroJudicialMapArt } from './HeroJudicialMapArt'
import { HERO_MAP_FOCUS, HERO_MAP_VIEWBOX } from './hero-map-data'

/**
 * Position de Port-au-Prince en POURCENTAGE de la boîte du SVG — calculée depuis
 * les données générées, jamais posée à l'œil : l'étiquette doit suivre le point
 * si la géométrie est régénérée. (Le SVG garde le rapport du viewBox, donc un
 * pourcentage de la boîte tombe exactement sur la coordonnée.)
 */
const [, , VB_W, VB_H] = HERO_MAP_VIEWBOX.split(' ').map(Number)
const FOCUS_PCT = { left: `${(HERO_MAP_FOCUS.x / VB_W) * 100}%`, top: `${(HERO_MAP_FOCUS.y / VB_H) * 100}%` }

/**
 * Diapositive 2 du héros — Carte judiciaire.
 *
 * La TOTALITÉ de la diapositive est un lien vers /juridictions : le « bouton » et
 * la mention « Consulter la fiche complète » sont donc des éléments VISUELS, pas
 * des contrôles imbriqués (une ancre dans une ancre est invalide, et le clavier
 * s'y perdrait). Les commandes du carrousel vivent hors de ce lien.
 *
 * Aucune indication tarifaire. Aucun MapLibre : la carte est un SVG statique.
 * Les données affichées sont RÉELLES (Port-au-Prince : HT6110, ses trois
 * tribunaux de paix, l'adresse vérifiée de la Cour de cassation).
 */

/**
 * Petits pictogrammes de juridiction — décoratifs : le NOM du tribunal est juste à côté,
 * la couleur ne porte jamais l'information seule.
 *
 * Teintes de la gamme cartographique AV-02, pour que le héros et /juridictions codent les
 * ordres de la même façon. Auparavant Cassation et TPI portaient tous deux #414042 :
 * quatre ordres, trois couleurs.
 *
 * ⚠️ La teinte est portée par le FOND de la pastille, jamais par le trait : le pictogramme
 * reste en Chabon. Sur la fiche blanche, un palais de justice tracé en Sitwon serait à
 * 1,2:1 — illisible. Le fond teinté distingue, l'encre porte le dessin.
 *
 * ⚠️ OPACITÉ À 40 % ET NON 18 %. Mesuré sur la fiche blanche, le Sitwon à 18 % tombait à
 * 1,08:1 : la pastille ne se distinguait plus de la carte, et une teinte qui ne teinte
 * rien ne sert à rien. La contrainte WCAG des 3:1 ne s'applique pas ici (graphique
 * décoratif, `aria-hidden`, doublé du NOM du tribunal) — mais la lisibilité, si.
 */
function CourtGlyph({ tone }: { tone: 'cassation' | 'appel' | 'tpi' | 'paix' }) {
  // Suit `COURT_STYLE` (/juridictions) : la première instance passe au Vèt le 17 août, pour
  // que les deux surfaces codent les ordres pareil. ⚠️ Mesuré ici : à 40 % sur la fiche
  // blanche, Vèt et Chabon ne rendent que 1,16:1 — la pastille du héros ne DISTINGUE donc
  // rien à elle seule. C'est sans conséquence et c'est la règle du composant : le NOM du
  // tribunal est juste à côté, la teinte n'a jamais porté l'information ici.
  const teinte = { cassation: C.ble, appel: C.chabon, tpi: C.vet, paix: C.blan }[tone]
  return (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
      style={{ backgroundColor: `${teinte}66` }}
    >
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke={C.chabon} strokeWidth="2" strokeLinecap="round">
        <path d="M10 2.5 17.5 6.5H2.5L10 2.5Z" fill={C.chabon} fillOpacity="0.25" />
        <path d="M4.5 8.5v6M8.2 8.5v6M11.8 8.5v6M15.5 8.5v6" />
        <path d="M2.5 17.5h15" />
      </svg>
    </span>
  )
}

export function JudicialMapHeroSlide({ locale, t }: { locale: Locale; t: Dictionary }) {
  const h = t.hero.map
  const j = t.judicial
  // Extrait RÉEL de la fiche de Port-au-Prince (cf. data/judicial-map/seed-v1.json).
  const courts = [
    { tone: 'cassation' as const, name: j.cassation, detail: 'Rue Mgr Guilloux, près du Champ-de-Mars' },
    { tone: 'appel' as const, name: 'Cour d’appel de Port-au-Prince', detail: null },
    { tone: 'tpi' as const, name: 'Tribunal de première instance de Port-au-Prince', detail: null },
    { tone: 'paix' as const, name: 'Tribunal de paix — Section Est', detail: null },
    { tone: 'paix' as const, name: 'Tribunal de paix — Section Nord', detail: null },
    { tone: 'paix' as const, name: 'Tribunal de paix — Section Sud', detail: null },
  ]

  return (
    <Link
      href={`/${locale}/juridictions`}
 className="group block"
      aria-label={`${h.title} — ${h.cta}`}
    >
      <div className="relative overflow-hidden">
        {/* Lueur d'ambiance — Koton très dilué. La maquette d'origine posait un bleu
            (79,142,247) étranger à la palette : la section est sur Chabon, pas sur du navy. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{ background: 'radial-gradient(60% 70% at 70% 45%, rgba(253,210,40,0.13), transparent 70%)' }}
        />

        <div className="relative mx-auto grid max-w-7xl items-center gap-x-8 gap-y-8 px-4 pb-10 pt-12 lg:min-h-[610px] lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:py-16">
          {/* ── Colonne de texte ─────────────────────────────────────────── */}
          <div className="relative z-10">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-grafit">{h.eyebrow}</p>
            {/* ⚠️ `h1`, PAS `h2`. Cette diapositive était l'une de DEUX dans un carrousel,
                d'où le niveau 2 ; elle est désormais le seul héros de l'accueil, et la page
                n'avait donc PLUS AUCUN `h1` — un lecteur d'écran ouvrait le site sans titre
                de niveau 1, et la hiérarchie démarrait au niveau 2 (§16). */}
            <h1 className="mt-5 font-sans text-display-2 lowercase text-grafit sm:text-[2.7rem] lg:text-[3.2rem]">
              {h.titleLead} <span className="text-ank">{h.titleAccent}</span>
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-grafit">{h.description}</p>

            <span className="mt-7 inline-flex items-center gap-3 rounded-xl bg-wouj px-7 py-3.5 text-[15px] font-semibold text-white transition group-hover:brightness-95">
              {h.cta}
              <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
            </span>

            {/* Koton/70 et non /60 : sur CHABON (et non le navy de la maquette, disparu),
                /60 ne donne que 4,21:1 — sous le seuil AA de 4,5:1. /70 donne 5,10:1.
                Mesuré à l'écran, pas déduit : les deux valeurs sont trop proches à l'œil. */}
            <p className="mt-4 flex items-center gap-2 font-mono text-[11px] text-grafit">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-wouj" />
              {h.note}
            </p>

            <ul className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-grafit">
              {[h.featureFuzzy, h.featureByCommune, h.featureVerified].map((f, i) => (
                <li key={f} className="flex items-center gap-3">
                  {i > 0 && <span aria-hidden="true" className="h-1 w-1 rounded-full bg-grafit/40" />}
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* ── Carte + légende + fiche ──────────────────────────────────────
              Masquées sous sm, exactement comme le visuel de la diapositive 1 : les
              deux diapositives partagent une cellule de grille, et une illustration
              de 260 px de haut ici laissait autant de vide sous l'autre. Le contenu
              de la carte n'est pas perdu — le bouton mène à /juridictions. */}
          {/*
            ⚠️ TOUTE LA DIAPOSITIVE EST UN LIEN, ET RIEN NE LE DISAIT AU SURVOL. Le `<Link>`
            qui l'enveloppe ne porte que `group block` : le plus grand objet cliquable de
            l'accueil ne répondait pas au curseur. Le cadre de la carte prend donc le retour,
            comme les autres surfaces cliquables — filet Chabon au survol.

            Un ANNEAU, pas une bordure : le cadre n'en a pas au repos, et lui en ajouter une
            au survol décalerait la carte d'un pixel à chaque passage du curseur. L'anneau
            se pose hors flux et ne pousse rien.
          */}
          <div className="relative hidden rounded-2xl bg-adwaz/10 p-6 ring-1 ring-transparent transition group-hover:ring-chabon sm:block lg:p-8">
            {/*
              ⚠️ L'ÎLE TIENT DANS LE CADRE, ENTIÈRE. Elle en sortait par la gauche : une
              marge négative (`-ml-28`) poussait la carte hors de la boîte pour que
              Port-au-Prince — au quart sud-est d'Haïti — échappe à la fiche ancrée à
              droite. Le point était sauvé, mais la Grand'Anse, les Nippes et le Sud
              débordaient sur le fond de la page, à 64 px du bord arrondi.

              La place se prend donc À DROITE, en réservant la largeur de la fiche, au
              lieu de se voler à gauche : la carte occupe toute la hauteur disponible et
              s'arrête là où la fiche commence. Port-au-Prince reste dégagé, et l'île
              entière est dans le carré.
            */}
            {/*
              La HAUTEUR vient de la FICHE, pas de la carte. La carte réduite ne mesurait
              plus que 242 px : la boîte se refermait sur elle et la fiche, haute de
              494 px, pendait de 203 px sous le fond arrondi. Un plancher la contient, et
              la carte se centre dans ce qui reste.
            */}
            <div className="relative mx-auto w-full max-w-xl lg:mx-0 lg:flex lg:min-h-[32rem] lg:max-w-none lg:items-center lg:pr-[13rem] xl:pr-[14rem]">
              {/*
                ⚠️ CETTE BOÎTE ÉPOUSE LE SVG, ET RIEN D'AUTRE. L'étiquette est posée en
                POURCENTAGE (cf. FOCUS_PCT en tête de fichier) : le calcul ne vaut que si
                sa référence a exactement les dimensions du viewBox. Posée sur le
                conteneur ci-dessus — qui réserve la largeur de la fiche —, elle tombait
                350 px trop à droite, sous la fiche, loin du point qu'elle nomme.
              */}
              <div className="relative w-full">
                <HeroJudicialMapArt className="h-auto w-full" />

                {/* Pas de légende ici : la lecture des couleurs se fait sur la carte
                    interactive de /juridictions, où elle sert à filtrer. Dans le héros
                    elle encombrait la silhouette. */}

                {/* Étiquette de la commune mise en avant — ancrée sur le point réel. */}
                <span
                  style={FOCUS_PCT}
                  className="absolute hidden -translate-x-[calc(100%+0.9rem)] -translate-y-1/2 whitespace-nowrap rounded-md bg-chabon/90 px-2 py-1 text-[10px] font-medium text-koton/90 ring-1 ring-white/10 sm:inline-block"
                >
                  Port-au-Prince
                </span>
              </div>
            </div>

            {/* Fiche de commune — aperçu du contenu réel de /juridictions. */}
            {/*
              La fiche n'apparaît qu'à partir de lg. Superposée sur écran étroit elle
              masquerait la commune mise en avant ; empilée sous la carte, elle
              allongeait la diapositive de 550 px de plus que la diapositive 1 —
              or les deux partagent la MÊME cellule de grille, donc cet excédent
              devenait du vide sous la diapositive 1. C'est un aperçu, pas la donnée :
              la fiche réelle est sur /juridictions, où le lien mène.
            */}
            {/* `text-ank` sur le conteneur : la fiche est blanche à l'intérieur d'une
                section `text-koton`. Sans cette base, tout texte qui oublierait sa
                couleur hériterait du crème — invisible sur blanc. */}
            <div className="hidden rounded-2xl bg-white p-4 text-ank ring-1 ring-chabon/10 lg:absolute lg:right-0 lg:top-4 lg:block lg:w-[14.5rem] xl:w-[15.5rem]">
              <h3 className="font-sans text-xl font-medium text-ank">Port-au-Prince</h3>
              {/* /65 et non /50 : sur blanc, /50 ne donnait que 3,26:1 (AA = 4,5). */}
              <p className="mt-0.5 text-[11px] text-ank/80">Ouest · Arrondissement de Port-au-Prince</p>
              <p className="mt-2.5 inline-flex items-baseline gap-1.5 rounded-md border border-liy-fonse bg-pil px-2.5 py-1">
                <span className="font-mono text-[9px] uppercase tracking-wider text-ank/80">{j.primaryPostalCode}</span>
                <span className="font-mono text-xs font-bold text-ank">HT6110</span>
              </p>
              <ul className="mt-3 flex flex-col divide-y divide-chabon/5">
                {courts.map((c) => (
                  <li key={c.name} className="flex items-center gap-2.5 py-2">
                    <CourtGlyph tone={c.tone} />
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-medium leading-tight text-ank">{c.name}</span>
                      {c.detail && <span className="mt-0.5 block truncate text-[10.5px] text-ank/80">{c.detail}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <span className="mt-3 flex items-center justify-between rounded-lg bg-chabon px-3.5 py-2.5 text-[12px] font-semibold text-koton">
                {h.openRecord}
                <span aria-hidden="true">→</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
