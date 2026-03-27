import type { EstadoContrato, UserRole } from "@prisma/client";

export type RentRollRow = {
  id: string;
  local: string;
  arrendatario: string;
  estado: EstadoContrato;
  fechaInicio: Date;
  fechaTermino: Date;
  tarifaVigenteUfM2: string;
  m2: string;
};

export type AppRole = UserRole;
