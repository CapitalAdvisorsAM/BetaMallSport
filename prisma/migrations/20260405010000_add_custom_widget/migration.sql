CREATE TABLE "CustomWidget" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "title" TEXT NOT NULL,
  "chartType" TEXT NOT NULL DEFAULT 'line',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "position" INTEGER NOT NULL DEFAULT 0,
  "formulaConfig" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomWidget_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomWidget_enabled_idx" ON "CustomWidget"("enabled");
