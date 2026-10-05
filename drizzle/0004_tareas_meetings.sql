ALTER TABLE "tareas_task_exceptions" ADD COLUMN "time" text;--> statement-breakpoint
ALTER TABLE "tareas_tasks" ADD COLUMN "kind" text DEFAULT 'task' NOT NULL;--> statement-breakpoint
ALTER TABLE "tareas_tasks" ADD COLUMN "time" text;