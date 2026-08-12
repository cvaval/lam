import { analyserMiseEnForme, type Segment } from '@/lib/notes/format'

/**
 * Rendu d'une note de lecteur — gras et italique.
 *
 * ⚠️ UN SEUL COMPOSANT DE RENDU, UTILISÉ AUX DEUX ENDROITS : la fiche publique et la file
 * de modération. Si la modération affichait les marqueurs bruts pendant que la fiche affiche
 * du gras, le modérateur approuverait un texte qu'il n'a pas vu — défaut sérieux, et
 * invisible tant qu'on ne compare pas les deux écrans.
 *
 * ⚠️ AUCUN HTML N'EST CONSTRUIT À PARTIR DU CORPS. Les segments deviennent des éléments
 * React ; `<script>` écrit par un lecteur ressort en texte, jamais en balise.
 */

function rendre(segments: Segment[], cle = ''): React.ReactNode[] {
  return segments.map((s, i) => {
    const k = `${cle}${i}`
    if (s.type === 'texte') return <span key={k}>{s.valeur}</span>
    if (s.type === 'gras') return <strong key={k} className="font-semibold">{rendre(s.enfants, `${k}-`)}</strong>
    return <em key={k}>{rendre(s.enfants, `${k}-`)}</em>
  })
}

export function NoteBody({ corps, className = '' }: { corps: string; className?: string }) {
  // `whitespace-pre-line` : les retours à la ligne sont signifiants dans les notes, et
  // l'étaient déjà avant la mise en forme.
  return <p className={`whitespace-pre-line ${className}`}>{rendre(analyserMiseEnForme(corps))}</p>
}
