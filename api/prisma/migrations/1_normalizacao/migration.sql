-- Normaliza o banco até a 3ª forma normal: tabelas em snake_case, ids uuid, defeitos em tabela própria,
-- critérios versionados, autor com chave estrangeira e sem totais calculados. Os dados existentes são copiados.

-- CreateEnum
CREATE TYPE "member_role" AS ENUM ('ADMIN', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "member_status" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "defect_type" AS ENUM ('MISSING', 'EXTRA', 'WRONG_COLOR', 'DAMAGED', 'SHAFT', 'STRUCTURE');

-- CreateTable
CREATE TABLE "production_lines" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "matricula" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "github_username" TEXT,
    "role" "member_role" NOT NULL DEFAULT 'EMPLOYEE',
    "status" "member_status" NOT NULL DEFAULT 'ACTIVE',
    "all_units" BOOLEAN NOT NULL DEFAULT false,
    "last_access_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "password_hash" TEXT,
    "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    "token_version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_production_lines" (
    "member_id" UUID NOT NULL,
    "production_line_id" UUID NOT NULL,

    CONSTRAINT "member_production_lines_pkey" PRIMARY KEY ("member_id","production_line_id")
);

-- CreateTable
CREATE TABLE "inspection_criteria" (
    "id" SERIAL NOT NULL,
    "expected_rows" INTEGER,
    "expected_cols" INTEGER,
    "min_quality_score" INTEGER NOT NULL DEFAULT 80,
    "reject_missing_pins" BOOLEAN NOT NULL DEFAULT true,
    "reject_extra_pins" BOOLEAN NOT NULL DEFAULT true,
    "reject_damaged_pins" BOOLEAN NOT NULL DEFAULT true,
    "reject_wrong_color_pins" BOOLEAN NOT NULL DEFAULT true,
    "reject_structure_damage" BOOLEAN NOT NULL DEFAULT true,
    "reject_shaft_defects" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID,

    CONSTRAINT "inspection_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storage_folder" TEXT NOT NULL,
    "author_id" UUID NOT NULL,
    "production_line_id" UUID NOT NULL,
    "criteria_id" INTEGER NOT NULL,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "captures" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,

    CONSTRAINT "captures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capture_defects" (
    "capture_id" UUID NOT NULL,
    "type" "defect_type" NOT NULL,
    "detected_count" INTEGER NOT NULL,
    "present" BOOLEAN NOT NULL,

    CONSTRAINT "capture_defects_pkey" PRIMARY KEY ("capture_id","type")
);

-- CreateIndex
CREATE UNIQUE INDEX "production_lines_name_key" ON "production_lines"("name");

-- CreateIndex
CREATE UNIQUE INDEX "members_matricula_key" ON "members"("matricula");

-- CreateIndex
CREATE UNIQUE INDEX "members_email_key" ON "members"("email");

-- CreateIndex
CREATE UNIQUE INDEX "batches_storage_folder_key" ON "batches"("storage_folder");

-- CreateIndex
CREATE INDEX "batches_author_id_created_at_idx" ON "batches"("author_id", "created_at");

-- CreateIndex
CREATE INDEX "batches_production_line_id_created_at_idx" ON "batches"("production_line_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "captures_sha256_key" ON "captures"("sha256");

-- CreateIndex
CREATE INDEX "captures_batch_id_idx" ON "captures"("batch_id");

-- AddForeignKey
ALTER TABLE "member_production_lines" ADD CONSTRAINT "member_production_lines_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_production_lines" ADD CONSTRAINT "member_production_lines_production_line_id_fkey" FOREIGN KEY ("production_line_id") REFERENCES "production_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_criteria" ADD CONSTRAINT "inspection_criteria_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_production_line_id_fkey" FOREIGN KEY ("production_line_id") REFERENCES "production_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_criteria_id_fkey" FOREIGN KEY ("criteria_id") REFERENCES "inspection_criteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "captures" ADD CONSTRAINT "captures_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capture_defects" ADD CONSTRAINT "capture_defects_capture_id_fkey" FOREIGN KEY ("capture_id") REFERENCES "captures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===== Cópia dos dados do modelo anterior =====

INSERT INTO "production_lines" ("id", "name", "created_at")
SELECT "id"::uuid, "name", "createdAt" FROM "Unit";

INSERT INTO "members" ("id", "name", "matricula", "email", "phone", "github_username", "role", "status", "all_units",
                       "last_access_at", "created_at", "password_hash", "must_change_password", "token_version")
SELECT "id"::uuid, "name", COALESCE("matricula", "id"), "email", "phone", "githubUsername",
       "role"::text::"member_role", "status"::text::"member_status", "allUnits",
       "lastAccessAt", "createdAt", "passwordHash", "mustChangePassword", "tokenVersion"
FROM "Member";

-- No vínculo implícito do Prisma, "A" é o membro e "B" a linha (ordem alfabética dos modelos).
INSERT INTO "member_production_lines" ("member_id", "production_line_id")
SELECT "A"::uuid, "B"::uuid FROM "_MemberToUnit";

-- A configuração única vira a versão 1 dos critérios.
INSERT INTO "inspection_criteria" ("id", "expected_rows", "expected_cols", "min_quality_score", "reject_missing_pins",
                                   "reject_extra_pins", "reject_damaged_pins", "reject_wrong_color_pins",
                                   "reject_structure_damage", "reject_shaft_defects", "created_at", "created_by_id")
SELECT 1, s."expectedRows", s."expectedCols", s."minQualityScore", s."rejectMissingPins", s."rejectExtraPins",
       s."rejectDamagedPins", s."rejectWrongColorPins", s."rejectStructureDamage", s."rejectShaftDefects", s."updatedAt",
       (SELECT m."id"::uuid FROM "Member" m WHERE m."matricula" = s."updatedByMatricula")
FROM "InspectionSettings" s;

INSERT INTO "inspection_criteria" ("id") SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM "inspection_criteria");
SELECT setval(pg_get_serial_sequence('"inspection_criteria"', 'id'), (SELECT MAX("id") FROM "inspection_criteria"));

-- Lotes cujo autor foi apagado no modelo anterior ganham um membro inativo com a mesma matrícula.
INSERT INTO "members" ("id", "name", "matricula", "status", "must_change_password")
SELECT gen_random_uuid(), 'Membro removido', a."matricula", 'INACTIVE', false
FROM (SELECT DISTINCT COALESCE(b."authorMatricula", 'sem-autor') AS "matricula" FROM "Batch" b) a
WHERE NOT EXISTS (SELECT 1 FROM "members" m WHERE m."matricula" = a."matricula");

INSERT INTO "production_lines" ("id", "name")
SELECT gen_random_uuid(), 'Sem linha'
WHERE EXISTS (SELECT 1 FROM "Batch" WHERE "unitId" IS NULL)
  AND NOT EXISTS (SELECT 1 FROM "production_lines" WHERE "name" = 'Sem linha');

-- A pasta do lote sai da URL de qualquer captura: http://host/bucket/{pasta}/{sha256}/arquivo.
INSERT INTO "batches" ("id", "name", "description", "created_at", "storage_folder", "author_id", "production_line_id", "criteria_id")
SELECT b."id"::uuid, b."name", b."description", b."createdAt",
       COALESCE((SELECT substring(c."originalUri" FROM '^https?://[^/]+/[^/]+/([^/]+)/') FROM "Capture" c WHERE c."batchId" = b."id" LIMIT 1), b."id"),
       (SELECT m."id" FROM "members" m WHERE m."matricula" = COALESCE(b."authorMatricula", 'sem-autor')),
       COALESCE(b."unitId"::uuid, (SELECT l."id" FROM "production_lines" l WHERE l."name" = 'Sem linha')),
       1
FROM "Batch" b;

INSERT INTO "captures" ("id", "batch_id", "filename", "sha256")
SELECT "id"::uuid, "batchId"::uuid, "filename", "sha256" FROM "Capture";

-- O modelo anterior não guardava quantidades: o que foi detectado conta como 1.
-- O que o sistema detectou vem da correção do operador, se houver; sem correção, detectado = valor final.
INSERT INTO "capture_defects" ("capture_id", "type", "detected_count", "present")
SELECT c."id"::uuid, t."tipo"::"defect_type", CASE WHEN d."detectado" THEN 1 ELSE 0 END, t."presente"
FROM "Capture" c
CROSS JOIN LATERAL (VALUES
    ('MISSING', 'missing', c."hasMissingPins"),
    ('EXTRA', 'extra', c."hasExtraPins"),
    ('WRONG_COLOR', 'wrongColor', c."hasWrongColorPins"),
    ('DAMAGED', 'damaged', c."hasDamagedPins"),
    ('SHAFT', 'shaft', c."hasShaftDefects"),
    ('STRUCTURE', 'structure', c."hasStructureDamage")
) AS t("tipo", "chave", "presente")
CROSS JOIN LATERAL (
    SELECT COALESCE(
        (SELECT (e->>'detected')::boolean FROM jsonb_array_elements(COALESCE(c."corrections", '[]'::jsonb)) e
         WHERE e->>'defect' = t."chave" LIMIT 1),
        t."presente") AS "detectado"
) d
WHERE d."detectado" OR t."presente";

-- ===== Regras que o Prisma não expressa =====

ALTER TABLE "inspection_criteria"
    ADD CONSTRAINT "inspection_criteria_grid_check" CHECK (("expected_rows" IS NULL) = ("expected_cols" IS NULL)),
    ADD CONSTRAINT "inspection_criteria_grid_positive_check" CHECK ("expected_rows" > 0 AND "expected_cols" > 0),
    ADD CONSTRAINT "inspection_criteria_min_quality_score_check" CHECK ("min_quality_score" BETWEEN 0 AND 100);

ALTER TABLE "capture_defects"
    ADD CONSTRAINT "capture_defects_detected_count_check" CHECK ("detected_count" >= 0),
    ADD CONSTRAINT "capture_defects_relevant_check" CHECK ("detected_count" > 0 OR "present");

-- ===== Remoção do modelo anterior =====

DROP TABLE "_MemberToUnit";
DROP TABLE "Capture";
DROP TABLE "Batch";
DROP TABLE "Member";
DROP TABLE "Unit";
DROP TABLE "InspectionSettings";
DROP TYPE "MemberRole";
DROP TYPE "MemberStatus";
