import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/auth/password'
import { BRAND_COLORS } from '../src/lib/brand-colors'
import { buildSearchText, fold } from '../src/lib/search/normalize'
import { importMoniteurIndex } from '../scripts/import-moniteur'

const prisma = new PrismaClient()

// Secret TOTP FIXE partagé par les comptes de démonstration — permet de se connecter
// via le code de démo (dev) sans application d'authentification. NE JAMAIS utiliser
// en production : à l'activation réelle, chaque compte enrôle son propre secret.
const DEMO_TOTP = 'JBSWY3DPEHPK3PXP'
const DEMO_PASSWORD = 'Demo1234!'

interface DocRecord {
  type: string
  titleFr: string
  titleEn?: string
  titleHt?: string
  number?: string
  status?: string
  moniteurRef?: string
  publicationDate?: string
  bodyOriginal: string
  summaryFr?: string
  summaryEn?: string
  summaryHt?: string
  meansFr?: string
  meansEn?: string
  meansHt?: string
  juridiction?: string
  matiere?: string
  author?: string
  revue?: string
  year?: number
  fiscalYear?: number
  niceClasses?: string
  bhdaNumber?: string
  holder?: string
  imageUrl?: string
  versions?: { versionLabel: string; status?: string; effectiveDate?: string; changeNote?: string }[]
  citesTitlesFr?: string[]
}
interface CompanyRecord {
  name: string
  rcNumber?: string
  nif?: string
  capital?: string
  address?: string
  publications?: { kind: string; label: string; date?: string; moniteurRef?: string; linkDocumentTitleFr?: string }[]
}

// ── Corpus de repli intégré (1 enregistrement riche par type + 2 sociétés) ──
const FALLBACK_DOCS: DocRecord[] = [
  {
    type: 'LEGISLATION',
    titleFr: 'Décret du 9 avril 2020 sur les sûretés mobilières',
    titleEn: 'Decree of 9 April 2020 on movable securities',
    titleHt: 'Dekrè 9 avril 2020 sou garanti mobilye yo',
    number: 'Décret · 9 avril 2020',
    status: 'EN_VIGUEUR',
    moniteurRef: 'Le Moniteur n° 60 du 9 avril 2020',
    publicationDate: '2020-04-09',
    bodyOriginal:
      "Article premier.- Le présent décret a pour objet d'organiser le régime des sûretés mobilières et de moderniser le crédit garanti en République d'Haïti.\n\nArticle 2.- Constitue une sûreté mobilière toute garantie portant sur un bien meuble, corporel ou incorporel, présent ou futur, affecté au paiement d'une obligation.\n\nArticle 3.- Il est institué un Registre des sûretés mobilières, tenu sous forme électronique, dans lequel sont inscrites les sûretés afin de les rendre opposables aux tiers.",
    summaryFr:
      "Réforme du droit des sûretés mobilières : définition large de l'assiette, registre électronique unique et rang déterminé par l'inscription. Pilier du crédit garanti haïtien.",
    summaryEn:
      'Reform of movable-security law: a broad collateral base, a single electronic registry, and priority set by registration. A pillar of Haitian secured lending.',
    summaryHt:
      "Refòm dwa garanti mobilye yo : yon baz laj, yon rejis elektwonik inik, ak ran ki depann de enskripsyon. Yon pilye kredi garanti ann Ayiti.",
    meansFr:
      "Concrètement, un prêteur peut prendre en garantie un stock, du matériel ou des créances, et l'inscrire au registre pour primer les autres créanciers.",
    meansEn:
      'In practice, a lender can take inventory, equipment or receivables as collateral and register it to rank ahead of other creditors.',
    meansHt:
      'An pratik, yon prètè ka pran stòk, materyèl oswa kreyans kòm garanti epi enskri l pou l pase devan lòt kreyansye yo.',
    versions: [
      { versionLabel: 'Version d’origine', status: 'EN_VIGUEUR', effectiveDate: '2020-04-09', changeNote: 'Publication initiale' },
      {
        versionLabel: 'Version consolidée au 31/12/2022',
        status: 'EN_VIGUEUR',
        effectiveDate: '2022-12-31',
        changeNote: 'Coordination avec le registre électronique',
      },
    ],
  },
  {
    type: 'CIRCULAIRE_BRH',
    titleFr: 'Circulaire BRH n° 114 relative à la lutte contre le blanchiment',
    titleEn: 'BRH Circular No. 114 on anti-money-laundering',
    titleHt: 'Sikilè BRH n° 114 sou lit kont blanchiman',
    number: 'Circulaire n° 114',
    status: 'PUBLIE',
    moniteurRef: 'BRH — Direction de la supervision',
    publicationDate: '2021-06-15',
    bodyOriginal:
      "La Banque de la République d'Haïti (BRH), en application de la loi du 11 novembre 2013 sanctionnant le blanchiment des capitaux et le financement du terrorisme, précise aux banques et institutions financières leurs obligations de vigilance.\n\n1. Identification et connaissance de la clientèle (KYC) lors de l'entrée en relation.\n2. Surveillance continue des opérations et déclaration des transactions suspectes à l'UCREF.\n3. Conservation des pièces pendant dix (10) ans.",
    summaryFr:
      "La BRH détaille les obligations de vigilance (KYC), de surveillance et de déclaration à l'UCREF imposées aux institutions financières en matière de LBC/FT.",
    summaryEn:
      'The BRH details the customer-due-diligence (KYC), monitoring and UCREF-reporting duties imposed on financial institutions for AML/CFT.',
    summaryHt:
      "BRH detaye obligasyon vijilans (KYC), siveyans ak deklarasyon bay UCREF ke enstitisyon finansye yo dwe respekte nan LBC/FT.",
    meansFr:
      "Toute banque doit identifier ses clients, suivre leurs opérations et signaler à l'UCREF ce qui paraît suspect — sous peine de sanctions de la BRH.",
    meansEn:
      'Every bank must identify clients, monitor their transactions and report anything suspicious to UCREF — or face BRH sanctions.',
    meansHt:
      'Chak bank dwe idantifye kliyan li, swiv operasyon yo epi siyale UCREF sa ki sanble sispèk — sinon BRH ka sanksyone l.',
  },
  {
    type: 'JURISPRUDENCE',
    titleFr: 'Cour de cassation, 2ᵉ ch., arrêt du 14 mars 2019 — vice du consentement',
    titleEn: 'Court of Cassation, 2nd ch., ruling of 14 March 2019 — defect of consent',
    titleHt: 'Kou Kasasyon, 2yèm ch., desizyon 14 mas 2019 — vis konsantman',
    number: 'Arrêt n° 38',
    status: 'PUBLIE',
    moniteurRef: 'Cour de cassation — Bulletin des arrêts',
    publicationDate: '2019-03-14',
    juridiction: 'CASSATION',
    matiere: 'civil',
    bodyOriginal:
      "Attendu que le dol, pour vicier le consentement, suppose des manœuvres pratiquées par l'une des parties telles qu'il est évident que, sans elles, l'autre n'aurait pas contracté ;\n\nAttendu qu'en l'espèce la cour d'appel a souverainement constaté l'existence de telles manœuvres ;\n\nPar ces motifs, rejette le pourvoi.",
    summaryFr:
      "La Cour rappelle les conditions du dol comme vice du consentement (art. 1110 C. civ.) : des manœuvres déterminantes émanant du cocontractant.",
    summaryEn:
      'The Court restates the conditions of fraud as a defect of consent (art. 1110 Civil Code): decisive maneuvers by the other party.',
    summaryHt:
      "Kou a raple kondisyon do kòm vis konsantman (atik 1110 Kòd sivil): manèv detèminan ki soti nan men lòt pati a.",
    meansFr:
      'Un contrat peut être annulé si une partie a trompé l’autre par des manœuvres sans lesquelles celle-ci n’aurait pas signé.',
    meansEn: 'A contract can be voided if one party deceived the other through maneuvers without which they would not have signed.',
    meansHt: 'Yon kontra ka anile si yon pati twonpe lòt la ak manèv san sa li pa t ap siyen.',
    citesTitlesFr: [],
  },
  {
    type: 'DOCTRINE',
    titleFr: 'La modernisation du crédit garanti en Haïti',
    titleEn: 'The modernization of secured lending in Haiti',
    titleHt: 'Modènizasyon kredi garanti ann Ayiti',
    status: 'PUBLIE',
    author: 'Me Joseph Pierre-Louis',
    revue: 'Revue haïtienne de droit des affaires',
    year: 2021,
    matiere: 'commercial',
    moniteurRef: 'RHDA, vol. 4, 2021',
    publicationDate: '2021-09-01',
    bodyOriginal:
      "L'adoption du décret du 9 avril 2020 marque un tournant pour le financement des entreprises haïtiennes. En substituant au formalisme antérieur un registre électronique et une règle de rang claire, le législateur aligne le droit haïtien sur les standards de l'OHADA et de la loi-type de la CNUDCI.\n\nL'auteur examine les apports et les limites pratiques de la réforme.",
    summaryFr:
      "Étude doctrinale du décret de 2020 sur les sûretés mobilières, replacée dans le mouvement régional de modernisation du crédit garanti.",
    summaryEn:
      'A doctrinal study of the 2020 movable-securities decree, set within the regional movement to modernize secured lending.',
    summaryHt: 'Yon etid doktrin sou dekrè 2020 sou garanti mobilye yo, nan kad mouvman rejyonal modènizasyon kredi a.',
    meansFr: 'Un commentaire d’expert qui explique pourquoi la réforme de 2020 facilite l’accès au crédit des entreprises.',
    meansEn: 'An expert commentary explaining why the 2020 reform eases firms’ access to credit.',
    meansHt: 'Yon kòmantè ekspè ki esplike poukisa refòm 2020 an fasilite antrepriz yo jwenn kredi.',
    citesTitlesFr: ['Décret du 9 avril 2020 sur les sûretés mobilières'],
  },
  {
    type: 'LOI_FINANCES',
    titleFr: 'Loi de finances de l’exercice 2022-2023',
    titleEn: 'Finance Act for fiscal year 2022-2023',
    titleHt: 'Lwa finans egzèsis 2022-2023',
    number: 'Loi de finances 2022-2023',
    status: 'EN_VIGUEUR',
    fiscalYear: 2023,
    moniteurRef: 'Le Moniteur — édition spéciale, octobre 2022',
    publicationDate: '2022-10-01',
    bodyOriginal:
      "Article 1er.- Il est ouvert au budget de l'État, pour l'exercice 2022-2023, des crédits s'élevant à la somme arrêtée par le présent texte.\n\nArticle 2.- Les droits, taxes et impôts existants continuent d'être perçus conformément aux lois en vigueur.\n\nArticle 12.- Sont aménagées les modalités de l'impôt sur le revenu et de la taxe sur la valeur ajoutée (TCA).",
    summaryFr:
      "Budget de l'État pour l'exercice 2022-2023 : autorisations de crédits et aménagements de l'impôt sur le revenu et de la TCA.",
    summaryEn: 'State budget for FY 2022-2023: appropriations and adjustments to income tax and the TCA (VAT).',
    summaryHt: 'Bidjè Leta pou egzèsis 2022-2023 : kredi ak ajisteman sou enpo sou revni ak TCA.',
    meansFr: 'La loi qui fixe le budget annuel de l’État et ajuste les impôts pour l’année fiscale 2022-2023.',
    meansEn: 'The act setting the State’s annual budget and adjusting taxes for fiscal year 2022-2023.',
    meansHt: 'Lwa ki fikse bidjè anyèl Leta epi ajiste taks pou ane fiskal 2022-2023.',
  },
  {
    type: 'MARQUE',
    titleFr: 'Marque « KAFE LAKAY » (figurative)',
    titleEn: 'Trademark “KAFE LAKAY” (figurative)',
    titleHt: 'Mak « KAFE LAKAY » (figiratif)',
    status: 'PUBLIE',
    niceClasses: '30,35,43',
    bhdaNumber: 'BHDA-2023-0421',
    holder: 'Sosyete Kafe Lakay S.A.',
    moniteurRef: 'Le Moniteur n° 145 du 3 août 2023',
    publicationDate: '2023-08-03',
    bodyOriginal:
      "Dépôt de marque de fabrique et de commerce.\nDénomination : KAFE LAKAY.\nTitulaire : Sosyete Kafe Lakay S.A.\nClasses de Nice : 30 (café, produits torréfiés), 35 (services de vente), 43 (services de restauration).\nDate de dépôt au BHDA et publication au Moniteur aux fins d'opposition.",
    summaryFr:
      "Dépôt de la marque figurative KAFE LAKAY (classes 30, 35, 43) au BHDA, publié au Moniteur pour ouvrir le délai d'opposition.",
    summaryEn:
      'Filing of the figurative mark KAFE LAKAY (Nice classes 30, 35, 43) at BHDA, published in the Moniteur to open the opposition period.',
    summaryHt: 'Depo mak figiratif KAFE LAKAY (klas 30, 35, 43) nan BHDA, pibliye nan Monitè pou louvri delè opozisyon an.',
    meansFr: 'Une recherche d’antériorité montre que ce nom et ce logo sont déjà déposés pour le café et la restauration.',
    meansEn: 'A prior-art search shows this name and logo are already registered for coffee and food service.',
    meansHt: 'Yon rechèch antèryorite montre non ak logo sa a deja depoze pou kafe ak restorasyon.',
  },
]

const FALLBACK_COMPANIES: CompanyRecord[] = [
  {
    name: 'Sosyete Kafe Lakay S.A.',
    rcNumber: 'RC-PAP-2018-3391',
    nif: '003-456-789-0',
    capital: '5 000 000 HTG',
    address: 'Pétion-Ville, Haïti',
    publications: [
      { kind: 'STATUTS', label: 'Constitution de société anonyme', date: '2018-05-12', moniteurRef: 'Le Moniteur n° 92 de 2018' },
      { kind: 'MODIF_CAPITAL', label: 'Augmentation de capital à 5 000 000 HTG', date: '2021-02-09' },
      { kind: 'MARQUE', label: 'Dépôt de la marque KAFE LAKAY', date: '2023-08-03', linkDocumentTitleFr: 'Marque « KAFE LAKAY » (figurative)' },
    ],
  },
  {
    name: 'Banque ABC S.A.',
    rcNumber: 'RC-PAP-2009-1180',
    nif: '001-220-330-4',
    capital: '750 000 000 HTG',
    address: 'Port-au-Prince, Haïti',
    publications: [
      { kind: 'STATUTS', label: 'Constitution — agrément BRH', date: '2009-03-20', moniteurRef: 'Le Moniteur n° 30 de 2009' },
    ],
  },
]

function markSvgDataUrl(name: string): string {
  const initials = name.replace(/[^A-Za-zÀ-ÿ ]/g, '').split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><rect width='120' height='120' rx='14' fill='${BRAND_COLORS.lank}'/><circle cx='60' cy='60' r='30' fill='${BRAND_COLORS.sitwon}' opacity='0.9'/><text x='60' y='70' font-family='Georgia' font-size='34' font-weight='bold' text-anchor='middle' fill='${BRAND_COLORS.lank}'>${initials}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function loadGenerated(): { documents: DocRecord[]; companies: CompanyRecord[] } {
  try {
    const raw = readFileSync(join(__dirname, 'seed-data.json'), 'utf8')
    const parsed = JSON.parse(raw)
    return { documents: parsed.documents ?? [], companies: parsed.companies ?? [] }
  } catch {
    return { documents: [], companies: [] }
  }
}

// Garde-fou (audit 2 juil. 2026) : le seed EFFACE puis recrée des comptes/données de démo.
// Il ne doit JAMAIS tourner contre une base distante (prod) — sinon réintroduction des comptes
// à identifiants publiés + écrasement des données réelles. Contournement explicite : --allow-remote.
function assertLocalDb() {
  const url = process.env.DATABASE_URL ?? process.env.DIRECT_URL ?? ''
  const local = /@(localhost|127\.0\.0\.1|::1)[:/]/.test(url) || url.includes('localhost')
  if (!local && !process.argv.includes('--allow-remote')) {
    console.error('⛔ Seed refusé : la base ne semble pas locale (' + (url.split('@')[1] ?? url).slice(0, 40) + '…).')
    console.error('   Le seed supprime et recrée des données de démonstration. Pour forcer : --allow-remote.')
    process.exit(1)
  }
}

async function main() {
  assertLocalDb()
  console.log('🌱  Seed Lam…')
  // Idempotence : on repart propre.
  await prisma.$transaction([
    prisma.alert.deleteMany(),
    prisma.promoRedemption.deleteMany(),
    prisma.promoCode.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.searchLog.deleteMany(),
    prisma.exportRecord.deleteMany(),
    prisma.favorite.deleteMany(),
    prisma.companyPublication.deleteMany(),
    prisma.company.deleteMany(),
    prisma.citation.deleteMany(),
    prisma.documentVersion.deleteMany(),
    prisma.document.deleteMany(),
    prisma.trustedDevice.deleteMany(),
    prisma.session.deleteMany(),
    prisma.user.deleteMany(),
    prisma.organization.deleteMany(),
  ])

  const pwd = await hashPassword(DEMO_PASSWORD)
  const org = await prisma.organization.create({ data: { name: 'Banque ABC S.A.', kind: 'BANQUE', seatLimit: 10 } })

  const active = (email: string, role: string, extra: Record<string, unknown> = {}) => ({
    email,
    passwordHash: pwd,
    role,
    status: 'ACTIVE',
    totpSecret: DEMO_TOTP,
    totpEnabled: true,
    activatedAt: new Date(),
    monthlyQuota: role === 'SITWAYEN' ? 30 : null,
    ...extra,
  })

  const admin = await prisma.user.create({
    data: active('admin@lam.ht', 'MASTER_ADMIN', { name: 'Master Admin' }),
  })
  await prisma.user.create({ data: active('pro@cabinet.ht', 'PWOFESYONEL', { name: 'Me Christelle Vaval' }) })
  await prisma.user.create({
    data: active('inst@banque.ht', 'ENSTITISYON', { name: 'Conformité Banque ABC', organizationId: org.id }),
  })
  await prisma.user.create({ data: active('editeur@lam.ht', 'EDITEUR', { name: 'Éditeur juridique' }) })
  await prisma.user.create({
    data: active('sitwayen@exemple.ht', 'SITWAYEN', { name: 'Citoyen', quotaUsed: 3 }),
  })

  // Comptes en attente (reproduit la maquette §08)
  const now = Date.now()
  const pendings = [
    { email: 'j.baptiste@cabinetXYZ.ht', name: 'Me J. Baptiste', daysAgo: 1 },
    { email: 'compliance@banqueABC.ht', name: 'Compliance ABC', daysAgo: 2 },
    { email: 'recherche@univ-quisqueya.ht', name: 'Bibliothèque UniQ', daysAgo: 3 },
    { email: 'contact@notaire-cap.ht', name: 'Étude notariale Cap', daysAgo: 4 },
  ]
  for (const p of pendings) {
    await prisma.user.create({
      data: {
        // Les e-mails sont toujours normalisés en minuscules (cohérence avec le login).
        email: p.email.toLowerCase(),
        name: p.name,
        passwordHash: pwd,
        role: 'SITWAYEN',
        status: 'PENDING',
        requestedAt: new Date(now - p.daysAgo * 86400_000),
      },
    })
  }

  // ── Documents ──
  const gen = loadGenerated()
  const docs = dedupeByTitle([...FALLBACK_DOCS, ...gen.documents])
  console.log(`   ${docs.length} documents (${gen.documents.length} générés + repli)`)

  const titleToId = new Map<string, string>()
  const citationQueue: { fromTitle: string; toTitle: string }[] = []

  for (const d of docs) {
    const created = await prisma.document.create({
      data: {
        type: d.type,
        status: d.status ?? (d.type === 'LEGISLATION' ? 'EN_VIGUEUR' : 'PUBLIE'),
        titleFr: d.titleFr,
        titleEn: d.titleEn ?? null,
        titleHt: d.titleHt ?? null,
        bodyOriginal: d.bodyOriginal,
        summaryFr: d.summaryFr ?? null,
        summaryEn: d.summaryEn ?? null,
        summaryHt: d.summaryHt ?? null,
        meansFr: d.meansFr ?? null,
        meansEn: d.meansEn ?? null,
        meansHt: d.meansHt ?? null,
        number: d.number ?? null,
        moniteurRef: d.moniteurRef ?? null,
        publicationDate: d.publicationDate ? new Date(d.publicationDate) : null,
        // Champs spécifiques limités à leur type (constat d'audit #37 : le seed
        // remplissait p.ex. une juridiction sur des documents non-jurisprudence).
        juridiction: d.type === 'JURISPRUDENCE' ? d.juridiction ?? null : null,
        matiere: d.matiere ?? null,
        author: d.author ?? null,
        revue: d.type === 'DOCTRINE' ? d.revue ?? null : null,
        year: d.year ?? null,
        fiscalYear: d.type === 'LOI_FINANCES' ? d.fiscalYear ?? null : null,
        niceClasses: d.type === 'MARQUE' ? d.niceClasses ?? null : null,
        bhdaNumber: d.type === 'MARQUE' ? d.bhdaNumber ?? null : null,
        holder: d.type === 'MARQUE' ? d.holder ?? null : null,
        imageUrl: d.imageUrl ?? (d.type === 'MARQUE' ? markSvgDataUrl(d.titleFr) : null),
        searchText: buildSearchText(d),
        source: 'SEED',
        sealed: true,
        publishedById: admin.id,
        versions: d.versions?.length
          ? {
              create: d.versions.map((v) => ({
                versionLabel: v.versionLabel,
                status: v.status ?? 'EN_VIGUEUR',
                effectiveDate: v.effectiveDate ? new Date(v.effectiveDate) : null,
                body: d.bodyOriginal,
                changeNote: v.changeNote ?? null,
              })),
            }
          : undefined,
      },
    })
    titleToId.set(d.titleFr, created.id)
    for (const c of d.citesTitlesFr ?? []) citationQueue.push({ fromTitle: d.titleFr, toTitle: c })
  }

  // Citations croisées (best-effort par titre)
  for (const c of citationQueue) {
    const fromId = titleToId.get(c.fromTitle)
    const toId = titleToId.get(c.toTitle)
    if (fromId && toId && fromId !== toId) {
      await prisma.citation.create({ data: { fromId, toId, kind: 'COMMENTE' } }).catch(() => {})
    }
  }

  // ── Sociétés (index transversal) ──
  const companies = dedupeBy([...FALLBACK_COMPANIES, ...gen.companies], (c) => c.name)
  for (const c of companies) {
    await prisma.company.create({
      data: {
        name: c.name,
        searchName: fold(c.name),
        rcNumber: c.rcNumber ?? null,
        nif: c.nif ?? null,
        capital: c.capital ?? null,
        address: c.address ?? null,
        publications: {
          create: (c.publications ?? []).map((p) => ({
            kind: p.kind,
            label: p.label,
            date: p.date ? new Date(p.date) : null,
            moniteurRef: p.moniteurRef ?? null,
            documentId: p.linkDocumentTitleFr ? titleToId.get(p.linkDocumentTitleFr) ?? null : null,
          })),
        },
      },
    })
  }

  // Relie automatiquement chaque marque à une fiche société (par titulaire).
  const markDocs = await prisma.document.findMany({ where: { type: 'MARQUE' } })
  for (const m of markDocs) {
    if (!m.holder) continue
    let company = await prisma.company.findFirst({ where: { name: m.holder } })
    if (!company) company = await prisma.company.create({ data: { name: m.holder, searchName: fold(m.holder) } })
    const exists = await prisma.companyPublication.findFirst({ where: { companyId: company.id, documentId: m.id } })
    if (!exists) {
      await prisma.companyPublication.create({
        data: { companyId: company.id, documentId: m.id, kind: 'MARQUE', label: `Dépôt — ${m.titleFr}`, date: m.publicationDate, moniteurRef: m.moniteurRef },
      })
    }
  }

  // ── Journaux (KPI §08) ──
  await prisma.auditLog.createMany({
    data: [
      { action: 'SCRAPING_ALERT', ip: '41.86.10.22', metaJson: JSON.stringify({ rate: '320 req/min' }) },
      { action: 'SCRAPING_ALERT', ip: '190.115.4.9', metaJson: JSON.stringify({ rate: '210 req/min' }) },
      { action: 'ACCOUNT_ACTIVATED', actorId: admin.id, targetType: 'USER' },
      { action: 'DOC_PUBLISHED', actorId: admin.id, targetType: 'DOCUMENT' },
    ],
  })

  const proUser = await prisma.user.findUnique({ where: { email: 'pro@cabinet.ht' } })
  if (proUser) {
    await prisma.searchLog.createMany({
      data: [
        { userId: proUser.id, query: 'sûretés mobilières', locale: 'fr', resultsCount: 3 },
        { userId: proUser.id, query: 'trademark coffee', locale: 'en', resultsCount: 2 },
        { userId: proUser.id, query: 'blanchiment UCREF', locale: 'fr', resultsCount: 1 },
        { userId: proUser.id, query: 'loi de finances 2023', locale: 'fr', resultsCount: 1 },
      ],
    })
  }

  // ── Codes promo de démonstration (§09 — paiement) ──
  await prisma.promoCode.createMany({
    data: [
      { code: 'LV-BETA-2026', label: 'Lancement bêta', grantsRole: 'PWOFESYONEL', durationDays: 90, maxRedemptions: 100, createdById: admin.id },
      { code: 'LV-DIASPORA', label: 'Offre diaspora', grantsRole: 'PWOFESYONEL', durationDays: 365, createdById: admin.id },
      { code: 'LV-PARTENAIRE', label: 'Partenaire institutionnel', grantsRole: 'ENSTITISYON', durationDays: null, maxRedemptions: 5, createdById: admin.id },
    ],
  })

  // ── Index du Moniteur 1900-2023 (si le fichier source est présent) ──
  const idx = await importMoniteurIndex(prisma, {})
  if (!idx.skipped) {
    console.log(`   Index du Moniteur : ${idx.documents} documents · ${idx.companies} sociétés · ${idx.publications} publications`)
  }

  console.log('✅  Seed terminé.')
  console.log(`   Comptes démo (mot de passe « ${DEMO_PASSWORD} », code 2FA affiché en dev) :`)
  console.log('   · admin@lam.ht               (Master Admin)')
  console.log('   · pro@cabinet.ht             (Pwofesyonèl)')
  console.log('   · inst@banque.ht            (Enstitisyon)')
  console.log('   · editeur@lam.ht             (Éditeur)')
  console.log('   · sitwayen@exemple.ht        (Sitwayen)')
}

function dedupeByTitle(arr: DocRecord[]): DocRecord[] {
  return dedupeBy(arr, (d) => d.titleFr.trim().toLowerCase())
}
function dedupeBy<T>(arr: T[], key: (v: T) => string): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const v of arr) {
    const k = key(v)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(v)
  }
  return out
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
