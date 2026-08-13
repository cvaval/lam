/**
 * RÉPARATION DE CIRCULAIRES BRH DONT LE TEXTE STOCKÉ EST ABÎMÉ.
 *
 *   npx tsx scripts/reparer-circulaires-brh.ts                  (à blanc)
 *   npx tsx scripts/reparer-circulaires-brh.ts --apply          (écrit)
 *   npx tsx scripts/reparer-circulaires-brh.ts --avec-126 …     (inclut la 126)
 *
 * ⚠️ CE N'EST PAS UN RÉ-IMPORT. On écrit sur TROIS FICHES DÉSIGNÉES PAR IDENTIFIANT, et
 * uniquement leur corps. `scripts/import-brh` purge et réimporte : il effacerait les
 * enrichissements ET les statuts d'abrogation posés à la main.
 *
 * ⚠️ ON TRAVAILLE PAR IDENTIFIANT, JAMAIS PAR NUMÉRO. Deux fiches portent « Circulaire
 * n° 118-1 » : le texte du 23 août 2022, qui est SAIN, et la note additionnelle du
 * 7 octobre, qui est abîmée. Une sélection par numéro attraperait la mauvaise.
 *
 * ⚠️ `bodyClean` A LA PRIORITÉ À L'AFFICHAGE (`doc.bodyClean ?? doc.bodyOriginal`). Sur les
 * fiches qui en portent un, il dérive du MÊME OCR abîmé : remplacer `bodyOriginal` seul ne
 * changerait rien à l'écran et la réparation passerait pour faite. On régénère donc les deux
 * — et on ne CRÉE pas de `bodyClean` là où il n'y en avait pas, pour ne pas changer la forme
 * d'une fiche au passage.
 *
 * ⚠️ AUCUNE CORRECTION AUTOMATIQUE DU TEXTE. Pas de réaccentuation, pas de correcteur, pas
 * d'IA sur le corps : on SUBSTITUE un texte propre, on n'en fabrique pas.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import mammoth from 'mammoth'
import { prisma } from '../src/lib/db'
import { wordToHtmlVersion } from '../src/lib/doc/word'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'

const DIR = '/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur/CIRCULAIRES-BRH'

interface Cible {
  id: string
  libelle: string
  fichier: string
  /** La 126 est une RECONSTITUTION : arbitrage éditorial, donc opt-in explicite. */
  optionnel?: boolean
}

const CIBLES: Cible[] = [
  { id: 'cmqbnm0ek001gsmfzqf4tbikg', libelle: 'n° 131 — protection des consommateurs', fichier: 'Circulaire 131.docx' },
  { id: 'cmqbnm0dv0012smfzm1kkb09z', libelle: 'n° 118-1 — note additionnelle', fichier: '118-1_Circulaire_NA.docx' },
  { id: 'cmqbnm0e9001asmfzluo36gfh', libelle: 'n° 126 — sécurité informatique (RECONSTITUÉ)', fichier: '126_Circulaire_RECONSTITUE.docx', optionnel: true },
]

/** Mesure du défaut — c'est elle qui atteste la réparation, pas une déclaration de succès. */
function defauts(s: string) {
  const lignes = s.split('\n').filter((l) => l.trim().length > 60)
  return {
    remplacement: (s.match(/�/g) ?? []).length,
    chiffresMutiles: (s.match(/\b[0-9]+ [IlO] [0-9]+\b|\b[IlO] [0-9]{1,3}\b/g) ?? []).length,
    lignesLongues: lignes.length,
    lignesSansAccent: lignes.filter((l) => !/[éèêëàâäçùûüôöîï]/i.test(l)).length,
  }
}
const fmt = (d: ReturnType<typeof defauts>) =>
  `� ${d.remplacement} · chiffres mutilés ${d.chiffresMutiles} · lignes sans accent ${d.lignesSansAccent}/${d.lignesLongues}`

async function main() {
  const apply = process.argv.includes('--apply')
  const avec126 = process.argv.includes('--avec-126')
  const cibles = CIBLES.filter((c) => !c.optionnel || avec126)
  console.log(`Réparation de ${cibles.length} fiche(s) · ${apply ? 'ÉCRITURE' : 'à blanc'}${avec126 ? '' : ' · 126 exclue (--avec-126 pour l’inclure)'}\n`)

  const sauvegarde: Record<string, unknown>[] = []
  let repares = 0
  let inchanges = 0

  for (const c of cibles) {
    const doc = await prisma.document.findUnique({ where: { id: c.id } })
    if (!doc) { console.error(`✗ ${c.libelle} : identifiant introuvable (${c.id})`); continue }
    // GARDE-FOU de type : ne jamais écrire, par cette voie, sur autre chose qu'une circulaire.
    if (doc.type !== 'CIRCULAIRE_BRH') { console.error(`✗ ${c.libelle} : type ${doc.type} — refusé`); continue }

    const buf = readFileSync(join(DIR, c.fichier))
    const rawText = (await mammoth.extractRawText({ buffer: buf })).value.trim()
    if (!rawText) { console.error(`✗ ${c.libelle} : fichier vide`); continue }

    // On ne régénère `bodyClean` et les tableaux QUE si la fiche en portait déjà : la
    // réparation restaure la même forme de fiche avec un texte propre, elle ne la change pas.
    const avaitClean = !!doc.bodyClean
    const avaitBlocs = !!doc.richBlocksJson
    let bodyClean: string | null = doc.bodyClean
    let richBlocksJson: string | null = doc.richBlocksJson
    if (avaitClean || avaitBlocs) {
      const v = await wordToHtmlVersion(buf)
      if (avaitClean) bodyClean = v.bodyClean
      if (avaitBlocs) {
        const avant = JSON.parse(doc.richBlocksJson!).length as number
        const apres = v.richBlocks.length
        // ⚠️ Un tableau qui ne correspond plus à son texte est PIRE qu'un tableau absent :
        // le lecteur croit lire les chiffres de la circulaire. Si l'extraction n'en rend
        // pas autant, on retire le bloc et le lecteur est renvoyé au fac-similé.
        if (apres >= avant) {
          richBlocksJson = JSON.stringify(v.richBlocks)
          console.log(`   tableaux : ${avant} → ${apres} (régénérés)`)
        } else {
          richBlocksJson = null
          console.log(`   ⚠ tableaux : ${avant} → ${apres} — RETIRÉS plutôt que désaccordés du texte`)
        }
      }
    }

    const avant = defauts(doc.bodyOriginal ?? '')
    const apres = defauts(rawText)
    console.log(`${c.libelle}`)
    console.log(`   avant : ${doc.bodyOriginal?.length ?? 0} car. · ${fmt(avant)}`)
    console.log(`   après : ${rawText.length} car. · ${fmt(apres)}`)

    if (doc.bodyOriginal === rawText && bodyClean === doc.bodyClean && richBlocksJson === doc.richBlocksJson) {
      console.log('   = inchangé\n')
      inchanges++
      continue
    }
    if (!apply) { console.log('   · à écrire (--apply)\n'); continue }

    // SAUVEGARDE AVANT ÉCRITURE. Sans elle, une erreur découverte trois semaines plus tard
    // est irréparable.
    sauvegarde.push({
      id: doc.id, number: doc.number, titleFr: doc.titleFr,
      bodyOriginal: doc.bodyOriginal, bodyClean: doc.bodyClean, richBlocksJson: doc.richBlocksJson,
    })

    await prisma.document.update({
      where: { id: doc.id },
      data: { bodyOriginal: rawText, bodyClean, richBlocksJson },
    })
    // Sans réindexation, la recherche continuerait de répondre sur l'ancien texte.
    await reindexDocument(doc.id)
    await audit({
      action: 'DOC_PUBLISHED',
      targetType: 'Document',
      targetId: doc.id,
      meta: {
        via: 'reparer-circulaires-brh', fichier: c.fichier,
        avant: doc.bodyOriginal?.length ?? 0, apres: rawText.length,
        lignesSansAccentAvant: avant.lignesSansAccent, lignesSansAccentApres: apres.lignesSansAccent,
      },
    })
    console.log('   ✓ réparée\n')
    repares++
  }

  if (sauvegarde.length) {
    const dir = join(homedir(), 'lam-backups', 'reparations')
    mkdirSync(dir, { recursive: true })
    const chemin = join(dir, `brh-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    writeFileSync(chemin, JSON.stringify(sauvegarde, null, 1))
    console.log(`Sauvegarde des corps remplacés : ${chemin}`)
  }
  console.log(`\nréparées : ${repares} · inchangées : ${inchanges}`)
  if (!apply) console.log('(exécution à blanc — ajouter --apply pour écrire)')
  await prisma.$disconnect()
}
main()
