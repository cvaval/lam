# Les dix fascicules de 1996-1997 — cherchables, non affichables

Relevé du 17 août 2026. **185 pages, 13 Mo, 0,78 M de caractères déjà indexés.**

> Ils ne sont **pas** en défaut. Leur PDF n’a aucune couche texte ; leur contenu a été
> océrisé par IA en août 2026 et vit dans l’index seul, sous forme normalisée —
> minuscules, accents retirés —, donc illisible à l’écran. Leur fiche le dit exactement :
> « son texte intégral est indexé et se retrouve par la recherche ; il n’est pas reproduit
> ici ». Un passage Acrobat leur donnerait **en plus** le texte affichable.

## La liste

| Référence | Date | Pages | Caractères indexés | c./page | Fichier |
| --- | --- | --- | --- | --- | --- |
| `LM1996-57` | 5 août 1996 | 24 | 102 952 | 4 290 | `19960805 No 57.pdf` |
| `LM1996-58` | 8 août 1996 | 24 | 106 873 | 4 453 | `19960808 No 58.pdf` |
| `LM1996-58-A` | 8 août 1996 | 4 | 4 874 | 1 218 | `19960808 No 58-A.pdf` |
| `LM1996-59` | 12 août 1996 | 24 | 105 394 | 4 391 | `19960812 No 59.pdf` |
| `LM1996-60` | 19 août 1996 | 18 | 77 719 | 4 318 | `19960819 No 60.pdf` |
| `LM1996-64-A` | 2 septembre 1996 | 8 | 21 583 | 2 698 | `19960902 No 64-A.pdf` |
| `LM1996-65-A` | 5 septembre 1996 | 8 | 16 251 | 2 031 | `19960905 No 65-A.pdf` |
| `LM1997-40-A` | 26 mai 1997 | 24 | 114 251 | 4 760 | `19970526 No 40-A.pdf` |
| `LM1997-41` | 29 mai 1997 | 23 | 102 266 | 4 446 | `19970529 No 41.pdf` |
| `LM1997-41-A` | 29 mai 1997 | 28 | 126 234 | 4 508 | `19970529 No 41-A.pdf` |

**Total : 10 fascicules · 185 pages · 4 208 caractères par page en moyenne.**

## Où ils sont

```
/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur/1991-2000/1996 par numéro/   (7)
/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur/1991-2000/1997 par numéro/   (3)
```

Tous portent `Adobe Acrobat Pro 11.0.3` et **zéro caractère de couche** — sauf le n° 41 de
1997, qui en a 22, soit rien du tout. Ce sont les seuls du fonds ancien dont l’océrisation
a été payée à l’IA plutôt qu’obtenue d’Acrobat.

## Si vous les repassez

Ils n’ont **pas** de couche à remplacer : Acrobat les traitera sans réglage particulier,
contrairement aux fascicules de 1981 et 1985 qui exigeaient « remplacer la reconnaissance
existante ».

```bash
npx tsx scripts/verser-texte-moniteur-dans-corps.ts --year 1996 --commit
npx tsx scripts/verser-texte-moniteur-dans-corps.ts --year 1997 --commit
npx tsx scripts/reindex.ts
```

⚠️ **Le script ne remplace jamais un texte par un plus pauvre.** Si Acrobat rendait moins
que l’IA n’a déjà donné, l’index garderait la version riche — mais le corps, lui, ne
recevrait rien. Vérifier la densité annoncée (≈ 4 200 c./page aujourd’hui) avant de
considérer l’opération comme un gain.
