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

export async function createDataEntry(userId: string, title: string, description: string, blocks: DataBlock[] = []) {
  const id = randomUUID();
  await db.insert(tareasDataEntries).values({ id, userId, title, description, blocks });
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

/** Lower-cased, trimmed title → id of the user's existing sheets. */
export async function dataEntryIdsByTitle(userId: string) {
  const rows = await db
    .select({ id: tareasDataEntries.id, title: tareasDataEntries.title })
    .from(tareasDataEntries)
    .where(eq(tareasDataEntries.userId, userId));
  return new Map(rows.map((row) => [row.title.trim().toLocaleLowerCase("es"), row.id]));
}

/**
 * Saves imported sheets. With `duplicates = "update"`, a sheet whose title matches an existing one
 * replaces its description and content; otherwise a new sheet is always created.
 */
export async function importDataEntries(
  userId: string,
  entries: { title: string; description: string; blocks: DataBlock[] }[],
  duplicates: "update" | "create",
) {
  const existing = await dataEntryIdsByTitle(userId);
  let created = 0;
  let updated = 0;

  await db.transaction(async (tx) => {
    for (const entry of entries) {
      const existingId = duplicates === "update" ? existing.get(entry.title.trim().toLocaleLowerCase("es")) : undefined;

      if (existingId) {
        await tx
          .update(tareasDataEntries)
          .set({ description: entry.description, blocks: entry.blocks, updatedAt: new Date() })
          .where(owned(userId, existingId));
        updated += 1;
      } else {
        await tx.insert(tareasDataEntries).values({ id: randomUUID(), userId, ...entry });
        created += 1;
      }
    }
  });

  return { created, updated };
}

export async function deleteDataEntry(userId: string, entryId: string) {
  const deleted = await db.delete(tareasDataEntries).where(owned(userId, entryId)).returning({ id: tareasDataEntries.id });

  if (deleted.length === 0) {
    throw new NotFoundError("Dato no encontrado.");
  }
}
