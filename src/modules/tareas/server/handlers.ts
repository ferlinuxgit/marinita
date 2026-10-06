import "server-only";

import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { UserFacingError } from "@/core/http/errors";
import { withUser } from "@/core/http/handler";
import { xlsxResponse } from "@/core/http/responses";
import { readUploadedFile } from "@/core/http/upload";
import { tareasConfig } from "@/modules/tareas/config";
import { contentSummary, dataBlocksSchema } from "@/modules/tareas/lib/data-blocks";
import { parseDataWorkbook } from "@/modules/tareas/lib/data-import";
import { buildDataTemplate, buildDataWorkbook } from "@/modules/tareas/lib/data-workbook";
import { diffDays } from "@/modules/tareas/lib/dates";
import {
  closingCreateSchema,
  dataEntryNewSchema,
  dataImportOptionsSchema,
  dataEntryUpdateSchema,
  dayOrderSchema,
  editScopeSchema,
  isoDateSchema,
  itemCreateSchema,
  itemUpdateSchema,
  nameSchema,
  reorderSchema,
  taskDoneSchema,
  taskInputSchema,
  taskUpdateSchema,
  todoCreateSchema,
  todoReorderSchema,
  todoUpdateSchema,
} from "@/modules/tareas/lib/validation";
import {
  addItem,
  createClosing,
  createCompany,
  deleteClosing,
  deleteItem,
  getClosing,
  getCompany,
  listCompanies,
  renameClosing,
  renameCompany,
  reorderItems,
  updateItem,
} from "@/modules/tareas/server/closings-repository";
import {
  createTask,
  deleteTask,
  listOccurrences,
  saveDayOrder,
  setTaskDone,
  updateTask,
} from "@/modules/tareas/server/tasks-repository";
import {
  createDataEntry,
  dataEntryIdsByTitle,
  importDataEntries,
  deleteDataEntry,
  getDataEntry,
  listDataEntries,
  updateDataEntry,
} from "@/modules/tareas/server/data-repository";
import { addTodo, deleteTodo, listTodos, reorderTodos, updateTodo } from "@/modules/tareas/server/todos-repository";

async function readJson(request: Request) {
  try {
    return (await request.json()) as unknown;
  } catch {
    throw new UserFacingError("Los datos enviados no son válidos.");
  }
}

const ok = () => NextResponse.json({ ok: true });

// --- Calendar ------------------------------------------------------------------------------

export const listTasksHandler = withUser(async ({ request, user }) => {
  const url = new URL(request.url);
  const from = isoDateSchema.parse(url.searchParams.get("from"));
  const to = isoDateSchema.parse(url.searchParams.get("to"));
  const days = diffDays(from, to);

  if (days < 0 || days > tareasConfig.limits.rangeDays) {
    throw new UserFacingError("El periodo solicitado no es válido.");
  }

  return NextResponse.json({ occurrences: await listOccurrences(user.id, from, to) });
});

export const createTaskHandler = withUser(async ({ request, user }) => {
  const task = taskInputSchema.parse(await readJson(request));
  return NextResponse.json(await createTask(user.id, task), { status: 201 });
});

export const updateTaskHandler = withUser<{ taskId: string }>(async ({ request, user, params }) => {
  const { scope, occurrenceDate, task } = taskUpdateSchema.parse(await readJson(request));
  await updateTask(user.id, params.taskId, scope, occurrenceDate, task);
  return ok();
});

export const deleteTaskHandler = withUser<{ taskId: string }>(async ({ request, user, params }) => {
  const url = new URL(request.url);
  const scope = editScopeSchema.parse(url.searchParams.get("scope") ?? "all");
  const occurrence = url.searchParams.get("occurrenceDate");
  await deleteTask(user.id, params.taskId, scope, occurrence ? isoDateSchema.parse(occurrence) : null);
  return ok();
});

export const setTaskDoneHandler = withUser<{ taskId: string }>(async ({ request, user, params }) => {
  const { occurrenceDate, done } = taskDoneSchema.parse(await readJson(request));
  await setTaskDone(user.id, params.taskId, occurrenceDate, done);
  return ok();
});

export const saveDayOrderHandler = withUser(async ({ request, user }) => {
  const { date, keys } = dayOrderSchema.parse(await readJson(request));
  await saveDayOrder(user.id, date, keys);
  return ok();
});

// --- Companies & closings ------------------------------------------------------------------

export const listCompaniesHandler = withUser(async ({ user }) => {
  return NextResponse.json({ companies: await listCompanies(user.id) });
});

export const createCompanyHandler = withUser(async ({ request, user }) => {
  const { name } = nameSchema.parse(await readJson(request));
  return NextResponse.json(await createCompany(user.id, name), { status: 201 });
});

export const getCompanyHandler = withUser<{ companyId: string }>(async ({ user, params }) => {
  return NextResponse.json(await getCompany(user.id, params.companyId));
});

export const renameCompanyHandler = withUser<{ companyId: string }>(async ({ request, user, params }) => {
  const { name } = nameSchema.parse(await readJson(request));
  await renameCompany(user.id, params.companyId, name);
  return ok();
});

export const createClosingHandler = withUser<{ companyId: string }>(async ({ request, user, params }) => {
  const { name, sourceClosingId } = closingCreateSchema.parse(await readJson(request));
  return NextResponse.json(await createClosing(user.id, params.companyId, name, sourceClosingId), { status: 201 });
});

export const getClosingHandler = withUser<{ closingId: string }>(async ({ user, params }) => {
  return NextResponse.json(await getClosing(user.id, params.closingId));
});

export const renameClosingHandler = withUser<{ closingId: string }>(async ({ request, user, params }) => {
  const { name } = nameSchema.parse(await readJson(request));
  await renameClosing(user.id, params.closingId, name);
  return ok();
});

export const deleteClosingHandler = withUser<{ closingId: string }>(async ({ user, params }) => {
  await deleteClosing(user.id, params.closingId);
  return ok();
});

export const addItemHandler = withUser<{ closingId: string }>(async ({ request, user, params }) => {
  const { parentId, name } = itemCreateSchema.parse(await readJson(request));
  return NextResponse.json(await addItem(user.id, params.closingId, parentId, name), { status: 201 });
});

export const updateItemHandler = withUser<{ closingId: string; itemId: string }>(
  async ({ request, user, params }) => {
    const values = itemUpdateSchema.parse(await readJson(request));
    await updateItem(user.id, params.closingId, params.itemId, values);
    return ok();
  },
);

export const deleteItemHandler = withUser<{ closingId: string; itemId: string }>(async ({ user, params }) => {
  await deleteItem(user.id, params.closingId, params.itemId);
  return ok();
});

export const reorderItemsHandler = withUser<{ closingId: string }>(async ({ request, user, params }) => {
  const { parentId, ids } = reorderSchema.parse(await readJson(request));
  await reorderItems(user.id, params.closingId, parentId, ids);
  return ok();
});

// --- Undated to-do list ----------------------------------------------------------------------

export const listTodosHandler = withUser(async ({ user }) => {
  return NextResponse.json({ todos: await listTodos(user.id) });
});

export const addTodoHandler = withUser(async ({ request, user }) => {
  const { title } = todoCreateSchema.parse(await readJson(request));
  return NextResponse.json(await addTodo(user.id, title), { status: 201 });
});

export const updateTodoHandler = withUser<{ todoId: string }>(async ({ request, user, params }) => {
  await updateTodo(user.id, params.todoId, todoUpdateSchema.parse(await readJson(request)));
  return ok();
});

export const deleteTodoHandler = withUser<{ todoId: string }>(async ({ user, params }) => {
  await deleteTodo(user.id, params.todoId);
  return ok();
});

export const reorderTodosHandler = withUser(async ({ request, user }) => {
  const { ids } = todoReorderSchema.parse(await readJson(request));
  await reorderTodos(user.id, ids);
  return ok();
});

// --- Data sheets -----------------------------------------------------------------------------

export const listDataHandler = withUser(async ({ user }) => {
  return NextResponse.json({ entries: await listDataEntries(user.id) });
});

export const createDataHandler = withUser(async ({ request, user }) => {
  const { title, description, blocks } = dataEntryNewSchema.parse(await readJson(request));
  return NextResponse.json(await createDataEntry(user.id, title, description, blocks), { status: 201 });
});

export const dataTemplateHandler = withUser(async () => {
  return xlsxResponse(await buildDataTemplate(), "Ejemplo importación datos.xlsx");
});

/**
 * Import from Excel in two steps: `mode=preview` returns what would be imported (and which titles
 * already exist); `mode=apply` saves it, updating or duplicating existing titles.
 */
export const importDataHandler = withUser(async ({ request, user }) => {
  const file = await readUploadedFile(request, {
    extensions: [".xlsx"],
    maxBytes: 5 * 1024 * 1024,
    label: "un archivo .xlsx",
  });
  const { mode, duplicates } = dataImportOptionsSchema.parse({
    mode: file.form.get("mode") ?? undefined,
    duplicates: file.form.get("duplicates") ?? undefined,
  });
  const parsed = await parseDataWorkbook(file.buffer, randomUUID);
  const entries = parsed.entries.map((entry) => ({ ...entry, blocks: dataBlocksSchema.parse(entry.blocks) }));

  if (entries.length === 0) {
    throw new UserFacingError("No se ha encontrado ningún dato en el Excel. Descarga el ejemplo para ver el formato.");
  }

  if (mode === "apply") {
    return NextResponse.json(await importDataEntries(user.id, entries, duplicates));
  }

  const existing = await dataEntryIdsByTitle(user.id);

  return NextResponse.json({
    entries: entries.map((entry) => ({
      sheet: entry.sheet,
      title: entry.title,
      description: entry.description,
      summary: contentSummary(entry.blocks),
      exists: existing.has(entry.title.trim().toLocaleLowerCase("es")),
    })),
    ignored: parsed.ignored,
    warnings: parsed.warnings,
  });
});

export const exportAllDataHandler = withUser(async ({ user }) => {
  const workbook = await buildDataWorkbook(await listDataEntries(user.id));
  return xlsxResponse(workbook, "Datos.xlsx");
});

export const exportDataHandler = withUser<{ entryId: string }>(async ({ user, params }) => {
  const entry = await getDataEntry(user.id, params.entryId);
  return xlsxResponse(await buildDataWorkbook([entry]), `${entry.title}.xlsx`);
});

export const getDataHandler = withUser<{ entryId: string }>(async ({ user, params }) => {
  return NextResponse.json(await getDataEntry(user.id, params.entryId));
});

export const updateDataHandler = withUser<{ entryId: string }>(async ({ request, user, params }) => {
  await updateDataEntry(user.id, params.entryId, dataEntryUpdateSchema.parse(await readJson(request)));
  return ok();
});

export const deleteDataHandler = withUser<{ entryId: string }>(async ({ user, params }) => {
  await deleteDataEntry(user.id, params.entryId);
  return ok();
});
