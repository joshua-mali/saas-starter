CREATE TABLE "nsw_term_dates" (
	"id" serial PRIMARY KEY NOT NULL,
	"calendar_year" integer NOT NULL,
	"term_number" integer NOT NULL,
	"term_name" varchar(50) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"division" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "nsw_term_dates_unique" ON "nsw_term_dates" USING btree ("calendar_year","term_number","division");