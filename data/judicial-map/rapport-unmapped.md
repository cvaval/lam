# Rapport — sièges de tribunaux de paix UNMAPPED (10)

Sièges présents dans le fichier CSPJ 2024-2025 dont le rattachement administratif
détaillé n'est pas confirmé dans les sources. Règle de publication : ils existent en
base (`Court.verificationStatus = UNMAPPED`) mais ne sont NI rattachés à une commune,
NI publiés dans les fiches communales ou sur la carte, tant qu'une vérification
éditoriale (console d'administration → Modifier) ne les a pas résolus.

| Siège | Département | Ressort CSPJ | Observation |
|---|---|---|---|
| **DAMASSIN** (`court-paix-sud--damassin-42`) | Sud | JURIDICTION DES COTEAUX | Rattachement administratif détaillé non confirmé dans les sources consultées. |
| **CAHOUANE** (`court-paix-sud--cahouane-46`) | Sud | JURIDICTION DES COTEAUX | Rattachement administratif détaillé non confirmé dans les sources consultées. |
| **RENDEL** (`court-paix-sud--rendel-47`) | Sud | JURIDICTION DES COTEAUX | Rattachement administratif détaillé non confirmé dans les sources consultées. |
| **GROSSE ROCHE** (`court-paix-nord-est--grosse-roche-58`) | Nord-Est | JURIDICTION DE FORT-LIBERTÉ | Rattachement administratif détaillé non confirmé dans les sources consultées. |
| **BOIS DE LAURENCE** (`court-paix-nord-est--bois-de-laurence-63`) | Nord-Est | JURIDICTION DE FORT-LIBERTÉ | Rattachement administratif détaillé non confirmé dans les sources consultées. |
| **ACUL SAMEDI** (`court-paix-nord-est--acul-samedi-64`) | Nord-Est | JURIDICTION DE FORT-LIBERTÉ | Rattachement administratif détaillé non confirmé dans les sources consultées. |
| **CORRIDON** (`court-paix-artibonite--corridon-82`) | Artibonite | JURIDICTION DES GONAIVES | Rattachement administratif détaillé non confirmé dans les sources consultées. |
| **BANANE** (`court-paix-sud-est--banane-102`) | Sud-Est | JURIDICTION DE JACMEL | Rattachement administratif détaillé non confirmé dans les sources consultées. |
| **HATTE CHEVREAU** (`court-paix-artibonite--hatte-chevreau-177`) | Artibonite | JURIDICTION DE SAINT-MARC | Rattachement administratif détaillé non confirmé dans les sources consultées. |
| **SAVANNE A ROCHE** (`court-paix-artibonite--savanne-a-roche-179`) | Artibonite | JURIDICTION DE SAINT-MARC | Rattachement administratif détaillé non confirmé dans les sources consultées. |

## Résolution

1. Identifier la commune de rattachement dans une source citable (CSPJ, IHSI, Moniteur).
2. Console `/admin/juridictions` → Modifier : statut `CONFIRMED_OFFICIAL` ou `CORROBORATED`,
   ajouter la source, marquer vérifié.
3. Ajouter le rattachement dans une prochaine version du fichier d'amorçage
   (`associatedCommuneOrCity`) puis rejouer l'import (`--dry-run` d'abord).
