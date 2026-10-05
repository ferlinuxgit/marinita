import type { AppModule } from "@/core/modules/types";
import { facturasModule } from "@/modules/facturas/module";
import { gastosModule } from "@/modules/gastos/module";
import { tareasModule } from "@/modules/tareas/module";

// Registry of installed modules, in navigation order. `npm run module:new` adds entries here.
export const appModules: AppModule[] = [
  gastosModule,
  facturasModule,
  tareasModule,
  // module:new:entry
];

export function enabledModules() {
  return appModules.filter((appModule) => appModule.enabled !== false);
}
