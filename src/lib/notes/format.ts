/**
 * MISE EN FORME DES NOTES DE LECTEURS — gras et italique, rien d'autre.
 *
 * ⚠️ AUCUN HTML N'ENTRE DANS LE SYSTÈME. Une note est écrite par un lecteur puis servie à
 * tous les autres : c'est la surface d'injection classique. Le corps reste du TEXTE, et cet
 * analyseur en tire un arbre de segments que le composant transforme en éléments React. Il
 * n'y a donc aucun `dangerouslySetInnerHTML` à écrire et rien à assainir — le seul HTML
 * produit est celui que le composant décide lui-même de produire.
 *
 * ⚠️ PAS DE BIBLIOTHÈQUE MARKDOWN. `marked`, `markdown-it`, `remark` apportent liens,
 * images, HTML brut et code — tout ce qu'on ne veut pas — et il faudrait ensuite les
 * désactiver un par un. Deux balises tiennent en une centaine de lignes, testables
 * intégralement.
 */

export type Segment =
  | { type: 'texte'; valeur: string }
  | { type: 'gras'; enfants: Segment[] }
  | { type: 'italique'; enfants: Segment[] }

/** Position et longueur de la prochaine suite d'astérisques, à partir de `depuis`. */
function prochaineSuite(s: string, depuis: number): { debut: number; longueur: number } | null {
  const i = s.indexOf('*', depuis)
  if (i < 0) return null
  let n = 0
  while (i + n < s.length && s[i + n] === '*') n++
  return { debut: i, longueur: n }
}

/**
 * Cherche la suite qui FERME un marqueur de `minimum` astérisques.
 *
 * ⚠️ ON RAISONNE PAR SUITES, PAS PAR PAIRES. Une recherche naïve du prochain `**` dans
 * `**très *important***` s'arrêterait sur les deux premières étoiles de la suite finale et
 * laisserait l'italique ouvert. En cherchant une SUITE d'au moins deux étoiles et en n'en
 * consommant que les deux DERNIÈRES, les étoiles excédentaires reviennent au contenu — où
 * elles ferment l'emphase intérieure, comme l'auteur l'a écrit.
 */
function suiteFermante(s: string, depuis: number, minimum: number): { debut: number; longueur: number } | null {
  let d = depuis
  for (;;) {
    const suite = prochaineSuite(s, d)
    if (!suite) return null
    if (suite.longueur >= minimum) return suite
    d = suite.debut + suite.longueur
  }
}

function texte(valeur: string): Segment {
  return { type: 'texte', valeur }
}

/**
 * @param gras autorise `**…**` — faux à l'intérieur d'un gras ou d'un italique.
 * @param italique autorise `*…*` — faux à l'intérieur d'un italique.
 *
 * Imbrication d'un seul niveau, GRAS AU-DESSUS D'ITALIQUE (règle 5). Au-delà, on rend du
 * texte plutôt que de deviner : sur une note de lecteur, une devinette de balisage vaut
 * moins qu'un caractère affiché tel qu'il a été tapé.
 */
function analyser(s: string, gras: boolean, italique: boolean): Segment[] {
  const sortie: Segment[] = []
  let i = 0
  let debutTexte = 0

  const viderTexte = (jusqua: number) => {
    if (jusqua > debutTexte) sortie.push(texte(s.slice(debutTexte, jusqua)))
  }

  while (i < s.length) {
    if (s[i] !== '*') { i++; continue }
    const ouvrante = prochaineSuite(s, i)!
    const n = ouvrante.longueur

    // Marqueur le plus long d'abord : `**` avant `*`, sinon `**mot**` se lirait comme deux
    // italiques vides encadrant le mot.
    const emphase = n >= 2 && gras ? 2 : n >= 1 && italique ? 1 : 0
    if (emphase === 0) { i += n; continue }

    const fermante = suiteFermante(s, ouvrante.debut + n, emphase)
    if (fermante) {
      // Les étoiles en trop de la suite fermante appartiennent au CONTENU.
      const finContenu = fermante.debut + fermante.longueur - emphase
      const contenu = s.slice(ouvrante.debut + emphase, finContenu)
      // ⚠️ Une paire vide reste du texte : `**`, `****`, `* *` s'affichent tels quels.
      if (contenu.trim()) {
        viderTexte(ouvrante.debut)
        sortie.push({
          type: emphase === 2 ? 'gras' : 'italique',
          // Dans un gras, l'italique reste possible ; dans un italique, plus rien.
          enfants: analyser(contenu, false, emphase === 2),
        })
        i = fermante.debut + fermante.longueur
        debutTexte = i
        continue
      }
    }
    // ⚠️ UN MARQUEUR NON REFERMÉ RESTE DU TEXTE. On ne « répare » jamais en fermant à la
    // fin : la note ne dirait plus ce que son auteur a écrit.
    i += n
  }

  viderTexte(s.length)
  return sortie
}

export function analyserMiseEnForme(corps: string): Segment[] {
  return analyser(corps, true, true)
}

/** Texte nu d'un arbre de segments — utile aux extraits et aux tests. */
export function texteNu(segments: Segment[]): string {
  return segments
    .map((s) => (s.type === 'texte' ? s.valeur : texteNu(s.enfants)))
    .join('')
}
