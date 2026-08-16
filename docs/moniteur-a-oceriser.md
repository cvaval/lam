# Fascicules du Moniteur à océriser

Relevé du 16 août 2026 — **1 fascicule, 20 pages**.

> ✅ **46 des 47 fascicules signalés sont océrisés et versés dans l’index.**
> 1988 est passée de 0,91 à 2,57 M de caractères, à 2 162 par page.
> Sur tout le fonds 1988-2000 — 1 006 fascicules — il n’en reste qu’un.

## Le seul qui reste

| Fichier | Référence | Date | Pages | Pages avec texte | Producteur |
| --- | --- | --- | --- | --- | --- |
| `19880818 No 72.pdf` | LM1988-72 | 1988-08-18 | 20 | **1 / 20** | Adobe Acrobat Pro 11.0.19 (15 juin) |

Il a été **sauté par le lot du 16 août** : sa date de modification est restée au 15 juin
et son producteur est toujours celui d’Acrobat 11. Ses six voisins, repris dans le même
passage, portent maintenant `Adobe Acrobat 26` et leurs 16 à 28 pages sont toutes
reconnues.

⚠️ Comme il porte déjà la couche de sa page 1, Acrobat peut refuser de le retraiter : lui
demander de **remplacer la reconnaissance existante**.

```
/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur/1981-1990/1988 par numéro/19880818 No 72.pdf
```

## Après l’océrisation

```bash
npx tsx scripts/rafraichir-texte-moniteur.ts --year 1988 --commit
```
