import Link from 'next/link'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'
import { articleAnchorFromNum } from '@/lib/doc/anchors'
import { dateComplete, dateEnToutesLettres } from '@/lib/delais'
import type { Resultat } from '@/lib/delais'
import { articleAffiche, numeroArticle } from '@/lib/delais/calcul'
import { champEntree } from '@/lib/delais/feries'
import { textesAppliques } from '@/lib/delais/affichage'
import { DelaiFocusResultat } from './DelaiFocusResultat'
import type { MotifProrogation } from '@/lib/delais/calcul'
import type { Bandeau, EntreePublique, FenetrePublique } from '@/lib/delais/lecture-publique'
import { messageErreur } from './messages'
import { DelaiActions } from './DelaiActions'

/**
 * § 6.3 — LE RÉSULTAT. Composant SERVEUR : il se rend sans JavaScript, s'imprime et se
 * partage. Aucune interactivité ici hormis les deux boutons de la barre d'actions, qui sont
 * un composant client à part.
 *
 * Trois règles de rédaction, toutes trois issues du § 0, et qu'une future édition ne doit pas
 * défaire :
 *
 *  1. **TOUT EST DÉPLIÉ.** Pas un `<details>`, pas un « voir plus », pas un onglet. La
 *     cliente l'a expressément demandé : une date sans son raisonnement est plus dangereuse
 *     qu'une absence de calculateur, et un raisonnement replié est un raisonnement absent
 *     pour qui ne clique pas.
 *  2. **Aucune information n'est portée par la seule couleur.** Wouj et Vèt sont à 1,05:1 de
 *     luminance : chaque état — refus, réserve, avertissement, fête sans source — porte son
 *     libellé écrit. Retirez toute la couleur de cet écran : il dit exactement la même chose.
 *  3. **Le Sitwon atteste la SOURCE d'une fête, JAMAIS la date calculée.** Une date calculée
 *     n'est pas un fait vérifié, c'est le produit d'une lecture ; la badger en Sitwon serait
 *     un mensonge de charte (§ 8.1).
 *
 * ⚠️ **Aucun horodatage.** Le pied technique porte les trois versions et le permalien, jamais
 * « calculé le … à … » : le bloc 12 exige qu'un permalien rechargé rende le même écran au
 * caractère près, et l'heure d'été haïtienne est instable depuis 2016.
 */

type Props = {
  locale: Locale
  t: Dictionary
  resultat: Resultat
  entree: EntreePublique
  permalien: string
  versionCalendrier: number
  versionFenetres: number
  fenetres: FenetrePublique[]
  bandeau: Bandeau
  /** Utilisateur connecté : les liens profonds vers le corpus sont actifs (§ 6.3 g, § 6.4). */
  connecte: boolean
  /** § 6.2 — les avertissements de SAISIE (date lointaine). Rendus au-dessus du résultat. */
  avertissementsSaisie?: string[]
}

const remplacer = (modele: string, valeurs: Record<string, string | number>): string =>
  Object.entries(valeurs).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v)), modele)

/** Le titre de section, partout le même : filet Wouj éditorial, texte Ank. */
function TitreBloc({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="border-l-[3px] border-wouj pl-3 font-sans text-sm font-semibold uppercase tracking-wide text-ank">
      {children}
    </h3>
  )
}

function Bloc({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  // Tout texte juridique se lit sur BLAN (§ 8.1, règle 3). Élévation zéro : bordure `liy`,
  // aucune ombre.
  return <section className={`rounded-xl border border-liy bg-white p-5 ${className}`}>{children}</section>
}

/** Le lien profond vers le corpus — actif pour un connecté, prévenu pour un visiteur. */
function LienCorpus({
  locale,
  t,
  docId,
  numeroArticle,
  connecte,
  requete,
}: {
  locale: Locale
  t: Dictionary
  docId: string | null
  numeroArticle: string | null
  connecte: boolean
  requete: string
}) {
  const d = t.delais
  if (connecte) {
    // Le texte est gelé avec son `Document.id` : l'ancre se construit avec la fonction du
    // dépôt (`articleAnchorFromNum`), jamais à la main — les numérotations étendues
    // (« 95-bis », « 12-1 ») s'y perdraient.
    if (docId) {
      const ancre = numeroArticle ? `#${articleAnchorFromNum(numeroArticle)}` : ''
      return (
        <Link
          href={`/${locale}/doc/${docId}${ancre}`}
          className="inline-flex min-h-[44px] items-center text-xs font-medium text-chabon underline underline-offset-2"
        >
          {d.openCode}
        </Link>
      )
    }
    // L'article de l'entrée n'a pas de `Document.id` gelé : on ouvre la recherche du corpus
    // sur sa désignation plutôt que d'inventer un lien qui tomberait dans le vide.
    return (
      <Link
        href={`/${locale}/search?q=${requete}`}
        className="inline-flex min-h-[44px] items-center text-xs font-medium text-chabon underline underline-offset-2"
      >
        {remplacer(d.searchCorpus, { q: decodeURIComponent(requete) })}
      </Link>
    )
  }
  // Sur la page publique, le lecteur du corpus est derrière l'authentification : on cite le
  // texte EN ENTIER sur place (ci-dessus) et on prévient avant d'envoyer sur un mur de
  // connexion. Ne jamais y renvoyer un visiteur anonyme sans l'avoir dit.
  return (
    <Link
      href={`/${locale}/login?next=${encodeURIComponent(`/${locale}/search?q=${requete}`)}`}
      className="inline-flex min-h-[44px] items-center text-xs font-medium text-grafit underline underline-offset-2"
    >
      {d.searchCorpusLoginRequired}
    </Link>
  )
}

/**
 * § 4.13, exigence 4 — LE RENVOI AU CORPUS D'UN AVERTISSEMENT. Même arbitrage que
 * `LienCorpus` : actif pour un connecté, annoncé « connexion requise » pour un visiteur.
 */
function LienRecherche({
  locale,
  t,
  connecte,
  requete,
  libelle,
}: {
  locale: Locale
  t: Dictionary
  connecte: boolean
  requete: string
  libelle: string
}) {
  const cible = `/${locale}/search?q=${requete}`
  return (
    <Link
      href={connecte ? cible : `/${locale}/login?next=${encodeURIComponent(cible)}`}
      className="font-medium text-chabon underline underline-offset-2"
    >
      {connecte ? libelle : t.delais.searchCorpusLoginRequired}
    </Link>
  )
}

// ---------------------------------------------------------------------------
// § 7.3 — les bandeaux d'un permalien rouvert
// ---------------------------------------------------------------------------

function BandeauRevision({ t, bandeau, locale }: { t: Dictionary; bandeau: Bandeau; locale: Locale }) {
  const d = t.delais
  if (!bandeau) return null
  if (bandeau.type === 'ENTREE_RETIREE') {
    return (
      <div role="status" className="rounded-xl border-l-[3px] border-chabon bg-pil px-4 py-3 text-sm text-ank">
        <p className="font-semibold">
          {remplacer(d.bannerWithdrawnTitle, { date: bandeau.retireeLe ?? '—' })}
        </p>
        {bandeau.motif && <p className="mt-1">{remplacer(d.bannerWithdrawnReason, { motif: bandeau.motif })}</p>}
        {/* AUCUN bouton de recalcul : la plateforme ne propose plus cette entrée (§ 7.3). */}
        <p className="mt-1 text-ank/80">{d.bannerWithdrawnKept}</p>
      </div>
    )
  }
  return (
    <div role="status" className="rounded-xl border-l-[3px] border-chabon bg-pil px-4 py-3 text-sm text-ank">
      <p className="font-semibold">{d.bannerRuleChangedTitle}</p>
      <p className="mt-1">
        {remplacer(d.bannerRuleChangedBody, {
          article: '',
          de: bandeau.revisionDemandee,
          vers: bandeau.revisionCourante,
          date: bandeau.changeeLe ?? '—',
        })}
      </p>
      {/* Un SECOND permalien, à côté, jamais à la place : le calcul cité reste lisible. */}
      <Link
        href={bandeau.hrefActuelle}
        hrefLang={locale}
        className="mt-2 inline-flex min-h-[44px] items-center font-medium text-chabon underline underline-offset-2"
      >
        {d.bannerRecompute}
      </Link>
    </div>
  )
}

/**
 * § 6.2 — LES AVERTISSEMENTS DE SAISIE. Non bloquants, et distincts des A1…A6 du moteur : ils
 * portent sur ce que l'utilisatrice a tapé, pas sur le droit. Aujourd'hui : une date de
 * départ à plus de dix ans, qui est presque toujours une faute de frappe sur le millésime.
 */
function AvertissementsSaisie({ t, codes }: { t: Dictionary; codes: string[] }) {
  if (codes.length === 0) return null
  return (
    <div role="status" className="rounded-xl border-l-[3px] border-chabon bg-pil px-4 py-3 text-sm text-ank">
      {codes.map((c) => (
        <p key={c}>{c === 'farFuture' ? t.delais.errFarFuture : messageErreur(t, c)}</p>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Le corps du résultat
// ---------------------------------------------------------------------------

export function DelaiResult(props: Props) {
  const { locale, t, resultat, entree, permalien, fenetres, connecte } = props
  const d = t.delais
  // ⚠️ `numeroArticle` : 135 des 393 lignes portent déjà « Art. » dans `article`. Sans lui,
  // la requête corpus part en « Code du travail article Art. 164 » (défaut 13).
  const numero = numeroArticle(entree.article)
  /**
   * ⚠️ `articleAffiche` plutôt que le gabarit « art. {numéro} » : le genre « Autre » du
   * § 4.12 n'a PAS d'article, et son `article` est vide. Le gabarit composait alors
   * « Délai saisi (hors répertoire) · art. » — et, avant que la nature ne quitte `article`,
   * « · art. Délai indiqué dans l'acte ». `articleAffiche` rend la chaîne vide, et la ligne
   * se tait ; « Loi, art. 10 » et « Jur. (art. 488) » y gardent leur forme propre.
   */
  const reference = articleAffiche(entree.article)
  // La requête corpus ne dit « article » que s'il y en a un : sans cela, elle partait en
  // « Délai saisi (hors répertoire) article » — une recherche sur une phrase tronquée.
  const requete = encodeURIComponent(numero ? `${entree.codeLibelle} article ${numero}` : entree.codeLibelle)
  // § 8.2 — ce que la rédaction a traduit s'affiche traduit ; le reste retombe sur le
  // français. `dureeTexte` et les citations d'articles, eux, ne sont JAMAIS traduits.
  const objet = champEntree(entree, entree.objetFr, entree.objetEn, entree.objetHt, locale)
  const pointDepart = champEntree(entree, entree.pointDepartFr, entree.pointDepartEn, entree.pointDepartHt, locale)
  const sanction = champEntree(entree, entree.sanctionFr, entree.sanctionEn, entree.sanctionHt, locale)

  const pied = (
    <div className="mt-6 border-t border-liy pt-4 text-xs text-grafit">
      <p>
        {remplacer(d.footerCalendar, { n: props.versionCalendrier })} ·{' '}
        {remplacer(d.footerWindows, { n: props.versionFenetres })}
        {/* § 4.6 — la version des RÈGLES DE LECTURE, à côté de celle du calendrier : elle est
            une coordonnée du calcul depuis le 20 août 2026, et un calcul cité doit dire sous
            quelle règle il a été rendu. Un REFUS n'a pas de date : il n'en porte donc pas. */}
        {resultat.statut === 'CALCUL' && (
          <>
            {' · '}
            {remplacer(d.footerRules, { n: resultat.versionRegles })}
          </>
        )}
        {entree.revision != null && (
          <>
            {' · '}
            {remplacer(d.footerEntry, {
              code: entree.code,
              article: numero,
              r: entree.revision,
            })}
          </>
        )}
      </p>
      {/* Une page imprimée sans son URL n'est pas vérifiable : le permalien est écrit en
          toutes lettres, et il l'est AUSSI à l'impression. */}
      <p className="mt-1 break-all">
        <span className="font-medium text-ank">{d.permalinkLabel} :</span>{' '}
        <code className="font-mono text-[11px]">{permalien}</code>
      </p>
    </div>
  )

  const enTete = (
    <header>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-grafit">
        {entree.codeLibelle}
        {reference ? ` · ${reference}` : ''}
        {entree.articleContexte ? ` · ${entree.articleContexte}` : ''}
      </p>
      <p className="mt-1 text-base font-medium text-ank">{objet}</p>
      <p className="mt-1 text-sm text-grafit">
        <span className="font-medium text-ank">{d.entryDurationLabel} :</span> {entree.dureeTexte}
      </p>
      {entree.dureeFondementFr && <p className="mt-0.5 text-sm text-grafit">{entree.dureeFondementFr}</p>}
    </header>
  )

  // ── Refus (§ 4.4) : pas de champ « date limite », AUCUNE date, pas même deux. ──────────
  if (resultat.statut === 'REFUS') {
    return (
      <div className="flex flex-col gap-4">
        <DelaiFocusResultat />
        <BandeauRevision t={t} bandeau={props.bandeau} locale={locale} />
        <AvertissementsSaisie t={t} codes={props.avertissementsSaisie ?? []} />
        <Bloc>
          {enTete}
          <h2
            id="delai-resultat-titre"
            tabIndex={-1}
            className="mt-4 border-l-[3px] border-wouj pl-3 font-sans text-xl font-semibold text-ank"
          >
            {d.refusalTitle}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ank">
            <span className="font-semibold">{d.refusalReason} :</span> {resultat.motif}
          </p>
          <p className="mt-2 text-sm text-grafit">
            <span className="font-medium text-ank">{d.regimeLabel} :</span> {resultat.regimeAffiche}
          </p>
          {sanction && (
            <p className="mt-2 text-sm text-grafit">
              <span className="font-medium text-ank">{d.entrySanctionLabel} :</span> {sanction}
            </p>
          )}
          <p className="mt-2 text-sm text-grafit">
            <span className="font-medium text-ank">{d.entryStartLabel} :</span> {pointDepart}
          </p>
          {/* Le refus n'est pas un cul-de-sac : on renvoie au texte de l'article. */}
          <div className="mt-3">
            <LienCorpus locale={locale} t={t} docId={null} numeroArticle={numero} connecte={connecte} requete={requete} />
          </div>
          {pied}
        </Bloc>
      </div>
    )
  }

  // ── Saisie incomplète : ce qui manque, en toutes lettres. ──────────────────────────────
  if (resultat.statut === 'INCOMPLET') {
    return (
      <div className="flex flex-col gap-4">
        <DelaiFocusResultat />
        <BandeauRevision t={t} bandeau={props.bandeau} locale={locale} />
        <AvertissementsSaisie t={t} codes={props.avertissementsSaisie ?? []} />
        <Bloc>
          {enTete}
          <h2
            id="delai-resultat-titre"
            tabIndex={-1}
            className="mt-4 border-l-[3px] border-wouj pl-3 font-sans text-xl font-semibold text-ank"
          >
            {d.incompleteTitle}
          </h2>
          <p className="mt-3 text-sm font-medium text-ank">{d.incompleteMissing}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ank">
            {resultat.manque.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          {pied}
        </Bloc>
      </div>
    )
  }

  const textes = textesAppliques(
    {
      slug: entree.slug,
      code: entree.code,
      article: entree.article,
      // La NATURE du genre « Autre » — `article` y est vide (§ 4.12).
      objetFr: entree.objetFr,
      dureeTexte: entree.dureeTexte,
      dureeFondementFr: entree.dureeFondementFr,
      // § 6.3 g — quand la plateforme détient le texte de l'article, elle le cite SUR PLACE
      // plutôt que de renvoyer un visiteur public derrière un mur de connexion (défaut 23).
      citationArticle: entree.citationArticle,
    },
    locale,
  )
  const fenetreMatiere = fenetres.filter((f) => (entree.code === 'TRAVAIL' ? f.matiere === 'TRAVAIL' : f.matiere === 'CIVILE'))

  return (
    <div className="flex flex-col gap-4">
      {/* § 6.5 / § 8.3 — le focus va AU RÉSULTAT, et sur téléphone la vue avec lui. */}
      <DelaiFocusResultat />
      <BandeauRevision t={t} bandeau={props.bandeau} locale={locale} />
      <AvertissementsSaisie t={t} codes={props.avertissementsSaisie ?? []} />

      {/* a) LA DATE, en toutes lettres ET en chiffres, avec le jour de la semaine. */}
      <Bloc>
        {enTete}
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-grafit">{d.resultTitle}</p>
        <h2
          id="delai-resultat-titre"
          tabIndex={-1}
          className="mt-1 font-sans text-display-3 text-ank"
        >
          {dateComplete(resultat.teteAffiche, locale)}
        </h2>

        {/* b) La phrase de sécurité — invariable, rédigée par le moteur. */}
        <p className="mt-3 max-w-2xl border-l-[3px] border-liy-fonse pl-3 text-sm leading-relaxed text-ank">
          {resultat.phraseSecurite}
        </p>

        <div className="no-print mt-5 hidden lg:block">
          <DelaiActions
            t={t}
            locale={locale}
            resultat={resultat}
            entree={{
              slug: entree.slug,
              code: entree.code,
              article: entree.article,
              objetFr: objet,
              dureeTexte: entree.dureeTexte,
              dureeFondementFr: entree.dureeFondementFr,
              citationArticle: entree.citationArticle,
            }}
            permalien={permalien}
            versionCalendrier={props.versionCalendrier}
            versionFenetres={props.versionFenetres}
            revision={entree.revision}
            // § 7.3 — le bandeau part AUSSI dans le presse-papiers : c'est la citation que
            // l'avocate colle dans une écriture (défaut 3).
            bandeau={props.bandeau}
          />
        </div>
      </Bloc>

      {/* e) Le jour praticable — seulement quand la tête d'affiche est un jour où l'on ne
             peut matériellement rien faire. Il ne modifie JAMAIS la date de droit.

             ⚠️ **`texteMidi` LE DÉCLENCHE AUSSI, ET SANS `necessaire`** (§ 4.10, 20 août 2026,
             au vu du décret). Quand la tête d'affiche EST le Lundi Gras, aucun jour n'est
             reculé — `necessaire` vaut donc `false` — et c'est précisément là que la mention
             compte le plus : la fenêtre s'y ferme à midi. En petits caractères, sans encadré ni
             couleur d'alerte : la charte réserve l'accent à une source attestée (§ 8.1), et
             dire l'heure d'un jour n'est pas attester une source. */}
      {(resultat.praticable.necessaire || resultat.praticable.texteMidi !== '') && (
        <Bloc>
          <TitreBloc>{d.practicableTitle}</TitreBloc>
          {resultat.praticable.necessaire && (
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ank">
              {resultat.praticable.texte}
            </p>
          )}
          {resultat.praticable.texteMidi !== '' && (
            <p className="mt-3 text-xs leading-relaxed text-grafit">
              {resultat.praticable.texteMidi}
            </p>
          )}
          {/* ⚠️ La liste ne se rend QUE si elle a des lignes : quand le bloc ne paraît que pour
              la fenêtre écourtée de midi, aucun jour n'est empêché, et un `<dl>` vide est un
              nœud de structure que les lecteurs d'écran annoncent (« liste de définitions »)
              sans rien à lire dedans. */}
          {resultat.praticable.joursEmpeches.length > 0 && (
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            {resultat.praticable.joursEmpeches.map((j) => (
              <div key={`${j.date.y}-${j.date.m}-${j.date.d}`} className="rounded-lg border border-liy bg-koton px-3 py-2">
                <dt className="text-sm font-medium text-ank">{dateEnToutesLettres(j.date, locale)}</dt>
                <dd className="mt-0.5 text-xs text-grafit">
                  {j.empechements.map((e) => (
                    <span key={e.cle} className="block">
                      {e.libelle} — {e.source} ({e.certitude === 'CERTAINE' ? d.certaintySure : d.certaintyConditional})
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
          )}
        </Bloc>
      )}

      {/* c) LE RAISONNEMENT — une phrase complète par étape, pour qu'un lecteur d'écran lise
             un récit et non une grille d'icônes. */}
      <Bloc>
        <TitreBloc id="delai-etapes">{d.stepsTitle}</TitreBloc>
        <ol aria-labelledby="delai-etapes" className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ank">
          {resultat.etapes.map((e, i) => (
            <li key={`${e.cle}-${i}`}>{e.texte}</li>
          ))}
        </ol>
      </Bloc>

      {/* d) Les jours écartés, et POURQUOI. Sous 640 px, une liste de définitions : jamais un
             tableau à faire défiler latéralement (§ 6.5).

             ⚠️ **RÉSERVÉ À L'ESPACE CONNECTÉ.** Le titre nomme une mécanique — l'écartement
             des dimanches, des fêtes légales et des jours de chômage — que la surface
             publique n'exécute plus (`franc-pur.ts`) : `joursEcartes` y est vide PAR
             CONSTRUCTION, et le bloc n'imprimait que « Aucun jour écarté. » sur 100 % des
             résultats. C'est le motif même pour lequel `publicIntro` a perdu sa promesse
             « et les jours écartés » — la promesse avait quitté la note, le rayon vide était
             resté sur l'écran. Au portail, où les jours écartés sont réels, rien ne change. */}
      {connecte && (
      <Bloc>
        <TitreBloc id="delai-ecartes">{d.skippedTitle}</TitreBloc>
        {resultat.joursEcartes.length === 0 ? (
          <p className="mt-3 text-sm text-ank">{d.skippedNone}</p>
        ) : (
          <>
            <dl className="mt-3 space-y-3 sm:hidden">
              {resultat.joursEcartes.flatMap((j) =>
                j.motifs.map((m) => (
                  <div key={`${j.date.y}${j.date.m}${j.date.d}-${m.cle}`} className="rounded-lg border border-liy bg-koton px-3 py-2">
                    <dt className="text-sm font-medium text-ank">{dateEnToutesLettres(j.date, locale)}</dt>
                    <dd className="mt-1 text-xs text-grafit">
                      <span className="block text-ank">{m.libelle}</span>
                      <span className="mt-0.5 block">{m.source}</span>
                      <SourceMarque t={t} motif={m} />
                      {m.noteJournee && <span className="mt-1 block text-ank">{m.noteJournee}</span>}
                    </dd>
                  </div>
                )),
              )}
            </dl>
            <div className="mt-3 hidden overflow-x-auto sm:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-liy text-xs uppercase tracking-wide text-grafit">
                    <th scope="col" className="py-2 pr-3 font-semibold">{d.skippedDate}</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">{d.skippedReason}</th>
                    <th scope="col" className="py-2 font-semibold">{d.skippedSource}</th>
                  </tr>
                </thead>
                <tbody>
                  {resultat.joursEcartes.flatMap((j) =>
                    j.motifs.map((m) => (
                      <tr key={`${j.date.y}${j.date.m}${j.date.d}-${m.cle}`} className="border-b border-liy/60 align-top">
                        <td className="py-2 pr-3 text-ank">{dateEnToutesLettres(j.date, locale)}</td>
                        <td className="py-2 pr-3 text-ank">
                          {m.libelle}
                          {m.noteJournee && <span className="mt-0.5 block text-xs text-grafit">{m.noteJournee}</span>}
                        </td>
                        <td className="py-2 text-grafit">
                          {m.source}
                          <SourceMarque t={t} motif={m} />
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Bloc>
      )}

      {/* f) Les réserves — chacune NOMMÉE, avec son fondement cité et sa date.

             ⚠️ **NE JAMAIS AFFIRMER CE QU'ON N'A PAS VÉRIFIÉ.** Rendu sans condition, ce bloc
             écrivait « Aucune lecture concurrente ne donne une date différente. » sur 100 %
             des résultats publics, alors que la page n'en affiche aucune.

             ⚠️ **CE COMMENTAIRE A ÉTÉ RÉÉCRIT LE 20 AOÛT 2026 AU SOIR : SON RAISONNEMENT ÉTAIT
             PÉRIMÉ, ET SON EXEMPLE FAUX.** Il expliquait la faute par
             `PROROGATION_FRANC_PUR.prorogation991 === 'NON'` — c'est `'OUI'` depuis la seconde
             décision du jour (`franc-pur.ts`) — et l'illustrait par « sur `?d=2026-06-04&n=30`,
             la tête tombe le DIMANCHE 5 juillet 2026 » : vérifié à l'API, la tête est le LUNDI
             6 juillet, puisque la surface publique proroge. Dans un dépôt où le commentaire fait
             foi, un raisonnement faux se rejoue.

             CE QUI RESTE VRAI, et qui suffit : **le bloc des lectures ne se rend en public que
             s'il y en a.** Sous la configuration publique, le moteur n'en ouvre qu'une —
             `DEMI_JOURNEE`, celle du Lundi Gras (§ 4.10) ; R1, R3 et CUMUL rendent exactement
             la date de la tête d'affiche, et `ajouter()` les écarte lui-même. Une phrase qui
             CONSTATE l'absence de divergence n'aurait donc, la plupart du temps, rien constaté
             du tout.

             ⚠️ **« le moteur n'en ouvre AUCUNE » : CETTE LIGNE A ÉTÉ CORRIGÉE LE 20 AOÛT 2026
             AU SOIR**, après le correctif du défaut 2. Elle était devenue fausse sur 40 des
             7 304 calculs du balayage de `franc-pur.test.ts` (§ 0) — et c'est justement là que
             la condition ci-dessous change de résultat.

             `connecte ||` et non `connecte &&` : au portail le bloc reste rendu même vide,
             car là l'absence de lecture concurrente est un CONSTAT — le moteur les a
             cherchées, sous une tête d'affiche étroite. */}
      {(connecte || resultat.lectures.length > 0) && (
      <Bloc>
        <TitreBloc id="delai-lectures">{d.readingsTitle}</TitreBloc>
        {resultat.lectures.length === 0 ? (
          <p className="mt-3 text-sm text-ank">{d.readingsNone}</p>
        ) : (
          <>
            <ul className="mt-3 space-y-3">
              {resultat.lectures.map((l) => (
                <li key={l.cle} className="rounded-lg border border-liy bg-koton px-3 py-2.5">
                  <p className="text-sm font-medium text-ank">
                    {l.libelle} <span className="font-normal text-grafit">— {d.readingsDate} :</span>{' '}
                    {dateEnToutesLettres(l.date, locale)}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-grafit">
                    <span className="font-medium text-ank">{d.readingsBasis} :</span> {l.fondement}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm font-medium text-ank">
              {d.widestReading} → {dateEnToutesLettres(resultat.lectureLaPlusLarge, locale)}
            </p>
          </>
        )}
      </Bloc>
      )}

      {/* g) Les textes appliqués, cités INTÉGRALEMENT. § 6.3 : « dans cet ordre » —
             g) avant h). */}
      <Bloc>
        <TitreBloc id="delai-textes">{d.textsTitle}</TitreBloc>
        <div className="mt-3 space-y-4">
          {textes.map((x) => (
            <article key={x.cle}>
              <h4 className="text-sm font-semibold text-ank">{x.reference}</h4>
              <p className="mt-1 whitespace-pre-line font-serif text-sm leading-relaxed text-ank">{x.texte}</p>
              <p className="mt-1 text-xs text-grafit">{x.source}</p>
              <LienCorpus
                locale={locale}
                t={t}
                docId={x.docId}
                numeroArticle={x.numeroArticle}
                connecte={connecte}
                requete={requete}
              />
            </article>
          ))}
        </div>
      </Bloc>

      {/* h) Les avertissements. Le moteur les rend DÉJÀ dans l'ordre imposé (A6, A2, A4,
             A5/A5-bis, A1, A3) : ne les retrie pas ici, et n'en masque aucun. */}
      <Bloc>
        <TitreBloc id="delai-avertissements">{d.warningsTitle}</TitreBloc>
        <ul className="mt-3 space-y-2.5">
          {resultat.avertissements.map((a) => (
            <li key={a.cle} className="flex gap-2.5 text-sm leading-relaxed text-ank">
              <span className="mt-0.5 shrink-0 font-mono text-[11px] font-bold text-grafit">{a.cle.replace('_', '-')}</span>
              <span>
                {a.texte}
                {/* § 4.13, exigence 4 — A6 annonce un chemin vers le corpus : il doit en
                    être un. La recherche était concaténée EN TEXTE dans la phrase
                    (« [Rechercher « carnaval » dans le corpus] ») : des crochets inertes. */}
                {a.rechercheQ && (
                  <>
                    {' '}
                    <LienRecherche
                      locale={locale}
                      t={t}
                      connecte={connecte}
                      requete={encodeURIComponent(a.rechercheQ)}
                      libelle={a.rechercheLibelle ?? a.rechercheQ}
                    />
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Bloc>

      {/* Les fenêtres de signification — la matière décide laquelle s'affiche.

          ⚠️ **`connecte` D'ABORD.** L'heure de signification est une information de PROCÉDURE :
          elle n'a de sens qu'une fois l'acte qualifié, et c'est ce même motif qui a retiré le
          bloc « jour praticable » de la surface publique. L'entrée synthétique publique étant
          de code CIVIL, la fenêtre civile s'affichait sur TOUS les résultats publics — en
          nommant l'art. 991 quatre lignes après « sans y appliquer aucun report ».
          `calculPublic(..., 'public')` ne rend d'ailleurs plus les fenêtres du tout : cette
          garde-ci est la seconde serrure, du côté de l'écran. */}
      {connecte && fenetreMatiere.length > 0 && (
        <Bloc>
          <TitreBloc>{d.windowsTitle}</TitreBloc>
          <ul className="mt-3 space-y-2 text-sm text-ank">
            {fenetreMatiere.map((f) => (
              <li key={f.matiere}>
                <span className="font-medium">
                  {f.matiere === 'TRAVAIL' ? d.windowsWork : d.windowsCivil}
                </span>{' '}
                — {remplacer(d.windowsHours, { a: f.heureDebut, b: f.heureFin })} · {f.source}
                {f.nullite && (
                  <span className="mt-0.5 block text-xs font-medium text-ank">
                    {d.windowsNullity}
                    {f.nulliteTexteFr ? ` — ${f.nulliteTexteFr}` : ''}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Bloc>
      )}

      {/* i) Le pied technique. */}
      <Bloc>{pied}</Bloc>

      {/* § 6.5 — la même barre, collante, sous 1024 px : la première est en haut du bloc de
          tête et sort de vue dès qu'on lit. Masquée à l'impression. */}
      <DelaiActions
        t={t}
        locale={locale}
        resultat={resultat}
        entree={{
          slug: entree.slug,
          code: entree.code,
          article: entree.article,
          objetFr: objet,
          dureeTexte: entree.dureeTexte,
          dureeFondementFr: entree.dureeFondementFr,
          citationArticle: entree.citationArticle,
        }}
        permalien={permalien}
        versionCalendrier={props.versionCalendrier}
        versionFenetres={props.versionFenetres}
        revision={entree.revision}
        bandeau={props.bandeau}
        collante
      />
    </div>
  )
}

/**
 * La marque de source, § 6.3 d et § 8.1. **Le Sitwon atteste la SOURCE, jamais la DATE.**
 * L'entrée de la rédaction, elle, porte en TEXTE « sans source textuelle » (avertissement
 * A4) : la distinction ne repose donc à aucun moment sur la couleur.
 */
function SourceMarque({ t, motif }: { t: Dictionary; motif: MotifProrogation }) {
  if (motif.autorite === 'REDACTION') {
    return <span className="mt-1 block text-xs font-medium text-ank">{t.delais.sourceNoText}</span>
  }
  // ⚠️ **Le dimanche ne porte PAS la pastille.** Il n'a aucune source à attester : il est
  // dans l'article lui-même. La condition était `autorite !== 'REDACTION'`, et le motif
  // `DIMANCHE` — fabriqué par le moteur, sans champ `autorite` — y tombait : deux Sitwon sur
  // le gabarit du § 6.3, dont le seul jour écarté est un dimanche. Le rationnement de
  // l'accent est un critère explicite de la charte (§ 8.1) : la pastille perd son sens en
  // devenant l'ordinaire. Le moteur le DIT désormais, l'écran ne le devine plus.
  if (!motif.sourceAttestee) return null
  return (
    <span className="mt-1 inline-flex items-center rounded-md bg-sitwon px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-chabon">
      {t.delais.sourceVerified}
    </span>
  )
}
