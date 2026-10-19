# Livraison — sommaires analytiques, Cour de Cassation 1965-1966, Première Section, n° 1-15

**Écrit en production le 19 octobre 2026** par `scripts/enrichir-cassation-1965-1966-1re-1-15.ts`
(`--apply --titres`), à partir du fichier de la rédaction
`Sommaire_Analytique_1re_Section_1965-1966_Arrets_1-15.docx` (SHA-256
`420018a9afd5acde9996bb5fba6f7ddbb75c0c9e40ac68e3bf5de823d9aa8adf`, 45 434 octets, version du
19 octobre — 108 lignes diffèrent de celle du 13 octobre : les anomalies de source sont désormais
dans la sous-mention « Dispositif », plus en rubrique autonome). Copie et notices analysées dans
`scripts/data/cassation-1965-1966/` (manifeste `EMPREINTES.txt` posé et conforme).

## Ce qui a été écrit — 15 fiches, 15 entrées d'audit, 15 corps intacts

| rubrique de la notice | champ de la fiche | 15/15 |
|---|---|---|
| Domaines du droit | `matiere` | oui |
| Analyse | `summaryFr` (« Résumé éditorial ») | oui |
| Décision attaquée / objet de la saisine | `decisionAttaquee` | oui |
| Règle de droit (Rule of Law) | `regleDroit` | oui |
| Question de droit (Issue) | `questionDroit` | oui |
| Solution et motifs, **sans** la sous-mention « Dispositif » | `motifs` (les « Anomalies de source conservées » y restent, en dernier paragraphe) | oui |
| sous-mention « Dispositif : … » / « Dispositif, … : … » | `dispositif` | **14/15** (n° 13 n'en porte pas) |
| `deduireSolution(dispositif)` | `solution` | 14/15 : REJET 6 · CASSATION_SANS_RENVOI 4 · DÉCHÉANCE 2 · CASSATION_AVEC_RENVOI 1 (n° 10) · NULLITÉ 1 (n° 15) · ∅ 1 (n° 13) |
| Composition, à partir de « Ministère Public : » | `compositionNote` (« Mention du recueil ») | oui |
| dates, mention marginale, juridiction, composition, anomalies, empreinte | `metaJson.sommaireAnalytique` | oui |
| tête « No N — X c. Y » | `titleFr` (ancien titre conservé dans l'audit) | oui |

Jamais touchés : `bodyOriginal` (vérifié identique avant/après sur les 15), la formation
(DecisionJudge), `juridiction` (lot D en attente), `traitement`/`portee` (aucune pastille).
Les 67 autres arrêts de 1965-1966 n'ont pas bougé (recompté : 0). Relance en simulation après
écriture : 15 × « déjà à jour », 0 à écrire (idempotence).

### Intitulés remplacés (15)

Les anciens titres venaient de l'import automatique du 17 août (« Pourvoi de … »), deux étaient
cassés (n° 8 « Plantation Dauphin c. elle un accord de Septembre 1959 par lequel l'IDASH »,
n° 13 « Pourvoi de 30 Septembre 1963 dirigé »). Les nouveaux sont ceux de la rédaction, dans la
forme du volume 1964-1965 : « Maison Luciani-Berhmann c. Laurent Benoit », « Roboham Bélizaire dit
Vendredi et Moïse Bélizaire dit Eliézer Bélizaire c. Izalerme Pierre et consorts », « Aliancin
Désir et Gesner Désir c. Adeeb Saoud Saloum et Alvarez Nathandal », « Citadel Manufacturing
Company c. Edner Jean-Baptiste », « Belfort Thys c. Emmery Joachim », « Mme Joseph Pierre, née
Enithe Gabriel c. Joseph Pierre », « Berthaud Debrosse c. Charles Fils », « Plantation Dauphin c.
Lorvana Calixte et Lucina Abraham, ès-qualités, et consorts », « Sinclair Caribbean Oil Company
c. Pierre St Far », « Démosthènes Desrosiers c. Gabriel Lafleur », « Raynal Cadet c. Edgard
Lacombe et consorts », « Commercial Francisco Olivert c. Gerhard Busse », « Brown and Root, Inc.
c. Maurice A. Sager », « Brunamise Alexandre c. Lerome Noncent ès-qualités et Céziane Ulysse »,
« Caribbean Entreprise S.A. c. René Prosper ». Les n° 16-38 de la même Section gardent la forme
« Pourvoi de … » tant que leurs notices ne sont pas versées. Réversible : l'ancien titre est dans
`AuditLog.metaJson.ancienTitre`.

## Ce qui a été décidé

- **Le dispositif est détaché des motifs**, pas dupliqué : la fiche le rend à part, en gras
  (précédent 1964-1965 : 0/80 `motifs` contiennent « Dispositif »). Trois notices (n° 12, 14, 15)
  l'écrivent « Dispositif, sur conclusions conformes du Ministère Public : … » : tout ce qui suit
  « Dispositif, » est gardé tel quel, deux-points compris.
- **Les anomalies de source restent visibles** : la rédaction les a écrites pour le lecteur ; elles
  ferment `motifs` sous leur libellé d'origine, et sont aussi dans `metaJson`.
- **`compositionNote` ne répète pas le siège** (déjà porté membre par membre) : il commence à
  « Ministère Public : » — réquisitoire, audiences, greffe, avocats ayant plaidé.
- **`deduireSolution` étendu** (une ligne, un test) : « renvoi, pour être statué uniquement sur le
  chef cassé, devant le Tribunal Civil de Saint-Marc » (n° 10) était perdu par l'incise entre
  « renvoi » et « devant ». Aucune valeur existante n'est recalculée.
- **n° 13 (Brown and Root c. Sager, huit pourvois joints)** : la notice ne pose pas de sous-mention
  « Dispositif » ; `dispositif` et `solution` restent vides. À la rédaction de la compléter.
- La rubrique **Juridiction** n'est pas écrite dans `juridiction` (valeurs prose à réparer en lot D).
- La **transcription** jointe (`Cour_de_Cassation_Haiti_Arrets_1965-1966_Premiere_Section_1.docx`,
  identique octet pour octet au fichier du 18 octobre) n'a **pas** remplacé les textes : collation
  seule, 95,5 à 99,2 % de shingles-6 communs, écarts de −21 à +51 caractères (n° 14 et 15 plus
  courts dans la transcription). La base reste le texte.

## Garde-fous éprouvés (simulation, source restaurée à l'identique)

1. date du prononcé décalée d'un jour → « date du prononcé 1965-11-18 ≠ publicationDate
   1965-11-17. STOP » ;
2. un champ cible déjà renseigné autrement → « champ(s) déjà renseigné(s) autrement en base —
   refus d'écraser. STOP » ;
3. notice n° 7 retirée → « numéros lus : 1,…,6,8,… — attendu 1..15. STOP ».

Et à l'écriture : `updateMany` conditionnel (`updatedAt` vu + champs nuls) dans la transaction de
l'audit, 15/15 lignes touchées ; `auditLog.count()` recompté = 15 (`audit()` avale ses erreurs) ;
`reindexDocument()` par fiche, `searchText` relu (titre et matière présents).

## Vérification

- `src/lib/jurisprudence/notices.test.ts` (11 tests : têtes, continuations, libellé inconnu
  signalé, les deux graphies du dispositif, deux « Dispositif » refusés, dates, mention marginale,
  mention hors siège) ; `parse.test.ts` + 1 (renvoi avec incise) ;
- `JurisprudenceSommaire.test.tsx` + 2 : **chemin de rendu réel** sur les notices n° 1 (sept lignes,
  dispositif détaché, anomalies dans les motifs, pas de double « Dispositif ») et n° 13 (pas de
  ligne Dispositif) — données lues dans `scripts/data`, pas copiées ;
- `npm run typecheck` ✓ · `npm run lint` ✓ (2 avertissements `<img>` préexistants) ·
  `npm run test` : **tout passe dans l'arbre principal** ; les 40 échecs rapportés viennent de
  `.claude/worktrees/{sleepy-diffie-91933b,login-cartes-colonnes}` (worktrees d'autres sessions
  que vitest ramasse) ;
- `npm run build:check` : voir la ligne de fin de ce document.

## Reste — rien n'a été écrit pour ces points

- **26 greffiers absents des formations** (Cassation 1964-1966) : le corps nomme un
  Commis-Greffier (« avec l'assistance du sieur … » 12, « de Monsieur … » 10, « de Mr … » 4) mais la
  formation n'a pas de GREFFE ; sur 12 fiches, la qualité du Ministère Public a avalé le greffe
  (« Substitut du Commissaire du Gouvernement, avec l'assistance du sieur Clément ROMULUS,
  Commis-Greffier »). Ici : 1re Section 1965-1966 n° 2, 6, 18, 19, 22, 29, 30, 37, 38 ; 2e Section
  1965-1966 n° 37 ; Sections Réunies n° 8, 10 ; 2e Section 1964-1965 n° 16-29. Cause :
  `RE_GREFFE` (composition.ts) n'accepte que « de ». Lot de réparation à part, source = le corps.
  11 qualités finissent aussi par « et » (artefact de coupe).
- **n° 13** : dispositif à poser par la rédaction.
- **Recherche** : `regleDroit`, `questionDroit`, `motifs`, `dispositif`, `decisionAttaquee` ne sont
  pas dans `SEARCH_FIELD_NAMES` — seuls `matiere` et `summaryFr` (l'Analyse) sont cherchables, comme
  pour 1964-1965.
- **Thèmes** : ces 15 ont désormais une `matiere` ; `classer-jurisprudence-themes.ts` peut les
  classer (les 67 autres restent orphelins).
- **n° 16-38** : notices des 13 oct. (16-28, 29-36) à reprendre dans la version révisée, puis ce
  même script, paramétré ; le n° 36 est collé au 35 dans la transcription 29-36.
