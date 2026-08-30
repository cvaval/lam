/**
 * CONTRÔLE D'INTÉGRITÉ DES DONNÉES GÉNÉRÉES — à passer AVANT tout commit et AVANT tout --apply.
 *
 *     npx tsx scripts/verifier-empreintes-donnees.ts                 # vérifie tous les jeux
 *     npx tsx scripts/verifier-empreintes-donnees.ts energie-2016    # un seul jeu
 *     npx tsx scripts/verifier-empreintes-donnees.ts --ecrire energie-2016   # (re)pose le manifeste
 *
 * ─── POURQUOI CE SCRIPT EXISTE ─────────────────────────────────────────────────────────────
 * Le dépôt vit DANS DROPBOX. Le 29 août 2026, un `rmtree` + `copytree` destiné à restaurer des
 * données après un test de sabotage a produit une « copie en conflit » ET LAISSÉ EN PLACE LA
 * VERSION SABOTÉE — un renvoi `art-777` injecté exprès. Le contrôle d'empreinte disait
 * « INTACTE » à l'instant où il tournait : Dropbox a resynchronisé APRÈS.
 *
 * La leçon n'est pas « ne pas se tromper », c'est : **une vérification qui précède la
 * resynchronisation ne prouve rien**. Il faut donc un contrôle qu'on puisse rejouer À TOUT
 * MOMENT, notamment juste avant d'écrire en base ou de commiter — d'où le manifeste
 * `EMPREINTES.txt` déposé dans chaque jeu de données au moment où il est produit.
 *
 * Ce que le script regarde, dans l'ordre :
 *   1. AUCUNE « copie en conflit » nulle part dans le dépôt — c'est le signal le plus direct ;
 *   2. chaque jeu de `scripts/data/` qui porte un manifeste doit lui correspondre EXACTEMENT
 *      (fichier modifié, disparu ou apparu) ;
 *   3. pour les jeux SUIVIS PAR GIT, le répertoire de travail doit être identique à HEAD : une
 *      resynchronisation tardive qui rétablirait une ancienne version se voit ici, et nulle part
 *      ailleurs si l'on ne pense pas à regarder `git status`.
 *
 * Le manifeste ne se pose qu'avec `--ecrire`, et jamais automatiquement : un manifeste écrit
 * par-dessus une donnée déjà corrompue entérinerait la corruption au lieu de la signaler.
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const RACINE = process.cwd()
const DATA = join(RACINE, 'scripts/data')
const MANIFESTE = 'EMPREINTES.txt'
const args = process.argv.slice(2)
const ECRIRE = args.includes('--ecrire')
const CIBLES = args.filter((a) => !a.startsWith('--'))

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex')

/** Fichiers d'un jeu, triés, manifeste exclu. Récursif : certains jeux ont des sous-dossiers. */
function fichiers(dir: string, base = dir): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir).sort()) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...fichiers(p, base))
    else if (e !== MANIFESTE && e !== '.DS_Store') out.push(relative(base, p))
  }
  return out.sort()
}

function empreintes(dir: string): Map<string, string> {
  return new Map(fichiers(dir).map((f) => [f, sha(readFileSync(join(dir, f)))]))
}

function lireManifeste(dir: string): Map<string, string> {
  const m = new Map<string, string>()
  for (const l of readFileSync(join(dir, MANIFESTE), 'utf8').split('\n')) {
    if (!l.trim() || l.startsWith('#')) continue
    const i = l.indexOf('  ')
    if (i > 0) m.set(l.slice(i + 2).trim(), l.slice(0, i).trim())
  }
  return m
}

/** Vrai si `git` connaît ce chemin — un jeu non suivi n'a pas de HEAD à qui se comparer. */
function suiviParGit(rel: string): boolean {
  try {
    return execFileSync('git', ['ls-files', '--error-unmatch', rel], { stdio: ['ignore', 'pipe', 'ignore'] }).length > 0
  } catch { return false }
}

function main() {
  let defauts = 0

  // ── 1. copies en conflit ────────────────────────────────────────────────────────────────
  // Dropbox les sème sans prévenir ; une seule dans `scripts/data/` suffit à rendre une donnée
  // douteuse. On cherche dans TOUT le dépôt, y compris hors de scripts/data.
  const conflits = execFileSync('bash', ['-c',
    `find "${RACINE}" -name "*conflicted copy*" -not -path "*/node_modules/*" 2>/dev/null || true`],
    { encoding: 'utf8' }).split('\n').filter(Boolean)
  if (conflits.length) {
    defauts += conflits.length
    console.log(`⚠️ ${conflits.length} COPIE(S) EN CONFLIT — Dropbox a dupliqué des fichiers :`)
    for (const c of conflits.slice(0, 12)) console.log(`     ${relative(RACINE, c)}`)
    if (conflits.length > 12) console.log(`     … et ${conflits.length - 12} autres`)
    console.log('   Ne rien commiter ni appliquer avant d’avoir tranché lequel fait foi.\n')
  } else console.log('✓ aucune copie en conflit dans le dépôt\n')

  // ── 2 & 3. les jeux de données ──────────────────────────────────────────────────────────
  const jeux = readdirSync(DATA).filter((d) => statSync(join(DATA, d)).isDirectory()).sort()
  const vises = CIBLES.length ? jeux.filter((j) => CIBLES.includes(j)) : jeux
  if (CIBLES.length && vises.length !== CIBLES.length)
    throw new Error(`jeu(x) introuvable(s) : ${CIBLES.filter((c) => !jeux.includes(c)).join(', ')}. STOP`)

  if (ECRIRE) {
    if (!CIBLES.length) throw new Error('--ecrire exige un jeu nommé : on ne pose pas des manifestes en masse. STOP')
    for (const j of vises) {
      const dir = join(DATA, j)
      const e = empreintes(dir)
      const lignes = [
        `# Empreintes SHA-256 du jeu « ${j} » — posées à la production des données.`,
        '# Rejouer : npx tsx scripts/verifier-empreintes-donnees.ts ' + j,
        '# Le dépôt vit dans Dropbox : une resynchronisation tardive peut rétablir une version',
        '# ancienne APRÈS toute vérification. Ce manifeste est le seul contrôle rejouable.',
        ...[...e].map(([f, h]) => `${h}  ${f}`),
      ]
      writeFileSync(join(dir, MANIFESTE), lignes.join('\n') + '\n', 'utf8')
      console.log(`✓ manifeste posé : ${j} — ${e.size} fichiers`)
    }
    return
  }

  let avec = 0
  for (const j of vises) {
    const dir = join(DATA, j)
    const rel = relative(RACINE, dir)
    if (!existsSync(join(dir, MANIFESTE))) {
      if (CIBLES.length) console.log(`—  ${j.padEnd(26)} sans manifeste (le poser : --ecrire ${j})`)
      continue
    }
    avec++
    const attendu = lireManifeste(dir)
    const trouve = empreintes(dir)
    const changes = [...attendu].filter(([f, h]) => trouve.has(f) && trouve.get(f) !== h).map(([f]) => f)
    const disparus = [...attendu.keys()].filter((f) => !trouve.has(f))
    const apparus = [...trouve.keys()].filter((f) => !attendu.has(f))
    // Une resynchronisation tardive peut aussi RÉTABLIR une version déjà commitée : le
    // répertoire de travail cesse alors d'être identique à HEAD sans que personne n'ait édité.
    let ecartGit: string[] = []
    if (suiviParGit(rel)) {
      const s = execFileSync('git', ['status', '--porcelain', '--', rel], { encoding: 'utf8' })
      ecartGit = s.split('\n').filter(Boolean)
    }
    const n = changes.length + disparus.length + apparus.length + ecartGit.length
    defauts += n
    console.log(`${n ? '✗' : '✓'} ${j.padEnd(26)} ${trouve.size} fichiers${n ? '' : ' — conformes au manifeste et à HEAD'}`)
    for (const f of changes) console.log(`     MODIFIÉ  ${f}`)
    for (const f of disparus) console.log(`     DISPARU  ${f}`)
    for (const f of apparus) console.log(`     APPARU   ${f}`)
    for (const l of ecartGit) console.log(`     ÉCART GIT ${l}`)
  }
  const sans = vises.length - avec
  console.log(`\n${avec} jeu(x) sous manifeste, ${sans} sans.`)
  if (defauts) { console.log(`\n⚠️ ${defauts} défaut(s) — NE RIEN COMMITER NI APPLIQUER en l’état.`); process.exit(1) }
  console.log('Rien à signaler.')
}

try { main() } catch (e) {
  const m = e instanceof Error ? e.message : String(e)
  console.error('ÉCHEC :', m.trim() ? m : e); process.exit(1)
}
