# Fascicules du Moniteur à océriser

Relevé du 16 août 2026 — **7 fascicules, 134 pages**, dont **127 sans aucun texte**.

> ✅ **40 des 47 fascicules du relevé précédent ont été océrisés le 16 août** et leur texte
> est versé dans l’index : 1,37 M caractères, 2 500 par page.

## Ils ONT été océrisés — mais sur la première page seulement

Le compte par page le montre sans ambiguïté (█ = page portant du texte, · = page muette) :

```
19880425 No 36-A.pdf   ██··························   2/28
19880811 No 71-A.pdf   █···············                1/16
19880818 No 72.pdf     █···················            1/20
19880825 No 74.pdf     █·······················        1/24
19880829 No 75.pdf     ····················            0/20
19881107 No 94.pdf     █···············                1/16
19881110 No 95.pdf     █·········                      1/10

  à comparer avec un fascicule repris le 16 août :
19880225 No 18.pdf     ████████████████████████       24/24
```

⚠️ **LA DIFFÉRENCE EST DANS LE PRODUCTEUR DU FICHIER.** Les sept portent
`Adobe Acrobat Pro 11.0.19 Paper Capture` et datent du 15 juin ; les quarante repris
portent `Adobe Acrobat 26 Paper Capture Plug-in`. La reconnaissance d’Acrobat 11 s’est
arrêtée après la première page — les suivantes sont des images JBIG2 en niveaux de gris à
600 ppp, que cette version ne traitait pas.

Ce n’est donc pas un défaut des scans : **les mêmes fichiers passés dans Acrobat 26**
**devraient rendre les mêmes 2 500 caractères par page que les autres.**

⚠️ Comme ils portent DÉJÀ une couche (celle de la page 1), Acrobat peut refuser de les
retraiter. Il faut lui demander de **remplacer la reconnaissance existante** — dans
l’Assistant d’action, l’option « Reconnaître le texte » avec « Remplacer le texte
existant », ou retirer d’abord la couche.

```
/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur/1981-1990/1988 par numéro
```

| # | Fichier | Référence | Date | Pages | Pages avec texte |
| --- | --- | --- | --- | --- | --- |
| 1 | `19880425 No 36-A.pdf` | LM1988-36-A | 1988-04-25 | 28 | **2 / 28** |
| 2 | `19880811 No 71-A.pdf` | LM1988-71-A | 1988-08-11 | 16 | **1 / 16** |
| 3 | `19880818 No 72.pdf` | LM1988-72 | 1988-08-18 | 20 | **1 / 20** |
| 4 | `19880825 No 74.pdf` | LM1988-74 | 1988-08-25 | 24 | **1 / 24** |
| 5 | `19880829 No 75.pdf` | LM1988-75 | 1988-08-29 | 20 | **0 / 20** |
| 6 | `19881107 No 94.pdf` | LM1988-94 | 1988-11-07 | 16 | **1 / 16** |
| 7 | `19881110 No 95.pdf` | LM1988-95 | 1988-11-10 | 10 | **1 / 10** |

**Total : 7 fascicules · 134 pages, dont 127 muettes.**

## Après l’océrisation

```bash
npx tsx scripts/rafraichir-texte-moniteur.ts --year 1988 --commit
```

Ni IA, ni purge : le script relit les PDF et ne met l’index à jour que si le fichier
apporte PLUS que ce que la fiche porte déjà.
