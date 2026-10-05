import { addTodoHandler, listTodosHandler } from "@/modules/tareas/server/handlers";

export const GET = listTodosHandler;
export const POST = addTodoHandler;
