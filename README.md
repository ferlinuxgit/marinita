# Marinita

Aplicacion Next.js de herramientas internas, organizada en modulos independientes:

- **Gastos** (`/app/gastos`): analiza exports de Payhawk en Excel, guarda un historial y exporta el resumen y los asientos contables.
- **Facturas** (`/app/facturas`): lee facturas BP en PDF y prepara una linea por centro de coste.
- **Tareas y cierres** (`/app/tareas`): calendario de tareas (semana, dos semanas, mes) con colores y repeticiones, y checklists de cierre por empresa (`/app/tareas/cierres`).

### Tareas y cierres

- Las fechas de las tareas se guardan como dias de calendario (`date`, sin hora), asi que no cambian con la zona horaria del navegador. El dia actual se calcula con la zona horaria de `src/modules/tareas/config.ts` (`Europe/Madrid`).
- Una tarea repetida es una serie; el estado de cada aparicion (realizada, eliminada o editada) se guarda aparte, por lo que completar una no afecta a las demas. "Esta y las siguientes" cierra la serie original el dia anterior y crea otra nueva, conservando el historial.
- Repeticion mensual en dia 29, 30 o 31: en los meses sin ese dia se usa el ultimo dia del mes.
- Las empresas, los cierres y las tareas pertenecen al usuario que los crea, igual que los informes de gastos.
- Los checklists se guardan automaticamente. Copiar un cierre copia la estructura (tareas, subtareas y orden) sin marcas ni observaciones.

## Stack

- Next.js App Router
- Postgres
- Better Auth con email/password
- Drizzle ORM
- ExcelJS para lectura y exportacion Excel
- pdf.js para leer PDF
- Vitest para los tests

## Estructura

```
src/
  core/        nucleo compartido: auth, db, entorno, errores y helpers HTTP, UI comun
  modules/     un directorio por modulo + registro (index.ts). Guia: src/modules/README.md
  app/         rutas de Next.js; paginas y endpoints finos que delegan en los modulos
```

Para crear un modulo nuevo: `npm run module:new -- <id> "<Nombre>"` y sigue `src/modules/README.md`.

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

La app excluye las filas con `Document Type = Invoice`, agrupa por cuenta/equipo/empleado y exporta `Total Agrupado (EUR)` en una hoja `Resumen`. Si un importe no se puede leer, el analisis se detiene indicando la fila.

Las reglas de negocio (cuentas contables, epigrafes, tipo de IVA, valores fijos de las lineas de factura) estan en el `config.ts` de cada modulo.

## Comandos

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run module:new -- <id> "<Nombre>"
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
AUTH_ALLOW_SIGNUPS=false
SIGNUP_INVITE_CODE=change-me
```

En produccion la app no arranca si faltan `DATABASE_URL` o `BETTER_AUTH_SECRET`.

`RUN_MIGRATIONS=true` hace que el contenedor aplique las migraciones Drizzle al arrancar. En despliegues con una sola replica es lo mas simple. Si en el futuro hay varias replicas, conviene mover las migraciones a un job separado y poner `RUN_MIGRATIONS=false` en la app web.

`SIGNUP_INVITE_CODE` bloquea el registro publico. Solo podran crear cuenta las personas que conozcan ese codigo. El login sigue funcionando normalmente para usuarios ya creados.

`AUTH_ALLOW_SIGNUPS=false` deshabilita completamente la creacion de usuarios. Para crear usuarios temporalmente, pon `AUTH_ALLOW_SIGNUPS=true` y comparte `SIGNUP_INVITE_CODE` solo con quien deba registrarse. Despues vuelve a `false`.

### Base de datos persistente

No metas Postgres dentro del mismo contenedor de la app. En Coolify crea un recurso separado de PostgreSQL y activa almacenamiento persistente para su volumen de datos. La app debe conectarse a ese recurso mediante `DATABASE_URL`.

La idea correcta es:

- Servicio `marinita-app`: contenedor construido desde este repo.
- Servicio `marinita-postgres`: PostgreSQL gestionado por Coolify.
- Volumen persistente en `marinita-postgres`, no en `marinita-app`.
- `DATABASE_URL` de la app apuntando al host interno del Postgres de Coolify.

Mientras no borres el recurso PostgreSQL ni su volumen, los datos sobreviven a cada redeploy de la app.
