import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'
import type { CivilDate, Resultat } from '@/lib/delais'
import { dateComplete, dateEnToutesLettres, nomMois } from '@/lib/delais'
import { VERSION_REGLES_COURANTE } from '@/lib/delais/regles-lecture'
import type { MentionJour, ReportPublic } from '@/lib/delais/mention-jour'
import { DelaiFocusResultat } from './DelaiFocusResultat'

/**
 * § 6.1 / § 6.2 — **LE RÉSULTAT DES SURFACES PUBLIQUES : LA DATE, ET RIEN D'AUTRE.**
 *
 * Décision de Me Vaval, 20 août 2026 : « Le portail public doit uniquement afficher la date.
 * Pas besoin de rediriger l'utilisateur vers une autre page, ou de lui expliquer le
 * raisonnement qui a mené au résultat. Si la date calculée tombe un jour férié, le résultat
 * l'affichera en petits caractères. »
 *
 * Ce que cet écran NE rend pas, et qu'il ne doit pas se remettre à rendre : le raisonnement
 * pas à pas, les jours écartés, les lectures nommées, la « lecture la plus large », le bloc
 * « dernier jour praticable », les avertissements A1…A6, la phrase de sécurité, les textes
 * appliqués, les fenêtres de signification, le pied technique, le permalien, l'impression et
 * « Copier le raisonnement ». **Le PORTAIL les garde tous** — il calcule sur une entrée du
 * répertoire, où chacun a un fondement — et c'est `DelaiResult` qui les rend.
 *
 * ⚠️ **Ce n'est plus contradictoire avec le § 0.** « Une date juste, sans ses réserves, est
 * plus dangereuse qu'une absence de calculateur » valait quand la surface publique ouvrait des
 * lectures concurrentes : la date affichée en cachait alors d'autres. Il n'en reste qu'une, et
 * **elle est DITE** : `DEMI_JOURNEE`, le Lundi Gras, que la mention `publicDayHalfDay` nomme
 * en petits caractères à côté de la date (§ 4.10). Aucune seconde date n'est donc cachée. La
 * règle de droit, elle, reste écrite à côté des champs (`francRule`).
 *
 * ⚠️ **CETTE NOTE DISAIT « Elle n'en ouvre plus aucune » JUSQU'AU 20 AOÛT 2026 AU SOIR**, et
 * c'est exactement le raisonnement qui aurait justifié de se taire sur les 40 dates du Lundi
 * Gras : une lecture qu'on croit inexistante ne se rend pas.
 *
 * ⚠️ **LA MENTION EST DU TEXTE FIN, PAS UNE ALERTE.** Pas d'encadré, pas de couleur, pas de
 * pastille : la charte réserve le Sitwon à une SOURCE attestée (§ 8.1), et qualifier un jour
 * n'est pas attester une source.
 *
 * ⚠️ **DEUX BLOCS DE TEXTE FIN, ET ILS NE DISENT PAS LA MÊME CHOSE** (Me Vaval, 20 août 2026,
 * seconde décision du jour — « il faut la proroger au prochain jour ouvrable ») :
 *
 *   - `report` — les jours FRANCHIS et la date d'arrivée. Il n'existe que si la date a
 *     bougé, et il est là parce qu'un report muet est incompréhensible : la personne a saisi
 *     31 jours, elle compte sur ses doigts, et elle trouve un jour de moins que l'écran ;
 *   - `mentions` — ce que la date FINALE est encore, sans que cela la déplace. Depuis le
 *     report, il n'en reste que DEUX : un jour à surveiller (§ 4.13), qu'aucun texte permanent
 *     n'institue pour l'année considérée ; et le LUNDI GRAS, que le décret du 11 décembre 2024
 *     ne chôme qu'« à partir de midi » (art. 2, 1°) — la matinée y reste ouvrable, la date s'y
 *     arrête donc, et la mention dit à quelle heure la fenêtre se ferme (§ 4.10).
 */

const remplacer = (modele: string, valeurs: Record<string, string>): string =>
  Object.entries(valeurs).reduce((s, [k, v]) => s.split(`{${k}}`).join(v), modele)

/**
 * « 5 juillet 2026 » — la date SANS son jour de semaine, pour le seul gabarit du dimanche.
 *
 * ⚠️ `dateEnToutesLettres` porte le jour de semaine, et c'est voulu partout ailleurs (§ 6.3 a :
 * c'est lui qui rend visible qu'un samedi n'a pas été prorogé). Mais la phrase du dimanche le
 * NOMME déjà : « Le dimanche 5 juillet 2026 est un dimanche. » se lisait comme un bogue, dans
 * les trois langues. On retire donc le jour de semaine pour cette phrase-là, et pour elle seule.
 * Le 1er du mois s'écrit « 1er » en français, comme dans `dateEnToutesLettres`.
 */
function dateSansJourSemaine(date: CivilDate, locale: Locale): string {
  const mois = nomMois(date.m, locale)
  if (locale === 'en') return `${date.d} ${mois} ${date.y}`
  return `${date.d === 1 ? '1er' : String(date.d)} ${mois} ${date.y}`
}

/**
 * La phrase d'une mention. **Un gabarit par genre** : le calendrier porte quatre sortes de
 * lignes, et les confondre sous « jour de fête légale » ferait dire à la plateforme ce
 * qu'aucun texte ne dit (voir `mention-jour.ts`).
 *
 * ⚠️ Le gabarit du DIMANCHE reçoit la date sans jour de semaine ; les quatre autres la reçoivent
 * en toutes lettres. Voir `dateSansJourSemaine` — et `publicDaySunday`, dans `fr.ts`.
 */
export function phraseMention(
  t: Dictionary,
  mention: MentionJour,
  date: CivilDate,
  locale: Locale,
): string {
  const d = t.delais
  const modele =
    mention.genre === 'DIMANCHE'
      ? d.publicDaySunday
      : mention.genre === 'FETE_NATIONALE'
        ? d.publicDayNational
        : mention.genre === 'REDACTION'
          ? d.publicDayEditorial
          : mention.genre === 'A_SURVEILLER'
            ? d.publicDayWatch
            : // § 4.10 — la demi-journée dont la MATINÉE reste ouvrable : elle ne proroge pas,
              // et c'est la seule mention qui parle d'une heure (Me Vaval, 20 août 2026).
              mention.genre === 'DEMI_JOURNEE'
              ? d.publicDayHalfDay
              : d.publicDayHoliday
  const texteDate =
    mention.genre === 'DIMANCHE'
      ? dateSansJourSemaine(date, locale)
      : dateEnToutesLettres(date, locale)
  return remplacer(modele, { date: texteDate, nom: mention.nom })
}

/**
 * ⚠️ **QUAND UN JOUR PORTE DEUX QUALITÉS, LA SECONDE LIGNE SE RÉPÉTAIT.** Rendu réel de
 * `/fr/delais?d=2033-12-01&n=30` : « Le dimanche 1er janvier 2034 est un jour de fête nationale
 * (La Fête de l'Indépendance Nationale). » puis « Le dimanche 1er janvier 2034 est un
 * dimanche. » La date en toutes lettres de la PREMIÈRE ligne porte déjà le nom du jour : la
 * seconde ne disait plus rien.
 *
 * **Décision d'écran, pas de droit.** `mentionsJour` et `reportPublic` continuent de rendre les
 * DEUX mentions — c'est la donnée, et elle est juste ; leurs tests la gardent. C'est ici, au
 * moment d'écrire, qu'on ne rend que celle qui apporte quelque chose. Un dimanche SEUL garde
 * évidemment sa ligne : c'est le cas d'espèce de la cliente (5 juillet 2026).
 */
function sansDimancheRedondant(mentions: readonly MentionJour[]): MentionJour[] {
  if (mentions.length < 2) return [...mentions]
  const autres = mentions.filter((m) => m.genre !== 'DIMANCHE')
  return autres.length > 0 ? autres : [...mentions]
}

export function DelaiDatePublique({
  locale,
  t,
  resultat,
  mentions,
  report = null,
  lectureStricte = null,
  refaireHref,
}: {
  locale: Locale
  t: Dictionary
  resultat: Resultat
  mentions: MentionJour[]

  /**
   * ⚠️ **LE REPORT DE L'ART. 991, S'IL A EU LIEU** (Me Vaval, 20 août 2026, seconde décision
   * du jour). `null` quand la date n'a pas bougé — le cas le plus fréquent. La valeur par
   * défaut garde les appelants qui ne le passent pas encore : ils rendent la date sans la
   * ligne, jamais une ligne fausse.
   */
  report?: ReportPublic | null
  /**
   * § 0 — ⚠️ **LA DATE QUE LA LECTURE STRICTE DE L'ART. 991 AL. 3 DONNERAIT**, quand elle n'est
   * pas celle qu'on affiche. C'est la date que rend le PORTAIL du même délai, et elle est
   * toujours la plus PRÉCOCE.
   *
   * Elle est NOMMÉE, pas appliquée : la tête d'affiche reste celle que Me Vaval a demandée
   * (« au prochain jour ouvrable »). Mais une date de forclusion trop tardive fait manquer le
   * recours, et « une date juste, sans ses réserves, est plus dangereuse qu'une absence de
   * calculateur » (§ 0).
   *
   * ⚠️ **`null` PARTOUT SOUS LE CALENDRIER COURANT** — mesuré le 20 août 2026 au soir sur
   * 1 826 départs × 4 durées : les deux surfaces rendent la même date, l'écart est de ZÉRO
   * (`franc-pur.test.ts`, § 0). La ligne ne paraît plus que sous un permalien `c=1`, où la
   * version 1 du calendrier porte quatre jours sans texte instituant : 16 départs sur 1 826.
   */
  lectureStricte?: CivilDate | null
  /**
   * § 4.6 — ⚠️ **L'ADRESSE À LAQUELLE REFAIRE LE CALCUL SOUS LA RÈGLE ACTUELLE**, quand celui
   * qu'on affiche a été rendu sous une version de règles PÉRIMÉE (défaut 10 de la troisième
   * recette). `undefined` sur les surfaces qui n'ont pas d'adresse à donner — l'accueil, par
   * exemple, ne prend jamais `rl` : la ligne se rend alors sans lien.
   */
  refaireHref?: string
}) {
  const d = t.delais

  /**
   * Un REFUS n'a pas de date — la borne du § 4.3 en produit un pour tout dossier antérieur au
   * 22 juin 1989. On écrit alors le motif : une page qui se tairait laisserait croire à une
   * panne. C'est la seule phrase que cet écran rende à la place de la date.
   */
  if (resultat.statut !== 'CALCUL') {
    return (
      <div className="rounded-xl border border-liy bg-white p-5">
        <DelaiFocusResultat />
        <h2
          id="delai-resultat-titre"
          tabIndex={-1}
          className="border-l-[3px] border-wouj pl-3 font-sans text-lg font-semibold text-ank"
        >
          {resultat.statut === 'REFUS' ? d.refusalTitle : d.incompleteTitle}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ank">
          {resultat.statut === 'REFUS' ? resultat.motif : resultat.manque.join(' · ')}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-liy bg-white p-5">
      {/* § 6.5 / § 8.3 — le focus va AU RÉSULTAT, et sur téléphone la vue avec lui. Le `GET`
          d'un formulaire supprime le fragment de l'URL d'action : sans ce composant, l'accueil
          rechargé repartirait en haut de page, la date rendue hors de vue. */}
      <DelaiFocusResultat />
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-grafit">{d.resultTitle}</p>
      {/* a) LA DATE, en toutes lettres ET en chiffres, avec le jour de la semaine — le même
             gabarit que le portail (§ 6.3 a). Le jour de la semaine est obligatoire : c'est
             lui qui rend visible qu'un samedi n'a pas été prorogé. */}
      <h2 id="delai-resultat-titre" tabIndex={-1} className="mt-1 font-sans text-display-3 text-ank">
        {dateComplete(resultat.teteAffiche, locale)}
      </h2>
      {/* b) LE REPORT, quand la date a bougé — les jours franchis, puis la date d'arrivée.
             ⚠️ Il vient AVANT la mention de la date finale : c'est l'ordre du raisonnement
             (« ce jour-là était un dimanche, donc on est au lundi »), et c'est la seule
             chose qui rende le chiffre compréhensible à qui compte sur ses doigts. Même
             texte fin que les mentions : pas d'encadré, pas de couleur, pas de pastille. */}
      {report && (
        <div className="mt-3 space-y-1">
          {report.jours.map((j, i) =>
            sansDimancheRedondant(j.mentions).map((m) => (
              <p key={`report-${i}-${m.genre}-${m.cle}`} className="text-xs leading-relaxed text-grafit">
                {phraseMention(t, m, j.date, locale)}
              </p>
            )),
          )}
          <p className="text-xs leading-relaxed text-grafit">
            {remplacer(d.publicDeferred, {
              date: dateEnToutesLettres(report.arrivee, locale),
              // ⚠️ L'article vient du MOTEUR (`MotifProrogation.source`) : c'est l'art. 991
              // al. 3, ou l'art. 511 al. 2 en matière de travail. Jamais écrit ici.
              source: report.source,
            })}
          </p>
          {/* ⚠️ **LA CASCADE EST UNE LECTURE, ET L'ÉCRAN LA PRÉSENTAIT COMME LA LETTRE.**
              `publicDeferred` cite l'art. 991 al. 3, qui proroge « d'UN jour » ; sur un report
              de deux jours ou plus, la page attribuait donc à cet article un report qu'il ne
              donne pas. La phrase n'est rendue que là où la cascade a réellement joué — un seul
              jour franchi, c'est la lettre, et la ligne serait du bruit. */}
          {report.jours.length > 1 && (
            <p className="text-xs leading-relaxed text-grafit">{d.publicDeferredCascade}</p>
          )}
        </div>
      )}
      {mentions.length > 0 && (
        <div className="mt-3 space-y-1">
          {sansDimancheRedondant(mentions).map((m) => (
            <p key={`${m.genre}-${m.cle}`} className="text-xs leading-relaxed text-grafit">
              {phraseMention(t, m, resultat.teteAffiche, locale)}
            </p>
          ))}
        </div>
      )}
      {/* § 0 — **LA DATE DE L'AUTRE SURFACE, QUAND CE N'EST PAS LA MÊME.** Le portail de la
          même plateforme rendait, du même délai, une date plus PRÉCOCE ; depuis que Me Vaval a
          élargi sa tête d'affiche (20 août 2026, soir), les deux surfaces s'accordent — ZÉRO
          divergence sur 1 826 départs × 4 durées sous le calendrier courant, 16 sous celui de
          la version 1, que rejoue un permalien `c=1` (mesuré par `franc-pur.test.ts`, § 0).
          Quand elle diffère, la page la NOMME : une date juste, sans ses réserves, est plus
          dangereuse qu'une absence de calculateur. Même texte fin que le reste — c'est une
          réserve, pas une alerte, et la charte réserve le Sitwon à une source attestée
          (§ 8.1). */}
      {lectureStricte && (
        <p className="mt-3 text-xs leading-relaxed text-grafit">
          {remplacer(d.publicStrictReading, {
            date: dateEnToutesLettres(lectureStricte, locale),
          })}
        </p>
      )}
      {/* § 4.6 — ⚠️ **LA VERSION DES RÈGLES DE LECTURE, QUAND ELLE N'EST PAS CELLE DU JOUR.**
          (Défaut 10 de la troisième recette.) `regles-lecture.ts` justifie la coordonnée `rl`
          par le pied de page — « une date rendue sous une règle périmée le dit » —, mais ce
          pied (`footerRules`) n'est rendu que par `DelaiResult`, que la surface publique
          n'utilise pas. Un permalien `rl=1` affichait donc « mardi 1er janvier 2030 » là où la
          règle courante donne « jeudi 3 janvier 2030 » : DEUX jours d'écart, et pas un mot.
          La ligne ne paraît QUE sur une version périmée — sous la version courante, un calcul
          n'a rien à dire de sa règle — et elle porte le second permalien du § 6.3, celui qui
          refait le calcul sous la règle actuelle. Même texte fin que le reste : c'est une
          réserve, pas une alerte. */}
      {resultat.versionRegles !== VERSION_REGLES_COURANTE && (
        <p className="mt-3 text-xs leading-relaxed text-grafit">
          {remplacer(d.publicRulesVersion, {
            version: String(resultat.versionRegles),
            courante: String(VERSION_REGLES_COURANTE),
          })}
          {refaireHref && (
            <>
              {' '}
              <a href={refaireHref} className="underline underline-offset-2 hover:text-ank">
                {d.publicRulesVersionLink}
              </a>
            </>
          )}
        </p>
      )}
    </div>
  )
}
