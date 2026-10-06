import { CalendarCheck } from "lucide-react";

import { moduleApi, moduleHref, type AppModule } from "@/core/modules/types";

export const tareasModule = {
  id: "tareas",
  name: "Agenda",
  navLabel: "Agenda",
  description: "Calendario, lista de tareas, checklists de cierre por empresa y datos de consulta.",
  icon: CalendarCheck,
} satisfies AppModule;

export const tareasRoutes = {
  calendar: moduleHref(tareasModule),
  todos: moduleHref(tareasModule, "/lista"),
  closings: moduleHref(tareasModule, "/cierres"),
  data: moduleHref(tareasModule, "/datos"),
  dataEntry: (entryId: string) => moduleHref(tareasModule, `/datos/${entryId}`),
  company: (companyId: string) => moduleHref(tareasModule, `/cierres/${companyId}`),
  closing: (companyId: string, closingId: string) =>
    moduleHref(tareasModule, `/cierres/${companyId}/${closingId}`),
};

export const tareasApi = {
  tasks: moduleApi(tareasModule, "/tasks"),
  task: (taskId: string) => moduleApi(tareasModule, `/tasks/${taskId}`),
  taskDone: (taskId: string) => moduleApi(tareasModule, `/tasks/${taskId}/done`),
  dayOrder: moduleApi(tareasModule, "/day-order"),
  todos: moduleApi(tareasModule, "/todos"),
  todo: (todoId: string) => moduleApi(tareasModule, `/todos/${todoId}`),
  todosReorder: moduleApi(tareasModule, "/todos/reorder"),
  data: moduleApi(tareasModule, "/data"),
  dataEntry: (entryId: string) => moduleApi(tareasModule, `/data/${entryId}`),
  dataExportAll: moduleApi(tareasModule, "/data/export"),
  dataTemplate: moduleApi(tareasModule, "/data/template"),
  dataImport: moduleApi(tareasModule, "/data/import"),
  dataExport: (entryId: string) => moduleApi(tareasModule, `/data/${entryId}/export`),
  companies: moduleApi(tareasModule, "/companies"),
  company: (companyId: string) => moduleApi(tareasModule, `/companies/${companyId}`),
  companyClosings: (companyId: string) => moduleApi(tareasModule, `/companies/${companyId}/closings`),
  closing: (closingId: string) => moduleApi(tareasModule, `/closings/${closingId}`),
  closingItems: (closingId: string) => moduleApi(tareasModule, `/closings/${closingId}/items`),
  closingItem: (closingId: string, itemId: string) =>
    moduleApi(tareasModule, `/closings/${closingId}/items/${itemId}`),
  closingReorder: (closingId: string) => moduleApi(tareasModule, `/closings/${closingId}/reorder`),
};
