-- CreateTable: DashboardConfig
-- Using CREATE TABLE IF NOT EXISTS for idempotency (file was missing from this migration directory)
CREATE TABLE IF NOT EXISTS "DashboardConfig" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "widgetId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "formulaVariant" TEXT,
    "parameters" JSONB,

    CONSTRAINT "DashboardConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DashboardConfig_widgetId_key" ON "DashboardConfig"("widgetId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DashboardConfig_enabled_idx" ON "DashboardConfig"("enabled");
