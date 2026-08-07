# Arrêté du 30 avril 2018 sur la protection des données personnelles — livraison

**En ligne** : `cmsia011p0001umyqr1ih88tp` · `type=LEGISLATION` · `source=ARRETE_PDP_2018` ·
thème **Droit privé** (principal) · `LM2018-87` · Le Moniteur, 173ᵉ année, n° 87, mardi 15 mai 2018.

Un arrêté présidentiel **transitoire** : son article 1er dit lui-même qu'il vaut « en attendant
l'adoption de la loi y afférente ». Cinq articles, seize visas, trois considérants ; l'article 3
énumère neuf exigences applicables aux données enregistrées. Signé le 30 avril, publié le 15 mai.

| | |
|---|---|
| corps | 68 lignes · 5 210 caractères |
| articles | 5 (`art-1` … `art-5`) |
| signataires | le Président, le Premier ministre et **18 ministres** |
| index alphabétique | **36 entrées**, 24 avec renvoi interne |
| table / menu | 1 entrée (« ARRÊTE ») · 5 articles · **0 ancre morte** |
| renvois sortants | 4, tous vers un texte de la plateforme |

## Décisions appliquées

**Le contenu de l'arrêté prime sur le sommaire.** Le texte porte dix-huit ministres signataires,
le sommaire en annonce dix-neuf. On retient dix-huit : on ne complète pas un arrêté d'après la
description qu'un sommaire en donne. **Écart signalé, non comblé** — le Moniteur de 2018 n'est pas
au corpus (années présentes : 2016, 2019, 2021, 2024, 2025, 2026), rien ne permettrait de nommer
le dix-neuvième. Si le numéro 87 est retrouvé, le signataire manquant s'ajoutera.

**Le « pr » de deux signataires est retiré** (Antonio RODRIGUE, Hervé DENIS), sur décision de la
cliente. Il figurait bien dans le `.docx` source — texte simple, sans exposant ni petites
capitales — et n'apparaissait que deux fois dans tout le document, le seul titre de civilité qu'il
employait. Sa lecture la plus probable était « Pr » pour *Professeur*, sans que rien ne l'établisse.

**Le doublon de l'index est supprimé** (37 → 36 entrées). Établi par la mesure : le corps de
l'entrée « Restriction - consultation réservée… » est identique caractère pour caractère à la queue
de « Accès (restriction d'—) », 150 signes contre 151, la seule différence étant la parenthèse
fermante perdue. Une hésitation d'indexation entre deux vedettes, dont la seconde est restée
inachevée.

## Choix de structure

**Une seule entrée de table : « ARRÊTE »**, la ligne qui ouvre le dispositif. Les rubriques du
sommaire fourni — Visas, Considérants, Signatures — **ne sont pas des lignes du corps** ; les
inscrire aurait fabriqué des en-têtes que l'arrêté ne porte pas. Le menu latéral liste les cinq
articles, et le contrôle « toute ancre du menu existe dans la page » passe — c'est celui qui
manquait au Code civil et y avait laissé un lien mort.

**Renvois sortants sous l'article 1er** : Constitution de 1987 (ancrée sur son article 10), Code
civil, Code pénal, loi du 14 février 2017 sur la signature électronique. Les autres visas (lois de
1958, 1974, 1976, 2013 ; décrets de 1987, 2005, 2015 ; conventions et pactes internationaux) ne
sont pas au corpus et restent en texte — aucun lien mort fabriqué.

**Index** : « art. 3, 8) » porte le numéro d'article dans `ctRefs`, la précision de l'item restant
dans le sujet. Un seul renvoi est écarté, celui de l'entrée « Constitution — art. 10, 11, 11-1… »,
qui vise les articles de la Constitution et non ceux de l'arrêté. L'exclusion en bloc des entrées
marquées « (visa) » aurait été fausse : celle des « Droits et libertés fondamentaux », marquée
« (considérants) », porte de vrais renvois aux articles 2 et 4.

## Un défaut corrigé en cours de route

La première résolution des renvois sortants cherchait la loi sur la signature électronique **par
son titre** : « signature électronique » ramène cinq documents, dont deux fiches d'Index du
Moniteur qui n'en portent que l'intitulé, et le `findFirst` avait lié l'arrêté à l'une d'elles.
Résolution désormais **par `source`, avec garde sur `type = LEGISLATION`** ; le lien écrit a été
réparé (`--liens --apply`), les quatre cibles sont vérifiées.

## Coexistence avec le catalogue

L'arrêté figurait déjà au catalogue sous une fiche d'Index du Moniteur
(`ffe67f8e-6a11-4e23-9591-448fffc3ac41`, `type=INDEX`, corps de 85 caractères : le titre seul).
Les deux coexistent et portent le même `number`, si bien qu'une recherche « LM2018-87 » les
ramène ensemble.

## Réserve

Le pliable des renvois sortants s'intitule « Ancienne version & législation connexe » — libellé
générique du composant partagé. Il n'y a pas d'ancienne version ici ; le mot est inexact pour ce
document. À reprendre si le cas se répète.

Scripts : `scripts/data/arrete-pdp-2018/parse_pdp.py` (extraction, avec le correctif de tabulation
et les deux décisions) et `scripts/import-arrete-pdp-2018.ts` (simulation par défaut, `--apply`,
`--liens` pour re-résoudre les renvois).
