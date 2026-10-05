# Módulos

Cada mini app de Marinita es un **módulo** autocontenido en `src/modules/<id>/`. El núcleo
(`src/core/`) aporta autenticación, base de datos, manejo de errores, subida de archivos y la
interfaz común. Los módulos no se importan entre sí: lo que necesiten compartir se mueve a `core`.

## Crear un módulo

```bash
npm run module:new -- control-horas "Control de horas"
```

Genera el esqueleto, crea la página `/app/control-horas` y registra el módulo en
`src/modules/index.ts` (aparece en la navegación y en la portada). Después:

1. Cambia `description` e `icon` en `module.ts` (iconos: https://lucide.dev/icons).
2. Escribe la lógica en `lib/`, la interfaz en `components/` y las reglas de negocio en `config.ts`.
3. Si necesita API, base de datos o tests, sigue las secciones de abajo.

## Estructura

```
src/modules/<id>/
  module.ts          metadatos (id, nombre, icono) + helpers de rutas y API
  config.ts          constantes de negocio (cuentas, tipos de IVA, límites...)
  lib/               lógica pura: parseo, cálculos, generación de Excel. Testeable sin servidor
  lib/*.test.ts      tests con Vitest, junto al código que prueban
  server/            código solo de servidor (`import "server-only"`)
    handlers.ts      manejadores de API envueltos con `withUser`
    repository.ts    consultas a base de datos, siempre filtradas por usuario
  db/schema.ts       tablas Drizzle del módulo (opcional)
  components/        componentes React

src/app/app/<id>/...        páginas: solo importan un componente del módulo
src/app/api/<id>/.../route.ts   rutas: solo reexportan handlers del módulo
```

Las carpetas `src/app/...` solo existen porque Next.js enruta por sistema de archivos. Mantenlas finas:

```ts
// src/app/api/control-horas/entries/route.ts
import { createEntryHandler, listEntriesHandler } from "@/modules/control-horas/server/handlers";

export const GET = listEntriesHandler;
export const POST = createEntryHandler;
```

## API

```ts
// src/modules/<id>/server/handlers.ts
import "server-only";

import { NextResponse } from "next/server";

import { NotFoundError, UserFacingError } from "@/core/http/errors";
import { withUser } from "@/core/http/handler";
import { xlsxResponse } from "@/core/http/responses";
import { readUploadedFile } from "@/core/http/upload";

export const uploadHandler = withUser(async ({ request, user }) => {
  const file = await readUploadedFile(request, {
    extensions: [".xlsx"],
    maxBytes: 8 * 1024 * 1024,
    label: "un archivo .xlsx",
  });
  // ...
  return NextResponse.json({ ok: true });
});

export const getItemHandler = withUser<{ itemId: string }>(async ({ user, params }) => {
  // params.itemId viene de la carpeta [itemId]
});
```

- `withUser` devuelve 401 sin sesión y convierte las excepciones en respuestas JSON `{ error }`.
- Lanza `UserFacingError("mensaje")` cuando el error es del usuario (archivo incorrecto, datos que
  faltan): se muestra tal cual con estado 400. `NotFoundError` da 404.
- Cualquier otro error se registra en el log y el usuario solo ve "Error interno" (500).
- Valida los cuerpos JSON con Zod (`schema.parse(body)`): si fallan, se responde 400.

En el cliente, usa `fetchJson`, `downloadFile`, `uploadBody` y `errorMessage` de
`@/core/ui/api-client`, `FileDropzone` de `@/core/ui/file-dropzone` para subir archivos y `Modal`
de `@/core/ui/modal` para formularios en ventana.

Las páginas de servidor pueden leer datos directamente del repositorio del módulo
(`requirePageUser()` + `orNotFound(...)` de `@/core/http/pages` para mostrar un 404). El módulo
`tareas` sigue este patrón.

## Estilos

Los estilos comunes están en `src/app/globals.css`. Si un módulo necesita los suyos, crea
`src/modules/<id>/<id>.css` con clases prefijadas (ej. `tk-` en `tareas`) e impórtalo en
`src/app/app/<id>/layout.tsx`.

## Base de datos

1. Crea `src/modules/<id>/db/schema.ts`. Prefija las tablas con el id del módulo
   (`control_horas_entries`) e importa `user` con ruta **relativa**
   (`../../../core/db/auth-schema`), porque drizzle-kit no entiende el alias `@/`.
2. Añade `export * from "../../modules/<id>/db/schema";` en `src/core/db/schema.ts`.
3. `npm run db:generate` y revisa la migración generada en `drizzle/`.
4. Incluye siempre `userId` en el `where` de las consultas para que nadie vea datos de otro usuario
   (ver `gastos/server/repository.ts`).

## Tests

Pon la lógica en `lib/` como funciones puras (reciben buffers o datos, devuelven datos) y pruébala
con `*.test.ts` al lado. `npm test` los ejecuta todos. Para Excel, genera el archivo de entrada en
el propio test con ExcelJS en lugar de guardar binarios.

## Desactivar un módulo

Pon `enabled: false` en su `module.ts`: desaparece de la navegación y la portada. Sus rutas siguen
existiendo; para quitarlo del todo, borra su carpeta, sus rutas en `src/app` y su entrada en
`src/modules/index.ts` (y en `src/core/db/schema.ts` si tenía tablas).
