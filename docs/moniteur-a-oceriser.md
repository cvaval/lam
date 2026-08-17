# Fascicules du Moniteur à repasser à l’océrisation

Relevé du 17 août 2026 — **13 fascicules**, 78 pages. Le fonds ancien 1981-2000 est
entièrement versé (1 695 fascicules) : ce qui suit ne concerne que la RECHERCHE.

## 1981 — neuf fascicules sans aucune couche texte

Ils sont **versés** : le fac-similé est entier et consultable. Mais leur texte n’existe
nulle part, donc la recherche ne les trouve que par leur référence.

| Fichier | Référence | Date | Pages |
| --- | --- | --- | --- |
| `19810402 No 27.pdf` | LM1981-27 | 2 avril 1981 | 10 |
| `19810406 No 28.pdf` | LM1981-28 | 6 avril 1981 | 8 |
| `19810409 No 29.pdf` | LM1981-29 | 9 avril 1981 | 10 |
| `19810413 No 30.pdf` | LM1981-30 | 13 avril 1981 | 8 |
| `19810416 No 31.pdf` | LM1981-31 | 16 avril 1981 | 8 |
| `19810420 No 32.pdf` | LM1981-32 | 20 avril 1981 | 8 |
| `19810423 No 33.pdf` | LM1981-33 | 23 avril 1981 | 8 |
| `19810427 No 34.pdf` | LM1981-34 | 27 avril 1981 | 8 |
| `19810430 No 35.pdf` | LM1981-35 | 30 avril 1981 | 8 |

⚠️ **Ce sont NEUF NUMÉROS CONSÉCUTIFS — tout le mois d’avril 1981.** Leurs pages sont des
images JBIG2 en niveaux de gris, le format qu’`Adobe Acrobat Pro 11.0.19` — leur
producteur — ne savait pas traiter. C’est exactement le défaut de 1988, où 47 fascicules
n’avaient que leur page 1. Le scan est bon ; seule la reconnaissance manque.

## 1985 — quatre fascicules à pages sautées

Bien océrisés dans l’ensemble, mais Acrobat 11 a sauté quelques pages à l’intérieur.

| Fichier | Référence | Pages | Reconnues | Pages sautées |
| --- | --- | --- | --- | --- |
| `19850307 No 18.pdf` | LM1985-18 | 14 | 12 / 14 | 7, 8 |
| `19850311 No 19.pdf` | LM1985-19 | 26 | 20 / 26 | 4, 5, 11, 12, 23, 24 |
| `19851014 No 73.pdf` | LM1985-73 | 12 | 9 / 12 | 6, 7, 12 |
| `19851202 No 84.pdf` | LM1985-84 | 30 | 28 / 30 | 21, 27 |

## Comment faire

Portant déjà une couche (au moins partielle), ils doivent être repassés avec
**« remplacer la reconnaissance existante »**, sinon Acrobat les sautera.

```
/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur/1981-1990/1981 par numéro/
/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur/1981-1990/1985 par numéro/
```

Puis, pour verser le texte retrouvé :

```bash
npx tsx scripts/verser-texte-moniteur-dans-corps.ts --year 1981 --commit
npx tsx scripts/verser-texte-moniteur-dans-corps.ts --year 1985 --commit
npx tsx scripts/reindex.ts
```

Le script ne réécrit que si le PDF apporte plus que la fiche : le relancer à vide ne
fait rien, et il ne remplace jamais un texte par un plus pauvre.
