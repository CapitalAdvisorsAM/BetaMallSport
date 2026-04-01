# Guía de configuración — Alfredo

Eres un asistente técnico configurando el entorno del proyecto **BetaMallSport**.
El repositorio ya está clonado, las dependencias instaladas y estás en el branch `Alfredo`.
Continúa desde aquí:

---

## PASO 1 — Configurar variables de entorno

Crea el archivo `.env` en la raíz del proyecto:

```bash
cp .env.example .env
```

Abre `.env` y déjalo así:

```
DATABASE_URL="postgresql://neondb_owner:npg_wdRecY0jC2GA@ep-calm-base-acc94hsi-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="cualquier-string-largo-para-desarrollo-local"
GOOGLE_CLIENT_ID="pedir a Felipe"
GOOGLE_CLIENT_SECRET="pedir a Felipe"
ALLOWED_EMAIL_DOMAIN="capitaladvisors.cl"
GCS_BUCKET_NAME="mall-sport-contratos"
```

> `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` pídeselos a Felipe por mensaje privado.

---

## PASO 2 — Aplicar migraciones

Esto crea todas las tablas en tu base de datos:

```bash
npx prisma migrate deploy
```

Debe terminar diciendo `All migrations have been successfully applied`.

---

## PASO 3 — Verificar que todo funciona

```bash
npm run dev
```

Abre http://localhost:3000. Debes ver la aplicación funcionando.

---

## PASO 4 — Flujo diario

**Al comenzar cada día**, sincroniza con los cambios de Felipe:

```bash
git fetch origin
git merge origin/main
npx prisma migrate deploy
```

El último comando solo hace algo si Felipe agregó migraciones nuevas.
Si no hay nada nuevo, termina instantáneamente.

---

## PASO 5 — Enviar tu trabajo

Nunca hagas push directo a `main`. Siempre trabaja en `Alfredo` y abre un Pull Request:

```bash
git add .
git commit -m "feat: descripción de lo que hiciste"
git push origin Alfredo
```

Luego ve a https://github.com/CapitalAdvisorsAM/BetaMallSport
Aparece un botón verde **"Compare & pull request"** → créalo y Felipe lo revisará.

---

## ⚠️ Regla crítica sobre el schema

Si modificas `prisma/schema.prisma`, **avísale a Felipe primero** y luego corre:

```bash
npx prisma migrate dev --name descripcion-del-cambio
```

Incluye los archivos generados en `prisma/migrations/` en tu commit.
Nunca edites migraciones que ya existen.

---

Si algo falla, muéstrame el error exacto y te ayudo.
