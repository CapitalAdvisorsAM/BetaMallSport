-- CreateEnum
CREATE TYPE "AnalysisView" AS ENUM ('EERR', 'CDG');

-- CreateEnum
CREATE TYPE "NoteStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "AnalysisNote" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "lineKey" TEXT NOT NULL,
    "view" "AnalysisView" NOT NULL,
    "body" TEXT NOT NULL,
    "status" "NoteStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" UUID NOT NULL,
    "updatedById" UUID,
    "resolvedById" UUID,
    "resolvedAt" TIMESTAMPTZ(3),
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AnalysisNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalysisNote_projectId_idx" ON "AnalysisNote"("projectId");

-- CreateIndex
CREATE INDEX "AnalysisNote_projectId_view_lineKey_idx" ON "AnalysisNote"("projectId", "view", "lineKey");

-- CreateIndex
CREATE INDEX "AnalysisNote_projectId_status_idx" ON "AnalysisNote"("projectId", "status");

-- AddForeignKey
ALTER TABLE "AnalysisNote" ADD CONSTRAINT "AnalysisNote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisNote" ADD CONSTRAINT "AnalysisNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisNote" ADD CONSTRAINT "AnalysisNote_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisNote" ADD CONSTRAINT "AnalysisNote_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
