import "server-only";

import { randomUUID } from "node:crypto";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/core/db";
import { NotFoundError } from "@/core/http/errors";
import { tareasDataEntries } from "@/modules/tareas/db/schema";
import type { DataBlock } from "@/modules/tareas/lib/data-blocks";

export type DataEntry = {
  id: string;
  title: string;
  description: string;
  blocks: DataBlock[];
  updatedAt: Date;
};

const entryColumns = {
  id: tareasDataEntries.id,
  title: tareasDataEntries.title,
  description: tareasDataEntries.description,
  blocks: tareasDataEntries.blocks,
  updatedAt: tareasDataEntries.updatedAt,
};

const owned = (userId: string, entryId: string) =>
  and(eq(tareasDataEntries.id, entryId), eq(tareasDataEntries.userId, userId));

/** Every sheet with its content, so the list can be searched by what is inside. */
export async function listDataEntries(userId: string): Promise<DataEntry[]> {
  return db
    .select(entryColumns)
    .from(tareasDataEntries)
    .where(eq(tareasDataEntries.userId, userId))
    .orderBy(asc(tareasDataEntries.title));
}

export async function getDataEntry(userId: string, entryId: string): Promise<DataEntry> {
  const [entry] = await db.select(entryColumns).from(tareasDataEntries).where(owned(userId, entryId));

  if (!entry) {
    throw new NotFoundError("Dato no encontrado.");
  }

  return entry;
}

export async function createDataEntry(userId: string, title: string, description: string) {
  const id = randomUUID();
  await db.insert(tareasDataEntries).values({ id, userId, title, description, blocks: [] });
  return { id };
}

export async function updateDataEntry(
  userId: string,
  entryId: string,
  values: { title: string; description: string; blocks: DataBlock[] },
) {
  const updated = await db
    .update(tareasDataEntries)
    .set({ ...values, updatedAt: new Date() })
    .where(owned(userId, entryId))
    .returning({ id: tareasDataEntries.id });

  if (updated.length === 0) {
    throw new NotFoundError("Dato no encontrado.");
  }
}

export async function deleteDataEntry(userId: string, entryId: string) {
  const deleted = await db.delete(tareasDataEntries).where(owned(userId, entryId)).returning({ id: tareasDataEntries.id });

  if (deleted.length === 0) {
    throw new NotFoundError("Dato no encontrado.");
  }
}
