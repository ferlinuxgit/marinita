import { createCompanyHandler, listCompaniesHandler } from "@/modules/tareas/server/handlers";

export const GET = listCompaniesHandler;
export const POST = createCompanyHandler;
