import { FileSpreadsheet } from "lucide-react";

import { moduleApi, moduleHref, type AppModule } from "@/core/modules/types";

export const gastosModule = {
  id: "gastos",
  name: "Gastos",
  navLabel: "Gastos",
  description: "Analiza exports de Payhawk, revisa una vista previa y exporta el resumen.",
  icon: FileSpreadsheet,
} satisfies AppModule;

export const gastosRoutes = {
  home: moduleHref(gastosModule),
  history: moduleHref(gastosModule, "/historial"),
  report: (reportId: string) => moduleHref(gastosModule, `/historial/${reportId}`),
};

export const gastosApi = {
  reports: moduleApi(gastosModule, "/reports"),
  report: (reportId: string) => moduleApi(gastosModule, `/reports/${reportId}`),
  summaryExport: (reportId: string) => moduleApi(gastosModule, `/reports/${reportId}/export`),
  accountingExport: (reportId: string) =>
    moduleApi(gastosModule, `/reports/${reportId}/accounting-export`),
};
