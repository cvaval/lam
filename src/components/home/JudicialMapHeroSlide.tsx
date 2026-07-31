import Link from 'next/link'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'
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

/** Petits pictogrammes de juridiction — décoratifs, la couleur ne porte rien seule. */
function CourtGlyph({ tone }: { tone: 'cassation' | 'appel' | 'tpi' | 'paix' }) {
  const color = { cassation: '#7C6F9B', appel: '#4F8EF7', tpi: '#F4A823', paix: '#5e8a2a' }[tone]
  return (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
      style={{ backgroundColor: `${color}1a` }}
    >
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round">
        <path d="M10 2.5 17.5 6.5H2.5L10 2.5Z" fill={color} fillOpacity="0.25" />
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
      className="group block outline-none ring-sitwon focus-visible:ring-2"
      aria-label={`${h.title} — ${h.cta}`}
    >
      <div className="relative overflow-hidden">
        {/* Lueur d'ambiance — la maquette pose un fond navy profond, éclairé au centre. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{ background: 'radial-gradient(60% 70% at 62% 42%, rgba(79,142,247,0.16), transparent 70%)' }}
        />

        <div className="relative mx-auto grid max-w-7xl items-center gap-x-8 gap-y-8 px-4 pb-10 pt-12 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] lg:pt-16">
          {/* ── Colonne de texte ─────────────────────────────────────────── */}
          <div className="relative z-10">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-sitwon">{h.eyebrow}</p>
            <h2 className="mt-5 font-serif text-[2.1rem] font-semibold leading-[1.08] text-cream sm:text-[2.7rem] lg:text-[3.2rem]">
              {h.titleLead} <span className="text-sitwon">{h.titleAccent}</span>
            </h2>
            <p className="mt-5 max-w-md text-base leading-relaxed text-cream/70">{h.description}</p>

            <span className="mt-7 inline-flex items-center gap-3 rounded-xl bg-sitwon px-7 py-3.5 text-[15px] font-semibold text-lank shadow-lg shadow-sitwon/20 transition group-hover:bg-sitwon/90">
              {h.cta}
              <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
            </span>

            {/* cream/60 et non /45 : à 11 px le contraste sur le navy tombait à
                4,09:1, sous le seuil AA de 4,5:1 (mesuré). /60 donne 6,2:1. */}
            <p className="mt-4 flex items-center gap-2 font-mono text-[11px] text-cream/60">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-sitwon" />
              {h.note}
            </p>

            <ul className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-cream/60">
              {[h.featureFuzzy, h.featureByCommune, h.featureVerified].map((f, i) => (
                <li key={f} className="flex items-center gap-3">
                  {i > 0 && <span aria-hidden="true" className="h-1 w-1 rounded-full bg-sitwon/70" />}
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
          <div className="relative hidden sm:block">
            {/*
              La carte déborde vers la GAUCHE (marge négative) : Port-au-Prince est
              au quart sud-est d'Haïti, et la fiche est ancrée à droite — sans ce
              décalage, le point mis en avant et son étiquette passent SOUS la fiche.
              Le texte reste au-dessus (z-10) : le débord ne le gêne pas.
            */}
            <div className="relative mx-auto w-full max-w-xl lg:mx-0 lg:-ml-28 lg:max-w-[27rem] xl:-ml-24 xl:max-w-[34rem]">
              <HeroJudicialMapArt className="h-auto w-full" />

              {/* Pas de légende ici : la lecture des couleurs se fait sur la carte
                  interactive de /juridictions, où elle sert à filtrer. Dans le héros
                  elle encombrait la silhouette. */}

              {/* Étiquette de la commune mise en avant — ancrée sur le point réel. */}
              <span
                style={FOCUS_PCT}
                className="absolute hidden -translate-x-[calc(100%+0.9rem)] -translate-y-1/2 whitespace-nowrap rounded-md bg-[#171634]/90 px-2 py-1 text-[10px] font-medium text-cream/90 shadow-lg ring-1 ring-white/10 sm:inline-block"
              >
                Port-au-Prince
              </span>
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
            {/* `text-lank` sur le conteneur : la fiche est blanche à l'intérieur d'une
                section `text-cream`. Sans cette base, tout texte qui oublierait sa
                couleur hériterait du crème — invisible sur blanc. */}
            <div className="hidden rounded-2xl bg-white p-4 text-lank shadow-2xl ring-1 ring-lank/10 lg:absolute lg:right-0 lg:top-4 lg:block lg:w-[17.5rem] xl:w-[19rem]">
              <h3 className="font-serif text-xl font-semibold text-lank">Port-au-Prince</h3>
              {/* /65 et non /50 : sur blanc, /50 ne donnait que 3,26:1 (AA = 4,5). */}
              <p className="mt-0.5 text-[11px] text-lank/65">Ouest · Arrondissement de Port-au-Prince</p>
              <p className="mt-2.5 inline-flex items-baseline gap-1.5 rounded-md bg-sitwon px-2.5 py-1">
                <span className="font-mono text-[9px] uppercase tracking-wider text-lank/70">{j.primaryPostalCode}</span>
                <span className="font-mono text-xs font-bold text-lank">HT6110</span>
              </p>
              <ul className="mt-3 flex flex-col divide-y divide-lank/5">
                {courts.map((c) => (
                  <li key={c.name} className="flex items-center gap-2.5 py-2">
                    <CourtGlyph tone={c.tone} />
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-medium leading-tight text-lank">{c.name}</span>
                      {c.detail && <span className="mt-0.5 block truncate text-[10.5px] text-lank/65">{c.detail}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <span className="mt-3 flex items-center justify-between rounded-lg bg-lank px-3.5 py-2.5 text-[12px] font-semibold text-cream">
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
