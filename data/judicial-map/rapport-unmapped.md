# Rapport — sièges de tribunaux de paix UNMAPPED (2 restants sur 10)

Sièges présents dans le fichier CSPJ 2024-2025 dont le rattachement administratif
détaillé n'est pas confirmé dans les sources. Règle de publication : ils existent en
base (`Court.verificationStatus = UNMAPPED`) mais ne sont NI rattachés à une commune,
NI publiés dans les fiches communales ou sur la carte, tant qu'une vérification
éditoriale (console d'administration → Modifier) ne les a pas résolus.

## Restent non résolus (2)

| Siège | Département | Ressort CSPJ | Observation |
|---|---|---|---|
| **CORRIDON** (`court-paix-artibonite--corridon-82`) | Artibonite | JURIDICTION DES GONAIVES | Absent du répertoire des codes postaux ; aucune section communale de ce nom retrouvée. |
| **HATTE CHEVREAU** (`court-paix-artibonite--hatte-chevreau-177`) | Artibonite | JURIDICTION DE SAINT-MARC | Absent du répertoire des codes postaux ; aucune section communale de ce nom retrouvée. |

Pistes : les listes de sections communales de l'IHSI (recensement) et les affectations
antérieures du CSPJ nomment parfois ces localités sous une graphie différente. Tant que
la commune n'est pas établie, ces deux sièges restent hors publication.

## Résolus le 11 août 2026 (8) — statut `CORROBORATED`

Le code postal haïtien s'écrit `HT` + département + arrondissement + commune + **section**,
le dernier chiffre valant `0` pour la commune entière. Le fichier d'amorçage ne portait que
les codes communaux ; chacun des huit sièges porte au répertoire postal un code identique
**au seul chiffre de section près**. Le rattachement se déduit du préfixe — il n'est pas
supposé, et le script d'application refuse d'écrire si la dérivation ne se vérifie pas.

| Siège | Code de la section | Code communal | Commune | Département |
|---|---|---|---|---|
| **DAMASSIN** (`court-paix-sud--damassin-42`) | HT8411 | HT8410 | Les Côteaux | Sud |
| **CAHOUANE** (`court-paix-sud--cahouane-46`) | HT8531 | HT8530 | Tiburon | Sud |
| **RENDEL** (`court-paix-sud--rendel-47`) | HT8511 | HT8510 | Chardonnières | Sud |
| **GROSSE ROCHE** (`court-paix-nord-est--grosse-roche-58`) | HT2411 | HT2410 | Vallières | Nord-Est |
| **BOIS DE LAURENCE** (`court-paix-nord-est--bois-de-laurence-63`) | HT2431 | HT2430 | Mombin-Crochu | Nord-Est |
| **ACUL SAMEDI** (`court-paix-nord-est--acul-samedi-64`) | HT2112 | HT2110 | Fort-Liberté | Nord-Est |
| **BANANE** (`court-paix-sud-est--banane-102`) | HT9341 | HT9340 | Anse-à-Pitres | Sud-Est |
| **SAVANNE A ROCHE** (`court-paix-artibonite--savanne-a-roche-179`) | HT4421 | HT4420 | Petite-Rivière-de-l'Artibonite | Artibonite |

Chacun tombe dans le ressort CSPJ déjà inscrit au siège — le rattachement postal et le
ressort judiciaire concordent, ce qui vaut recoupement indépendant.

⚠️ **Deux homonymies écartées.** « Grosse Roche » est couramment rapprochée de **Gros-Morne**
(Artibonite) ou de l'**Acul-du-Nord** (Nord) : impossible, ces communes portent HT4210 et
HT1210 quand la section est HT2411. « Cahouane » est parfois donnée aux Chardonnières :
HT8531 dérive de HT8530, soit Tiburon. Les deux erreurs auraient déplacé un tribunal de
département.

⚠️ **Statut `CORROBORATED`, jamais `CONFIRMED_OFFICIAL`.** Une déduction postale, si serrée
soit-elle, n'est ni le CSPJ ni Le Moniteur. Le référentiel ne vaut que parce que rien n'y
est sur-affirmé.

Les huit sièges sont sans adresse vérifiée : ils s'affichent au centroïde de leur commune
avec la mention « position indicative », conformément à `rules.missingCourtCoordinates`.

Script rejouable : `scripts/_resolve-unmapped-courts.ts`, puis
`npx tsx scripts/import-judicial-map.ts --dry-run` avant `--apply`.

## Résolution d'un siège restant

1. Identifier la commune de rattachement dans une source citable (CSPJ, IHSI, Moniteur).
2. Console `/admin/juridictions` → Modifier : statut `CONFIRMED_OFFICIAL` ou `CORROBORATED`,
   ajouter la source, marquer vérifié.
3. Ajouter le rattachement dans une prochaine version du fichier d'amorçage
   (`associatedCommuneOrCity`) puis rejouer l'import (`--dry-run` d'abord).
