import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ANCRE_TEXTE, JurisprudenceSommaire } from './JurisprudenceSommaire'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { separerDispositif } from '../lib/jurisprudence/notices'

/**
 * ⚠️ LE CAS LE PLUS DANGEREUX N'EST PLUS OBSERVABLE À L'ÉCRAN. Les 80 décisions du
 * corpus 1964-1965 ont leurs quatre rubriques d'analyse ; aucune fiche réelle ne permet
 * d'éprouver le sommaire vide. Il se teste donc ici, sur une fiche construite — et il
 * doit l'être : le corpus suivant n'aura pas cette chance.
 */

const vide = {
  matiere: null, decisionAttaquee: null, questionDroit: null,
  regleDroit: null, motifs: null, dispositif: null,
}
const complete = {
  matiere: 'Procédure civile (désistement d’instance — art. 399 C.P.C.).',
  decisionAttaquee: 'Jugement du Tribunal Civil de Port-au-Prince du 14 mars 1962.',
  questionDroit: 'Le désistement régulièrement signifié éteint-il l’instance en cassation ?',
  regleDroit: 'Art. 399 C.P.C. : le désistement emporte extinction de l’instance.',
  motifs: 'Oui. La Cour donne acte du désistement régulièrement signifié.',
  dispositif: 'Rejet du pourvoi.',
}

describe('JurisprudenceSommaire', () => {
  it('ne rend AUCUN bloc quand rien n’est renseigné — ni cadre, ni intitulé', () => {
    // Un cadre « Sommaire » vide annonce une analyse qui n'existe pas et fait douter le
    // lecteur de ce qu'il ne voit pas : pire que pas de bloc du tout.
    const html = renderToStaticMarkup(<JurisprudenceSommaire doc={vide} resume={null} locale="fr" />)
    expect(html).toBe('')
  })

  it('ne rend rien non plus quand les rubriques ne portent que du blanc', () => {
    const html = renderToStaticMarkup(
      <JurisprudenceSommaire doc={{ ...vide, regleDroit: '   \n  ' }} resume="" locale="fr" />,
    )
    expect(html).toBe('')
  })

  it('n’affiche QUE les lignes remplies, sans étiquette orpheline', () => {
    // 19 décisions sur 80 n'ont pas de résumé, 51 pas de dispositif : c'est le cas courant.
    const html = renderToStaticMarkup(
      <JurisprudenceSommaire doc={{ ...complete, dispositif: null }} resume={null} locale="fr" />,
    )
    expect(html).toContain('Règle de droit')
    expect(html).not.toContain('Dispositif')
    expect(html).not.toContain('Résumé éditorial')
    expect(html).not.toContain('non renseigné')
  })

  it('range les sept rubriques dans l’ordre du raisonnement', () => {
    // L'ordre EST la décision de la rédaction : question avant règle, et les deux avant
    // les motifs. Un tri alphabétique ou l'ordre des recueils casserait la lecture.
    const html = renderToStaticMarkup(
      <JurisprudenceSommaire doc={complete} resume="Résumé de la rédaction." locale="fr" />,
    )
    const rang = [
      'Domaine du droit', 'Résumé éditorial', 'Décision attaquée',
      'Question de droit', 'Règle de droit', 'Solution et motifs', 'Dispositif',
    ].map((l) => html.indexOf(l))
    expect(rang.every((i) => i >= 0)).toBe(true)
    expect(rang).toEqual([...rang].sort((a, b) => a - b))
  })

  it('porte le lien vers le texte de l’arrêt sur TOUTE fiche, même la plus courte', () => {
    // Une ancre qui n'apparaîtrait que sur les fiches longues serait une signalisation à
    // géométrie variable : le lecteur ne saurait pas qu'il peut compter dessus.
    const court = renderToStaticMarkup(
      <JurisprudenceSommaire doc={{ ...vide, dispositif: 'Rejet.' }} resume={null} locale="fr" />,
    )
    expect(court).toContain(`href="#${ANCRE_TEXTE}"`)
    expect(court).toContain('Aller au texte de l’arrêt')
  })

  it('rend la fiche n° 29 EN ENTIER — 12 531 caractères de règle, sans troncature', () => {
    // La plus longue analyse du corpus. On ne coupe pas : elle est le travail de la
    // rédaction. C'est l'ancre, pas le ciseau, qui règle le problème de longueur.
    const regle = 'Les règles de l’expertise ne sont ni absolues ni d’ordre public. '.repeat(196)
    const html = renderToStaticMarkup(
      <JurisprudenceSommaire doc={{ ...complete, regleDroit: regle }} resume={null} locale="fr" />,
    )
    expect(regle.length).toBeGreaterThan(12_000)
    expect(html).toContain(regle.trim())
    expect(html).not.toContain('…')
    expect(html).not.toContain('voir plus')
    // break-words : à 320 px, une telle règle ne doit pas pousser la page en largeur.
    expect(html).toContain('break-words')
  })

  it('se distingue du texte de l’arrêt : fonte d’interface et mention « Éditorial »', () => {
    // Un lecteur qui prendrait une règle rédigée par Lam pour un attendu de la Cour serait
    // induit en erreur sur ce qui fait autorité.
    const html = renderToStaticMarkup(<JurisprudenceSommaire doc={complete} resume={null} locale="fr" />)
    expect(html).toContain('font-sans')
    expect(html).toContain('Éditorial')
  })

  it('traduit les libellés', () => {
    const en = renderToStaticMarkup(<JurisprudenceSommaire doc={complete} resume="Summary." locale="en" />)
    expect(en).toContain('Headnote')
    expect(en).toContain('Rule of law')
    expect(en).toContain('Editorial summary')
    const ht = renderToStaticMarkup(<JurisprudenceSommaire doc={complete} resume={null} locale="ht" />)
    expect(ht).toContain('Somè')
    expect(ht).toContain('Règ dwa')
  })
})

/**
 * CHEMIN DE RENDU RÉEL — les notices de la 1re Section 1965-1966 (n° 1-15, écrites en base le
 * 19 oct. 2026) passent par `separerDispositif` puis par ce composant. On rend deux fiches
 * réelles : la n° 1 (dispositif détaché, anomalies de source gardées dans les motifs) et la
 * n° 13 (la rédaction n'a pas posé de sous-mention « Dispositif » : la ligne ne doit pas
 * apparaître). Les données viennent du jeu `scripts/data/cassation-1965-1966`, pas d'une copie.
 */
describe('JurisprudenceSommaire — notices 1965-1966, 1re Section', () => {
  const notices = JSON.parse(readFileSync(resolve(__dirname, '../../scripts/data/cassation-1965-1966/notices-1re-section-1-15.json'), 'utf8')) as {
    numero: string; rubriques: Record<string, string>
  }[]
  const fiche = (numero: string) => {
    const r = notices.find((n) => n.numero === numero)!.rubriques
    const s = separerDispositif(r['Solution et motifs (Holding and Reasoning)'])
    return {
      doc: {
        matiere: r['Domaines du droit'], decisionAttaquee: r['Décision attaquée / objet de la saisine'],
        questionDroit: r['Question de droit (Issue)'], regleDroit: r['Règle de droit (Rule of Law)'],
        motifs: s.anomalies ? `${s.motifs}\n\n${s.libelleAnomalies} : ${s.anomalies}` : s.motifs,
        dispositif: s.dispositif,
      },
      resume: r.Analyse,
    }
  }

  it('n° 1 : sept lignes, le dispositif détaché en gras, les anomalies de source gardées dans les motifs', () => {
    const f = fiche('1')
    const html = renderToStaticMarkup(<JurisprudenceSommaire doc={f.doc} resume={f.resume} locale="fr" />)
    for (const l of ['Domaine du droit', 'Résumé éditorial', 'Décision attaquée', 'Question de droit', 'Règle de droit', 'Solution et motifs', 'Dispositif']) expect(html).toContain(l)
    expect(html).toContain('rejet du pourvoi contre l&#x27;arrêt de la Cour d&#x27;Appel de Port-au-Prince du 5 août 1963')
    expect(html).toContain('Anomalies de source conservées :')
    // La sous-mention n'est pas rendue deux fois : « Dispositif : » ne figure plus dans les motifs.
    expect(f.doc.motifs).not.toMatch(/Dispositif\s*:/)
  })

  it('n° 13 : sans sous-mention « Dispositif », la ligne n’apparaît pas — rien n’est inventé', () => {
    const f = fiche('13')
    expect(f.doc.dispositif).toBeNull()
    const html = renderToStaticMarkup(<JurisprudenceSommaire doc={f.doc} resume={f.resume} locale="fr" />)
    expect(html).toContain('Solution et motifs')
    expect(html).not.toContain('>Dispositif<')
    expect(html).toContain('jonction')
  })
})
