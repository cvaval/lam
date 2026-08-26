/**
 * Recueil de la Cour de cassation — EXERCICE 1965-1966. 82 arrêts, textes intégraux.
 *
 *   npx tsx scripts/import-cassation-1965-1966.ts            (à blanc)
 *   npx tsx scripts/import-cassation-1965-1966.ts --voir=3   (à blanc + 3 fiches en entier)
 *   npx tsx scripts/import-cassation-1965-1966.ts --apply    (écrit)
 *
 * ⚠️ TROIS FORMATIONS, PAS DEUX. Le recueil 1964-1965 ne connaissait que la Première et la
 * Deuxième Section. Celui-ci porte en outre dix arrêts des SECTIONS RÉUNIES — une formation
 * que la base ne contenait pas. Décision de la rédaction du 17 août 2026 : elle est
 * enregistrée comme telle, au même rang que les deux autres. Chaque formation numérote pour
 * elle-même : la clé reste (source, SECTION, numéro), jamais le numéro seul.
 *
 * ⚠️ CE RECUEIL N'A PAS DE SOMMAIRE ANALYTIQUE. Contrairement à 1964-1965, aucun fichier ne
 * fournit règle de droit, question, motifs ni dispositif. On ne verse donc QUE le texte
 * intégral et ce qui s'en déduit sans interprétation — l'intitulé des parties et la date.
 * Les rubriques d'analyse restent VIDES : la rédaction les écrira. Les remplir depuis la
 * prose de l'arrêt reviendrait à signer une analyse au nom d'un éditeur qui ne l'a pas lue.
 *
 * ⚠️ AUCUNE PASTILLE D'ÉVALUATION. `traitement` et `portee` ne sont pas écrits : un blanc
 * n'est pas un « neutre », et une pastille par défaut ferait passer une absence
 * d'évaluation pour une évaluation.
 *
 * ⚠️ LA DATE SE LIT EN TOUTES LETTRES, dans la formule de clôture — voir
 * src/lib/jurisprudence/numeraux.ts, et le piège d'ancrage qui y est documenté.
 */
import { readFileSync } from 'node:fs'
import mammoth from 'mammoth'
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'
import { dateDeLArret } from '../src/lib/jurisprudence/numeraux'

const FICHIER = '/Users/cvaval/Downloads/Cour_de_Cassation_1965-1966_FULL.docx'
const SOURCE = 'CASSATION_1965_1966'
const RECUEIL = 'Cour de Cassation — exercice 1965-1966 (recueil complet)'

/**
 * HUIT GRAPHIES DE TÊTE D'ARRÊT, relevées sur les 82 : « No.1).- », « No 4).- »,
 * « No. 12).- », et la même avec la date COLLÉE — « No.27).-28 Avril 1966 ». Un motif qui
 * n'accepterait que la forme canonique en manquerait 19.
 */
const TETE = /^N[o°]\s*\.?\s*(\d{1,3})\s*\)\s*\.\s*-\s*(.*)$/
/** Les intertitres de formation. L'accent est flottant : « PREMIERE » et « PREMIÈRE ». */
const SECTION = /^(PREMI[EÈ]RE SECTION|DEUXI[EÈ]ME SECTION|SECTIONS\s+R[EÉ]UNIES)\s*$/i
/** Ligne d'archive : matière et date, elle appartient à l'arrêt QUI SUIT. */
const ARCHIVE = /^[A-ZÉ][\wÉ.]{0,14}\s*[—–-]\s*\d{1,2}\s+[A-Za-zéûôà]+\s+\d{4}\s*$/
const EXERCICE = /^EXERCICE\s+1965/i
/** Mentions manuscrites transcrites entre crochets : elles bornent, elles ne se lisent pas. */
const MARGINALE = /^\[.*\]$/

const NOM_FORMATION: Record<string, string> = {
  PREMIERE: 'Première Section',
  DEUXIEME: 'Deuxième Section',
  SECTIONS: 'Sections Réunies',
}
function formation(ligne: string): string {
  const t = ligne.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  return NOM_FORMATION[t.split(/\s+/)[0]] ?? 'Première Section'
}

interface Arret {
  numero: string
  section: string
  date: string | null
  dateArchive: string | null
  demandeur: string | null
  defendeur: string | null
  corps: string
}

const MOIS: Record<string, number> = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
}
/** Date en chiffres d'une ligne d'archive (« Civ. — 17 Novembre 1965 ») → ISO. */
function dateArchive(l: string | null): string | null {
  const m = /(\d{1,2})\s+([A-Za-zéûôàè]+)\s+(\d{4})/.exec(l ?? '')
  const mo = m && MOIS[m[2].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')]
  return m && mo ? `${m[3]}-${String(mo).padStart(2, '0')}-${m[1].padStart(2, '0')}` : null
}

/** Civilités : elles précèdent le nom, elles ne le sont pas. */
const CIVILITE = /^(?:les?\s+|la\s+|l'|du\s+|des\s+|de\s+la\s+|de\s+l'|de\s+|d')?(?:sieurs?|dames?|demoiselles?|messieurs|monsieur|madame|mr\.?|me\.?|mme\.?|vve\.?|veuve|[ée]poux|[ée]pouse)\s+/i

/**
 * Nettoie une désignation de partie.
 *
 * ⚠️ ON COUPE AVANT LA QUALITÉ, PAS DEDANS. « Compagnie Sucrière du SUD (CENTRALE DES
 * ANNAMITES) » tronquée par la fenêtre de lecture donnait « … (CENTRALE DES » : une
 * parenthèse ouverte et jamais fermée est le signe qu'on a coupé au milieu d'un nom, et
 * ce fragment se citerait ensuite tel quel.
 */
function nom(s: string): string {
  let t = s
    .replace(/\s+/g, ' ')
    // ⚠️ UN NOM DE PARTIE NE PORTE NI VERBE CONJUGUÉ NI DATE. Deux-points, « Attendu »,
    // mais aussi « fut », « est », « sera » : au-delà, c'est la prose de l'arrêt. Sans cette
    // coupe, deux intitulés sur 82 sortaient ainsi — « Pourvoi de sieur Euluptio DENIS fut
    // cassé », « … c. tiré est bien du 26 Avril 1961 et non du 26 Avril 1962 » — et se
    // seraient cités tels quels.
    .split(/\s*:\s*|\s+(?:Attendu|fut|est|sont|sera|[ée]tait|ont|avait|n'est|a\s+[ée]t[ée])\b/i)[0]
    .split(/\s+(?:du|le|en)\s+\d{1,2}\s+[A-Za-zéûôà]+\s+\d{4}/i)[0]
    .replace(/,?\s*(?:Soci[ée]t[ée]|S\.?A\.?|demand|d[ée]fend|patent|[ée]tabli|domicili|repr[ée]sent|agissant|propri[ée]taire|commer[çc]ant|n[ée]gociant|en\s+sa\s+qualit[ée]).*$/i, '')
  // Parenthèse ouverte non refermée : la fenêtre a coupé le nom, on rend ce qui précède.
  if ((t.match(/\(/g) ?? []).length > (t.match(/\)/g) ?? []).length) t = t.slice(0, t.lastIndexOf('('))
  return t.replace(/^(?:la |le |les |l'|du |des |de |d')/i, '').replace(/[,;:.\s-]+$/, '').trim()
}

/** Une partie doit porter un NOM : au moins un mot capitalisé de trois lettres. */
function estUnNom(s: string | null): boolean {
  if (!s) return false
  const reste = s.replace(CIVILITE, '').trim()
  // ⚠️ Une particule esseulée en fin de chaîne signe une TRONCATURE : « Charles DE » n'est
  // pas un nom, c'est un nom coupé. Mieux vaut la désignation neutre qu'un nom amputé.
  if (/\b(?:de|du|des|d'|la|le|les|et|[àa]|en|par|pour|veuve|vve\.?)$/i.test(reste)) return false
  return reste.length > 2 && /[A-ZÉÈÀÂÎÔÛ][\wÉÈÀÂÎÔÛéèàâîôû'-]{2,}/.test(reste)
}

/**
 * ⚠️ « Contre » n'introduit pas toujours un adversaire : il introduit souvent la DÉCISION
 * ATTAQUÉE — « Contre 1o) un jugement du Tribunal Civil… », « Contre deux jugements en date
 * des 26 Juillet… ». Prendre ce qui suit pour un défendeur produit des intitulés comme
 * « X c. deux jugements », qui se citeraient ensuite ainsi.
 */
const EST_UNE_DECISION = /^(?:\d+[o°)\s.]*|un |une |le |la |les |deux |trois |quatre |plusieurs )*(?:jugements?|arr[êe]ts?|d[ée]cisions?|sentences?|ordonnances?|ex[ée]cutoires?)\b/i

/** Le demandeur au pourvoi et son adversaire, tels que l'arrêt les nomme. */
function parties(corps: string): { demandeur: string | null; defendeur: string | null } {
  const t = corps.replace(/\s+/g, ' ')
  const d = /Sur le pourvoi (?:de |des |du |d'|de la |de l')(.{3,160}?)(?:,|;| contre| Contre)/i.exec(t)
  const c = /\bContre[^a-zA-Z]{0,4}(?:\d[o°]\)?\s*)?(?:un |une |le |la |les |l'|sieur |dame |demoiselle |Monsieur |M\. )?(.{3,120}?)(?:,|;|\.)/i.exec(t)
  const dem = d ? nom(d[1]) : null
  let def = c ? nom(c[1]) : null
  // ⚠️ Test sur TOUTE la chaîne, pas seulement son début : « 1o) un jugement du Tribunal
  // Civil » laissait passer « o) un jugement… » dès que le préfixe numéroté variait.
  if (def && (EST_UNE_DECISION.test(def) || /\b(jugements?|arr[êe]ts?|tribunal|cour\s+d|d[ée]cisions?|sentences?|ordonnances?)\b/i.test(def))) def = null
  // Un adversaire qui n'est qu'une civilité (« son épouse », « le sieur ») n'est pas un nom.
  return { demandeur: estUnNom(dem) ? dem : null, defendeur: estUnNom(def) ? def : null }
}

/**
 * Intitulé de la fiche. « X c. Y » quand les deux parties se lisent — c'est la forme du
 * corpus 1964-1965. À défaut, une désignation NEUTRE et vérifiable, jamais une paraphrase :
 * un titre inventé se cite ensuite comme s'il venait du recueil.
 */
function intitule(a: Arret): string {
  if (a.demandeur && a.defendeur) return `${a.demandeur} c. ${a.defendeur}`
  if (a.demandeur) return `Pourvoi de ${a.demandeur}`
  return `Cour de Cassation, ${a.section}, n° ${a.numero}`
}

async function lireRecueil(): Promise<Arret[]> {
  const brut = (await mammoth.extractRawText({ buffer: readFileSync(FICHIER) })).value
  const l = brut.split('\n').map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean)

  const tetes: { i: number; num: string; suite: string }[] = []
  for (let i = 0; i < l.length; i++) {
    const m = TETE.exec(l[i])
    if (m) tetes.push({ i, num: m[1], suite: m[2] })
  }
  const arrets: Arret[] = []
  for (let k = 0; k < tetes.length; k++) {
    const { i, num, suite } = tetes[k]
    // Formation : le dernier intertitre rencontré avant cette tête.
    let sect = 'Première Section'
    for (let j = i - 1; j >= 0; j--) if (SECTION.test(l[j])) { sect = formation(l[j]); break }
    // Ligne d'archive : dans les six lignes qui précèdent la tête.
    let arch: string | null = null
    for (let j = i - 1; j >= Math.max(0, i - 6); j--) if (ARCHIVE.test(l[j])) { arch = l[j]; break }

    let fin = k + 1 < tetes.length ? tetes[k + 1].i : l.length
    // L'en-tête d'archive du SUIVANT lui appartient : on le rend avant de fermer.
    while (fin - 1 > i && (ARCHIVE.test(l[fin - 1]) || EXERCICE.test(l[fin - 1]) ||
           SECTION.test(l[fin - 1]) || MARGINALE.test(l[fin - 1]))) fin--
    const corps = l.slice(i + 1, fin)
      .filter((x) => !EXERCICE.test(x) && !SECTION.test(x) && !ARCHIVE.test(x))
      .join('\n').trim()

    const p = parties(corps)
    arrets.push({
      numero: num, section: sect, corps,
      // La date de la tête (« No.27).-28 Avril 1966 ») vaut ligne d'archive.
      dateArchive: dateArchive(suite) ?? dateArchive(arch),
      date: dateDeLArret(corps),
      ...p,
    })
  }
  return arrets
}

async function main() {
  const apply = process.argv.includes('--apply')
  const voir = Number(/--voir=(\d+)/.exec(process.argv.join(' '))?.[1] ?? 0)
  const arrets = await lireRecueil()
  console.log(`${arrets.length} arrêts découpés dans le recueil\n`)

  // ── Contrôles AVANT toute écriture ────────────────────────────────────────
  const parSection = new Map<string, string[]>()
  for (const a of arrets) parSection.set(a.section, [...(parSection.get(a.section) ?? []), a.numero])
  let bloquant = 0
  for (const [s, nums] of parSection) {
    const doublons = nums.filter((n, i) => nums.indexOf(n) !== i)
    const tri = nums.map(Number).sort((x, y) => x - y)
    const trous = Array.from({ length: tri[tri.length - 1] - tri[0] + 1 }, (_, i) => tri[0] + i).filter((n) => !tri.includes(n))
    console.log(`${s.padEnd(18)} ${String(nums.length).padStart(2)} arrêts · n° ${tri[0]}–${tri[tri.length - 1]}` +
      (trous.length ? ` · absents du recueil : ${trous.join(', ')}` : ' · suite complète') +
      (doublons.length ? `  ⛔ DOUBLONS ${[...new Set(doublons)].join(', ')}` : ''))
    // ⚠️ Un numéro en double dans une même formation signale un découpage qui a dérivé :
    // on refuse d'écrire plutôt que d'écraser un arrêt par un autre.
    if (doublons.length) bloquant++
  }

  // La date de clôture est confrontée à la ligne d'archive partout où les deux existent.
  const desaccords = arrets.filter((a) => a.date && a.dateArchive && a.date !== a.dateArchive)
  const avecArchive = arrets.filter((a) => a.dateArchive).length
  console.log(`\ndates : ${arrets.filter((a) => a.date).length}/${arrets.length} lues dans la formule de clôture` +
    ` · confrontées à ${avecArchive} lignes d'archive → ${desaccords.length} désaccord(s)`)
  for (const a of desaccords) {
    console.log(`   ⛔ ${a.section} n° ${a.numero} : clôture ${a.date} vs archive ${a.dateArchive}`)
    bloquant++
  }
  const sansDate = arrets.filter((a) => !a.date)
  if (sansDate.length) {
    console.log(`   ⛔ sans date : ${sansDate.map((a) => `${a.section} n° ${a.numero}`).join(' · ')}`)
    bloquant += sansDate.length
  }
  const vides = arrets.filter((a) => a.corps.trim().length < 500)
  if (vides.length) {
    console.log(`   ⛔ corps trop court : ${vides.map((a) => `${a.section} n° ${a.numero} (${a.corps.length}c)`).join(' · ')}`)
    bloquant += vides.length
  }
  const neutres = arrets.filter((a) => !a.demandeur)
  console.log(`intitulés : ${arrets.length - neutres.length}/${arrets.length} tirés des parties` +
    (neutres.length ? ` · ${neutres.length} en désignation neutre` : ''))

  const chrono = [...arrets].sort((a, b) => a.section.localeCompare(b.section) || Number(a.numero) - Number(b.numero))
  for (const s of parSection.keys()) {
    const l = chrono.filter((a) => a.section === s && a.date)
    const reculs = l.filter((a, i) => i && a.date! < l[i - 1].date!)
    if (reculs.length) {
      console.log(`   ⚠ ${s} : ${reculs.length} date(s) en recul — ${reculs.map((a) => `n° ${a.numero}`).join(', ')}`)
    }
  }

  if (voir) {
    for (const a of chrono.slice(0, voir)) {
      console.log(`\n───── ${a.section} n° ${a.numero} · ${a.date}\n  ${intitule(a)}\n  ${a.corps.slice(0, 400).replace(/\n/g, '\n  ')}…`)
    }
  }

  console.log('\n' + '─'.repeat(78))
  for (const a of chrono) {
    console.log(`${a.section.slice(0, 16).padEnd(16)} n° ${a.numero.padStart(2)} · ${a.date} · ${String(a.corps.length).padStart(6)}c · ${intitule(a).slice(0, 58)}`)
  }

  if (bloquant) {
    console.error(`\n⛔ ${bloquant} anomalie(s) bloquante(s) : rien ne sera écrit.`)
    await prisma.$disconnect()
    process.exit(1)
  }
  if (!apply) {
    console.log('\n(exécution à blanc — ajouter --apply pour écrire)')
    await prisma.$disconnect()
    return
  }

  let crees = 0, majs = 0
  for (const a of chrono) {
    const donnees = {
      type: 'JURISPRUDENCE', status: 'PUBLIE', originalLang: 'fr', source: SOURCE,
      titleFr: intitule(a), number: a.numero, chambre: a.section,
      juridiction: `Cour de Cassation de la République d'Haïti, ${a.section}`,
      publicationDate: new Date(`${a.date}T00:00:00Z`),
      recueilRef: RECUEIL, exerciceDebut: 1965, exerciceFin: 1966,
      // ⚠️ `moniteurRef` porte la référence de l'ARRÊT, pas une citation du Moniteur : la
      // fiche l'affiche nue, et la préfixer donnait « Publié au Cour de Cassation… ».
      moniteurRef: `Cour de Cassation · ${a.section} · n° ${a.numero} · 1965-1966`,
      bodyOriginal: a.corps,
    }
    // ⚠️ CLÉ (source, SECTION, numéro). Trois séries de numéros coexistent dans ce recueil.
    const existant = await prisma.document.findFirst({
      where: { source: SOURCE, number: a.numero, chambre: a.section },
      select: { id: true, type: true, bodyOriginal: true },
    })
    // Garde-fou : un identifiant erroné ne doit pas écraser le texte d'une loi.
    if (existant && existant.type !== 'JURISPRUDENCE') {
      console.error(`⛔ ${a.section} n° ${a.numero} : un document ${existant.type} occupe déjà cette clé — ignoré`)
      continue
    }
    // Ne jamais raccourcir un texte intégral déjà en base.
    if (existant && (existant.bodyOriginal?.length ?? 0) > donnees.bodyOriginal.length) {
      donnees.bodyOriginal = existant.bodyOriginal!
    }
    const doc = existant
      ? await prisma.document.update({ where: { id: existant.id }, data: donnees })
      : await prisma.document.create({ data: donnees })
    await reindexDocument(doc.id)
    existant ? majs++ : crees++
  }
  await audit({
    action: 'DOC_PUBLISHED', targetType: 'Document', targetId: SOURCE,
    meta: { via: 'import-cassation-1965-1966', crees, majs, arrets: arrets.length,
            formations: [...parSection.keys()] },
  })
  console.log(`\narrêts ${arrets.length} · créés ${crees} · mis à jour ${majs}`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('ÉCHEC :', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
