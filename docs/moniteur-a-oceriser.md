# Fascicules du Moniteur à repasser à l’océrisation

Relevé du 17 août 2026 — **4 fascicules, 13 pages**, tous en 1985.

> ✅ **Le fonds ancien 1981-2000 est entièrement lisible ET cherchable.**
> 1 596 fascicules · 21 991 pages · 94,8 M de caractères. Plus AUCUN sans transcription.
>
> Les neuf de 1981 (avril) et les dix de 1996-97 ont été repassés dans Acrobat 26 le
> 17 août et versés.

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
