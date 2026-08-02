/**
 * CLASSEMENT DES 141 CIRCULAIRES DE LA BRH — deux axes croisés.
 *
 * Elles n'avaient aucun thème : consultables par leur section, mais absentes de
 * l'arborescence, donc introuvables à côté des lois qu'elles appliquent.
 *
 * ⚠️ LA TAXONOMIE N'EST PAS INVENTÉE. La BRH a la sienne : son recueil officiel — Moniteur
 * Spécial n° 18 du 6 juin 2017, « Circulaires en vigueur de la BRH (art. 97, loi du 14 mai
 * 2012) » — range chaque circulaire sous une rubrique, que la transcription a conservée en
 * tête de texte. Elle ne couvre que 46 des 141 (le recueil s'arrête en 2017), mais elle fait
 * autorité : on l'adopte telle quelle et on ne l'étend que là où elle se tait.
 *
 * ⚠️ Le régulateur MÊLE LUI-MÊME LES DEUX AXES — « Maison de transfert » y voisine avec
 * « Règles prudentielles ». D'où deux familles distinctes plutôt qu'une liste hybride :
 *   · PAR MATIÈRE   (thème principal) — ce que la circulaire règle ;
 *   · PAR ASSUJETTI (thème secondaire) — à qui elle s'adresse, lu sur la formule
 *     d'adresse du texte (« AUX BANQUES COMMERCIALES », « AUX MAISONS DE TRANSFERT »).
 * Les trois circulaires IMF de 2026 le montrent : par matière elles se dispersent entre
 * crédit, liquidité et fonds propres, alors qu'elles forment un corps.
 *
 * Les réserves obligatoires pèsent près du quart du fonds. Le RÉGIME (assiette, constitution,
 * pénalités) est séparé de l'HISTORIQUE DES COEFFICIENTS, qui n'est qu'une suite de taux.
 *
 * Idempotent.  npx tsx scripts/_theme-brh.ts [--check]
 */
import { prisma } from '../src/lib/db'

const PARENT = 'droit-bancaire'

/** Deux nœuds de regroupement, pour que les deux découpages restent lisibles côte à côte. */
const FAMILLES = [
  { slug: 'brh-matiere', labelFr: 'Circulaires BRH — par matière',
    labelEn: 'BRH circulars — by subject', labelHt: 'Sikilè BRH — dapre matyè' },
  { slug: 'brh-assujetti', labelFr: 'Circulaires BRH — par assujetti',
    labelEn: 'BRH circulars — by institution', labelHt: 'Sikilè BRH — dapre enstitisyon' },
]

/** Axe 1 — matière. Les huit premières reprennent les rubriques du recueil officiel. */
const MATIERES: { slug: string; labelFr: string; labelEn: string; labelHt: string; rx: RegExp }[] = [
  { slug: 'brh-reserves-coefficients', labelFr: 'Réserves obligatoires — coefficients',
    labelEn: 'Reserve requirements — rates', labelHt: 'Rezèv obligatwa — to yo',
    rx: /coefficients? de r[ée]serves?|ro sur passifs|r[ée]serves obligatoires et taux des bons/i },
  { slug: 'brh-reserves-regime', labelFr: 'Réserves obligatoires — régime',
    labelEn: 'Reserve requirements — rules', labelHt: 'Rezèv obligatwa — règ yo',
    rx: /r[ée]serves? obligatoires?|exon[ée]ration du calcul de reserves|insuffisance de/i },
  { slug: 'brh-lbc-ft', labelFr: 'Blanchiment et financement du terrorisme',
    labelEn: 'Money laundering and terrorist financing', labelHt: 'Blanchiman ak finansman teworis',
    rx: /lbc\/ft|blanchiment|financement du terrorisme|connaissance du client|identification des clients|d[ée]claration[s]? de[s]? transaction|vigilance renforc|pr[ée]vention et de conformit/i },
  { slug: 'brh-gouvernance', labelFr: 'Gouvernance, contrôle interne et sécurité',
    labelEn: 'Governance, internal control and security', labelHt: 'Gouvènans, kontwòl entèn ak sekirite',
    rx: /gouvernance|contr[ôo]le interne|nonnes minimales de contr|s[ée]curit[ée] informatique|v[ée]rification/i },
  { slug: 'brh-paiements', labelFr: 'Moyens de paiement',
    labelEn: 'Payment instruments', labelHt: 'Mwayen peman',
    rx: /ch[èe]que|carte[s]? de (?:paiement|cr[ée]dit)|compensation [ée]lectronique|paiement [ée]lectronique|plateforme de/i },
  { slug: 'brh-transferts', labelFr: 'Transferts de fonds',
    labelEn: 'Funds transfers', labelHt: 'Transfè lajan',
    // « maisons de transferts » figure ici parce que la note additionnelle à la circulaire
    // 118-1 règle la vente des devises issues des transferts reçus — et que son OCR a perdu
    // la ligature « ti » (« mise en applica_on »), ce qui la rend muette à tout autre motif.
    rx: /transferts? de fonds|transferts? internationaux|paiement des transferts|proc[ée]dure de transfert|maisons? de transferts?/i },
  { slug: 'brh-devises', labelFr: 'Opérations en devises',
    labelEn: 'Foreign exchange operations', labelHt: 'Operasyon an deviz',
    rx: /risque de change|monnaies [ée]trang[èe]res|devises|interm[ée]diaires de change|bureaux de change|agents de change|r[ée]trocession/i },
  { slug: 'brh-depots', labelFr: 'Dépôts bancaires',
    labelEn: 'Bank deposits', labelHt: 'Depo labank',
    rx: /d[ée]p[ôo]ts?\b|comptes courants/i },
  { slug: 'brh-comptable', labelFr: 'Règles comptables',
    labelEn: 'Accounting rules', labelHt: 'Règ kontablite',
    rx: /r[èe]gles comptables|charte comptable|ifrs|tca sur transactions/i },
  { slug: 'brh-marche-financier', labelFr: 'Marché financier',
    labelEn: 'Financial market', labelHt: 'Mache finansye',
    rx: /appel public [àa] l.?[ée]pargne|placement restreint/i },
  { slug: 'brh-consommateur', labelFr: 'Protection du consommateur financier',
    labelEn: 'Financial consumer protection', labelHt: 'Pwoteksyon konsomatè finansye',
    rx: /protection des consommateurs|divulgation et affichage|frais et commissi/i },
  { slug: 'brh-implantations', labelFr: 'Implantations et agrément',
    labelEn: 'Branches and licensing', labelHt: 'Enplantasyon ak agreman',
    rx: /implantations commerciales|succursale|points de service/i },
  { slug: 'brh-rapports', labelFr: 'Soumission de rapports',
    labelEn: 'Regulatory reporting', labelHt: 'Soumèt rapò',
    rx: /soumission de rapports|[ée]tats financiers|rapport (?:annuel|hebdomadaire|mensuel)|surveillance consolid|transmission d.?(?:in|')?formations?|obligation d.?information|flux d.?information|d[ée]claration des risques|p[ée]nalit[ée]s pour retards/i },
  { slug: 'brh-prudentiel', labelFr: 'Règles prudentielles',
    labelEn: 'Prudential rules', labelHt: 'Règ pridansyèl',
    rx: /fonds propres|capital social minimum|capitalisation|suffisance des fonds|actionnariat|propri[ée]t[ée] crois[ée]e|participations dans les soci[ée]t[ée]s|couverture des immobilisations|concentration des risques|liquidit[ée]s?|placements/i },
  { slug: 'brh-credit', labelFr: 'Crédit à la clientèle',
    labelEn: 'Customer lending', labelHt: 'Kredi bay kliyantèl',
    rx: /pr[êe]ts?|cr[ée]dit|provision|bureau d.?information sur le cr[ée]dit|\bbic\b/i },
]

/** Rubrique du recueil officiel → thème de matière. Elle PRIME sur les mots-clés. */
const OFFICIEL: Record<string, string> = {
  'Règles prudentielles': 'brh-prudentiel',
  'Moyens de paiement': 'brh-paiements',
  'Blanchiment / FT': 'brh-lbc-ft',
  'Opérations en devises': 'brh-devises',
  'Soumission de rapports': 'brh-rapports',
  'Dépôts bancaires': 'brh-depots',
  'Règles comptables': 'brh-comptable',
  // « Réserves obligatoires » se scinde : voir reserves() ; « Maison de transfert » est un
  // assujetti, non une matière — il est traité par le second axe.
}

/** Axe 2 — assujetti. */
const ASSUJETTIS: { slug: string; labelFr: string; labelEn: string; labelHt: string; rx: RegExp }[] = [
  { slug: 'brh-cec', labelFr: 'Coopératives d’épargne et de crédit',
    labelEn: 'Savings and credit cooperatives', labelHt: 'Koperativ epay ak kredi',
    rx: /\bcec\b|coop[ée]ratives d.?[ée]pargne/i },
  { slug: 'brh-imf', labelFr: 'Institutions de microfinance',
    labelEn: 'Microfinance institutions', labelHt: 'Enstitisyon mikwofinans',
    rx: /microfinance|\bimf\b/i },
  { slug: 'brh-transfert', labelFr: 'Maisons de transfert',
    labelEn: 'Money transfer houses', labelHt: 'Kay transfè',
    rx: /maisons? de transfert/i },
  { slug: 'brh-change', labelFr: 'Bureaux et agents de change',
    labelEn: 'Exchange bureaus and agents', labelHt: 'Biwo ak ajan chanj',
    rx: /bureaux? de change|agents? de change|interm[ée]diaires? de change/i },
  { slug: 'brh-paiement-electronique', labelFr: 'Fournisseurs de services de paiement',
    labelEn: 'Payment service providers', labelHt: 'Founisè sèvis peman',
    rx: /fournisseurs? de services? de paiement/i },
  { slug: 'brh-banques', labelFr: 'Banques et institutions financières',
    labelEn: 'Banks and financial institutions', labelHt: 'Bank ak enstitisyon finansye',
    rx: /banques?\b|institutions? financi[èe]res?|soci[ée]t[ée]s de cartes? de cr[ée]dit/i },
]

const RUBRIQUE_OFFICIELLE = /Circulaires en vigueur de la BRH \(art\. 97, loi du 14 mai 2012\)\s*·\s*([^·]+?)\s*·\s*Source/
/**
 * Formule d'adresse. ⚠️ Elle ne suit pas toujours le mot « CIRCULAIRE » : on lit aussi
 * « No. 86-8 AUX BANQUES COMMERCIALES », « Aux Banques Commerciales Et aux Banques
 * d'Epargne » en casse mixte, et des états abîmés par l'OCR (« B,a,ttques d'Epârgne »).
 * Exiger le préfixe laissait 20 circulaires sans assujetti alors qu'elles en portaient un.
 */
const ADRESSE = /\bAUX?\s+((?:[A-Za-zÀ-ÿ'’,.\s-]){6,120})/i

function matiere(titre: string, corps: string, source: string | null): string {
  const plat = corps.replace(/\s+/g, ' ')
  const off = RUBRIQUE_OFFICIELLE.exec(plat)?.[1]?.trim()
  if (off === 'Réserves obligatoires')
    return /coefficients?/i.test(titre) ? 'brh-reserves-coefficients' : 'brh-reserves-regime'
  // ⚠️ Les mots-clés PRIMENT sur la rubrique officielle, et non l'inverse. Le recueil de 2017
  // est un index de papier à neuf entrées : sa « Règles prudentielles » absorbe le risque de
  // change, la transmission d'états financiers, les provisions et la vérification — 24
  // circulaires en un tas, tandis que les rubriques fines restaient vides. On garde donc la
  // rubrique de la BRH comme FILET, pour ce que les mots-clés ne reconnaissent pas.
  const cible = `${titre} ${source === 'BRH-CEC' ? '' : plat.slice(0, 600)}`
  return MATIERES.find((m) => m.rx.test(cible))?.slug ?? (off ? OFFICIEL[off] ?? '' : '')
}

function assujettis(titre: string, corps: string, source: string | null): string[] {
  if (source === 'BRH-CEC') return ['brh-cec']
  const plat = corps.replace(/\s+/g, ' ')
  // L'adresse peut se trouver après le bandeau du Moniteur : on balaie le début du texte.
  const adr = plat.slice(0, 1200).match(new RegExp(ADRESSE, 'gi'))?.join(' ') ?? ''
  const cible = `${titre} ${adr}`
  const out = ASSUJETTIS.filter((a) => a.rx.test(cible)).map((a) => a.slug)
  // Une circulaire de la BRH dont l'adresse reste illisible s'adresse, par défaut, aux
  // banques et institutions financières : c'est le cas de la circulaire du 8 septembre 2008,
  // dont la reproduction du Moniteur noie la formule d'adresse.
  if (!out.length) return ['brh-banques']
  // « Banques et institutions financières » ne s'ajoute pas à un assujetti plus précis.
  return out.length > 1 ? out.filter((s) => s !== 'brh-banques') : out
}

async function theme(slug: string, l: { labelFr: string; labelEn: string; labelHt: string },
                     parentId: string, position: number) {
  const ex = await prisma.theme.findFirst({ where: { slug } })
  if (ex) return ex
  // ⚠️ N'écrire QUE les libellés. Étaler l'objet de rubrique y glisserait son `rx` : Prisma
  // ne reconnaît plus l'entrée « unchecked », bascule sur celle à relations et se plaint
  // alors de `parentId` — un message qui désigne le mauvais champ.
  return prisma.theme.create({
    data: { slug, parentId, position, labelFr: l.labelFr, labelEn: l.labelEn, labelHt: l.labelHt },
  })
}

async function main() {
  const parent = await prisma.theme.findFirst({ where: { slug: PARENT } })
  if (!parent) throw new Error(`thème ${PARENT} introuvable`)

  const docs = await prisma.document.findMany({
    where: { type: 'CIRCULAIRE_BRH' },
    select: { id: true, number: true, titleFr: true, bodyOriginal: true, source: true },
    orderBy: { number: 'asc' },
  })

  const plan = docs.map((d) => ({
    doc: d,
    m: matiere(d.titleFr, d.bodyOriginal, d.source),
    a: assujettis(d.titleFr, d.bodyOriginal, d.source),
  }))

  const parM: Record<string, number> = {}
  const parA: Record<string, number> = {}
  for (const p of plan) {
    parM[p.m || '(sans matière)'] = (parM[p.m || '(sans matière)'] ?? 0) + 1
    for (const a of p.a) parA[a] = (parA[a] ?? 0) + 1
    if (!p.a.length) parA['(sans assujetti)'] = (parA['(sans assujetti)'] ?? 0) + 1
  }
  const nom = (s: string) => MATIERES.find((m) => m.slug === s)?.labelFr
    ?? ASSUJETTIS.find((a) => a.slug === s)?.labelFr ?? s
  console.log(`${docs.length} circulaires BRH\n\n── AXE 1 : PAR MATIÈRE ──`)
  for (const m of MATIERES) if (parM[m.slug]) console.log(`  ${String(parM[m.slug]).padStart(3)}  ${m.labelFr}`)
  if (parM['(sans matière)']) console.log(`  ${String(parM['(sans matière)']).padStart(3)}  (sans matière)`)
  console.log('\n── AXE 2 : PAR ASSUJETTI ──')
  for (const a of ASSUJETTIS) if (parA[a.slug]) console.log(`  ${String(parA[a.slug]).padStart(3)}  ${a.labelFr}`)
  if (parA['(sans assujetti)']) console.log(`  ${String(parA['(sans assujetti)']).padStart(3)}  (sans assujetti)`)

  const orphelins = plan.filter((p) => !p.m)
  if (orphelins.length) {
    console.log('\n── sans matière : à trancher ──')
    for (const p of orphelins) console.log(`   ${p.doc.number} · ${p.doc.titleFr.slice(0, 76)}`)
  }
  if (process.argv.includes('--check')) {
    console.log('\n— mode contrôle : rien n’a été écrit')
    return prisma.$disconnect()
  }

  // ── Écriture ──
  const maxPos = await prisma.theme.aggregate({ where: { parentId: parent.id }, _max: { position: true } })
  let pos = (maxPos._max.position ?? 0) + 1
  const famM = await theme(FAMILLES[0].slug, FAMILLES[0], parent.id, pos++)
  const famA = await theme(FAMILLES[1].slug, FAMILLES[1], parent.id, pos++)
  const ids = new Map<string, string>()
  for (const [i, m] of MATIERES.entries()) ids.set(m.slug, (await theme(m.slug, m, famM.id, i)).id)
  for (const [i, a] of ASSUJETTIS.entries()) ids.set(a.slug, (await theme(a.slug, a, famA.id, i)).id)
  console.log(`\n✓ ${MATIERES.length} rubriques de matière + ${ASSUJETTIS.length} d’assujetti créées sous « ${parent.labelFr} »`)

  let n = 0
  for (const p of plan) {
    const voulus = [...(p.m ? [{ slug: p.m, principal: true }] : []),
                    ...p.a.map((s) => ({ slug: s, principal: false }))]
    // ⚠️ Un index PARTIEL (`DocumentTheme_one_primary`) impose un seul thème principal par
    // document. Les dix normes CEC en avaient déjà un — celui posé lors de leur premier
    // classement. On rétrograde tout principal qui n'est pas celui que l'on veut, faute de
    // quoi la création du nouveau échoue en P2002.
    const garde = p.m ? ids.get(p.m) : undefined
    for (const l of await prisma.documentTheme.findMany({
      where: { documentId: p.doc.id, isPrimary: true }, select: { themeId: true },
    }))
      if (l.themeId !== garde)
        await prisma.documentTheme.update({
          where: { documentId_themeId: { documentId: p.doc.id, themeId: l.themeId } },
          data: { isPrimary: false },
        })
    for (const v of voulus) {
      const themeId = ids.get(v.slug)!
      const ex = await prisma.documentTheme.findFirst({ where: { documentId: p.doc.id, themeId } })
      if (ex) {
        if (ex.isPrimary !== v.principal)
          await prisma.documentTheme.update({
            where: { documentId_themeId: { documentId: p.doc.id, themeId } }, data: { isPrimary: v.principal },
          })
        continue
      }
      await prisma.documentTheme.create({
        data: { documentId: p.doc.id, themeId, isPrimary: v.principal, assignedBy: 'IMPORT' },
      })
      n++
    }
  }
  console.log(`✓ ${n} rattachements créés · ${plan.filter((p) => p.m).length}/${docs.length} circulaires classées par matière`)
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
