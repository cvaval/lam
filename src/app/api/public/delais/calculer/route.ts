import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { LIMITS, guard } from '@/lib/security/ratelimit'
import { getClientCtx } from '@/lib/auth/request'
import { calculPublic, lireParamsCalcul } from '@/lib/delais/lecture-publique'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * LE CALCUL — PUBLIC, `GET` PUR, AUCUNE ÉCRITURE.
 *   GET /api/public/delais/calculer?d=…&n=…
 *
 * ⚠️ **CETTE ROUTE N'ACCEPTE PLUS DE SLUG D'ENTRÉE.** Publiquement, on ne calcule QUE sur un
 * nombre de jours francs saisi — le genre « Autre » du § 4.12. `?e=cpc-354-…` rendait le
 * libellé de l'entrée, sa durée, son régime, son fondement, son point de départ et le texte
 * de son article : c'était le répertoire servi une ligne à la fois, à qui itère les slugs,
 * pendant qu'on fermait la route qui le sert en bloc. Le refus est un **401**
 * `repertoireReserve` : l'entrée existe, elle demande un compte.
 *
 * C'est `calculPublic(params, 'public')` qui prononce ce refus, et l'accès est un ARGUMENT —
 * jamais un paramètre de la « query ». `&base=/outils/delais` ne change donc rien : il ne
 * décide que de l'adresse du permalien émis.
 *
 * ⚠️ **LE CALCUL SERVI ICI EST FRANC ET PROROGÉ** — départ + N + 1, puis report au prochain
 * jour qui n'est ni un dimanche ni une fête légale (C. pr. civ., art. 991 al. 3, en cascade).
 * Ce qu'il n'a pas : ni lecture nommée, ni « lecture la plus large », ni jour praticable, ni
 * avertissement hors A3. Me Vaval, 20 août 2026 — **seconde décision du jour, elle revient
 * sur celle du matin** : « la date limite est tombée un dimanche, il faut la proroger au
 * prochain jour ouvrable ». Porté par `src/lib/delais/franc-pur.ts`, appliqué dans
 * `calculPublic()` — **jamais ici**.
 * Cette route ne trie ni ne retire quoi que ce soit du résultat : elle le sérialise. Un filtre
 * posé dans cette enveloppe ferait diverger l'API de la page, qui n'y passe pas.
 *
 * ⚠️ **Cette route n'est plus qu'une enveloppe HTTP** : débit, validation, codes et cache.
 * Le calcul lui-même est `calculPublic()` (`src/lib/delais/lecture-publique.ts`), que la page
 * serveur `/[locale]/delais` appelle DIRECTEMENT pour rendre son résultat sans JavaScript.
 * Un second chemin de calcul aurait été une seconde vérité : le jour où les deux
 * divergeraient, l'écran aurait raison contre les 217 tests du moteur.
 *
 * Ce qu'elle ne fait pas, et qui est délibéré (§ 4 : « le calculateur n'écrit JAMAIS rien ») :
 * pas de journal, pas de statistique, pas de quota, pas de `runSearch()`. C'est un outil, pas
 * une recherche.
 *
 * ⚠️ **AUCUN HORODATAGE DANS LA RÉPONSE.** Le bloc 12 des tests exige qu'un permalien rechargé
 * rende un résultat identique au caractère près : rien ici ne lit l'heure.
 *
 * ⚠️ **L'AVERTISSEMENT « date à plus de dix ans » APPARTIENT À LA RÉPONSE.** Il en était
 * absent, au motif qu'« il dépend du jour où l'on regarde » : c'est faux depuis que
 * `ANNEE_DE_REFERENCE` est une constante GELÉE et versionnée dans `lecture-publique.ts`,
 * relevée à la main comme le calendrier — précisément pour que le permalien rende le même
 * résultat dans dix ans. `calculPublic()` le calculait donc, la page l'affichait, et la route
 * le jetait : `?d=2050-01-01&n=15` avertissait sur `/fr/delais` et n'avertissait pas par
 * l'API. C'était la seconde vérité que ce découpage existe pour empêcher.
 */
export async function GET(req: NextRequest) {
  const { ip } = getClientCtx(req)
  if (!(await guard({ action: 'delais-calcul', subject: ip ?? 'anon', ...LIMITS.delaisCalcul }, { ip }))) {
    return apiError('rate', 429)
  }

  const parsed = lireParamsCalcul(req.nextUrl.searchParams)
  if (!parsed.ok) return apiError(parsed.code, parsed.statut)

  // ⚠️ `'public'` en toutes lettres : c'est la route PUBLIQUE, et le périmètre ne se déduit
  // pas de la requête. La valeur par défaut de `calculPublic` est la même — on échoue fermé —,
  // mais l'écrire ici rend la décision visible à la relecture.
  const out = await calculPublic(parsed.valeur, 'public')
  if (!out.ok) return apiError(out.code, out.statut)

  const res = NextResponse.json({
    ok: true,
    permalien: out.permalien,
    entree: out.entree,
    resultat: out.resultat,
    // § 6.2 — les avertissements de SAISIE, tels que l'écran les rend. Ils ne portent pas sur
    // le droit et ne bloquent rien ; les omettre faisait diverger la route de la page.
    avertissementsSaisie: out.avertissementsSaisie,
    // § 6.2 — la mention du jour où la date CALCULÉE tombe (fête, jour à surveiller,
    // dimanche), telle que la page l'écrit en petits caractères sous la date. Elle est
    // sérialisée pour la même raison que `avertissementsSaisie` l'a été : cette route ne
    // trie ni ne retire rien de ce que `calculPublic()` a produit — sinon l'API et la page
    // ne diraient plus la même chose du même jour.
    mentionsJour: out.mentionsJour,
    // § 6.2 — le REPORT de l'art. 991 : les jours franchis et la date d'arrivée, tels que la
    // page les écrit en petits caractères sous la date. Sérialisé pour la même raison que
    // `mentionsJour` : cette route ne trie ni ne retire rien de ce que `calculPublic()` a
    // produit — sinon l'API rendrait une date reportée sans dire pourquoi, et la page non.
    report: out.report,
    // § 0 — la date qu'aurait donnée la lecture STRICTE de l'art. 991 al. 3, quand elle diffère
    // de celle qu'on rend. C'est la date que le PORTAIL affiche du même délai, et la plus
    // précoce des deux. **Mesuré le 20 août 2026 au soir** (`franc-pur.test.ts`, § 0) : sous le
    // calendrier et les règles COURANTS, les deux surfaces ne divergent PLUS JAMAIS — 0 sur
    // 1 826 départs, pour 8, 15, 30 et 31 jours. Il ne reste de divergence que sous un
    // permalien `c=1`, sur les quatre jours que la version 1 du calendrier portait sans texte
    // instituant : 16 départs sur 1 826. Sérialisée au même motif que `report` : la route ne
    // retire rien de ce que `calculPublic()` a produit, sinon l'API affirmerait une date de
    // forclusion que la page assortit d'une réserve.
    lectureStricte: out.lectureStricte,
    versionCalendrier: out.versionCalendrier,
    // ⚠️ **AJOUTÉE LE 20 AOÛT 2026 (SOIR) — défaut 9 de la troisième recette.** La route
    // sérialisait deux versions sur trois : `versionRegles` valait `undefined` dans la réponse
    // JSON. C'était la « seconde vérité » que l'en-tête de cette route s'interdit (« elle ne
    // trie ni ne retire quoi que ce soit du résultat : elle le sérialise »), et cela vidait de
    // son sens la raison d'être de `rl` — « un calcul cité doit dire sous quelle règle il a été
    // fait ». Un intégrateur ne pouvait pas savoir sous quelle lecture la date lui était rendue.
    versionRegles: out.versionRegles,
    versionFenetres: out.versionFenetres,
    fenetres: out.fenetres,
    bandeau: out.bandeau,
  })
  // Un calcul est une fonction pure de ses paramètres : il se met en cache sans risque, et
  // la révision figurant dans l'URL, une édition du répertoire ne périme rien.
  //
  // L'exception : une entrée RETIRÉE. Son bandeau porte le motif et la date du retrait, tous
  // deux modifiables — et « Réafficher » (§ 7.2) doit le faire disparaître tout de suite. Un
  // bandeau « cette entrée a été retirée » survivant une heure à sa réapparition au menu
  // serait lu comme une contradiction de la plateforme avec elle-même.
  res.headers.set(
    'Cache-Control',
    out.retiree ? 'no-store' : 'public, max-age=60, s-maxage=600, stale-while-revalidate=3600',
  )
  return res
}
