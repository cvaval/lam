# Livraison — Décret sur les Institutions de Microfinance (IMF), 2020

**Document** : Décret portant organisation et fonctionnement des Institutions de
Microfinance (IMF), donné au Palais National le **5 juin 2020**, publié au
**Moniteur, Spécial N° 24 du 25 août 2020**, signé Jovenel Moïse.

**Emplacement** : Législation annotée → Droit économique & des affaires →
**Banques & institutions financières** (`droit-bancaire`), aux côtés de la Loi du
14 mai 2012 sur les banques et de la série bancaire Vandal (22 documents).

Doc prod `cms5d6tp200002695mv8c5bdb` · `source = DECRET_IMF_2020` · exécution du
prompt d'autorité `docs/prompt-decret-imf-2020.md`.

## a) Contenu

- **80 articles**, numérotés 1 à 81 — **l'article 13 n'existe pas au Journal
  officiel** (§b) ; **32 en-têtes** : 5 TITRES, 18 CHAPITRES, 9 Sections ;
- corps complet : masthead, page de garde, 17 visas, 7 considérants, « DÉCRÈTE »,
  les 80 articles et les 20 lignes de signature (Président, Premier Ministre et
  18 ministres) ;
- **index alphabétique client : 224 entrées** (105 sujets, 134 sous-entrées,
  20 lettres), **couverture intégrale 80/80**, zéro renvoi mort ;
- **sommaire** : celui que nous avons corrigé le 28 juillet (folios du Journal
  officiel vérifiés page à page) sert d'autorité de structure.

## b) L'article 13 — lacune du Journal officiel (vérifiée)

Le décret ne comporte pas d'article 13 : la numérotation passe de l'article 12 à
l'article 14. **Vérifié sur le fac-similé (p. 8, lecture en image)** et confirmé par
le balayage des 24 pages : 80 têtes d'articles, exactement 1 à 81 sans le 13, en
ordre strictement croissant. La lacune est donc celle du texte publié, non de la
transcription — l'inverse du Décret minier, où l'article 27 « absent » selon les
documents clients était en réalité imprimé « Articles 27.- ».

Une note en tête du chapitre concerné l'énonce comme un fait, avec sa référence.
Aucun lien mort possible : l'article 13 n'ayant pas d'ancre, les renvois inline ne
peuvent pas y pointer.

## c) Renvois croisés — les quatre niveaux (comme au Code civil)

1. **Renvois inline** « article N » cliquables dans tout le texte (~85 renvois
   internes) ; les renvois externes restent en texte (§e) ;
2. **index latéral + rebonds** sous chaque article (sujets connexes cliquables) ;
3. **Table des textes cités** — absente des fichiers fournis (annoncée p. 31 du
   sommaire), **reconstituée depuis les visas** et affichée en tête : 10 liens vers
   des textes déjà en ligne (Constitution, Code civil, Code de commerce, sociétés
   anonymes 1955 et 1960, assurances 1956, BRH 1979, taux d'intérêt 1995, impôt sur
   le revenu 2005, banques 2012) ;
4. **Mesures d'application sous l'article 80** : les **trois circulaires
   BRH/IMF/2026** (risque de crédit, liquidité, fonds propres) sont rattachées en
   encadrés cliquables — l'article 80 charge précisément la BRH d'édicter ces
   mesures.

## d) Fac-similé attaché

Le PDF du Moniteur Spécial N° 24 (24 pages, 2,1 Mo) est déposé sur le Blob privé et
`sourcePdfUrl` est renseigné : **premier texte de la Législation annotée consultable
en regard de son fac-similé** (route authentifiée `/api/doc/[id]/pdf`).

## e) Uniformisation du format (demande cliente)

Deux corrections du moteur de rendu, qui profitent à **tout le corpus** :

1. **`NUMBER_RE` accepte « N°) »** (chiffre + degré + parenthèse). Ce motif était
   jusqu'ici non reconnu : les alinéas se recousaient au paragraphe précédent.
   Effet mesuré : **842 lignes dans 37 documents existants** (Code de commerce 164,
   Code pénal 40, série Vandal, Moniteurs scannés…) se rendent désormais en listes
   numérotées, comme les autres énumérations de la plateforme. Sondage de 3 documents
   : toutes de véritables énumérations, aucun faux positif ; les formes existantes
   (« 1. », « a) », « i. ») ne régressent pas ; un « N°) » en milieu de phrase n'est
   pas capté.
2. **Garde des renvois externes élargi à tous les codes.** Le garde ne couvrait que
   « du Code d… » et laissait « **article 323 du Code pénal** » devenir un lien
   interne — défaut trouvé pendant la vérification. Il couvre désormais toute
   dénomination (`code\s+\S`) : **37 renvois externes du corpus** (Code civil, pénal,
   rural, douanier) sont protégés. 10 cas de non-régression testés.

## f) Vérifications (exécutées dans la boucle principale)

Le contre-audit multi-agents a été interrompu par la limite mensuelle ; les trois
lentilles ont donc été conduites directement, avec les mêmes exigences :

- **Fidélité** : ré-extraction **indépendante** du docx (ElementTree, distinct du
  parseur) → **zéro ligne perdue**, et **zéro ligne inventée** (23 écarts = exactement
  les 23 en-têtes joints « — ») ; les 2 notes du transcripteur sont hors corps mais
  reversées (lacune art. 13 → note de tête ; structure de l'art. 35 → annotation
  repliable sous l'article) ;
- **Index** : reconstruction **indépendante** (seconde implémentation) → **224/224
  entrées identiques**, ctRefs identiques, couverture 80/80, et les **4 nombres
  piégeux** des libellés (« (90 jours) », « (1/1000) », « (article 323) »,
  « (délai de 48 heures) ») correctement exclus des renvois ;
- **Rendu** : 80 articles → unités `parseOfficialText`, **aucune ligne perdue** ;
  23 articles rendent des listes ; l'article 2 (définitions) rend ses 23 alinéas ;
- **Base** : 32 sections, 80 ancres, 9 Sections bien reconnues comme sections (pas
  d'ancre `art-1` parasite), aucune ancre `art-13`, note de l'art. 35 clé sur
  `sec-16|art-35`, thème `droit-bancaire` principal, `sourcePdfUrl` renseigné,
  13 liens (10 textes cités + 3 circulaires) résolus vers des documents existants ;
- `typecheck` ✓ · `lint` ✓ · `test` 14/14 ✓ · `build` ✓.

## g) Réserves

- **Table des textes cités** : reconstituée des visas ; 5 textes visés ne sont pas
  encore sur la plateforme (blanchiment 2001 et 2013, UCREF 2017, TCA 2002, gage
  sans dépossession 2008) — candidats d'acquisition, cités en texte sans lien.
- **Numérotation des chapitres** : le Journal officiel alterne romain (« CHAPITRE I »
  aux Titres I et II) et arabe ; la transcription et le sommaire uniformisent en
  arabe. Le corps publié suit la transcription (condition de l'appariement du
  sommaire). À rebasculer sur le *sic* du J.O. si la cliente le souhaite.
- **Contre-audit automatisé** non rejoué (limite mensuelle atteinte) : à relancer
  au prochain cycle si l'on veut une troisième paire d'yeux indépendante.
