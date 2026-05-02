import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const accountingMappingSchema = z.object({
  projectId: z.string().uuid(),
  externalUnit: z.string().min(1),
  unitId: z.string().uuid()
});

export const salesMappingSchema = z.object({
  projectId: z.string().uuid(),
  salesAccountId: z.string().trim().min(1),
  storeName: z.string().min(1),
  tenantId: z.string().uuid()
});

export const accountingTenantMappingSchema = z.object({
  projectId: z.string().uuid(),
  externalTenant: z.string().trim().min(1),
  tenantId: z.string().uuid()
});

export async function getActiveUnits(projectId: string) {
  return prisma.unit.findMany({
    where: { projectId: projectId, estado: "ACTIVO" },
    select: { id: true, codigo: true, nombre: true },
    orderBy: { codigo: "asc" }
  });
}

export async function getAccountingMappings(projectId: string) {
  return prisma.accountingUnitMapping.findMany({
    where: { projectId },
    include: { unit: { select: { codigo: true, nombre: true } } },
    orderBy: { externalUnit: "asc" }
  });
}

export async function getSalesMappings(projectId: string) {
  return prisma.salesTenantMapping.findMany({
    where: { projectId },
    include: { tenant: { select: { nombreComercial: true, rut: true } } },
    orderBy: { storeName: "asc" }
  });
}

export async function getActiveTenants(projectId: string) {
  return prisma.tenant.findMany({
    where: { projectId, vigente: true },
    select: { id: true, rut: true, razonSocial: true, nombreComercial: true },
    orderBy: { nombreComercial: "asc" }
  });
}

export async function getAccountingTenantMappings(projectId: string) {
  return prisma.accountingTenantMapping.findMany({
    where: { projectId },
    include: { tenant: { select: { nombreComercial: true, razonSocial: true, rut: true } } },
    orderBy: { externalTenant: "asc" }
  });
}

export async function getUnmappedAccountingRecords(projectId: string) {
  const records = await prisma.accountingRecord.findMany({
    where: {
      projectId,
      OR: [{ unitId: null }, { tenantId: null }]
    },
    select: {
      id: true,
      period: true,
      unitId: true,
      tenantId: true,
      externalUnit: true,
      externalTenant: true,
      group1: true,
      group3: true,
      denomination: true,
      valueUf: true,
      valueClp: true
    },
    orderBy: [{ period: "desc" }, { group1: "asc" }, { denomination: "asc" }]
  });

  return records.map((record) => ({
    id: record.id,
    period: record.period.toISOString().slice(0, 7),
    unitId: record.unitId,
    tenantId: record.tenantId,
    externalUnit: record.externalUnit,
    externalTenant: record.externalTenant,
    group1: record.group1,
    group3: record.group3,
    denomination: record.denomination,
    valueUf: Number(record.valueUf),
    valueClp: record.valueClp === null ? null : Number(record.valueClp)
  }));
}

export async function getFinanceMappingsData(projectId: string) {
  const [
    accountingMappings,
    salesMappings,
    accountingTenantMappings,
    unmappedAccountingRecords,
    units,
    tenants
  ] = await Promise.all([
    getAccountingMappings(projectId),
    getSalesMappings(projectId),
    getAccountingTenantMappings(projectId),
    getUnmappedAccountingRecords(projectId),
    getActiveUnits(projectId),
    getActiveTenants(projectId)
  ]);

  return {
    accountingMappings,
    salesMappings,
    accountingTenantMappings,
    unmappedAccountingRecords,
    units,
    tenants
  };
}

export async function upsertAccountingMapping(
  data: z.infer<typeof accountingMappingSchema>,
  userId: string
) {
  return prisma.accountingUnitMapping.upsert({
    where: {
      projectId_externalUnit: {
        projectId: data.projectId,
        externalUnit: data.externalUnit
      }
    },
    update: {
      unitId: data.unitId,
      createdBy: userId
    },
    create: {
      projectId: data.projectId,
      externalUnit: data.externalUnit,
      unitId: data.unitId,
      createdBy: userId
    }
  });
}

export async function upsertSalesMapping(
  data: z.infer<typeof salesMappingSchema>,
  userId: string
) {
  return prisma.salesTenantMapping.upsert({
    where: {
      projectId_salesAccountId_storeName: {
        projectId: data.projectId,
        salesAccountId: data.salesAccountId,
        storeName: data.storeName
      }
    },
    update: {
      tenantId: data.tenantId,
      storeName: data.storeName,
      createdBy: userId
    },
    create: {
      projectId: data.projectId,
      salesAccountId: data.salesAccountId,
      storeName: data.storeName,
      tenantId: data.tenantId,
      createdBy: userId
    }
  });
}

export async function upsertAccountingTenantMapping(
  data: z.infer<typeof accountingTenantMappingSchema>,
  userId: string
) {
  return prisma.accountingTenantMapping.upsert({
    where: {
      projectId_externalTenant: {
        projectId: data.projectId,
        externalTenant: data.externalTenant
      }
    },
    update: {
      tenantId: data.tenantId,
      createdBy: userId
    },
    create: {
      projectId: data.projectId,
      externalTenant: data.externalTenant,
      tenantId: data.tenantId,
      createdBy: userId
    }
  });
}

// Legacy aliases during deprecation window.
export const contableMapeoSchema = accountingMappingSchema;
export const ventasMapeoSchema = salesMappingSchema;
export const getContableMapeos = getAccountingMappings;
export const getVentasMapeos = getSalesMappings;
export const getActiveLocales = getActiveUnits;
export const getFinanzasMapeosData = getFinanceMappingsData;
export const upsertContableMapeo = upsertAccountingMapping;
export const upsertVentasMapeo = upsertSalesMapping;
