/**
 * Contrôle de COMPLÉTUDE des fascicules du Moniteur avant versement (lecture seule).
 *
 *   npx tsx scripts/controle-completude-moniteur.ts --inventaire <dossier> --sortie <fichier.json>
 *     [--refs LM2022-111,LM2022-113] [--concurrence 8] [--toutes-pages]
 *
 * `--toutes-pages` (avec --refs) : lit CHAQUE page et imprime la suite des numéros —
 * pour voir quelles pages manquent ou sont en double dans un fascicule signalé.
 *
 * <dossier> : les <année>.json de `import-moniteur-pdf.ts --inventaire-json`. Seuls les
 * fascicules « à verser » sont lus. Pour chacun, la DERNIÈRE page (image) est lue par l'IA
 * (Claude, `LV_AI_MODEL`, défaut claude-haiku-5-5) : numéro de page imprimé dans le titre
 * courant, présence du pied d'imprimeur (« Presses Nationales d'Haïti … Tirage »).
 *
 * ⚠️ LE NOMBRE DE PAGES NE SUFFIT PAS. Juillet 2022 : « No. 111 » et « No. 113 » ont DEUX
 * pages — la 1 et la 12 ; les pages 2 à 11 manquent. Un compte pair, une manchette, un pied
 * d'imprimeur : tout paraît normal. Seul le numéro imprimé sur la dernière page le dit.
 * Deux signaux, donc :
 *  - numéro de la dernière page ≠ nombre de pages du fichier → pages manquantes au milieu ;
 *  - pas de pied d'imprimeur → la ou les dernières pages manquent (le Moniteur se ferme
 *    toujours sur l'achevé d'imprimer des Presses nationales).
 * Le script ne décide rien : il signale, on regarde la page, la règle des 20 % tranche.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod/v4'

const MODELE = process.env.LV_AI_MODEL || 'claude-haiku-5-5'

const PROMPT = `Cette image est la DERNIÈRE page d'un fichier scanné du journal officiel haïtien « Le Moniteur ».
1. numeroPage : le numéro de page IMPRIMÉ dans le titre courant en haut de la page (ex. « 12 << LE MONITEUR >> N° 111 - Mardi 12 Juillet 2022 » ⇒ 12 ; « N° 5 - Mardi 10 Janvier 2023 << LE MONITEUR >> 3 » ⇒ 3). null si la page n'a pas de titre courant (première page avec la manchette « Le Moniteur ») ou si le numéro est illisible.
2. premierePage : true si cette page porte la grande manchette « Le Moniteur » (c'est alors la page 1).
3. piedImprimeur : true si le bas de la page porte la mention de l'imprimeur (« Presses Nationales d'Haïti », « Achevé d'imprimer », « Tirage : … exemplaires » ou « Dépôt légal … ISSN »).
Réponds uniquement par l'objet JSON demandé.`

const Lecture = z.object({
  numeroPage: z.number().int().nullable(),
  premierePage: z.boolean(),
  piedImprimeur: z.boolean(),
})

interface Fascicule {
  ref: string
  statut: string
  fichiers: string[]
}

function pages(fichier: string): number {
  const m = execFileSync('pdfinfo', [fichier], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).match(/^Pages:\s+(\d+)/m)
  return m ? Number(m[1]) : 0
}

/** Une page en JPEG gris, ≈ 1 000 px de haut (lisible, peu coûteux). */
function derniereImage(fichier: string, n: number, dossier: string): string {
  const base = join(dossier, `p${n}`)
  execFileSync('pdftoppm', ['-f', String(n), '-l', String(n), '-scale-to', '1000', '-gray', '-jpeg', '-singlefile', fichier, base], {
    stdio: 'ignore',
  })
  return readFileSync(`${base}.jpg`).toString('base64')
}

async function appel<T>(fn: () => Promise<T>): Promise<T> {
  for (let essai = 1; ; essai++) {
    try {
      return await fn()
    } catch (e) {
      const status = (e as { status?: number }).status
      if (essai >= 5 || !(status === 429 || status === 500 || status === 529 || status === undefined)) throw e
      await new Promise((r) => setTimeout(r, 2000 * 2 ** (essai - 1)))
    }
  }
}

async function main() {
  const args = process.argv.slice(2)
  const opt = (nom: string) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : undefined)
  const dossierInv = opt('--inventaire')
  const sortie = opt('--sortie')
  if (!dossierInv || !sortie) throw new Error('--inventaire <dossier> et --sortie <fichier.json> requis')
  const refs = opt('--refs')?.split(',')
  const concurrence = Number(opt('--concurrence') ?? 8)

  const fascicules: Fascicule[] = readdirSync(dossierInv)
    .filter((f) => /^\d{4}\.json$/.test(f))
    .flatMap((f) => (JSON.parse(readFileSync(join(dossierInv, f), 'utf8')) as { fascicules: Fascicule[] }).fascicules)
    .filter((x) => x.statut === 'a-verser' && (!refs || refs.includes(x.ref)))

  const client = new Anthropic()
  const lire = async (fichier: string, n: number, tmp: string) => {
    const image = derniereImage(fichier, n, tmp)
    const r = await appel(() =>
      client.messages.parse({
        model: MODELE,
        max_tokens: 400,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
              { type: 'text', text: PROMPT },
            ],
          },
        ],
        output_config: { format: zodOutputFormat(Lecture) },
      }),
    )
    return { lecture: r.parsed_output!, jetons: r.usage.input_tokens + r.usage.output_tokens }
  }

  if (args.includes('--toutes-pages')) {
    for (const x of fascicules) {
      const tmp = mkdtempSync(join(tmpdir(), 'completude-'))
      const suite: string[] = []
      for (const f of x.fichiers) {
        const n = pages(f)
        const lus = await Promise.all(Array.from({ length: n }, (_, k) => lire(f, k + 1, tmp)))
        for (const { lecture: l } of lus) suite.push(`${l.premierePage ? 'M' : (l.numeroPage ?? '?')}${l.piedImprimeur ? '■' : ''}`)
      }
      rmSync(tmp, { recursive: true, force: true })
      console.log(`${x.ref.padEnd(16)} ${suite.join(' ')}`)
    }
    console.log('(M = manchette ; ■ = pied d’imprimeur ; ? = numéro illisible)')
    return
  }

  const resultats: Record<string, unknown>[] = []
  let i = 0
  let jetons = 0
  await Promise.all(
    Array.from({ length: Math.min(concurrence, fascicules.length) }, async () => {
      while (i < fascicules.length) {
        const x = fascicules[i++]
        const total = x.fichiers.reduce((s, f) => s + pages(f), 0)
        const dernier = x.fichiers[x.fichiers.length - 1]
        const tmp = mkdtempSync(join(tmpdir(), 'completude-'))
        try {
          const { lecture: l, jetons: j } = await lire(dernier, pages(dernier), tmp)
          jetons += j
          const signaux: string[] = []
          if (l.numeroPage != null && l.numeroPage !== total) signaux.push(`dernière page numérotée ${l.numeroPage} pour ${total} page(s) dans le fichier`)
          if (!l.piedImprimeur) signaux.push("pas de pied d'imprimeur sur la dernière page")
          resultats.push({ ref: x.ref, pages: total, ...l, signaux })
          if (signaux.length) console.log(`⚠ ${x.ref.padEnd(16)} ${signaux.join(' ; ')}`)
        } catch (e) {
          resultats.push({ ref: x.ref, pages: total, erreur: (e as Error).message.slice(0, 200) })
          console.log(`✗ ${x.ref} : ${(e as Error).message.slice(0, 120)}`)
        } finally {
          rmSync(tmp, { recursive: true, force: true })
        }
      }
    }),
  )
  resultats.sort((a, b) => String(a.ref).localeCompare(String(b.ref), 'fr', { numeric: true }))
  writeFileSync(sortie, JSON.stringify(resultats, null, 1))
  const signales = resultats.filter((r) => (r.signaux as string[] | undefined)?.length || r.erreur)
  console.log(`\n${resultats.length} fascicules lus (${MODELE}) · ${signales.length} signalés · ${jetons.toLocaleString('fr-FR')} jetons → ${sortie}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
