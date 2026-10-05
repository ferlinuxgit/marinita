import {
  deleteClosingHandler,
  getClosingHandler,
  renameClosingHandler,
} from "@/modules/tareas/server/handlers";

export const GET = getClosingHandler;
export const PATCH = renameClosingHandler;
export const DELETE = deleteClosingHandler;
