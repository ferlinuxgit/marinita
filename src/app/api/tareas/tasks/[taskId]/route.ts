import { deleteTaskHandler, updateTaskHandler } from "@/modules/tareas/server/handlers";

export const PATCH = updateTaskHandler;
export const DELETE = deleteTaskHandler;
