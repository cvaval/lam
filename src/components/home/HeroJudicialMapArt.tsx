import { HERO_MAP_VIEWBOX, HERO_MAP_DEPARTMENTS, HERO_MAP_LABELS, HERO_MAP_DOTS, HERO_MAP_FOCUS } from './hero-map-data'

/**
 * Carte d'Haïti du héros — SVG statique, DÉCORATIF (l'information est dans le
 * texte de la diapositive et sur /juridictions). Aucune dépendance : le héros ne
 * charge pas MapLibre. Géométrie et points dérivés des données officielles
 * (cf. scripts/build-hero-map-svg.py).
 *
 * L'anneau de pulsation autour de Port-au-Prince est purement CSS et respecte
 * `prefers-reduced-motion` (classe `motion-reduce:animate-none`).
 */
const DOT = {
  paix: { fill: '#BEF264', r: 6 },
  tpi: { fill: '#F4A823', r: 6 },
  appel: { fill: '#4F8EF7', r: 6.5 },
} as const

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
        <linearGradient id="lam-hero-land" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#2b2a52" />
          <stop offset="100%" stopColor="#20204090" />
        </linearGradient>
        <filter id="lam-hero-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="10" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Halo diffus sous la silhouette — donne le relief du fond navy. */}
      <g filter="url(#lam-hero-glow)" opacity="0.5">
        {HERO_MAP_DEPARTMENTS.map((d) => (
          <path key={`glow-${d.name}`} d={d.d} fill="#4F8EF7" opacity="0.12" />
        ))}
      </g>

      {/* Départements : remplissage sourd, liseré lumineux. */}
      {HERO_MAP_DEPARTMENTS.map((d) => (
        <path
          key={d.name}
          d={d.d}
          fill="url(#lam-hero-land)"
          stroke="#8ea2c8"
          strokeWidth="1.6"
          strokeOpacity="0.45"
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
          fill="#c9d3e8"
          opacity="0.62"
          style={{ fontFamily: 'var(--font-sans, system-ui), sans-serif', fontWeight: 500 }}
        >
          {l.name}
        </text>
      ))}

      {/* Constellation des juridictions (échantillon lisible). */}
      {HERO_MAP_DOTS.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={DOT[p.k].r} fill={DOT[p.k].fill} stroke="#12112b" strokeWidth="1.5" />
      ))}

      {/* Port-au-Prince : siège de la Cour de cassation. */}
      <g>
        <circle cx={HERO_MAP_FOCUS.x} cy={HERO_MAP_FOCUS.y} r="26" fill="#BEF264" opacity="0.16" />
        <circle
          cx={HERO_MAP_FOCUS.x}
          cy={HERO_MAP_FOCUS.y}
          r="18"
          fill="none"
          stroke="#BEF264"
          strokeWidth="2"
          opacity="0.55"
          className="origin-center animate-ping motion-reduce:animate-none"
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        />
        <circle cx={HERO_MAP_FOCUS.x} cy={HERO_MAP_FOCUS.y} r="9.5" fill="#BEF264" stroke="#12112b" strokeWidth="2" />
      </g>
    </svg>
  )
}
