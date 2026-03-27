# Mall Sport

Sistema de gestion de activos inmobiliarios con Next.js 14, Prisma, PostgreSQL y despliegue en GCP.

## Requisitos

- Docker y Docker Compose
- Node.js 20+ (opcional para ejecucion fuera de contenedores)
- Proyecto GCP con OAuth Google Workspace

## Setup local

1. Copiar variables:

```bash
cp .env.example .env
```

2. Levantar servicios:

```bash
docker-compose up --build
```

3. Abrir la app en `http://localhost:3000`.

## Modulo operativo implementado

- Selector de proyecto por query param (`proyecto`) reutilizado en rent roll, cargas y contratos.
- Rent Roll:
  - Vista principal con filtros por estado y busqueda.
  - Estado de ultima carga y acceso a detalle.
  - Carga masiva CSV/XLSX con preview y aplicacion por lote.
  - Descarga de errores por fila en CSV.
- Contratos:
  - Listado por proyecto.
  - Crear/editar contrato.
  - Gestion de Tarifas, GGCC y Anexos.
- Seguridad por rol:
  - `ADMIN` y `OPERACIONES`: escritura.
  - `CONTABILIDAD` y `GERENCIA`: solo lectura.

## Endpoints nuevos

- `POST /api/rent-roll/upload/preview`
- `POST /api/rent-roll/upload/apply`
- `GET /api/rent-roll/upload/errors?cargaId=...`
- `GET /api/contracts?proyectoId=...`
- `POST /api/contracts`
- `PUT /api/contracts/:id`

## Deploy GCP

El workflow de CI/CD en `.github/workflows/deploy.yml`:

1. Autentica con Workload Identity Federation.
2. Construye y publica imagen en Artifact Registry.
3. Despliega en Cloud Run usando secretos de Secret Manager.

## Estructura principal

```text
.
├── prisma/
├── src/
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   ├── rent-roll/
│   │   │   │   ├── page.tsx
│   │   │   │   └── upload/page.tsx
│   │   │   └── contratos/page.tsx
│   │   └── api/
│   │       ├── contracts/
│   │       └── rent-roll/upload/
│   ├── components/
│   │   ├── contracts/
│   │   └── rent-roll/
│   └── lib/
├── Dockerfile
├── docker-compose.yml
└── .github/workflows/deploy.yml
```
