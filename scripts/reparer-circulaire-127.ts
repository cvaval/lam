/**
 * Circulaire BRH n° 127 du 13 janvier 2022 — Intermédiaires de change.
 * RÉPARATION du corps (abîmé par l'OCR) + pose du LECTEUR ANNOTÉ (sommaire, index, renvois).
 *
 *     npx tsx scripts/reparer-circulaire-127.ts                # SIMULATION
 *     npx tsx scripts/reparer-circulaire-127.ts --voir=art-2-2 # aperçu d'une division
 *     npx tsx scripts/reparer-circulaire-127.ts --apply        # écriture
 *
 * Gabarit : scripts/_import-circ-brh-105-2-117-1.ts. Données : scripts/data/circ-brh-127/.
 * La cible est résolue PAR ID puis contre-vérifiée par (type, number) — jamais par le titre.
 *
 * ── PIÈGES RENCONTRÉS, tous mesurés et non supposés ─────────────────────────────────────
 *
 *  1. INDEX EN POINTS, ANCRES EN TIRETS. Le rendu fabrique le lien BRUT
 *     (`href={\`#art-${r}\`}` — CodeSidebar.tsx:353, AnnotatedText.tsx:266) alors que
 *     anchorFromDesignation('2.1.1') pose l'id « art-2-1-1 ». Douze divisions — tout le cœur
 *     « Critères d'agrément » — étaient citées « 2.1.1 » dans indexEntries.ctRefs : 13 liens
 *     morts, et indexBacklinks (annotated.ts) n'aurait rien trouvé, donc PAS de pastille
 *     « INDEX » sous ces divisions. Les ctRefs sont écrits en TIRETS ; prettyRef les
 *     RÉ-AFFICHE « 2.1.1 ». Le garde-fou 6 refuse tout point restant.
 *
 *  2. `source` = 'BRH' AUJOURD'HUI, ce qui est un piège de DURABILITÉ : import-brh.ts
 *     --commit fait `deleteMany({ where: { source: 'BRH' } })` — la réparation serait
 *     effacée au prochain ré-import. D'où la source dédiée CIRC_BRH_127 (patron 105-2 /
 *     117-1) ET l'ajout de '127_Circulaire.pdf' à SUPERSEDED_BY_WEB dans import-brh.ts,
 *     faute de quoi ce ré-import recréerait un DOUBLON source='BRH'. Garde-fou 14.
 *
 *  3. richBlocksJson N'EST PAS VIDE : 39 blocs sont en base, dont les ANCRES
 *     (afterText/untilText) et une partie du TEXTE sont de l'OCR — « RESPONSABLE DE LA
 *     PRESENT ATION », « MODELES DE LEITRE », « ANNEXE Ill », « Pièœs ». Mesuré : contre le
 *     corps réparé, 21 des 39 blocs tombaient ORPHELINS (9 aujourd'hui) et les bandeaux
 *     auraient réintroduit l'OCR à l'écran. 35 substitutions, chacune ramenée à une ligne du
 *     corps réparé, portent les orphelins à 3 — moins qu'aujourd'hui. Garde-fous 11 et 12.
 *
 *  4. EN MODE ANNOTÉ, les ancres afterText/untilText NE SERVENT PLUS : AnnotatedText
 *     répartit les tableaux par `rowsOf` (les rangées aplaties « a | b | c » du corps).
 *     Le corps réparé n'en contient AUCUNE (les cellules y sont une par ligne) ⇒ mesuré,
 *     0 des 39 blocs est rendu par le lecteur annoté. richBlocksJson reste néanmoins UTILE
 *     et corrigé : il alimente le téléchargement d'annexes (/api/doc/[id]/annexes, Word et
 *     Excel) et redeviendrait la mise en page si les annotations étaient retirées.
 *
 *  5. ARBITRAGE 2 (les 13 notes de bas de page en annotations, ancrées sur les appels
 *     ¹..¹³) : NON EXÉCUTÉ, faute de mécanisme. `commentaires` a pour clé le jurisKey, et
 *     segmentAnnotated n'en attribue qu'aux blocs porteurs d'une ancre art- ; les 13 appels
 *     sont tous dans les annexes II et III, qui n'en portent aucune (mesuré). Le remède par
 *     le toc est disqualifiant : il faudrait inscrire en en-têtes six QUESTIONS des
 *     questionnaires et priver le dispositif de art-1 à art-3, si bien que « #art-1 »
 *     désignerait un modèle de lettre et non le point 1. UNE VOIE RESTE OUVERTE, à trancher
 *     par la cliente : Annotations.crossRefs a pour clé une ANCRE DE SECTION et porte un
 *     champ `note` libre, rendu sous l'en-tête (AnnotatedText, cas `articles: []`) — les 13
 *     notes pourraient être groupées en tête de l'annexe II et de chacun des 3 modèles de
 *     l'annexe III, sans toucher au dispositif ni aux questionnaires, mais placées en TÊTE
 *     de modèle et intitulées « Renvoi » au lieu de « Note ». En l'état, les 13 appels
 *     restent dans le corps et les 13 textes au PIED du modèle qu'ils servent — la
 *     disposition exacte du fac-similé (p. 26-29). Rien n'est perdu, 0 clé orpheline.
 *
 *  6. seenArt : seule la PREMIÈRE occurrence d'une désignation reçoit son ancre ; les
 *     suivantes reçoivent noAnchors. C'est l'effet RECHERCHÉ ici — les 8 autres occurrences
 *     de chaque désignation (têtes de tableaux « 5. Nom du comité », questions 1. à 16. des
 *     questionnaires) sont rendues inertes. Les ancres réelles se comptent donc
 *     « b.anchor && !b.noAnchors ».
 *
 *  7. `kind:'connexe'` n'est JAMAIS utilisé (verrou à sens unique). Garde-fou 0.
 */
import { readFileSync, existsSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    }),
)
for (const k of ['DATABASE_URL', 'DIRECT_URL']) if (env[k]) process.env[k] = env[k]

import { prisma } from '../src/lib/db'
import { buildSearchText } from '../src/lib/search/normalize'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'
import { segmentAnnotated, type Annotations } from '../src/lib/legislation/annotated'
import { parseRichBlocks, buildBodySegments } from '../src/lib/doc/richblocks'
import { parseCirculaireRef } from '../src/lib/brh/gaps'

const DATA = 'scripts/data/circ-brh-127/reparation.json'
const PAGE_TSX = 'src/app/[locale]/(app)/doc/[id]/page.tsx'
const IMPORT_BRH = 'scripts/import-brh.ts'
const NUMBER = 'Circulaire n° 127'
const SOURCE_CIBLE = 'CIRC_BRH_127'
const AVIS_SOURCE = 'AVIS_LD_AGENTS_CHANGE_2020'
const JETON = '__AVIS_LIGNES_DIRECTRICES_ID__'

const APPLY = process.argv.includes('--apply')
const FORCE = process.argv.includes('--force')
const VOIR = process.argv.find((a) => a.startsWith('--voir='))?.slice(7)

function fail(msg: string): never {
  throw new Error(`${msg} — annulé`)
}

/** Substitutions appliquées aux CHAÎNES du JSON (jamais au JSON brut : un « \t » injecté
 *  dans la source ferait un caractère de contrôle et casserait le parse). */
function corrigerRich(raw: string, subs: [string, string][]): { json: string; counts: Map<string, number> } {
  const counts = new Map<string, number>()
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') {
      let out = v
      for (const [a, b] of subs) {
        if (out.includes(a)) {
          counts.set(a, (counts.get(a) ?? 0) + (out.split(a).length - 1))
          out = out.split(a).join(b)
        }
      }
      return out
    }
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, walk(x)]))
    return v
  }
  return { json: JSON.stringify(walk(JSON.parse(raw))), counts }
}

async function main() {
  const pack = JSON.parse(readFileSync(DATA, 'utf8'))
  const body: string = pack.body
  const ann = pack.annotations as Annotations & { indexEntries: { subject: string; ctRefs: string[] }[] }
  const subs: [string, string][] = pack.richCorrections

  // ══ Cible : résolution par ID, contre-vérifiée par (type, number) ══════════════════════
  const doc = await prisma.document.findUnique({
    where: { id: pack.document.id },
    select: { id: true, type: true, number: true, source: true, status: true, sealed: true, titleFr: true, matiere: true, publicationDate: true, bodyOriginal: true, bodyClean: true, annotationsJson: true, richBlocksJson: true, searchText: true },
  })
  if (!doc) fail(`document ${pack.document.id} introuvable`)
  if (doc.type !== 'CIRCULAIRE_BRH' || doc.number !== NUMBER) fail(`cible inattendue : type=${doc.type} number=${doc.number} (attendu CIRCULAIRE_BRH / ${NUMBER})`)
  if (!parseCirculaireRef(doc.number)) fail(`numéro non canonique : ${doc.number}`)
  const parSource = await prisma.document.findMany({ where: { source: SOURCE_CIBLE }, select: { id: true } })
  if (parSource.some((d) => d.id !== doc.id)) fail(`un AUTRE document porte déjà source=${SOURCE_CIBLE} : ${parSource.map((d) => d.id).join(', ')}`)
  // idempotence : ne jamais écraser un appareil déjà posé sans le dire
  if (doc.annotationsJson && doc.annotationsJson.length > 2 && !FORCE) {
    fail(`annotationsJson n'est PAS vide (${doc.annotationsJson.length} car.) — relancer avec --force pour l'écraser`)
  }

  // ══ Jeton du renvoi réciproque ═════════════════════════════════════════════════════════
  const avis = await prisma.document.findFirst({ where: { source: AVIS_SOURCE }, select: { id: true, titleFr: true, status: true } })
  const brut = JSON.stringify(ann)
  let jetonEnAttente = false
  if (brut.includes(JETON)) {
    if (!avis) {
      // L'ÉCRITURE est refusée tant que le jeton subsiste ; la SIMULATION continue avec un
      // id fictif pour que les treize autres contrôles soient tout de même exercés.
      if (APPLY) {
        fail(
          `le renvoi vers l'Avis / Lignes directrices du 14 décembre 2020 porte encore le jeton ${JETON} ` +
            `et aucun document ne porte source=${AVIS_SOURCE}. Lancer d'abord : npx tsx scripts/import-avis-lignes-directrices-brh.ts --apply`,
        )
      }
      jetonEnAttente = true
      // le bloc est écarté de la mesure des liens sortants : sa cible n'existe pas encore
      for (const [k, arr] of Object.entries(ann.connexe ?? {})) {
        ;(ann.connexe as any)[k] = arr.filter((b) => b.docId !== JETON)
      }
    } else {
      Object.assign(ann, JSON.parse(brut.split(JETON).join(avis.id)))
    }
  }

  // ══ Garde-fous BLOQUANTS, tous avant la moindre écriture ═══════════════════════════════
  const blocks = segmentAnnotated(body, ann.toc, ann.pointAnchors)
  const secs = blocks.filter((b) => b.kind === 'section').map((b) => b.anchor)
  const arts = blocks.filter((b) => b.kind === 'body' && b.anchor && !b.noAnchors).map((b) => b.anchor as string)
  const ids = [...secs, ...arts]
  const anchorSet = new Set(ids)

  // 0 — le verrou à sens unique ne doit jamais être armé
  if (ann.toc.some((t) => t.kind === 'connexe')) fail("toc : kind:'connexe' arme inAnnexe et prive d'ancre tout ce qui suit")
  // 1 — appariement sommaire ↔ corps
  if (secs.length !== ann.toc.length) {
    const vus = new Set(blocks.filter((b) => b.kind === 'section').map((b) => (b as any).text))
    fail(`sommaire ${secs.length}/${ann.toc.length} apparié — introuvables : ${ann.toc.filter((t) => !vus.has(t.label)).map((t) => t.label).slice(0, 8).join(' | ')}`)
  }
  // 2 — toutes les divisions déclarées portent leur ancre
  const wanted = (ann.pointAnchors ?? []).map((p) => `art-${p.replace(/\./g, '-')}`)
  const missing = wanted.filter((a) => !arts.includes(a))
  if (missing.length) fail(`divisions non ancrées : ${missing.join(', ')}`)
  if (arts.length !== wanted.length) fail(`${arts.length} ancres art- pour ${wanted.length} divisions déclarées : ${arts.filter((a) => !wanted.includes(a)).join(', ')} en trop`)
  // 3 — zéro identifiant HTML en double
  const dup = ids.filter((a, i) => ids.indexOf(a) !== i)
  if (dup.length) fail(`ancres dupliquées : ${[...new Set(dup)].join(', ')}`)
  // 4 — aucune ligne perdue à la segmentation
  if (blocks.map((b) => b.text).join('\n') !== body) fail('texte perdu à la segmentation')
  // 5 — libellés
  const labelMiss = Object.keys(ann.labels ?? {}).filter((a) => !arts.includes(a))
  if (labelMiss.length) fail(`libellés sans ancre : ${labelMiss.join(', ')}`)
  // 6 — index : ctRefs en TIRETS (piège 1) puis zéro renvoi mort, zéro division hors index
  const pointu = ann.indexEntries.flatMap((e) => e.ctRefs.map(String)).filter((r) => r.includes('.'))
  if (pointu.length) fail(`index : ctRefs en POINTS (le rendu fabrique #art-${pointu[0]}, l'ancre posée est art-${pointu[0].replace(/\./g, '-')}) : ${[...new Set(pointu)].join(', ')}`)
  const idxRefs = ann.indexEntries.flatMap((e) => [...e.ctRefs.map((r) => `art-${r}`), ...(((e as any).docRefs ?? []) as any[]).map((d) => d.anchor).filter(Boolean)])
  const deadIdx = idxRefs.filter((a) => !anchorSet.has(a))
  if (deadIdx.length) fail(`index : renvois morts ${[...new Set(deadIdx)].join(', ')}`)
  const covered = new Set(idxRefs)
  const uncovered = ids.filter((a) => !covered.has(a))
  if (uncovered.length) fail(`divisions hors index : ${uncovered.slice(0, 12).join(', ')}${uncovered.length > 12 ? ` (+${uncovered.length - 12})` : ''}`)
  // 7 — navToc
  const navDead = (JSON.stringify(ann.navToc).match(/"anchor":"([^"]+)"/g) ?? []).map((s) => s.slice(10, -1)).filter((a) => !anchorSet.has(a))
  if (navDead.length) fail(`navToc : ancres mortes ${[...new Set(navDead)].join(', ')}`)
  // 8 — connexe (clé = ancre) et commentaires (clé = jurisKey DÉRIVÉ)
  const cxDead = Object.keys(ann.connexe ?? {}).filter((a) => !anchorSet.has(a))
  if (cxDead.length) fail(`connexe : clés orphelines ${cxDead.join(', ')}`)
  const jurisKeys = new Set(blocks.flatMap((b) => (b.kind === 'body' && b.jurisKey ? [b.jurisKey] : [])))
  const commDead = Object.keys(ann.commentaires ?? {}).filter((k) => !jurisKeys.has(k))
  if (commDead.length) fail(`commentaires : clés orphelines ${commDead.join(', ')} (clés vivantes : ${[...jurisKeys].slice(0, 6).join(', ')}…)`)
  // 9 — liens sortants vivants, et un renvoi vers un texte ABROGÉ doit le dire
  const linked = [...new Set(Object.values(ann.connexe ?? {}).flat().map((b) => b.docId).filter(Boolean))] as string[]
  const cibles = await prisma.document.findMany({ where: { id: { in: linked } }, select: { id: true, titleFr: true, status: true } })
  const found = new Map(cibles.map((d) => [d.id, d]))
  const orphanLinks = linked.filter((id) => !found.has(id))
  if (orphanLinks.length) fail(`liens morts : ${orphanLinks.join(', ')}`)
  const muets = Object.values(ann.connexe ?? {})
    .flat()
    .filter((b) => b.docId && found.get(b.docId)!.status === 'ABROGE' && !/abrog|remplac|antérieur/i.test(`${b.label} ${b.text}`))
    .map((b) => b.label)
  if (muets.length) fail(`renvoi vers un texte ABROGÉ sans le dire : ${muets.join(' | ')}`)
  // 10 — aucune perte de contenu : chaque ligne significative du corps ACTUEL doit se
  //      retrouver, sous une forme normalisée, dans le corps réparé (l'OCR abîme la FORME,
  //      il n'invente pas de contenu). Un écart signale une ligne oubliée à la reprise.
  //      Mots comparés UN À UN (accents pliés) : plier le texte ENTIER avant de découper
  //      produirait des blocs de mille lettres et ne mesurerait rien.
  const mots = (s: string) =>
    (s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().match(/[a-z]{6,}/g) ?? [])
  const cibleMots = new Set(mots(body))
  const perdus = [...new Set(mots(doc.bodyOriginal).filter((w) => !cibleMots.has(w)))]
  // L'OCR abîme la FORME des mots : les « perdus » sont pour l'essentiel des graphies
  // fautives (« aooelés », « Pièœs »). Un seuil, non un zéro — mais un seuil BAS.
  if (perdus.length > 200) fail(`perte de contenu : ${perdus.length} mots de 6+ lettres du corps actuel absents du corps réparé — ${perdus.slice(0, 15).join(', ')}`)
  // 11 — richBlocks : substitutions toutes utiles, aucune perte de bloc ni de rangée
  const richAvant = parseRichBlocks(doc.richBlocksJson)
  const { json: richJson, counts } = corrigerRich(doc.richBlocksJson ?? '[]', subs)
  const inutiles = subs.filter(([a]) => !counts.get(a)).map(([a]) => a)
  if (inutiles.length) fail(`richBlocks : ${inutiles.length} substitution(s) sans effet (donnée déjà modifiée ?) : ${inutiles.slice(0, 3).map((s) => JSON.stringify(s)).join(', ')}`)
  const richApres = parseRichBlocks(richJson)
  if (richApres.length !== richAvant.length) fail(`richBlocks : ${richApres.length} blocs après correction pour ${richAvant.length} avant`)
  const rows = (bs: any[]) => bs.reduce((n, b) => n + (b.rows?.length ?? 0), 0)
  if (rows(richApres) !== rows(richAvant)) fail(`richBlocks : ${rows(richAvant) - rows(richApres)} rangées perdues`)
  // 12 — les ancres des richBlocks contre le corps RÉPARÉ ne doivent pas se dégrader
  const orphAvant = buildBodySegments(doc.bodyOriginal, richAvant).filter((s: any) => s.kind === 'rich' && s.orphan).length
  const orphApres = buildBodySegments(body, richApres).filter((s: any) => s.kind === 'rich' && s.orphan).length
  if (orphApres > orphAvant) fail(`richBlocks : ${orphApres} tableaux orphelins contre le corps réparé, contre ${orphAvant} aujourd'hui`)
  // 13 — mode annoté : aucune rangée aplatie « a | b » ne doit rester en double dans le corps
  const aplaties = (body.match(/^.+ \| .+$/gm) ?? []).length
  if (aplaties) fail(`${aplaties} rangées aplaties « a | b » subsistent dans le corps (doublon avec les tableaux)`)
  // 14 — durabilité : sans ces deux touches de code, la réparation est effacée ou doublée
  //      au prochain `npx tsx scripts/import-brh.ts --commit`.
  const page = existsSync(PAGE_TSX) ? readFileSync(PAGE_TSX, 'utf8') : ''
  const blocsCode = ['HIDE_INLINE_INDEX_SOURCES', 'ART_REFS_SOURCES', 'ANNOTATIONS_VARIANT_SOURCES'].filter((set) => {
    const i = page.indexOf(`const ${set} = new Set([`)
    return i < 0 || !page.slice(i, page.indexOf('])', i)).includes(`'${SOURCE_CIBLE}'`)
  })
  if (blocsCode.length) fail(`${PAGE_TSX} : ${SOURCE_CIBLE} absent de ${blocsCode.join(', ')}`)
  const brhSrc = existsSync(IMPORT_BRH) ? readFileSync(IMPORT_BRH, 'utf8') : ''
  if (!brhSrc.includes("'127_Circulaire.pdf'")) fail(`${IMPORT_BRH} : '127_Circulaire.pdf' absent de SUPERSEDED_BY_WEB — le ré-import recréerait un doublon source='BRH'`)

  // ══ Rapport ════════════════════════════════════════════════════════════════════════════
  const annotationsJson = JSON.stringify(ann)
  const searchText = buildSearchText({ titleFr: doc.titleFr, number: doc.number, bodyOriginal: body, matiere: doc.matiere, annotationsJson } as any)
  console.log(`CIRCULAIRE BRH n° 127 — ${doc.titleFr}`)
  console.log(`   cible       ${doc.id} · type ${doc.type} · number ${doc.number} · sealed ${doc.sealed} · statut ${doc.status}`)
  console.log(`   source      ${doc.source} → ${SOURCE_CIBLE} (source='BRH' est PURGÉE par import-brh --commit)`)
  console.log(`   corps       ${doc.bodyOriginal.length} → ${body.length} car. · ${doc.bodyOriginal.split('\n').length} → ${body.split('\n').length} lignes`)
  console.log(`   corrections ${(pack.corrections ?? []).length} journalisées · ${(pack.notes ?? []).length} notes de méthode`)
  console.log(`   perte       ${perdus.length} mot(s) de 6+ lettres du corps actuel absent(s) du corps réparé (graphies OCR)${perdus.length ? ' — ex. ' + perdus.slice(0, 10).join(', ') : ''}`)
  console.log(`   sommaire    ${secs.length}/${ann.toc.length} appariés · divisions ancrées ${arts.length}/${wanted.length}`)
  console.log(`   index       ${ann.indexEntries.length} entrées · ${idxRefs.length} renvois, 0 mort · 0 division hors index · 0 ctRef en points`)
  console.log(`   navToc      ${(JSON.stringify(ann.navToc).match(/"anchor"/g) ?? []).length} ancres, 0 morte`)
  console.log(`   annotations ${Object.keys(ann.commentaires ?? {}).length} commentaires · ${Object.keys(ann.connexe ?? {}).length} ancres de renvoi · ${linked.length} documents liés`)
  for (const b of Object.values(ann.connexe ?? {}).flat()) {
    if (b.docId) console.log(`               → ${found.get(b.docId)!.titleFr.slice(0, 56)} [${found.get(b.docId)!.status}]${b.anchor ? ` #${b.anchor}` : ''}`)
  }
  console.log(
    `   jeton       ${JETON} ${avis ? `→ résolu ${avis.id} (${AVIS_SOURCE}, ${avis.status})` : '→ NON RÉSOLU : aucun document source=' + AVIS_SOURCE + ' — l’écriture est REFUSÉE tant que l’Avis n’est pas créé'}`,
  )
  console.log(`   richBlocks  ${richApres.length} blocs · ${rows(richApres)} rangées · ${subs.length} substitutions OCR (${[...counts.values()].reduce((a, b) => a + b, 0)} occurrences)`)
  console.log(`               orphelins ${orphAvant} (corps actuel) → ${orphApres} (corps réparé) · rendus par le lecteur annoté : 0 (rowsOf ne trouve aucune rangée aplatie — piège 4)`)
  console.log(`   searchText  ${doc.searchText?.length ?? 0} → ${searchText.length} car. (recalculé par buildSearchText)`)
  console.log(`   notes ¹..¹³ 13 appels conservés dans le corps, 13 textes au pied de leur modèle (arbitrage 2 non exécutable — piège 5)`)

  if (VOIR) {
    const i = blocks.findIndex((b) => b.anchor === VOIR)
    if (i < 0) fail(`--voir : ancre ${VOIR} inconnue`)
    console.log(`\n── aperçu ${VOIR} ─────────────────────────────────────────────────────────`)
    console.log(blocks[i].text.slice(0, 2500))
    for (const b of (ann.connexe ?? {})[VOIR] ?? []) console.log(`\n  ↪ ${b.label}\n    ${b.text}`)
    const k = (blocks[i] as any).jurisKey
    for (const t of (k && (ann.commentaires ?? {})[k]) || []) console.log(`\n  ✎ [${k}] ${t}`)
  }

  if (!APPLY) {
    console.log('\n✓ 15/15 contrôles verts. SIMULATION — rien n’a été écrit. Relancer avec --apply.')
    await prisma.$disconnect()
    return
  }

  // ══ Écriture ═══════════════════════════════════════════════════════════════════════════
  // Le corps réparé remplace bodyOriginal : la version en base n'est PAS le texte officiel,
  // c'est une couche OCR fautive. L'original part INTÉGRALEMENT au journal d'audit.
  await prisma.$transaction(async (tx) => {
    await audit(
      {
        action: 'DOC_PUBLISHED',
        targetType: 'DOCUMENT',
        targetId: doc.id,
        meta: {
          actor: 'script:reparer-circulaire-127',
          motif: 'réparation du corps OCR + pose du lecteur annoté',
          sauvegarde: {
            source: doc.source,
            bodyOriginal: doc.bodyOriginal,
            richBlocksJson: doc.richBlocksJson,
            annotationsJson: doc.annotationsJson,
            searchText: doc.searchText,
          },
          apres: { source: SOURCE_CIBLE, bodyLen: body.length, annotationsLen: annotationsJson.length, richLen: richJson.length },
          corrections: (pack.corrections ?? []).length,
          substitutionsRich: subs.length,
          force: FORCE,
        },
      },
      tx as any,
    )
    await tx.document.update({
      where: { id: doc.id },
      data: { bodyOriginal: body, bodyClean: null, richBlocksJson: richJson, annotationsJson, searchText, source: SOURCE_CIBLE },
    })
  })
  await reindexDocument(doc.id)
  console.log(`\n✓ réparé : ${doc.id} · corps d'origine sauvegardé dans AuditLog (DOC_PUBLISHED)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(String(e instanceof Error ? e.message : e))
  await prisma.$disconnect()
  process.exit(1)
})
