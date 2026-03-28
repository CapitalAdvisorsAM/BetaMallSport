# BetaMallSport — Control de Gestión

## Descripción
Sistema de control de gestión para Mall Sport. Gestión de contratos, locales,
arrendatarios y métricas de Rent Roll.

## Stack
Next.js 14 App Router · TypeScript · Prisma 5 · PostgreSQL · NextAuth v4 Google SSO
Tailwind CSS · Capital Advisors AGF design system

## Variables de entorno requeridas
```bash
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ALLOWED_EMAIL_DOMAIN=
PDF_UPLOAD_DIR=
```

## Comandos de desarrollo
```bash
npm run dev                # servidor local
npm run build              # compilación producción
npx prisma migrate dev     # migraciones
npx prisma studio          # explorador de BD
```

## Arquitectura de rutas
- `/` -> Dashboard KPIs globales
- `/rent-roll` -> Tabla de contratos vigentes
- `/rent-roll/dashboard` -> Métricas por tienda
- `/rent-roll/locales` -> CRUD de locales
- `/rent-roll/arrendatarios` -> CRUD de arrendatarios
- `/rent-roll/contratos` -> CRUD de contratos
- `/rent-roll/upload` -> Carga masiva CSV/XLSX
- `/rent-roll/proyectos` -> CRUD de proyectos

## Roles y permisos
- `ADMIN` -> lectura + escritura + administración
- `OPERACIONES` -> lectura + escritura
- `CONTABILIDAD` -> lectura + escritura de ventas
- `GERENCIA` -> solo lectura
