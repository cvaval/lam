import type { Locale } from '@/lib/types'
import type { Situation } from '@/lib/legislation/situations'
import { CodeRefText, type CodeHrefs } from './CodeRefText'
import { Repli } from './Repli'

/**
 * Ancienne rédaction d'un article amendé (ou texte d'un article abrogé) — repli fermé par défaut, au
 * gabarit commun. La version en vigueur reste le texte principal (règle du 26 août 2026).
 *
 * ⚠️ « ANCIENNE VERSION (1987) » ÉTAIT ÉCRIT EN DUR ICI. Le libellé, propre à la Constitution,
 * s'affichait sur cinq autres textes (TCA 2002, Code pénal de 1835, Arrêté marchés 2009, Loi
 * fondations 1934, Signature électronique 2017 — 23 articles). Le titre vient désormais du registre
 * (« Ancienne rédaction ») ou de la fiche (`annotations.oldVersionsLabel`, Constitution).
 */
export function OldVersion({
  text,
  locale,
  codeHrefs,
  titre,
  situation = 'ancienne_redaction',
  id,
}: {
  text: string
  locale: Locale
  codeHrefs?: CodeHrefs
  titre?: string
  situation?: Extract<Situation, 'ancienne_redaction' | 'texte_abroge'>
  id?: string
}) {
  return (
    <Repli situation={situation} locale={locale} titre={titre} id={id}>
      <p className="whitespace-pre-wrap text-[11.5px] italic leading-relaxed text-grafit">
        <CodeRefText text={text} codeHrefs={codeHrefs} />
      </p>
    </Repli>
  )
}
