import Link from 'next/link'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { TYPE_SLUGS, type DocType, type Locale } from '@/lib/types'
import { DOC_TYPE_LIST } from '@/lib/brand'
import { ChampRecherche } from './ChampRecherche'

/** Sections où le statut EN_VIGUEUR/ABROGÉ existe réellement dans le corpus
 *  (l'Index et les marques sont en statut « PUBLIE » : proposer le filtre là
 *  ne produirait que des pages vides). */
const STATUS_TYPES: readonly DocType[] = ['LEGISLATION', 'DOCTRINE', 'CIRCULAIRE_BRH', 'LOI_FINANCES']

/**
 * Recherche avancée (§07) : panneau repliable au-dessus des résultats —
 * requête + SECTION (Législation annotée, Le Moniteur, Index, Marques… bornée
 * aux services accordés §03) + PÉRIODE « entre l'année X et Y » + numéro +
 * statut + critères de décision. Formulaire GET : les champs deviennent des
 * paramètres d'URL déjà compris par la page de recherche, donc partageables et
 * compatibles avec les puces de filtres existantes. Ouvert via ?adv=1 (lien de la
 * barre de recherche) ou dès qu'un critère avancé est actif.
 *
 * ⚠️ CHAQUE CASE PORTE SA CROIX D'EFFACEMENT (`ChampRecherche`). Un critère qu'on ne sait
 * pas retirer est un critère qui reste : les recherches revenaient filtrées sans que le
 * lecteur l'ait voulu.
 *
 * ⚠️ LES LARGEURS SUIVENT LE CONTENU, PAS UNE GRILLE UNIFORME. « Agriculture, ressources
 * naturelles & développement rural » ne tient pas dans la case d'un numéro de circulaire :
 * chaque champ porte la sienne, et tous repassent en pleine largeur sous 640 px.
 */
export function AdvancedSearch({
  locale,
  t,
  allowed,
  domaines = [],
  values,
  open,
}: {
  locale: Locale
  t: Dictionary
  allowed: DocType[]
  /** Un domaine de l'arbre, aplati pour le menu : la profondeur devient une indentation. */
  domaines?: { slug: string; label: string; profondeur: number }[]
  values: {
    q: string
    type?: string
    yearFrom?: string
    yearTo?: string
    num?: string
    status?: string
    parties?: string
    domaine?: string
    judge?: string
    mp?: string
  }
  open: boolean
}) {
  const sections = DOC_TYPE_LIST.filter((m) => allowed.includes(m.type))
  const currentType = values.type ? TYPE_SLUGS[values.type] : undefined
  const showStatus = !currentType || STATUS_TYPES.includes(currentType)
  // Les critères de DÉCISION ne s'affichent que là où ils ont un sens : proposés partout,
  // ils ne rendraient que des pages vides sur les marques ou l'Index du Moniteur.
  const showDecision = !currentType || currentType === 'JURISPRUDENCE'
  const effacer = t.search.clearField

  return (
    <details
      open={open}
      className="no-print rounded-2xl border border-chabon/10 bg-white open:pb-4"
    >
      <summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-3 text-sm font-semibold text-ank">
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-ank/80" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
        </svg>
        {t.search.advanced}
      </summary>
      <form method="get" action={`/${locale}/search`} className="flex flex-wrap items-end gap-x-5 gap-y-3 px-4 pt-1">
        {/* Reste ouvert après soumission. La REQUÊTE voyage en champ caché : la
            barre de recherche du haut est LA barre de la page — une seule barre
            par page (audit 17 juil.), le panneau ne porte que les critères. */}
        <input type="hidden" name="adv" value="1" />
        {values.q ? <input type="hidden" name="q" value={values.q} /> : null}

        <ChampRecherche
          name="type"
          label={t.search.section}
          defaultValue={values.type ?? ''}
          clearLabel={effacer}
          // « Marques de commerce & de fabrique » demande 242 px : la case de 256 px n'en
          // laissait que 180 une fois la croix et le chevron déduits, et la section la
          // plus longue s'y lisait coupée.
          className="w-full sm:w-80"
          options={[
            { value: '', label: t.search.allTypes },
            ...sections.map((m) => ({ value: m.slug, label: m.label[locale] })),
          ]}
        />

        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ank/80">{t.search.period}</span>
          <div className="flex flex-wrap items-end gap-1.5">
            <ChampRecherche
              name="yearFrom"
              label={t.search.yearFrom}
              defaultValue={values.yearFrom ?? ''}
              placeholder="1990"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              clearLabel={effacer}
              className="w-32"
            />
            <ChampRecherche
              name="yearTo"
              label={t.search.yearTo}
              defaultValue={values.yearTo ?? ''}
              placeholder="2026"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              clearLabel={effacer}
              className="w-32"
            />
          </div>
        </div>

        <ChampRecherche
          name="num"
          label={t.search.numberLabel}
          defaultValue={values.num ?? ''}
          placeholder={t.search.numberPh}
          maxLength={20}
          clearLabel={effacer}
          className="w-36"
        />

        {showDecision && (
          <>
            {/* Les PARTIES vivent dans l'intitulé (« Jules CESAR c. Fleurant LALANNE »).
                Chaque mot doit s'y trouver : « cesar lalanne » ne ramène que les arrêts qui
                opposent les deux, non ceux qui les citent — ce n'est pas la même question. */}
            <ChampRecherche
              name="parties"
              label={t.search.partiesLabel}
              defaultValue={values.parties ?? ''}
              placeholder={t.search.partiesPh}
              maxLength={80}
              clearLabel={effacer}
              className="w-full sm:w-60"
            />
            {/* ⚠️ MÊME NOMENCLATURE QUE LA LÉGISLATION ANNOTÉE, ET UN MENU. En champ libre,
                « procédure civile » et « Procédure civile (voies de recours) » étaient deux
                domaines pour un lecteur et deux requêtes pour le moteur ; le menu ne propose
                que des domaines qui EXISTENT, et un choix de tête ramène son sous-arbre. */}
            <ChampRecherche
              name="domaine"
              label={t.search.domaineLabel}
              defaultValue={values.domaine ?? ''}
              clearLabel={effacer}
              // Le plancher est MESURÉ, non estimé : le plus long domaine — « Agriculture,
              // ressources naturelles & développement rural » — demande 383 px de texte,
              // auxquels s'ajoutent la marge, la croix et le chevron. En dessous de 30 rem
              // le libellé se coupait, et un domaine tronqué ne se reconnaît pas.
              className="w-full sm:min-w-[30rem] sm:flex-1"
              options={[
                { value: '', label: t.common.all },
                ...domaines.map((d) => ({
                  value: d.slug,
                  // Espaces insécables : un <option> replie les espaces ordinaires et
                  // l'arborescence disparaîtrait.
                  label: `${'  '.repeat(d.profondeur)}${d.profondeur > 0 ? '· ' : ''}${d.label}`,
                })),
              ]}
            />
            {/* ⚠️ DEUX CHAMPS, PAS UN. Le substitut du commissaire du gouvernement n'a pas
                jugé : le ramener sous « magistrat » lui attribuerait des décisions qu'il
                n'a pas rendues. */}
            <ChampRecherche
              name="judge"
              label={t.search.judgeLabel}
              defaultValue={values.judge ?? ''}
              placeholder={t.search.judgePh}
              maxLength={80}
              clearLabel={effacer}
              className="w-full sm:w-52"
            />
            <ChampRecherche
              name="mp"
              label={t.search.mpLabel}
              defaultValue={values.mp ?? ''}
              placeholder={t.search.mpPh}
              maxLength={80}
              clearLabel={effacer}
              className="w-full sm:w-52"
            />
          </>
        )}

        {showStatus && (
          <ChampRecherche
            name="status"
            label={t.search.status}
            defaultValue={values.status ?? ''}
            clearLabel={effacer}
            className="w-full sm:w-48"
            options={[
              { value: '', label: t.common.all },
              { value: 'EN_VIGUEUR', label: t.statuses.EN_VIGUEUR },
              { value: 'ABROGE', label: t.statuses.ABROGE },
            ]}
          />
        )}

        <div className="flex items-center gap-3 pb-0.5">
          <button type="submit" className="rounded-lg bg-wouj px-4 py-2 text-sm font-semibold text-white hover:brightness-95">
            {t.search.apply}
          </button>
          {/* Réinitialise les CRITÈRES ; la requête appartient à la barre du haut. */}
          <Link
            href={`/${locale}/search?adv=1${values.q ? `&q=${encodeURIComponent(values.q)}` : ''}`}
            className="text-xs text-ank/45 hover:text-ank/70 hover:underline"
          >
            {t.search.reset}
          </Link>
        </div>
      </form>
    </details>
  )
}
