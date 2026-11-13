-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('ADMIN', 'EMPLOYEE');

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalCaptures" INTEGER NOT NULL DEFAULT 0,
    "validCaptures" INTEGER NOT NULL DEFAULT 0,
    "invalidCaptures" INTEGER NOT NULL DEFAULT 0,
    "authorMatricula" TEXT,
    "unitId" TEXT,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Capture" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "originalUri" TEXT NOT NULL,
    "processedUri" TEXT,
    "processedAreasUri" TEXT,
    "processedPinsUri" TEXT,
    "processedShaftUri" TEXT,
    "isValid" BOOLEAN NOT NULL DEFAULT false,
    "defectsCount" INTEGER NOT NULL DEFAULT 0,
    "hasMissingPins" BOOLEAN NOT NULL DEFAULT false,
    "hasExtraPins" BOOLEAN NOT NULL DEFAULT false,
    "hasDamagedPins" BOOLEAN NOT NULL DEFAULT false,
    "hasWrongColorPins" BOOLEAN NOT NULL DEFAULT false,
    "hasStructureDamage" BOOLEAN NOT NULL DEFAULT false,
    "hasShaftDefects" BOOLEAN NOT NULL DEFAULT false,
    "corrections" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Capture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "matricula" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "githubUsername" TEXT,
    "role" "MemberRole" NOT NULL DEFAULT 'EMPLOYEE',
    "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "allUnits" BOOLEAN NOT NULL DEFAULT false,
    "lastAccessAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "passwordHash" TEXT,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "expectedRows" INTEGER,
    "expectedCols" INTEGER,
    "minQualityScore" INTEGER NOT NULL DEFAULT 80,
    "rejectMissingPins" BOOLEAN NOT NULL DEFAULT true,
    "rejectExtraPins" BOOLEAN NOT NULL DEFAULT true,
    "rejectDamagedPins" BOOLEAN NOT NULL DEFAULT true,
    "rejectWrongColorPins" BOOLEAN NOT NULL DEFAULT true,
    "rejectStructureDamage" BOOLEAN NOT NULL DEFAULT true,
    "rejectShaftDefects" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByMatricula" TEXT,

    CONSTRAINT "InspectionSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_MemberToUnit" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "Batch_authorMatricula_createdAt_idx" ON "Batch"("authorMatricula", "createdAt");

-- CreateIndex
CREATE INDEX "Batch_unitId_createdAt_idx" ON "Batch"("unitId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Capture_sha256_key" ON "Capture"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "Member_matricula_key" ON "Member"("matricula");

-- CreateIndex
CREATE UNIQUE INDEX "Member_email_key" ON "Member"("email");

-- CreateIndex
CREATE UNIQUE INDEX "_MemberToUnit_AB_unique" ON "_MemberToUnit"("A", "B");

-- CreateIndex
CREATE INDEX "_MemberToUnit_B_index" ON "_MemberToUnit"("B");

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capture" ADD CONSTRAINT "Capture_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MemberToUnit" ADD CONSTRAINT "_MemberToUnit_A_fkey" FOREIGN KEY ("A") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MemberToUnit" ADD CONSTRAINT "_MemberToUnit_B_fkey" FOREIGN KEY ("B") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

