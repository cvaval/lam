/**
 * Le SOMMAIRE ANALYTIQUE d'une décision — l'analyse de la rédaction, placée AVANT le
 * texte de l'arrêt. Sept lignes dans l'ordre arrêté par la rédaction :
 *
 *   domaine du droit · résumé éditorial · décision attaquée · question de droit ·
 *   règle de droit · solution et motifs · dispositif
 *
 * L'ordre est celui du RAISONNEMENT, non celui des recueils : ce qui était à trancher,
 * la règle qui le tranche, puis pourquoi. Les recueils écrivent « Règle de droit » en
 * premier ; c'est un ordre de rédaction, pas de consultation.
 *
 * ⚠️ CE BLOC N'EST PAS LE TEXTE. Il est de la rédaction ; l'arrêt est la parole de la
 * Cour. D'où la fonte d'INTERFACE et la mention « Éditorial » : un lecteur qui prendrait
 * une règle de droit rédigée par Lam pour un attendu de la Cour serait induit en erreur
 * sur ce qui fait autorité.
 *
 * ⚠️ RIEN DE CE QUI EST VIDE NE S'AFFICHE — pas d'étiquette orpheline, pas de « non
 * renseigné », pas de tiret. Et si aucune rubrique n'est renseignée, pas de bloc du tout :
 * un cadre « Sommaire » vide annonce une analyse qui n'existe pas et fait douter le
 * lecteur de ce qu'il ne voit pas.
 *
 * ⚠️ AUCUNE TRONCATURE, ET UNE ANCRE. La fiche n° 29 (Compagnie d'Éclairage Électrique)
 * porte 30 591 caractères d'analyse — quatre à cinq écrans avant le premier mot de la
 * Cour. On ne coupe pas : l'analyse est le travail de la rédaction et se lit en entier.
 * Le lien « Aller au texte de l'arrêt » donne l'issue, et il est présent sur TOUTES les
 * fiches — une ancre qui n'apparaîtrait que sur les longues serait une signalisation à
 * géométrie variable.
 */

export const ANCRE_TEXTE = 'texte-officiel'

const LIB = {
  titre: { fr: 'Sommaire', en: 'Headnote', ht: 'Somè' },
  editorial: { fr: 'Éditorial', en: 'Editorial', ht: 'Editoryal' },
  versTexte: {
    fr: 'Aller au texte de l’arrêt',
    en: 'Go to the text of the judgment',
    ht: 'Ale nan tèks arè a',
  },
  matiere: { fr: 'Domaine du droit', en: 'Field of law', ht: 'Domèn dwa a' },
  resume: { fr: 'Résumé éditorial', en: 'Editorial summary', ht: 'Rezime editoryal' },
  attaquee: { fr: 'Décision attaquée', en: 'Decision under appeal', ht: 'Desizyon atake' },
  question: { fr: 'Question de droit', en: 'Issue', ht: 'Kesyon dwa' },
  regle: { fr: 'Règle de droit', en: 'Rule of law', ht: 'Règ dwa' },
  motifs: { fr: 'Solution et motifs', en: 'Holding and reasoning', ht: 'Solisyon ak motif' },
  dispositif: { fr: 'Dispositif', en: 'Ruling', ht: 'Dispozitif' },
} as const

type Libelle = { fr: string; en: string; ht: string }

export function JurisprudenceSommaire({
  doc,
  resume,
  locale,
}: {
  doc: {
    matiere: string | null
    decisionAttaquee: string | null
    questionDroit: string | null
    regleDroit: string | null
    motifs: string | null
    dispositif: string | null
  }
  /** Résumé déjà résolu dans la langue du lecteur (summaryFr / En / Ht). */
  resume: string | null
  locale: string
}) {
  const lt = (o: Libelle) => (locale === 'en' ? o.en : locale === 'ht' ? o.ht : o.fr)

  // L'ordre de ce tableau EST l'ordre à l'écran : le modifier change la lecture.
  const lignes: { lib: Libelle; valeur: string | null; fort?: boolean }[] = [
    { lib: LIB.matiere, valeur: doc.matiere },
    { lib: LIB.resume, valeur: resume },
    { lib: LIB.attaquee, valeur: doc.decisionAttaquee },
    { lib: LIB.question, valeur: doc.questionDroit },
    { lib: LIB.regle, valeur: doc.regleDroit },
    { lib: LIB.motifs, valeur: doc.motifs },
    { lib: LIB.dispositif, valeur: doc.dispositif, fort: true },
  ].filter((l) => l.valeur && l.valeur.trim())

  if (lignes.length === 0) return null

  return (
    <section className="rounded-2xl border border-chabon/10 bg-white p-5 font-sans" aria-labelledby="sommaire-titre">
      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-chabon/10 pb-3">
        <h2 id="sommaire-titre" className="text-sm font-semibold text-ank">
          {lt(LIB.titre)}
        </h2>
        <span className="rounded bg-pil px-1.5 py-0.5 text-[10px] font-medium uppercase text-ank/80">
          {lt(LIB.editorial)}
        </span>
        <a
          href={`#${ANCRE_TEXTE}`}
          className="no-print ml-auto rounded-full border border-liy px-3 py-1 text-xs text-chabon hover:border-chabon hover:text-ank"
        >
          {lt(LIB.versTexte)} ↓
        </a>
      </div>
      <dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
        {lignes.map((l) => (
          <div key={l.lib.fr} className="contents">
            <dt className="font-mono text-[11px] uppercase leading-5 tracking-wider text-grafit">{lt(l.lib)}</dt>
            {/* break-words : une règle de 12 531 caractères ne doit pas déborder à 320 px. */}
            <dd
              className={`min-w-0 whitespace-pre-line break-words leading-relaxed text-ank ${l.fort ? 'font-medium' : ''}`}
            >
              {l.valeur}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
