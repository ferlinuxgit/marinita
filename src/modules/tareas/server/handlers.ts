import "server-only";

import { NextResponse } from "next/server";

import { UserFacingError } from "@/core/http/errors";
import { withUser } from "@/core/http/handler";
import { tareasConfig } from "@/modules/tareas/config";
import { diffDays } from "@/modules/tareas/lib/dates";
import {
  closingCreateSchema,
  editScopeSchema,
  isoDateSchema,
  itemCreateSchema,
  itemUpdateSchema,
  nameSchema,
  reorderSchema,
  taskDoneSchema,
  taskInputSchema,
  taskUpdateSchema,
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
  setTaskDone,
  updateTask,
} from "@/modules/tareas/server/tasks-repository";

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
