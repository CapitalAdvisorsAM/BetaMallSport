# Graph Report - .  (2026-04-11)

## Corpus Check
- Large corpus: 369 files · ~138,807 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 1342 nodes · 2239 edges · 94 communities detected
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 54 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `Dashboard Page (Control de Gestion)` - 26 edges
2. `GET()` - 23 edges
3. `Permissions Library (permissions.ts)` - 20 edges
4. `Rent Roll Units Page (Server Component)` - 18 edges
5. `Project Context Library (project.ts)` - 16 edges
6. `Rent Roll Contracts Page (Server Component)` - 16 edges
7. `Rent Roll Tenants Page (Server Component)` - 16 edges
8. `extractContractFromText()` - 13 edges
9. `Rent Roll Snapshot Page (Server Component)` - 13 edges
10. `buildTenant360Data()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `Finance Reconciliation Page` --conceptually_related_to--> `Prisma Model: BillingAlert`  [INFERRED]
  src/app/(dashboard)/finance/reconciliation/page.tsx → prisma/schema.prisma
- `Dashboard Page (Control de Gestion)` --references--> `Prisma Model: Unit`  [EXTRACTED]
  src/app/(dashboard)/page.tsx → prisma/schema.prisma
- `Dashboard Page (Control de Gestion)` --references--> `Prisma Model: Contract`  [EXTRACTED]
  src/app/(dashboard)/page.tsx → prisma/schema.prisma
- `Dashboard Page (Control de Gestion)` --references--> `Prisma Model: ValorUF`  [EXTRACTED]
  src/app/(dashboard)/page.tsx → prisma/schema.prisma
- `Dashboard Page (Control de Gestion)` --references--> `Prisma Model: UnitSale`  [EXTRACTED]
  src/app/(dashboard)/page.tsx → prisma/schema.prisma

## Hyperedges (group relationships)
- **Finance Pages Server Component Auth Pattern** — finance_dashboard_page, finance_eerr_page, finance_analysis_page, finance_tenants_page, finance_mappings_page, finance_reconciliation_page [EXTRACTED 0.95]
- **Dashboard KPI Computation and Rendering Flow** — dashboard_page, lib_kpi, lib_dashboard_widget_registry, component_kpicard [EXTRACTED 0.92]
- **Billing Gap Detection and Alert Display Flow** — dashboard_page, lib_shared_gap_utils, prisma_model_billing_alert, finance_reconciliation_page [INFERRED 0.82]
- **Rent Roll Entity CRUD Pages (contracts/tenants/units) share tri-mode ver/cargar/upload pattern** — rent_roll_contracts_page, rent_roll_tenants_page, rent_roll_units_page [EXTRACTED 0.95]
- **Dashboard KPI Pipeline: metricas API + kpi lib + metrics cache produce dashboard payload** — api_dashboard_metricas_route, lib_kpi, lib_metrics_cache [EXTRACTED 0.92]
- **Rent Roll Snapshot: page + snapshot-date utilities + gap-utils form a complete billing-gap calculation flow** — rent_roll_page, lib_rent_roll_snapshot_date, lib_shared_gap_utils [INFERRED 0.85]
- **Finance Upload Pipeline (parse, match, persist, alert)** — route_finance_upload_accounting, route_finance_upload_sales, lib_finance_parse_utils, prisma_accountingUnitMapping, prisma_salesUnitMapping, lib_finance_billing_alerts [EXTRACTED 0.95]
- **Excel Export Fan-Out (single entry, multiple dataset builders)** — route_export_excel_get, fn_buildExportResult, fn_buildProyectosExport, fn_buildLocalesExport, fn_buildArrendatariosExport, fn_buildContratosExport, fn_buildFinanzasArrendatariosExport, fn_buildFinanzasEerrExport, fn_buildFinanzasMapeosExport [EXTRACTED 1.00]
- **Dashboard Alert Widgets (AlertBar + ContractExpiryTable share KPI data)** — component_AlertBar, component_ContractExpiryTable, lib_kpi_alertCounts [EXTRACTED 0.95]
- **Tenant 360 View â€” Composed Client Sections** — tenant360Client_Tenant360Client, tenantProfileHeader_TenantProfileHeader, tenantKpiRow_TenantKpiRow, financialTimelineChart_FinancialTimelineChart, contractDetailsSection_ContractDetailsSection, billingBreakdownSection_BillingBreakdownSection, salesPerformanceSection_SalesPerformanceSection, occupancyTimeline_OccupancyTimeline, projectionsSection_ProjectionsSection [EXTRACTED 1.00]
- **Gap Severity Analysis â€” Shared Utility Pattern** — lib_shared_gapUtils_getGapSeverity, financetenantsClient_FinanceTenantsClient, reconciliationClient_ReconciliationClient, rentRollDashboardTable_RentRollDashboardTable [EXTRACTED 1.00]
- **DataTable Pattern â€” Rent-Roll Tables** — hooks_useDataTable, components_ui_DataTable, arrendatariosViewTable_ArrendatariosViewTable, contractsViewTable_ContractsViewTable, projectCrudPanel_ProjectCrudPanel, rentRollDashboardTable_RentRollDashboardTable [EXTRACTED 0.97]
- **Gap Analysis Pipeline (expected vs actual billing)** — tenant360_buildGapAnalysis, reconciliation_buildReconciliation, billingalerts_recalculateBillingAlerts [INFERRED 0.88]
- **KPI Computation Layer (occupancy, GLA, rent, WALT)** — kpi_calculateOccupancy, kpi_calculateGlaMetrics, kpi_calculateFixedRentUf, kpi_calculateWalt [EXTRACTED 0.95]
- **Project Context Resolution Flow** — projectquery_resolveProjectIdFromQuery, project_getProjectContext, projectselector_ProjectSelector [INFERRED 0.82]
- **Timeline Data Pipeline â€” Historical, Future, and Variable Rent Data** — timeline_buildHistoricalPeriodos, timeline_buildFuturePeriodos, timeline_buildVariableRentData, timeline_getTimelineData [EXTRACTED 0.95]
- **Bulk Upload Preview Diff Pattern â€” Parse, Diff, Classify (Tenants and Units)** — upload_parsetenants_parseTenantsFile, upload_parseunits_parseUnitsFile, pattern_upload_preview_diff, upload_datapayload_parseRentRollPreviewPayload [INFERRED 0.88]
- **Tenant 360 Comprehensive Data Model â€” Profile, KPIs, Contracts, Billing, Gap Analysis** — tenant360_types_Tenant360Data, tenant360_types_Tenant360Kpis, tenant360_types_GapAnalysisRow, gaputils_getGapSeverity, gaputils_buildActualBillingByUnit [INFERRED 0.85]

## Communities

### Community 0 - "Tenant & Billing Components"
Cohesion: 0.02
Nodes (21): getFilterType(), hasActiveFilter(), asNullableNumber(), asNumber(), asNumberArray(), asRecord(), asStringArray(), currentPeriodDefault() (+13 more)

### Community 1 - "Tenant Management CRUD"
Cohesion: 0.03
Nodes (33): createTenant(), toTenantRecord(), updateTenant(), createEmptyPayload(), extractionToDraft(), fromContract(), hasMeaningfulGgcc(), hasMeaningfulRentaVariable() (+25 more)

### Community 2 - "Contract API & Dashboard"
Cohesion: 0.03
Nodes (103): API Contracts Extract Route (POST), API Contracts [id] Route Tests (PUT/GET/DELETE), API Contracts Route Tests (GET), API Dashboard Metricas Route (GET), AlertBar Component, CargaHistorial Upload Component, ContractManager Component (CRUD), ContractsViewTable Component (+95 more)

### Community 3 - "Custom Widget Engine"
Cohesion: 0.05
Nodes (28): formatValue(), tooltipFormatter(), yAxisFormatter(), yTick(), buildFormulaConfig(), handleSubmit(), handleAddCustomWidget(), handleDeleteCustomWidget() (+20 more)

### Community 4 - "Finance Upload Parsing"
Cohesion: 0.05
Nodes (38): extractLocalCodigo(), parseContable(), serialToDate(), asString(), emptyRow(), normalizeNullable(), parseBoolean(), parseLocalesFile() (+30 more)

### Community 5 - "Period & Deprecation Utils"
Cohesion: 0.07
Nodes (52): applyExportRowCap(), asNumber(), asString(), buildArrendatariosExport(), buildCanonicalPath(), buildContratosExport(), buildDownloadUrl(), buildExportResult() (+44 more)

### Community 6 - "Contract Billing & Alerts"
Cohesion: 0.05
Nodes (22): getJob(), parsePayload(), toEstado(), updateJobStatus(), getAccountingMappings(), getActiveUnits(), getFinanceMappingsData(), getSalesMappings() (+14 more)

### Community 7 - "Excel Export Pipeline"
Cohesion: 0.06
Nodes (50): buildArrendatariosExport(), buildContratosExport(), buildExportResult(), buildFinanzasArrendatariosExport(), buildFinanzasEerrExport(), buildFinanzasMapeosExport(), buildLocalesExport(), buildProyectosExport() (+42 more)

### Community 8 - "API Error Handling"
Cohesion: 0.05
Nodes (12): ApiError, ForbiddenError, UnauthorizedError, ValidationError, payloadTarifas(), persistTarifas(), tarifaKey(), toDateOnly() (+4 more)

### Community 9 - "Finance & Projects API"
Cohesion: 0.06
Nodes (44): GET /api/finance/reconciliation, GET /api/finance/tenants/detail, GET /api/finance/tenants, PUT/DELETE /api/projects/[id], POST /api/projects, ArrendatariosViewTable, BillingBreakdownSection, EntityCrudShell Component (+36 more)

### Community 10 - "Dashboard KPI & Metrics"
Cohesion: 0.09
Nodes (23): addDays(), addUtcMonths(), buildAlertCounts(), buildContractExpiryBuckets(), buildContractExpiryRows(), buildFixedRentClpMetric(), buildIngresoDesglosado(), buildOcupacionDetalle() (+15 more)

### Community 11 - "Auth & Navigation Layout"
Cohesion: 0.07
Nodes (3): canWrite(), requireSession(), requireWriteAccess()

### Community 12 - "Upload Data Validation"
Cohesion: 0.11
Nodes (15): isObjectRecord(), isRentRollPreviewPayload(), isUploadIssueArray(), isUploadRowArray(), parseRentRollPreviewPayload(), getUploadHistory(), mapUploadHistory(), isApplyReport() (+7 more)

### Community 13 - "Rent-Roll Metrics"
Cohesion: 0.12
Nodes (12): buildMetricaRow(), buildResumen(), calcularDiasVigentes(), calcularGgcc(), calcularRentaFija(), calcularRentaVariable(), getMetricasRentRoll(), getPeriodoBounds() (+4 more)

### Community 14 - "Contract Upload Parser"
Cohesion: 0.13
Nodes (20): asString(), buildContratoLookupKey(), buildPreviewRows(), compareWithExisting(), decimalEquals(), emptyRow(), isValidDecimalOrNull(), normalizeDecimal() (+12 more)

### Community 15 - "Rent-Roll KPI Header"
Cohesion: 0.1
Nodes (12): formatM2(), RentRollKpiHeader(), getNumberRange(), RentRollTable(), formatDateParam(), formatOneDecimal(), formatWaltValue(), isValidDate() (+4 more)

### Community 16 - "Contract File Extractor"
Cohesion: 0.17
Nodes (21): extractContractFromPdf(), extractContractFromText(), extractFirstRegexGroup(), extractFixedTarifas(), extractNameFromFantasyContext(), extractQuotedName(), extractRuts(), extractShortDates() (+13 more)

### Community 17 - "Tenant 360 Analytics"
Cohesion: 0.18
Nodes (19): buildBillingBreakdown(), buildGapAnalysis(), buildKpis(), buildMonthlyTimeline(), buildProfile(), buildProjections(), buildQuickStats(), buildSalesPerformance() (+11 more)

### Community 18 - "Finance Alerts & KPI Types"
Cohesion: 0.09
Nodes (25): recalculateBillingAlerts, buildTenantFinanceRows, AlertCounts Type, KpiContractInput Type, buildAlertCounts, buildIngresoDesglosado, calculateEstimatedGgccUf, calculateFixedRentUf (+17 more)

### Community 19 - "Contract Upload Review"
Cohesion: 0.16
Nodes (16): asNullableString(), asString(), createDraftKey(), previewRowToUploadDraft(), uploadDraftToPreviewData(), handleApply(), handlePreview(), isApplyReport() (+8 more)

### Community 20 - "Contract Apply Service"
Cohesion: 0.29
Nodes (14): applyContrato(), applyGGCC(), applyTarifas(), asString(), dateOrNull(), decimalOrNull(), generateNumeroContrato(), hasValidPositiveDecimal() (+6 more)

### Community 21 - "Excel Template Builder"
Cohesion: 0.27
Nodes (14): applyWorkbookStyling(), buildDataRows(), buildGuidanceRow(), buildInstructionRows(), buildXlsxTemplate(), getCfbApi(), getHeaderStyle(), readXmlEntry() (+6 more)

### Community 22 - "Tenant Schema & RUT"
Cohesion: 0.14
Nodes (15): Upload Preview Diff Pattern â€” NEW/UPDATED/UNCHANGED/ERROR classification, buildRutFallback() â€” SHA1 hash fallback for missing RUT, normalizeRut(), resolveTenantRut(), tenantSchema â€” Zod validation schema for tenants, unitSchema â€” Zod validation schema for units, ExistingTenantForDiff type, TenantUploadRow type (+7 more)

### Community 23 - "Gap Analysis & Finance Types"
Cohesion: 0.13
Nodes (15): TenantFinanceRow â€” finance view per tenant, GapSeverity type â€” ok | warning | danger, REVENUE_GROUP constant â€” INGRESOS DE EXPLOTACION, buildActualBillingByUnit(), getGapSeverity(), Tenant 360 View Pattern â€” unified tenant profile, contracts, financials, projections, BillingCategory â€” billing breakdown by accounting group, GapAnalysisRow â€” expected vs actual billing comparison (+7 more)

### Community 24 - "Tenant Upload Parser"
Cohesion: 0.24
Nodes (10): asString(), buildNameKey(), buildUploadArrendatarioKey(), emptyRow(), normalizeNamePart(), normalizeNullable(), normalizeUploadRut(), parseArrendatariosFile() (+2 more)

### Community 25 - "Finance API Params"
Cohesion: 0.36
Nodes (8): getFinanceFrom(), getFinanceMode(), getFinancePeriod(), getFinanceProjectId(), getFinanceTab(), getFinanceTenantId(), getFinanceTo(), getFirst()

### Community 26 - "Finance Reconciliation"
Cohesion: 0.42
Nodes (8): buildReconciliation(), findDecemberRate(), findGgccForPeriod(), findRateForPeriod(), isContractActiveInPeriod(), isGgccGroup3(), periodKey(), toNum()

### Community 27 - "Dashboard UI Components"
Cohesion: 0.31
Nodes (9): AlertBar Component, ContractExpiryTable Component, ContractList Component, ContractManager Component, DataTable Component, useContractApi Hook, useDataTable Hook, lib/kpi (AlertCounts, formatShortDate, ContractExpiryRow) (+1 more)

### Community 28 - "Project Context Resolution"
Cohesion: 0.25
Nodes (8): getCachedProjects (unstable_cache), getProjectContext Function, appendProjectIdQuery, appendProjectQuery, buildProjectQueryString, resolveProjectIdFromQuery, project-query Test Suite, ProjectSelector Component

### Community 29 - "Rent-Roll Timeline Pipeline"
Cohesion: 0.39
Nodes (6): buildFuturePeriodos(), buildHistoricalPeriodos(), computePctPromedioForPeriodo(), getTimelineData(), isBodegaEspacio(), isSimuladorModulo()

### Community 30 - "Observability & Logging"
Cohesion: 0.53
Nodes (4): logDuration(), logError(), logInfo(), writeLog()

### Community 31 - "Upload Data Payload"
Cohesion: 0.6
Nodes (5): isObjectRecord(), isRentRollPreviewPayload(), isUploadIssueArray(), isUploadRowArray(), parseRentRollPreviewPayload()

### Community 32 - "Unit Size Calculation"
Cohesion: 0.33
Nodes (4): CalculatedLocalSize â€” union type for commercial size classification, CommercialSizeRule â€” min/max m2 rule for size categorization, DEFAULT_COMMERCIAL_SIZE_RULES â€” tier thresholds (0-49, 50-119, 120+), getCalculatedLocalSize()

### Community 33 - "Local Size Formatter"
Cohesion: 0.5
Nodes (2): getCalculatedLocalSize(), parseSquareMeters()

### Community 34 - "Tenant Filter Builders"
Cohesion: 0.67
Nodes (2): buildArrendatariosActiveContractWhere(), buildArrendatariosWhere()

### Community 35 - "Contract Form State Hook"
Cohesion: 0.5
Nodes (4): useContractFormState Hook, contracts/contract-form-types (ContractDraftPayload, ContractFormProps), contracts/contract-form-utils (createEmptyPayload, fromContract, toApiPayload, mergeExtractedDraft), contracts/local-selection (buildLocalSelectionState, toggleLocalSelection, alignPrimaryLocalId)

### Community 36 - "Contract API Hook"
Cohesion: 0.5
Nodes (4): deleteContract Function, saveContract Function, uploadContractPdf Function, useContractApi Hook

### Community 37 - "HTTP Request Helpers"
Cohesion: 0.5
Nodes (4): getRequiredProjectIdFromRequest, getRequiredProjectIdSearchParam, getRequiredSearchParam, parseRequiredPaginationParams

### Community 38 - "Project Documentation"
Cohesion: 0.5
Nodes (4): CLAUDE.md â€” BetaMallSport Masterclass Reference, MallSportLogo.jpg â€” Sport Swoosh Multi-Color Brand Identity, BetaMallSport README â€” Non-Technical Guide, SETUP_ALFREDO.md â€” Alfredo Developer Onboarding Guide

### Community 39 - "EERR Income Statement Types"
Cohesion: 0.5
Nodes (4): EerrData â€” income statement data structure, EerrLine â€” individual P&L line item, EerrSection â€” P&L section with lines and period totals, EE.RR. Income Statement Pattern â€” hierarchical grupo1/grupo3 structure

### Community 40 - "Loading Skeletons"
Cohesion: 0.67
Nodes (0): 

### Community 41 - "Unit Filter Builders"
Cohesion: 0.67
Nodes (0): 

### Community 42 - "Navigation Items"
Cohesion: 0.67
Nodes (3): FINANZAS_SUB_NAV_ITEMS Constant, RENT_ROLL_SUB_NAV_ITEMS Constant, TOP_NAV_ITEMS Constant

### Community 43 - "Rent-Roll Timeline Route"
Cohesion: 1.0
Nodes (2): lib/rent-roll/timeline (getTimelineData), GET /api/rent-roll/timeline

### Community 44 - "Rent-Roll Snapshot Date"
Cohesion: 1.0
Nodes (2): Snapshot Date Utilities, RentRollSnapshotDatePicker

### Community 45 - "NextAuth Config"
Cohesion: 1.0
Nodes (2): auth() Session Accessor, NextAuth authOptions

### Community 46 - "Contract Expiry Buckets"
Cohesion: 1.0
Nodes (2): buildContractExpiryBuckets, buildContractExpiryRows

### Community 47 - "Finance Project ID Helpers"
Cohesion: 1.0
Nodes (2): getFinanceProjectId, withNormalizedProjectId

### Community 48 - "Upload Payload Parsers"
Cohesion: 1.0
Nodes (2): isRentRollPreviewPayload() â€” shape validator, parseRentRollPreviewPayload() â€” runtime type guard for upload JSON

### Community 49 - "Accounting Upload Types"
Cohesion: 1.0
Nodes (2): ContableSuggestion â€” fuzzy match suggestion for unmapped entries, ContableUploadResult â€” accounting upload summary

### Community 50 - "Graphify Documentation"
Cohesion: 1.0
Nodes (2): graphify-out README â€” Knowledge Graph Directory Guide, GRAPH_REPORT.md â€” Knowledge Graph Report

### Community 51 - "Next.js Type Declarations"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "Tailwind Config"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "Vitest Config"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "Mappings Legacy Route"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "Accounting Parser Module"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Sales Parser Module"
Cohesion: 1.0
Nodes (0): 

### Community 57 - "Finance Legacy Route"
Cohesion: 1.0
Nodes (0): 

### Community 58 - "Types Index"
Cohesion: 1.0
Nodes (0): 

### Community 59 - "NextAuth Types"
Cohesion: 1.0
Nodes (0): 

### Community 60 - "Config Loading Skeleton"
Cohesion: 1.0
Nodes (1): Configuracion Loading Skeleton

### Community 61 - "Finance Loading Skeleton"
Cohesion: 1.0
Nodes (1): Finance Loading Skeleton

### Community 62 - "Finance Analysis Loading"
Cohesion: 1.0
Nodes (1): Finance Analysis Loading Skeleton

### Community 63 - "Finance Dashboard Loading"
Cohesion: 1.0
Nodes (1): Finance Dashboard Loading Skeleton

### Community 64 - "Finance EERR Loading"
Cohesion: 1.0
Nodes (1): Finance EERR Loading Skeleton

### Community 65 - "Finance Mappings Loading"
Cohesion: 1.0
Nodes (1): Finance Mappings Loading Skeleton

### Community 66 - "Finance Reconciliation Loading"
Cohesion: 1.0
Nodes (1): Finance Reconciliation Loading Skeleton

### Community 67 - "Finance Tenants Loading"
Cohesion: 1.0
Nodes (1): Finance Tenants Loading Skeleton

### Community 68 - "Rent-Roll Contracts Loading"
Cohesion: 1.0
Nodes (1): Rent Roll Contracts Loading Skeleton

### Community 69 - "Rent-Roll Dashboard Loading"
Cohesion: 1.0
Nodes (1): Rent Roll Dashboard Loading Skeleton

### Community 70 - "Rent-Roll Tenants Loading"
Cohesion: 1.0
Nodes (1): Rent Roll Tenants Loading Skeleton

### Community 71 - "Rent-Roll Units Loading"
Cohesion: 1.0
Nodes (1): Rent Roll Units Loading Skeleton

### Community 72 - "Tenant 360 Loading"
Cohesion: 1.0
Nodes (1): Tenant 360 Loading Skeleton

### Community 73 - "Contract Form Payload Type"
Cohesion: 1.0
Nodes (1): ContractFormPayload Type

### Community 74 - "GLA Metrics Calculator"
Cohesion: 1.0
Nodes (1): calculateGlaMetrics

### Community 75 - "Vacancy Calculator"
Cohesion: 1.0
Nodes (1): calculateVacancy

### Community 76 - "Renta en Riesgo Builder"
Cohesion: 1.0
Nodes (1): buildRentaEnRiesgo

### Community 77 - "Ocupacion Detalle Builder"
Cohesion: 1.0
Nodes (1): buildOcupacionDetalle

### Community 78 - "Vencimientos por Anio Builder"
Cohesion: 1.0
Nodes (1): buildVencimientosPorAnio

### Community 79 - "Contract State Counters"
Cohesion: 1.0
Nodes (1): calculateContractStateCounters

### Community 80 - "Nav Item Active Checker"
Cohesion: 1.0
Nodes (1): isNavItemActive Function

### Community 81 - "Configuracion Nav Items"
Cohesion: 1.0
Nodes (1): CONFIGURACION_SUB_NAV_ITEMS Constant

### Community 82 - "Active Projects Cache Tag"
Cohesion: 1.0
Nodes (1): ACTIVE_PROJECTS_TAG Constant

### Community 83 - "Export Excel URL Builder"
Cohesion: 1.0
Nodes (1): buildExportExcelUrl

### Community 84 - "Export Datasets Config"
Cohesion: 1.0
Nodes (1): EXPORT_DATASETS Constant

### Community 85 - "Export Excel Query Type"
Cohesion: 1.0
Nodes (1): ExportExcelQuery Type

### Community 86 - "Finance From Param"
Cohesion: 1.0
Nodes (1): getFinanceFrom

### Community 87 - "Finance To Param"
Cohesion: 1.0
Nodes (1): getFinanceTo

### Community 88 - "Finance Tenant ID Param"
Cohesion: 1.0
Nodes (1): getFinanceTenantId

### Community 89 - "Finance Period Param"
Cohesion: 1.0
Nodes (1): getFinancePeriod

### Community 90 - "Finance Form Field Param"
Cohesion: 1.0
Nodes (1): getFormFieldValue

### Community 91 - "Reconciliation Tenant Row Type"
Cohesion: 1.0
Nodes (1): ReconciliationTenantRow Type

### Community 92 - "Tenant 360 Raw Contract Type"
Cohesion: 1.0
Nodes (1): RawContract Input Type

### Community 93 - "Ventas Upload Result Type"
Cohesion: 1.0
Nodes (1): VentasUploadResult â€” sales upload summary

## Ambiguous Edges - Review These
- `UploadSection Component` → `calculateOccupancy`  [AMBIGUOUS]
  src/components/upload/UploadSection.tsx · relation: conceptually_related_to

## Knowledge Gaps
- **186 isolated node(s):** `Configuracion Loading Skeleton`, `Finance Loading Skeleton`, `Finance Analysis Loading Skeleton`, `Finance Dashboard Loading Skeleton`, `Finance EERR Loading Skeleton` (+181 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Rent-Roll Timeline Route`** (2 nodes): `lib/rent-roll/timeline (getTimelineData)`, `GET /api/rent-roll/timeline`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Rent-Roll Snapshot Date`** (2 nodes): `Snapshot Date Utilities`, `RentRollSnapshotDatePicker`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `NextAuth Config`** (2 nodes): `auth() Session Accessor`, `NextAuth authOptions`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Contract Expiry Buckets`** (2 nodes): `buildContractExpiryBuckets`, `buildContractExpiryRows`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Finance Project ID Helpers`** (2 nodes): `getFinanceProjectId`, `withNormalizedProjectId`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Upload Payload Parsers`** (2 nodes): `isRentRollPreviewPayload() â€” shape validator`, `parseRentRollPreviewPayload() â€” runtime type guard for upload JSON`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Accounting Upload Types`** (2 nodes): `ContableSuggestion â€” fuzzy match suggestion for unmapped entries`, `ContableUploadResult â€” accounting upload summary`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Graphify Documentation`** (2 nodes): `graphify-out README â€” Knowledge Graph Directory Guide`, `GRAPH_REPORT.md â€” Knowledge Graph Report`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next.js Type Declarations`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tailwind Config`** (1 nodes): `tailwind.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Vitest Config`** (1 nodes): `vitest.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Mappings Legacy Route`** (1 nodes): `mapeos.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Accounting Parser Module`** (1 nodes): `parse-contable.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Sales Parser Module`** (1 nodes): `parse-ventas.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Finance Legacy Route`** (1 nodes): `finanzas.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Types Index`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `NextAuth Types`** (1 nodes): `next-auth.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Config Loading Skeleton`** (1 nodes): `Configuracion Loading Skeleton`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Finance Loading Skeleton`** (1 nodes): `Finance Loading Skeleton`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Finance Analysis Loading`** (1 nodes): `Finance Analysis Loading Skeleton`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Finance Dashboard Loading`** (1 nodes): `Finance Dashboard Loading Skeleton`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Finance EERR Loading`** (1 nodes): `Finance EERR Loading Skeleton`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Finance Mappings Loading`** (1 nodes): `Finance Mappings Loading Skeleton`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Finance Reconciliation Loading`** (1 nodes): `Finance Reconciliation Loading Skeleton`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Finance Tenants Loading`** (1 nodes): `Finance Tenants Loading Skeleton`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Rent-Roll Contracts Loading`** (1 nodes): `Rent Roll Contracts Loading Skeleton`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Rent-Roll Dashboard Loading`** (1 nodes): `Rent Roll Dashboard Loading Skeleton`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Rent-Roll Tenants Loading`** (1 nodes): `Rent Roll Tenants Loading Skeleton`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Rent-Roll Units Loading`** (1 nodes): `Rent Roll Units Loading Skeleton`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tenant 360 Loading`** (1 nodes): `Tenant 360 Loading Skeleton`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Contract Form Payload Type`** (1 nodes): `ContractFormPayload Type`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `GLA Metrics Calculator`** (1 nodes): `calculateGlaMetrics`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Vacancy Calculator`** (1 nodes): `calculateVacancy`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Renta en Riesgo Builder`** (1 nodes): `buildRentaEnRiesgo`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Ocupacion Detalle Builder`** (1 nodes): `buildOcupacionDetalle`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Vencimientos por Anio Builder`** (1 nodes): `buildVencimientosPorAnio`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Contract State Counters`** (1 nodes): `calculateContractStateCounters`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Nav Item Active Checker`** (1 nodes): `isNavItemActive Function`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Configuracion Nav Items`** (1 nodes): `CONFIGURACION_SUB_NAV_ITEMS Constant`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Active Projects Cache Tag`** (1 nodes): `ACTIVE_PROJECTS_TAG Constant`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Export Excel URL Builder`** (1 nodes): `buildExportExcelUrl`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Export Datasets Config`** (1 nodes): `EXPORT_DATASETS Constant`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Export Excel Query Type`** (1 nodes): `ExportExcelQuery Type`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Finance From Param`** (1 nodes): `getFinanceFrom`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Finance To Param`** (1 nodes): `getFinanceTo`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Finance Tenant ID Param`** (1 nodes): `getFinanceTenantId`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Finance Period Param`** (1 nodes): `getFinancePeriod`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Finance Form Field Param`** (1 nodes): `getFormFieldValue`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reconciliation Tenant Row Type`** (1 nodes): `ReconciliationTenantRow Type`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tenant 360 Raw Contract Type`** (1 nodes): `RawContract Input Type`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Ventas Upload Result Type`** (1 nodes): `VentasUploadResult â€” sales upload summary`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `UploadSection Component` and `calculateOccupancy`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `Dashboard Page (Control de Gestion)` connect `Contract API & Dashboard` to `Excel Export Pipeline`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **Why does `buildExportResult()` connect `Excel Export Pipeline` to `Contract API & Dashboard`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Rent Roll Units Page (Server Component)` (e.g. with `Tri-Mode CRUD Pattern (ver/cargar/upload)` and `Rent Roll Tenants Page (Server Component)`) actually correct?**
  _`Rent Roll Units Page (Server Component)` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Configuracion Loading Skeleton`, `Finance Loading Skeleton`, `Finance Analysis Loading Skeleton` to the rest of the system?**
  _186 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Tenant & Billing Components` be split into smaller, more focused modules?**
  _Cohesion score 0.02 - nodes in this community are weakly interconnected._
- **Should `Tenant Management CRUD` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._