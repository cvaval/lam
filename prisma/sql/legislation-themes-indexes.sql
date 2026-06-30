-- Index partiels de la section Législation annotée (thèmes + amendements).
-- À appliquer APRÈS `npm run db:push` : Prisma ne génère pas les index partiels.
-- Ils RENFORCENT, au niveau base, des invariants déjà garantis côté applicatif
-- (src/lib/legislation/*). Idempotents.

-- Au plus un thème PRINCIPAL par document.
CREATE UNIQUE INDEX IF NOT EXISTS "DocumentTheme_one_primary"
  ON "DocumentTheme" ("documentId")
  WHERE "isPrimary" = true;

-- Au plus une version EN_VIGUEUR par (document, article).
CREATE UNIQUE INDEX IF NOT EXISTS "ArticleVersion_one_inforce"
  ON "ArticleVersion" ("documentId", "anchor")
  WHERE "status" = 'EN_VIGUEUR';
