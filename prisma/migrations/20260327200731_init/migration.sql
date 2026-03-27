-- CreateEnum
CREATE TYPE "LocalTipo" AS ENUM ('TIENDA', 'MODULO', 'BODEGA', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoMaestro" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "EstadoContrato" AS ENUM ('VIGENTE', 'TERMINADO', 'TERMINADO_ANTICIPADO', 'GRACIA');

-- CreateEnum
CREATE TYPE "TipoTarifaContrato" AS ENUM ('FIJO_UF_M2', 'FIJO_UF', 'PORCENTAJE');

-- CreateEnum
CREATE TYPE "EstadoDiaContrato" AS ENUM ('OCUPADO', 'GRACIA', 'VACANTE');

-- CreateEnum
CREATE TYPE "TipoCargaDatos" AS ENUM ('RENT_ROLL', 'VENTAS', 'CONTABLE', 'BANCO');

-- CreateEnum
CREATE TYPE "EstadoCargaDatos" AS ENUM ('PENDIENTE', 'PROCESANDO', 'OK', 'ERROR');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CONTABILIDAD', 'OPERACIONES', 'GERENCIA');

-- CreateTable
CREATE TABLE "Proyecto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Proyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValorUF" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "valor" DECIMAL(10,4) NOT NULL,

    CONSTRAINT "ValorUF_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Local" (
    "id" TEXT NOT NULL,
    "proyectoId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "glam2" DECIMAL(10,2) NOT NULL,
    "piso" TEXT NOT NULL,
    "tipo" "LocalTipo" NOT NULL,
    "zona" TEXT,
    "esGLA" BOOLEAN NOT NULL DEFAULT true,
    "estado" "EstadoMaestro" NOT NULL DEFAULT 'ACTIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Local_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Arrendatario" (
    "id" TEXT NOT NULL,
    "proyectoId" TEXT NOT NULL,
    "rut" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "nombreComercial" TEXT NOT NULL,
    "vigente" BOOLEAN NOT NULL DEFAULT true,
    "email" TEXT,
    "telefono" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Arrendatario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contrato" (
    "id" TEXT NOT NULL,
    "proyectoId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "arrendatarioId" TEXT NOT NULL,
    "numeroContrato" TEXT NOT NULL,
    "fechaInicio" DATE NOT NULL,
    "fechaTermino" DATE NOT NULL,
    "fechaEntrega" DATE,
    "fechaApertura" DATE,
    "pctRentaVariable" DECIMAL(6,3),
    "pctFondoPromocion" DECIMAL(6,3),
    "codigoCC" TEXT,
    "estado" "EstadoContrato" NOT NULL,
    "pdfUrl" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContratoTarifa" (
    "id" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "tipo" "TipoTarifaContrato" NOT NULL,
    "valor" DECIMAL(10,4) NOT NULL,
    "vigenciaDesde" DATE NOT NULL,
    "vigenciaHasta" DATE,
    "esDiciembre" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContratoTarifa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContratoAnexo" (
    "id" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "descripcion" TEXT NOT NULL,
    "camposModificados" JSONB NOT NULL,
    "snapshotAntes" JSONB NOT NULL,
    "snapshotDespues" JSONB NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContratoAnexo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContratoGGCC" (
    "id" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "tarifaBaseUfM2" DECIMAL(10,4) NOT NULL,
    "pctAdministracion" DECIMAL(6,3) NOT NULL,
    "vigenciaDesde" DATE NOT NULL,
    "vigenciaHasta" DATE,
    "proximoReajuste" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContratoGGCC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContratoDia" (
    "id" TEXT NOT NULL,
    "proyectoId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "contratoId" TEXT,
    "fecha" DATE NOT NULL,
    "tarifaDia" DECIMAL(10,4) NOT NULL,
    "estadoDia" "EstadoDiaContrato" NOT NULL,
    "glam2" DECIMAL(10,2) NOT NULL,
    "ufDia" DECIMAL(10,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContratoDia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CargaDatos" (
    "id" TEXT NOT NULL,
    "proyectoId" TEXT NOT NULL,
    "tipo" "TipoCargaDatos" NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "archivoNombre" TEXT NOT NULL,
    "archivoUrl" TEXT NOT NULL,
    "registrosCargados" INTEGER NOT NULL,
    "estado" "EstadoCargaDatos" NOT NULL,
    "errorDetalle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CargaDatos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'OPERACIONES',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Proyecto_slug_key" ON "Proyecto"("slug");

-- CreateIndex
CREATE INDEX "Proyecto_activo_idx" ON "Proyecto"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "ValorUF_fecha_key" ON "ValorUF"("fecha");

-- CreateIndex
CREATE INDEX "Local_proyectoId_idx" ON "Local"("proyectoId");

-- CreateIndex
CREATE INDEX "Local_estado_idx" ON "Local"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "Local_proyectoId_codigo_key" ON "Local"("proyectoId", "codigo");

-- CreateIndex
CREATE INDEX "Arrendatario_proyectoId_idx" ON "Arrendatario"("proyectoId");

-- CreateIndex
CREATE INDEX "Arrendatario_vigente_idx" ON "Arrendatario"("vigente");

-- CreateIndex
CREATE UNIQUE INDEX "Arrendatario_proyectoId_rut_key" ON "Arrendatario"("proyectoId", "rut");

-- CreateIndex
CREATE INDEX "Contrato_proyectoId_idx" ON "Contrato"("proyectoId");

-- CreateIndex
CREATE INDEX "Contrato_localId_idx" ON "Contrato"("localId");

-- CreateIndex
CREATE INDEX "Contrato_arrendatarioId_idx" ON "Contrato"("arrendatarioId");

-- CreateIndex
CREATE INDEX "Contrato_estado_idx" ON "Contrato"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "Contrato_proyectoId_numeroContrato_key" ON "Contrato"("proyectoId", "numeroContrato");

-- CreateIndex
CREATE INDEX "ContratoTarifa_contratoId_idx" ON "ContratoTarifa"("contratoId");

-- CreateIndex
CREATE INDEX "ContratoTarifa_vigenciaDesde_vigenciaHasta_idx" ON "ContratoTarifa"("vigenciaDesde", "vigenciaHasta");

-- CreateIndex
CREATE INDEX "ContratoAnexo_contratoId_idx" ON "ContratoAnexo"("contratoId");

-- CreateIndex
CREATE INDEX "ContratoAnexo_usuarioId_idx" ON "ContratoAnexo"("usuarioId");

-- CreateIndex
CREATE INDEX "ContratoGGCC_contratoId_idx" ON "ContratoGGCC"("contratoId");

-- CreateIndex
CREATE INDEX "ContratoDia_proyectoId_idx" ON "ContratoDia"("proyectoId");

-- CreateIndex
CREATE INDEX "ContratoDia_contratoId_idx" ON "ContratoDia"("contratoId");

-- CreateIndex
CREATE UNIQUE INDEX "ContratoDia_localId_fecha_key" ON "ContratoDia"("localId", "fecha");

-- CreateIndex
CREATE INDEX "CargaDatos_proyectoId_idx" ON "CargaDatos"("proyectoId");

-- CreateIndex
CREATE INDEX "CargaDatos_tipo_idx" ON "CargaDatos"("tipo");

-- CreateIndex
CREATE INDEX "CargaDatos_estado_idx" ON "CargaDatos"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- AddForeignKey
ALTER TABLE "Local" ADD CONSTRAINT "Local_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arrendatario" ADD CONSTRAINT "Arrendatario_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrato" ADD CONSTRAINT "Contrato_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrato" ADD CONSTRAINT "Contrato_localId_fkey" FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrato" ADD CONSTRAINT "Contrato_arrendatarioId_fkey" FOREIGN KEY ("arrendatarioId") REFERENCES "Arrendatario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoTarifa" ADD CONSTRAINT "ContratoTarifa_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoAnexo" ADD CONSTRAINT "ContratoAnexo_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoGGCC" ADD CONSTRAINT "ContratoGGCC_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoDia" ADD CONSTRAINT "ContratoDia_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoDia" ADD CONSTRAINT "ContratoDia_localId_fkey" FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoDia" ADD CONSTRAINT "ContratoDia_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CargaDatos" ADD CONSTRAINT "CargaDatos_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
