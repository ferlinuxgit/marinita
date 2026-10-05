import "server-only";

import { randomUUID } from "node:crypto";

import { and, asc, eq, max } from "drizzle-orm";

import { db } from "@/core/db";
import { NotFoundError, UserFacingError } from "@/core/http/errors";
import { tareasTodos } from "@/modules/tareas/db/schema";

const todoColumns = { id: tareasTodos.id, title: tareasTodos.title, done: tareasTodos.done, position: tareasTodos.position };

export type Todo = { id: string; title: string; done: boolean; position: number };

export async function listTodos(userId: string): Promise<Todo[]> {
  return db.select(todoColumns).from(tareasTodos).where(eq(tareasTodos.userId, userId)).orderBy(asc(tareasTodos.position));
}

export async function addTodo(userId: string, title: string): Promise<Todo> {
  const [{ last }] = await db
    .select({ last: max(tareasTodos.position) })
    .from(tareasTodos)
    .where(eq(tareasTodos.userId, userId));
  const todo = { id: randomUUID(), title, done: false, position: (last ?? -1) + 1 };
  await db.insert(tareasTodos).values({ ...todo, userId });
  return todo;
}

export async function updateTodo(userId: string, todoId: string, values: Partial<Pick<Todo, "title" | "done">>) {
  const updated = await db
    .update(tareasTodos)
    .set(values)
    .where(and(eq(tareasTodos.id, todoId), eq(tareasTodos.userId, userId)))
    .returning({ id: tareasTodos.id });

  if (updated.length === 0) {
    throw new NotFoundError("Tarea no encontrada.");
  }
}

export async function deleteTodo(userId: string, todoId: string) {
  const deleted = await db
    .delete(tareasTodos)
    .where(and(eq(tareasTodos.id, todoId), eq(tareasTodos.userId, userId)))
    .returning({ id: tareasTodos.id });

  if (deleted.length === 0) {
    throw new NotFoundError("Tarea no encontrada.");
  }
}

export async function reorderTodos(userId: string, ids: string[]) {
  await db.transaction(async (tx) => {
    const own = await tx.select({ id: tareasTodos.id }).from(tareasTodos).where(eq(tareasTodos.userId, userId));
    const ownIds = new Set(own.map((todo) => todo.id));

    if (ids.length !== ownIds.size || new Set(ids).size !== ids.length || !ids.every((id) => ownIds.has(id))) {
      throw new UserFacingError("El orden enviado no coincide con la lista. Recarga la página.");
    }

    for (const [position, id] of ids.entries()) {
      await tx.update(tareasTodos).set({ position }).where(eq(tareasTodos.id, id));
    }
  });
}
