import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const accountingMappingSchema = z.object({
  projectId: z.string().uuid(),
  externalUnit: z.string().min(1),
  unitId: z.string().uuid()
});

export const salesMappingSchema = z.object({
  projectId: z.string().uuid(),
  salesAccountId: z.number().int(),
  storeName: z.string().min(1),
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

export async function getFinanceMappingsData(projectId: string) {
  const [accountingMappings, salesMappings, units] = await Promise.all([
    getAccountingMappings(projectId),
    getSalesMappings(projectId),
    getActiveUnits(projectId)
  ]);

  return {
    accountingMappings,
    salesMappings,
    units
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
      projectId_salesAccountId: {
        projectId: data.projectId,
        salesAccountId: data.salesAccountId
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

// Legacy aliases during deprecation window.
export const contableMapeoSchema = accountingMappingSchema;
export const ventasMapeoSchema = salesMappingSchema;
export const getContableMapeos = getAccountingMappings;
export const getVentasMapeos = getSalesMappings;
export const getActiveLocales = getActiveUnits;
export const getFinanzasMapeosData = getFinanceMappingsData;
export const upsertContableMapeo = upsertAccountingMapping;
export const upsertVentasMapeo = upsertSalesMapping;
