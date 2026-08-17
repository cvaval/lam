# Fascicules du Moniteur à repasser à l’océrisation

Relevé du 17 août 2026 — **4 fascicules de 1985**, 18 pages non reconnues.

> Ils sont **versés et cherchables** : leur texte dépasse largement le seuil de
> 200 caractères par page. Ce ne sont pas des trous, ce sont des pages sautées à
> l’intérieur d’un fascicule par ailleurs bien reconnu.

## Le relevé

| Fichier | Référence | Pages | Reconnues | Pages sautées |
| --- | --- | --- | --- | --- |
| `19850307 No 18.pdf` | LM1985-18 | 14 | 12 / 14 | 7, 8 |
| `19850311 No 19.pdf` | LM1985-19 | 26 | 20 / 26 | 4, 5, 11, 12, 23, 24 |
| `19851014 No 73.pdf` | LM1985-73 | 12 | 9 / 12 | 6, 7, 12 |
| `19851202 No 84.pdf` | LM1985-84 | 30 | 28 / 30 | 21, 27 |

⚠️ Tous portent `Adobe Acrobat Pro 11.0.3` — la version qui ne traitait pas les pages
JBIG2 en niveaux de gris. C’est le même défaut qu’en 1988, où 47 fascicules n’avaient
que leur page 1. Ici il ne touche que quelques pages : Acrobat 11 a fait l’essentiel.

Portant déjà une couche, ils doivent être repassés avec **« remplacer la reconnaissance
existante »**, sinon Acrobat les sautera.

```
/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur/1981-1990/1985 par numéro/
```

## Après l’océrisation

```bash
npx tsx scripts/verser-texte-moniteur-dans-corps.ts --year 1985 --commit
```

Le script ne réécrit que si le PDF apporte plus que la fiche : le relancer sans avoir
rien océrisé ne fait rien.
