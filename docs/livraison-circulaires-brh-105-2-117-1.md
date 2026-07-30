# Livraison — Circulaires BRH n° 105-2 et n° 117-1

**30 juillet 2026 · commit `35afcf4` · déploiement Vercel READY**

Deux circulaires de la Banque de la République d'Haïti ajoutées à la section
**Circulaires BRH**, au format **lecteur annoté**, avec la **chaîne d'abrogation**
portée sur les textes qu'elles remplacent.

---

## 1. Ce qui est en ligne

| | Circulaire n° 105-2 | Circulaire n° 117-1 |
|---|---|---|
| Objet | Transmission au BIC des informations sur les crédits octroyés | Pratiques de gouvernance |
| Signature | 15 septembre 2025 | 20 novembre 2025 |
| Entrée en vigueur | 15 octobre 2025 | 5 janvier 2026 |
| Identifiant | `cms7lgd8l0000wtgzu7y3j8mt` | `cms7lggvs0001wtgzvw937xyt` |
| Source | `CIRC_BRH_105_2` | `CIRC_BRH_117_1` |
| Divisions | 12 points + 9.1 à 9.5 = **17** | **20** sur 3 niveaux |
| Sections d'annexe | **25** | — |
| Index | **99 sujets** | **108 sujets** |
| Tableaux | **20** (910 rangées) | — |
| Texte | 61 784 car. | 25 801 car. |
| Fac-similé | 48 p. · 10,8 Mo | 10 p. · 2,2 Mo |

Signataire des deux textes : **Ronald Gabriel, Gouverneur**.

La section compte désormais **142 circulaires**, dont **9 abrogées**.

---

## 2. La chaîne d'abrogation

Chaque texte abrogé porte le **numéro de la circulaire postérieure qui l'abroge**. Le
bandeau de la fiche résout la cible par numéro : les trois liens sont vivants.

| Texte abrogé | Abrogé par | Fondement |
|---|---|---|
| n° 105 (28 nov. 2013) | **n° 105-1** | point 8 de la 105-1 : « La présente circulaire abroge la circulaire 105 en date du 28 novembre 2013 » |
| n° 105-1 (3 avr. 2017) | **n° 105-2** | point 12 de la 105-2 |
| n° 117 (5 oct. 2020) | **n° 117-1** | point 10 de la 117-1 : « Les dispositions de la présente circulaire remplacent celles de la circulaire 117 » |

⚠️ **La première ligne corrige un défaut préexistant** : la circulaire 105 figurait encore
« en vigueur » alors que la 105-1 l'abroge expressément depuis 2017. Le défaut n'était pas
visible tant que la chaîne s'arrêtait là ; il l'est devenu en ajoutant le troisième maillon.

---

## 3. Ce qu'il a fallu construire

Aucune des 140 circulaires existantes n'avait le lecteur annoté. L'obstacle n'était pas
éditorial mais structurel : **une circulaire ne numérote pas en « Article N »**, mais en
« 1.- » (105-2) ou « 4.2.1 » (117-1). Le moteur d'ancrage, qui exige le mot *article*,
*art.* ou *section* en tête de ligne, ne voyait donc rien — ni sommaire, ni index, ni
renvoi interne.

### `pointAnchors` — une liste blanche, document par document

Un champ facultatif des annotations déclare les désignations qui **tiennent lieu
d'articles** dans ce document précis. Pourquoi une liste blanche plutôt qu'une règle
générale : les annexes de la 105-2 reprennent les mêmes formes numériques sans être des
divisions — « 2 segments par enregistrement : », « 1. INTRODUCTION ». Une règle générale
aurait fabriqué des ancres parasites et des cartes d'article fantômes.

**Sans ce champ, la segmentation est strictement inchangée** : les 29 000 autres documents
ne voient pas la différence. Quatre tests le verrouillent
([annotated.test.ts](lam-veritab/src/lib/legislation/annotated.test.ts)), dont celui de la
désignation répétée en annexe.

### Deux corrections de la grammaire des renvois

La grammaire quitte `OfficialText.tsx` pour
[src/lib/doc/artrefs.ts](lam-veritab/src/lib/doc/artrefs.ts) — vitest ne parse pas le JSX,
elle n'était donc pas testable. Sept tests l'accompagnent.

1. **Le suffixe de numéro devient répétable.** « 4.2.1 » se lisait « 4.2 » suivi d'un
   « .1 » orphelin : le lien pointait vers la mauvaise division. Le défaut ne concernait
   pas que les circulaires — « article 31.1.1 » de la **Constitution** était dans le même
   cas. La répétition ne peut qu'étendre une capture ; le garde anti-lien-mort décide seul
   de la transformation en lien.
2. **« la section 7 » devient un renvoi interne** — mais pour les seuls documents qui
   l'activent. Ailleurs, « section 3 » désigne une division du plan, pas l'article 3 : en
   faire un lien partout aurait fabriqué des centaines de faux renvois.

---

## 4. Deux pièges rencontrés

**Les en-têtes courants du scan.** Le corps de la 105-2 contient **7 fois** la ligne
« ANNEXE 3 » : une vraie, six répétées en tête de page par le scan. Elles sont retirées de
la version d'affichage et **conservées dans le texte officiel** (§ 02). Conséquence non
évidente : `richBlocksJson` s'applique au texte *affiché*, pas au texte officiel — six
tableaux ancrés sur « ANNEXE 3 » se retrouvaient orphelins et leurs 588 rangées aplaties
restaient dupliquées à l'écran. Les ancres sont désormais calculées sur le texte affiché.

**Le filtre de longueur.** Le libellé « 4.2. Caractéristiques et responsabilités en matière
de gouvernance du conseil d'administration » fait 94 caractères. C'est exactement ainsi que
le TITRE IV de l'Enregistrement avait disparu lors de la phase 2 fiscale. Les deux parseurs
détectent les têtes **en consommant le plan attendu dans l'ordre** — aucune heuristique de
longueur ni de ponctuation.

---

## 5. Fidélité au texte officiel

- Les montants (100 000 / 150 000 / 50 000 / 75 000 / 25 000 / 200 000 / 2 500 gourdes),
  les délais et les nomenclatures des annexes (codes IHSI, ISO, postaux, professions) sont
  repris **tels quels**.
- La 117-1 annonce un « **quadruple** devoir de loyauté, de diligence, de vigilance et de
  conformité, de prudence et d'indépendance » : le décompte est **exact**, le texte
  développant bien quatre obligations dont deux sont doubles. Une première version de cette
  livraison publiait une note y voyant une incohérence — note **fausse, retirée**.
- Le point 4.2.1 n'a pas de point final là où 4.2.2. en a un : ponctuation reprise verbatim.

## 6. Renvois croisés posés

**105-2** → loi bancaire du 14 mai 2012 (art. 87 et 179) · décret IMF du 5 juin 2020
(art. 69) · circulaire 105-1 abrogée.
**117-1** → loi bancaire de 2012 (art. 23, 27, 28, 33 à 41, 83, 161) · décret IMF
(art. 20 à 31, 34, 37) · circulaire **89-3** (normes minimales de contrôle interne) ·
circulaires **129** et **129-1** (LBC/FT) · circulaire 117 remplacée.

Toutes les ancres visées ont été vérifiées présentes dans les documents cibles.

**Deux textes visés au chapeau manquent au corpus** — mentionnés sans lien :
- la **loi du 26 juin 2002** sur les coopératives d'épargne et de crédit (art. 12) ;
- le **décret du 25 novembre 2020** sur les intermédiaires de change (art. 18 à 21 et 42).

## 7. Durabilité

`import-brh.ts` purge la source `BRH` puis rejoue `brh-enrichments.json`. Les deux
circulaires ont leur propre source : elles échappent à la purge. Mais **les trois
abrogations, elles, auraient été effacées** au prochain ré-import — les statuts sont donc
inscrits dans le fichier de durabilité, avec les deux circulaires en supplément (schéma
étendu aux champs `source`, `annotationsJson` et `effective`).

Contrôlé : aucun enrichissement existant perdu (html 4 → 4, statuts 5 → 8).

## 8. Vérifications passées

- Sommaire apparié 25/25 (105-2) · divisions ancrées 17/17 et 20/20 · aucun id dupliqué ·
  **texte restitué intégralement** (comparaison octet à octet après segmentation).
- Index : 0 renvoi mort, couverture 100 % des divisions et des annexes, aucun doublon.
- Tableaux : 20/20 placés, **0 orphelin, 0 rangée dupliquée**.
- Chaque division emprunte bien le rendu « carte d'article » — donc porte son ancre.
- 27 tests unitaires (13 nouveaux), `tsc --noEmit` et `npm run build` au vert.
