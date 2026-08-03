/**
 * Grammaire des RENVOIS INTERNES d'un texte officiel (« l'article 240 », « les articles
 * 63, 64 et 68 », « la section 7 ») — extraite d'OfficialText pour être testable hors JSX.
 * Ne décide RIEN : le composant confronte chaque numéro capturé aux ancres réelles du
 * document (anti-lien-mort) avant d'émettre un lien.
 */
// Renvois internes du Code pénal : « l'article 240 », « les articles 63, 64 et 68 » → liens
// #art-N. Le Code pénal se cite par le NUMÉRO NU (pas de préfixe « C. pén. ») ; on ne lie donc
// que si (1) le numéro EST réellement un article du Code (`artRefs`, anti-lien-mort) et (2) le
// renvoi n'est PAS externe (« art. 2 DU DÉCRET… », « article 5 DE LA LOI… », « du code
// d'instruction criminelle ») — « du présent code » reste un renvoi interne (donc lié).
// 4 chiffres + suffixe « -N » admis : la réforme du Code de commerce (1111-2, 1136-15…)
// et les décrets récents du Code civil numérotent ainsi (constat d'audit : aucun renvoi
// interne de la réforme n'était cliquable avec la limite \d{1,3}). Le suffixe DÉCIMAL
// « .N » (Décret minier 2026 : « articles 54, 54.1, 54.2 ») est admis au même titre —
// il exige 1-2 chiffres collés au point, un point final de phrase n'est jamais capturé ;
// l'ancre reste anti-lien-mort (articleAnchorFromNum : 54.1 → art-54-1 ∈ artRefs ?).
// EXCEPTION : décimal suivi de « ) » refusé — style des traités « article 17.2) » =
// article 17, paragraphe 2) (Convention de Paris) : on capture la base « 17 » et son
// lien interne est conservé (constat d'audit : 7 liens perdus sinon).
// Le suffixe est RÉPÉTABLE (`*`) : les divisions à trois niveaux existent — « 4.2.1 » des
// circulaires BRH, « article 31.1.1 » de la Constitution (anchors.ts). Avec un suffixe
// unique, « 4.2.1 » se lisait « 4.2 » suivi d'un « .1 » orphelin, donc un lien vers la
// mauvaise cible. La répétition ne peut qu'ÉTENDRE une capture ; le garde anti-lien-mort
// (`artRefs`) décide seul de la transformation en lien.
const ART_NUM_TAIL = String.raw`(?:-\d{1,2}(?!\d)|\.\d{1,2}(?!\d)(?!\)))*(?:\s*(?:bis|ter))?`
export const ART_REF_RE = new RegExp(
  String.raw`\b(?:articles?|art\.)\s+\d{1,4}(?!\d)${ART_NUM_TAIL}(?:\s*(?:,|;|et|à)\s*\d{1,4}(?!\d)${ART_NUM_TAIL})*`,
  'gi',
)
// Circulaires BRH : leurs divisions se citent « la section 7 », « les sections 4.2.1 et 5.3 ».
// Variante réservée aux documents qui l'activent (`sectionRefs`) — ailleurs, « section 3 »
// désigne une division du plan, pas l'article 3, et ne doit surtout pas devenir un lien.
export const ART_OR_SEC_REF_RE = new RegExp(
  String.raw`\b(?:articles?|art\.|sections?)\s+\d{1,4}(?!\d)${ART_NUM_TAIL}(?:\s*(?:,|;|et|à)\s*\d{1,4}(?!\d)${ART_NUM_TAIL})*`,
  'gi',
)
export const ART_NUM_RE = new RegExp(String.raw`(\d{1,4}(?!\d)${ART_NUM_TAIL})`, 'i')
// « Article 22 Loi de Finances 2015-2016 », « Article 5 : (Loi de Finances…) »,
// « Articles 37 loi sur les BEL » : marqueurs de textes MODIFICATEURS sans « de la »
// intercalé — 4 faux liens internes constatés à l'audit (CFPB/CFGDCT).
// « code\s+\S » couvre TOUTES les dénominations de codes (« du Code pénal », « du Code
// civil », « du Code rural », « du Code de commerce »…) : le garde ne visait que
// « code d… » et laissait passer « article 323 du Code pénal » — 37 renvois externes
// du corpus concernés (Code civil/pénal/rural/douanier).
// `(?:\p{L}+\s+)?` : un adjectif peut s'intercaler — « de la PRÉSENTE loi », « du MÊME décret »,
// « de ladite ordonnance ». Sans lui, « l'article 7 de la présente loi » (art. 311, loi de 2014)
// devenait un lien vers l'article 7 du Code civil.
export const ART_EXT_AFTER =
  /^\s*(?:[:—–-]\s*)?(?:\(?\s*(?:du|de\s+la|de\s+l['’]|des|dudit|de\s+ladite)\s+(?:\p{L}+\s+)?(?:d[ée]cret|loi|ordonnance|arr[êe]t[ée]|constitution|code\s+\S)|\(?\s*lois?\s+de\s+finances|\(?\s*loi\s+sur)/iu
// Renvoi externe annoncé AVANT les numéros (« selon les dispositions du décret du
// 6 janvier 2016 … particulièrement en ses articles 9, 31, 32 et 41 ») : le garde
// ART_EXT_AFTER ne voit rien après — on inspecte la fin du texte qui PRÉCÈDE (audit :
// 4 faux liens vers les arts 9/31/32/41 du Code de 1826 depuis l'art. 1136-7).
export const ART_EXT_BEFORE = /(?:d[ée]cret|loi|ordonnance|arr[êe]t[ée]|constitution)\b[^.;:]{0,80}?(?:en|à|dans)\s+(?:ses|son|sa|leurs)\s*$/i

// Le texte est DÉSIGNÉ juste avant son article, séparé par une simple virgule :
// « Décret du 27 janvier 1959, Art. 1. », « (D. L. du 22 décembre 1944, art. 1) »,
// « Constitution de 1987, art. 17 ». C'est la forme du recueil pour citer un texte connexe,
// et elle échappait aux deux gardes : rien n'annonce le renvoi APRÈS le numéro, et la
// formule « en ses » de ART_EXT_BEFORE est absente. Le numéro d'article devenait un lien
// vers l'article homonyme du Code (constat d'audit : arts 55, 229, 230, 241, 314, 330,
// 608, 742). La date/désignation ne peut contenir ni point ni point-virgule : « … 1959, »
// matche, « … est abrogé. Loi du 8 mai, » aussi (la borne est le dernier point).
export const ART_EXT_DESIGNATION =
  /(?:d[ée]cret[-\s]?loi|d[ée]cret|\bD\.\s?L\.|\bD\.|\bL\.|loi|ordonnance|arr[êe]t[ée]|constitution)\s[^.;:]{0,70},\s*$/i
