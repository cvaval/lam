import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { TypeBadge, Pastille } from '@/components/TypeBadge'
import { FavoriteButton } from '@/components/DocActions'
import { dictFor } from '@/lib/i18n/server'
import { formatDate } from '@/lib/i18n/format'
import { requireUser } from '@/lib/auth/guard'
import { prisma } from '@/lib/db'
import { can } from '@/lib/rbac'
import { canReadService, canSeeSourcePdf } from '@/lib/access'
import { isBlobUrl } from '@/lib/storage/blob'
import { guard, LIMITS } from '@/lib/security/ratelimit'
import { RateLimitNotice } from '@/components/RateLimitNotice'
import { StatusChip } from '@/components/StatusChip'
import { JurisprudenceHeader } from '@/components/JurisprudenceHeader'
import { ANCRE_TEXTE, JurisprudenceSommaire } from '@/components/JurisprudenceSommaire'
import { JurisprudenceComposition } from '@/components/JurisprudenceComposition'
import { DocumentNotes, type NoteAffichee } from '@/components/DocumentNotes'
import { signature, peutEtreAnonyme } from '@/lib/notes/rules'
import { BackLink } from '@/components/BackLink'
import { OfficialText, type ArticleMark } from '@/components/OfficialText'
import { splitKeywords } from '@/lib/ai/keywords'
import { parseCirculaireRef } from '@/lib/brh/gaps'
import type { CircRef } from '@/lib/doc/crossref'
import { parseRichBlocks, buildBodySegments, tableShortCaption, type RichTable } from '@/lib/doc/richblocks'
import { CodeThemeBrowser, type ThemeArticle } from '@/components/CodeThemeBrowser'
import { expandQuery } from '@/lib/search/synonyms'
import { parseEditionHeader } from '@/lib/doc/edition-meta'
import { pickLocale } from '@/lib/i18n/pick'
import { DOC_TYPE_META } from '@/lib/brand'
import type { DocType, DocStatus, Locale } from '@/lib/types'
import { outgoingRefs, backlinks } from '@/lib/legislation/refs'
import { getAmendments } from '@/lib/legislation/amendments'
import { applyAmendments } from '@/lib/legislation/segment'
import { CiteButton } from '@/components/CiteButton'
import { PrintButton } from '@/components/PrintButton'
import { labelFromAnchor } from '@/lib/legislation/articles'
import { AmendmentHistory, type AmendItem } from '@/components/AmendmentHistory'
import { parseAnnotations } from '@/lib/legislation/annotated'
import { AnnotatedText } from '@/components/AnnotatedText'
import { CodeSidebar } from '@/components/CodeSidebar'
import type { CodeHrefs } from '@/components/CodeRefText'

// Sources du lecteur annoté (listes devenues illisibles en conditions inline) :
// index inline masqué (le panneau latéral l'affiche) et renvois « article N »
// cliquables (anti-lien-mort côté composant). Les CC_VANDAL_* s'y ajoutent via
// le préfixe testé plus bas.
const HIDE_INLINE_INDEX_SOURCES = new Set([
  'CONSTITUTION_1987', 'CODE_CIVIL_ANNOTE', 'CODE_DOUANES_ANNOTE', 'DECRET_REGIMES_MATRIMONIAUX',
  'LOI_FILIATION_2014', 'DECRET_SURETES', 'LOI_STATUT_COMMERCANT_2018', 'LOI_BANQUES_2012',
  'DECRET_MINIER_2026', 'DECRET_IMPOT_REVENU_2005', 'DECRET_TIMBRE_1978_CONSOLIDE', 'LOI_PATENTE_1996_CONSOLIDE',
  'LOI_CFGDCT_1996_CONSOLIDE', 'DECRET_CFPB_1979_CONSOLIDE', 'DECRET_ENREGISTREMENT_1977',
  'DECRET_IMF_2020', 'DECRET_BAIL_PRO_2020', 'LOI_UCREF_2017',
  // Notariat : décret-loi de 1969 et les textes de 1862 à 1986 qui le précèdent ou le modifient.
  'DECRET_LOI_NOTARIAT_1969', 'LOI_NOTARIAT_1862', 'LOI_NOTARIAT_1877', 'LOI_NOTARIAT_1919',
  'ARRETE_NOTARIAT_EXAMEN_1919', 'DECRET_LOI_NOTARIAT_1941', 'DECRET_NOTARIAT_1974', 'DECRET_NOTARIAT_1986',
  // Électronique : signature, échanges et administration (2015 → 2025).
  'LOI_SIGNATURE_ELECTRONIQUE_2017', 'DECRET_SIGNATURE_ELECTRONIQUE_2025',
  'LOI_ECHANGES_ELECTRONIQUES_2017', 'DECRET_ADMINISTRATION_ELECTRONIQUE_2016',
  'DECRET_SIGNATURE_ELECTRONIQUE_2015',
  // Circulaires BRH au lecteur annoté : divisions numérotées « N.- » (pointAnchors).
  // 'AVIS_LD_AGENTS_CHANGE_2020' : Avis + Lignes directrices aux agents de change (14 déc. 2020),
  // seul texte de la série sans numéro — même appareil (sommaire, index latéral, renvois).
  'CIRC_BRH_105_2', 'CIRC_BRH_117_1', 'CIRC_BRH_127', 'AVIS_LD_AGENTS_CHANGE_2020',
  // Code de procédure civile : renvois internes « article N » (anti-lien-mort).
  'CODE_PROCEDURE_CIVILE',
  // Jeux de hasard et d'argent — sept textes de 1958 à 2026. Le corpus se lit d'un bloc :
  // la loi organique de 1958 et le décret des casinos de 1960 portent leurs amendements et
  // leurs abrogations en pliable, les trois décrets de 2026 renvoient à ce qu'ils remplacent.
  'LOI_LOTERIE_LEH_1958', 'LOI_LOTERIE_LEH_REFORME_1958', 'DECRET_CASINOS_1960',
  'ARRETE_LEH_PERSONNEL_1960', 'DECRET_ANJHA_2026', 'DECRET_JEUX_HASARD_2026',
  'DECRET_JEUX_IMPOSITION_2026',
  // Administration Centrale de l'État — le décret de 2005 et son amendement de 2016. Trois
  // conventions de numérotation dans le seul texte de 2005 : entière, décimale, et cinq
  // articles À TIRET (163-1 à 163-3, 169-1, 169-2).
  'DECRET_ADMIN_CENTRALE_2005', 'DECRET_ADMIN_CENTRALE_AMEND_2016',
])
const ART_REFS_SOURCES = new Set([
  // Le Code civil renvoie en toutes lettres à ses propres articles (« conformément à
  // l'article 170 », « dans les cas des articles 180 et 181 ») : ces renvois restaient
  // du texte mort. L'anti-lien-mort du composant ne relie qu'un article RÉEL.
  'CODE_CIVIL_ANNOTE',
  'CODE_PENAL_ANNOTE', 'CODE_DOUANES_ANNOTE', 'DECRET_REGIMES_MATRIMONIAUX', 'LOI_FILIATION_2014',
  'DECRET_SURETES', 'CODE_COMMERCE_ANNOTE', 'LOI_STATUT_COMMERCANT_2018', 'LOI_BANQUES_2012',
  'DECRET_MINIER_2026', 'DECRET_IMPOT_REVENU_2005', 'DECRET_TIMBRE_1978_CONSOLIDE', 'LOI_PATENTE_1996_CONSOLIDE',
  'LOI_CFGDCT_1996_CONSOLIDE', 'DECRET_CFPB_1979_CONSOLIDE', 'DECRET_ENREGISTREMENT_1977',
  'DECRET_IMF_2020', 'DECRET_BAIL_PRO_2020', 'LOI_UCREF_2017',
  'DECRET_LOI_NOTARIAT_1969', 'LOI_NOTARIAT_1862', 'LOI_NOTARIAT_1877', 'LOI_NOTARIAT_1919',
  'ARRETE_NOTARIAT_EXAMEN_1919', 'DECRET_LOI_NOTARIAT_1941', 'DECRET_NOTARIAT_1974', 'DECRET_NOTARIAT_1986',
  // Électronique : signature, échanges et administration (2015 → 2025).
  'LOI_SIGNATURE_ELECTRONIQUE_2017', 'DECRET_SIGNATURE_ELECTRONIQUE_2025',
  'LOI_ECHANGES_ELECTRONIQUES_2017', 'DECRET_ADMINISTRATION_ELECTRONIQUE_2016',
  'DECRET_SIGNATURE_ELECTRONIQUE_2015',
  // Circulaires BRH au lecteur annoté : divisions numérotées « N.- » (pointAnchors).
  // 'AVIS_LD_AGENTS_CHANGE_2020' : Avis + Lignes directrices aux agents de change (14 déc. 2020),
  // seul texte de la série sans numéro — même appareil (sommaire, index latéral, renvois).
  'CIRC_BRH_105_2', 'CIRC_BRH_117_1', 'CIRC_BRH_127', 'AVIS_LD_AGENTS_CHANGE_2020',
  // Code de procédure civile : renvois internes « article N » (anti-lien-mort).
  'CODE_PROCEDURE_CIVILE',
  // Jeux de hasard et d'argent — sept textes de 1958 à 2026. Le corpus se lit d'un bloc :
  // la loi organique de 1958 et le décret des casinos de 1960 portent leurs amendements et
  // leurs abrogations en pliable, les trois décrets de 2026 renvoient à ce qu'ils remplacent.
  'LOI_LOTERIE_LEH_1958', 'LOI_LOTERIE_LEH_REFORME_1958', 'DECRET_CASINOS_1960',
  'ARRETE_LEH_PERSONNEL_1960', 'DECRET_ANJHA_2026', 'DECRET_JEUX_HASARD_2026',
  'DECRET_JEUX_IMPOSITION_2026',
  // Administration Centrale de l'État — le décret de 2005 et son amendement de 2016. Trois
  // conventions de numérotation dans le seul texte de 2005 : entière, décimale, et cinq
  // articles À TIRET (163-1 à 163-3, 169-1, 169-2).
  'DECRET_ADMIN_CENTRALE_2005', 'DECRET_ADMIN_CENTRALE_AMEND_2016',
])
/** Pliable intitulé « Annotations » plutôt que « Jurisprudence » : le bloc ne porte pas que
 *  des arrêts. Code civil et Code de commerce y joignent les commentaires de l'auteur ; le
 *  Code de procédure civile, l'ancienne numérotation de ses articles et 478 notes
 *  doctrinales sans arrêt à citer. */
const ANNOTATIONS_VARIANT_SOURCES = new Set([
  'CODE_CIVIL_ANNOTE', 'CODE_COMMERCE_ANNOTE', 'CODE_PROCEDURE_CIVILE',
  // Circulaire n° 127 et Avis/Lignes directrices aux agents de change : leurs seules
  // annotations sont ÉDITORIALES (provenance du texte, articulation entre les deux
  // régimes d'agrément). Sans cette entrée, elles seraient publiées sous le titre
  // « Jurisprudence » — sur des textes qui n'en ont aucune.
  'CIRC_BRH_127', 'AVIS_LD_AGENTS_CHANGE_2020',
])

export default async function DocPage({
  params,
  searchParams,
}: {
  params: { locale: string; id: string }
  searchParams: { q?: string | string[] }
}) {
  const { locale, t } = dictFor(params.locale)
  const user = await requireUser(locale)

  // Anti-scraping : plafond de consultations de documents par minute (§09).
  if (!(await guard({ action: 'doc', subject: user.id, ...LIMITS.doc }, { actorId: user.id }))) {
    return <RateLimitNotice t={t} />
  }

  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    // ⚠️ `searchText` est EXCLU : sur le Code civil il pèse 1,3 Mo, et la page n'en lit que
    // la LONGUEUR (cf. `texteCherchable` plus bas), désormais obtenue par un count SQL.
    // Le rapatrier doublait presque le poids de la requête pour un seul entier.
    omit: { searchText: true },
    include: {
      versions: { orderBy: { effectiveDate: 'desc' } },
      citationsFrom: { include: { to: true } },
      citationsTo: { include: { from: true } },
      // La formation de jugement, dans l'ordre du recueil : présidence, juges, ministère
      // public, greffe. `position` porte cet ordre — un tri par nom le détruirait.
      judges: { orderBy: { position: 'asc' } },
    },
  })
  if (!doc) notFound()

  const type = doc.type as DocType
  const isIndex = type === 'INDEX'
  // Accès par service (§03) : un type non accordé est invisible → redirection vers l'Index.
  // L'Index reste toujours accessible ; un service accordé donne la lecture intégrale.
  if (!canReadService(user, type)) redirect(`/${locale}/search?type=index`)

  const meta = DOC_TYPE_META[type]
  // Renvoi vers la section d'édition — la rédaction seule le voit.
  const peutEditer = user.role === 'MASTER_ADMIN' || user.role === 'EDITEUR'

  // Notes des lecteurs. ⚠️ LA REQUÊTE EST LE FILTRE DE PUBLICATION : on ne charge que les
  // notes VALIDÉES, plus celles de l'utilisateur courant (qui doit voir où en est la
  // sienne). Filtrer côté composant enverrait au navigateur des notes non validées.
  const notesBrutes =
    type === 'JURISPRUDENCE'
      ? await prisma.documentNote.findMany({
          where: { documentId: doc.id, OR: [{ status: 'PUBLIEE' }, { authorId: user.id }] },
          orderBy: { createdAt: 'desc' },
          take: 100,
          select: {
            id: true, body: true, anonymous: true, status: true, createdAt: true,
            moderationNote: true, authorId: true,
            author: { select: { name: true, email: true } },
          },
        })
      : []
  const notes: NoteAffichee[] = notesBrutes.map((n) => ({
    id: n.id,
    body: n.body,
    // ⚠️ L'anonymat est appliqué ICI, à la sérialisation : le nom de l'auteur ne doit pas
    // seulement être masqué à l'écran, il ne doit pas quitter le serveur.
    signature: signature(n),
    createdAt: n.createdAt.toISOString(),
    status: n.status,
    moderationNote: n.moderationNote,
    sienne: n.authorId === user.id,
  }))
  const fav = await prisma.favorite.findUnique({
    where: { userId_documentId: { userId: user.id, documentId: doc.id } },
  })

  // Renvoi d'abrogation : le texte qui abroge celui-ci, résolu par NUMÉRO (robuste au
  // ré-import qui change les id) → note + lien sur la fiche (statut ABROGE).
  const abrogatedBy =
    doc.status === 'ABROGE' && doc.abrogatedByNumber
      ? await prisma.document
          .findMany({
            where: { type: 'CIRCULAIRE_BRH', number: doc.abrogatedByNumber },
            select: { id: true, number: true, titleFr: true, publicationDate: true },
            orderBy: { publicationDate: 'asc' },
          })
          // Trois documents portent « Circulaire n° 88-1 » : le texte et ses deux notes
          // additionnelles. Un findFirst sans tri renvoyait la note — le lecteur atterrissait
          // sur un complément au lieu du texte qui abroge. On écarte les notes d'abord.
          .then((rows) => rows.find((r) => !/note\s+additionnelle/i.test(r.titleFr)) ?? rows[0] ?? null)
      : null

  const summary = pickLocale(doc.summaryFr, doc.summaryEn, doc.summaryHt, locale)
  const means = pickLocale(doc.meansFr, doc.meansEn, doc.meansHt, locale)
  const title = pickLocale(doc.titleFr, doc.titleEn, doc.titleHt, locale) || doc.titleFr

  // bodyClean : version corrigée (OCR + orthographe) par l'IA — affichée si disponible,
  // bodyOriginal sinon. L'original reste intact en base (§02). L'accès étant accordé par
  // service (sinon redirection ci-dessus), le texte est toujours affiché en intégralité.
  const body = doc.bodyClean ?? doc.bodyOriginal

  // Texte annoté (Code du travail, Constitution, Code civil…) : table des matières,
  // jurisprudence et index, stockés hors du texte officiel (annotationsJson).
  const annotations = parseAnnotations(doc.annotationsJson)

  // Amendements au niveau article (overlay §02) : le texte affiché montre par défaut la
  // version EN VIGUEUR de chaque article amendé ; l'historique (anciennes versions) reste
  // lisible plus bas (AmendmentHistory). Aucune ligne d'overlay = texte original inchangé.
  // Textes annotés : les libellés du sommaire BORNENT les segments d'article, sinon le
  // remplacement du dernier article d'un chapitre engloutirait l'en-tête suivant.
  const amendments = await getAmendments(doc.id)
  const normHead = (s: string) => s.replace(/\s+/g, ' ').trim()
  const tocLabels = annotations ? new Set(annotations.toc.map((e) => normHead(e.label))) : null
  const effectiveBody = applyAmendments(body, amendments, tocLabels ? (line) => tocLabels.has(normHead(line)) : undefined)
  // ── LES TROIS PASTILLES D'ÉTAT ────────────────────────────────────────────────────────
  //
  // ⚠️ UN ARTICLE SEULEMENT AJOUTÉ N'EST PAS UN ARTICLE AMENDÉ. Il n'a pas d'ancienne
  // version — il n'existait pas : ni marqueur de modification, ni ligne dans l'historique.
  //
  // ⚠️ ET UN ARTICLE ABROGÉ N'EST PAS UN ARTICLE MODIFIÉ. Le marqueur unique d'hier posait
  // « ✎ modifié » sur « Article 110.- [Abrogé] » — il contredisait la ligne qu'il suivait.
  const marques = [...amendments.values()].filter((ov) => ov.added || ov.amended)
  // Le titre COMPLET de l'acte : deux textes peuvent partager une date (deux décrets ont été
  // signés le 6 janvier 2016). La pastille n'en montre que la désignation courte ; le titre
  // entier est dans l'infobulle, et la destination lève l'ambiguïté pour de bon.
  const actes = marques.length
    ? await prisma.document.findMany({
        where: {
          id: {
            in: [
              ...new Set(
                marques
                  .map((ov) => (ov.added ?? ov.inForce ?? ov.history.find((v) => v.status === 'ABROGE'))?.amendedByDocId)
                  .filter(Boolean) as string[],
              ),
            ],
          },
        },
        select: { id: true, titleFr: true },
      })
    : []
  const parActe = new Map(actes.map((a) => [a.id, a]))
  // « Décret du 11 août 2026 portant règlementation… (Le Moniteur…) » → « Décret du 11 août
  // 2026 ». La désignation longue reste dans le corps et dans l'infobulle.
  const ACTE_COURT = /^((?:Décret-Loi|Décret|Loi|Arrêté|Avis)(?:\s+N[o°º][^\s,]*)?\s+du\s+\d{1,2}(?:er)?\s+\p{L}+\s+\d{4})/u
  const court = (v: { amendedByNumber: string | null }, acte?: { titleFr: string }) => {
    const t = v.amendedByNumber || acte?.titleFr || ''
    // ⚠️ TOUS LES ACTES NE SE NOMMENT PAS PAR LEUR DATE. « Décret réformant le Droit des
    // Sûretés (Le Moniteur, Spécial n° 7 du 14 mai 2020) » ne commence pas par « Décret du » :
    // sans ce second recours, la pastille affichait « Décret réformant le Droit des Sû… ».
    // On retire alors la référence au Moniteur, qui est entre parenthèses à la fin.
    const sansRef = t.replace(/\s*\((?:Le Moniteur|Moniteur)[^)]*\)\s*$/, '').trim()
    return ACTE_COURT.exec(t)?.[1] ?? (sansRef.length > 52 ? `${sansRef.slice(0, 50)}…` : sansRef)
  }
  const LBL = {
    ajout: { fr: 'Ajout', en: 'Added', ht: 'Ajoute' },
    modifie: { fr: 'Modifié', en: 'Amended', ht: 'Modifye' },
    abroge: { fr: 'Texte abrogé', en: 'Repealed text', ht: 'Tèks abwoje' },
    parAjout: { fr: 'Article ajouté par', en: 'Article added by', ht: 'Atik ajoute pa' },
    parModif: { fr: "Article amendé par", en: 'Article amended by', ht: 'Atik modifye pa' },
    parAbrog: { fr: 'Article abrogé par', en: 'Article repealed by', ht: 'Atik abwoje pa' },
    voirAnc: { fr: "voir l’ancienne rédaction", en: 'see the previous wording', ht: 'wè ansyen vèsyon an' },
    voirAbr: { fr: 'voir le texte abrogé', en: 'see the repealed text', ht: 'wè tèks ki abwoje a' },
  } as const
  const articleMarks: Map<string, ArticleMark> | undefined = marques.length
    ? new Map(
        marques.map((ov): [string, ArticleMark] => {
          const abr = ov.history.find((v) => v.status === 'ABROGE')
          const v = ov.added ?? (ov.abrogated ? abr : ov.inForce) ?? null
          const acte = v?.amendedByDocId ? parActe.get(v.amendedByDocId) : undefined
          const nom = v?.amendedByNumber || acte?.titleFr || ''
          if (ov.added) {
            return [
              ov.anchor,
              {
                kind: 'ajout' as const,
                label: `${LBL.ajout[locale]} — ${court(v!, acte)}`,
                title: v!.note ?? `${LBL.parAjout[locale]} : ${nom}`,
                // Un ajout renvoie à l'ACTE ; à défaut de fiche, à l'historique.
                href: acte ? `/${locale}/doc/${acte.id}` : `#hist-${ov.anchor}`,
              },
            ]
          }
          const abroge = ov.abrogated
          return [
            ov.anchor,
            {
              kind: abroge ? ('abroge' as const) : ('modifie' as const),
              label: abroge ? LBL.abroge[locale] : LBL.modifie[locale],
              title: `${abroge ? LBL.parAbrog[locale] : LBL.parModif[locale]} : ${nom || '—'} — ${
                abroge ? LBL.voirAbr[locale] : LBL.voirAnc[locale]
              }`,
              href: `#hist-${ov.anchor}`,
            },
          ]
        }),
      )
    : undefined
  const amendItems: AmendItem[] = [...amendments.values()].filter((ov) => ov.amended).map((ov) => {
    const ab = ov.history.find((v) => v.status === 'ABROGE')
    const statusLine = ov.abrogated
      ? `Abrogé${ab?.effectiveDate ? ' le ' + formatDate(locale, ab.effectiveDate) : ''}${ab?.amendedByNumber ? ' — ' + ab.amendedByNumber : ''}`
      : `En vigueur${ov.inForce?.effectiveDate ? ' depuis le ' + formatDate(locale, ov.inForce.effectiveDate) : ''}${ov.inForce?.amendedByNumber ? ' (' + ov.inForce.amendedByNumber + ')' : ''}`
    return {
      anchor: ov.anchor,
      label: ov.label ?? labelFromAnchor(ov.anchor),
      abrogated: ov.abrogated,
      statusLine,
      history: ov.history.map((v) => ({
        heading: `${v.status === 'ABROGE' ? 'Version abrogée' : 'Ancienne version'}${v.effectiveDate ? ' — ' + formatDate(locale, v.effectiveDate) : ''}${v.amendedByNumber ? ' (' + v.amendedByNumber + ')' : ''}`,
        body: v.body,
      })),
    }
  })

  // Tableaux & encadrés colorés (reproduction du rendu visuel du PDF).
  const richBlocks = parseRichBlocks(doc.richBlocksJson)
  // Le Code civil renvoie 348 fois au Code de procédure civile (« C. p. c. 956 »), dans
  // son corps comme dans ses annotations. On résout la CIBLE ici — une requête d'un seul
  // champ, et uniquement pour ce document : le rendu, lui, reste pur (§02, le texte
  // officiel n'est pas retouché ; seuls des liens s'ajoutent à l'affichage).
  const codeHrefs: CodeHrefs = {}
  // Quels codes ce document cite-t-il ? Le Code civil cite les trois autres ; le Code de
  // procédure civile et son appendice citent le Code d'instruction criminelle (« C.I.C. »).
  // Mesuré sur le corpus : le Code pénal, lui, n'en cite aucun.
  const CITE: Record<string, readonly string[]> = {
    CODE_CIVIL_ANNOTE: ['CODE_PROCEDURE_CIVILE', 'CODE_PENAL_ANNOTE', 'CODE_INSTRUCTION_CRIMINELLE'],
    CODE_PROCEDURE_CIVILE: ['CODE_INSTRUCTION_CRIMINELLE'],
    CODE_INSTRUCTION_CRIMINELLE: ['CODE_PROCEDURE_CIVILE', 'CODE_PENAL_ANNOTE', 'CODE_CIVIL_ANNOTE'],
  }
  const PAR_SOURCE: Record<string, 'cpc' | 'cp' | 'cic' | 'civ'> = {
    CODE_PROCEDURE_CIVILE: 'cpc',
    CODE_PENAL_ANNOTE: 'cp',
    CODE_INSTRUCTION_CRIMINELLE: 'cic',
  }
  const aResoudre = CITE[doc.source ?? ''] ?? (doc.source?.startsWith('CPC_APPENDICE_') ? ['CODE_INSTRUCTION_CRIMINELLE'] : [])
  if (aResoudre.length) {
    const cites = await prisma.document.findMany({
      where: { source: { in: [...aResoudre] }, type: 'LEGISLATION' },
      select: { id: true, source: true },
    })
    for (const c of cites) {
      const cle = PAR_SOURCE[c.source ?? '']
      if (cle && cle !== 'civ') codeHrefs[cle] = `/${locale}/doc/${c.id}`
    }
  }
  // Index thématique IA (codes/lois longs) — alimente le navigateur par thème + renvois.
  let themeIndex: ThemeArticle[] = []
  try { if (doc.themeIndexJson) themeIndex = JSON.parse(doc.themeIndexJson) as ThemeArticle[] } catch { themeIndex = [] }
  // Annexes téléchargeables (Word/Excel) : circulaires dont les annexes sont des
  // tableaux/formulaires reconstruits. Réservé aux paliers exportateurs (§09).
  const annexCount = richBlocks.filter((b) => b.type === 'table').length

  // Édition scannée du Moniteur : le contenu EST le PDF (le « corps » n'est qu'un libellé de
  // fascicule) → on propose une consultation directe du PDF au lieu d'un texte officiel vide.
  const isScannedEdition = (doc.source ?? '').startsWith('MONITEUR_PDF_') && isBlobUrl(doc.sourcePdfUrl)
  /**
   * ⚠️ « PAS ENCORE OCÉRISÉ » EST FAUX POUR LE FONDS ANCIEN. Les 1 057 fascicules de
   * 1987-2000 portent leur couche texte — 46,8 M de caractères indexés — et la recherche
   * les trouve. La phrase, écrite pour les années 2016-2026 qui n'avaient rien, disait à
   * 1 185 lecteurs sur 2 742 le contraire de ce que la plateforme sait faire : on cherche
   * « Namphy », on tombe sur le fascicule, et la fiche affirme qu'il n'est pas océrisé.
   *
   * Le texte reste NON AFFICHÉ, et c'est un choix : un OCR de microfilm sert à TROUVER,
   * pas à CITER — le fac-similé fait foi. Le seuil est celui du catalogage, 200 c./page.
   */
  const pagesFascicule = (() => {
    try {
      return Number(JSON.parse(String(doc.metaJson))?.pages) || 1
    } catch {
      return 1
    }
  })()
  // La longueur du texte cherchable, sans rapatrier le texte : PostgreSQL la calcule et ne
  // renvoie qu'un entier. Sur le Code civil, 1,3 Mo économisés à chaque affichage de fiche.
  const [{ n: longueurCherchable }] = await prisma.$queryRaw<{ n: number }[]>`
    SELECT coalesce(length("searchText"), 0)::int AS n FROM "Document" WHERE id = ${params.id}`
  /**
   * COMPORTEMENT DU LECTEUR — DÉDUIT DU DOCUMENT, non d'une liste de sources.
   *
   * ⚠️ Ces trois réglages étaient portés par des listes blanches de `doc.source` tenues à la
   * main dans ce fichier. Conséquence mesurée à l'audit du 16 août 2026 : 123 des 251 documents
   * annotés du fonds n'y figuraient pas et perdaient donc leur index latéral, leurs renvois
   * cliquables ou le bon intitulé de leur pliable — sans que rien ne le signale. Et chaque
   * nouveau code de loi imposait d'éditer un composant d'affichage pour être lu correctement.
   *
   * Les trois conditions se lisent en réalité dans l'appareil du document lui-même :
   *   · l'index inline fait DOUBLON dès que la barre latérale en affiche un ;
   *   · les renvois « article N » ont un sens dès qu'il existe des ancres d'article ;
   *   · le pliable s'intitule « Annotations » quand son contenu est éditorial, et
   *     « Jurisprudence » quand ce sont des décisions.
   *
   * Les listes demeurent, mais comme DÉROGATION : elles ne servent plus qu'aux cas où la
   * déduction se trompe. Aucune n'est requise pour qu'un texte neuf soit bien rendu.
   */
  const lecture = {
    hideInlineIndex:
      (annotations?.indexEntries.length ?? 0) > 0 || HIDE_INLINE_INDEX_SOURCES.has(doc.source ?? ''),
    linkArtRefs:
      Boolean(annotations) || ART_REFS_SOURCES.has(doc.source ?? '') || (doc.source ?? '').startsWith('CC_VANDAL_'),
    annotationsVariant: (
      // Des commentaires sans une seule décision : c'est un appareil éditorial, pas de la
      // jurisprudence. Intituler un tel pliable « Jurisprudence » ment au lecteur — un juriste
      // qui l'ouvre y cherche des arrêts.
      Object.keys(annotations?.commentaires ?? {}).length > 0 &&
      Object.keys(annotations?.jurisprudence ?? {}).length === 0
        ? 'annotations'
        : ANNOTATIONS_VARIANT_SOURCES.has(doc.source ?? '')
          ? 'annotations'
          : 'juris'
    ) as 'annotations' | 'juris',
  }

  const texteCherchable = longueurCherchable >= 200 * pagesFascicule
  /**
   * La transcription AFFICHABLE d'un fascicule scanné : le corps privé de son en-tête de
   * provenance (« [Fascicule scanné … Fichier : …] »), que `verser-texte-moniteur-dans-corps`
   * conserve parce que trois scripts s'en servent pour retrouver le PDF.
   *
   * ⚠️ ELLE NE PEUT PAS VENIR DE `searchText` : celui-ci passe par `fold()` — minuscules,
   * accents retirés — et rendrait « journal officiel de la republique ». Le texte lisible
   * est relu du PDF et versé dans `bodyOriginal`.
   */
  const transcription = isScannedEdition
    ? (doc.bodyOriginal ?? '').replace(/^\[.*?\]/s, '').trim() || null
    : null
  const canViewPdf = type === 'CIRCULAIRE_BRH' || canSeeSourcePdf(user)
  // Citation juridique copiable : désignation + référence Moniteur / numéro + date.
  const citation =
    `${title}${doc.moniteurRef ? ` — ${doc.moniteurRef}` : doc.number ? ` (${doc.number})` : ''}` +
    `${doc.publicationDate ? `, ${formatDate(locale, doc.publicationDate)}` : ''}`

  // Sommaire des tableaux : numérotation par ordre d'AFFICHAGE (même source que
  // OfficialText → buildBodySegments), pour des ancres #tableau-N cohérentes.
  const tableEntries = buildBodySegments(effectiveBody, richBlocks)
    .filter((s) => s.kind === 'rich' && s.block.type === 'table')
    .map((s, i) => ({ num: i + 1, cap: tableShortCaption((s as { block: RichTable }).block), orphan: Boolean((s as { orphan?: boolean }).orphan) }))
  const tl = (o: { fr: string; en: string; ht: string }) => o[locale as 'fr' | 'en' | 'ht'] ?? o.fr
  const TLBL = {
    heading: tl({ fr: 'Tableaux du document', en: 'Document tables', ht: 'Tablo dokiman an' }),
    table: tl({ fr: 'Tableau', en: 'Table', ht: 'Tablo' }),
    orphan: tl({ fr: 'emplacement approximatif', en: 'approximate position', ht: 'kote apwoksimatif' }),
  }

  // Renvois croisés (CrossRef) résolus + rétroliens — affichés sur la fiche, access-aware (§03).
  const [outRefs, inRefs] = await Promise.all([
    outgoingRefs(doc.id, user),
    backlinks({ id: doc.id, type: doc.type, number: doc.number }, user),
  ])

  // Termes recherchés à surligner dans le texte et les tableaux (depuis ?q= au clic
  // d'un résultat de recherche) — mêmes termes étendus que le moteur (synonymes).
  // ?q peut arriver en tableau (lien forgé « ?q=a&q=b ») : normaliser avant .trim/.slice.
  const rawQ = Array.isArray(searchParams?.q) ? searchParams.q[0] : searchParams?.q
  const hlTerms = rawQ?.trim() ? expandQuery(rawQ.slice(0, 200)) : undefined

  // Liens croisés entre circulaires BRH : index numéro → fiche du corpus.
  // « article N de la présente circulaire » → ancre #art-N de la fiche courante.
  let hrefFor: ((ref: CircRef) => string | null) | undefined
  if (type === 'CIRCULAIRE_BRH') {
    const refDocs = await prisma.document.findMany({
      where: { type: 'CIRCULAIRE_BRH' },
      select: { id: true, number: true },
    })
    const refIndex: Record<string, string> = {}
    for (const r of refDocs) {
      const p = parseCirculaireRef(r.number)
      if (p) refIndex[`${p.serie}|${p.base}|${p.rev ?? 0}`] = r.id
    }
    hrefFor = (ref) => {
      const targetId = ref.present ? doc.id : refIndex[`${ref.serie}|${ref.base}|${ref.rev ?? 0}`]
      if (!targetId) return null
      return `/${locale}/doc/${targetId}${ref.article ? `#art-${ref.article}` : ''}`
    }
  }

  const editionHeader = parseEditionHeader(doc.metaJson)

  return (
    <article className={`mx-auto space-y-6 ${annotations ? 'max-w-6xl' : 'max-w-3xl'}`}>
      <BackLink fallback={`/${locale}/search?type=${meta.slug}`} label={meta.label[locale]} />

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={type} />
          {doc.number && <span className="text-sm font-medium text-ank/80">{doc.number}</span>}
          {doc.status && <StatusChip status={doc.status} label={t.statuses[doc.status as DocStatus]} />}
          {doc.sealed && (
            <span className="inline-flex items-center gap-1 rounded-full bg-wouj px-2.5 py-0.5 text-[11px] font-semibold text-white">
              <span aria-hidden>✓</span> {t.doc.verified}
            </span>
          )}
        </div>
        <h1 className="font-serif text-3xl font-semibold leading-tight text-ank">{title}</h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ank/80">
          {doc.moniteurRef && (
            // ⚠️ Pour une DÉCISION, `moniteurRef` porte la référence de l'arrêt
            // (juridiction · n° · année), pas une citation du Moniteur : la préfixer de
            // « Publié au » donnerait « Publié au Cour de Cassation… ».
            <span>
              {type === 'JURISPRUDENCE' ? doc.moniteurRef : `${t.doc.moniteur} ${doc.moniteurRef}`}
            </span>
          )}
          {/* ⚠️ TROIS DATES, TROIS SENS. Un décret « donné au Palais National » le 25 novembre
              n'est publié au Moniteur que le 30, et n'entre parfois en vigueur que plus tard
              encore. Tant qu'une seule date était affichée sans étiquette, le lecteur ne
              savait pas laquelle il lisait. L'étiquette n'apparaît que lorsqu'il y a de quoi
              confondre — une date seule reste nue, comme avant. */}
          {doc.adoptionDate && (
            <span>
              {t.doc.adopted} {formatDate(locale, doc.adoptionDate)}
            </span>
          )}
          {doc.publicationDate && (
            <span>
              {doc.adoptionDate ? `${t.doc.published} ` : ''}
              {formatDate(locale, doc.publicationDate)}
            </span>
          )}
          {doc.effectiveDate && (
            <span>
              {t.brh.effDate} : {formatDate(locale, doc.effectiveDate)}
            </span>
          )}
          {doc.holder && <span>{doc.holder}</span>}
          {doc.niceClasses && <span>Nice {doc.niceClasses}</span>}
          {doc.bhdaNumber && <span>BHDA {doc.bhdaNumber}</span>}
          {/* En-tête du fascicule (numéro Moniteur) capturé au téléversement */}
          {editionHeader?.anneeParution != null && (
            <span>
              {editionHeader.anneeParution}
              <sup>e</sup> {t.doc.anneeLabel}
            </span>
          )}
          {editionHeader?.directeurGeneral && (
            <span>
              {t.doc.dgLabel} : {editionHeader.directeurGeneral}
            </span>
          )}
          {doc.recueilRef && <span>{doc.recueilRef}</span>}
          {editionHeader?.issn && <span>ISSN {editionHeader.issn}</span>}
        </div>
        {/* Décision judiciaire : qualifications éditoriales (traitement, portée, note). */}
        <JurisprudenceHeader doc={doc} locale={locale} />
        {/* Sommaire analytique — AVANT le texte de l'arrêt. Le résumé éditorial y est une
            rubrique : son bloc générique plus bas est donc tu pour les décisions. */}
        {type === 'JURISPRUDENCE' && <JurisprudenceSommaire doc={doc} resume={summary} locale={locale} />}
        {/* La composition suit le sommaire : qui a jugé, après ce qui a été jugé. */}
        {type === 'JURISPRUDENCE' && (
          <JurisprudenceComposition membres={doc.judges} note={doc.compositionNote} locale={locale} />
        )}
        {/* Mots-clés thématiques — cliquables vers la recherche. Ils suivent le sommaire :
            placés avant, ils s'intercaleraient entre les rubriques et le texte résumé. */}
        {doc.keywords && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ank/80">{t.doc.keywords}</span>
            {splitKeywords(doc.keywords).map((kw) => (
              <Link
                key={kw}
                href={`/${locale}/search?q=${encodeURIComponent(kw)}`}
                className="rounded-full border border-chabon/15 bg-koton px-2.5 py-0.5 text-xs text-grafit hover:border-liy hover:text-ank"
              >
                {kw}
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* Barre d'actions */}
      <div className="no-print flex flex-wrap gap-2">
        <FavoriteButton documentId={doc.id} initial={!!fav} t={t} />
        <CiteButton
          citation={citation}
          label={t.doc.cite}
          copiedLabel={t.doc.copied}
          citeArticleLabel={t.doc.citeArticle}
          copyArticleLabel={t.doc.copyArticle}
        />
        <PrintButton label={t.doc.print} />
        {can(user.role, 'export.sealed') ? (
          <a
            href={`/api/export?id=${doc.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-chabon px-3 py-1.5 text-sm font-semibold text-white hover:bg-chabon"
          >
            ↓ {t.doc.export}
          </a>
        ) : null}
        {/* PDF original — servi par une route authentifiée depuis le Blob privé, seulement
            si migré (URL Blob). Circulaires BRH : TÉLÉCHARGEMENT ouvert à tout lecteur de
            circulaires. Autres types : lien « source » réservé (canSeeSourcePdf). */}
        {isBlobUrl(doc.sourcePdfUrl) && (type === 'CIRCULAIRE_BRH' || canSeeSourcePdf(user)) && (
          <a
            href={`/api/doc/${doc.id}/pdf${type === 'CIRCULAIRE_BRH' ? '?download=1' : ''}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-chabon/15 bg-white px-3 py-1.5 text-sm text-grafit hover:bg-pil"
          >
            {type === 'CIRCULAIRE_BRH' ? `↓ ${t.doc.downloadPdf}` : t.doc.source}
          </a>
        )}
      </div>

      {/* Annexes à compléter : téléchargement Word (formulaires) / Excel (tableaux),
          filigrane Lam + mention légale (src/lib/annexes/generate.ts). */}
      {type === 'CIRCULAIRE_BRH' && can(user.role, 'export.sealed') && annexCount > 0 && (
        <div className="no-print rounded-xl border border-chabon/10 bg-koton/60 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ank">{t.doc.annexes}</p>
              <p className="text-xs text-ank/80">{t.doc.annexesHint}</p>
            </div>
            <div className="flex gap-2">
              <a
                href={`/api/doc/${doc.id}/annexes?format=docx&locale=${locale}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-chabon/15 bg-white px-3 py-1.5 text-sm font-medium text-ank hover:bg-pil"
              >
                ↓ Word
              </a>
              <a
                href={`/api/doc/${doc.id}/annexes?format=xlsx&locale=${locale}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-chabon/15 bg-white px-3 py-1.5 text-sm font-medium text-ank hover:bg-pil"
              >
                ↓ Excel
              </a>
            </div>
          </div>
        </div>
      )}

      {doc.status === 'ABROGE' && (
        <div className="rounded-xl border border-liy bg-pil px-4 py-2.5 text-sm text-ank">
          {abrogatedBy ? (
            <>
              {t.doc.abrogatedByPrefix}{' '}
              <Link
                href={`/${locale}/doc/${abrogatedBy.id}`}
                className="font-semibold underline underline-offset-2 hover:text-chabon"
              >
                {abrogatedBy.number}
              </Link>
              .
            </>
          ) : doc.abrogatedByNumber ? (
            `${t.doc.abrogatedByPrefix} ${doc.abrogatedByNumber}.`
          ) : (
            t.doc.abrogatedBanner
          )}
        </div>
      )}

      {isIndex && (
        <div className="rounded-xl border border-chabon/30 bg-pil px-4 py-2.5 text-sm text-chabon">
          {t.doc.indexNote}
        </div>
      )}

      {/* Marque : reproduction si publiée */}
      {type === 'MARQUE' && doc.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={doc.imageUrl} alt={title} className="h-40 w-40 rounded-xl border border-chabon/10 object-contain p-2" />
      )}

      {/* Résumé éditorial — tu pour les décisions : il y est la 2ᵉ ligne du sommaire. */}
      {summary && type !== 'JURISPRUDENCE' && (
        <section className="rounded-2xl border border-chabon/10 bg-white p-5">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-ank">{t.doc.editorialSummary}</h2>
            <span className="rounded bg-pil px-1.5 py-0.5 text-[10px] font-medium uppercase text-ank/80">
              {t.doc.editorial}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-ank/80">{summary}</p>
        </section>
      )}

      {/* « Sa sa vle di / What it means » */}
      {means && (
        <section className="rounded-2xl border-2 border-liy bg-pil p-5">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-ank">{t.doc.means}</h2>
            <span className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-medium uppercase text-ank/80">
              {t.doc.editorial}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-ank/80">{means}</p>
        </section>
      )}

      {/* Texte officiel — jamais traduit (§02). Texte annoté : menu latéral (recherche +
          sommaire + index) à GAUCHE ; sinon rendu standard pleine largeur.
          Impression : le menu latéral porte no-print (dans CodeSidebar) et la
          grille redevient un bloc simple — le texte occupe toute la largeur. */}
      {annotations ? (
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start print:block">
          <CodeSidebar docId={doc.id} groups={annotations.navToc} indexEntries={annotations.indexEntries} locale={locale} />
          <section id={ANCRE_TEXTE} className="min-w-0 scroll-mt-4 rounded-2xl border border-chabon/10 bg-white p-5">
            <div className="mb-3 border-b border-chabon/10 pb-3">
              <h2 className="text-sm font-semibold text-ank">{t.doc.officialText}</h2>
            </div>
            <p className="mb-3 rounded-lg bg-pil px-3 py-2 text-[11px] leading-relaxed text-grafit">{t.doc.unofficialNote}</p>
            <AnnotatedText
              text={effectiveBody}
              annotations={annotations}
              rich={richBlocks}
              hrefFor={hrefFor}
              locale={locale}
              terms={hlTerms}
              hideInlineIndex={lecture.hideInlineIndex}
              linkCivRefs={doc.source === 'CODE_CIVIL_ANNOTE'}
              ownCode={doc.source === 'CODE_CIVIL_ANNOTE' ? 'civil' : doc.source === 'CODE_PENAL_ANNOTE' ? 'pénal' : undefined}
              linkArtRefs={lecture.linkArtRefs}
              annotationsVariant={lecture.annotationsVariant}
              codeHrefs={codeHrefs}
            />
          </section>
        </div>
      ) : isScannedEdition ? (
        <section className="rounded-2xl border border-chabon/10 bg-white p-6">
          <p className={`mx-auto max-w-2xl text-sm leading-relaxed text-grafit ${transcription ? '' : 'mb-4 text-center'}`}>
            {transcription
              ? t.doc.scannedEditionTranscribed
              : texteCherchable
                ? t.doc.scannedEditionSearchable
                : t.doc.scannedEdition}
          </p>
          <div className={`text-center ${transcription ? 'mt-4' : ''}`}>
            {canViewPdf ? (
              <a
                href={`/api/doc/${doc.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-chabon px-4 py-2.5 text-sm font-semibold text-white hover:bg-chabon"
              >
                ↗ {t.doc.openPdf}
              </a>
            ) : (
              <p className="text-xs text-ank/80">{t.doc.pdfNotIncluded}</p>
            )}
          </div>
          {transcription && (
            <div id={ANCRE_TEXTE} className="mt-6 scroll-mt-4 border-t border-chabon/10 pt-5">
              <h2 className="mb-3 text-sm font-semibold text-ank">{t.doc.transcriptionHeading}</h2>
              {/* ⚠️ LA MISE EN COLONNES DU JOURNAL EST SIGNIFIANTE, et `pdftotext -layout` la
                  restitue par des espaces. Un rendu qui replie les blancs entrelacerait les
                  deux colonnes du Moniteur ligne à ligne : d'où la chasse fixe, les blancs
                  conservés, et le défilement propre au bloc plutôt qu'à la page. */}
              <pre className="max-h-[70vh] overflow-auto whitespace-pre rounded-lg bg-pil p-4 font-mono text-[12px] leading-relaxed text-chabon">
                {transcription}
              </pre>
            </div>
          )}
        </section>
      ) : (
        <section id={ANCRE_TEXTE} className="scroll-mt-4 rounded-2xl border border-chabon/10 bg-white p-5">
          <div className="mb-3 border-b border-chabon/10 pb-3">
            <h2 className="text-sm font-semibold text-ank">{t.doc.officialText}</h2>
          </div>
          <p className="mb-3 rounded-lg bg-pil px-3 py-2 text-[11px] leading-relaxed text-grafit">{t.doc.unofficialNote}</p>
          {themeIndex.length > 0 && <div className="mb-4"><CodeThemeBrowser index={themeIndex} t={t} /></div>}
          {tableEntries.length >= 2 && (
            <details className="mb-4 rounded-xl border border-chabon/10 bg-koton/40 px-4 py-2.5">
              <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-ank/80">
                {TLBL.heading} ({tableEntries.length})
              </summary>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                {tableEntries.map((e) => (
                  <li key={e.num}>
                    <a href={`#tableau-${e.num}`} className="text-sm text-chabon hover:underline">
                      {TLBL.table} {e.num}
                      {e.cap && <span className="text-grafit"> — {e.cap}</span>}
                      {e.orphan && <span className="text-ank/80"> ({TLBL.orphan})</span>}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="relative">
            <OfficialText text={effectiveBody} hrefFor={hrefFor} rich={richBlocks} locale={locale} terms={hlTerms} articleMarks={articleMarks} />
          </div>
        </section>
      )}

      {amendItems.length > 0 && <AmendmentHistory items={amendItems} locale={locale} />}

      {/* Versions & historique (type 1) */}
      {doc.versions.length > 0 && (
        <section className="rounded-2xl border border-chabon/10 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-ank">{t.doc.versions}</h2>
          <ul className="space-y-2">
            {doc.versions.map((v) => (
              <li key={v.id} className="flex items-center justify-between rounded-lg bg-koton px-3 py-2 text-sm">
                <span className="text-ank">{v.versionLabel}</span>
                <span className="text-xs text-ank/80">{v.changeNote}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Citations croisées & renvois : CrossRef éditoriaux (sortants) + rétroliens + Citation legacy */}
      {(doc.citationsFrom.length > 0 || doc.citationsTo.length > 0 || outRefs.length > 0 || inRefs.length > 0) && (
        <section className="rounded-2xl border border-chabon/10 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-ank">{t.doc.citations}</h2>
          <ul className="space-y-2">
            {outRefs.map((r) => {
              const inner = (
                <>
                  {r.type && <Pastille type={r.type} />}
                  <span className="text-ank/80">{r.kind} →</span> {r.label}
                  {r.anchor && <span className="text-xs text-ank/80">(art. {r.anchor.replace('art-', '')})</span>}
                  {r.pending && <span className="text-xs text-chabon">· cible non importée</span>}
                </>
              )
              return (
                <li key={r.refId}>
                  {r.accessible && r.toId ? (
                    <Link href={`/${locale}/doc/${r.toId}${r.anchor ? '#' + r.anchor : ''}`} className="flex items-center gap-2 text-sm text-ank hover:underline">
                      {inner}
                    </Link>
                  ) : (
                    <span className="flex items-center gap-2 text-sm text-grafit">{inner}</span>
                  )}
                </li>
              )
            })}
            {doc.citationsFrom.map((c) => (
              <li key={c.id}>
                <Link href={`/${locale}/doc/${c.to.id}`} className="flex items-center gap-2 text-sm text-ank hover:underline">
                  <Pastille type={c.to.type as DocType} />
                  <span className="text-ank/80">{c.kind} →</span> {c.to.titleFr}
                </Link>
              </li>
            ))}
            {inRefs.map((b) => {
              const inner = (
                <>
                  <Pastille type={b.fromType} />
                  <span className="text-ank/80">← {b.kind}</span> {b.fromTitleFr || t.doc.otherService}
                </>
              )
              return (
                <li key={`bl-${b.refId}`}>
                  {b.accessible ? (
                    <Link href={`/${locale}/doc/${b.fromId}`} className="flex items-center gap-2 text-sm text-ank hover:underline">
                      {inner}
                    </Link>
                  ) : (
                    <span className="flex items-center gap-2 text-sm text-grafit">{inner}</span>
                  )}
                </li>
              )
            })}
            {doc.citationsTo.map((c) => (
              <li key={c.id}>
                <Link href={`/${locale}/doc/${c.from.id}`} className="flex items-center gap-2 text-sm text-ank hover:underline">
                  <Pastille type={c.from.type as DocType} />
                  <span className="text-ank/80">← {c.kind}</span> {c.from.titleFr}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {type === 'JURISPRUDENCE' && (
        <div className="no-print">
          <DocumentNotes
            documentId={doc.id}
            notes={notes}
            locale={locale}
            peutEtreAnonyme={peutEtreAnonyme(user.role)}
          />
        </div>
      )}

      {/* Les outils éditoriaux vivent dans la SECTION D'ÉDITION, pas sur la plateforme :
          la fiche publique doit se lire comme la lit un abonné. Ne subsiste ici qu'un
          renvoi, réservé à la rédaction et retiré à l'impression. */}
      {peutEditer && (
        <div className="no-print flex justify-end">
          <Link
            href={`/${locale}/admin/document/${doc.id}`}
 className="inline-flex min-h-[44px] items-center rounded-lg border border-liy px-4 text-sm font-semibold text-ank transition hover:bg-pil"
          >
            Outils éditoriaux ↗
          </Link>
        </div>
      )}
    </article>
  )
}
