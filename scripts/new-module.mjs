// Scaffolds a new module: npm run module:new -- <id> "<Nombre visible>"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const [id, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(" ").trim();

if (!id || !/^[a-z][a-z0-9-]*$/.test(id) || !name) {
  console.error('Uso: npm run module:new -- <id> "<Nombre visible>"');
  console.error("El id debe ir en minúsculas, con letras, números o guiones (ej: control-horas).");
  process.exit(1);
}

const root = process.cwd();
const moduleDir = join(root, "src", "modules", id);
const pageDir = join(root, "src", "app", "app", id);

if (existsSync(moduleDir) || existsSync(pageDir)) {
  console.error(`Ya existe un módulo o una ruta con el id "${id}".`);
  process.exit(1);
}

const camel = id.replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase());
const pascal = camel[0].toUpperCase() + camel.slice(1);
const moduleConst = `${camel}Module`;
const quoted = JSON.stringify(name);

const files = {
  [join(moduleDir, "module.ts")]: `import { Box } from "lucide-react";

import { moduleApi, moduleHref, type AppModule } from "@/core/modules/types";

export const ${moduleConst} = {
  id: "${id}",
  name: ${quoted},
  navLabel: ${quoted},
  description: "Describe aquí lo que hace el módulo.",
  icon: Box,
} satisfies AppModule;

export const ${camel}Routes = {
  home: moduleHref(${moduleConst}),
};

export const ${camel}Api = {
  base: moduleApi(${moduleConst}),
};
`,
  [join(moduleDir, "config.ts")]: `// Business rules for the ${name} module. Keep constants here, not in the logic.
export const ${camel}Config = {};
`,
  [join(moduleDir, "components", `${id}-home.tsx`)]: `export function ${pascal}Home() {
  return (
    <div className="grid">
      <section>
        <h1>${name}</h1>
        <p className="muted">Módulo en construcción.</p>
      </section>
    </div>
  );
}
`,
  [join(pageDir, "page.tsx")]: `import { ${pascal}Home } from "@/modules/${id}/components/${id}-home";

export default function ${pascal}Page() {
  return <${pascal}Home />;
}
`,
};

for (const [path, content] of Object.entries(files)) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  console.log(`creado  ${path.slice(root.length + 1)}`);
}

const registryPath = join(root, "src", "modules", "index.ts");
const registry = readFileSync(registryPath, "utf8");
const entryMarker = "  // module:new:entry";
const importLine = `import { ${moduleConst} } from "@/modules/${id}/module";\n`;
const lastImport = registry.lastIndexOf('from "@/modules/');
const importInsertAt = registry.indexOf("\n", lastImport) + 1;

if (!registry.includes(entryMarker) || lastImport < 0) {
  console.error(`No se pudo registrar el módulo: añade ${moduleConst} a src/modules/index.ts a mano.`);
  process.exit(1);
}

const updatedRegistry = (registry.slice(0, importInsertAt) + importLine + registry.slice(importInsertAt)).replace(
  entryMarker,
  `  ${moduleConst},\n${entryMarker}`,
);
writeFileSync(registryPath, updatedRegistry);
console.log("registrado en src/modules/index.ts");
console.log(`\nAbre http://localhost:3000/app/${id}. Guía completa en src/modules/README.md.`);
