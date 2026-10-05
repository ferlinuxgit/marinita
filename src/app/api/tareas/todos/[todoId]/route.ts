import { deleteTodoHandler, updateTodoHandler } from "@/modules/tareas/server/handlers";

export const PATCH = updateTodoHandler;
export const DELETE = deleteTodoHandler;
