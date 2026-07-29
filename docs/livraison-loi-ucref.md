# Livraison — Loi UCREF (2017)

**Loi portant organisation et fonctionnement de l'Unité Centrale de Renseignements
Financiers (UCREF)** — votée par la Chambre des Députés le 4 mai 2017, par le Sénat
le 8 mai 2017, promulguée le 12 mai 2017, publiée au **Moniteur, 172ᵉ Année,
Spécial N° 16 du 25 mai 2017**.

**Emplacement** : Législation annotée → Droit économique & des affaires → **Banques
& institutions financières** (`droit-bancaire`, 23ᵉ document).
Doc prod `cms5hgrnl0000h5t2ihfy2d37` · `source = LOI_UCREF_2017` · prompt d'autorité
`docs/prompt-loi-ucref-2017.md`.

## a) Contenu

- **32 articles** (1 à 32, sans trou), **10 en-têtes** : 4 CHAPITRES et 6 Sections ;
- corps complet : titre, 13 visas, considérants, formule de vote, les 32 articles,
  les **formules d'adoption** (Chambre 4 mai + signatures, Sénat 8 mai + signatures)
  et la **promulgation** (12 mai, Jovenel Moïse) ;
- **index de 123 entrées**, couverture 32/32, zéro renvoi mort — combinaison de deux
  apparats : les 93 entrées de l'index alphabétique fourni (dont 39 avec sous-items
  lettrés et 7 plages développées, ex. « Art. 5 à 12 » → 8 renvois) et les
  **32 descriptions d'articles du sommaire analytique** (une par article).

## b) Nommage — trois dates, une décision

| Source | Nom employé |
|---|---|
| Sommaire et index fournis | « Loi du **4 mai** 2017 » (vote de la Chambre) |
| Décret IMF 2020, visa (texte officiel en ligne) | « Loi du **8 mai** 2017 » (vote du Sénat) |
| Index du Moniteur (en base) | sans date, publication au 25 mai 2017 |

`number = "Loi du 8 mai 2017"` — citation officielle retenue par le Décret IMF et
conforme au précédent de la plateforme (Loi banques 2012 = date du second vote). Les
quatre dates figurent dans le résumé, les mots-clés et la note de tête : toute forme
de citation reste trouvable par la recherche. **La date de publication (25 mai 2017)
a été confirmée indépendamment par l'Index du Moniteur déjà en base.**

## c) Renvois croisés

1. **Inline** « article N » cliquables ; le renvoi externe de l'art. 24 (« l'article
   323 du code pénal ») reste en texte — vérifié, y compris en minuscules ;
2. **index latéral + rebonds** sous chaque article ;
3. **Textes visés au préambule** → 3 liens vers des textes en ligne (Constitution,
   Code pénal, Loi du 17 août 1979 créant la BRH) ;
4. **Lien RÉCIPROQUE** : le Décret IMF 2020 citait cette loi comme « absente de la
   plateforme ». Sa table des textes cités pointe désormais vers elle (11 liens) —
   la boucle promise est fermée.

## d) Transparence sur les apparats

Le sommaire et l'index portent chacun la mention « **reconstitué par l'éditeur** ; il
ne figure pas dans le texte officiel publié au Moniteur ». La note de tête du document
le dit aux lecteurs : seuls les 32 articles et les formules sont du Journal officiel.

## e) Un bug latent trouvé et corrigé (portée générale)

En traitant ce texte j'ai découvert un **défaut de mes extracteurs docx** : je
remplaçais `<w:tab/>` par une espace *dans le XML*, entre deux balises `<w:t>` — or
l'extraction ne conserve que le **contenu** des `<w:t>`, si bien que l'espace était
jetée et les colonnes du Journal officiel se retrouvaient collées
(`LIBERTÉÉGALITÉFRATERNITÉ`, `Jean Willer JEANHermano EXINORD`). Corrigé en
injectant un véritable élément texte.

**Audit du corpus déjà en ligne** : trois documents présentaient ce risque (Décret
IMF 251 paragraphes, Loi banques 320, Statut du commerçant 131). Vérification faite —
**aucun dégât** : dans ces textes la tabulation ne séparait que la tête d'article ou
le marqueur d'énumération de son texte, cas que mes parseurs normalisaient
explicitement. Zéro artefact de collage détecté ; les trois écarts relevés à la
comparaison sont des normalisations déclarées (« Article 1ᵉʳ » → « 1er ») ou une
exclusion volontaire documentée (bandeau du Moniteur de la Loi banques).

## f) Vérifications (trois lentilles, boucle principale)

Le contre-audit multi-agents restant indisponible (limite mensuelle), les trois
lentilles ont été conduites directement :

- **Fidélité** — ré-extraction **indépendante** (ElementTree) : **zéro ligne perdue**,
  et les 4 seules lignes ajoutées sont les jointures de CHAPITRE voulues ;
- **Index** — reconstruction par une **seconde implémentation** : **123/123 entrées
  identiques**, mêmes renvois. Ce contrôle a d'ailleurs révélé un défaut de forme
  réel (suffixes de sous-items mal parenthésés, « (i), j), k) ») **corrigé** avant
  livraison — le format est désormais « (i, j, k) » ;
- **Plateforme** — 10 sections, 32 ancres, 9 articles rendus en listes, **zéro
  problème de rendu**, thème principal correct, recherche opérationnelle
  (« blanchiment », « UCREF »), réciprocité IMF → UCREF vérifiée ;
- `typecheck` ✓ · `lint` ✓ · `test` 14/14 ✓ · `build` ✓.

## g) Réserves

- **Aucun fac-similé** fourni pour cette loi : la fidélité n'a pu être vérifiée que
  docx ↔ produit. Le scan du Spécial N° 16 permettrait un contrôle complet, comme
  pour le Décret IMF.
- **Dix textes visés au préambule** restent absents du corpus : lois sur le
  blanchiment (21 février 2001 et 11 novembre 2013), drogue (7 août 2001), CSCCA
  (2005), administration centrale et fonction publique (2005), marchés publics
  (2009), décrets de 1984, 1985 et 1987. La **loi du 11 novembre 2013** est la pièce
  maîtresse du dispositif LBC/FT : c'est le prochain texte à acquérir en priorité.
- Divergence de nommage « 4 mai » / « 8 mai » — arbitrage §b, à confirmer.
