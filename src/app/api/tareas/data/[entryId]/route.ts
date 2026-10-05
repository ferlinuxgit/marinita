import { deleteDataHandler, getDataHandler, updateDataHandler } from "@/modules/tareas/server/handlers";

export const GET = getDataHandler;
export const PUT = updateDataHandler;
export const DELETE = deleteDataHandler;
