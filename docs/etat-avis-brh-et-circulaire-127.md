# Avis aux agents de change (14 déc. 2020) et Circulaire BRH n° 127 — état des travaux

> Rien n'a été écrit en base. Ce document dit ce qui est prêt, ce qui est établi, et ce qui
> attend un arbitrage.

## 1. L'Avis et les Lignes directrices — le texte qui bloquait

**C'est bien la pièce manquante.** Elle referme la réserve chronologique posée le 14 août : un
texte du 14 décembre ne pouvait pas figurer dans un *Moniteur* du 30 novembre. L'Avis le dit
lui-même — il invite les agents de change « à consulter son site internet (www.brh.ht) ». La
provenance est donc le site de la Banque.

Sa structure recoupe exactement les entrées d'index restées orphelines : six points, deux
sous-points (2.1 constitution du dossier, 2.2 traitement), cinq annexes, et jusqu'à la rubrique
« Annexe 1, II.8 » que l'index cite nommément.

Trois données se confirment sur le texte : capital minimum de **quinze millions de gourdes**
« conformément à l'article 22 du décret » ; délai de mise en conformité « allant jusqu'au
**30 juin 2021** » ; seuil d'actionnariat de **plus de 10 %**. Ce dernier établit que la
circulaire n° 127, qui retient 5 %, est un texte distinct et non une reprise.

Et le rattachement est plus fort qu'annoncé : les Lignes directrices se déclarent prises
« **en application de l'article 56** du décret du 25 novembre 2020 ». Le renvoi n'est pas
implicite, il est nommé.

### Ce qui est construit

Un jeu de données de téléversement (`source.json`, 230 lignes de corps, 23 entrées de sommaire,
8 ancres de point, 12 entrées d'index) pour **un seul document** réunissant l'Avis, les Lignes
directrices et les cinq annexes — ils ont paru ensemble et l'index les traite ensemble.

Les 14 pages du fac-similé ont été lues **en image**, pas en couche texte. 36 écarts relevés
entre le `.docx` et l'imprimé, dont un grave : le `.docx` écrit « apposer **sa** signature » là
où l'imprimé porte « apposer **leur** signature ». Partout, l'imprimé fait foi et a été suivi —
contrôlé personnellement sur la page 7, qui écrit « 2- PRESENTATION DE LA SOCIETE REQUERANTE »
en capitales sans accents, quand le `.docx` avait normalisé en bas de casse accentué.

### Deux découvertes de structure, qui commandent la forme

**Une ligne inscrite au sommaire ne peut pas recevoir d'ancre d'article.** Dans
`annotated.ts:240-248`, la branche du sommaire fait `continue` avant d'atteindre `pointAnchors`.
Les six points sont donc portés par `pointAnchors` (l'index en a besoin) et remontés au menu
latéral, comme sur la circulaire 105-2.

**Les huit rubriques de l'Annexe 1 partie II ne peuvent pas être des ancres de point.** La liste
des désignations est plate et seule la première occurrence est ancrée : 1 à 6 sont consommées par
les six points, 7 et 8 par les items 7 et 8 de l'Annexe 1 partie I. Déclarer « 8 » aurait fait
pointer le renvoi « Annexe 1, II.8 » sur un descriptif de systèmes d'information. Ces rubriques
passent donc par le sommaire.

### Un défaut à corriger avant écriture

La première ligne du corps a été mise en capitales, « BANQUE DE LA RÉPUBLIQUE D'HAÏTI », sur la
foi d'une observation **inventée** — vérification faite sur l'image, la page 1 porte « Banque de
la République d'Haïti » en bas de casse dans un en-tête à logo. C'est la page 2 qui est amputée
de « d'Haïti ». À rétablir.

## 2. Circulaire n° 127 — réparation du corps

Le corps en base (55 421 caractères) a été construit sur la couche OCR du PDF, qui est fautive :
« ANNEXEI », « LEITRE », « Pièœs », « dépurlemenl », « tenne » pour « terme », « ANNEXE Ill »
pour III. Votre `.docx` corrige tout cela.

Plan établi : **514 corrections** — 140 de ponctuation, 67 de texte restitué, 115 de lettres et
chiffres confondus, 48 de mots soudés, 45 de caractères parasites, 2 de numéros d'annexe romains.
Douze pertes du `.docx` recensées, dont sept réparées : la plus notable est la **signature du
Gouverneur, absente de la base** et présente au scan.

Aucun contenu ne se perd : les 124 fragments présents en base et absents du `.docx` ont été relus
un à un — tous sont des scories d'OCR.

### Deux défauts du plan, à corriger avant écriture

**Les vingt-cinq cases à cocher se détachent de leur libellé.** Au fac-similé, c'est un tableau à
deux colonnes ; la base garde « Banque ⇥ 0 » sur une ligne ; le plan produit « Banque » puis
« ☐ » sur deux lignes. La réparation gagnerait les caractères et perdrait l'appariement.

**Le décompte de caractères annoncé est faux** : « −1 020 de pagination, +593 de contenu » ne se
reproduit pas à la mesure (−1 447 puis +1 020). L'erreur est dans le rapport, pas dans le texte.

## 3. Ce qui attend votre arbitrage

**Bloquant — à trancher avant toute écriture**

1. **Rapport entre les Lignes directrices et la circulaire n° 127.** Même sujet, même signataire,
   treize mois d'écart. La 127 ne porte **aucune clause d'abrogation** — vérifié sur ses 644
   paragraphes — et ne s'adresse pas au même public : les Lignes directrices visent les agents de
   change en voie de devenir bureaux de change, la 127 toutes les institutions financières. Les
   seuils diffèrent (10 % contre 5 %). Faut-il publier les Lignes directrices « en vigueur », ou
   avec une note disant qu'elles sont, sur l'agrément des bureaux de change, doublées par la 127 ?
2. **Les notes de bas de page de la circulaire 127** — treize appels, treize notes. Les laisser
   dans le corps, comme aujourd'hui, ou les porter en annotations ancrées sur les appels ? Le
   choix doit être fait avant l'écriture, parce que le corps est apparié au sommaire dans l'ordre.
3. **Fidélité au texte imprimé, deux cas.** Le `.docx` normalise silencieusement : l'imprimé et la
   base portent « règlement à d'amiable », le `.docx` écrit « à l'amiable » ; l'imprimé écrit
   « Haiti » sans tréma, le `.docx` met « Haïti ». La règle de la maison est que l'imprimé fait
   foi. Faut-il l'appliquer ici, avec un `[sic]` ?

**Souhaitable**

4. **Les tableaux restent à plat**, dans les deux documents. Le `.docx` a supprimé les cellules
   vides : neuf tableaux de la circulaire 127 ne sont plus reconstituables par comptage, et celui
   du capital social ne l'est pas du tout. Soit on les rebâtit à la main d'après les scans, soit
   on accepte la liste à plat. C'est le vrai reste à faire.
5. **Type et numéro de l'Avis.** Le texte n'est pas numéroté. Le classer en `CIRCULAIRE_BRH` le
   met dans la bonne section mais le nomme mal.
6. **Dix-sept divisions de l'Avis ne sont visées par aucune entrée d'index** — l'index du
   *Moniteur* ne couvre que la moitié du texte. Enrichir l'index, ou assouplir le garde-fou.

## 4. Ce qui suit, une fois ces points tranchés

Les scripts d'import et de réparation, en simulation d'abord ; puis la troisième partie de
l'index du *Moniteur* n° 41 cesse d'être orpheline, l'article 56 du décret mène à son texte
d'application, et le chantier du change et des transferts n'a plus de pièce manquante.
