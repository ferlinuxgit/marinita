import "server-only";

import { randomUUID } from "node:crypto";

import { and, asc, desc, eq, isNull, max } from "drizzle-orm";

import { db } from "@/core/db";
import { NotFoundError, UserFacingError } from "@/core/http/errors";
import { tareasClosingItems, tareasClosings, tareasCompanies } from "@/modules/tareas/db/schema";
import { cloneStructure, type ChecklistItem } from "@/modules/tareas/lib/checklist";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = Transaction | typeof db;

export type ClosingSummary = { id: string; name: string; createdAt: Date };
export type CompanyWithClosings = { id: string; name: string; closings: ClosingSummary[] };

const itemColumns = {
  id: tareasClosingItems.id,
  parentId: tareasClosingItems.parentId,
  position: tareasClosingItems.position,
  name: tareasClosingItems.name,
  done: tareasClosingItems.done,
  notes: tareasClosingItems.notes,
};

// --- Companies -----------------------------------------------------------------------------

export async function listCompanies(userId: string): Promise<CompanyWithClosings[]> {
  return db.query.tareasCompanies.findMany({
    where: eq(tareasCompanies.userId, userId),
    orderBy: asc(tareasCompanies.name),
    columns: { id: true, name: true },
    with: {
      closings: {
        columns: { id: true, name: true, createdAt: true },
        orderBy: desc(tareasClosings.createdAt),
      },
    },
  });
}

export async function getCompany(userId: string, companyId: string): Promise<CompanyWithClosings> {
  const company = await db.query.tareasCompanies.findFirst({
    where: and(eq(tareasCompanies.id, companyId), eq(tareasCompanies.userId, userId)),
    columns: { id: true, name: true },
    with: {
      closings: {
        columns: { id: true, name: true, createdAt: true },
        orderBy: desc(tareasClosings.createdAt),
      },
    },
  });

  if (!company) {
    throw new NotFoundError("Empresa no encontrada.");
  }

  return company;
}

export async function createCompany(userId: string, name: string) {
  const id = randomUUID();
  await db.insert(tareasCompanies).values({ id, userId, name });
  return { id, name, closings: [] };
}

export async function renameCompany(userId: string, companyId: string, name: string) {
  const updated = await db
    .update(tareasCompanies)
    .set({ name })
    .where(and(eq(tareasCompanies.id, companyId), eq(tareasCompanies.userId, userId)))
    .returning({ id: tareasCompanies.id });

  if (updated.length === 0) {
    throw new NotFoundError("Empresa no encontrada.");
  }
}

// --- Closings ------------------------------------------------------------------------------

/** Returns the closing if it belongs to one of the user's companies. */
async function getOwnedClosing(userId: string, closingId: string, tx: Executor = db) {
  const [row] = await tx
    .select({
      id: tareasClosings.id,
      name: tareasClosings.name,
      createdAt: tareasClosings.createdAt,
      companyId: tareasCompanies.id,
      companyName: tareasCompanies.name,
    })
    .from(tareasClosings)
    .innerJoin(tareasCompanies, eq(tareasClosings.companyId, tareasCompanies.id))
    .where(and(eq(tareasClosings.id, closingId), eq(tareasCompanies.userId, userId)));

  if (!row) {
    throw new NotFoundError("Cierre no encontrado.");
  }

  return row;
}

async function getItems(closingId: string, tx: Executor = db): Promise<ChecklistItem[]> {
  return tx
    .select(itemColumns)
    .from(tareasClosingItems)
    .where(eq(tareasClosingItems.closingId, closingId))
    .orderBy(asc(tareasClosingItems.position));
}

export async function getClosing(userId: string, closingId: string) {
  const closing = await getOwnedClosing(userId, closingId);

  return {
    closing: { id: closing.id, name: closing.name, createdAt: closing.createdAt },
    company: { id: closing.companyId, name: closing.companyName },
    items: await getItems(closingId),
  };
}

/** Creates a closing, empty or with the structure of another closing of the same user. */
export async function createClosing(
  userId: string,
  companyId: string,
  name: string,
  sourceClosingId: string | null,
) {
  await getCompany(userId, companyId);

  return db.transaction(async (tx) => {
    const id = randomUUID();
    await tx.insert(tareasClosings).values({ id, companyId, name });

    if (sourceClosingId) {
      await getOwnedClosing(userId, sourceClosingId, tx);
      const copy = cloneStructure(await getItems(sourceClosingId, tx), randomUUID);

      if (copy.length > 0) {
        // Parents are listed before their subtasks, so the self-reference is satisfied.
        await tx.insert(tareasClosingItems).values(copy.map((item) => ({ ...item, closingId: id })));
      }
    }

    return { id };
  });
}

export async function renameClosing(userId: string, closingId: string, name: string) {
  await getOwnedClosing(userId, closingId);
  await db.update(tareasClosings).set({ name }).where(eq(tareasClosings.id, closingId));
}

export async function deleteClosing(userId: string, closingId: string) {
  await getOwnedClosing(userId, closingId);
  await db.delete(tareasClosings).where(eq(tareasClosings.id, closingId));
}

// --- Checklist items -----------------------------------------------------------------------

async function getOwnedItem(closingId: string, itemId: string, tx: Executor = db) {
  const [item] = await tx
    .select(itemColumns)
    .from(tareasClosingItems)
    .where(and(eq(tareasClosingItems.id, itemId), eq(tareasClosingItems.closingId, closingId)));

  if (!item) {
    throw new NotFoundError("Fila no encontrada.");
  }

  return item;
}

function siblingsOf(closingId: string, parentId: string | null) {
  return and(
    eq(tareasClosingItems.closingId, closingId),
    parentId ? eq(tareasClosingItems.parentId, parentId) : isNull(tareasClosingItems.parentId),
  );
}

export async function addItem(userId: string, closingId: string, parentId: string | null, name: string) {
  await getOwnedClosing(userId, closingId);

  return db.transaction(async (tx) => {
    let movedNotes = "";

    if (parentId) {
      const parent = await getOwnedItem(closingId, parentId, tx);

      if (parent.parentId) {
        throw new UserFacingError("Las subtareas no pueden tener subtareas.");
      }

      const [existingChild] = await tx
        .select({ id: tareasClosingItems.id })
        .from(tareasClosingItems)
        .where(siblingsOf(closingId, parentId))
        .limit(1);

      if (!existingChild) {
        // A simple task becomes a grouping: its notes move to the first subtask so they stay visible.
        movedNotes = parent.notes;
        await tx
          .update(tareasClosingItems)
          .set({ done: false, notes: "" })
          .where(eq(tareasClosingItems.id, parent.id));
      }
    }

    const [{ last }] = await tx
      .select({ last: max(tareasClosingItems.position) })
      .from(tareasClosingItems)
      .where(siblingsOf(closingId, parentId));
    const item: ChecklistItem = {
      id: randomUUID(),
      parentId,
      position: (last ?? -1) + 1,
      name,
      done: false,
      notes: movedNotes,
    };

    await tx.insert(tareasClosingItems).values({ ...item, closingId });
    return item;
  });
}

export async function updateItem(
  userId: string,
  closingId: string,
  itemId: string,
  values: Partial<Pick<ChecklistItem, "name" | "done" | "notes">>,
) {
  await getOwnedClosing(userId, closingId);
  await getOwnedItem(closingId, itemId);

  if (Object.keys(values).length > 0) {
    await db.update(tareasClosingItems).set(values).where(eq(tareasClosingItems.id, itemId));
  }
}

export async function deleteItem(userId: string, closingId: string, itemId: string) {
  await getOwnedClosing(userId, closingId);
  await getOwnedItem(closingId, itemId);
  // Subtasks are removed by the ON DELETE CASCADE of parentId.
  await db.delete(tareasClosingItems).where(eq(tareasClosingItems.id, itemId));
}

/** Sets the order of all the tasks (parentId null) or all the subtasks of one task. */
export async function reorderItems(userId: string, closingId: string, parentId: string | null, ids: string[]) {
  await getOwnedClosing(userId, closingId);

  await db.transaction(async (tx) => {
    const siblings = await tx
      .select({ id: tareasClosingItems.id })
      .from(tareasClosingItems)
      .where(siblingsOf(closingId, parentId));
    const siblingIds = new Set(siblings.map((item) => item.id));

    if (ids.length !== siblingIds.size || new Set(ids).size !== ids.length || !ids.every((id) => siblingIds.has(id))) {
      throw new UserFacingError("El orden enviado no coincide con las filas del checklist. Recarga la página.");
    }

    for (const [position, id] of ids.entries()) {
      await tx.update(tareasClosingItems).set({ position }).where(eq(tareasClosingItems.id, id));
    }
  });
}
