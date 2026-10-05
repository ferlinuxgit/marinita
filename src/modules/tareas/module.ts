import { CalendarCheck } from "lucide-react";

import { moduleApi, moduleHref, type AppModule } from "@/core/modules/types";

export const tareasModule = {
  id: "tareas",
  name: "Tareas y cierres",
  navLabel: "Tareas",
  description: "Calendario de tareas con repeticiones y checklists de cierre por empresa.",
  icon: CalendarCheck,
} satisfies AppModule;

export const tareasRoutes = {
  calendar: moduleHref(tareasModule),
  closings: moduleHref(tareasModule, "/cierres"),
  company: (companyId: string) => moduleHref(tareasModule, `/cierres/${companyId}`),
  closing: (companyId: string, closingId: string) =>
    moduleHref(tareasModule, `/cierres/${companyId}/${closingId}`),
};

export const tareasApi = {
  tasks: moduleApi(tareasModule, "/tasks"),
  task: (taskId: string) => moduleApi(tareasModule, `/tasks/${taskId}`),
  taskDone: (taskId: string) => moduleApi(tareasModule, `/tasks/${taskId}/done`),
  dayOrder: moduleApi(tareasModule, "/day-order"),
  companies: moduleApi(tareasModule, "/companies"),
  company: (companyId: string) => moduleApi(tareasModule, `/companies/${companyId}`),
  companyClosings: (companyId: string) => moduleApi(tareasModule, `/companies/${companyId}/closings`),
  closing: (closingId: string) => moduleApi(tareasModule, `/closings/${closingId}`),
  closingItems: (closingId: string) => moduleApi(tareasModule, `/closings/${closingId}/items`),
  closingItem: (closingId: string, itemId: string) =>
    moduleApi(tareasModule, `/closings/${closingId}/items/${itemId}`),
  closingReorder: (closingId: string) => moduleApi(tareasModule, `/closings/${closingId}/reorder`),
};
