import type { z } from "zod";
import { ApiError } from "@/lib/api-error";
import { buildCursorPaginatedResponse } from "@/lib/http/pagination-response";
import { prisma } from "@/lib/prisma";
import { resolveTenantRut, tenantSchema } from "@/lib/tenants/schema";

type TenantPayload = z.infer<typeof tenantSchema>;

type ListTenantsPageInput = {
  projectId: string;
  limit: number;
  cursor?: string;
};

export async function listTenantsPage(input: ListTenantsPageInput) {
  const items = await prisma.tenant.findMany({
    where: { projectId: input.projectId },
    take: input.limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    orderBy: { id: "asc" }
  });

  return buildCursorPaginatedResponse(items, input.limit);
}

export async function getTenantById(input: { projectId: string; tenantId: string }) {
  return prisma.tenant.findFirst({
    where: { id: input.tenantId, projectId: input.projectId }
  });
}

export async function createTenant(input: { payload: TenantPayload }) {
  return prisma.tenant.create({
    data: {
      projectId: input.payload.projectId,
      rut: resolveTenantRut(
        input.payload.rut,
        input.payload.razonSocial,
        input.payload.nombreComercial
      ),
      razonSocial: input.payload.razonSocial,
      nombreComercial: input.payload.nombreComercial,
      vigente: input.payload.vigente,
      email: input.payload.email || null,
      telefono: input.payload.telefono || null
    }
  });
}

export async function updateTenant(input: { tenantId: string; payload: TenantPayload }) {
  const existing = await prisma.tenant.findFirst({
    where: { id: input.tenantId, projectId: input.payload.projectId },
    select: { id: true }
  });
  if (!existing) {
    throw new ApiError(404, "Arrendatario no encontrado.");
  }

  return prisma.tenant.update({
    where: { id: input.tenantId },
    data: {
      rut: resolveTenantRut(
        input.payload.rut,
        input.payload.razonSocial,
        input.payload.nombreComercial
      ),
      razonSocial: input.payload.razonSocial,
      nombreComercial: input.payload.nombreComercial,
      vigente: input.payload.vigente,
      email: input.payload.email || null,
      telefono: input.payload.telefono || null
    }
  });
}

export async function deleteTenant(input: { projectId: string; tenantId: string }) {
  const deleted = await prisma.tenant.deleteMany({
    where: { id: input.tenantId, projectId: input.projectId }
  });

  if (deleted.count === 0) {
    throw new ApiError(404, "Arrendatario no encontrado.");
  }
}
