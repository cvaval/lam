# Recherche → texte (HTML) et original (PDF) : analyse et recommandations (24 oct. 2026)

Demande de Me Vaval : quand un terme recherché est retrouvé dans un document, le clic sur le
résultat doit mener aux versions **HTML** et **PDF** du document. Analyse du code en production et
mesures en lecture seule sur la base de production (24 oct. 2026). Rien n'est modifié.

## 1. Ce qui existe aujourd'hui

| Étape | Comportement actuel | Où |
|---|---|---|
| Résultat de recherche | toute la carte est UN lien vers `/doc/{id}?q=…` (la version HTML) ; aucun accès au PDF depuis la liste | `src/components/ResultCard.tsx` |
| Extrait sous le titre | tiré du **résumé** quand il existe, sinon du corps (240 caractères autour de la 1ʳᵉ occurrence) ; jamais l'article concerné | `src/lib/search/fts.ts` (`enrichSnippets`), `highlight.ts` (`makeSnippet`) |
| Arrivée sur la fiche | les termes sont **surlignés** dans le texte (synonymes compris) ; la page s'ouvre **en haut** : pas de saut à la 1ʳᵉ occurrence, pas de compteur, pas de « suivante / précédente » | `doc/[id]/page.tsx` (`hlTerms`), `OfficialText` |
| Annotations, jurisprudence, anciennes rédactions | **indexées** par la recherche (champ `annotationsText`) mais **non surlignées** et souvent **repliées** : le document est « trouvé » sans que le lecteur voie pourquoi | `AnnotatedText.tsx`, `Repli.tsx` |
| PDF original | bouton sur la fiche (« Source », « Télécharger le PDF » pour les circulaires BRH, « Ouvrir le PDF » pour les éditions scannées) ; s'ouvre **à la page 1**, sans le terme | `doc/[id]/page.tsx`, `api/doc/[id]/pdf/route.ts` |
| Index du Moniteur | résultat → fiche d'Index → édition → PDF : **trois clics** | `renvois-index.ts`, fiche |

**Contrôles d'accès (à conserver)** : le PDF est servi par une route authentifiée depuis le Blob
PRIVÉ (l'adresse du fichier n'est jamais exposée) ; il exige le droit « voir le PDF source »
(`canSeeSourcePdf`), sauf pour les circulaires BRH ; débit limité.

### Mesures (production, 24 oct. 2026)

| Type | Documents | Avec texte HTML | Avec PDF (Blob) | PDF seulement |
|---|---|---|---|---|
| Législation | 4 984 | 4 383 | 4 697 | 591 (fascicules scannés) |
| Jurisprudence | 1 343 | 1 334 | 1 181 | 9 |
| Circulaires BRH | 142 | 141 | 142 | 1 |
| Lois de finances | 29 | 29 | 17 | 0 |
| Index du Moniteur | 28 956 | — | 0 (le PDF est celui de l'édition) | — |

- **5 436 documents ont À LA FOIS un texte HTML et un PDF** : c'est le cœur de la demande.
- Comptes actifs ayant le droit « PDF source » : **9 sur 10**.
- Le texte enregistré ne garde **aucune marque de page** (ni saut de page, ni « page N ») : la page
  du PDF où se trouve le terme ne peut pas se déduire du texte stocké. En revanche, la lecture de la
  couche texte du PDF (`pdf-parse`, déjà utilisé) rend le texte **page par page**.

## 2. Recommandations

### Priorité 1 — rapide, sans changement de base

**R1. Deux actions explicites sur chaque résultat : « Texte » et « PDF ».**
La carte garde son titre cliquable (vers le texte HTML) et reçoit une rangée d'actions :
`Lire le texte →` et `PDF ↗` (nouvel onglet). Le bouton PDF n'apparaît que si le document a un PDF
servable ET que le lecteur en a le droit — exactement les règles de la fiche. Document « PDF
seulement » (fascicule scanné) : le PDF devient l'action principale, la transcription l'autre quand
elle existe. *Technique* : la carte ne peut plus être un seul lien (des liens imbriqués sont
invalides) ; ajouter `hasPdf` aux résultats (lu au même moment que le reste, coût nul).
*Effort : ½ journée.*

**R2. Arriver SUR l'occurrence, et pouvoir passer de l'une à l'autre.**
À l'ouverture depuis une recherche : défilement jusqu'à la 1ʳᵉ occurrence surlignée, et une petite
barre fixe « Occurrence 1 sur 12 · ‹ précédente · suivante › » (clavier : `n` / `Maj+n`), qui
**déplie** automatiquement le repli contenant l'occurrence. Les surlignages étant déjà rendus par le
serveur, un seul composant client suffit, valable pour tous les lecteurs (codes, lois, BRH,
jurisprudence). *Effort : 1 journée.*

**R3. Pointer l'ARTICLE dans le lien et dans l'extrait.**
Pour les résultats affichés (≤ 20 par page), le moteur lit déjà le corps du document : y repérer la
1ʳᵉ occurrence, remonter à l'en-tête d'article qui la précède, et produire :
- un lien `/doc/{id}?q=…#art-1382` (les ancres `#art-N` existent déjà, `src/lib/doc/anchors.ts`) ;
- un extrait tiré du **corps** autour de l'occurrence, préfixé de l'article (« Article 1382 — … la
  <mark>responsabilité</mark> … ») au lieu du résumé quand le terme n'y figure pas.
*Effort : 1 journée.*

**R4. Surligner aussi dans les annotations et la jurisprudence repliées.**
Les termes ne sont aujourd'hui transmis qu'au texte de l'article. Les transmettre aux annotations,
à la jurisprudence et aux anciennes rédactions, et ouvrir le repli de la 1ʳᵉ occurrence (avec R2).
Sans cela, une recherche qui ne trouve le terme QUE dans une annotation mène à une page où rien
n'est visible. *Effort : ½ à 1 journée.*

### Priorité 2 — le PDF à la bonne page

**R5. Index de la couche texte des PDF, page par page.**
Un traitement par lots lit la couche texte de chaque PDF (4 697 + 1 181 + 142 + 17) et l'enregistre
page par page dans une nouvelle table `DocumentPage (documentId, page, texte, index plein-texte)`.
La recherche connaît alors la **page** de la 1ʳᵉ occurrence et le bouton devient
`PDF, page 7 ↗` → `/api/doc/{id}/pdf#page=7` (paramètre compris par les visionneuses de Chrome,
Firefox et Edge). Pour un scan sans couche texte, le texte d'OCR — s'il a été fait page par page —
peut alimenter la même table. *Repli* pour un document pas encore traité : calcul de la page à la
demande (couche texte lue une fois, puis mise en cache). *Effort : 2 à 3 jours, migration comprise.*

**R6. Une visionneuse PDF intégrée qui surligne le terme.**
Les visionneuses des navigateurs savent aller à une page (`#page=`), mais **ne surlignent pas un
terme** de façon fiable d'un navigateur à l'autre (le paramètre `#search=` n'est pas pris en charge
partout). `pdfjs-dist` est déjà une
dépendance : une page `/{locale}/doc/{id}/pdf?q=…&page=…` affiche l'original DANS la plateforme
(accès et débit inchangés), surligne le terme sur toutes les pages, et offre « occurrence suivante »
comme R2 ; « Télécharger » et « Ouvrir dans un onglet » restent. *Effort : 2 à 4 jours.*

**R7. Texte et original côte à côte (ordinateur).**
Pour les textes transcrits d'un fascicule (le Moniteur prévaut sur toute transcription) : un mode
« Comparer avec l'original » — HTML à gauche, PDF à droite, synchronisés sur la page de
l'occurrence. À faire après R5-R6. *Effort : 2 jours.*

### Priorité 3 — compléments

**R8. Index du Moniteur : aller droit à l'édition.** Résoudre l'édition au moment de la recherche
(le renvoi Index ⇄ Éditions existe déjà) et proposer sur le résultat d'Index « Édition (texte) » et
« PDF » — trois clics deviennent un. *Effort : 1 journée.*

**R9. Sociétés** : sur la fiche d'une société, chaque publication au Moniteur ouvre l'édition et son
PDF à la bonne page (s'appuie sur R5).

**R10. Mesurer** : enregistrer (sans donnée personnelle) les choix « Texte » / « PDF » / navigation
entre occurrences, pour vérifier l'usage avant R6-R7.

## 3. Ordre proposé

| Lot | Contenu | Effort | Gain |
|---|---|---|---|
| A | R1 + R2 + R3 + R4 | 3 à 4 jours | le clic mène au texte À L'ARTICLE, au terme visible, et au PDF en un clic |
| B | R5 (+ R8) | 3 à 4 jours | le PDF s'ouvre à la bonne page ; Index → édition en un clic |
| C | R6 + R7 | 4 à 6 jours | original surligné dans la plateforme, comparaison texte / original |

Points à trancher par Me Vaval :
1. Le bouton **PDF dans la liste** suit-il exactement les droits actuels (`canSeeSourcePdf`, sauf
   BRH) ? Recommandé : oui (aucun accès nouveau).
2. Pour un lecteur SANS droit PDF : bouton masqué (comme aujourd'hui sur la fiche) ou mention
   « PDF réservé » ? Recommandé : masqué.
3. Ouvrir le PDF dans un **nouvel onglet** (actuel) ou dans la visionneuse intégrée (R6) ?

## 4. Lot A — RÉALISÉ (24 oct. 2026, local, non déployé)

Choix appliqués (recommandés, « oui » de Me Vaval) : le bouton PDF suit exactement les droits
actuels ; masqué pour un lecteur sans droit ; le PDF s'ouvre dans un nouvel onglet.

| Reco | Réalisation |
|---|---|
| R1 | `ResultCard` : le titre couvre la carte (clic partout → la fiche) ; actions « Lire le texte → » et « PDF ↗ » au-dessus (aucun lien imbriqué) ; PDF seul → action principale. Disponibilités par une requête pour la page affichée (`src/lib/search/versions.ts`), quel que soit le moteur. |
| R2 | `NavigationOccurrences` sur la fiche (`?q=`) : départ à la 1ʳᵉ occurrence (ou la 1ʳᵉ après l'article de l'adresse), « Occurrence i sur n », précédente / suivante, `n` / `Maj+n`, mention claire quand le terme n'est pas dans le texte affiché ; sans animation si demandé. |
| R3 | `src/lib/search/occurrence.ts` : 1ʳᵉ occurrence du CORPS (même motif que le surlignage), article qui la contient (`articleAnchorFromHeading`) ; le moteur intégré en tire l'extrait « Article N — … » et `anchor` ; lien `/doc/{id}?q=…#art-N`. |
| R4 | `CodeRefText` surligne ; `Jurisprudence`, `OldVersion`, `RelatedLaw` reçoivent les termes et s'OUVRENT d'office quand ils en contiennent un (`surligner.tsx`). |

Vérifié : 1 962 tests de l'application et 110 des scripts, TypeScript, ESLint, `build:check` ;
recherche réelle sur le banc local (« cautionnement » → « Article 8 — … », ancre `art-8`).
**Vérifié CONNECTÉ dans le navigateur** (24 oct., à la demande de Me Vaval) sur le banc local
`lam_banc` (`localhost:3100`) : 4 documents réels copiés de la production (lecture seule) — Code
civil, décret énergie 2016 (texte + PDF), Moniteur n° 19 de 2003 (PDF seul), arrêt Brasserie de
la Couronne —, trigger plein-texte posé, deux comptes d'essai `@smoke.invalid` (avec et sans droit
PDF), sessions ouvertes en base puis FERMÉES. Constaté :
- « garantie » : liens `#art-4` (loi banques), `#art-12` (décret), `#art-507` (Code civil) ;
  extraits « Article N — … » ; « PDF ↗ » en nouvel onglet, servi `200 application/pdf` inline ;
- fiche du Code civil ouverte sur l'article 507, occurrence encadrée, « Occurrence 3 sur 120 »
  (les deux premières sont dans des replis ouverts d'office plus haut), `n` → 4 sur 120 ;
- « moniteur mars 2003 » : le fascicule scanné n'a que « PDF ↗ », en bouton principal ;
- compte SANS droit PDF : seul le PDF de la circulaire BRH reste proposé ; la route répond 403
  pour le décret (garde serveur inchangée) ;
- créole : « Okirans 1 sou 4 » sur l'arrêt ; téléphone 375 px : aucun débordement.
Limite constatée : l'extrait (fenêtre de 240 caractères de `makeSnippet`) peut commencer par la
fin de l'article PRÉCÉDENT (« Article 241 — … résenter.- C. p. c., 261 et s. Article 241 … »).
Libellés créoles NOUVEAUX à valider : « Li tèks la », « Louvri PDF orijinal la (nouvo onglè) »,
« Okirans {i} sou {n} », « Okirans anvan an », « Okirans apre a », « Kache navigasyon an »,
« Mo a pa parèt nan tèks ki afiche a (tit, rezime oswa orijinal la sèlman). », « Okirans mo yo chèche a ».


### Incident du 24 oct. 2026 — déployé (`ec0dd51`), annulé (`8704037`), corrigé

- 12 h 00 : après le déploiement, `/fr/search?q=garantie` → « Une erreur est survenue »
  (réf. 98980361 : `P2024`, délai d'attente d'une connexion, `connection_limit=1`) ; second essai
  en 20,6 s. Code annulé et redéployé aussitôt (`8704037`, la note reste).
- **L'erreur `P2024` n'est PAS née du lot A** : journaux Vercel sur 7 jours, 40 fois avant —
  `/fr/search` les 20 oct. (×3) et 23 oct., `/api/search/suggest` 32 fois, le battement de
  session 2 fois. Cause : UNE connexion par instance, partagée par les requêtes simultanées
  (frappe dans la recherche → autocomplétion), délai de 10 s. Remède proposé : relever
  `connection_limit` (et `pool_timeout`) dans `DATABASE_URL` sur Vercel — décision de Me Vaval.
- **Mais la relecture a trouvé un vrai défaut du lot A** : `localiserOccurrence` bouclait SANS FIN
  quand le corps commence par un saut de ligne et qu'aucun en-tête ne précède l'occurrence
  (`lastIndexOf('\n', -1)` relit la position 0). Un document de production est dans ce cas (une
  loi de finances). Reproduit (processus tué après 20 s), corrigé, testé (4 cas).
- Allégé en même temps : sans terme cherché (navigation d'une rubrique), les corps ne sont plus
  chargés que pour les résultats sans extrait (comme avant le lot A) ; la disponibilité du texte
  se lit par `octet_length` (taille dans l'en-tête TOAST, sans décompression) et non `length`.
- Mesures depuis le poste, lecture seule (bruitées) : corps des 20 résultats de « garantie »
  1,5 Mo en 0,4 s ; requête des versions 0,3 s ; la recherche elle-même 6 à 13 s depuis le poste.
