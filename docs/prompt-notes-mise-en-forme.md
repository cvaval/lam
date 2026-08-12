# Prompt — Gras et italique dans les notes des lecteurs

## Ce qui est demandé

Dans la note qu'un utilisateur laisse sous une décision, offrir la possibilité de mettre un
passage **en gras** ou en *italique*, comme le font les éditeurs de commentaires de blogs.

Rien d'autre. Pas de liens, pas d'images, pas de titres, pas de listes, pas de couleurs.

---

## Ce qui existe déjà (à lire avant de coder)

| Fichier | Rôle |
| --- | --- |
| `src/components/DocumentNotes.tsx` | Zone de saisie (`<textarea id="note-corps">`) et affichage des notes sous la fiche |
| `src/components/NotesModeration.tsx` | File de modération — la rédaction lit la note avant publication |
| `src/app/api/notes/route.ts` | `POST` dépose, `GET` liste pour la modération, `PATCH` publie ou refuse |
| `src/lib/notes/rules.ts` | Règles partagées : anonymat, modération, signature, `LONGUEUR_MAX_NOTE = 5000` |
| `prisma/schema.prisma` → `DocumentNote` | `body String` — texte brut aujourd'hui |

Aujourd'hui le corps est rendu par `whitespace-pre-line` : les retours à la ligne sont
respectés, tout le reste est du texte nu.

---

## §1 — Le choix structurant : aucun HTML n'entre dans le système

**Stocker du HTML serait le mauvais choix.** Une note est écrite par un lecteur, puis
affichée à tous les autres : c'est exactement la surface d'une injection de script. Un
assainisseur mal configuré, une dépendance non mise à jour, un attribut oublié, et Lam sert
du code exécutable à ses abonnés — sur un site où les gens se connectent avec une
authentification à deux facteurs.

**Adopter un balisage restreint, stocké tel quel, rendu en éléments React.**

- `**texte**` → `<strong>`
- `*texte*` → `<em>`

Le corps reste du texte. Le rendu construit un **arbre React** (`<strong>`, `<em>`, chaînes)
— jamais une chaîne de HTML. Il n'y a donc **aucun `dangerouslySetInnerHTML` à écrire**, et
rien à assainir : le seul HTML produit est celui que le composant décide lui-même de
produire.

> ⚠️ **Si quelqu'un propose `dangerouslySetInnerHTML` + un assainisseur, refuser.** Le
> bénéfice est nul (deux balises), le risque est maximal. La règle tient en une phrase :
> *le texte d'un lecteur ne devient jamais du HTML.*

> ⚠️ **Ne pas ajouter de bibliothèque Markdown.** `marked`, `markdown-it`, `remark`
> apportent liens, images, HTML brut et code — tout ce qu'on ne veut pas — et il faudrait
> ensuite les désactiver un par un. Deux balises se codent en une trentaine de lignes,
> testables intégralement.

**Aucune migration de base.** Le champ `body` ne change ni de type ni de sens : les notes
déjà écrites restent lisibles à l'identique (elles ne contiennent pas de marqueurs).

---

## §2 — L'analyseur (`src/lib/notes/format.ts`)

Écrire une fonction pure, sans React, testable seule :

```ts
export type Segment =
  | { type: 'texte'; valeur: string }
  | { type: 'gras'; enfants: Segment[] }
  | { type: 'italique'; enfants: Segment[] }

export function analyserMiseEnForme(corps: string): Segment[]
```

Règles à tenir, dans cet ordre de priorité :

1. **`**` avant `*`.** Sans cela, `**gras**` se lit comme un italique vide suivi d'un
   italique vide. Reconnaître les paires doubles d'abord.
2. **Non gourmand.** `*a* et *b*` fait deux italiques, pas un seul allant de `a` à `b`.
3. **Un marqueur non refermé reste du texte.** `Le taux est de 5*` s'affiche tel quel. Ne
   jamais « réparer » en fermant à la fin : la note ne dirait plus ce que son auteur a écrit.
4. **Une paire vide reste du texte.** `**` seul, `****`, `* *` → texte.
5. **Imbrication d'un seul niveau, gras > italique.** `**très *important***` fonctionne.
   Au-delà, ne pas chercher à être exhaustif : rendre du texte plutôt que deviner.
6. **Les retours à la ligne survivent** — ils sont déjà signifiants dans les notes
   existantes.

> ⚠️ **Le nombre de caractères ne change pas de définition.** `LONGUEUR_MAX_NOTE` continue
> de compter le corps **marqueurs compris**, et le compteur affiché aussi. Compter le texte
> rendu ferait accepter une note qui dépasse la colonne en base.

---

## §3 — Le rendu (`src/components/NoteBody.tsx`)

Un composant unique, `<NoteBody corps={...} />`, qui transforme les segments en éléments.

> ⚠️ **UN SEUL COMPOSANT DE RENDU, UTILISÉ AUX DEUX ENDROITS.** La fiche publique
> (`DocumentNotes.tsx`) **et** la file de modération (`NotesModeration.tsx`) doivent
> l'employer. Si la modération affiche les marqueurs bruts pendant que la fiche affiche du
> gras, le modérateur approuve un texte qu'il n'a pas vu — c'est le défaut le plus sérieux
> que cette fonction peut introduire, et il est invisible tant qu'on ne compare pas les deux
> écrans côte à côte.

Le composant conserve `whitespace-pre-line` sur son conteneur.

Ne pas modifier le rendu de la **note d'édition** (`noteRedaction`, champ de la rédaction)
dans cette tâche : la demande porte sur la note du lecteur. Si le même besoin se pose côté
rédaction, ce sera une décision séparée — et `NoteBody` sera là pour la servir.

---

## §4 — La barre d'outils

Garder le `<textarea>` et lui ajouter deux boutons qui **encadrent la sélection** avec les
marqueurs.

> ⚠️ **Ne pas passer à un champ `contenteditable`.** Un éditeur visuel apporte : perte du
> collage propre, annulation (`Ctrl+Z`) cassée, comportements divergents sur mobile,
> pièges d'accessibilité, et il fait rentrer du HTML dans l'application — ce que le §1
> écarte. Un `textarea` avec deux boutons couvre le besoin exprimé.

Comportement attendu :

- Sélection non vide → elle est encadrée, et **reste sélectionnée** après l'action.
- Sélection vide → insérer la paire et **placer le curseur entre les deux marqueurs**.
- Sélection déjà encadrée → **retirer** les marqueurs (bascule). Cliquer deux fois sur
  « Gras » doit rendre le texte de départ, pas `****texte****`.
- Raccourcis **Ctrl/Cmd + B** et **Ctrl/Cmd + I** dans la zone de saisie, avec
  `preventDefault()`.

Accessibilité et charte :

- `type="button"` (sinon le bouton soumet le formulaire).
- Cible d'au moins **44 px**, `aria-label` explicite (« Mettre en gras », « Mettre en
  italique ») — l'icône **B** / *I* seule ne suffit pas à un lecteur d'écran.
- Anneau de focus visible : `outline-none ring-wouj focus-visible:ring-2`.
- Contraste AA — le vérificateur (`scripts/audit-contraste.ts`) doit rester à zéro échec.

Sous la zone, une ligne d'aide discrète : « `**gras**` · `*italique*` ». Elle apprend la
syntaxe à qui colle du texte sans passer par les boutons.

---

## §5 — Aperçu

Ajouter un interrupteur **Écrire / Aperçu** au-dessus de la zone, l'aperçu utilisant
`NoteBody`. L'auteur voit ce qu'il publie avant de le soumettre.

Ne pas afficher les deux en permanence côte à côte : sur mobile, la zone deviendrait
inutilisable.

---

## §6 — Ce qu'il ne faut PAS faire

- Aucun lien cliquable. Une note modérée qui porte des liens devient un vecteur
  d'hameçonnage, et la modération ne peut pas vérifier une destination à chaque relecture.
- Aucune image, aucune vidéo, aucun bloc de code, aucun titre, aucune liste, aucune couleur.
- Aucune transformation silencieuse du corps existant en base (pas de « migration » qui
  rechercherait des marqueurs dans les notes déjà écrites).
- Ne pas toucher aux règles d'anonymat ni au circuit de validation : une note reste
  `EN_ATTENTE` jusqu'à publication par un éditeur ou le master admin.

---

## §7 — Tests attendus (`src/lib/notes/format.test.ts`)

Chaque cas ci-dessous est un test, en français, avec un commentaire disant ce qu'il protège :

1. `**gras**` → un segment gras ; `*italique*` → un segment italique.
2. `**` l'emporte sur `*` : `**mot**` ne produit pas deux italiques vides.
3. Non gourmand : `*a* et *b*` → deux italiques distincts.
4. Marqueur non refermé → texte inchangé, caractère `*` conservé.
5. Paire vide (`**`, `* *`) → texte.
6. Imbrication `**très *important***` → gras contenant un italique.
7. Les retours à la ligne sont préservés.
8. **Aucune balise HTML ne peut naître du corps** : `<script>alert(1)</script>` et
   `<img src=x onerror=alert(1)>` ressortent en segments **texte**, jamais en éléments.
9. Le rendu de `NoteBody` (via `renderToStaticMarkup`) sur ces mêmes entrées ne contient ni
   `<script`, ni `onerror`, ni `<img`.
10. Une note écrite **avant** cette fonction (sans marqueur) rend exactement le même texte
    qu'auparavant.

---

## §8 — Vérifications avant de rendre la main

- [ ] `npx tsc --noEmit` propre.
- [ ] `npm run lint` propre.
- [ ] `npm test` — tous les tests passent, ceux du §7 compris.
- [ ] `npx tsx scripts/audit-contraste.ts` → **0 échec**.
- [ ] `npm run build:check` compile (⚠️ **`build:check`**, pas `build`, si le serveur de
      développement tourne).
- [ ] À l'écran, sur une décision : écrire une note avec du gras et de l'italique, la
      soumettre, **ouvrir `/fr/admin/notes` et constater que la mise en forme y est
      identique**, publier, revenir sur la fiche et comparer les trois rendus.
- [ ] Essayer `<script>alert(1)</script>` dans une note : le texte doit s'afficher tel quel,
      la console du navigateur rester muette.
- [ ] Bascule : sélectionner un mot, cliquer « Gras » deux fois → le texte de départ.
- [ ] `Ctrl/Cmd + B` et `Ctrl/Cmd + I` fonctionnent dans la zone de saisie.
- [ ] Une note ancienne (sans marqueur) s'affiche inchangée.
- [ ] Supprimer les notes d'essai après vérification — la base est la base de **production**.

---

## §9 — Ce qui reste à décider par la rédaction

- La note d'édition de la rédaction (`noteRedaction`) reçoit-elle la même mise en forme ?
  `NoteBody` le permettrait sans travail supplémentaire ; ce n'est pas fait ici faute de
  demande.
- Faut-il un troisième marqueur pour la **citation** (`> ` en début de ligne) ? Utile pour
  reprendre un passage d'arrêt dans un commentaire — mais c'est une demande distincte, à
  formuler séparément.
