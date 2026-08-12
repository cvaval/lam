/**
 * MESURE DE VITESSE — un seul utilisateur, requêtes SÉQUENTIELLES.
 *
 *   node scripts/mesure-vitesse.mjs [origine] [repetitions]
 *
 * Pourquoi séquentiel : le pool Prisma est réglé à UNE connexion (`connection_limit=1`,
 * configuration normale de Supabase derrière PgBouncer). En local, `next start` est un
 * processus unique : deux requêtes concurrentes se mettent en file, et la mesure ne dit
 * plus rien de la page elle-même. Une requête à la fois isole le coût RÉEL du rendu.
 *
 * On distingue le PREMIER appel (compilation à la demande, cache froid, connexion à
 * établir) des suivants : seule la médiane à chaud décrit ce que vit un visiteur.
 */
const ORIGINE = process.argv[2] ?? 'http://localhost:3100'
const N = Number(process.argv[3] ?? 6)

const ROUTES = [
  ['accueil', '/fr'],
  ['accueil (en)', '/en'],
  ['publications', '/fr/publications'],
  ['article', '/fr/publications/egouvernance'],
  ['CGU', '/fr/cgu'],
  ['mentions légales', '/fr/mentions-legales'],
  ['connexion', '/fr/login'],
  ['inscription', '/fr/register'],
  ['carte (sans commune)', '/fr/juridictions'],
  ['carte + commune', '/fr/juridictions?commune=commune-ouest-port-au-prince'],
  ['carte + petite commune', '/fr/juridictions?commune=commune-grand-anse-abricots'],
  ['API points de carte', '/api/public/jurisdictions/map-points'],
]

const pct = (t, p) => t.slice().sort((a, b) => a - b)[Math.min(t.length - 1, Math.floor(t.length * p))]

async function mesurer(url) {
  const t0 = performance.now()
  const res = await fetch(ORIGINE + url, { redirect: 'manual' })
  await res.arrayBuffer() // corps entièrement lu : sans cela on ne mesure que l'en-tête
  return { ms: performance.now() - t0, statut: res.status }
}

console.log(`Origine : ${ORIGINE}   ·   ${N} appels par route, séquentiels\n`)
console.log('  route                       statut   à froid    médiane    p90      min')
const lents = []
for (const [nom, url] of ROUTES) {
  const froid = await mesurer(url)
  const chauds = []
  for (let i = 0; i < N; i++) chauds.push((await mesurer(url)).ms)
  const med = pct(chauds, 0.5)
  const p90 = pct(chauds, 0.9)
  const min = Math.min(...chauds)
  console.log(
    `  ${nom.padEnd(26)} ${String(froid.statut).padEnd(7)} ${(Math.round(froid.ms) + ' ms').padStart(8)}  ` +
    `${(Math.round(med) + ' ms').padStart(8)}  ${(Math.round(p90) + ' ms').padStart(7)}  ${(Math.round(min) + ' ms').padStart(7)}`,
  )
  if (med > 1000) lents.push([nom, Math.round(med)])
}

if (lents.length) {
  console.log(`\n  ⚠ Au-delà d'une seconde à chaud, un seul utilisateur :`)
  for (const [n, ms] of lents) console.log(`      ${n} — ${ms} ms`)
}
