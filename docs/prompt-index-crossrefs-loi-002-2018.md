# Prompt Claude Code — Index alphabétique et renvois croisés de la Loi N° 002-2018
## Porter la loi « statut du commerçant » au standard du Code civil (index quasi exhaustif + renvois croisés bidirectionnels)
### Rédigé après mesure de l'existant en base — prêt pour exécution agentique

---

## 0. État des lieux (MESURÉ en production le 26 juil. 2026 — ne pas re-deviner)

- Document cible : `LOI_STATUT_COMMERCANT_2018` (`cms119frh0000aaufgy466b43`), Législation annotée → Droit commercial. Lecteur annoté actif (sommaire 18 en-têtes, `hideInlineIndex` → l'index vit dans le menu latéral CodeSidebar).
- **67 ancres** d'articles (2 porteurs `art-1`/`art-2` + 65 articles de code `art-1000-1`, `art-1111-1` … `art-1137-2`).
- Index actuel : **24 sujets, 47/67 articles couverts**. Les **20 articles NON couverts** :
  `1, 2, 1000-1, 1120-4, 1120-11, 1120-12, 1133-5, 1133-7, 1133-8, 1133-9, 1134-3, 1136-2, 1136-5, 1136-6, 1136-7, 1136-9, 1136-11, 1136-12, 1136-14, 1136-15`.
- Renvois INLINE : déjà cliquables (« aux articles 1111-2 et 1111-3 », « l'article 1132-3 »…) — le lieur accepte les 4 chiffres + suffixe depuis l'audit du 25 juil. ; gardes anti-renvoi-externe AVANT/APRÈS actives. **Rien à faire sur ce plan.**
- Renvois croisés loi ↔ Code de commerce : côté CODE, les 73 notes connexes cliquables vers la loi existent (posées le 25 juil.). Côté LOI : **0 bloc connexe, 0 crossRef** — le miroir manque.
- Référence de standard : le Code civil (index 2046/2047 articles couverts, ~3,8 renvois/sujet, renvois inversés sous chaque article via `indexBacklinks` — automatiques dès que l'index couvre l'article) et la Loi Filiation (miroir connexe loi ↔ code à l'ancre exacte).

## 1. Mission (deux chantiers, dans cet ordre)

1. **Index alphabétique au standard Code civil** : couverture **67/67**, granularité ≈ 3-4 renvois par sujet, sujets dans le vocabulaire du texte publié. Cible ≈ 45-60 sujets après enrichissement (fusion avec les 24 existants).
2. **Renvois croisés bidirectionnels** (patron Loi Filiation) : sous chaque article de la loi, un bloc connexe repliable cliquable vers le **Code de commerce** à l'ancre homonyme — miroir des notes déjà posées côté Code.

## 2. Garde-fous

1. **Sujets tirés du TEXTE** (vocabulaire du Moniteur), jamais de concepts plaqués. Curation MANUELLE d'abord — 65 articles se lisent en entier ; l'IA (patron `_cc_index.ts` incrémental, leçon quotas Gemini→Anthropic) n'est admise que si la curation laisse des trous, et ses sorties sont relues.
2. **Anti-lien-mort absolu** : chaque `ctRefs` doit être une ancre existante du document (assert bloquant avant écriture) ; chaque connexe `docId`/`anchor` doit résoudre vers une ancre vivante du Code de commerce (709 ancres).
3. **Fusion par sujet folé** avec l'index existant (pas de doublons « Fichier National »/« fichier national ») ; tri alphabétique `localeCompare fr` ; formats `IndexEntry{subject, ctRefs}` (⚠ champ **`ctRefs`**, pas `refs`).
4. **Mise à jour EN PLACE** de `annotationsJson` (jamais de ré-import — l'id du document ne doit pas changer) ; `reindexDocument` après écriture (le champ `annotationsText` porte l'index dans la recherche).
5. Idempotence (relance = même état) ; script versionné ; **audit adversarial court avant soumission** (1 vérificateur : couverture réelle, liens vivants, pas de sujet fantôme).
6. **Interdits** : lier 1321-17/1332-1/1332-2 (articles jamais publiés — réserve documentée) ; toucher au corps (`bodyOriginal`) ; toucher aux notes connexes déjà posées côté Code de commerce (vérifier, ne pas doubler).

## 3. Chantier 1 — sujets à créer pour les 20 articles découverts (proposition à affiner sur texte)

| Article | Sujet(s) suggérés |
|---|---|
| 1 (porteur) | Refonte du Titre 1er du Livre premier (structure) |
| 2 (porteur) | Clause abrogatoire |
| 1000-1 | Champ d'application du Code (personnes assujetties) ; Sociétés d'économie mixte |
| 1120-4 | Créance conditionnelle ou à terme ; Action en garantie (point de départ) |
| 1120-11 | Prescription — moyen non soulevé d'office ; Prescription en appel |
| 1120-12 | Paiement d'une dette prescrite (non-répétition) |
| 1133-5 | Mentions modificatives (état civil, régime matrimonial, activité) |
| 1133-7 | Dissolution et nullité des personnes morales (transcription) |
| 1133-8 | Contrôle des demandes ; Rejet (insusceptible de recours) |
| 1133-9 | Sanctions pénales (formalités omises ou frauduleuses) |
| 1134-3 | Opposabilité aux tiers des faits et actes publiés |
| 1136-2 | Support papier et support électronique |
| 1136-5 | Mentions marginales ; Signature électronique du responsable |
| 1136-6 | Identification électronique du demandeur |
| 1136-7 | Transmissions et archivage électroniques |
| 1136-9 | Réponse par voie électronique |
| 1136-11 | Identification du déclarant (messagerie électronique) |
| 1136-12 | Communication d'extraits et copies |
| 1136-14 | Coût des informations et copies |
| 1136-15 | Protection des données à caractère personnel |

Compléter aussi les sujets EXISTANTS trop maigres si le texte le justifie (ex. « Prescription commerciale » ne cite pas 1120-4/11/12/13 alors qu'ils en relèvent). Les renvois inversés sous chaque article (« Index → ») sont automatiques via `indexBacklinks` dès que la couverture existe — rien à coder.

## 4. Chantier 2 — miroir connexe loi → Code de commerce (patron Filiation)

- Sous **chaque article cité** `art-N` (65) : bloc `connexe[art-N]` = `{ label: 'Code de commerce (texte en vigueur)', text: 'Voir l'article N dans le Code de commerce annoté (Titre premier refondu par la présente loi).', docId: <id CODE_COMMERCE_ANNOTE>, anchor: 'art-N' }` — l'ancre homonyme EXISTE pour les 65 (vérifié : 709 ancres).
- Sous **art-1** (porteur) : → Code de commerce `#art-1000-1` (tête du Titre refondu), texte rappelant que les anciens articles 1er à 8 y sont repliés.
- Sous **art-2** (porteur) : → fiche du Code de commerce (sans ancre), clause abrogatoire.
- Rendu : `RelatedLaw` (repliable « Ancienne version & législation connexe ») — déjà branché, aucun code à écrire.
- Contrôle de non-duplication : `connexe` de la loi est vide aujourd'hui (mesuré) ; en relance, remplacer le bloc portant ce `docId`, ne jamais empiler.

## 5. Contrôles de fin (pass/fail exécutables)

1. Couverture d'index : **67/67** ancres dans `indexBacklinks` ; 0 renvoi mort ; 0 doublon de sujet folé.
2. Connexe : **66 blocs** (65 + art-1 ; art-2 optionnel) ; 100 % des `anchor` résolvent dans le Code de commerce ; 0 lien vers 1321-17/1332-x.
3. Segmentation de la loi INCHANGÉE (18/18, 67 ancres) ; 0 clé orpheline ; corps intact (hash avant/après identique).
4. Recherche : « protection des données personnelles », « dette prescrite », « mentions marginales » remontent la loi (annotationsText réindexé).
5. Audit adversarial court, puis seulement commit + note de livraison (addendum à `docs/livraison-loi-statut-commercant.md`).

## 6. Livrables

`scripts/_enrich-index-loi-statut-commercant.ts` (idempotent, données inline ou `scripts/data/loi-statut-commercant-2018/index-enrichi.json`) ; addendum de livraison ; mémoire projet mise à jour.

*Aucune écriture sur le corps officiel ; en cas de divergence, la version publiée au Moniteur prévaut.*
