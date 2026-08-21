import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'
import { DelaiDatePublique } from '@/components/delais/DelaiDatePublique'
import type { SaisieHeros } from '@/components/delais/noyau-calculateur'
import { DelaisHeroChamps } from './DelaisHeroChamps'

/**
 * § 6.1 — LE HÉROS DU CALCULATEUR DE DÉLAIS.
 *
 * ⚠️ **IL CALCULE SUR PLACE, ET IL MONTRE LA DATE** (Me Vaval, 20 août 2026 : « Le portail
 * public doit uniquement afficher la date. Pas besoin de rediriger l'utilisateur vers une
 * autre page, ou de lui expliquer le raisonnement qui a mené au résultat. »). C'était un
 * `GET` vers `/{locale}/delais` ; le `GET` revient désormais sur L'ACCUEIL, avec la saisie
 * dans l'adresse, et la date s'écrit ici, sous le formulaire.
 *
 * ⚠️ **LA RÈGLE QUI L'INTERDISAIT EST TOMBÉE AVEC SON MOTIF.** « Une date juste, sans ses
 * réserves, est plus dangereuse qu'une absence de calculateur » valait quand la surface
 * publique prorogeait et ouvrait des lectures concurrentes : la date affichée en cachait
 * alors d'autres. Depuis `franc-pur.ts`, le calcul public est franc PUR — départ + N + 1 :
 * **il n'a plus aucune réserve à cacher**, et ce que la personne a demandé est exactement ce
 * qu'on lui rend. `DelaisHeroSlide.test.tsx` a été retourné le même jour, motif écrit en tête.
 *
 * ⚠️ **ET IL MARCHE SANS JAVASCRIPT.** C'est un `<form method="get" action="/{locale}">` :
 * les deux champs sont des contrôles natifs, le bouton soumet, l'accueil se re-rend côté
 * serveur avec la date dans le HTML initial. Aucun `fetch`, aucun calcul dans le navigateur.
 * Ce que le script apporte en plus, et rien d'autre : la consigne « Indiquer… » qui suit la
 * frappe, et le focus porté sur la date — le `GET` d'un formulaire SUPPRIME le fragment de
 * l'URL d'action, on ne peut donc pas ancrer la soumission sur `#hero-delais-titre`.
 *
 * ⚠️ **CE COMPOSANT EST SYNCHRONE, ET IL DOIT LE RESTER.** Le calcul est fait par la PAGE
 * (`lireHerosDelais`, appelé depuis `src/app/[locale]/page.tsx`) et arrive ici tout prêt. Un
 * `async` sur le héros ferait de tout l'accueil une frontière asynchrone — ce qui avait déjà
 * dû être défait une fois, et ce que `Landing.test.tsx` surveille. Corollaire : **l'accueil ne
 * touche à la base que si la visiteuse a soumis les deux champs** ; sans cela, `saisie` vaut
 * `undefined` et rien n'a été lu.
 *
 * ⚠️ **DEUX CHAMPS, ET DEUX SEULEMENT — le répertoire n'apparaît pas ici.** Le héros portait
 * un `<select>` de cinq raccourcis du répertoire (appel, pourvoi, opposition ×2, référé) et
 * un lien « Voir tout le répertoire ». Les deux sont retirés : le répertoire est réservé aux
 * titulaires d'un compte, et un menu qui en montre cinq entrées avec leurs numéros d'article
 * en montre cinq de trop.
 *
 * ⚠️ **Le formulaire n'émet ni `e`, ni `f`.** L'entrée est le genre « Autre » du § 4.12 et le
 * régime est FRANC — c'est ce que dit le libellé « Nombre de jour(s) francs ». Le serveur le
 * sait par l'ACCÈS, qui ne se falsifie pas depuis l'URL, et non par un champ caché.
 *
 * ⚠️ **CE QUI A ÉTÉ RETIRÉ LE 20 AOÛT 2026.** Le sous-titre (« La date de réception de l'acte,
 * le nombre de jours francs qu'il indique — et le raisonnement qui fonde la date. ») et la
 * note « Le résultat s'affiche sur la page du calculateur, avec ses réserves. » : la première
 * redit les libellés des deux champs voisins, la seconde annonçait une navigation qui n'a plus
 * lieu. Ne pas les réintroduire.
 *
 * ⚠️ **Aucune ancre imbriquée.** Cette bande n'est pas un lien : elle contient un formulaire.
 * Envelopper le tout dans un `<Link>` rendrait le formulaire inutilisable au clavier.
 */
export function DelaisHeroSlide({
  locale,
  t,
  saisie,
}: {
  locale: Locale
  t: Dictionary
  /** Ce que la page a calculé — `undefined` tant que rien n'a été soumis. */
  saisie?: SaisieHeros | null
}) {
  const d = t.delais

  return (
    <section aria-labelledby="hero-delais-titre" className="border-t border-liy bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:py-14">
        <div>
          {/* Le sur-titre est un mot, pas une pastille de couleur : il subsiste en
              achromatopsie et il est lu par un lecteur d'écran. */}
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-grafit">{d.heroKicker}</p>
          <h2 id="hero-delais-titre" className="mt-4 font-sans text-display-3 lowercase text-ank">
            {d.heroTitle}
          </h2>
          {/* ⚠️ PAS DE SOUS-TITRE (Me Vaval, 20 août 2026). */}
          <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-grafit">
            <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-wouj" />
            {/**
             * LA RÈGLE DE DROIT — la MÊME clé que la page `/delais` : deux surfaces qui
             * portent les mêmes champs ne disent pas le droit en deux versions. Elle reste
             * affichée, c'est une demande expresse de Me Vaval.
             */}
            {d.francRule}
          </p>
          {/**
           * ⚠️ **LA RÉSERVE, ET ELLE MANQUAIT ICI SEULEMENT** (20 août 2026). `/{locale}/delais`
           * et le portail portent `disclaimer` en pied ; le héros, qui est la page la plus vue
           * du site et la seule visible de tous dès la mise en ligne, affichait la date NUE.
           * La MÊME clé que les deux autres surfaces : une réserve ne se reformule pas par
           * écran. Texte fin, sous la règle de droit — pas un encadré, pas une couleur
           * d'alerte : la charte réserve le Sitwon à une source attestée (§ 8.1).
           */}
          <p className="mt-3 text-[11px] leading-relaxed text-grafit">{d.disclaimer}</p>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {/* Le formulaire : `GET` vers l'ACCUEIL, aucune requête réseau, aucun calcul client. */}
          <form method="get" action={`/${locale}`} className="rounded-2xl border border-liy bg-koton p-5 lg:p-6">
            {/* Les deux champs, le bouton, ce qui manque et le refus éventuel : le tout vit
                dans `DelaisHeroChamps`, qui suit la frappe. Les deux surfaces publiques
                portent les mêmes champs et doivent en dire la même chose. */}
            <DelaisHeroChamps
              t={t}
              valeurs={saisie?.valeurs ?? { d: '', n: '' }}
              erreur={saisie?.erreur ?? null}
            />
          </form>

          {/* LA DATE, et la seule mention gardée à côté d'elle. Rien avant la première
              soumission : l'accueil n'a pas d'« état vide » à meubler. */}
          <div aria-live="polite" className="min-w-0">
            {saisie?.resultat && (
              <DelaiDatePublique
                locale={locale}
                t={t}
                resultat={saisie.resultat}
                mentions={saisie.mentions}
                report={saisie.report}
                lectureStricte={saisie.lectureStricte}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
