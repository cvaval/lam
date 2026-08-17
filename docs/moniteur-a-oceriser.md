# Fascicules du Moniteur à repasser à l’océrisation

Relevé du 17 août 2026 — **4 fascicules, 13 pages**. Fonds ancien 1981-2000 :
**1 596 fascicules, 21 991 pages, 94,4 M de caractères.**

> ✅ **Les neuf de 1981 sont faits.** Repassés dans Acrobat 26 le 17 août à midi, ils
> rendent 7 000 à 7 800 caractères par page — la meilleure densité de tout le fonds.
> Plus AUCUN fascicule du fonds ancien n’est sans texte.

## Ce qui reste — 1985, quatre fascicules à pages sautées

Bien océrisés dans l’ensemble et pleinement cherchables : Acrobat 11 a seulement sauté
quelques pages à l’intérieur. Ce n’est pas urgent.

| Fichier | Référence | Pages | Reconnues | Pages sautées |
| --- | --- | --- | --- | --- |
| `19850307 No 18.pdf` | LM1985-18 | 14 | 12 / 14 | 7, 8 |
| `19850311 No 19.pdf` | LM1985-19 | 26 | 20 / 26 | 4, 5, 11, 12, 23, 24 |
| `19851014 No 73.pdf` | LM1985-73 | 12 | 9 / 12 | 6, 7, 12 |
| `19851202 No 84.pdf` | LM1985-84 | 30 | 28 / 30 | 21, 27 |

Portant déjà une couche, ils doivent être repassés avec **« remplacer la reconnaissance
existante »**, sinon Acrobat les sautera.

```
/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur/1981-1990/1985 par numéro/
```

```bash
npx tsx scripts/verser-texte-moniteur-dans-corps.ts --year 1985 --commit
npx tsx scripts/reindex.ts
```

## Un cas à part : les 10 de 1996-1997

Ils sont **cherchables mais non affichables**, et c’est voulu. Leur PDF n’a aucune couche
texte ; leur contenu a été océrisé par IA en août et vit dans l’index seul, sous forme
normalisée (minuscules, accents retirés) — illisible à l’écran.

Leur fiche le dit exactement : « son texte intégral est indexé et se retrouve par la
recherche ; il n’est pas reproduit ici ». **Rien à corriger.** Un passage Acrobat leur
donnerait en plus le texte affichable — LM1996-58 (24 p.), 59, 60, 58-A, 64-A, 65-A,
LM1997-40-A, 41, 41-A.

⚠️ Ne PAS relancer `verser-texte-moniteur-dans-corps` sur eux avant de les avoir
océrisés : le script refuse d’écrire un texte plus pauvre, mais c’est un filet, pas une
intention.
