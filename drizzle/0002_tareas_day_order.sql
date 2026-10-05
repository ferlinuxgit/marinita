CREATE TABLE "tareas_day_orders" (
	"userId" text NOT NULL,
	"date" date NOT NULL,
	"keys" jsonb NOT NULL,
	CONSTRAINT "tareas_day_orders_userId_date_pk" PRIMARY KEY("userId","date")
);
--> statement-breakpoint
ALTER TABLE "tareas_day_orders" ADD CONSTRAINT "tareas_day_orders_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;