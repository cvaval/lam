import {
  GLYPHE_TRAITEMENT, GLYPHE_PORTEE,
  estTraitement, estPortee,
} from '@/lib/jurisprudence/constants'

/**
 * Bandeau propre aux DÉCISIONS JUDICIAIRES : décision attaquée, dispositif et
 * qualifications éditoriales — les deux premiers points qu'un juriste cherche.
 *
 * ⚠️ LE GLYPHE NE VOYAGE JAMAIS SEUL. Il accompagne son libellé et porte `aria-hidden` :
 * les émojis se rendent différemment d'un système à l'autre et les lecteurs d'écran les
 * annoncent de façon inconstante. La forme (coche, triangle, tiret, balance, feuille)
 * distingue les états SANS recourir à la couleur — Wouj et Vèt sont à 1,05:1 de
 * luminance, indiscernables en daltonisme rouge-vert (règle 5 de la charte).
 *
 * ⚠️ RIEN N'EST AFFICHÉ QUAND L'ÉDITEUR NE S'EST PAS PRONONCÉ. Un blanc n'est pas un
 * « neutre » : montrer une pastille par défaut ferait passer une absence d'évaluation
 * pour une évaluation.
 */

const LIB_TRAITEMENT: Record<string, { fr: string; en: string; ht: string }> = {
  POSITIF: { fr: 'Confirmée, suivie', en: 'Confirmed, followed', ht: 'Konfime, swiv' },
  NEGATIF: { fr: 'Renversée, critiquée', en: 'Overruled, criticised', ht: 'Ranvèse, kritike' },
  NEUTRE: { fr: 'Citée sans prise de position', en: 'Cited without position', ht: 'Site san pozisyon' },
}
const LIB_PORTEE: Record<string, { fr: string; en: string; ht: string }> = {
  JURISPRUDENCE: { fr: 'Fait jurisprudence', en: 'Sets precedent', ht: 'Fè jirisprudans' },
  ESPECE: { fr: 'Décision d’espèce', en: 'Decision on the facts', ht: 'Desizyon sou ka a' },
}

const LIB = {
  attaquee: { fr: 'Décision attaquée', en: 'Decision under appeal', ht: 'Desizyon atake' },
  dispositif: { fr: 'Dispositif', en: 'Ruling', ht: 'Dispozitif' },
  note: { fr: 'Note de la rédaction', en: 'Editorial note', ht: 'Nòt redaksyon an' },
}

export function JurisprudenceHeader({
  doc,
  locale,
}: {
  doc: {
    decisionAttaquee: string | null
    dispositif: string | null
    traitement: string | null
    traitementNote: string | null
    portee: string | null
    porteeNote: string | null
    noteRedaction: string | null
    noteRedactionBy: string | null
    recueilRef: string | null
  }
  locale: string
}) {
  const lt = (o: { fr: string; en: string; ht: string }) => (locale === 'en' ? o.en : locale === 'ht' ? o.ht : o.fr)
  const rien =
    !doc.decisionAttaquee && !doc.dispositif && !doc.traitement && !doc.portee && !doc.noteRedaction
  if (rien) return null

  const pastille = 'inline-flex items-center gap-1.5 rounded-full border border-liy bg-pil px-2.5 py-1 text-[11px] font-medium text-ank'

  return (
    <section className="mt-4 space-y-3" aria-label="Décision judiciaire">
      {(doc.traitement || doc.portee) && (
        <div className="flex flex-wrap items-center gap-2">
          {estTraitement(doc.traitement ?? '') && (
            <span className={pastille} title={doc.traitementNote ?? undefined}>
              <span aria-hidden="true">{GLYPHE_TRAITEMENT[doc.traitement as never]}</span>
              {lt(LIB_TRAITEMENT[doc.traitement!])}
            </span>
          )}
          {estPortee(doc.portee ?? '') && (
            <span className={pastille} title={doc.porteeNote ?? undefined}>
              <span aria-hidden="true">{GLYPHE_PORTEE[doc.portee as never]}</span>
              {lt(LIB_PORTEE[doc.portee!])}
            </span>
          )}
        </div>
      )}

      {(doc.decisionAttaquee || doc.dispositif) && (
        <dl className="grid gap-x-4 gap-y-2 rounded-xl border border-liy bg-white p-4 text-sm sm:grid-cols-[auto_1fr]">
          {doc.decisionAttaquee && (
            <>
              <dt className="font-mono text-[11px] uppercase tracking-wider text-grafit">{lt(LIB.attaquee)}</dt>
              <dd className="text-ank">{doc.decisionAttaquee}</dd>
            </>
          )}
          {doc.dispositif && (
            <>
              <dt className="font-mono text-[11px] uppercase tracking-wider text-grafit">{lt(LIB.dispositif)}</dt>
              <dd className="font-medium text-ank">{doc.dispositif}</dd>
            </>
          )}
        </dl>
      )}

      {doc.noteRedaction && (
        // ⚠️ La note se distingue du texte de l'arrêt : filet Wouj, intitulé explicite et
        // fonte d'INTERFACE — l'arrêt se lit en serif, le commentaire non. Le corps de
        // l'arrêt est du droit, la note est un commentaire ; les confondre serait grave.
        <div className="rounded-xl border border-liy border-l-4 border-l-wouj bg-pil p-4 font-sans">
          <p className="font-mono text-[11px] uppercase tracking-wider text-grafit">
            {lt(LIB.note)}
            {doc.noteRedactionBy ? ` · ${doc.noteRedactionBy}` : ''}
          </p>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ank">{doc.noteRedaction}</p>
        </div>
      )}
    </section>
  )
}
