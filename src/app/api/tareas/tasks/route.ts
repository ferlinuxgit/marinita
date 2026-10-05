import { createTaskHandler, listTasksHandler } from "@/modules/tareas/server/handlers";

export const GET = listTasksHandler;
export const POST = createTaskHandler;
