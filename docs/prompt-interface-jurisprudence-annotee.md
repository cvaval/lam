# Prompt — L'interface de la jurisprudence annotée : le sommaire avant le texte

## Ce qui est demandé

Sur la fiche d'une décision, faire apparaître le **sommaire analytique AVANT le texte
intégral de l'arrêt**, avec ses rubriques :

**domaine du droit · résumé éditorial · question de droit · règle de droit · solution et motifs**

et la **composition de la formation** — les magistrats qui ont rendu la décision.

---

## §1 — L'état des lieux, mesuré

Le corpus est versé et les colonnes existent. Ce prompt ne porte que sur **l'affichage**.

| | |
| --- | --- |
| Corpus | **80 décisions** — Première Section 33, Deuxième Section 47 — exercice 1964-1965 |
| Texte intégral | **80 / 80**, 544 408 caractères |
| Fiche de lecture | `src/components/JurisprudenceHeader.tsx`, rendu à la ligne 373 de `src/app/[locale]/(app)/doc/[id]/page.tsx` |
| Texte de l'arrêt | rendu plus bas, sous « Texte officiel » (lignes 520 et 558) |
| Résumé éditorial | bloc « Résumé éditorial » à la ligne 486, **entre les deux** |

**Taux de remplissage réel** — c'est lui qui commande le comportement de l'interface :

| Rubrique | Champ | Rempli | Longueur moyenne |
| --- | --- | --- | --- |
| Domaine du droit | `matiere` | **80/80** | 254 c. |
| Juridiction, date | `juridiction`, `publicationDate` | **80/80** | — |
| Règle de droit | `regleDroit` | **80/80** | 660 c. |
| Question de droit | `questionDroit` | **80/80** | 393 c. |
| Solution et motifs | `motifs` | **80/80** | 517 c. |
| Décision attaquée | `decisionAttaquee` | 67/80 | 159 c. |
| Résumé éditorial | `summaryFr` | 61/80 | 608 c. |
| Dispositif | `dispositif` | 29/80 | 74 c. |
| Issue codée | `solution` | 28/80 | — |
| Composition | *(aucun champ)* | **0/80** | — |

> ⚠️ **LES QUATRE RUBRIQUES D'ANALYSE SONT DÉSORMAIS COMPLÈTES — 80/80.** Mais le résumé
> éditorial n'est là que 61 fois, la décision attaquée 67, le dispositif 29 et l'issue codée
> 28. Une maquette dessinée sur une fiche complète laisserait donc encore des trous.
> **L'interface se conçoit à partir de la fiche la plus pauvre**, pas de la plus riche.

Voici une fiche complète, telle qu'elle est en base (Deuxième Section n° 21) :

```
Domaine du droit   Procédure civile (désistement d'instance — art. 399 C.P.C. ; effets
                   du désistement sur le pourvoi).
Règle de droit     Art. 399 C.P.C. : le désistement, régulièrement signifié et ne
                   préjudiciant pas aux droits du défendeur, emporte extinction de
                   l'instance et dessaisit la juridiction.
Question de droit  Le désistement d'instance régulièrement signifié par les pourvoyants
                   éteint-il l'instance en cassation ?
Solution et motifs Oui. La Cour donne acte du désistement régulièrement signifié
                   conformément à l'art. 399 C.P.C. et rejette en conséquence le pourvoi…
Dispositif         Rejet du pourvoi.
```

Le corps de cet arrêt fait 3 586 caractères ; le plus long du corpus en fait 33 798.

---

## §2 — L'ordre de lecture

Aujourd'hui, l'ordre est : en-tête → mots-clés → **résumé éditorial** → texte officiel.
Le sommaire n'existe pas, et le résumé se lit après les métadonnées mais avant le texte.

L'ordre demandé :

1. **Titre, juridiction, section, date** (existant)
2. **Sommaire** — le bloc à créer, **cinq rubriques dans cet ordre** :
   domaine du droit · **résumé éditorial** · question de droit · règle de droit ·
   solution et motifs
3. **Composition** — la formation de jugement
4. **Décision attaquée · Dispositif** (existant, aujourd'hui dans `JurisprudenceHeader`)
5. **Texte intégral de l'arrêt**
6. Notes des lecteurs (existant)

**Ordre validé par la rédaction** : question avant règle, et les deux avant les motifs —
l'ordre du raisonnement, qui est celui de la lecture : ce qui était à trancher, la règle
qui le tranche, puis pourquoi. Les recueils écrivent « Règle de droit » en premier ; c'est
un ordre de rédaction, pas de consultation.

**Le résumé éditorial est la CINQUIÈME rubrique du sommaire**, décision de la rédaction —
il ne fait plus bloc à part. Le sommaire analytique de la Première Section n° 2 à 16 le
range d'ailleurs lui-même parmi ses rubriques : « Domaine du droit · Résumé éditorial ·
Décision attaquée · Règle de droit, Question, Motifs · Dispositif ».

> ⚠️ **LE RÉSUMÉ DEVIENT UNE RUBRIQUE, PAS UNE COLONNE DE PLUS.** Il reste stocké dans
> `summaryFr` ; seul son emplacement à l'écran change. Le bloc « Résumé éditorial » actuel
> (ligne 486 de la page) disparaît au profit d'une ligne du `<dl>` — sans quoi il
> s'afficherait deux fois.

> ⚠️ **LE SOMMAIRE N'EST PAS LE TEXTE.** Ce bloc est de la rédaction ; l'arrêt est la
> parole de la Cour. Ils ne doivent pas se lire d'un même œil : le sommaire en fonte
> d'interface, le texte en serif, comme le fait déjà la note de la rédaction. Un lecteur
> qui prendrait une règle de droit rédigée par Lam pour un attendu de la Cour serait induit
> en erreur sur ce qui fait autorité.

---

## §3 — Le bloc « Sommaire »

Un `<dl>`, comme le bloc décision attaquée / dispositif existant, avec un intitulé de
section. Chaque rubrique sur sa ligne, l'étiquette en petites capitales monospacées.

**Rien de ce qui est vide ne s'affiche.** Pas d'étiquette orpheline, pas de « non
renseigné », pas de tiret. Les quatre rubriques d'analyse sont complètes, mais 19 décisions
n'ont pas de résumé éditorial et 51 pas de dispositif : leurs lignes ne s'affichent pas. Et
si aucune rubrique n'était renseignée, **il n'y aurait pas de bloc du tout**.

> ⚠️ **UN BLOC « SOMMAIRE » VIDE EST PIRE QUE PAS DE BLOC.** Il annonce une analyse qui
> n'existe pas et fait douter le lecteur de ce qu'il ne voit pas.

Longueurs à prévoir : la règle de droit fait 660 caractères en moyenne, les motifs 517 —
ce sont des paragraphes, pas des libellés. Le bloc doit rester lisible à ces longueurs sans
troncature ni « voir plus » : un juriste lit la règle en entier ou ne la lit pas.

---

## §4 — La composition

Une ligne « Composition », après le sommaire, listant les magistrats séparés par des points
médians, avec la qualité entre parenthèses quand elle est connue :

> **Composition** — Luc BOIVERT (président) · Ludovic MAGLOIRE · Louis B. VILGRAIN ·
> Ulrick Is. NOEL · Louis BANATTE
> **Ministère public** — Arsène AMISIAL, substitut du commissaire du gouvernement

Le ministère public et le greffe **sur une ligne distincte** : ils ne sont pas membres de
la formation, et les aligner avec les juges donnerait à lire une composition fausse.

> ⚠️ **AUCUN CHAMP N'EXISTE ENCORE.** La composition demande le modèle décrit dans
> `docs/prompt-juges-jurisprudence.md` (§2 : `Judge` + `DecisionJudge`). Tant qu'il n'est
> pas livré, **ce bloc ne s'affiche pas** — et l'interface doit être écrite pour qu'il
> apparaisse sans retoucher le reste le jour où les données arrivent.

---

## §5 — Ce qu'il ne faut PAS faire

- Ne pas déplacer le texte officiel ni changer son rendu : seul l'ordre des blocs qui le
  précèdent est en cause.
- Ne pas dupliquer le résumé éditorial : il devient la cinquième rubrique du sommaire, et
  son bloc actuel disparaît. 61 décisions sur 80 en ont un ; les autres n'affichent pas la
  ligne.
- Ne pas rendre le sommaire modifiable depuis la fiche : les outils éditoriaux vivent dans
  « Éditer le corpus » et `/admin/document/[id]`.
- Ne pas introduire de repli automatique — pas de règle de droit déduite du dispositif, pas
  de domaine deviné de la matière. Ce qui est vide reste vide.
- Ne pas toucher au bloc des notes de lecteurs ni à son circuit de modération.

---

## §6 — Tests et vérifications

1. Une décision **sans aucune rubrique** ne rend aucun bloc « Sommaire » — ni cadre, ni
   intitulé.
2. Une décision **partiellement renseignée** (domaine seul) rend une seule ligne, sans
   étiquette vide.
3. Le bloc « Sommaire » précède le texte officiel dans le DOM — vérifié par la position
   relative, pas à l'œil.
4. La composition ne s'affiche pas tant que le modèle n'est pas livré, et son absence ne
   laisse pas d'espace ni de séparateur.
5. Le rendu reste correct à **320 px** de large avec une règle de droit de 660 caractères.

- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test` propres.
- [ ] `npx tsx scripts/audit-contraste.ts` → **0 échec**.
- [ ] `npm run build:check` compile (**`build:check`**, pas `build`).
- [ ] Ouvrir **trois fiches réelles** : une complète (Deuxième Section n° 21), une sans
      rubriques, une sans dispositif. Aucun trou, aucune étiquette seule.
- [ ] Imprimer une fiche : le sommaire précède le texte sur le papier aussi.

---

## §7 — Ce qui reste à la rédaction

- ~~L'ordre des rubriques ?~~ **TRANCHÉ** : question → règle → motifs.
- ~~Le résumé éditorial, bloc séparé ou rubrique ?~~ **TRANCHÉ** : cinquième rubrique du
  sommaire.
- ~~Les 29 décisions sans rubriques ?~~ **SANS OBJET : les 80 décisions ont leurs quatre
  rubriques d'analyse** depuis le 15 août. Reste l'inégalité sur le résumé éditorial
  (61/80), la décision attaquée (67/80) et le dispositif (29/80) — que l'interface traite
  en n'affichant pas ce qui est vide.
