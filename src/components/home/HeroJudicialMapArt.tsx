import { HERO_MAP_VIEWBOX, HERO_MAP_DEPARTMENTS, HERO_MAP_LABELS, HERO_MAP_DOTS, HERO_MAP_FOCUS } from './hero-map-data'
import { BRAND_COLORS as C } from '@/lib/brand-colors'

/**
 * Carte d'Haïti du héros — SVG statique, DÉCORATIF (l'information est dans le
 * texte de la diapositive et sur /juridictions). Aucune dépendance : le héros ne
 * charge pas MapLibre. Géométrie et points dérivés des données officielles
 * (cf. scripts/build-hero-map-svg.py).
 *
 * L'anneau de pulsation autour de Port-au-Prince est purement CSS et respecte
 * `prefers-reduced-motion` (classe `motion-reduce:animate-none`).
 *
 * ⚠️ CETTE ILLUSTRATION ÉTAIT HORS CHARTE. Elle datait d'une maquette à fond navy
 * (#2b2a52, liserés #8ea2c8, noms #c9d3e8) qui n'a pas survécu au passage à Klinik :
 * la diapositive est posée sur Chabon, pas sur du navy. Tout est ramené à la palette.
 *
 * ⚠️ LA LOGIQUE DE CONTRASTE EST INVERSE DE CELLE DE LA CARTE INTERACTIVE. Sur
 * /juridictions les marqueurs sont cernés de Chabon parce que le fond est clair (Koton) ;
 * ici le fond est SOMBRE, et c'est un cerne Koton qui détache la pastille. Wouj sur la
 * terre n'est qu'à 1,35:1 — sans ce cerne clair, les points disparaîtraient.
 */

/** Gamme cartographique AV-02, comme sur /juridictions — mêmes ordres, mêmes teintes. */
const DOT = {
  paix: { fill: C.wouj, r: 6 },
  tpi: { fill: C.sitwon, r: 6 },
  appel: { fill: C.vet, r: 6.5 },
} as const

/** Cerne clair des pastilles — voir l'avertissement ci-dessus. */
const DOT_STROKE = C.koton

export function HeroJudicialMapArt({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox={HERO_MAP_VIEWBOX}
      aria-hidden="true"
      focusable="false"
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {/* La terre est PLUS CLAIRE que le fond Chabon : c'est ce qui détache la
            silhouette. Grafit → Adwaz, les deux bornes sombres de la charte. */}
        <linearGradient id="lam-hero-land" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor={C.grafit} />
          <stop offset="100%" stopColor={C.adwaz} />
        </linearGradient>
        <filter id="lam-hero-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="10" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Halo diffus sous la silhouette — donne le relief sur le Chabon de la section. */}
      <g filter="url(#lam-hero-glow)" opacity="0.5">
        {HERO_MAP_DEPARTMENTS.map((d) => (
          <path key={`glow-${d.name}`} d={d.d} fill={C.koton} opacity="0.1" />
        ))}
      </g>

      {/* Départements : remplissage sourd, liseré lumineux. */}
      {HERO_MAP_DEPARTMENTS.map((d) => (
        <path
          key={d.name}
          d={d.d}
          fill="url(#lam-hero-land)"
          stroke={C.koton}
          strokeWidth="2"
          strokeOpacity="0.42"
          strokeLinejoin="round"
        />
      ))}

      {/* Noms de départements — jamais seuls porteurs d'information (décor). */}
      {HERO_MAP_LABELS.map((l) => (
        <text
          key={l.name}
          x={l.x}
          y={l.y}
          textAnchor="middle"
          fontSize="15"
          letterSpacing="1.6"
          fill={C.koton}
          opacity="0.55"
          style={{ fontFamily: 'var(--font-sans, system-ui), sans-serif', fontWeight: 500 }}
        >
          {l.name}
        </text>
      ))}

      {/* Constellation des juridictions (échantillon lisible). */}
      {HERO_MAP_DOTS.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={DOT[p.k].r} fill={DOT[p.k].fill} stroke={DOT_STROKE} strokeWidth="2" />
      ))}

      {/* Port-au-Prince mise en avant. Sitwon, comme la commune sélectionnée sur la carte
          interactive : le héros et /juridictions désignent le choix de la même couleur. */}
      <g>
        <circle cx={HERO_MAP_FOCUS.x} cy={HERO_MAP_FOCUS.y} r="26" fill={C.sitwon} opacity="0.14" />
        <circle
          cx={HERO_MAP_FOCUS.x}
          cy={HERO_MAP_FOCUS.y}
          r="18"
          fill="none"
          stroke={C.sitwon}
          strokeWidth="2"
          opacity="0.5"
          className="origin-center animate-ping motion-reduce:animate-none"
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        />
        <circle cx={HERO_MAP_FOCUS.x} cy={HERO_MAP_FOCUS.y} r="9.5" fill={C.sitwon} stroke={DOT_STROKE} strokeWidth="2" />
      </g>
    </svg>
  )
}
