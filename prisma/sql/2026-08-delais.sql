-- ===========================================================================
-- CALCULATEUR DE DÉLAIS — § 5.1 et § 11.5. **CE SQL N'A PAS ÉTÉ APPLIQUÉ.**
--
-- ⚠️ CORRECTIF (défaut 14 a du cahier de recette). Le § 5.1 dit « Écris la migration, MONTRE
-- LE SQL, montre le résultat de la simulation — et arrête-toi », et le § 11.5 en fait une
-- étape à part. Aucun SQL n'avait été produit : la décision humaine portait sur un diff de
-- schéma Prisma, pas sur l'ordre DDL réellement exécuté.
--
-- Produit SANS TOUCHER À LA BASE, le 19 août 2026, par :
--   npx prisma migrate diff \
--     --from-schema-datasource prisma/schema.prisma \
--     --to-schema-datamodel   prisma/schema.prisma \
--     --script > prisma/sql/2026-08-delais.sql
--
-- `--from-schema-datasource` LIT la base de production pour en établir l'état ; il n'y écrit
-- rien. Le diff ne porte QUE sur les quatre tables du calculateur : le reste du schéma est
-- déjà en base, et cette sortie le prouve.
--
-- Appliquer est une DÉCISION HUMAINE. Rien dans le dépôt ne l'exécute : ni la graine (qui
-- s'arrête avant d'écrire), ni un script de démarrage. La graine suppose ces tables ; tant
-- qu'elles n'existent pas, `--apply` refuse.
-- ===========================================================================

-- CreateTable
CREATE TABLE "DelaiEntry" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "codeLibelle" TEXT NOT NULL,
    "article" TEXT NOT NULL,
    "articleOccurrence" INTEGER NOT NULL DEFAULT 1,
    "articleContexte" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "tableau" INTEGER NOT NULL,
    "tableauTitreFr" TEXT,
    "objetFr" TEXT NOT NULL,
    "objetEn" TEXT NOT NULL,
    "objetHt" TEXT NOT NULL,
    "traductionRelue" BOOLEAN NOT NULL DEFAULT false,
    "dureeTexte" TEXT NOT NULL,
    "dureeFondementFr" TEXT,
    "kind" TEXT NOT NULL,
    "jours" INTEGER,
    "nbDistances" INTEGER NOT NULL DEFAULT 0,
    "distanceDoubleFr" TEXT,
    "distanceAideFr" TEXT,
    "supplementJson" TEXT,
    "avisDistance" TEXT,
    "citationArticle" TEXT,
    "surchargeAppliquee" TEXT,
    "regime" TEXT NOT NULL,
    "regimeIncertain" BOOLEAN NOT NULL DEFAULT false,
    "regimeFondement" TEXT NOT NULL,
    "prorogation991" TEXT NOT NULL,
    "prorogationFondement" TEXT NOT NULL,
    "motifRefusFr" TEXT,
    "motifRefusEn" TEXT,
    "motifRefusHt" TEXT,
    "pointDepartFr" TEXT NOT NULL,
    "pointDepartEn" TEXT NOT NULL,
    "pointDepartHt" TEXT NOT NULL,
    "sanctionFr" TEXT,
    "sanctionEn" TEXT,
    "sanctionHt" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'visible',
    "masqueMotif" TEXT,
    "masqueAt" TIMESTAMP(3),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DelaiEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DelaiEntryRevision" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DelaiEntryRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DelaiFerie" (
    "id" TEXT NOT NULL,
    "versionCalendrier" INTEGER NOT NULL,
    "cle" TEXT NOT NULL,
    "typeEntree" TEXT NOT NULL DEFAULT 'PERMANENT',
    "libelleFr" TEXT NOT NULL,
    "libelleEn" TEXT NOT NULL,
    "libelleHt" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "autorite" TEXT NOT NULL,
    "journee" TEXT NOT NULL DEFAULT 'JOURNEE_ENTIERE',
    "noteJourneeFr" TEXT,
    "noteJourneeEn" TEXT,
    "noteJourneeHt" TEXT,
    "traductionRelue" BOOLEAN NOT NULL DEFAULT false,
    "mobile" BOOLEAN NOT NULL DEFAULT false,
    "offsetPaques" INTEGER,
    "mois" INTEGER,
    "jour" INTEGER,
    "source" TEXT NOT NULL,
    "sourceDocId" TEXT,
    "appliqueDepuis" TEXT NOT NULL,
    "observationsN" INTEGER,
    "observationsTexteFr" TEXT,
    "observationsTexteEn" TEXT,
    "observationsTexteHt" TEXT,
    "observationsBorneFr" TEXT,
    "observationsBorneEn" TEXT,
    "observationsBorneHt" TEXT,
    "rechercheCorpusQ" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DelaiFerie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DelaiFenetreSignification" (
    "id" TEXT NOT NULL,
    "versionFenetres" INTEGER NOT NULL,
    "matiere" TEXT NOT NULL,
    "heureDebut" INTEGER NOT NULL,
    "heureFin" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "sourceDocId" TEXT,
    "nullite" BOOLEAN NOT NULL DEFAULT false,
    "nulliteTexteFr" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DelaiFenetreSignification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DelaiEntry_slug_key" ON "DelaiEntry"("slug");

-- CreateIndex
CREATE INDEX "DelaiEntry_statut_idx" ON "DelaiEntry"("statut");

-- CreateIndex
CREATE INDEX "DelaiEntry_code_tableau_ordre_idx" ON "DelaiEntry"("code", "tableau", "ordre");

-- CreateIndex
CREATE INDEX "DelaiEntry_article_idx" ON "DelaiEntry"("article");

-- CreateIndex
CREATE UNIQUE INDEX "DelaiEntryRevision_entryId_revision_key" ON "DelaiEntryRevision"("entryId", "revision");

-- CreateIndex
CREATE INDEX "DelaiFerie_versionCalendrier_idx" ON "DelaiFerie"("versionCalendrier");

-- CreateIndex
CREATE INDEX "DelaiFerie_versionCalendrier_typeEntree_idx" ON "DelaiFerie"("versionCalendrier", "typeEntree");

-- CreateIndex
CREATE UNIQUE INDEX "DelaiFerie_versionCalendrier_cle_key" ON "DelaiFerie"("versionCalendrier", "cle");

-- CreateIndex
CREATE UNIQUE INDEX "DelaiFenetreSignification_versionFenetres_matiere_key" ON "DelaiFenetreSignification"("versionFenetres", "matiere");

-- AddForeignKey
ALTER TABLE "DelaiEntryRevision" ADD CONSTRAINT "DelaiEntryRevision_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "DelaiEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

