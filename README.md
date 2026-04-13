# BetaMallSport - Guia Clara Para Equipos No Tecnicos

## Que es este sistema
BetaMallSport es una plataforma interna para administrar la operacion comercial de un centro comercial.

En simple, responde tres preguntas clave:
1. Que locales estan ocupados y cuales estan vacantes.
2. Cuanto deberia ingresar segun los contratos.
3. Que riesgos hay en los proximos meses (vencimientos, periodos de gracia, etc.).

No necesitas saber programar para usarlo.

## Para quien esta pensado
- Gerencia: seguimiento ejecutivo del estado del negocio.
- Operaciones: administracion diaria de locales, arrendatarios y contratos.
- Contabilidad: registro y seguimiento de ventas (via API interna).
- Administracion del sistema: control de accesos y configuracion inicial.

## Que puedes hacer dentro de la plataforma
- Ver un dashboard ejecutivo con alertas y KPIs.
- Revisar el Rent Roll (estado contractual y financiero por local).
- Crear y editar proyectos (cada proyecto es un mall o activo independiente).
- Administrar locales.
- Administrar arrendatarios.
- Crear y actualizar contratos, tarifas y GGCC.
- Cargar datos masivos por Excel/CSV (con previsualizacion antes de aplicar).
- Adjuntar PDF de contratos.

## Flujo recomendado de uso (primeras semanas)
### 1) Preparacion inicial
1. Crear el proyecto.
2. Cargar `Locales`.
3. Cargar `Arrendatarios`.
4. Cargar `Contratos`.
5. Revisar resultados en `Rent Roll` y `Dashboard`.

### 2) Operacion mensual
1. Revisar alertas en Dashboard.
2. Validar vencimientos de contratos proximos.
3. Actualizar cambios de contratos o anexos.
4. Ejecutar cargas masivas si hubo cambios de datos maestros.
5. Confirmar ocupacion, renta comprometida y GGCC.

## Explicacion de cada modulo (en lenguaje simple)
### Dashboard Ejecutivo (`/`)
Vista de salud general del proyecto.

Aqui veras:
- Ocupacion total.
- Renta en riesgo (contratos que vencen pronto).
- Ingresos del periodo.
- GGCC estimados.
- Vencimientos por ano.

### Rent Roll (`/rent-roll`)
Vista operativa local por local.

Aqui veras:
- Estado del local (`OCUPADO`, `GRACIA`, `VACANTE`).
- Arrendatario actual.
- Tarifa UF/m2.
- Renta fija.
- GGCC.
- Dias para vencimiento del contrato.

### Dashboard de Rent Roll (`/rent-roll/dashboard`)
Enfoque analitico del rent roll por periodo, con resumen por categoria y tamano.

### Proyectos (`/rent-roll/proyectos`)
Crea y gestiona proyectos activos/inactivos.

### Locales (`/rent-roll/locales`)
Registro maestro de locales (codigo, nombre, m2, tipo, estado).

### Arrendatarios (`/rent-roll/arrendatarios`)
Registro maestro de empresas/personas arrendatarias (RUT, razon social, nombre comercial).

### Contratos (`/rent-roll/contratos`)
Gestion completa de contratos, tarifas y GGCC.

### Cargas Masivas (`/rent-roll/upload`)
Subida por archivo para actualizar muchos registros de una vez.

Orden recomendado de primera carga:
1. Locales
2. Arrendatarios
3. Contratos

## Conceptos clave (glosario corto)
- `GLA (m2)`: superficie arrendable util.
- `UF`: unidad reajustable usada para expresar valores de contratos.
- `% Ocupacion`: superficie arrendada / superficie total.
- `GGCC`: gastos comunes.
- `VIGENTE`: contrato activo que genera renta.
- `GRACIA`: contrato firmado que aun no inicia cobro normal.
- `VACANTE`: local sin contrato activo.

## Cargas masivas: como funcionan
Cada carga tiene dos pasos:
1. `Previsualizar`: revisa resultado fila por fila sin guardar cambios definitivos.
2. `Aplicar`: confirma y guarda en base de datos.

Estados por fila:
- `NUEVO`: se creara un registro nuevo.
- `ACTUALIZADO`: se modificara un registro existente.
- `SIN_CAMBIO`: no requiere actualizacion.
- `ERROR`: no se puede aplicar esa fila.

Limites actuales:
- Tamano maximo por archivo: `5 MB`.
- Maximo de filas por carga: `2000`.
- Formatos permitidos: `.csv`, `.xlsx`, `.xls`.

## Adjuntar PDF de contratos
- Formato permitido: `PDF`.
- Tamano maximo: `10 MB`.

## Roles y permisos
Roles disponibles en el sistema:
- `ADMIN`
- `OPERACIONES`
- `CONTABILIDAD`
- `GERENCIA`

Regla general de edicion (CRUD de proyectos/locales/arrendatarios/contratos/cargas):
- Escritura: `ADMIN` y `OPERACIONES`.
- Solo lectura: `CONTABILIDAD` y `GERENCIA`.

Excepcion actual:
- Registro de ventas (`/api/rent-roll/ventas`): permitido para `ADMIN` y `CONTABILIDAD`.

## Acceso y seguridad
- Inicio de sesion con Google Workspace.
- Solo se permite ingreso para el dominio configurado en `ALLOWED_EMAIL_DOMAIN`.

## Problemas frecuentes
### No puedo entrar al sistema
Revisa que tu correo pertenezca al dominio corporativo habilitado.

### No veo datos
Verifica que exista al menos un proyecto activo y que este seleccionado.

### Una carga falla
Descarga el detalle de errores CSV, corrige el archivo original y vuelve a previsualizar.

### Un local no aparece en Rent Roll
Revisa que el local este `ACTIVO` y correctamente configurado para el proyecto.

## Si eres tecnico: puesta en marcha local
### Requisitos
- Node.js 20+
- npm
- PostgreSQL 15 (o Docker)

### Opcion A: con Docker (recomendada)
1. Copiar variables:
```bash
cp .env.example .env
```
2. Levantar servicios:
```bash
docker compose up --build
```
3. Abrir:
- App: http://localhost:3000
- Base de datos: puerto `5432`

### Opcion B: sin Docker
1. Instalar dependencias:
```bash
npm install
```
2. Copiar variables:
```bash
cp .env.example .env
```
3. Ajustar `DATABASE_URL` en `.env`.
4. Crear/actualizar esquema:
```bash
npm run prisma:migrate
```
5. Iniciar app:
```bash
npm run dev
```

## Variables de entorno principales
Minimas para ejecutar:
- `DATABASE_URL`: conexion a PostgreSQL.
- `NEXTAUTH_URL`: URL publica/local de la app.
- `NEXTAUTH_SECRET`: secreto de sesiones.
- `GOOGLE_CLIENT_ID`: cliente OAuth de Google.
- `GOOGLE_CLIENT_SECRET`: secreto OAuth de Google.
- `ALLOWED_EMAIL_DOMAIN`: dominio permitido para login.

El archivo `.env.example` tambien incluye variables GCP opcionales para integraciones futuras.

## Comandos utiles
```bash
npm run dev
npm run build
npm run start
npm run lint
npm run check:naming-core
npm run test
npm run prisma:generate
npm run prisma:push
npm run prisma:migrate
```

## Guia rapida: scaffold CRUD reutilizable
Para nuevas pantallas CRUD, usar este stack base antes de crear componentes ad-hoc:

1. `EntityCrudShell`: estructura comun (titulo, toolbar, formulario, tabla, mensajes).
2. `EntityFormSection`: submit consistente create/edit con estados de carga.
3. `EntityActionsCell`: acciones de fila (editar/eliminar/configurar).
4. `useCrudResource`: estado uniforme (`idle/loading/success/error`) para create/update/delete.
5. `data-table-columns`: helpers para columnas (`enumFilterColumn`, `numberFilterColumn`, `statusBadgeColumn`, `linkColumn`).

Checklist recomendado para nuevas entidades:

1. Definir tipos `Record` + `Form`.
2. Crear funciones API (`create/update/delete`) reutilizando `extractApiErrorMessage`.
3. Conectar con `useCrudResource`.
4. Construir tabla con los helpers de columna.
5. Usar `ConfirmModal` para acciones destructivas (no usar `window.confirm`).

## Estandar de nombres (desarrollo)
Para evitar mezcla Spanglish en codigo nuevo del core de Rent Roll:

- Canonico en codigo y rutas internas: ingles (`contracts`, `tenants`, `units`, `projects`).
- Compatibilidad legacy: se mantienen alias en espanol por ventana de deprecacion.
- Copy visible al usuario: puede seguir en espanol.
- Prisma Client del core: nombres en ingles, preservando tablas/columnas existentes via `@map` y `@@map`.

Guardrail:
- `npm run check:naming-core` valida que en los modulos canonicos del core no se agreguen nuevos identificadores/rutas en espanol.

## Estructura funcional resumida
- `src/app`: paginas y rutas API.
- `src/components`: interfaces por modulo.
- `src/lib`: reglas de negocio, autenticacion, validaciones.
- `prisma/`: modelo de datos y migraciones.

## Estado del producto
Modulos activos hoy:
- Dashboard
- Rent Roll
- Proyectos
- Locales
- Arrendatarios
- Contratos
- Carga masiva

Modulos visibles pero no habilitados en menu principal:
- Finanzas
- Reportes
