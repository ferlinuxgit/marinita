# Marinita

Aplicacion Next.js para analizar exports de Payhawk en Excel y generar un resumen agrupado.

## Stack

- Next.js App Router
- Postgres
- Better Auth con email/password
- Drizzle ORM
- ExcelJS para lectura y exportacion Excel

## Desarrollo

```bash
cp .env.example .env
docker compose up -d postgres
npm run db:migrate
npm run dev
```

La base local usa `localhost:55432` para evitar colisiones con otros Postgres locales.

## Excel esperado

El archivo debe ser `.xlsx` y tener una hoja llamada `Payments` con estas columnas:

- `Account Code`
- `Teams External ID`
- `Expense Owner ID`
- `Expense Owner`
- `Total Expense (EUR)`
- `Document Type`

La app excluye las filas con `Document Type = Invoice`, agrupa por cuenta/equipo/empleado y exporta `Total Agrupado (EUR)` en una hoja `Resumen`.

## Comandos

```bash
npm run lint
npm run typecheck
npm run build
npm run db:generate
npm run db:migrate
npm run db:studio
```

## Despliegue en Coolify

Usa el `Dockerfile` del repo para desplegar la app como servicio web.

Variables necesarias:

```env
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DB_NAME
BETTER_AUTH_SECRET=change-me
BETTER_AUTH_URL=https://marinita.comodore.es
NEXT_PUBLIC_APP_URL=https://marinita.comodore.es
RUN_MIGRATIONS=true
```

`RUN_MIGRATIONS=true` hace que el contenedor aplique las migraciones Drizzle al arrancar. En despliegues con una sola replica es lo mas simple. Si en el futuro hay varias replicas, conviene mover las migraciones a un job separado y poner `RUN_MIGRATIONS=false` en la app web.

### Base de datos persistente

No metas Postgres dentro del mismo contenedor de la app. En Coolify crea un recurso separado de PostgreSQL y activa almacenamiento persistente para su volumen de datos. La app debe conectarse a ese recurso mediante `DATABASE_URL`.

La idea correcta es:

- Servicio `marinita-app`: contenedor construido desde este repo.
- Servicio `marinita-postgres`: PostgreSQL gestionado por Coolify.
- Volumen persistente en `marinita-postgres`, no en `marinita-app`.
- `DATABASE_URL` de la app apuntando al host interno del Postgres de Coolify.

Mientras no borres el recurso PostgreSQL ni su volumen, los datos sobreviven a cada redeploy de la app.
