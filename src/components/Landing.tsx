import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { CookieBanner } from '@/components/CookieBanner'
import { PUBLICATIONS } from '@/lib/publications'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'

/**
 * Landing publique du portail (route /[locale] pour les visiteurs non connectés).
 * Reprend le site vitrine : héros, offre (3 sources), mission, avertissement,
 * confiance, publications, pied de page légal + bandeau cookies. Tous les liens
 * pointent vers des routes réelles du portail (login, register, légal, publications).
 */
export function Landing({ locale, t }: { locale: Locale; t: Dictionary }) {
  const tr = (fr: string, en: string, ht: string) => (locale === 'en' ? en : locale === 'ht' ? ht : fr)
  const featured = PUBLICATIONS[0]

  return (
    <div className="bg-paper">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-sitwon/15 bg-lank">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Logo size={30} tone="dark" />
          <div className="flex items-center gap-4">
            <LocaleSwitcher current={locale} />
            <Link href={`/${locale}/login`} className="rounded-full bg-sitwon px-5 py-2 text-sm font-semibold text-lank hover:bg-sitwon/90">
              {t.nav.login}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-lank text-cream">
        <div className="mx-auto max-w-6xl px-4 py-16 lg:py-24">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-sitwon">{tr("République d'Haïti · recherche juridique", 'Republic of Haiti · legal research', 'Repiblik Ayiti · rechèch jiridik')}</p>
          <h1 className="mt-5 max-w-3xl font-serif text-4xl font-semibold leading-[1.05] lg:text-6xl">{t.home.title}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-cream/75">
            {tr(
              "Recherchez Le Moniteur, l'index de la législation haïtienne et les circulaires de la Banque de la République d'Haïti — sourcés aux textes publiés.",
              'Search Le Moniteur, the index of Haitian legislation and the circulars of the Bank of the Republic of Haiti — sourced from the published texts.',
              'Chèche nan Monitè a, endèks lejislasyon ayisyen an ak sikilè Bank Repiblik Ayiti a — ki soti nan tèks ki pibliye yo.',
            )}
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href={`/${locale}/register`} className="rounded-full bg-sitwon px-6 py-3 text-sm font-semibold text-lank hover:bg-sitwon/90">{t.nav.createAccount}</Link>
            <Link href={`/${locale}/login`} className="rounded-full border border-cream/35 px-6 py-3 text-sm font-semibold text-cream hover:bg-white/10">{t.nav.login}</Link>
          </div>
          <p className="mt-5 font-mono text-xs text-cream/45">🔒 {tr('La recherche nécessite une connexion sécurisée.', 'Search requires a secure sign-in.', 'Rechèch la mande yon koneksyon sekirize.')}</p>
        </div>
      </section>

      {/* Offre */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-soley">{tr('Ce que vous pouvez consulter', 'What you can consult', 'Sa ou ka konsilte')}</p>
        <h2 className="mt-3 font-serif text-3xl font-semibold text-lank">{tr('Trois sources officielles, un seul moteur.', 'Three official sources, one search engine.', 'Twa sous ofisyèl, yon sèl motè.')}</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            { f: 'Le Moniteur', e: 'Le Moniteur', h: 'Le Moniteur', df: "Accès au contenu des éditions du Journal Officiel. Recherche par mots-clés, date, numéro d'édition et type d'acte.", de: 'Access to the editions of the Official Journal. Search by keyword, date, edition number and type of act.', dh: 'Aksè ak kontni edisyon Jounal Ofisyèl la. Rechèch pa mo kle, dat, nimewo edisyon ak tip zak.' },
            { f: 'Index législatif', e: 'Legislative index', h: 'Endèks lejislatif', df: 'Index structuré de la législation haïtienne : lois, décrets, arrêtés et autres actes normatifs.', de: 'A structured index of Haitian legislation: laws, decrees, orders and other normative acts.', dh: 'Endèks estriktire lejislasyon ayisyen an : lwa, dekrè, arete ak lòt zak nòmatif.' },
            { f: 'Circulaires de la BRH', e: 'BRH circulars', h: 'Sikilè BRH yo', df: "Contenu des circulaires de la Banque de la République d'Haïti, avec recherche par numéro et par année.", de: 'The circulars of the Bank of the Republic of Haiti, searchable by number and year.', dh: "Kontni sikilè Bank Repiblik Ayiti a, ak rechèch pa nimewo ak pa ane." },
          ].map((c, i) => (
            <Link key={i} href={`/${locale}/login`} className="group rounded-2xl border border-lank/10 bg-white p-7 shadow-card transition hover:-translate-y-1 hover:shadow-lg">
              <h3 className="font-serif text-xl font-semibold text-lank">{tr(c.f, c.e, c.h)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-lank/60">{tr(c.df, c.de, c.dh)}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Mission */}
      <section className="bg-lank text-cream">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-sitwon">{tr('Notre mission', 'Our mission', 'Misyon nou')}</p>
          <p className="mt-5 max-w-2xl font-serif text-2xl leading-snug lg:text-3xl">{tr("L'accès au droit est un bien commun.", 'Access to the law is a common good.', 'Aksè ak dwa se yon byen komen.')}</p>
          <p className="mt-6 max-w-3xl leading-relaxed text-cream/75">
            {tr(
              "Lam est née d'une conviction : dans un État de droit, nul ne devrait avoir à deviner ce que dit la loi. Le droit haïtien — éparpillé dans des décennies de Moniteur, de circulaires et de textes épars — doit être trouvable, lisible et vérifiable par tous, qu'un texte soit en vigueur ou non.",
              "Lam was born of a conviction: in a state governed by the rule of law, no one should have to guess what the law says. Haitian law — scattered across decades of the Moniteur, circulars and disparate texts — must be findable, readable and verifiable by everyone, whether a text is in force or not.",
              "Lam soti nan yon konviksyon : nan yon Eta dedwa, pèsòn pa ta dwe oblije devine sa lalwa di. Dwa ayisyen an dwe ka jwenn, ka li epi tout moun ka verifye l, kit yon tèks anvigè ou non.",
            )}
          </p>
          <div className="mt-7 flex flex-wrap gap-2 font-mono text-xs uppercase tracking-wide text-sitwon">
            {[tr('Les juristes', 'Legal professionals', 'Jiris yo'), tr("Les hommes et femmes d'affaires", 'Business owners', 'Fanm ak gason dafè yo'), tr('Les citoyens concernés', 'Concerned citizens', 'Sitwayen konsène yo')].map((w, i) => (
              <span key={i} className="rounded-full border border-sitwon/40 px-3 py-1.5">{w}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Avertissement */}
      <section className="mx-auto max-w-4xl px-4 py-16">
        <div className="rounded-2xl border border-soley/50 border-l-[6px] border-l-soley bg-soley-50 p-7">
          <p className="mb-3 font-serif text-lg font-semibold text-lank">⚠ {tr('Avertissement important', 'Important notice', 'Avètisman enpòtan')}</p>
          <p className="leading-relaxed text-lank/80">
            {tr(
              "Les documents disponibles sur Lam ne sont pas des textes officiels. Il s'agit d'une reproduction qui se veut fidèle des textes publiés au Moniteur et par la Banque de la République d'Haïti. La consultation de cette base de données ne se substitue pas aux versions officielles publiées par les Presses Nationales d'Haïti, la BRH et les autres autorités étatiques. En cas de divergence, les dernières versions publiées font foi. Lam fournit de l'information juridique à titre documentaire, et non un conseil juridique ; l'utilisation de la Plateforme ne crée aucune relation avocat-client.",
              'The documents available on Lam are not official texts. They are a reproduction intended to be faithful to the texts published in the Moniteur and by the Bank of the Republic of Haiti. Consulting this database is not a substitute for the official versions published by the Presses Nationales d’Haïti, the BRH and other state authorities. In the event of any discrepancy, the latest published versions prevail. Lam provides legal information for documentary purposes, not legal advice; use of the Platform creates no attorney-client relationship.',
              "Dokiman ki disponib sou Lam yo se pa tèks ofisyèl. Se yon repwodiksyon ki vle fidèl ak tèks ki pibliye nan Monitè a ak pa Bank Repiblik Ayiti a. Konsilte baz done sa a pa ranplase vèsyon ofisyèl yo. Si gen divèjans, se dènye vèsyon ki pibliye yo ki fè lwa. Lam bay enfòmasyon jiridik pou dokimantasyon, se pa yon konsèy jiridik ; itilize Platfòm nan pa kreye okenn relasyon avoka-kliyan.",
            )}
          </p>
        </div>
      </section>

      {/* Confiance */}
      <section className="border-y border-lank/10 bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-3">
          {[
            { tF: 'Connexion à deux facteurs', tE: 'Two-factor authentication', tH: 'Koneksyon ak de faktè', dF: 'Chaque compte est protégé par une authentification à deux facteurs (2FA).', dE: 'Every account is protected by two-factor authentication (2FA).', dH: 'Chak kont pwoteje ak yon otantifikasyon ak de faktè (2FA).' },
            { tF: 'Données chiffrées', tE: 'Encrypted data', tH: 'Done chifre', dF: 'Communications et données chiffrées (TLS, chiffrement au repos) ; domaine protégé par DNSSEC.', dE: 'Encrypted communications and data (TLS, encryption at rest); domain protected by DNSSEC.', dH: 'Kominikasyon ak done chifre (TLS, chifreman lè y ap poze) ; domèn pwoteje ak DNSSEC.' },
            { tF: 'Fidélité aux sources', tE: 'Faithful to the sources', tH: 'Fidelite ak sous yo', dF: 'Toute erreur de transcription signalée est corrigée dans les meilleurs délais.', dE: 'Any transcription error reported is corrected as soon as possible.', dH: 'Nenpòt erè transkripsyon yo siyale ap korije pi vit posib.' },
          ].map((it, i) => (
            <div key={i}>
              <h4 className="font-serif text-lg font-semibold text-lank">{tr(it.tF, it.tE, it.tH)}</h4>
              <p className="mt-1.5 text-sm leading-relaxed text-lank/60">{tr(it.dF, it.dE, it.dH)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Publications */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-soley">{tr('Actualités & analyses', 'News & analysis', 'Aktyalite & analiz')}</p>
            <h2 className="mt-3 font-serif text-3xl font-semibold text-lank">{tr('Les dernières publications de Lam', 'Latest publications from Lam', 'Dènye piblikasyon Lam yo')}</h2>
          </div>
          <Link href={`/${locale}/publications`} className="rounded-full bg-lank px-5 py-2.5 text-sm font-semibold text-cream hover:bg-lank/90">{tr('Voir toutes les publications', 'See all publications', 'Gade tout piblikasyon yo')}</Link>
        </div>
        {featured && (
          <Link href={`/${locale}/publications/${featured.slug}`} className="mt-9 block rounded-2xl border border-lank/10 bg-white p-8 shadow-card transition hover:-translate-y-1 hover:shadow-lg">
            <p className="font-mono text-xs uppercase tracking-wide text-lank/45">{featured.date} · {featured.author}</p>
            <h3 className="mt-2 font-serif text-2xl font-semibold leading-snug text-lank">{featured.titleFr}</h3>
            <p className="mt-3 max-w-3xl leading-relaxed text-lank/65">{featured.summaryFr}</p>
            <span className="mt-4 inline-block text-sm font-semibold text-fey">{tr('En savoir plus', 'Read more', 'Aprann plis')} →</span>
          </Link>
        )}
      </section>

      {/* Footer */}
      <footer className="bg-lank text-cream/75">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="flex flex-col gap-8 border-b border-cream/10 pb-8 md:flex-row md:justify-between">
            <div>
              <Logo size={30} tone="dark" />
              <p className="mt-4 max-w-xs font-serif text-cream/85">{tr('État de droit · accès au droit pour tous.', 'Rule of law · access to the law for all.', 'Eta dedwa · aksè ak dwa pou tout moun.')}</p>
            </div>
            <nav className="flex flex-col gap-2.5 text-sm">
              <span className="mb-1 font-mono text-[11px] uppercase tracking-wider text-sitwon">{tr('Informations légales', 'Legal', 'Enfòmasyon legal')}</span>
              <Link className="hover:text-sitwon" href={`/${locale}/cgu`}>{t.legal.cgu}</Link>
              <Link className="hover:text-sitwon" href={`/${locale}/confidentialite`}>{t.legal.confidentialite}</Link>
              <Link className="hover:text-sitwon" href={`/${locale}/mentions-legales`}>{t.legal.mentions}</Link>
            </nav>
            <nav className="flex flex-col gap-2.5 text-sm">
              <span className="mb-1 font-mono text-[11px] uppercase tracking-wider text-sitwon">{tr('Liens', 'Links', 'Lyen')}</span>
              <Link className="hover:text-sitwon" href={`/${locale}/publications`}>Publications</Link>
              <a className="hover:text-sitwon" href="mailto:legal@lam.ht">Contact</a>
              <a className="hover:text-sitwon" href="mailto:erreur@lam.ht?subject=Signalement%20d'une%20erreur">{tr('Signaler une erreur', 'Report an error', 'Siyale yon erè')}</a>
            </nav>
          </div>
          <div className="flex flex-wrap justify-between gap-3 pt-6 text-xs text-cream/45">
            <span>© 2026 Lam. {tr('Base de données contenant la reproduction des textes officiels.', 'A database containing the reproduction of official texts.', 'Baz done ki gen repwodiksyon tèks ofisyèl yo.')}</span>
            <span className="font-mono">Éditeur : Lam · 62 rue Geffrard, Pétion-Ville · Hébergeur : Vercel (USA) · DNSSEC</span>
          </div>
        </div>
      </footer>

      <CookieBanner
        text={tr(
          "Lam utilise des cookies strictement nécessaires (session, authentification, langue). Avec votre accord, des cookies d'analyse nous aident à améliorer la Plateforme.",
          'Lam uses strictly necessary cookies (session, authentication, language). With your consent, analytics cookies help us improve the Platform.',
          'Lam itilize cookies ki estrikteman nesesè (sesyon, otantifikasyon, lang). Ak akò ou, cookies analiz ede nou amelyore Platfòm nan.',
        )}
        accept={tr('Tout accepter', 'Accept all', 'Aksepte tout')}
        reject={tr('Refuser les non essentiels', 'Reject non-essential', 'Refize sa ki pa esansyèl')}
        manage={tr('Gérer', 'Manage', 'Jere')}
        manageHref={`/${locale}/confidentialite#s9`}
      />
    </div>
  )
}
