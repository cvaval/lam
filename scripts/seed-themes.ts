/**
 * Seed de la taxonomie de thèmes de la Législation annotée (dérivée de secteurs.docx).
 * IDEMPOTENT (upsert par slug) — peut être relancé ; ne touche pas les rattachements.
 * À lancer APRÈS `npm run db:push` :  npm run seed:themes
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface Node {
  slug: string
  fr: string
  en?: string
  ht?: string
  children?: Node[]
}

// Domaine (niveau 0) › Secteur/thème (1) › sous-thème (2). Cf. docs/architecture-legislation-themes.md §3.
const TAXONOMY: Node[] = [
  { slug: 'constitution', fr: 'Constitution & droits fondamentaux', en: 'Constitution & fundamental rights', ht: 'Konstitisyon & dwa fondamantal' },
  {
    slug: 'droit-prive',
    fr: 'Droit privé',
    en: 'Private law',
    ht: 'Dwa prive',
    children: [
      { slug: 'droit-civil', fr: 'Droit civil', en: 'Civil law', ht: 'Dwa sivil' },
      { slug: 'signature-electronique', fr: 'Signature & échange électronique', en: 'Electronic signature & exchange', ht: 'Siyati & echanj elektwonik' },
      { slug: 'obligations-biens-suretes', fr: 'Obligations, biens & sûretés', en: 'Obligations, property & securities', ht: 'Obligasyon, byen & garanti' },
    ],
  },
  {
    slug: 'economique',
    fr: 'Droit économique & des affaires',
    en: 'Economic & business law',
    ht: 'Dwa ekonomik & zafè',
    children: [
      {
        slug: 'commerce-industrie',
        fr: 'Commerce & industrie',
        en: 'Trade & industry',
        ht: 'Komès & endistri',
        children: [
          { slug: 'propriete-intellectuelle', fr: 'Propriété intellectuelle', en: 'Intellectual property', ht: 'Pwopriyete entelektyèl' },
        ],
      },
      { slug: 'agriculture-rural', fr: 'Agriculture, ressources naturelles & développement rural', en: 'Agriculture & rural development', ht: 'Agrikilti & devlopman riral' },
      { slug: 'amenagement-territoire', fr: 'Aménagement du territoire', en: 'Land-use planning', ht: 'Amenajman teritwa' },
      { slug: 'travaux-publics-transports', fr: 'Travaux publics, transports & communications', en: 'Public works, transport & communications', ht: 'Travo piblik, transpò & kominikasyon' },
      { slug: 'environnement', fr: 'Environnement', en: 'Environment', ht: 'Anviwònman' },
      { slug: 'tourisme', fr: 'Tourisme', en: 'Tourism', ht: 'Touris' },
    ],
  },
  {
    slug: 'fiscal-douanier',
    fr: 'Droit fiscal & douanier',
    en: 'Tax & customs law',
    ht: 'Dwa fiskal & ladwàn',
    children: [
      { slug: 'fiscalite-impots', fr: 'Fiscalité / impôts (DGI)', en: 'Taxation (DGI)', ht: 'Fiskalite / enpo (DGI)' },
      { slug: 'lois-de-finances', fr: 'Lois de finances', en: 'Finance acts', ht: 'Lwa finans' },
      { slug: 'tarifs-douaniers', fr: 'Tarifs douaniers', en: 'Customs tariffs', ht: 'Tarif ladwàn' },
    ],
  },
  {
    slug: 'social',
    fr: 'Social',
    en: 'Social',
    ht: 'Sosyal',
    children: [
      { slug: 'droit-du-travail', fr: 'Droit du travail & sécurité sociale', en: 'Labour & social security law', ht: 'Dwa travay & sekirite sosyal' },
      { slug: 'sante-publique', fr: 'Santé publique', en: 'Public health', ht: 'Sante piblik' },
      { slug: 'education', fr: 'Éducation', en: 'Education', ht: 'Edikasyon' },
      { slug: 'jeunesse-sport', fr: 'Jeunesse & sport', en: 'Youth & sports', ht: 'Jenès & espò' },
    ],
  },
  {
    slug: 'droit-public',
    fr: 'Droit public & administratif',
    en: 'Public & administrative law',
    ht: 'Dwa piblik & administratif',
    children: [
      { slug: 'justice', fr: 'Justice', en: 'Justice', ht: 'Jistis' },
      { slug: 'elections', fr: 'Élections', en: 'Elections', ht: 'Eleksyon' },
      { slug: 'finances-publiques-controle', fr: 'Finances publiques & contrôle', en: 'Public finances & audit', ht: 'Finans piblik & kontwòl' },
      { slug: 'administration-centrale', fr: "Administration centrale de l'État", en: 'Central state administration', ht: 'Administrasyon santral Leta' },
      { slug: 'affaires-etrangeres', fr: 'Affaires étrangères', en: 'Foreign affairs', ht: 'Zafè etranje' },
      { slug: 'interieur-collectivites', fr: 'Intérieur & collectivités territoriales', en: 'Interior & local government', ht: 'Enteryè & kolektivite teritoryal' },
    ],
  },
  {
    slug: 'penal',
    fr: 'Droit pénal',
    en: 'Criminal law',
    ht: 'Dwa penal',
    children: [
      { slug: 'penal-general', fr: 'Droit pénal général', en: 'General criminal law', ht: 'Dwa penal jeneral' },
      { slug: 'procedure-penale', fr: 'Procédure pénale', en: 'Criminal procedure', ht: 'Pwosedi penal' },
    ],
  },
]

async function upsertNode(n: Node, parentId: string | null, position: number): Promise<number> {
  const t = await prisma.theme.upsert({
    where: { slug: n.slug },
    update: { labelFr: n.fr, labelEn: n.en ?? null, labelHt: n.ht ?? null, parentId, position },
    create: { slug: n.slug, labelFr: n.fr, labelEn: n.en ?? null, labelHt: n.ht ?? null, parentId, position },
  })
  let count = 1
  let i = 0
  for (const c of n.children ?? []) count += await upsertNode(c, t.id, i++)
  return count
}

async function main() {
  let total = 0
  let i = 0
  for (const root of TAXONOMY) total += await upsertNode(root, null, i++)
  console.log(`✅ Taxonomie semée : ${total} thèmes (${await prisma.theme.count()} en base).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
