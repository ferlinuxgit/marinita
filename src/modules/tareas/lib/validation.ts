import { z } from "zod";

import { tareasConfig } from "@/modules/tareas/config";
import { dataBlocksSchema } from "@/modules/tareas/lib/data-blocks";
import { isIsoDate } from "@/modules/tareas/lib/dates";

const { limits } = tareasConfig;

export const isoDateSchema = z.string().refine(isIsoDate, "Fecha no válida.");

export const colorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .transform((value) => value.toLowerCase())
  .nullable();

export const recurrenceSchema = z.object({
  freq: z.enum(["daily", "weekly", "monthly"]),
  interval: z.number().int().min(1).max(limits.interval),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7),
  monthDay: z.number().int().min(1).max(31).nullable(),
  weekendShift: z.boolean().default(false),
});

export const taskInputSchema = z
  .object({
    title: z.string().trim().min(1, "El nombre es obligatorio.").max(limits.titleLength),
    notes: z.string().max(limits.notesLength).default(""),
    color: colorSchema.default(null),
    date: isoDateSchema,
    recurrence: recurrenceSchema.nullable().default(null),
    until: isoDateSchema.nullable().default(null),
  })
  .refine((task) => !task.recurrence || !task.until || task.until >= task.date, {
    message: "La fecha de finalización no puede ser anterior a la de inicio.",
    path: ["until"],
  });

export type TaskInput = z.infer<typeof taskInputSchema>;

export const editScopeSchema = z.enum(["this", "following", "all"]);
export type EditScope = z.infer<typeof editScopeSchema>;

export const taskUpdateSchema = z.object({
  scope: editScopeSchema.default("all"),
  occurrenceDate: isoDateSchema.nullable().default(null),
  task: taskInputSchema,
});

export const taskDoneSchema = z.object({
  occurrenceDate: isoDateSchema.nullable().default(null),
  done: z.boolean(),
});

export const nameSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio.").max(limits.nameLength),
});

export const closingCreateSchema = nameSchema.extend({
  sourceClosingId: z.string().min(1).nullable().default(null),
});

export const itemCreateSchema = z.object({
  parentId: z.string().min(1).nullable().default(null),
  name: z.string().max(limits.nameLength).default(""),
});

export const itemUpdateSchema = z
  .object({
    name: z.string().max(limits.nameLength),
    done: z.boolean(),
    notes: z.string().max(limits.notesLength),
  })
  .partial();

export const reorderSchema = z.object({
  parentId: z.string().min(1).nullable(),
  ids: z.array(z.string().min(1)).min(1).max(1000),
});

export const dayOrderSchema = z.object({
  date: isoDateSchema,
  keys: z
    .array(z.string().regex(/^[^:]+:\d{4}-\d{2}-\d{2}$/))
    .max(500),
});

export const todoCreateSchema = z.object({
  title: z.string().max(limits.titleLength).default(""),
});

export const todoUpdateSchema = z
  .object({
    title: z.string().max(limits.titleLength),
    done: z.boolean(),
  })
  .partial();

export const todoReorderSchema = z.object({
  ids: z.array(z.string().min(1)).max(2000),
});

export const dataEntryCreateSchema = z.object({
  title: z.string().trim().min(1, "El título es obligatorio.").max(limits.nameLength),
  description: z.string().max(limits.notesLength).default(""),
});

export const dataEntryUpdateSchema = dataEntryCreateSchema.extend({
  blocks: dataBlocksSchema,
});
