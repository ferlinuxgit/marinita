import { createDataHandler, listDataHandler } from "@/modules/tareas/server/handlers";

export const GET = listDataHandler;
export const POST = createDataHandler;
