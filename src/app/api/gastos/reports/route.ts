import { createReportHandler, listReportsHandler } from "@/modules/gastos/server/handlers";

export const GET = listReportsHandler;
export const POST = createReportHandler;
