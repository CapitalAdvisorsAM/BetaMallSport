# Mall Sport

Sistema de gestion de activos inmobiliarios desplegable en Google Cloud Platform con Next.js 14, Prisma, PostgreSQL y autenticacion Google Workspace.

## Requisitos

- Docker y Docker Compose
- Node.js 20+ (solo para desarrollo local fuera de contenedores)
- Cuenta de GCP con permisos para Cloud Run, Artifact Registry, Cloud SQL y Secret Manager
- Proyecto de Google Cloud con Google OAuth configurado

## Setup local

1. Clonar el repositorio y entrar a la carpeta:

   ```bash
   cd mall-sport
   ```

2. Revisar variables de entorno:

   - `docker-compose.yml` usa `.env` por defecto.
   - Se incluye `.env.example` como plantilla.

3. Levantar servicios:

   ```bash
   docker-compose up --build
   ```

4. Abrir app:

   - `http://localhost:3000`

5. Primera inicializacion de base de datos:

   - El contenedor de app ejecuta `npx prisma db push` automaticamente.

## Setup GCP

### 1. Servicios que debes habilitar

Ejecuta en tu proyecto:

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  iamcredentials.googleapis.com \
  secretmanager.googleapis.com \
  sqladmin.googleapis.com
```

### 2. Artifact Registry

```bash
gcloud artifacts repositories create mall-sport \
  --repository-format=docker \
  --location=southamerica-west1 \
  --description="Mall Sport images"
```

### 3. Cloud SQL (PostgreSQL)

```bash
gcloud sql instances create mall-sport-pg \
  --database-version=POSTGRES_15 \
  --tier=db-custom-1-3840 \
  --region=southamerica-west1

gcloud sql databases create mallsport --instance=mall-sport-pg
gcloud sql users set-password postgres --instance=mall-sport-pg --password='CHANGEME'
```

Luego construye el `DATABASE_URL` y guardalo en Secret Manager.

### 4. Secret Manager

Crear secretos requeridos:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Ejemplo:

```bash
printf "postgresql://postgres:CHANGEME@/mallsport?host=/cloudsql/PROJECT:REGION:INSTANCE" | \
gcloud secrets create DATABASE_URL --data-file=-
```

Si ya existe, usar `gcloud secrets versions add`.

### 5. Workload Identity Federation (GitHub Actions sin keys)

1. Crear Workload Identity Pool.
2. Crear Workload Identity Provider para GitHub OIDC.
3. Crear service account para CI/CD.
4. Otorgar roles al service account:
   - `roles/run.admin`
   - `roles/artifactregistry.writer`
   - `roles/iam.serviceAccountUser`
   - `roles/secretmanager.secretAccessor`
   - `roles/cloudsql.client`
5. Permitir que el principal de GitHub impersonifique el service account.
6. Configurar secretos en GitHub:
   - `GCP_WORKLOAD_IDENTITY_PROVIDER`
   - `GCP_SERVICE_ACCOUNT_EMAIL`
7. Configurar variables en GitHub (`Repository Variables`):
   - `GCP_PROJECT_ID`
   - `GCP_REGION`
   - `ARTIFACT_REGISTRY_REPO`
   - `CLOUD_RUN_SERVICE`
   - `CLOUD_SQL_INSTANCE`
   - `ALLOWED_EMAIL_DOMAIN`
   - `NEXTAUTH_URL`

## Primer deploy

1. Push a `main`:

   ```bash
   git push origin main
   ```

2. GitHub Actions ejecutara:

   - Build y push de imagen a Artifact Registry:
     - `REGION-docker.pkg.dev/PROJECT_ID/REPO/mall-sport:SHA`
   - Deploy a Cloud Run con secretos desde Secret Manager.

3. Verificar servicio desplegado:

   ```bash
   gcloud run services describe <CLOUD_RUN_SERVICE> --region <GCP_REGION>
   ```

## Estructura del proyecto

```text
mall-sport/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   └── rent-roll/page.tsx
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   └── rent-roll/route.ts
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/
│   │   └── rent-roll/ContractTable.tsx
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── auth.ts
│   │   └── utils.ts
│   └── types/
│       └── index.ts
├── .github/workflows/deploy.yml
├── Dockerfile
├── docker-compose.yml
└── .env.example
```
