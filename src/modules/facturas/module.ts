import { ReceiptText } from "lucide-react";

import { moduleApi, moduleHref, type AppModule } from "@/core/modules/types";

export const facturasModule = {
  id: "facturas",
  name: "Facturas por centro de coste",
  navLabel: "Facturas",
  description: "Lee facturas BP en PDF y prepara las líneas para pegarlas en la factura.",
  icon: ReceiptText,
} satisfies AppModule;

export const facturasRoutes = {
  home: moduleHref(facturasModule),
};

export const facturasApi = {
  analyze: moduleApi(facturasModule, "/analyze"),
  export: moduleApi(facturasModule, "/export"),
};
