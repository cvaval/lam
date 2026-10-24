import Link from 'next/link'
import type { Locale } from '@/lib/types'
import type { ConnexeBlock } from '@/lib/legislation/annotated'
import { natureDuConnexe, situationDuConnexe, NATURES_CONNEXE, type NatureConnexe, type Situation } from '@/lib/legislation/situations'
import { CodeRefText, type CodeHrefs } from './CodeRefText'
import { Repli } from './Repli'
import { contientTerme } from './surligner'

/**
 * Sous un article : son ancienne rédaction et ses blocs de législation connexe, UN REPLI PAR NATURE,
 * chacun dans sa gamme (registre des situations, 17 oct. 2026).
 *
 * ⚠️ LE PLIABLE UNIQUE « ANCIENNE VERSION & LÉGISLATION CONNEXE » MÊLAIT HUIT SITUATIONS : acte qui
 * amende l'article, acte qui l'abroge, dérogation (bail professionnel), lien vers le texte à jour,
 * ancienne rédaction d'un autre texte, source, et 24 notes « sic » (« Anomalie du texte imprimé »,
 * « Lacune de la source »…) — sous un titre qui annonçait une ancienne version même quand il n'y en
 * avait pas. La nature d'un bloc est son champ `kind` (posé par
 * `scripts/classer-replis-legislation-annotee.ts`), à défaut sa classification par `natureDuConnexe`.
 */
export function RelatedLaw({
  old,
  oldTitre,
  oldId,
  oldSituation = 'ancienne_redaction',
  oldEntete,
  blocks = [],
  locale,
  codeHrefs,
  terms,
}: {
  old?: string
  /** Titre de l'ancienne rédaction, s'il diffère du registre (Constitution : « Ancienne version (1987) »). */
  oldTitre?: string
  /** Ancre du repli d'ancienne rédaction (`hist-art-N` quand il tient lieu d'historique). */
  oldId?: string
  /** Article abrogé : son texte d'avant se titre « Texte abrogé », en gamme radié. */
  oldSituation?: Extract<Situation, 'ancienne_redaction' | 'texte_abroge'>
  /** Ligne datée de l'historique (« En vigueur depuis le … (acte) ») quand le repli tient lieu
   *  de l'entrée de bas de page. */
  oldEntete?: string
  blocks?: ConnexeBlock[]
  locale: Locale
  codeHrefs?: CodeHrefs
  /** Termes d'une recherche : surlignés, et chaque repli qui en contient un s'OUVRE d'office. */
  terms?: string[]
}) {
  const parNature = new Map<NatureConnexe, ConnexeBlock[]>()
  for (const b of blocks) {
    const n = natureDuConnexe(b)
    parNature.set(n, [...(parNature.get(n) ?? []), b])
  }
  if (!old && !parNature.size) return null
  return (
    <>
      {old && (
        <Repli situation={oldSituation} locale={locale} titre={oldSituation === 'ancienne_redaction' ? oldTitre : undefined} id={oldId} defautOuvert={contientTerme([old], terms)}>
          {oldEntete && <p className="mb-1.5 text-[11px] font-medium text-ank/80">{oldEntete}</p>}
          <p className="whitespace-pre-wrap text-[11.5px] italic leading-relaxed text-grafit">
            <CodeRefText text={old} codeHrefs={codeHrefs} terms={terms} />
          </p>
        </Repli>
      )}
      {NATURES_CONNEXE.filter((n) => parNature.has(n)).map((n) => {
        const bs = parNature.get(n)!
        const situation: Situation = situationDuConnexe(n)
        return (
          <Repli key={n} situation={situation} locale={locale} compteur={bs.length > 1 ? bs.length : undefined} defautOuvert={contientTerme(bs.flatMap((b) => [b.label, b.text]), terms)}>
            <div className="space-y-3">
              {bs.map((b, i) => (
                <div key={i}>
                  {b.label &&
                    (b.docId ? (
                      // Décret/loi téléversé → intitulé cliquable vers sa fiche (ancre optionnelle :
                      // « Constitution de 1987 » → article 35).
                      <Link
                        href={`/${locale}/doc/${b.docId}${b.anchor ? `#${b.anchor}` : ''}`}
                        className="text-[11.5px] font-semibold leading-snug text-chabon underline decoration-chabon/40 underline-offset-2 hover:decoration-chabon"
                      >
                        {b.label}
                      </Link>
                    ) : (
                      <p className="text-[11.5px] font-semibold leading-snug text-ank/80">
                        <CodeRefText text={b.label} codeHrefs={codeHrefs} terms={terms} />
                      </p>
                    ))}
                  {/* Le contenu d'un texte connexe cite les codes comme n'importe quelle
                      disposition (« - C. civ., 1728 ») : il passe par le linkificateur. */}
                  <p className="mt-1 whitespace-pre-wrap text-[11.5px] leading-relaxed text-grafit">
                    <CodeRefText text={b.text} codeHrefs={codeHrefs} terms={terms} />
                  </p>
                </div>
              ))}
            </div>
          </Repli>
        )
      })}
    </>
  )
}
