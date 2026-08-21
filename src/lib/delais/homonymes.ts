/**
 * § 4.5 bis — LE CONTRÔLE DES NUMÉROS HOMONYMES DU CODE DU TRAVAIL. Fonctions PURES : on leur
 * passe le corps du Code, elles ne lisent rien. `scripts/verify-delais-travail.ts` est la
 * coquille qui va chercher ce corps en base ; la graine appelle le même contrôle.
 *
 * ⚠️ CORRECTIF (défaut 4 du cahier de recette). Le test « § 4.5 bis — les 8 entrées … portent
 * toutes leur occurrence et leur section, VERBATIM » était TAUTOLOGIQUE : il constatait que
 * `construireEntrees` recopie la constante `DESAMBIGUISATION_TRAVAIL` dans les entrées, sans
 * jamais ouvrir le Code du travail. La `phraseDeControle` — le SEUL verrou contre « afficher
 * une durée sous le texte d'un autre article », sur **207 numéros en double** — n'était
 * comparée à rien : elle n'était qu'IMPRIMÉE par la graine. Un test vert qui ne testait pas
 * la chose.
 *
 * Le contrôle exige TROIS choses, et les trois ensemble :
 *  1. l'occurrence désignée EXISTE dans le corps (991 en-têtes pour 520 ancres distinctes) ;
 *  2. la `phraseDeControle` est **dans le bloc de CETTE occurrence-là** — la trouver ailleurs
 *     ne suffit pas, c'est même le défaut qu'on cherche : la durée s'afficherait sous le
 *     texte d'un autre article ;
 *  3. le CHAPITRE porteur est celui qu'annonce `articleContexte`, puisque c'est lui qui
 *     devient l'ancre et le libellé à l'écran (« C. trav., art. 172 » nue est ambiguë).
 *
 * Rien n'est corrigé : un écart est un signal humain.
 */
import { articleAnchorFromHeading } from '../doc/anchors'
import type { Desambiguisation, EntreeGrainee } from './repertoire'

/**
 * Le répertoire n'écrit pas toujours « Art. N » : « Loi assurance, art. 168 » désigne
 * l'article 168 de la loi sur l'assurance, reproduite dans le Code du travail. L'ancre s'en
 * déduit du DERNIER numéro de la désignation, jamais du premier.
 */
export function ancreDeLaDesignation(article: string): string | null {
  const nums = [...(article ?? '').matchAll(/(\d+(?:[-.]\d+)?)/g)].map((m) => m[1])
  const dernier = nums.at(-1)
  return dernier ? (articleAnchorFromHeading(`Article ${dernier}`) ?? null) : null
}

export type BlocArticle = { texte: string; chapitre: string | null }

/**
 * Découpe un corps en blocs d'articles, chacun avec le CHAPITRE qui le porte. Un bloc va de
 * son en-tête au suivant. On ne se fie qu'à `articleAnchorFromHeading` : c'est la fonction
 * qui fabrique les ancres du lecteur, donc la seule qui découpe comme l'écran découpe.
 */
export function decouperParArticle(corps: string): Map<string, BlocArticle[]> {
  const parAncre = new Map<string, BlocArticle[]>()
  let chapitre: string | null = null
  let ancre: string | null = null
  let chapitreDuBloc: string | null = null
  let buf: string[] = []
  const pousser = () => {
    if (!ancre) return
    parAncre.set(ancre, [
      ...(parAncre.get(ancre) ?? []),
      { texte: buf.join('\n').trimEnd(), chapitre: chapitreDuBloc },
    ])
  }
  for (const brute of corps.split('\n')) {
    const l = brute.trim()
    if (/^(?:CHAPITRE|Chapitre)\b/.test(l)) chapitre = l
    const a = articleAnchorFromHeading(l)
    if (a) {
      pousser()
      ancre = a
      chapitreDuBloc = chapitre
      buf = [brute]
      continue
    }
    if (ancre) buf.push(brute)
  }
  pousser()
  return parAncre
}

/** Comparaison insensible à la casse, aux accents, aux apostrophes et aux espaces multiples. */
function normaliser(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function contient(bloc: string, phrase: string): boolean {
  return normaliser(bloc).includes(normaliser(phrase))
}

export type ConstatHomonyme = {
  slug: string
  article: string
  objetDebut: string
  ancre: string | null
  occurrence: number
  /** Combien de fois cette ancre porte un en-tête dans tout le corps. */
  occurrencesTotal: number
  chapitreAttendu: string
  chapitreLu: string | null
  phraseDeControle: string
  /** La phrase est-elle dans le bloc de CETTE occurrence-là ? */
  phraseDansLeBloc: boolean
  /** … et dans quelles autres occurrences du même numéro se trouve-t-elle aussi ? */
  occurrencesQuiPortentLaPhrase: number[]
  chapitreConcorde: boolean
  extrait: string
}

export type ResultatHomonymes = { constats: ConstatHomonyme[]; anomalies: string[] }

/** Le contrôle, sur un corps déjà lu. Exerçable sans réseau. */
export function controlerHomonymes(
  corps: string,
  entrees: readonly EntreeGrainee[],
  desambiguisations: readonly Desambiguisation[],
): ResultatHomonymes {
  const blocs = decouperParArticle(corps)
  const constats: ConstatHomonyme[] = []
  const anomalies: string[] = []

  for (const dd of desambiguisations) {
    const entree = entrees.find(
      (e) => e.code === 'TRAVAIL' && e.article === dd.article && e.objetFr.startsWith(dd.objetDebut),
    )
    if (!entree) {
      anomalies.push(`§ 4.5 bis — aucune entrée pour ${dd.article} / « ${dd.objetDebut} »`)
      continue
    }
    const slug = entree.slug
    if (entree.articleOccurrence !== dd.articleOccurrence) {
      anomalies.push(
        `§ 4.5 bis — ${slug} : occurrence ${entree.articleOccurrence} dans l’entrée, ` +
          `${dd.articleOccurrence} dans la surcharge`,
      )
    }
    const ancre = ancreDeLaDesignation(dd.article)
    const tous = ancre ? (blocs.get(ancre) ?? []) : []
    const bloc = tous[dd.articleOccurrence - 1]
    const quiPortent = tous
      .map((b, i) => (contient(b.texte, dd.phraseDeControle) ? i + 1 : 0))
      .filter((n) => n > 0)
    const phraseDansLeBloc = bloc ? contient(bloc.texte, dd.phraseDeControle) : false
    const chapitreConcorde = bloc
      ? normaliser(bloc.chapitre ?? '') === normaliser(dd.articleContexte)
      : false

    constats.push({
      slug,
      article: dd.article,
      objetDebut: dd.objetDebut,
      ancre,
      occurrence: dd.articleOccurrence,
      occurrencesTotal: tous.length,
      chapitreAttendu: dd.articleContexte,
      chapitreLu: bloc?.chapitre ?? null,
      phraseDeControle: dd.phraseDeControle,
      phraseDansLeBloc,
      occurrencesQuiPortentLaPhrase: quiPortent,
      chapitreConcorde,
      extrait: bloc ? bloc.texte.replace(/\s+/g, ' ').slice(0, 220) : '',
    })

    if (!ancre) {
      anomalies.push(`§ 4.5 bis — ${slug} : aucune ancre ne se déduit de « ${dd.article} »`)
      continue
    }
    if (!bloc) {
      anomalies.push(
        `§ 4.5 bis — ${slug} : l’occurrence ${dd.articleOccurrence} de « ${ancre} » n’existe ` +
          `pas (le corps en porte ${tous.length})`,
      )
      continue
    }
    if (!phraseDansLeBloc) {
      anomalies.push(
        `§ 4.5 bis — ${slug} : « ${dd.phraseDeControle} » ABSENTE du bloc de l’occurrence ` +
          `${dd.articleOccurrence} de « ${ancre} »` +
          (quiPortent.length > 0
            ? ` — elle est à l’occurrence ${quiPortent.join(', ')} : la durée serait affichée ` +
              `sous le texte d’un AUTRE article`
            : ' — et dans aucune autre occurrence non plus'),
      )
    }
    if (!chapitreConcorde) {
      anomalies.push(
        `§ 4.5 bis — ${slug} : chapitre lu « ${bloc.chapitre ?? '(aucun)'} » ≠ ` +
          `articleContexte « ${dd.articleContexte} »`,
      )
    }
  }

  const porteuses = entrees.filter((e) => e.code === 'TRAVAIL' && e.articleContexte).length
  if (porteuses !== desambiguisations.length) {
    anomalies.push(
      `§ 4.5 bis — ${porteuses} entrées portent un articleContexte, ` +
        `${desambiguisations.length} surcharges déclarées`,
    )
  }
  return { constats, anomalies }
}

/** L'affichage, commun au script de recette et à la graine. */
export function imprimerHomonymes(r: ResultatHomonymes, ligne: (s: string) => void): void {
  for (const c of r.constats) {
    const ok = c.phraseDansLeBloc && c.chapitreConcorde
    ligne(
      `${ok ? '✓' : '✗'} ${c.article.padEnd(26)} occ ${c.occurrence}/${c.occurrencesTotal} · ` +
        `« ${c.phraseDeControle} » ${c.phraseDansLeBloc ? 'présente' : 'ABSENTE'} · chapitre ` +
        `${c.chapitreConcorde ? 'concordant' : 'DISCORDANT'}`,
    )
    ligne(`    ${c.extrait.slice(0, 150)}`)
  }
  ligne('')
  ligne(
    r.anomalies.length === 0
      ? `✓ Les ${r.constats.length} entrées homonymes portent leur durée sous LEUR article.`
      : `✗ ${r.anomalies.length} anomalie(s) — signal humain, rien n’est corrigé :`,
  )
  for (const a of r.anomalies) ligne(`   - ${a}`)
}
