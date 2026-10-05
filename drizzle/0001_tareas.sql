CREATE TABLE "tareas_closing_items" (
	"id" text PRIMARY KEY NOT NULL,
	"closingId" text NOT NULL,
	"parentId" text,
	"position" integer NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"notes" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tareas_closings" (
	"id" text PRIMARY KEY NOT NULL,
	"companyId" text NOT NULL,
	"name" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tareas_companies" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tareas_task_exceptions" (
	"id" text PRIMARY KEY NOT NULL,
	"taskId" text NOT NULL,
	"occurrenceDate" date NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"edited" boolean DEFAULT false NOT NULL,
	"title" text,
	"notes" text,
	"color" text,
	"date" date
);
--> statement-breakpoint
CREATE TABLE "tareas_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"title" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"color" text,
	"date" date NOT NULL,
	"recurrence" jsonb,
	"untilDate" date,
	"done" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tareas_closing_items" ADD CONSTRAINT "tareas_closing_items_closingId_tareas_closings_id_fk" FOREIGN KEY ("closingId") REFERENCES "public"."tareas_closings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas_closing_items" ADD CONSTRAINT "tareas_closing_items_parentId_tareas_closing_items_id_fk" FOREIGN KEY ("parentId") REFERENCES "public"."tareas_closing_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas_closings" ADD CONSTRAINT "tareas_closings_companyId_tareas_companies_id_fk" FOREIGN KEY ("companyId") REFERENCES "public"."tareas_companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas_companies" ADD CONSTRAINT "tareas_companies_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas_task_exceptions" ADD CONSTRAINT "tareas_task_exceptions_taskId_tareas_tasks_id_fk" FOREIGN KEY ("taskId") REFERENCES "public"."tareas_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas_tasks" ADD CONSTRAINT "tareas_tasks_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tareas_closing_items_closing_idx" ON "tareas_closing_items" USING btree ("closingId");--> statement-breakpoint
CREATE INDEX "tareas_closings_company_idx" ON "tareas_closings" USING btree ("companyId");--> statement-breakpoint
CREATE INDEX "tareas_companies_user_idx" ON "tareas_companies" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "tareas_task_exceptions_occurrence_idx" ON "tareas_task_exceptions" USING btree ("taskId","occurrenceDate");--> statement-breakpoint
CREATE INDEX "tareas_tasks_user_date_idx" ON "tareas_tasks" USING btree ("userId","date");