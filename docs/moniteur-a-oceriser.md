# Fascicules du Moniteur à océriser

Relevé du 16 août 2026 — **7 fascicules, 134 pages**.

> ✅ **40 des 47 fascicules du relevé précédent ont été océrisés dans Acrobat le 16 août**
> et leur texte est versé dans l’index (1,37 M caractères gagnés, 2 500 c./page).

Les sept ci-dessous restent sous le seuil de 200 caractères par page. Ils ne sont pas
vierges : six portent une couche ANCIENNE (Acrobat Pro 11, juin) qui n’a capté qu’une
fraction du texte — 100 à 140 c./page contre 2 500 pour les autres. Le n° 75 n’a rien.

⚠️ Leur date de modification est restée au **15 juin** : le lot du 16 août ne les a pas
touchés. Ils ont vraisemblablement été **écartés de la sélection**, ou Acrobat a refusé de
les retraiter parce qu’il y voyait déjà une couche texte. Dans ce dernier cas, il faut
lui demander explicitement de **remplacer** la reconnaissance existante.

```
/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur/1981-1990/1988 par numéro
```

| # | Fichier | Référence | Date | Pages | Couche actuelle |
| --- | --- | --- | --- | --- | --- |
| 1 | `19880425 No 36-A.pdf` | LM1988-36-A | 1988-04-25 | 28 | 142 c./page |
| 2 | `19880811 No 71-A.pdf` | LM1988-71-A | 1988-08-11 | 16 | 126 c./page |
| 3 | `19880818 No 72.pdf` | LM1988-72 | 1988-08-18 | 20 | 118 c./page |
| 4 | `19880825 No 74.pdf` | LM1988-74 | 1988-08-25 | 24 | 101 c./page |
| 5 | `19880829 No 75.pdf` | LM1988-75 | 1988-08-29 | 20 | 0 c./page |
| 6 | `19881107 No 94.pdf` | LM1988-94 | 1988-11-07 | 16 | 130 c./page |
| 7 | `19881110 No 95.pdf` | LM1988-95 | 1988-11-10 | 10 | 135 c./page |

**Total : 7 fascicules · 134 pages.**

## Après l’océrisation

```bash
npx tsx scripts/rafraichir-texte-moniteur.ts --year 1988 --commit
```

Ni IA, ni purge : le script relit les PDF et ne met à jour l’index que si le fichier
apporte PLUS que ce que la fiche porte déjà.
